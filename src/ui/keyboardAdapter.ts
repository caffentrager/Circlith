import type { KeyboardEvent } from "react";
import { InputResolver, keyToken } from "../input/resolver";
import type { Context } from "../input/types";

// DOM ownership/normalization only. Editor command semantics remain in the dispatcher.
export function keyboardAdapter(options: {
  resolver: InputResolver;
  contexts: () => Context[];
  composing: () => boolean;
  singleKeys: () => boolean;
  gestureActive: () => boolean;
  blocked: () => boolean;
  rollback: () => void;
  space: (held: boolean) => void;
  dispatch: (command: string) => void;
}) {
  return {
    keyDown(e: KeyboardEvent) {
      if (e.nativeEvent.isComposing || options.composing()) {
        options.resolver.cancel();
        return;
      }
      if (e.code === "Tab") {
        if (options.gestureActive()) options.rollback();
        options.resolver.cancel();
        return;
      }
      if (/^(Control|Shift|Alt|Meta)/.test(e.code)) return;
      if (e.code === "Space") options.space(true);
      if (options.blocked() && e.code !== "Escape") return;
      const token = keyToken(e);
      if (!options.singleKeys() && /^[A-Z]$/.test(token)) return;
      const result = options.resolver.key(token, options.contexts(), e.repeat);
      if (result.handled) {
        e.preventDefault();
        e.stopPropagation();
        if (result.command) options.dispatch(result.command);
      } else if (
        e.code === "Space" &&
        options.resolver.profile.bindings.some(
          (b) =>
            b.input.type === "mouseDrag" &&
            b.input.modifiers?.includes("Space"),
        )
      )
        e.preventDefault();
    },
    keyUp(e: KeyboardEvent) {
      if (e.code === "Space") options.space(false);
    },
  };
}
