import seed from "./data/command-registry.seed.json";
const implemented = new Set([
  "app.cancel",
  "app.confirm",
  "history.undo",
  "history.redo",
  "tool.select",
  "component.addSearch",
  "component.moveSafe",
  "component.rotateCCW90",
  "wire.start",
  "wire.removeLastPoint",
  "grid.toggleVisible",
  "view.pan",
  "view.zoom",
  "view.zoomIn",
  "view.zoomOut",
  "view.fitAll",
  "view.fitSelection",
  "view.contextMenu",
  "selection.box",
  "selection.toggleItem",
  "selection.addItem",
]);
export const commands = [
  ...seed.commands.map((c) => ({ ...c, available: implemented.has(c.id) })),
  ...[
    { id: "component.place", label: "Place component", category: "schematic" },
    {
      id: "component.rotateCW90",
      label: "Rotate 90° CW",
      category: "schematic",
    },
    { id: "wire.toggleBend", label: "Toggle wire bend", category: "schematic" },
    { id: "wire.editPath", label: "Edit wire path", category: "schematic" },
    { id: "wire.reroute", label: "Redraw wire path", category: "schematic" },
    { id: "wire.tidyHorizontal", label: "Route horizontal first", category: "schematic" },
    { id: "wire.tidyVertical", label: "Route vertical first", category: "schematic" },
    { id: "selection.all", label: "Select all", category: "selection" },
    {
      id: "selection.replaceItem",
      label: "Select item",
      category: "selection",
    },
  ].map((c) => ({ ...c, available: true })),
];
export const registry = new Map(commands.map((c) => [c.id, c]));
