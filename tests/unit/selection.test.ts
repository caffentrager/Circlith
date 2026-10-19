import { expect, it } from "vitest";
import { Editor } from "../../src/editor/editor";
import { boxComponents, boxWires } from "../../src/geometry/geometry";
import { fitView } from "../../src/geometry/view";
import { addComponent, clone, connect, emptyCircuit } from "../../src/model/circuit";

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

it("wire boxes test every segment, distinguishing containment, crossing and empty bounds", () => {
  const c = emptyCircuit();
  const a = addComponent(c, "Input", { x: 100, y: 100 });
  const b = addComponent(c, "Output", { x: 400, y: 300 });
  connect(c, { type: "pin", id: c.components[a].pins[0] },
    { type: "pin", id: c.components[b].pins[0] },
    [{ x: 140, y: 100 }, { x: 360, y: 100 }, { x: 360, y: 300 }]);
  const wire = Object.keys(c.geometry.wires)[0];
  expect(boxWires(c, { x: 130, y: 80 }, { x: 380, y: 320 })).toEqual([wire]);
  expect(boxWires(c, { x: 200, y: 80 }, { x: 280, y: 120 })).toEqual([]);
  expect(boxWires(c, { x: 280, y: 120 }, { x: 200, y: 80 })).toEqual([wire]);
  expect(boxWires(c, { x: 280, y: 240 }, { x: 200, y: 160 })).toEqual([]);
  expect(boxWires(c, { x: 380, y: 240 }, { x: 340, y: 160 })).toEqual([wire]);
  expect(fitView(c, 800, 600, [wire])).toEqual({ zoom: 2.6, x: -250, y: -220 });
});

it("wire selection survives edits and Undo, excludes component transforms and prunes removed wires", () => {
  const e = new Editor();
  e.place("Input", { x: 100, y: 100 }); e.confirm();
  const a = e.selection[0];
  e.place("Output", { x: 400, y: 300 }); e.confirm();
  const b = e.selection[0];
  e.startWire({ type: "pin", id: e.circuit.components[a].pins[0] });
  e.confirm({ type: "pin", id: e.circuit.components[b].pins[0] });
  const wire = Object.keys(e.circuit.geometry.wires)[0];
  const before = clone(e.circuit);
  e.selection = [wire];
  e.move({ x: 0, y: 0 });
  expect(e.draft).toBeNull();
  e.beginBox({ x: 130, y: 80 }); e.updateBox({ x: 380, y: 320 }); e.finishBox(true);
  expect(e.selection).toEqual([wire]);
  expect(e.circuit).toEqual(before);
  expect(e.history).toHaveLength(3);
  e.selection = [a, wire]; e.rotate();
  expect(e.selection).toEqual([a, wire]);
  e.undo();
  expect(e.selection).toEqual([a, wire]);
  expect(e.circuit).toEqual(before);
  e.undo();
  expect(e.selection).toEqual([a]);
  e.redo();
  expect(e.circuit).toEqual(before);
  expect(e.selection).toEqual([a]);
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
