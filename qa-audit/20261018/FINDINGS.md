# Circlith — Findings (independent audit of `main` cd8bf7e)

Revision: `cd8bf7e3ff50a72b81781a5c53b675dbcb8e1655` (== `origin/main` per `git ls-remote`). QA copy: `build/qa-audit-20261018/work*` (git archive, independent `npm ci`). No production file was modified; `git status` of the original repo is unchanged (only the pre-existing untracked `review/CLAUDE_…eb44fc5.md`).

Severity = impact if it happens. **Exposure** = can a user reach it from the current UI. They are reported separately.
Evidence paths are relative to `build/qa-audit-20261018/` (`evidence/`, `screens/`, `qa-tests/`).

## Summary table

| ID | Sev | Exposure | Status | Origin | Title |
|---|---|---|---|---|---|
| F1 | P0 (integrity) | **none today** (needs an ID starting `pin:`; UI makes UUIDs) | CONFIRMED, unfixed | Codex F1 | Net ID `pin:<floatingPin>` collides with synthetic signal ID → wrong confirmed value, no diagnostic |
| F2 | P2 | **direct, every preset** | CONFIRMED, unfixed | Codex F2 = Claude P2-1/P2-2 | Input toggle swallows LMB-drag, MMB, RMB, Shift/Alt, Space-pan and keyboard focus (simulation ON) |
| F3 | P2 | none from UI (API contract) | CONFIRMED, unfixed | Codex F3 = Claude P3-5 | `compile`/`validate` throw `TypeError` on malformed records instead of `INVALID_CIRCUIT` |
| N1 | P2 | direct | **NEW, CONFIRMED** | audit | Enlarging a gate commits wires that run through its new body (72/320 scenarios) |
| N2 | P3 | direct | **NEW, CONFIRMED** | audit | Outermost inverted input of XOR/XNOR ≥ 8 inputs: bubble swallows the pin, lead drawn backwards; all inverted pins overlap the pin dot by 3 px |
| N3 | P3 | direct | **NEW, CONFIRMED** | audit | Properties Apply rejected with raw validator text `배선 경유점 오류` when a fixed waypoint sits at a spur |
| N4 | P3 | direct | **NEW, CONFIRMED** (pre-existing pattern, extended to new modal) | audit | Backdrop click moves focus to `BODY`; Escape no longer closes Properties/Settings |
| N5 | P3 | CI/local | **NEW, CONFIRMED** | audit | `assemble-pages` “same commit” check is `git rev-parse HEAD` of the folder — a stale dist passes and is stamped with the new SHA |
| N6 | P3 | docs | **NEW, CONFIRMED** | audit | Documentation counts/statements are stale (SIMULATION.md 311/129 vs 340+1/141; “Space keeps panning” still claimed) |
| N7 | P2 (perf) | direct at ≥500 gates | **NEW, CONFIRMED** (numbers: see AUDIT_REPORT §J) | audit | Every input toggle / pan / zoom re-renders the whole SVG (O(N)); ~0.5 s per interaction at 1000 gates |
| P3-4 | P3 | direct only at ≥2000-sink fanout | CONFIRMED | Claude | `validateCircuit` is O(F²) on high fan-out |
| P3-6 | P3 | none from UI | CONFIRMED, policy | Claude | invalid input values silently become `0` |
| P3-8 | P3 | direct | CONFIRMED (partly mitigated by rename) | Claude | diagnostic `objects` duplicates; same-name gates indistinguishable |
| P3-11 | P3 | needs invalid circuit | CONFIRMED | Claude | INVALID_CIRCUIT renders every value as `X` |
| P3-12 | arch | – | CONFIRMED, spec ambiguity | Claude | simulation depends on geometry validity |

Open product decisions: P2-3 (stale selection + Delete), P3-7 (double diagnostics), P3-9 (X pessimism), invalid-input policy, F1 fix style.

---

