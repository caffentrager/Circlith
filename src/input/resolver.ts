import {
  chord,
  keySteps,
  normalize,
  type Binding,
  type Context,
  type Input,
  type Profile,
} from "./types";
export const activeContexts = (focus: string, operation: string): Context[] =>
  focus === "TEXT_EDITOR"
    ? ["text-input"]
    : focus === "MODAL"
      ? ["modal"]
      : focus === "IME_COMPOSING"
        ? []
        : [
            "canvas",
            ...(operation === "PLACE"
              ? ["placement" as Context]
              : operation === "MOVE" || operation === "SEGMENT_MOVE"
                ? ["move" as Context]
                : operation === "WIRE_DRAFT" || operation === "WIRE_ROUTE"
                  ? ["wire-draft" as Context]
                  : []),
          ];
const applicable = (b: Binding, contexts: Context[]) =>
  contexts.length > 0 &&
  (b.context ?? ["canvas"]).some(
    (c) =>
      contexts.includes(c as Context) ||
      (c === "global" && contexts.includes("canvas")),
  );
export class InputResolver {
  pending: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private focus = "";
  constructor(
    public profile: Profile,
    private notify: () => void = () => {},
    private delayed: (command: string) => void = () => {},
  ) {}
  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = [];
    this.notify();
  }
  setProfile(profile: Profile) {
    this.cancel();
    this.profile = profile;
  }
  key(
    token: string,
    contexts: Context[],
    repeat = false,
  ): { command?: string; handled: boolean } {
    const state = contexts.join(",");
    if (state !== this.focus) {
      this.cancel();
      this.focus = state;
    }
    if (!contexts.includes("canvas") && !contexts.includes("modal")) {
      this.cancel();
      return { handled: false };
    }
    if (token === "Escape" && this.pending.length) {
      this.cancel();
      return { handled: true };
    }
    if (repeat) return { handled: false };
    const candidates = this.profile.bindings.filter(
      (b) => applicable(b, contexts) && keySteps(b.input).length,
    );
    let steps = [...this.pending, token];
    let matching = candidates.filter((b) =>
      steps.every((s, i) => keySteps(b.input)[i] === s),
    );
    if (!matching.length && this.pending.length) {
      this.cancel();
      steps = [token];
      matching = candidates.filter((b) => keySteps(b.input)[0] === token);
    }
    if (!matching.length) return { handled: false };
    const complete = matching.filter(
        (b) => keySteps(b.input).length === steps.length,
      ),
      longer = matching.some((b) => keySteps(b.input).length > steps.length);
    if (longer) {
      this.pending = steps;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(
        () => {
          this.cancel();
          if (complete.length === 1) this.delayed(complete[0].command);
        },
        Number(this.profile.behavior?.sequenceTimeoutMs ?? 900),
      );
      this.notify();
      return { handled: true };
    }
    this.cancel();
    return complete.length === 1
      ? { command: complete[0].command, handled: true }
      : { handled: true };
  }
  mouse(
    type: Input["type"],
    button: string | undefined,
    modifiers: string[],
    contexts: Context[],
    direction?: string,
  ): Binding | undefined {
    const candidates = this.profile.bindings.filter(
      (b) =>
        applicable(b, contexts) &&
        b.input.type === type &&
        b.input.button === button &&
        chord(b.input.modifiers ?? []) === chord(modifiers) &&
        (!b.input.direction || b.input.direction === direction),
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  }
}
export function keyToken(e: {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}): string {
  let key = e.code.startsWith("Key")
    ? e.code.slice(3)
    : e.code === "Space"
      ? "Space"
      : e.key === "+"
        ? "+"
        : e.code.startsWith("Digit")
          ? e.code.slice(5)
          : normalize(e.key);
  return chord([
    ...(e.ctrlKey ? ["Ctrl"] : []),
    ...(e.altKey ? ["Alt"] : []),
    ...(e.shiftKey && key !== "+" ? ["Shift"] : []),
    ...(e.metaKey ? ["Meta"] : []),
    key,
  ]);
}
export const mouseModifiers = (
  e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
  space = false,
) => [
  ...(e.ctrlKey ? ["Ctrl"] : []),
  ...(e.altKey ? ["Alt"] : []),
  ...(e.shiftKey ? ["Shift"] : []),
  ...(e.metaKey ? ["Meta"] : []),
  ...(space ? ["Space"] : []),
];
export const mouseButton = (button: number) =>
  ["left", "middle", "right"][button] ?? "unknown";
