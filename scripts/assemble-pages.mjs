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
const revision = directory => execFileSync('git', ['-C', dirname(directory), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceCommit = revision(editor);
if (sourceCommit !== revision(simulation)) throw new Error('Both modes must be built from the same source commit.');
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
