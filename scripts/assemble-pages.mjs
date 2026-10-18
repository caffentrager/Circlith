import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [editorArgument, simulationArgument, siteArgument] = process.argv.slice(2);
if (!editorArgument || !simulationArgument || !siteArgument)
  throw new Error('Usage: node scripts/assemble-pages.mjs <editor-dist> <simulation-dist> <empty-site>');
const editor = resolve(editorArgument), simulation = resolve(simulationArgument), site = resolve(siteArgument);
// Always assemble into a new directory; stale files must not survive a deployment.
if (existsSync(site)) throw new Error('The deployment destination must not already exist.');
for (const [directory, base] of [[editor, '/Circlith/'], [simulation, '/Circlith/simulation/']]) {
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
  if (!html.includes(`src="${base}assets/`) || !html.includes(`href="${base}assets/`))
    throw new Error(`Incorrect asset base in ${directory}: expected ${base}`);
}
const head = execFileSync('git', ['-C', dirname(editor), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// The stamp is written into each bundle at build time, so a stale directory cannot pass as the current commit.
const stamp = (directory, mode) => {
  const file = resolve(directory, 'build-info.json');
  if (!existsSync(file)) throw new Error(`Missing build-info.json in ${directory}; rebuild it.`);
  const info = JSON.parse(readFileSync(file, 'utf8'));
  if (info.mode !== mode) throw new Error(`${directory} was built for mode ${info.mode}, expected ${mode}.`);
  return info.commit;
};
const sourceCommit = stamp(editor, 'editor');
if (sourceCommit !== stamp(simulation, 'simulation')) throw new Error('Both modes must be built from the same source commit.');
if (sourceCommit !== head) throw new Error(`Builds are from ${sourceCommit} but the working tree is at ${head}; rebuild both modes.`);
const manifest = {
  version: 2,
  source: { commit: sourceCommit },
  editor: { commit: sourceCommit, mode: 'editor', path: '/Circlith/' },
  simulation: { commit: sourceCommit, mode: 'simulation', path: '/Circlith/simulation/' },
};
mkdirSync(site, { recursive: true });
cpSync(editor, site, { recursive: true });
cpSync(simulation, resolve(site, 'simulation'), { recursive: true });
writeFileSync(resolve(site, 'deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
