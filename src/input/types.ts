export type Context =
  | "global"
  | "canvas"
  | "text-input"
  | "modal"
  | "placement"
  | "move"
  | "wire-draft";
export type Input = {
  type:
    | "key"
    | "keyChord"
    | "keySequence"
    | "mouseClick"
    | "mouseDoubleClick"
    | "mouseDrag"
    | "wheel"
    | "wheelChord";
  key?: string;
  keys?: string[];
  sequence?: string[];
  button?: string;
  modifiers?: string[];
  direction?: string;
  thresholdPx?: number;
};
export type Binding = {
  command: string;
  context?: string[];
  input: Input;
  provenance?: string;
  notes?: string;
};
export type Profile = {
  schemaVersion: string;
  id: string;
  name: string;
  kind: string;
  description?: string;
  basePreset?: string | null;
  compatibility: { target: string; level: string; notes?: string[] };
  behavior?: Record<string, unknown>;
  sources?: { title: string; url: string; checkedAt: string; scope?: string }[];
  bindings: Binding[];
  unmappedTargetActions?: { action: string; reason: string }[];
};
export type UserProfile = {
  schemaVersion: "1.0";
  presetId: string;
  overrides: Record<string, Binding | null>;
  behavior: Record<string, unknown>;
};
export const bindingId = (b: Binding) =>
  `${b.command}|${(b.context ?? ["canvas"]).slice().sort().join(",")}|${signature(b.input)}`;
export const normalize = (key: string) =>
  key.length === 1 ? key.toUpperCase() : key === "Esc" ? "Escape" : key;
export const chord = (keys: string[]) => {
  const mods = ["Ctrl", "Alt", "Shift", "Meta", "Space"];
  return keys
    .map(normalize)
    .sort((a, b) => {
      const ia = mods.indexOf(a),
        ib = mods.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })
    .join("+");
};
export const keySteps = (i: Input) =>
  i.type === "keySequence"
    ? i.sequence!.map((k) => chord(k.split("+")))
    : i.type === "keyChord"
      ? [chord(i.keys!)]
      : i.type === "key"
        ? [normalize(i.key!)]
        : [];
export const signature = (i: Input) =>
  keySteps(i).length
    ? keySteps(i).join(" → ")
    : `${i.type}:${i.button ?? ""}:${chord(i.modifiers ?? [])}:${i.direction ?? ""}`;
export const contextsOverlap = (a: Binding, b: Binding) =>
  (a.context ?? ["canvas"]).some((x) =>
    (b.context ?? ["canvas"]).some(
      (y) =>
        x === y ||
        x === "global" ||
        y === "global" ||
        (x === "canvas" && ["placement", "move", "wire-draft"].includes(y)) ||
        (y === "canvas" && ["placement", "move", "wire-draft"].includes(x)),
    ),
  );
export function conflicts(bindings: Binding[]) {
  const result: {
    type: "collision" | "prefix" | "contexts" | "gesture";
    a: number;
    b: number;
  }[] = [];
  for (let a = 0; a < bindings.length; a++)
    for (let b = a + 1; b < bindings.length; b++) {
      const x = bindings[a],
        y = bindings[b],
        same = signature(x.input) === signature(y.input),
        overlap = contextsOverlap(x, y);
      const xs = keySteps(x.input),
        ys = keySteps(y.input);
      const prefix =
        xs.length &&
        ys.length &&
        xs
          .slice(0, Math.min(xs.length, ys.length))
          .every((k, i) => k === ys[i]);
      const gesture =
        ["mouseClick", "mouseDrag"].includes(x.input.type) &&
        ["mouseClick", "mouseDrag"].includes(y.input.type) &&
        x.input.type !== y.input.type &&
        x.input.button === y.input.button &&
        chord(x.input.modifiers ?? []) === chord(y.input.modifiers ?? []);
      if (same) result.push({ type: overlap ? "collision" : "contexts", a, b });
      else if (prefix && overlap) result.push({ type: "prefix", a, b });
      else if (gesture && overlap) result.push({ type: "gesture", a, b });
    }
  return result;
}
