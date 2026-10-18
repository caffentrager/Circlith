import { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "../editor/editor";
import {
  emptyCircuit,
  addComponent,
  componentKinds,
  type ConnectionTarget,
  type Kind,
  type Point,
} from "../model/circuit";
import { snap } from "../geometry/geometry";
import { resolveConnectionHits } from "../input/connection-intent";
import { nearestWires } from "../geometry/selection-hit";
import { projectSegment, same } from "../geometry/path";
import { targetPosition } from "../model/connections";
import { planWireCleanup } from "../model/wire-cleanup";
import { Symbols, path } from "../renderer/CircuitSvg";
import { WireHandles } from "../renderer/WireHandles";
import {GateBody} from '../renderer/GateBody';
import { nearestSegment, simplifyPath, type WireEditKind } from "../geometry/wire-edit";
import { CommandDispatcher } from "../editor/dispatcher";
import {
  effective,
  freshUser,
  validateUser,
  storageKey,
} from "../input/profiles";
import {
  InputResolver,
  activeContexts,
  keyToken,
  mouseButton,
  mouseModifiers,
} from "../input/resolver";
import { signature, type UserProfile } from "../input/types";
import { keyboardAdapter } from "./keyboardAdapter";
import { InputSettings } from "./InputSettings";
import { EditorSidebar } from "./EditorSidebar";
import { SimulationPanel } from './SimulationPanel';
import { compileCircuit, simulate } from '../simulation/simulator';
import type { LogicValue } from '../simulation/logic';
import { fitView, wheelZoomFactor, zoomView, ZOOM_STEP } from "../geometry/view";
import { collidingSegments, defaultRouting, routingLabel, routingStorageKey, validateRouting, type RoutingSettings } from "../geometry/routing";
import "./style.css";
const kinds = componentKinds;
export function App() {
  const [initialRouting] = useState(() => {
    try {
      const data = localStorage.getItem(routingStorageKey);
      return { value: data ? validateRouting(JSON.parse(data)) : { ...defaultRouting }, error: "" };
    } catch { return { value: { ...defaultRouting }, error: "배선 설정을 복구하지 못해 기본값을 사용합니다." }; }
  });
  const [editor] = useState(() => { const e = new Editor(); e.routing = initialRouting.value; return e; });
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, LogicValue>>({});
  const plan = useMemo(() => simulationEnabled ? compileCircuit(editor.circuit) : null, [simulationEnabled, editor.circuit]);
  const simulation = useMemo(() => plan ? simulate(plan, inputValues) : undefined, [plan, inputValues]);
  useEffect(() => {
    setInputValues(previous => {
      const entries = Object.entries(previous).filter(([id]) => editor.circuit.components[id]?.kind === 'Input');
      return entries.length === Object.keys(previous).length ? previous : Object.fromEntries(entries);
    });
  }, [editor.circuit]);
  const changeInput = (id: string, value: LogicValue) => {
    if (!editor.draft && !editor.selectionBox && editor.circuit.components[id]?.kind === 'Input')
      setInputValues(previous => ({ ...previous, [id]: value }));
  };
  const [, render] = useState(0);
  const refresh = () => render((v) => v + 1);
  const svg = useRef<SVGSVGElement>(null);
  const properties = useRef<HTMLElement>(null);
  const cursor = useRef<Point>({ x: 200, y: 200 });
  const space = useRef(false);
  const composing = useRef(false);
  const hover = useRef<ConnectionTarget | undefined>(undefined);
  const pointer = useRef<{ clientX: number; clientY: number } | null>(null);
  const paletteDrag = useRef<{
    kind: Kind;
    start: Point;
    active: boolean;
    inside: boolean;
  } | null>(null);
  const suppressPaletteClick = useRef(false);
  const gesture = useRef<{
    type: "pan" | "move" | "wire" | "box" | "panPending" | "click" | "wireEditPending" | "wireEdit";
    start: Point;
    view: { x: number; y: number };
    moved: boolean;
    threshold?: number;
    clickCommand?: string;
    objectKey?: string;
    wireEdit?: { wire: string; index: number; kind: WireEditKind; origin: Point };
  } | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [connectionChoice, setConnectionChoice] = useState<{ targets: ConnectionTarget[]; action: "start" | "finish" } | null>(null);
  const [selectionChoice, setSelectionChoice] = useState<{ keys: string[]; command: string } | null>(null);
  const [grid, setGrid] = useState(true);
  const [message, setMessage] = useState(
    "왼쪽 부품을 도면으로 드래그하세요. 접점을 클릭하거나 드래그하면 배선이 시작됩니다.",
  );
  const [singleKeys, setSingleKeys] = useState(true);
  const [initial] = useState(() => {
    try {
      const data = localStorage.getItem(storageKey);
      return {
        user: data ? validateUser(JSON.parse(data)) : freshUser(),
        error: "",
      };
    } catch (e) {
      return { user: freshUser(), error: `프로필 복구 실패: ${String(e)}` };
    }
  });
  const [user, setUser] = useState<UserProfile>(initial.user);
  const [settings, setSettings] = useState(false);
  const dispatchRef = useRef<(command: string) => void>(() => {});
  const wheelHandlerRef = useRef<(event: WheelEvent) => void>(() => {});
  const [resolver] = useState(
    () =>
      new InputResolver(effective(initial.user), refresh, (command) =>
        dispatchRef.current(command),
      ),
  );
  const contexts = () =>
    activeContexts(
      settings || menu || connectionChoice || selectionChoice
        ? "MODAL"
        : search !== null
          ? "TEXT_EDITOR"
          : editor.focus,
      editor.operation,
    );
  const hint = (command: string) =>
    resolver.profile.bindings
      .filter((b) => b.command === command && b.input.type.startsWith("key"))
      .map((b) => signature(b.input))
      .join(" / ");
  const applyProfile = (next: UserProfile) => {
    const validated = validateUser(next);
    resolver.setProfile(effective(validated));
    setUser(validated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(validated));
      setMessage("입력 프로필을 저장했습니다.");
    } catch (e) {
      setMessage(`프로필 저장 실패: ${String(e)}. JSON 내보내기로 보관하세요.`);
    }
  };
  const applyRouting = (next: RoutingSettings) => {
    editor.routing = validateRouting(next);
    try {
      localStorage.setItem(routingStorageKey, JSON.stringify(editor.routing));
      setMessage(`배선 설정 저장: ${routingLabel(next)}`);
    } catch { setMessage("배선 설정은 이번 세션에 적용되었습니다. 브라우저 저장에 실패했습니다."); }
    refresh();
  };
  const screen = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const drawingPoint = (e: { clientX: number; clientY: number }) => {
    const p = screen(e),
      v = editor.viewport;
    return { x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom };
  };
  const world = (e: { clientX: number; clientY: number }) =>
    snap(drawingPoint(e));
  const target = (e: EventTarget | null): ConnectionTarget | undefined => {
    const pin = (e as Element)?.closest("[data-pin]")?.getAttribute("data-pin");
    const junction = (e as Element)?.closest("[data-junction]")?.getAttribute("data-junction");
    return pin ? { type: "pin", id: pin } : junction ? { type: "junction", id: junction } : undefined;
  };
  const insideCanvas = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  };
  const hitsAt = (e: { clientX: number; clientY: number } | null) => {
    if (!e || !insideCanvas(e)) return [];
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const surface = el?.closest('[data-pin]') ? 'pin'
      : el?.closest('[data-component]') && !el.closest('.pin-lead') ? 'body' : 'other';
    return resolveConnectionHits(editor.preview(), drawingPoint(e), editor.viewport.zoom, {
      selecting: editor.tool === 'SELECT' && !editor.draft, surface,
    });
  };
  const hitConnection = (e: { clientX: number; clientY: number } | null): ConnectionTarget | undefined => {
    const hits = hitsAt(e);
    return hits.length === 1 ? hits[0].target : undefined;
  };
  const requestConnection = (action: "start" | "finish", explicit?: ConnectionTarget) => {
    const targets = explicit ? [explicit] : hitsAt(pointer.current).map((hit) => hit.target);
    if (targets.length > 1) { resolver.cancel(); setConnectionChoice({ targets, action }); return; }
    if (!targets.length) {
      if (action === "finish") setMessage("강조된 핀·접속점·선분에서 연결을 완료하세요. 빈 공간 클릭은 경유점입니다.");
      return;
    }
    if (action === "start") editor.startWire(targets[0]);
    else editor.confirm(targets[0]);
  };
  const rollback = () => {
    if (
      gesture.current?.type === "move" ||
      gesture.current?.type === "wire" ||
      gesture.current?.type === "box" ||
      gesture.current?.type === "wireEdit" ||
      paletteDrag.current?.active
    )
      editor.cancel();
    if (gesture.current?.type === "pan") {
      editor.viewport.x = gesture.current.view.x;
      editor.viewport.y = gesture.current.view.y;
    }
    gesture.current = null;
    resolver.cancel();
    paletteDrag.current = null;
    hover.current = undefined;
    pointer.current = null;
    editor.transient = "NONE";
    space.current = false;
    refresh();
  };
  useEffect(() => {
    const blur = () => rollback();
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, [editor]);
  useEffect(() => {
    const el = svg.current!;
    const wheel = (event: WheelEvent) => wheelHandlerRef.current(event);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    if (initial.error || initialRouting.error) setMessage([initial.error, initialRouting.error].filter(Boolean).join(" · "));
    return () => resolver.cancel();
  }, []);
  const place = (kind: Kind) => {
    dispatcher.dispatch("component.place", { kind, position: cursor.current });
    setSearch(null);
    setMenu(false);
    svg.current?.focus({ preventScroll: true });
    refresh();
  };
  const undo = () => {
    editor.undo();
    refresh();
  };
  const redo = () => {
    if (editor.draft)
      setMessage("초안을 확정하거나 취소한 후 Redo를 실행하세요.");
    editor.redo();
    refresh();
  };
  const rotate = (clockwise = false) => {
    editor.rotate(clockwise);
    if (gesture.current?.type === "move" && editor.draft?.type === "MOVE") gesture.current.moved = true;
    refresh();
  };
  const move = () => {
    if (editor.selection.length && !editor.selection.some((key) => editor.circuit.components[key])) {
      setMessage("선분을 드래그하거나 원형 핸들을 끌어 이동하세요. 사각형은 모서리, 마름모는 우회 구간입니다.");
      return;
    }
    editor.move(cursor.current);
    svg.current?.focus({ preventScroll: true });
    refresh();
  };
  const zoomAt = (factor: number, point?: Point) => {
    const v = editor.viewport,
      p = point ?? {
        x: svg.current!.clientWidth / 2,
        y: svg.current!.clientHeight / 2,
      };
    editor.viewport = zoomView(v, factor, p);
    hover.current = hitConnection(pointer.current);
  };
  const dispatcher = new CommandDispatcher(
    {
      "app.cancel": (p) => {
        resolver.cancel();
        if (p?.operation) editor.escape();
        if (selectionChoice) {
          setSelectionChoice(null);
          svg.current?.focus({ preventScroll: true });
        } else if (connectionChoice) {
          setConnectionChoice(null);
          svg.current?.focus({ preventScroll: true });
        } else if (settings) {
          setSettings(false);
          svg.current?.focus({ preventScroll: true });
        } else if (menu) {
          setMenu(false);
          svg.current?.focus({ preventScroll: true });
        } else if (search !== null) {
          setSearch(null);
          svg.current?.focus({ preventScroll: true });
        } else if (gesture.current || paletteDrag.current) rollback();
        else editor.escape();
      },
      "app.confirm": (p) => {
        const operation = editor.draft?.type;
        try {
          if (editor.draft?.type === "WIRE_DRAFT") {
            requestConnection("finish", p?.endpoint);
            if (!editor.draft) setMessage("연결했습니다. 점은 접속점이며, 점 없이 지나가는 교차는 미접속입니다. WIRE 도구에서는 클릭으로 계속 분기할 수 있습니다.");
          } else {
            const cleaning = editor.draft?.type === "WIRE_CLEANUP";
            editor.confirm(undefined, p?.repeat ?? false);
            if (cleaning && !editor.draft) setMessage("중복 우회를 정리했습니다. 접속점과 연결은 유지됩니다. Ctrl+Z로 전체 복구할 수 있습니다.");
          }
          if (operation === "SEGMENT_MOVE" && !editor.draft) setMessage("배선 경로를 수정했습니다. Ctrl+Z로 되돌릴 수 있습니다.");
        } catch (error) {
          if (p?.pointerDrag && (operation === "MOVE" || operation === "SEGMENT_MOVE")) editor.cancel();
          throw error;
        }
      },
      "history.undo": undo,
      "history.redo": redo,
      "edit.delete":()=>{
        if(gesture.current)throw new Error('드래그를 끝낸 후 삭제하세요.');
        const corner=!!editor.selectedCorner;
        editor.deleteSelection();hover.current=undefined;pointer.current=null;
        setMessage(corner?'꺾임점을 제거했습니다. 직각 경로와 연결은 유지됩니다.':'선택한 대상을 삭제했습니다. Undo로 복구할 수 있습니다.');
      },
      "component.place": (p) => editor.place(p.kind, p.position),
      "tool.select": () => editor.setTool("SELECT"),
      "component.addSearch": () => {
        editor.cancel();
        resolver.cancel();
        setSearch("");
        editor.focus = "TEXT_EDITOR";
      },
      "component.moveSafe": move,
      "component.rotateCCW90": () => rotate(),
      "component.rotateCW90": () => rotate(true),
      "wire.start": (p) => {
        if (p?.endpoint) requestConnection("start", p.endpoint);
        else if (editor.draft?.type !== "WIRE_DRAFT") {
          editor.setTool("WIRE");
          requestConnection("start");
        }
      },
      "wire.branch": () => {
        if (editor.draft) return;
        const key = editor.selection.find((id) => editor.circuit.geometry.wires[id]);
        if (!key) { setMessage("분기할 배선을 선택하세요."); return; }
        const points = editor.circuit.geometry.wires[key].points;
        const i = nearestSegment(points, cursor.current);
        const position = projectSegment(points[i], points[i + 1], snap(cursor.current));
        editor.startWire({ type: "wire", id: key, position });
        svg.current?.focus({ preventScroll: true });
      },
      "wire.selectNet": () => { editor.selectNet(); svg.current?.focus({ preventScroll: true }); },
      "wire.joinCrossing": (p) => {
        editor.joinWires(p?.targets ?? hitsAt(pointer.current).map((hit) => hit.target));
        setMessage("교차점을 접속했습니다. 점이 있는 교차만 전기적으로 연결됩니다.");
      },
      "wire.removeLastPoint": () => editor.backspace(),
      "wire.toggleBend": () => {
        if (editor.draft?.type === "WIRE_DRAFT" || editor.draft?.type === "WIRE_ROUTE")
          {
            const d = editor.draft;
            if (!d.bendOverride) {
              const start = d.waypoints[d.waypoints.length - 1];
              d.horizontal = editor.routing.pathMode === "smart" ? Math.abs(d.position.x - start.x) >= Math.abs(d.position.y - start.y) : editor.routing.pathMode === "horizontal";
            }
            d.horizontal = !d.horizontal;
            d.bendOverride = true;
          }
      },
      "wire.editPath": (p) => {
        if (p?.wire) editor.beginWireEdit(p.wire, p.index, p.kind, p.origin);
        else setMessage("수정할 선분 또는 편집 핸들을 드래그하세요.");
      },
      "wire.reroute": () => {
        const wires = editor.selection.filter((key) => editor.circuit.geometry.wires[key]);
        if (wires.length !== 1 || editor.selection.length !== 1) {
          setMessage("다시 그릴 배선 하나만 선택하세요.");
          return;
        }
        editor.rerouteWire(wires[0]);
        svg.current?.focus({ preventScroll: true });
        setMessage("경유점 클릭 · Shift+Space 꺾임 전환 · Backspace 되돌리기 · Enter 완료 · Esc 취소. 양 끝 연결은 유지됩니다.");
      },
      "wire.tidyHorizontal": () => { editor.tidyWires(true); svg.current?.focus({ preventScroll: true }); },
      "wire.tidyVertical": () => { editor.tidyWires(false); svg.current?.focus({ preventScroll: true }); },
      "wire.tidyConfigured": () => { editor.tidyWires(); svg.current?.focus({ preventScroll: true }); },
      "wire.cleanupDuplicates": () => {
        const count = editor.beginWireCleanup();
        setMessage(count ? `중복 배선 ${count}개를 빨간 점선으로 표시했습니다. 초록색 경로는 남습니다. Enter: 정리 · Esc: 취소`
          : "같은 두 접속점을 직접 연결한 중복 배선이 없습니다. 중간 분기가 있는 경로는 보존합니다.");
        svg.current?.focus({ preventScroll: true });
      },
      "grid.toggleVisible": () => setGrid((v) => !v),
      "selection.all": () => {
        editor.selectedCorner=null;
        if (!editor.draft)
          editor.selection = [
            ...Object.keys(editor.circuit.components),
            ...Object.keys(editor.circuit.geometry.wires),
          ];
      },
      "selection.replaceItem": (p) => {
        editor.selectedCorner=null;
        if (p?.key) editor.selection = [p.key];
      },
      "selection.toggleItem": (p) => {
        editor.selectedCorner=null;
        if (p?.key)
          editor.selection = editor.selection.includes(p.key)
            ? editor.selection.filter((k) => k !== p.key)
            : [...editor.selection, p.key];
      },
      "selection.addItem": (p) => {
        editor.selectedCorner=null;
        if (p?.key && !editor.selection.includes(p.key))
          editor.selection = [...editor.selection, p.key];
      },
      "selection.box": (p) => editor.beginBox(p.start, p.additive),
      "view.pan": (p) => {
        if (p?.start) {
          gesture.current = {
            type: "pan",
            start: p.start,
            view: { x: editor.viewport.x, y: editor.viewport.y },
            moved: false,
          };
          editor.transient = "PAN";
        }
      },
      "view.zoom": (p) =>
        zoomAt(
          wheelZoomFactor(p.delta, p.deltaMode ?? 0, svg.current!.clientHeight, !!resolver.profile.behavior?.reverseWheel),
          p.point,
        ),
      "view.zoomIn": () => zoomAt(ZOOM_STEP),
      "view.zoomOut": () => zoomAt(1 / ZOOM_STEP),
      "view.fitAll": () => {
        const v = fitView(
          editor.circuit,
          svg.current!.clientWidth,
          svg.current!.clientHeight,
        );
        if (v) editor.viewport = v;
      },
      "view.fitSelection": () => {
        const v = fitView(
          editor.circuit,
          svg.current!.clientWidth,
          svg.current!.clientHeight,
          editor.selection,
        );
        if (v) editor.viewport = v;
      },
      "view.contextMenu": (p) => {
        if (!editor.draft && p?.key && !editor.selection.includes(p.key)) {
          editor.selectedCorner=null;
          editor.selection = [p.key];
        }
        resolver.cancel();
        editor.focus = "MODAL";
        setMenu(true);
      },
    },
    setMessage,
  );
  const dispatch = (command: string, payload?: any) => {
    try { dispatcher.dispatch(command, payload); }
    catch (error) { setMessage(`실행하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`); }
    refresh();
  };
  dispatchRef.current = dispatch;
  wheelHandlerRef.current = (e) => {
    if (!Number.isFinite(e.deltaY) || e.deltaY === 0) return;
    const modifiers = mouseModifiers(e),
      type = modifiers.length ? "wheelChord" : "wheel";
    const binding = resolver.mouse(
      type,
      undefined,
      modifiers,
      contexts(),
      e.deltaY < 0 ? "up" : "down",
    );
    if (!binding) return;
    e.preventDefault();
    dispatch(binding.command, { delta: e.deltaY, deltaMode: e.deltaMode, point: screen(e) });
    pointer.current = { clientX: e.clientX, clientY: e.clientY };
    hover.current = hitConnection(e);
    refresh();
  };
  const keyboard = keyboardAdapter({
    resolver,
    contexts,
    composing: () => composing.current,
    singleKeys: () => singleKeys,
    gestureActive: () => !!gesture.current,
    blocked: () => editor.transient === "PAN" || !!editor.selectionBox,
    rollback,
    space: (value) => {
      space.current = value;
    },
    dispatch,
  });
  const previewResult = editor.previewResult(), preview = previewResult.circuit;
  const draft = editor.draft;
  useEffect(() => {
    if (draft?.type === "WIRE_CLEANUP") properties.current?.scrollTo({ top: 0 });
  }, [draft?.type]);
  const wirePlan = draft?.type === "WIRE_DRAFT" ? editor.wirePlan() : null;
  const blocked = previewResult.blocked || !!wirePlan?.blocked;
  const collisions = [...Object.values(preview.geometry.wires).flatMap((w) => collidingSegments(preview, w.points)), ...(wirePlan?.collisions ?? [])];
  const selectedComponents = editor.selection.filter((key) => editor.circuit.components[key]).length;
  const selectedWires = editor.selection.filter((key) => editor.circuit.geometry.wires[key]).length;
  const cleanup = draft?.type === "WIRE_CLEANUP" ? draft.plan : null;
  const cleanupAvailable = !draft && selectedWires > 0 ? planWireCleanup(editor.circuit, editor.selection).remove.length : 0;
  const cleanupAnchored = cleanup?.remove.filter((key) => editor.circuit.geometry.wires[key].anchors?.length).length ?? 0;
  const snapHits = hitsAt(pointer.current);
  const snapPoint = hover.current ? targetPosition(preview, hover.current) : snapHits[0]?.position;
  const wiring = editor.tool === "WIRE" || draft?.type === "WIRE_DRAFT";
  const snapLabel = snapHits.length > 1 ? "대상이 겹칩니다 · 클릭하여 선택" : hover.current?.type === "wire"
    ? draft?.type === "WIRE_DRAFT" ? "클릭하여 선에 접속" : wiring ? "클릭하여 분기 시작" : "W로 분기 · 드래그로 편집"
    : hover.current?.type === "junction" ? "접속점" : hover.current ? "핀 연결" : "";
  const targetLabel = (candidate: ConnectionTarget) => {
    const pinName = (id: string) => {
      const p = editor.circuit.pins[id];
      return `${editor.circuit.components[p.component].name} ${p.index + 1}`;
    };
    if (candidate.type === "pin") return `핀 · ${pinName(candidate.id)}`;
    if (candidate.type === "junction") return "기존 접속점";
    const w = editor.circuit.geometry.wires[candidate.id];
    const name = (e: typeof w.from) => e.type === "pin" ? pinName(e.id) : "접속점";
    return `${name(w.from)} → ${name(w.to)} · 연결망 ${Object.keys(editor.circuit.nets).indexOf(w.net) + 1}`;
  };
  const ghost = emptyCircuit();
  if (draft?.type === "PLACE")
    addComponent(ghost, draft.kind, draft.position, draft.rotation);
  const results = kinds
    .filter((k) => {
      const q = (search ?? "").trim().toLowerCase();
      return (
        k.toLowerCase().includes(q) ||
        (q === "in" && k === "Input") ||
        (q === "out" && k === "Output")
      );
    })
    .sort(
      (a, b) =>
        Number(b.toLowerCase() === search?.toLowerCase()) -
        Number(a.toLowerCase() === search?.toLowerCase()),
    );
  const renderPaletteButton = (k: Kind) => (
          <button
            key={k}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.focus();
              suppressPaletteClick.current = false;
              paletteDrag.current = {
                kind: k,
                start: { x: e.clientX, y: e.clientY },
                active: false,
                inside: false,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const drag = paletteDrag.current;
              if (!drag) return;
              if (
                !drag.active &&
                Math.hypot(
                  e.clientX - drag.start.x,
                  e.clientY - drag.start.y,
                ) >= 4
              ) {
                drag.active = true;
                dispatch("component.place", {
                  kind: drag.kind,
                  position: world(e),
                });
              }
              if (drag.active) {
                drag.inside = insideCanvas(e);
                editor.update(world(e));
                hover.current = undefined;
                refresh();
              }
            }}
            onPointerUp={(e) => {
              const drag = paletteDrag.current;
              paletteDrag.current = null;
              if (drag?.active) {
                suppressPaletteClick.current = true;
                if (insideCanvas(e)) {
                  editor.update(world(e));
                  dispatch("app.confirm");
                  svg.current?.focus({ preventScroll: true });
                } else editor.cancel();
                refresh();
              }
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              suppressPaletteClick.current = true;
              rollback();
            }}
            onLostPointerCapture={() => {
              if (paletteDrag.current) rollback();
            }}
            onKeyDown={(e) => {
              if (
                resolver.key(keyToken(e), ["canvas"], e.repeat).command ===
                  "app.cancel" &&
                paletteDrag.current
              ) {
                e.preventDefault();
                suppressPaletteClick.current = true;
                rollback();
              }
            }}
            onClick={() => {
              if (suppressPaletteClick.current) {
                suppressPaletteClick.current = false;
                return;
              }
              place(k);
            }}
          >
            <svg aria-hidden="true" className="library-symbol" viewBox="-45 -25 90 50"><GateBody kind={k}/></svg>{k}
          </button>
  );
  return (
    <div
      className="app"
      onContextMenuCapture={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("input,textarea") || el.isContentEditable) return;
        // pointerup may mount a menu overlay before the browser emits contextmenu.
        // Capture at the app boundary so the new target cannot bypass suppression.
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDownCapture={(e) => {
        // Right-clicking a modal backdrop must keep keyboard ownership (including Esc).
        const el = e.target as HTMLElement;
        if (e.button === 2 && (menu || settings || connectionChoice || selectionChoice) && !el.closest("input,textarea") && !el.isContentEditable)
          e.preventDefault();
      }}
      onFocusCapture={(e) => {
        resolver.cancel();
        const el = e.target as HTMLElement;
        editor.focus = el.closest("svg")
          ? "CANVAS"
          : el.matches('input,textarea') || el.isContentEditable
            ? "TEXT_EDITOR"
            : el.closest('.overlay,[role="dialog"]') ? "MODAL" : "CANVAS";
      }}
      onClick={(e) => {
        const button = (e.target as Element).closest("button");
        if (button && !button.disabled && !button.closest('.overlay,[role="dialog"],.sidebar-tabs,.simulation-panel')) svg.current?.focus({ preventScroll: true });
      }}
    >
      <header>
        <strong>
          Circlith <small>조합논리 프로토타입</small>
        </strong>
        <input aria-label="프로젝트 이름" defaultValue="Untitled circuit" />
        <button
          aria-pressed={editor.tool === "SELECT"}
          onClick={() => {
            dispatch("tool.select");
          }}
        >
          선택 {hint("tool.select")}
        </button>
        <button
          aria-pressed={editor.tool === "WIRE"}
          onClick={() => {
            dispatch("wire.start");
            svg.current?.focus({ preventScroll: true });
            refresh();
          }}
        >
          배선 {hint("wire.start")}
        </button>
        <button onClick={() => dispatch("history.undo")}>Undo</button>
        <button onClick={() => dispatch("history.redo")}>Redo</button>
        <button aria-pressed={simulationEnabled} onClick={() => setSimulationEnabled(value => !value)}>시뮬레이션</button>
        <button
          onClick={() => {
            rollback();
            resolver.cancel();
            setSettings(true);
          }}
        >
          설정
        </button>
        <span>{editor.history.length} committed edits</span>
      </header>
      <EditorSidebar circuit={editor.circuit} selection={editor.selection}
        renderPart={renderPaletteButton} searchCommand={(<button
          onClick={() => {
            dispatch("component.addSearch");
          }}
        >
          검색 {hint("component.addSearch")}
        </button>)}
        busy={!!editor.draft || !!editor.selectionBox || !!gesture.current || !!paletteDrag.current}
        onSelect={(key, additive) => {
          dispatch(additive ? "selection.toggleItem" : "selection.replaceItem", {key});
          svg.current?.focus({preventScroll:true});
        }}
        onReveal={key => {
          dispatch("selection.replaceItem", {key}); dispatch("view.fitSelection");
          svg.current?.focus({preventScroll:true});
        }}>
        <p>
          부품을 도면으로 드래그
          <br />
          접점 클릭 → 클릭으로 연결
          <br />
          접점 드래그 → 접점에서 놓기
          <br />
          빈 공간 좌드래그: 선택박스
          <br />
          우클릭: 메뉴 · Pan: 프리셋 참조
        </p>
        <label>
          <input
            type="checkbox"
            checked={singleKeys}
            onChange={(e) => setSingleKeys(e.target.checked)}
          />
          문자 단축키 사용
        </label>
        <p className="note">
          Safe Move 경로는 잠정 규칙입니다. 회로 저장은 후속 단계입니다.
          시뮬레이션을 켜면 확정된 조합회로를 계산합니다.
        </p>
      </EditorSidebar>
      <main>
        <svg
          ref={svg}
          tabIndex={0}
          aria-label="회로 도면"
          data-operation={editor.operation}
          data-tool={editor.tool}
          data-transient={editor.transient}
          data-net-count={Object.keys(editor.circuit.nets).length}
          data-junction-count={Object.keys(editor.circuit.junctions).length}
          data-snap-kind={snapHits.length > 1 ? "ambiguous" : hover.current?.type ?? "none"}
          data-routing-mode={editor.routing.pathMode}
          data-routing-blocked={blocked}
          onFocus={() => {
            editor.focus = "CANVAS";
          }}
          onBlur={rollback}
          onCompositionStart={() => {
            resolver.cancel();
            composing.current = true;
            editor.focus = "IME_COMPOSING";
          }}
          onCompositionEnd={() => {
            composing.current = false;
            editor.focus = "CANVAS";
          }}
          onDoubleClick={(e) => {
            const b = resolver.mouse(
              "mouseDoubleClick",
              mouseButton(e.button),
              mouseModifiers(e),
              contexts(),
            );
            if (b) {
              e.preventDefault();
              dispatch(b.command);
            }
          }}
          onPointerDown={(e) => {
            const object = (e.target as Element).closest(
              '[data-component],[data-pin],[data-wire],[data-wire-hit],[data-wire-handle],[data-layer="junctions"]',
            );
            svg.current?.focus({ preventScroll: true });
            pointer.current = { clientX: e.clientX, clientY: e.clientY };
            cursor.current = world(e);
            const button = mouseButton(e.button),
              modifiers = mouseModifiers(e, space.current);
            const dragBinding = resolver.mouse(
              "mouseDrag",
              button,
              modifiers,
              contexts(),
            );
            const clickBinding = resolver.mouse(
              "mouseClick",
              button,
              modifiers,
              contexts(),
            );
            let objectKey =
              object?.getAttribute("data-component") ??
              object?.getAttribute("data-wire") ??
              object?.getAttribute("data-wire-hit") ??
              object?.getAttribute("data-wire-handle") ?? undefined;
            const wireCandidates = object?.hasAttribute('data-wire-hit') || object?.hasAttribute('data-wire')
              ? nearestWires(editor.circuit, drawingPoint(e), editor.viewport.zoom) : [];
            if (wireCandidates.length === 1) objectKey = wireCandidates[0];
            if (
              dragBinding?.command === "view.pan" ||
              (button === "right" && clickBinding)
            ) {
              e.preventDefault();
              gesture.current = {
                type:
                  dragBinding?.command === "view.pan" ? "panPending" : "click",
                start: screen(e),
                view: { x: editor.viewport.x, y: editor.viewport.y },
                moved: false,
                threshold: dragBinding?.input.thresholdPx ?? 4,
                clickCommand: clickBinding?.command,
                objectKey,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              refresh();
              return;
            }
            if (button !== "left") return;
            const editHandle=(e.target as Element).closest('[data-wire-handle]');
            const pin = editor.tool==='SELECT'&&editHandle?undefined:target(e.target) ?? hitConnection(e);
            hover.current = pin;
            if (editor.draft) {
              editor.update(cursor.current);
              if (editor.draft.type === "WIRE_ROUTE") {
                const end = editor.circuit.geometry.wires[editor.draft.wire].to;
                if (pin?.type === end.type && pin.id === end.id) dispatch("app.confirm");
                else editor.waypoint();
              } else if (editor.draft.type === "WIRE_DRAFT" && !pin && hitsAt(e).length <= 1) editor.waypoint();
              else
                dispatch("app.confirm", { endpoint: pin, repeat: e.shiftKey });
              refresh();
              return;
            }
            if (pin && (pin.type !== "wire" || editor.tool === "WIRE")) {
              dispatch("wire.start", { endpoint: pin });
              gesture.current = {
                type: "wire",
                start: screen(e),
                view: { x: 0, y: 0 },
                moved: false,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              refresh();
              return;
            }
            const wire = objectKey && editor.circuit.geometry.wires[objectKey];
            if (editor.tool === "WIRE") {
              if (hitsAt(e).length > 1) dispatch("wire.start");
              return;
            }
            if (wireCandidates.length > 1) {
              resolver.cancel();
              setSelectionChoice({ keys: wireCandidates, command:
                clickBinding?.command === 'selection.toggleItem' || clickBinding?.command === 'selection.addItem'
                  ? clickBinding.command : 'selection.replaceItem' });
              return;
            }
            const key = objectKey;
            if (key) {
              if (
                clickBinding?.command === "selection.toggleItem" ||
                clickBinding?.command === "selection.addItem"
              ) {
                dispatch(clickBinding.command, { key });
              } else {
                if (wire || !editor.selection.includes(key))
                  dispatch("selection.replaceItem", { key });
                if (wire) {
                  const handle = (e.target as Element).closest("[data-wire-handle]");
                  if(handle?.getAttribute('data-kind')==='corner')editor.selectCorner(key,Number(handle.getAttribute('data-index')));
                  gesture.current = {
                    type: "wireEditPending", start: screen(e), view: { x: 0, y: 0 }, moved: false,
                    wireEdit: { wire: key, kind: (handle?.getAttribute("data-kind") ?? "segment") as WireEditKind,
                      index: handle ? Number(handle.getAttribute("data-index")) : nearestSegment(simplifyPath(wire.points), drawingPoint(e)),
                      origin: cursor.current },
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setMessage("선분·원형 핸들 드래그: 이동 · 사각형: 클릭 후 Delete 제거/드래그 이동 · 마름모: 우회 구간 추가 · Esc: 취소");
                } else {
                  dispatch("component.moveSafe");
                  gesture.current = {
                    type: "move",
                    start: screen(e),
                    view: { x: 0, y: 0 },
                    moved: false,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
              }
            } else if (
              !object &&
              (dragBinding?.command === "selection.box" ||
                (e.shiftKey &&
                  resolver.mouse("mouseDrag", button, [], contexts())
                    ?.command === "selection.box"))
            ) {
              dispatch("selection.box", {
                start: drawingPoint(e),
                additive: e.shiftKey,
              });
              gesture.current = {
                type: "box",
                start: screen(e),
                view: { x: 0, y: 0 },
                moved: false,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            refresh();
          }}
          onPointerMove={(e) => {
            pointer.current = { clientX: e.clientX, clientY: e.clientY };
            const g = gesture.current;
            if (g?.type === "wireEditPending" || g?.type === "wireEdit") {
              const p = screen(e);
              if (g.type === "wireEditPending" && Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 4) {
                dispatch("wire.editPath", g.wireEdit);
                g.type = "wireEdit";
                g.moved = true;
              }
              if (g.type === "wireEdit") editor.update(world(e));
            } else if (g?.type === "panPending") {
              const p = screen(e);
              if (
                Math.hypot(p.x - g.start.x, p.y - g.start.y) >=
                (g.threshold ?? 4)
              ) {
                dispatch("view.pan", { start: g.start });
                gesture.current!.view = g.view;
                editor.viewport.x = g.view.x + p.x - g.start.x;
                editor.viewport.y = g.view.y + p.y - g.start.y;
              }
            } else if (g?.type === "click") {
              const p = screen(e);
              g.moved ||= Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 4;
            } else if (g?.type === "pan") {
              const p = screen(e);
              editor.viewport.x = g.view.x + p.x - g.start.x;
              editor.viewport.y = g.view.y + p.y - g.start.y;
              hover.current = hitConnection(e);
            } else if (g?.type === "box") {
              editor.updateBox(drawingPoint(e));
              const p = screen(e);
              g.moved ||= Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 4;
            } else {
              cursor.current = world(e);
              const p = screen(e),
                v = editor.viewport;
              hover.current = hitConnection(e);
              editor.update(
                editor.draft?.type === "WIRE_DRAFT" && hover.current
                  ? targetPosition(editor.circuit, hover.current)
                  : cursor.current,
                hover.current,
              );
              if (g)
                g.moved ||= Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 4;
            }
            refresh();
          }}
          onPointerUp={(e) => {
            const g = gesture.current;
            gesture.current = null;
            if (
              (g?.type === "panPending" || g?.type === "click") &&
              !g.moved &&
              g.clickCommand
            )
              dispatch(g.clickCommand, { key: g.objectKey });
            if (g?.type === "box") {
              editor.updateBox(drawingPoint(e));
              editor.finishBox(g.moved);
            }
            if (g?.type === "move") {
              if (g.moved && insideCanvas(e)) dispatch("app.confirm", { pointerDrag: true });
              else editor.cancel();
            }
            if (g?.type === "wireEdit") {
              if (insideCanvas(e)) {
                editor.update(world(e));
                dispatch("app.confirm", { pointerDrag: true });
              } else editor.cancel();
            }
            if (
              g?.type === "wire" &&
              g.moved &&
              editor.draft?.type === "WIRE_DRAFT"
            ) {
              if (!insideCanvas(e)) editor.cancel();
              else {
                editor.update(world(e));
                pointer.current = { clientX: e.clientX, clientY: e.clientY };
                dispatch("app.confirm");
              }
            }
            hover.current = hitConnection(e);
            editor.transient = "NONE";
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            refresh();
          }}
          onPointerCancel={rollback}
          onPointerLeave={() => {
            hover.current = undefined;
            pointer.current = null;
            refresh();
          }}
          onLostPointerCapture={() => {
            if (gesture.current) rollback();
          }}
          onKeyUp={keyboard.keyUp}
          onKeyDown={keyboard.keyDown}
        >
          <defs>
            <pattern
              id="grid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0" cy="0" r=".7" fill="#b5c1ce" />
            </pattern>
          </defs>
          <g
            transform={`translate(${editor.viewport.x} ${editor.viewport.y}) scale(${editor.viewport.zoom})`}
          >
            {grid && (
              <rect
                data-layer="grid"
                x="-10000"
                y="-10000"
                width="20000"
                height="20000"
                fill="url(#grid)"
              />
            )}
            <Symbols circuit={preview} selection={editor.selection} zoom={editor.viewport.zoom}
              simulation={simulation} inputs={inputValues}
              onToggleInput={!draft && !editor.selectionBox && !gesture.current && !paletteDrag.current
                ? id => changeInput(id, inputValues[id] === '1' ? '0' : '1') : undefined}/>
            {cleanup && <g data-layer="wire-cleanup-preview" pointerEvents="none">
              {cleanup.keep.map((key) => <polyline key={key} data-cleanup-keep={key} points={path(preview.geometry.wires[key].points)} className="wire-cleanup-keep" />)}
              {cleanup.remove.map((key) => <polyline key={key} data-cleanup-remove={key} points={path(preview.geometry.wires[key].points)} className="wire-cleanup-remove" />)}
            </g>}
            <g data-layer="wire-collisions" pointerEvents="none">
              {collisions.map(([a, b], i) => <polyline key={i} points={path([a, b])} className="wire-collision" />)}
            </g>
            {(!draft || draft.type === "SEGMENT_MOVE") &&
              <WireHandles circuit={preview} selection={editor.selection} zoom={editor.viewport.zoom} selectedCorner={editor.selectedCorner} />}
            {editor.selectionBox && (
              <rect
                data-layer="selection-box"
                x={Math.min(
                  editor.selectionBox.start.x,
                  editor.selectionBox.end.x,
                )}
                y={Math.min(
                  editor.selectionBox.start.y,
                  editor.selectionBox.end.y,
                )}
                width={Math.abs(
                  editor.selectionBox.end.x - editor.selectionBox.start.x,
                )}
                height={Math.abs(
                  editor.selectionBox.end.y - editor.selectionBox.start.y,
                )}
                className={
                  editor.selectionBox.end.x < editor.selectionBox.start.x
                    ? "selection-box crossing"
                    : "selection-box"
                }
                pointerEvents="none"
              />
            )}
            {snapPoint && (
              <g data-layer="connection-hint" pointerEvents="none">
              <circle
                cx={snapPoint.x}
                cy={snapPoint.y}
                r={9 / editor.viewport.zoom}
                className={snapHits.length > 1 ? "snap-marker ambiguous" : "snap-marker"}
              />
              {(wiring || hover.current?.type !== "pin") && <text className="snap-label"
                x={snapPoint.x + 14 / editor.viewport.zoom} y={snapPoint.y - 14 / editor.viewport.zoom}
                style={{ fontSize: 12 / editor.viewport.zoom }}>{snapLabel}</text>}
              </g>
            )}
            {draft?.type === "WIRE_DRAFT" && draft.from.type === "wire" &&
              <circle data-layer="pending-junction" cx={draft.from.position.x} cy={draft.from.position.y}
                r={5 / editor.viewport.zoom} className="pending-junction" pointerEvents="none" />}
            {(draft?.type==='WIRE_DRAFT'||draft?.type==='WIRE_ROUTE')&&<g data-layer="draft-waypoints" pointerEvents="none">
              {draft.waypoints.slice(1).map((p,i)=><g key={i} data-draft-waypoint={i+1}>
                <rect x={p.x-5/editor.viewport.zoom} y={p.y-5/editor.viewport.zoom} width={10/editor.viewport.zoom} height={10/editor.viewport.zoom} className="draft-waypoint"/>
                <text x={p.x+9/editor.viewport.zoom} y={p.y-9/editor.viewport.zoom} fontSize={11/editor.viewport.zoom}>{i+1}</text>
              </g>)}
            </g>}
            <g data-layer="preview" className="preview">
              {draft?.type === "PLACE" &&
                (!paletteDrag.current?.active ||
                  paletteDrag.current.inside) && (
                  <Symbols circuit={ghost} selection={[]} />
                )}
              {draft?.type === "WIRE_DRAFT" && (
                <polyline points={path(wirePlan!.points)} className={blocked ? "wire route-blocked" : "wire"} />
              )}
            </g>
          </g>
        </svg>
      </main>
      <aside className="properties" ref={properties}>
        {simulation && <SimulationPanel circuit={editor.circuit} result={simulation} inputs={inputValues}
          busy={!!draft || !!editor.selectionBox || !!gesture.current || !!paletteDrag.current}
          onInput={changeInput} onReset={() => setInputValues({})}
          onLocate={diagnostic => {
            const keys = diagnostic.objects.filter(id => editor.circuit.components[id] || editor.circuit.geometry.wires[id]);
            if (!keys.length) return;
            editor.selectedCorner = null;
            editor.selection = keys;
            dispatch('view.fitSelection');
            svg.current?.focus({ preventScroll: true });
          }} />}
        {cleanup && <section className="cleanup-panel" aria-label="중복 우회 정리 미리보기" onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); dispatch("app.cancel"); svg.current?.focus({ preventScroll: true }); }
        }}>
          <h2>중복 우회 정리</h2>
          <p>선택 배선의 연결망에서<br />빨간 점선 {cleanup.remove.length}개: 제거<br />초록 경로 {cleanup.keep.length}개: 유지</p>
          <p>접속점과 다른 분기는 유지됩니다.</p>
          {cleanupAnchored > 0 && <p>제거할 배선 {cleanupAnchored}개의 수동 경유점도 함께 정리합니다.</p>}
          <button onClick={() => { dispatch("app.confirm"); svg.current?.focus({ preventScroll: true }); }}>정리 적용</button>
          <button onClick={() => { dispatch("app.cancel"); svg.current?.focus({ preventScroll: true }); }}>정리 취소</button>
          <p>Enter: 정리 · Esc: 취소<br />확정 후 Ctrl+Z: 전체 복구</p>
        </section>}
        <section className="routing-status" aria-label="현재 배선 설정">
          <strong>{routingLabel(editor.routing)}</strong>
          <p>설정에서 변경 · Shift+Space: 꺾임 전환</p>
          {(draft?.type === "MOVE" || selectedComponents > 0) && <p>드래그 중 R: ↶ 90°<br />Shift+R: ↷ 90°</p>}
          {blocked ? <p role="alert" className="routing-warning">우회할 수 없습니다. 고정 경유점이나 부품 위치를 조정하세요. Esc: 취소</p>
            : collisions.length > 0 && <p className="routing-warning">부품과 겹치는 배선이 있습니다. 점선으로 표시했습니다.</p>}
        </section>
        <h2>선택</h2>
        <p>{selectedComponents}개 부품 · {selectedWires}개 배선</p>
        {editor.selectedCorner&&<p className="corner-selection">꺾임점 선택됨 · Delete로 이 점만 제거</p>}
        <button disabled={!!draft||(!selectedComponents&&!selectedWires)} onClick={()=>{dispatch('edit.delete');svg.current?.focus({ preventScroll: true });}}>{editor.selectedCorner?'선택 꺾임점 제거':'선택 삭제'} {hint('edit.delete')}</button>
        <p className="net-summary">연결망 {Object.keys(editor.circuit.nets).length}개 · 접속점 {Object.keys(editor.circuit.junctions).length}개</p>
        <details className="wiring-help">
          <summary>배선 조작법</summary>
          <p>핀 클릭: 시작/연결<br />선 위 W: 중간에서 분기<br />배선 도구에서 선 클릭: 시작<br />다른 선 클릭: 합치기<br />빈 곳 클릭: 경유점<br />Shift+Space: 꺾임 전환<br />Backspace: 경유점 취소<br />Esc: 초안 취소</p>
          <p>● 점이 있으면 접속<br />점 없는 교차는 미접속<br />채운 핀은 연결된 핀</p>
        </details>
        {selectedWires > 0 && <section className="wire-tools" aria-label="배선 경로 편집">
          <h2>배선 경로 편집</h2>
          <button disabled={!!draft || selectedWires !== 1} onClick={() => dispatch("wire.branch")}>이 선에서 분기</button>
          <button disabled={!!draft} onClick={() => dispatch("wire.selectNet")}>연결망 전체 선택</button>
          <button disabled={!!draft} title="선택 배선이 속한 연결망의 같은 두 끝점 사이 중복 경로만 정리합니다" onClick={() => dispatch("wire.cleanupDuplicates")}>연결망 중복 정리{cleanupAvailable > 0 ? ` (${cleanupAvailable})` : ""}</button>
          <p>원 ○ 선분 이동<br />사각 □ 모서리 이동<br />마름모 ◇ 우회 구간 추가</p>
          <button disabled={!!draft || selectedWires !== 1 || !!selectedComponents} onClick={() => dispatch("wire.reroute")}>경로 다시 그리기</button>
          <button disabled={!!draft} onClick={() => dispatch("wire.tidyHorizontal")}>가로 우선 정리</button>
          <button disabled={!!draft} onClick={() => dispatch("wire.tidyVertical")}>세로 우선 정리</button>
          <button disabled={!!draft} title="기존 경유점을 재설정하고 현재 배선 설정으로 정리합니다" onClick={() => dispatch("wire.tidyConfigured")}>설정대로 정리</button>
          {draft?.type === "WIRE_ROUTE" && <button onClick={() => { dispatch("app.confirm"); svg.current?.focus({ preventScroll: true }); }}>경로 수정 완료</button>}
          <p className="note">양 끝 연결은 고정됩니다.<br />드래그 후 놓기: 확정<br />Esc: 취소 · Ctrl+Z: 복구</p>
        </section>}
        <button disabled={!selectedComponents} onClick={() => dispatch("component.moveSafe")}>
          연결 유지 이동
        </button>
        <button disabled={!selectedComponents} onClick={() => dispatch("component.rotateCCW90")}>
          반시계 회전
        </button>
        <button
          disabled={!selectedComponents}
          onClick={() => {
            dispatch("component.rotateCW90");
          }}
        >
          시계 회전 {hint("component.rotateCW90")}
        </button>
        <button
          onClick={() => {
            dispatch("app.cancel");
          }}
        >
          취소 {hint("app.cancel")}
        </button>
        <button
          onClick={() => {
            dispatch("wire.toggleBend");
          }}
        >
          꺾임 전환 {hint("wire.toggleBend")}
        </button>
        <button
          onClick={() => {
            dispatch("wire.removeLastPoint");
          }}
        >
          경유점 제거 {hint("wire.removeLastPoint")}
        </button>
        <p>
          초안: {editor.operation}
          <br />
          도구: {editor.tool}
        </p>
      </aside>
      <footer role="status">
        {message} ·{" "}
        {editor.draft
          ? "초안 미확정 · Ctrl+Z는 초안만 취소"
          : "Ctrl+Z Undo · Ctrl+Shift+Z Redo"}{" "}
        · {resolver.profile.name} ·{" "}
        {resolver.pending.length
          ? `순차 키 대기: ${resolver.pending.join(" → ")}`
          : "입력 대기"}
      </footer>
      {selectionChoice && <div className="overlay" onKeyDown={e => {
        if (!e.nativeEvent.isComposing && e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation(); dispatch('app.cancel');
        }
      }}>
        <section role="dialog" aria-label="배선 선택" className="connection-chooser">
          <h2>선택할 배선을 고르세요</h2>
          <p>같은 거리에 있는 배선입니다. 선택만 하며 연결은 변경하지 않습니다.</p>
          {selectionChoice.keys.map((key,i) => <button key={key} autoFocus={i===0} onClick={() => {
            dispatch(selectionChoice.command, {key}); setSelectionChoice(null);
            svg.current?.focus({preventScroll:true});
          }}>{i+1}. {targetLabel({type:'wire',id:key,position:editor.circuit.geometry.wires[key].points[0]})}</button>)}
          <button onClick={() => dispatch('app.cancel')}>취소</button>
        </section>
      </div>}
      {connectionChoice && <div className="overlay" onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dispatch("app.cancel"); }
      }}>
        <section role="dialog" aria-label="접속 대상 선택" className="connection-chooser">
          <h2>접속할 대상을 선택하세요</h2>
          <p>겹쳐 보이는 선은 선택하기 전까지 서로 연결되지 않습니다.</p>
          {connectionChoice.targets.map((candidate, index) => <button key={`${candidate.type}:${candidate.id}`} autoFocus={index === 0}
            onClick={() => {
              setConnectionChoice(null);
              dispatch(connectionChoice.action === "start" ? "wire.start" : "app.confirm", { endpoint: candidate });
              svg.current?.focus({ preventScroll: true });
            }}>{index + 1}. {targetLabel(candidate)}</button>)}
          {!draft && connectionChoice.targets.every((t) => t.type === "wire" && same(targetPosition(editor.circuit, t), targetPosition(editor.circuit, connectionChoice.targets[0]))) &&
            <button onClick={() => { dispatch("wire.joinCrossing", { targets: connectionChoice.targets }); setConnectionChoice(null); svg.current?.focus({ preventScroll: true }); }}>이 교차점을 접속</button>}
          <button onClick={() => { setConnectionChoice(null); svg.current?.focus({ preventScroll: true }); }}>취소</button>
        </section>
      </div>}
      {search !== null && (
        <div className="overlay">
          <section role="dialog" aria-label="부품 검색">
            <h2>부품 검색</h2>
            <input
              autoFocus
              aria-label="부품 검색어"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Escape") {
                  setSearch(null);
                  svg.current?.focus({ preventScroll: true });
                }
                if (e.key === "Enter" && results.length === 1)
                  place(results[0]);
              }}
            />
            {results.map((k) => (
              <button key={k} onClick={() => place(k)}>
                {k} · 기본 라이브러리
              </button>
            ))}
            {!results.length && <p>검색 결과 없음</p>}
            <button
              onClick={() => {
                setSearch(null);
                svg.current?.focus({ preventScroll: true });
              }}
            >
              닫기
            </button>
          </section>
        </div>
      )}
      {menu && (
        <div
          className="overlay"
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.code === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              dispatch("app.cancel");
            }
          }}
        >
          <section role="dialog" aria-label="도면 메뉴">
            <button disabled={!!draft||!editor.selection.length} onClick={()=>{dispatch('edit.delete');setMenu(false);svg.current?.focus({ preventScroll: true });}}>{editor.selectedCorner?'선택 꺾임점 제거':'선택 삭제'}</button>
            <button
              autoFocus
              onClick={() => {
                dispatch("app.cancel", { operation: true });
                setMenu(false);
                svg.current?.focus({ preventScroll: true });
                refresh();
              }}
            >
              초안 취소 / 선택 해제
            </button>
            <button
              onClick={() => {
                dispatch("history.undo");
                setMenu(false);
                svg.current?.focus({ preventScroll: true });
              }}
            >
              Undo
            </button>
            <button
              onClick={() => {
                setMenu(false);
                svg.current?.focus({ preventScroll: true });
              }}
            >
              닫기
            </button>
          </section>
        </div>
      )}
      {settings && (
        <InputSettings
          user={user}
          routing={editor.routing}
          onRoutingChange={applyRouting}
          onChange={applyProfile}
          onClose={() => {
            setSettings(false);
            resolver.cancel();
            svg.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </div>
  );
}
