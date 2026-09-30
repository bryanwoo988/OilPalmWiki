/**
 * Regenerate the service worker's precache list and cache version.
 *
 *   node tools/build-sw.mjs
 *
 * The version is a hash of every precached file's contents, so shipping new
 * content automatically invalidates the old cache and no one has to remember
 * to bump a number.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, posix, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Everything the app can request. Splash images are included: an installed app
// launching offline should show its own splash, not a blank frame.
const INCLUDE_DIRS = ['css', 'js', 'data', 'figures', 'icons'];
const INCLUDE_FILES = ['index.html', 'manifest.webmanifest', 'favicon.ico'];
const SKIP = /(^\.|\.DS_Store$|~$)/;

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (SKIP.test(name)) continue;
    const rel = posix.join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const files = [
  ...INCLUDE_FILES.filter(f => {
    try { statSync(join(ROOT, f)); return true; } catch { return false; }
  }),
  ...INCLUDE_DIRS.flatMap(d => {
    try { return walk(d); } catch { return []; }
  }),
].sort();

const hash = createHash('sha256');
for (const f of files) {
  hash.update(f);
  hash.update(readFileSync(join(ROOT, f)));
}
const version = hash.digest('hex').slice(0, 10);

const assets = ["'./'", ...files.map(f => `'${f.split(sep).join('/')}'`)];
const block = [
  '/* --- generated:begin --- */',
  `const CACHE = 'opwiki-${version}';`,
  'const ASSETS = [',
  ...assets.map(a => `  ${a},`),
  '];',
  '/* --- generated:end --- */',
].join('\n');

const swPath = join(ROOT, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const updated = sw.replace(
  /\/\* --- generated:begin --- \*\/[\s\S]*?\/\* --- generated:end --- \*\//,
  block,
);
if (updated === sw && !sw.includes(block)) {
  console.error('could not find the generated block in sw.js');
  process.exit(1);
}
writeFileSync(swPath, updated);

const bytes = files.reduce((a, f) => a + statSync(join(ROOT, f)).size, 0);
console.log(`precache: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`cache:    opwiki-${version}`);