## [P0 / exposure none] F1 — Signal ID namespace collision
Status: CONFIRMED · Origin: PREVIOUS CODEX REPORT · Revision cd8bf7e
Location: [simulator.ts:82-91](../../src/simulation/simulator.ts) (`signals.set(net.id, …)` then `signals.set(\`pin:${pin.id}\`, …)`)
Reproduction (qa-tests/unit/prior.test.ts, evidence/prior-findings-outcomes.json):
1. Input A→NOT→Output plus an unconnected Input B.
2. Rename the A→NOT net id to `pin:<B output pin id>`.
3. `validateCircuit()` returns `[]`; simulate A,B over 4×4 values.
Expected: Output = NOT(A) for every B. Actual: 42 mismatches (+ missing `result.pins` entries), no diagnostic.
Generalisation: only the `pin:` prefix collides (`junction:`, `net:`, `x-`, spaces, `../`, emoji, `pin:pin:` all correct; an ID equal to the pin ID is rejected as duplicate). Object-prototype names (`constructor`, `__proto__`, `toString`, …) as net/pin/component IDs all evaluate correctly (evidence/probe-proto-ids.json).
Exposure: IDs come from `crypto.randomUUID()` ([circuit.ts](../../src/model/circuit.ts)); there is no load/import path. Not reachable today. **Becomes reachable the moment save/load, paste or any import is added.**
Root cause: one `Map<string,Signal>` is shared by real nets and synthetic per-pin signals keyed by string prefix.
Fix: separate Map (or key by object / Symbol) for synthetic signals; do not rely on prefixing. Regression test = prior.test.ts F1 block (+ result.pins completeness).
Confidence: high (reproduced, 9 ID shapes).

## [P2 / direct] F2 — Input toggle monopolises pointer + keyboard (Codex F2 ≡ Claude P2-1, P2-2)
Status: CONFIRMED · Location: [CircuitSvg.tsx:102-112](../../src/renderer/CircuitSvg.tsx)
Reproduction: simulation ON, Input→NOT→Output; Playwright real mouse/keyboard (qa-tests/browser/f2.spec.ts, presets.spec.ts; evidence/browser-f2-matrix.json, browser-presets.json, browser-focus.json).

| Gesture on Input centre | Sim OFF | Sim ON |
|---|---|---|
| LMB click | select | toggle (intended) |
| LMB drag | select+move | **nothing (no move, no box)** |
| Shift+click | toggle-select | toggle |
| Alt+click | select | toggle |
| MMB drag | pan | **no pan** |
| RMB click | select + menu | **nothing** |
| Space+LMB drag | pan | **no pan** |
| double-click | Properties | Properties (value toggles twice → unchanged, history unchanged) |
Input edge (2 px inside body) and background behave identically ON/OFF. Preset matrix (8 presets): every preset loses its navigation gesture at the Input centre (Modern/KiCad: MMB + Space; Altium/EasyEDA: RMB-drag pan; Fusion/Shapr: MMB; Figma: Space).
Keyboard (browser-focus.json):
* toggle click → Space+drag on background: attempt 1 = box selection (selection cleared, `panned:false`), attempt 2 pans. Control (plain background click first) pans on attempt 1.
* toggle click → hover pin → `W` → draft starts, toggle unmounts, `activeElement=BODY`, **Esc does not cancel (`WIRE_DRAFT` remains)**. Via Properties-close the focus returns to `svg` and Esc works, so the defect is specific to the toggle.
Expected (Master Spec §7.5, §8.1, §21; SIMULATION.md “Space는 도면 이동 기능을 유지한다”): only the plain-LMB click is owned by the toggle.
Root cause: `onPointerDown` does `preventDefault+stopPropagation+focus()` for every button/modifier; Space keydown/keyup are consumed; toggle unmounts while a draft exists.
Fix: own only `button===0 && !modifiers` click (threshold-based), let everything else bubble to the resolver; blur/refocus `svg` after toggle; do not unmount toggle during drafts (disable instead). Tests = the two specs above (assert no lost effects).
Confidence: very high (3 independent audits).

## [P2 / API] F3 — Malformed records throw
Location: [connections.ts:84-118](../../src/model/connections.ts), [simulator.ts:64-75](../../src/simulation/simulator.ts)
Result (prior-findings-outcomes.json): of 24 corrupt fixtures 12 throw `TypeError` (component record deleted but pins/wires kept; `component=null`; `component.pins=undefined`; `geometry.components`/`geometry`/`components`/`pins`/`nets` missing; `net.pins=undefined`; `wire.from=undefined`; `wire.points=undefined`/containing `null`). The other 12 (missing pin/net/junction record, wrong direction/index/kind, wrong ownership, empty points, missing geometry entry, …) correctly yield `INVALID_CIRCUIT`.
Exposure: none from the UI (renderer would also crash on such data). Matters for import.
Fix: shape-check before dereferencing; stop at the first structural failure; wrap compile boundary in a controlled error → `INVALID_CIRCUIT`.

