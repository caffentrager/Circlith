import { describe, it, expect, vi } from "vitest";
import {
  InputResolver,
  activeContexts,
  keyToken,
} from "../../src/input/resolver";
import {
  builtins,
  preset,
  effective,
  freshUser,
  validateProfile,
  validateUser,
  importUser,
} from "../../src/input/profiles";
import { bindingId, conflicts, type Binding } from "../../src/input/types";
import { registry } from "../../src/input/registry";
import { CommandDispatcher } from "../../src/editor/dispatcher";
import { emptyCircuit, addComponent } from "../../src/model/circuit";
import { fitView } from "../../src/geometry/view";

describe("external presets and semantics", () => {
  it("validates eight immutable JSON presets and every inherited profile", () => {
    expect(builtins).toHaveLength(8);
    for (const p of builtins) {
      validateProfile(p);
      validateProfile(preset(p.id));
      expect(Object.isFrozen(p.bindings)).toBe(true);
      expect(
        conflicts(preset(p.id).bindings).filter((c) => c.type === "collision"),
      ).toHaveLength(0);
    }
  });
  it("native M/G/W and mouse commands retain their semantics", () => {
    const r = new InputResolver(preset("circlith-modern"));
    for (const [input, cmd] of [
      ["M", "component.moveSafe"],
      ["G", "grid.toggleVisible"],
      ["W", "wire.start"],
      ["Home", "view.fitAll"],
      ["Shift+Home", "view.fitSelection"],
    ])
      expect(r.key(input, ["canvas"]).command).toBe(cmd);
    expect(r.mouse("mouseClick", "right", [], ["canvas"])?.command).toBe(
      "view.contextMenu",
    );
    expect(r.mouse("mouseDrag", "middle", [], ["canvas"])?.command).toBe(
      "view.pan",
    );
    expect(r.mouse("mouseDrag", "left", ["Space"], ["canvas"])?.command).toBe(
      "view.pan",
    );
    expect(r.mouse("mouseDrag", "right", [], ["canvas"])).toBeUndefined();
  });
  it("KiCad G moves safely, M remains unmapped and grid G is removed", () => {
    const r = new InputResolver(preset("kicad-9"));
    expect(r.key("G", ["canvas"]).command).toBe("component.moveSafe");
    expect(r.key("M", ["canvas"]).handled).toBe(false);
    expect(r.key("W", ["canvas"]).command).toBe("wire.start");
    expect(r.key("R", ["canvas"]).command).toBe("component.rotateCCW90");
    expect(r.profile.unmappedTargetActions?.[0].action).toContain("M");
  });
  it("Altium sequences resolve without executing inherited M or V early", () => {
    const r = new InputResolver(preset("altium-designer-2026"));
    for (const [a, b, cmd] of [
      ["P", "W", "wire.start"],
      ["M", "M", "component.moveSafe"],
      ["V", "F", "view.fitAll"],
    ]) {
      expect(r.key(a, ["canvas"])).toEqual({ handled: true });
      expect(r.pending).toEqual([a]);
      expect(r.key(b, ["canvas"]).command).toBe(cmd);
    }
    expect(r.mouse("mouseClick", "right", [], ["canvas"])?.command).toBe(
      "view.contextMenu",
    );
    expect(r.mouse("mouseDrag", "right", [], ["canvas"])?.command).toBe(
      "view.pan",
    );
    r.cancel();
  });
  it("unavailable commands do not call a different editor handler", () => {
    const move = vi.fn(),
      feedback = vi.fn();
    const d = new CommandDispatcher({ "component.moveSafe": move }, feedback);
    expect(d.dispatch("edit.delete")).toBe(false);
    expect(move).not.toHaveBeenCalled();
    expect(feedback).toHaveBeenCalled();
    expect(registry.get("clipboard.copy")?.available).toBe(false);
  });
  it("EasyEDA short RMB cancel remains distinct from drag pan", () => {
    const r = new InputResolver(preset("easyeda-pro"));
    expect(r.mouse("mouseClick", "right", [], ["canvas"])?.command).toBe(
      "app.cancel",
    );
    expect(r.mouse("mouseDrag", "right", [], ["canvas"])?.command).toBe(
      "view.pan",
    );
  });
});
describe("input ownership and sequences", () => {
  it("text focus and IME cannot fire single keys or global commands", () => {
    const r = new InputResolver(preset("altium-designer-2026"));
    r.key("P", ["canvas"]);
    expect(r.key("W", activeContexts("TEXT_EDITOR", "NONE")).handled).toBe(
      false,
    );
    expect(r.pending).toEqual([]);
    expect(r.key("M", activeContexts("IME_COMPOSING", "NONE")).handled).toBe(
      false,
    );
    expect(
      new InputResolver(preset("circlith-modern")).key("R", ["modal"]).handled,
    ).toBe(false);
  });
  it("Escape cancels only the incomplete sequence", () => {
    const r = new InputResolver(preset("altium-designer-2026"));
    r.key("M", ["canvas"]);
    expect(r.key("Escape", ["canvas"])).toEqual({ handled: true });
    expect(r.pending).toEqual([]);
    r.cancel();
  });
  it("incomplete sequences time out and prefix ambiguity delays single commands", () => {
    vi.useFakeTimers();
    const delayed = vi.fn(),
      p = preset("altium-designer-2026"),
      r = new InputResolver(p, () => {}, delayed);
    r.key("P", ["canvas"]);
    vi.advanceTimersByTime(901);
    expect(r.pending).toEqual([]);
    expect(delayed).not.toHaveBeenCalled();
    p.bindings.push({
      command: "tool.select",
      context: ["canvas"],
      input: { type: "key", key: "P" },
    });
    r.setProfile(p);
    r.key("P", ["canvas"]);
    vi.advanceTimersByTime(901);
    expect(delayed).toHaveBeenCalledWith("tool.select");
    r.cancel();
    vi.useRealTimers();
  });
  it("keys and modifier-wheel and double click have exact modifier matching", () => {
    expect(
      keyToken({
        code: "KeyX",
        key: "ㅌ",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      }),
    ).toBe("Ctrl+Shift+X");
    const r = new InputResolver(preset("altium-designer-2026"));
    expect(
      r.mouse("wheelChord", undefined, ["Ctrl"], ["canvas"])?.command,
    ).toBe("view.zoom");
    expect(r.mouse("wheel", undefined, [], ["canvas"])).toBeUndefined();
    expect(r.mouse("mouseDoubleClick", "left", [], ["canvas"])?.command).toBe(
      "edit.properties",
    );
  });
});
describe("custom profiles and conflicts", () => {
  it("override/export/import/reset preserve built-in data", () => {
    const before = JSON.stringify(builtins),
      u = freshUser(),
      b = preset(u.presetId).bindings.find(
        (b) => b.command === "component.moveSafe",
      )!;
    u.overrides[bindingId(b)] = { ...b, input: { type: "key", key: "J" } };
    validateUser(u);
    expect(effective(u).name).toContain("(Modified)");
    expect(importUser(JSON.stringify(u))).toEqual(u);
    expect(JSON.stringify(builtins)).toBe(before);
    delete u.overrides[bindingId(b)];
    expect(effective(u).name).toBe("Circlith Modern");
  });
  it("rejects old schemas, unknown commands, invalid imports and unsafe semantics", () => {
    expect(() =>
      importUser(JSON.stringify({ ...freshUser(), schemaVersion: "0.1" })),
    ).toThrow(/버전/);
    const p = preset("circlith-modern");
    p.bindings[0].command = "invented.command";
    expect(() => importUser(JSON.stringify(p))).toThrow(/명령/);
    p.bindings[0].command = "tool.select";
    p.behavior!.moveSemantics = "disconnect";
    expect(() => validateProfile(p)).toThrow(/Move/);
    expect(() => importUser("null")).toThrow();
  });
  it("distinguishes hard collisions, non-overlapping contexts, prefixes and click/drag sharing", () => {
    const b = (context: string[], input: Binding["input"]): Binding => ({
      command: "view.pan",
      context,
      input,
    });
    expect(
      conflicts([
        b(["canvas"], { type: "key", key: "A" }),
        b(["canvas"], { type: "key", key: "A" }),
      ])[0].type,
    ).toBe("collision");
    expect(
      conflicts([
        b(["placement"], { type: "key", key: "A" }),
        b(["wire-draft"], { type: "key", key: "A" }),
      ])[0].type,
    ).toBe("contexts");
    expect(
      conflicts([
        b(["canvas"], { type: "key", key: "P" }),
        b(["canvas"], { type: "keySequence", sequence: ["P", "W"] }),
      ])[0].type,
    ).toBe("prefix");
    expect(
      conflicts([
        b(["canvas"], { type: "mouseClick", button: "right" }),
        b(["canvas"], { type: "mouseDrag", button: "right" }),
      ])[0].type,
    ).toBe("gesture");
  });
  it("imports standalone schema profile and refuses unconditional override collisions", () => {
    const p = preset("circlith-modern");
    const u = importUser(JSON.stringify(p));
    expect(effective(u).bindings).toEqual(p.bindings);
    const bad = freshUser();
    bad.overrides.extra = {
      command: "view.fitAll",
      context: ["canvas"],
      input: { type: "key", key: "M" },
    };
    expect(() => validateUser(bad)).toThrow(/충돌/);
  });
});
it("fit all includes route extents and fit selection ignores external routes", () => {
  const c = emptyCircuit();
  const a = addComponent(c, "AND", { x: 1000, y: 500 });
  const v = fitView(c, 800, 600, [a])!;
  expect(v.x + 1000 * v.zoom).toBe(400);
  expect(v.y + 500 * v.zoom).toBe(300);
  expect(fitView(c, 800, 600, [])).toBeNull();
});
