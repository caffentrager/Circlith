import { expect, it } from "vitest";
import { Editor } from "../../src/editor/editor";
import { boxComponents } from "../../src/geometry/geometry";
import { addComponent, clone, emptyCircuit } from "../../src/model/circuit";

it("box containment and crossing account for rotated component bounds", () => {
  const c = emptyCircuit();
  const a = addComponent(c, "AND", { x: 100, y: 100 });
  const b = addComponent(c, "AND", { x: 250, y: 100 }, 90);
  expect(boxComponents(c, { x: 50, y: 50 }, { x: 150, y: 150 })).toEqual([a]);
  expect(boxComponents(c, { x: 50, y: 50 }, { x: 120, y: 150 })).toEqual([]);
  expect(boxComponents(c, { x: 120, y: 150 }, { x: 50, y: 50 })).toEqual([a]);
  expect(boxComponents(c, { x: 220, y: 70 }, { x: 280, y: 130 })).toEqual([]);
  expect(boxComponents(c, { x: 280, y: 130 }, { x: 220, y: 70 })).toEqual([b]);
});

it("selection box is editor-only, additive, cancellable, and does not change history or redo", () => {
  const e = new Editor();
  e.place("Input", { x: 100, y: 100 });
  e.confirm();
  const a = e.selection[0];
  e.place("Output", { x: 300, y: 100 });
  e.confirm();
  const b = e.selection[0],
    before = clone(e.circuit);
  e.selection = [a];
  e.beginBox({ x: 240, y: 50 }, true);
  e.updateBox({ x: 360, y: 150 });
  expect(e.operation).toBe("BOX_SELECT");
  e.finishBox(true);
  expect(e.selection).toEqual([a, b]);
  expect(e.circuit).toEqual(before);
  expect(e.history).toHaveLength(2);
  e.beginBox({ x: 0, y: 0 });
  e.updateBox({ x: 1, y: 1 });
  e.escape();
  expect(e.selection).toEqual([a, b]);
  e.undo();
  expect(e.future).toHaveLength(1);
  e.beginBox({ x: 0, y: 0 });
  e.updateBox({ x: 200, y: 200 });
  e.redo();
  expect(e.future).toHaveLength(1);
  e.cancel();
  e.redo();
  expect(e.circuit).toEqual(before);
});