## [P2 / direct] N1 — Resize leaves wires inside the enlarged body (NEW)
Location: [component-properties.ts:38-52](../../src/model/component-properties.ts) (only the span next to a moved pin is rebuilt; no collision check or re-plan).
Reproduction (qa-tests/unit/collisions.test.ts, evidence/collision-outcomes.json): AND with a wire from a source on the far side of the gate; raise inputs (2→4, 4→8, 8→16, 2→16, 3→5) over 4 rotations × 8 source positions × 2 pins = 320 scenarios; **72 (22.5 %) end with a wire polyline strictly crossing the new body**, always the resized gate's own; in all 72 a collision-free route exists (`planRoute` not blocked). Example: wire at y=270 passed above a 2-input body (top 280) and now crosses a 4-input body (top 260); first segment now enters the pin from inside the body.
Expected: Spec §9.4 expands “우회 장애물”, routing mode is *avoid*; a committed wire should not cross a body (or Apply should warn/reject).
Impact: electrically correct but misleading drawing (wire appears to pass through a symbol); no warning, `validateCircuit` does not check it.
Fix: after resize, re-plan (`planRoute`) wires whose polyline hits the new obstacle (respecting anchors), or reject with message; add crossing assertion to tests.

## [P3 / direct] N2 — Inversion bubble geometry (NEW)
Location: [GateBody.tsx:19-26](../../src/renderer/GateBody.tsx)
Analytic + DOM (evidence/geometry-outcomes.json, browser-properties.json `xor16-bubble-geometry`; screens/closeup-XOR16-top.png, gallery-*.png): for XOR/XNOR with 8, 15, 16 inputs the two outermost inputs when inverted get `edge-8 < -40`: lead `M -40 y H -41.5` runs backwards, bubble centre is 2.5 px from the pin centre (r=4) → pin dot sits inside the bubble (DOM distance 2.51 px, rotation 0 and 90). n ≤ 7 and AND/OR/NAND/NOR are free of this. For every gate the 5 px pin dot overlaps a 4 px bubble by ~3 px (AND/NAND, all inputs). Pin positions, selection/obstacle bounds, `fitView`, box selection are consistent over 6 kinds × {2,3,4,8,16} × 4 rotations (912 pins, 0 violations).
Fix: derive the lead end from `max(edge-8, -38)` or shift the XOR second curve for dense gates; shrink/offset bubble when `edge-8 < -38`.

## [P3 / direct] N3 — Cryptic rejection with fixed waypoints (NEW)
`updateComponentProperties` runs `simplifyPath` unconditionally; a retraced spur anchor (e.g. waypoint at (340,300) above a pin) is collapsed, `assertCircuit` throws `배선 경유점 오류`, dialog shows that raw text (atomic: circuit unchanged). 5 of 40 waypoint scenarios (near-pin 8→3, 16→2; z-shape 16→2). Fix: use the anchor-aware simplify used in `planRoute`, or translate the message.

## [P3 / direct] N4 — Backdrop click strands keyboard focus (NEW, pre-existing pattern)
browser-properties.json `backdrop-focus`: click outside the dialog → `activeElement=BODY`, dialog stays; **Escape does nothing** (both Properties and Settings); Tab re-enters. Fix: trap focus on pointerdown of the overlay or listen for Escape at document level while a modal is open.

## [P3 / CI] N5 — Pages “same commit” guard is weak (NEW)
[assemble-pages.mjs:19-21](../../scripts/assemble-pages.mjs): `git -C dirname(dist) rev-parse HEAD` for both dists. Reproduced (evidence/pages-stale-dist-assemble.log): editor-dist built at commit A, simulation-dist at B in the same repo → assembled, manifest claims both = B. In CI (fresh checkout, same job) it is harmless; locally it can mislabel. Fix: embed `import.meta.env`/`define` commit hash at build and compare against `deployment.json`.

## [P3 / docs] N6 — Stale documentation (NEW)
* SIMULATION.md:42 “단위 311 / 브라우저 129” → measured 340 passed + 1 skipped / 141. README still says 179/123.
* SIMULATION.md:13 “Space는 도면 이동 기능을 유지한다”, “상단 이름 … 기존 편집 대상으로 유지”: both untrue while F2 stands (labels have `pointer-events:none`).
* X-pessimism (P3-9) still undocumented.

## [P2 / perf] N7 — Whole-canvas re-render per interaction (NEW)
Measured on a quiet machine with real production build (evidence/browser-profile-prod.json) and dev build (browser-profile-dev.json), snake fixture (gates + 1.3 wires/gate, 3 pins/gate), time from event to second animation frame:

| gates | toggle median / p95 | zoom step median / p95 |
|---|---|---|
| 100 | 32 / 33 ms (= 2 frames) | 32 / 33 ms |
| 500 | 136 / 212 ms | 132 / 175 ms |
| 1000 | 494 / 609 ms | 469 / 579 ms |
| 2000 (dev, noisy) | ≈2.1 s | ≈2.1 s |

