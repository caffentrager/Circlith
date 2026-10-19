import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [applicationArgument, siteArgument] = process.argv.slice(2);
if (!applicationArgument || !siteArgument)
  throw new Error('Usage: node scripts/assemble-pages.mjs <simulation-dist> <empty-site>');
const application = resolve(applicationArgument), site = resolve(siteArgument);
// A fresh artifact replaces the complete old site; never copy old sub-apps forward.
if (existsSync(site)) throw new Error('The deployment destination must not already exist.');
if (existsSync(resolve(application, 'simulation')) || existsSync(resolve(application, 'editor')))
  throw new Error('Legacy application directories must not be included in the build.');
const html = readFileSync(resolve(application, 'index.html'), 'utf8');
if (!html.includes('src="/Circlith/assets/') || !html.includes('href="/Circlith/assets/'))
  throw new Error('The application asset base must be /Circlith/.');
const info = JSON.parse(readFileSync(resolve(application, 'build-info.json'), 'utf8'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (info.mode !== 'simulation') throw new Error('Circlith must include the simulation interface.');
if (info.commit !== head) throw new Error(`Build is from ${info.commit}, HEAD is ${head}; rebuild it.`);
const manifest = {
  version: 3,
  source: { commit: head },
  application: { commit: head, mode: 'simulation', path: '/Circlith/' },
  removedPaths: ['/Circlith/simulation/', '/Circlith/editor/'],
};
mkdirSync(site, { recursive: true });
cpSync(application, site, { recursive: true });
writeFileSync(resolve(site, 'deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
