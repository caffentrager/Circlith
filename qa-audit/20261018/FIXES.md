# FIXES — what this branch changes (on top of main cd8bf7e)

Branch `qa/independent-audit-20261018`. Audit materials are in this folder; the fixes are ordinary source changes. Nothing is merged; main is untouched.

## Verification after the fixes
| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| Unit | **367 passed, 1 skipped** (was 340 + 1): +27 in `tests/unit/audit-regressions.test.ts` |
| Browser (full suite) | **145 passed** (was 141): +4 in `tests/browser/audit-regressions.spec.ts` |
| Audit F2 matrix (54 gestures × ON/OFF) | lost effects **[]** (was 9 lost at the Input centre); 23/23 audit browser specs pass |
| Audit unit suites (oracle, geometry, properties, collisions, fuzz 8×1000 ops) | all pass; only `prior.test.ts` P3-6 ×12 and P3-8 message ×1 still fail (open product decisions, see below) |
| Pages | both modes build, assemble, `check-pages` pass; stale-dist assembly is now rejected |
| Perf (production-like dev build, snake fixture) | Input toggle @500/1000 gates **32 ms** (was 162/584); `validateCircuit` 8000-sink fan-out **92 ms** (was 1245) |
Raw numbers: `evidence-after/`.

## Changes by finding
| Finding | Change | Files |
|---|---|---|
| F1 | Real nets and floating pins no longer share one string-keyed Map; floating pins live in a separate list and `pinSignals` maps pin → Signal object | `simulation/simulator.ts` |
| F3 / P3-5 | `validateCircuit` is total (shape + reference integrity checked first, exceptions become one error); `compileCircuit` also guards the call → `INVALID_CIRCUIT` | `model/connections.ts`, `simulation/simulator.ts` |
| F2 / P2-1 / P2-2 / P2-3 | The toggle no longer stops pointer events. A plain left press selects the Input and starts the normal gesture; a click without movement toggles it on release. Drag, MMB, RMB, Space-pan, Shift/Alt keep their normal meaning. Only Enter is consumed on the toggle (Space reaches the pan logic); the toggle stays mounted (disabled) during drafts so focus is not lost; pressing it does not move focus off the canvas. Side effect: the clicked Input is now the selection, so Delete acts on what was just clicked | `renderer/CircuitSvg.tsx`, `ui/App.tsx` |
| N1 | After a resize, wires newly crossing the enlarged body are re-planned (`planRoute`, fixed waypoints respected, current routing settings via `Editor`); if no route exists the change is rejected with a message (atomic) | `model/component-properties.ts`, `editor/editor.ts` |
| N3 | Path simplification keeps a pinned waypoint that sits on a retraced spur | `model/component-properties.ts` |
| N2 | Bubble radius shrinks when the pin-to-curve gap is under 8 units so the lead never runs backwards and the pin is never inside the bubble | `renderer/GateBody.tsx` |
| N4 | Backdrop `mousedown` no longer moves focus to `BODY` (Properties, Settings) | `ui/ComponentProperties.tsx`, `ui/InputSettings.tsx` |
| N5 | Builds emit `build-info.json` (commit, mode); `assemble-pages` verifies mode, equality of both commits and equality with HEAD | `vite.config.ts`, `scripts/assemble-pages.mjs` |
| N7 | Pin "connected" set, junction degree and Input ordinal computed once per circuit; obstacle rectangles computed once per render instead of once per wire | `renderer/CircuitSvg.tsx`, `ui/App.tsx`, `geometry/routing.ts` |
| P3-4 | Validator adjacency built in place (no Set copy per wire) | `model/connections.ts` |
| P3-8 | `FLOATING_INPUT.objects` de-duplicated | `simulation/simulator.ts` |
| N6 | `docs/SIMULATION.md`, `docs/PAGES_DEPLOYMENT.md` updated (toggle behaviour, counts, X pessimism, build stamp) | docs |

## Deliberately not changed (need a decision)
* **P3-6** invalid Input values still become `0` (reject vs X?).
* **P3-8** same-name gates still give identical messages (renaming mitigates).
* **P3-11 / P3-12** INVALID_CIRCUIT still renders `X`; compile still depends on geometry validity.
* **P3-7, P3-9** double diagnostics and X pessimism: behaviour documented, unchanged.
* **N7 remainder**: zoom/pan steps still re-render the whole SVG (1000 gates: ~209 ms dev build, was ~597). Component/wire memoisation was not attempted.
* `README.md` still quotes the older test counts (179/123); left untouched.

## Notes for the reviewer
* The F2 change alters one behaviour on purpose: clicking an Input in simulation mode now selects it (matches simulation OFF). Revert that single line in `App.tsx` (`toggleStart` block) if the old "toggle without selecting" is preferred; the toggle would then need its own drag pass-through.
* Zero-length wires (both endpoints at the same coordinates) are still valid in the model; the audit fuzzer now skips them when picking a wire to branch.