Growth 500→1000 gates is 3.6× → super-linear. CPU profile (15 toggles @1000 gates, prod): two anonymous functions hold ≈90 % of self time (3.2 s + 2.8 s of ≈6.7 s); mapped through the dev build they are
1. [CircuitSvg.tsx pins layer](../../src/renderer/CircuitSvg.tsx) `Object.values(circuit.nets).some(n => n.pins.includes(pin.id))` for **every pin** → O(P·N·k) (≈214 ms/toggle @1000 gates);
2. [App.tsx:`collisions`](../../src/ui/App.tsx) `Object.values(preview.geometry.wires).flatMap(w => collidingSegments(preview, w.points))` evaluated on **every render**, and `collidingSegments` rebuilds `componentObstacles` for each wire → O(W·C) (≈176 ms/toggle).
Neither depends on simulation; they also run on pan, zoom and hover. Also: the Input toggle itself costs 0.3 ms; `compile` is only re-run when `editor.circuit` identity changes (verified, not a cause); `wireBridges` is memoised on `[circuit, wireDisplay, zoom]` (recomputed on every zoom step and on every MOVE-draft frame because `preview` is a new object; 48 ms @3000 sparse wires, 785 ms @3000 fully-crossing wires).
Fix: build a `Set` of connected pin ids once per render (`useMemo` on `circuit`), compute obstacle rects once and only when the routing warning is needed, memoise component/wire subtrees (`React.memo` keyed by object identity), then re-measure.

## Carried-over minor findings (still reproducible)
* **P3-4** fan-out: `validateCircuit` 0.46/5.4/19/71/270/1245 ms for 100/500/1000/2000/4000/8000 sinks (≈4× per doubling) — evidence/perf-core-outcomes.json.
* **P3-6** `Q, null, undefined, NaN, 2, {}, [], '', 'x', 0, 1, true` as an Input value → treated as 0, no diagnostic (12/12). Spec has no policy → product decision (reject vs X).
* **P3-8** `FLOATING_INPUT.objects` repeats the component id; two default-named ANDs give identical messages (“AND 입력 1 …”). Renaming now mitigates. 3+-member SCCs list every member (OK); severities: conflict=error, others=warning (OK).
* **P3-11** diagonal-wire fixture + simulation ON: Output badge `X`, pins `X`, panel says “회로 데이터 오류: 배선 경로 오류”; no wire values (screens/invalid-circuit-display.png).
* **P3-12** same fixture proves all values vanish for a geometry-only fault.

## Things checked and found correct (no finding)
* 4-state oracle: 6 gates × n=2,3,4 × every inversion mask × every value tuple (18 × exhaustive, 28 032 self-check tuples, 27 k simulator runs) = 0 mismatches; n=8/15/16: 3 270 structured+seeded cases = 0; XOR/XNOR parity ladder 0,1,2,7,8,15,16 ones incl. inverted input = 0; driver resolution 1–3 drivers = 0.
* 400 random graphs (cycles, fan-out, multi-driver, floating, inversion) × 4 vectors vs independent reference (values, pin values, diagnostic counts) = 0; 600 metamorphic variants (registration order, translate+rotate, ID rename) = 0.
* Properties: 9 kinds × 15 name cases, 6 gates × 36 count transitions (pin-ID retention, index, no orphan pins, other components untouched), 21-row connected-removal matrix, Editor atomicity (1 history entry; invalid/no-op = 0), Undo/Redo exact.
* Key isolation in the modal (15 keys), Tab trap, HTML names rendered as text (no XSS), 81-char via programmatic input rejected with message, history unchanged.
* Stateful fuzz: 8 seeds × 1000 ops (place/wire/branch/move/rotate/props/delete/undo/redo) – 6 000+ commits, ≈1 190 rejected operations all atomic, `validateCircuit=[]`, orthogonal finite wires, simulator = reference after every step, full undo→empty and redo→identical. (Operation mix counters in fuzz-outcomes.json.)
* Bridges: 11 unit + 300 random fields (5 401 bridges, 0 violations), purity/electrical-graph invariant, hit-testing (arc crown → owning wire, crossing centre → disambiguation dialog, no junction created, history unchanged), settings persistence/recovery, zoom 10–200 % radius ≥ 3.3 px.
* Viewports 1024×420 … 1920×1080: no horizontal overflow, modals fit and scroll internally; 1024×420 has page vertical scroll (pre-existing `min-height:500px`).
* Pages: both modes build, assemble and pass `check-pages` (shared bridges/Properties, isolated `circlith.` vs `circlith.simulation.` storage keys, no asset errors).
