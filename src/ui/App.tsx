import { useEffect, useRef, useState } from "react";
import { Editor } from "../editor/editor";
import {
  emptyCircuit,
  addComponent,
  type Endpoint,
  type Kind,
  type Point,
} from "../model/circuit";
import { pinPosition, snap } from "../geometry/geometry";
import { Symbols, path } from "../renderer/CircuitSvg";
import "./style.css";
const kinds: Kind[] = ["AND", "Input", "Output"];
export function App() {
  const [editor] = useState(() => new Editor());
  const [, render] = useState(0);
  const refresh = () => render((v) => v + 1);
  const svg = useRef<SVGSVGElement>(null);
  const cursor = useRef<Point>({ x: 200, y: 200 });
  const space = useRef(false);
  const composing = useRef(false);
  const hover = useRef<Endpoint | undefined>(undefined);
  const gesture = useRef<{
    type: "pan" | "move";
    start: Point;
    view: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [grid, setGrid] = useState(true);
  const [message, setMessage] = useState(
    "부품을 선택하고 도면을 클릭해 배치하세요.",
  );
  const [singleKeys, setSingleKeys] = useState(true);
  const screen = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (e: { clientX: number; clientY: number }) => {
    const p = screen(e),
      v = editor.viewport;
    return snap({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom });
  };
  const target = (e: EventTarget | null): Endpoint | undefined => {
    const pin = (e as Element)?.closest("[data-pin]")?.getAttribute("data-pin");
    return pin ? { type: "pin", id: pin } : undefined;
  };
  const rollback = () => {
    if (gesture.current?.type === "move") editor.cancel();
    if (gesture.current?.type === "pan") {
      editor.viewport.x = gesture.current.view.x;
      editor.viewport.y = gesture.current.view.y;
    }
    gesture.current = null;
    editor.transient = "NONE";
    space.current = false;
    refresh();
  };
  useEffect(() => {
    const blur = () => rollback();
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, [editor]);
  const place = (kind: Kind) => {
    editor.place(kind, cursor.current);
    setSearch(null);
    setMenu(false);
    svg.current?.focus();
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
  const rotate = () => {
    editor.rotate();
    refresh();
  };
  const move = () => {
    editor.move(cursor.current);
    svg.current?.focus();
    refresh();
  };
  const preview = editor.preview();
  const draft = editor.draft;
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
  return (
    <div
      className="app"
      onFocusCapture={(e) => {
        const el = e.target as Element;
        editor.focus = el.closest("svg")
          ? "CANVAS"
          : el.matches('input,textarea,[contenteditable="true"]')
            ? "TEXT_EDITOR"
            : "MODAL";
      }}
    >
      <header>
        <strong>
          Circlith <small>편집 프로토타입</small>
        </strong>
        <input aria-label="프로젝트 이름" defaultValue="Untitled circuit" />
        <button
          onClick={() => {
            editor.setTool("SELECT");
            refresh();
          }}
        >
          선택 V
        </button>
        <button
          onClick={() => {
            editor.setTool("WIRE");
            svg.current?.focus();
            refresh();
          }}
        >
          배선 W
        </button>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <span>{editor.history.length} committed edits</span>
      </header>
      <aside className="library">
        <h2>부품</h2>
        <button
          onClick={() => {
            editor.cancel();
            setSearch("");
          }}
        >
          검색 A
        </button>
        {kinds.map((k) => (
          <button key={k} onClick={() => place(k)}>
            {k}
          </button>
        ))}
        <p>
          핀 → 핀 직각 배선
          <br />
          이동은 연결을 유지합니다.
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
          Safe Move 경로는 잠정 규칙입니다. 분기·삭제·저장·시뮬레이션은 후속
          단계입니다.
        </p>
      </aside>
      <main>
        <svg
          ref={svg}
          tabIndex={0}
          aria-label="회로 도면"
          data-operation={editor.operation}
          data-tool={editor.tool}
          onFocus={() => {
            editor.focus = "CANVAS";
          }}
          onBlur={rollback}
          onCompositionStart={() => {
            composing.current = true;
            editor.focus = "IME_COMPOSING";
          }}
          onCompositionEnd={() => {
            composing.current = false;
            editor.focus = "CANVAS";
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!editor.draft) {
              const key = (e.target as Element)
                .closest("[data-component]")
                ?.getAttribute("data-component");
              if (key && !editor.selection.includes(key))
                editor.selection = [key];
            }
            editor.focus = "MODAL";
            setMenu(true);
            refresh();
          }}
          onPointerDown={(e) => {
            if (e.button === 2) return;
            svg.current?.focus();
            cursor.current = world(e);
            if (e.button === 1 || space.current) {
              e.preventDefault();
              gesture.current = {
                type: "pan",
                start: screen(e),
                view: { x: editor.viewport.x, y: editor.viewport.y },
                moved: false,
              };
              editor.transient = "PAN";
              e.currentTarget.setPointerCapture(e.pointerId);
              refresh();
              return;
            }
            if (e.button !== 0) return;
            const pin = target(e.target) ?? hover.current;
            if (editor.draft) {
              editor.update(cursor.current);
              if (editor.draft.type === "WIRE_DRAFT" && !pin) editor.waypoint();
              else editor.confirm(pin, e.shiftKey);
              refresh();
              return;
            }
            if (editor.tool === "WIRE") {
              if (pin) editor.startWire(pin);
              refresh();
              return;
            }
            const key = (e.target as Element)
              .closest("[data-component]")
              ?.getAttribute("data-component");
            if (key) {
              if (e.shiftKey) {
                editor.selection = editor.selection.includes(key)
                  ? editor.selection.filter((k) => k !== key)
                  : [...editor.selection, key];
              } else {
                if (!editor.selection.includes(key)) editor.selection = [key];
                editor.move(cursor.current);
                gesture.current = {
                  type: "move",
                  start: screen(e),
                  view: { x: 0, y: 0 },
                  moved: false,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            } else if (!e.shiftKey) editor.selection = [];
            refresh();
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (g?.type === "pan") {
              const p = screen(e);
              editor.viewport.x = g.view.x + p.x - g.start.x;
              editor.viewport.y = g.view.y + p.y - g.start.y;
            } else {
              cursor.current = world(e);
              const p = screen(e),
                v = editor.viewport;
              const candidates = Object.keys(editor.circuit.pins).filter(
                (k) => {
                  const pos = pinPosition(editor.circuit, k);
                  return (
                    Math.hypot(
                      pos.x * v.zoom + v.x - p.x,
                      pos.y * v.zoom + v.y - p.y,
                    ) <= 9
                  );
                },
              );
              hover.current =
                candidates.length === 1
                  ? { type: "pin", id: candidates[0] }
                  : undefined;
              editor.update(
                editor.draft?.type === "WIRE_DRAFT" && hover.current
                  ? pinPosition(editor.circuit, hover.current.id)
                  : cursor.current,
              );
              if (g)
                g.moved ||= Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 4;
            }
            refresh();
          }}
          onPointerUp={(e) => {
            const g = gesture.current;
            gesture.current = null;
            if (g?.type === "move") {
              if (g.moved) editor.confirm();
              else editor.cancel();
            }
            editor.transient = "NONE";
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            refresh();
          }}
          onPointerCancel={rollback}
          onLostPointerCapture={() => {
            if (gesture.current) rollback();
          }}
          onWheel={(e) => {
            const p = screen(e),
              v = editor.viewport;
            const z = Math.max(
              0.5,
              Math.min(2, v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)),
            );
            v.x = p.x - ((p.x - v.x) * z) / v.zoom;
            v.y = p.y - ((p.y - v.y) * z) / v.zoom;
            v.zoom = z;
            refresh();
          }}
          onKeyUp={(e) => {
            if (e.code === "Space") space.current = false;
          }}
          onKeyDown={(e) => {
            if (
              e.isDefaultPrevented() ||
              e.nativeEvent.isComposing ||
              composing.current ||
              editor.focus !== "CANVAS"
            )
              return;
            if (e.code === "Tab") {
              if (gesture.current) rollback();
              return;
            }
            if (editor.transient === "PAN" && e.code !== "Escape") return;
            if (e.altKey || e.metaKey) return;
            let handled = true;
            if (e.ctrlKey) {
              if (e.code === "KeyZ") {
                if (!e.repeat) e.shiftKey ? redo() : undo();
              } else if (e.code === "KeyY" && !e.shiftKey) {
                if (!e.repeat) redo();
              } else if (e.code === "KeyA" && !e.shiftKey && !editor.draft)
                editor.selection = Object.keys(editor.circuit.components);
              else handled = false;
            } else if (e.code === "Escape") {
              if (gesture.current) rollback();
              else editor.escape();
            } else if (
              e.code === "Space" &&
              e.shiftKey &&
              editor.draft?.type === "WIRE_DRAFT"
            ) {
              if (!e.repeat) editor.draft.horizontal = !editor.draft.horizontal;
            } else if (e.code === "Space" && !e.shiftKey) space.current = true;
            else if (
              e.code === "Backspace" &&
              editor.draft?.type === "WIRE_DRAFT"
            ) {
              if (!e.repeat) editor.backspace();
            } else if (e.code === "Enter" && editor.draft) {
              if (!e.repeat) editor.confirm(hover.current);
            } else if (
              singleKeys &&
              !e.repeat &&
              (!e.shiftKey || e.code === "KeyR")
            ) {
              if (e.code === "KeyA") {
                editor.cancel();
                editor.focus = "TEXT_EDITOR";
                setSearch("");
              } else if (e.code === "KeyW") {
                if (editor.draft?.type !== "WIRE_DRAFT") {
                  editor.setTool("WIRE");
                  if (hover.current) editor.startWire(hover.current);
                }
              } else if (e.code === "KeyV") editor.setTool("SELECT");
              else if (e.code === "KeyM") editor.move(cursor.current);
              else if (e.code === "KeyR") editor.rotate(e.shiftKey);
              else if (e.code === "KeyG") setGrid((v) => !v);
              else handled = false;
            } else handled = false;
            if (handled) {
              e.preventDefault();
              e.stopPropagation();
              refresh();
            }
          }}
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
            <Symbols circuit={preview} selection={editor.selection} />
            {hover.current && (
              <circle
                cx={pinPosition(editor.circuit, hover.current.id).x}
                cy={pinPosition(editor.circuit, hover.current.id).y}
                r={9 / editor.viewport.zoom}
                fill="none"
                stroke="#008cab"
                pointerEvents="none"
              />
            )}
            <g data-layer="preview" className="preview">
              {draft?.type === "PLACE" && (
                <Symbols circuit={ghost} selection={[]} />
              )}
              {draft?.type === "WIRE_DRAFT" && (
                <polyline points={path(editor.wirePoints())} className="wire" />
              )}
            </g>
          </g>
        </svg>
      </main>
      <aside className="properties">
        <h2>선택</h2>
        <p>{editor.selection.length}개 부품</p>
        <button onClick={move}>연결 유지 이동 M</button>
        <button onClick={rotate}>반시계 회전 R</button>
        <button
          onClick={() => {
            editor.rotate(true);
            refresh();
          }}
        >
          시계 회전 Shift+R
        </button>
        <button
          onClick={() => {
            editor.escape();
            refresh();
          }}
        >
          취소 Esc
        </button>
        <button
          onClick={() => {
            if (editor.draft?.type === "WIRE_DRAFT")
              editor.draft.horizontal = !editor.draft.horizontal;
            refresh();
          }}
        >
          꺾임 전환 Shift+Space
        </button>
        <button
          onClick={() => {
            editor.backspace();
            refresh();
          }}
        >
          경유점 제거 Backspace
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
        · Space+drag 화면 이동
      </footer>
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
                  svg.current?.focus();
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
                svg.current?.focus();
              }}
            >
              닫기
            </button>
          </section>
        </div>
      )}
      {menu && (
        <div className="overlay">
          <section role="dialog" aria-label="도면 메뉴">
            <button
              onClick={() => {
                editor.escape();
                setMenu(false);
                svg.current?.focus();
                refresh();
              }}
            >
              초안 취소 / 선택 해제
            </button>
            <button
              onClick={() => {
                undo();
                setMenu(false);
                svg.current?.focus();
              }}
            >
              Undo
            </button>
            <button
              onClick={() => {
                setMenu(false);
                svg.current?.focus();
              }}
            >
              닫기
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
