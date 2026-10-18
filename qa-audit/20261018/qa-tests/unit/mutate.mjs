// Mutation harness. Runs ONLY inside the isolated QA copy; restores every file from src.orig afterwards.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const root = process.cwd();
const EVID = 'D:/Circlith/build/qa-audit-20261018/evidence';
const mutants = [
  { id: 'M01-invert-Z-keeps-Z', file: 'src/simulation/logic.ts', from: "value === '1' ? '0' : 'X'", to: "value === '1' ? '0' : value === 'Z' ? 'Z' : 'X'" },
  { id: 'M02-xor-parity-reversed', file: 'src/simulation/logic.ts', from: "% 2 ? '1' : '0'", to: "% 2 ? '0' : '1'" },
  { id: 'M03-and-controlling-zero-ignored', file: 'src/simulation/logic.ts', from: "inputs.includes('0') ? '0' : inputs.every(v => v === '1') ? '1' : 'X'", to: "inputs.every(v => v === '1') ? '1' : inputs.every(v => v === '0') ? '0' : 'X'" },
  { id: 'M04-conflict-severity-warning', file: 'src/simulation/simulator.ts', from: "code: 'DRIVE_CONFLICT', severity: 'error'", to: "code: 'DRIVE_CONFLICT', severity: 'warning'" },
  { id: 'M05-scc-objects-truncated', file: 'src/simulation/simulator.ts', from: "severity: 'warning', objects: group,", to: "severity: 'warning', objects: group.slice(0, 2)," },
  { id: 'M06-input-count-off-by-one', file: 'src/model/component-properties.ts', from: 'while (inputs.length < count) {', to: 'while (inputs.length <= count) {' },
  { id: 'M07-pin-ids-regenerated-on-resize', file: 'src/model/component-properties.ts', from: 'const inputs = oldInputs.slice(0, count);', to: 'const inputs: string[] = [];' },
  { id: 'M08-history-recorded-twice', file: 'src/editor/editor.ts', from: '    this.history.push({\n      label,\n      before: clone(this.circuit),\n      after: clone(after),\n    });', to: '    this.history.push({ label, before: clone(this.circuit), after: clone(after) });\n    this.history.push({ label, before: clone(this.circuit), after: clone(after) });' },
  { id: 'M09-bridge-mutates-connectivity', file: 'src/geometry/wire-bridges.ts', from: "const point = { x: v.a.x, y: h.a.y };", to: "const point = { x: v.a.x, y: h.a.y }; (circuit.geometry.junctions as any)[`bridge${point.x}_${point.y}`] = { ...point };" },
  { id: 'M10-input-inversion-not-applied', file: 'src/simulation/simulator.ts', from: ".map(id => circuit.pins[id].inverted ? invert(read(id)) : read(id));", to: ".map(id => read(id));" },
  { id: 'M11-xnor-not-inverted', file: 'src/simulation/logic.ts', from: "kind === 'NAND' || kind === 'NOR' || kind === 'XNOR' ? invert(result) : result", to: "kind === 'NAND' || kind === 'NOR' ? invert(result) : result" },
  { id: 'M12-resolve-X-with-0-gives-0', file: 'src/simulation/logic.ts', from: "else if (result !== value) return 'X';", to: "else if (result !== value) return result === 'X' ? value : 'X';" },
  { id: 'M13-floating-input-diag-removed', file: 'src/simulation/simulator.ts', from: "if (resolved === 'Z') for (const pin of", to: "if (false as boolean) for (const pin of" },
  { id: 'M14-removed-pin-records-kept', file: 'src/model/component-properties.ts', from: 'for (const pin of removed) delete next.pins[pin];', to: '' },
  { id: 'M15-output-pin-index-not-updated', file: 'src/model/component-properties.ts', from: 'component.pins.forEach((pin, index) => { next.pins[pin].index = index; });', to: '' },
  { id: 'M16-connected-removal-allowed', file: 'src/model/component-properties.ts', from: "if (Object.values(circuit.nets).some(net => net.pins.some(pin => removed.has(pin))))", to: "if (false as boolean)" },
  { id: 'M17-validator-skips-pin-ownership', file: 'src/model/connections.ts', from: 'if (!c.components[pin.component]?.pins.includes(pin.id)) errors.push("핀 소유권 오류");', to: '' },
  { id: 'M18-feedback-gates-computed-anyway', file: 'src/simulation/simulator.ts', from: 'const cycles = feedbackGroups(edges), cyclic = new Set(cycles.flat());', to: 'const cycles = feedbackGroups(edges), cyclic = new Set<string>();' },
  { id: 'M19-undo-forgets-future', file: 'src/editor/editor.ts', from: '      this.future.push(cmd);\n      this.circuit = clone(cmd.before);', to: '      this.circuit = clone(cmd.before);' },
  { id: 'M20-wire-bridge-radius-unbounded', file: 'src/geometry/wire-bridges.ts', from: 'const radius = Math.min(maxRadius, candidate.room, spacing);', to: 'const radius = maxRadius;' },
];
const only = process.argv[2];
const groups = {
  existingUnit: ['run', '--config', 'vitest.config.ts'],
  qa: ['run', '--config', 'qa.vitest.config.ts', 'qa/oracle.test.ts', 'qa/properties.test.ts', 'qa/geometry.test.ts', 'qa/bridges.test.ts', 'qa/fuzz.test.ts', 'qa/prior.test.ts'],
};
function runGroup(name, extra) {
  const out = `${EVID}/mut-${name}-${extra}.json`;
  const r = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', ...groups[name], '--reporter=json', `--outputFile=${out}`], { cwd: root, env: { ...process.env, QA_FUZZ_SEEDS: '1', QA_SKIP_PERF: '1' }, encoding: 'utf8', timeout: 240000 });
  try {
    const j = JSON.parse(readFileSync(out, 'utf8'));
    const failed = [];
    for (const f of j.testResults) for (const t of f.assertionResults) if (t.status === 'failed') failed.push(`${f.name.split(/[\\/]/).pop()} > ${t.fullName}`);
    return { total: j.numTotalTests, failed };
  } catch { return { total: 0, failed: ['<runner error> ' + (r.stderr || '').slice(0, 300)] }; }
}
const baseline = { existingUnit: runGroup('existingUnit', 'baseline'), qa: runGroup('qa', 'baseline') };
const baselineQa = new Set(baseline.qa.failed);
console.log('baseline', baseline.existingUnit.total, baseline.existingUnit.failed.length, baseline.qa.total, baseline.qa.failed.length);
const results = [];
for (const m of mutants) {
  if (only && m.id !== only) continue;
  const path = join(root, m.file), orig = readFileSync(join(root, 'src.orig', m.file.replace(/^src\//, '')), 'utf8');
  const nl = orig.includes(String.fromCharCode(13, 10)) ? String.fromCharCode(13, 10) : String.fromCharCode(10);
  const from = m.from.split(String.fromCharCode(10)).join(nl), to = m.to.split(String.fromCharCode(10)).join(nl);
  if (!orig.includes(from)) { results.push({ id: m.id, status: 'PATTERN NOT FOUND' }); continue; }
  try {
    writeFileSync(path, orig.replace(from, () => to));
    const unit = runGroup('existingUnit', m.id), qa = runGroup('qa', m.id);
    const newQaFail = qa.failed.filter(x => !baselineQa.has(x));
    results.push({ id: m.id, existingSuiteDetects: unit.failed.length > 0, existingFailed: unit.failed.length, qaDetects: newQaFail.length > 0, qaNewFailures: newQaFail.length, sample: [...unit.failed.slice(0, 2), ...newQaFail.slice(0, 2)] });
  } finally { writeFileSync(path, orig); }
  console.log(results.at(-1).id, JSON.stringify({ unit: results.at(-1).existingSuiteDetects, qa: results.at(-1).qaDetects }));
}
writeFileSync(`${EVID}/mutation-results.json`, JSON.stringify({ baseline: { existingUnitFailed: baseline.existingUnit.failed.length, qaBaselineFailed: baseline.qa.failed.length }, results }, null, 2));
