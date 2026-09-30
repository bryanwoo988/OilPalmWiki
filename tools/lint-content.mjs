/**
 * Check every content file before it ships.
 *
 *   node tools/lint-content.mjs
 *
 * A missing translation renders as an English fallback with a console warning
 * nobody reads, so it is caught here instead. Exits non-zero on any error.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['zh', 'en', 'ms'];

const errors = [];
const warnings = [];
const stats = { chapters: 0, sections: 0, blocks: 0, charts: 0, words: { zh: 0, en: 0, ms: 0 } };

const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/** A translatable value must carry all three languages, non-empty. */
function checkT(value, where) {
  if (value == null) return;
  if (typeof value === 'string' || typeof value === 'number') return; // untranslated on purpose
  if (typeof value !== 'object') {
    err(where, `expected a {zh,en,ms} object, got ${typeof value}`);
    return;
  }
  for (const l of LANGS) {
    if (!value[l] || !String(value[l]).trim()) err(where, `missing or empty "${l}"`);
  }
  for (const k of Object.keys(value)) {
    if (!LANGS.includes(k)) err(where, `unexpected language key "${k}"`);
  }
  // Rough word counts, so the lint can report how much content there is.
  for (const l of LANGS) {
    const s = String(value[l] ?? '');
    stats.words[l] += l === 'zh'
      ? (s.match(/[一-鿿]/g) || []).length
      : s.split(/\s+/).filter(Boolean).length;
  }
}

function checkChart(chart, where) {
  stats.charts++;
  const kinds = ['bar', 'hbar', 'stackedBar', 'line', 'donut'];
  if (!kinds.includes(chart.kind)) err(where, `unknown chart kind "${chart.kind}"`);
  checkT(chart.title, `${where}.title`);
  if (chart.note) checkT(chart.note, `${where}.note`);
  if (!chart.source) warn(where, 'chart has no source line');
  // A source is either a plain citation string or a full translation triple;
  // a partial object renders as "[object Object]".
  else if (typeof chart.source === 'object') checkT(chart.source, `${where}.source`);
  else if (typeof chart.source !== 'string') err(where, 'source must be a string or a {zh,en,ms} object');

  const cats = chart.x?.categories ?? [];
  if (!cats.length) err(where, 'chart has no x categories');
  cats.forEach((c, i) => checkT(c, `${where}.x.categories[${i}]`));

  if (!chart.series?.length) {
    err(where, 'chart has no series');
    return;
  }
  chart.series.forEach((s, i) => {
    checkT(s.name, `${where}.series[${i}].name`);
    if (!Array.isArray(s.values)) {
      err(where, `series[${i}] has no values array`);
      return;
    }
    // A short series silently drops categories off the end of the chart.
    if (s.values.length !== cats.length) {
      err(where, `series[${i}] has ${s.values.length} values for ${cats.length} categories`);
    }
    if (s.values.some(v => v != null && !Number.isFinite(v))) {
      err(where, `series[${i}] contains a non-numeric value`);
    }
  });
}

const BLOCK_CHECKS = {
  p: (b, w) => checkT(b.text, `${w}.text`),
  note(b, w) {
    checkT(b.text, `${w}.text`);
    if (b.kind && !['tip', 'warn', 'key'].includes(b.kind)) err(w, `unknown note kind "${b.kind}"`);
  },
  list(b, w) {
    if (!b.items?.length) err(w, 'list has no items');
    b.items?.forEach((it, i) => checkT(it, `${w}.items[${i}]`));
  },
  keyval(b, w) {
    if (!b.rows?.length) err(w, 'keyval has no rows');
    b.rows?.forEach((r, i) => {
      checkT(r.k, `${w}.rows[${i}].k`);
      checkT(r.v, `${w}.rows[${i}].v`);
    });
  },
  table(b, w) {
    if (b.caption) checkT(b.caption, `${w}.caption`);
    if (!b.headers?.length) err(w, 'table has no headers');
    b.headers?.forEach((h, i) => checkT(h, `${w}.headers[${i}]`));
    if (!b.rows?.length) err(w, 'table has no rows');
    b.rows?.forEach((row, i) => {
      if (row.length !== b.headers.length) {
        err(w, `row ${i} has ${row.length} cells for ${b.headers.length} headers`);
      }
      row.forEach((cell, j) => checkT(cell, `${w}.rows[${i}][${j}]`));
    });
  },
  chart: (b, w) => (b.chart ? checkChart(b.chart, `${w}.chart`) : err(w, 'chart block has no chart')),
  figure(b, w) {
    if (!b.src) err(w, 'figure has no src');
    else if (!existsSync(join(ROOT, b.src))) err(w, `figure src not found: ${b.src}`);
    if (b.caption) checkT(b.caption, `${w}.caption`);
    if (!b.alt && !b.caption) warn(w, 'figure has neither alt nor caption');
  },
};

function read(file) {
  try {
    return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  } catch (e) {
    err(file, `will not parse — ${e.message}`);
    return null;
  }
}

const index = read('data/index.json');
if (index) {
  const seen = new Set();
  index.chapters.forEach((c, i) => {
    const w = `index.chapters[${i}]`;
    checkT(c.title, `${w}.title`);
    checkT(c.blurb, `${w}.blurb`);
    if (seen.has(c.id)) err(w, `duplicate chapter id "${c.id}"`);
    seen.add(c.id);
    if (c.num !== i + 1) err(w, `num ${c.num} out of order at position ${i + 1}`);
  });

  for (const meta of index.chapters) {
    const file = `data/${meta.id}.json`;
    if (!existsSync(join(ROOT, file))) {
      err('index.json', `chapter "${meta.id}" is listed but ${file} does not exist`);
      continue;
    }
    const ch = read(file);
    if (!ch) continue;
    stats.chapters++;

    if (ch.id !== meta.id) err(file, `id "${ch.id}" does not match the index entry "${meta.id}"`);
    checkT(ch.title, `${file}.title`);
    if (!ch.sources?.length) warn(file, 'chapter has no sources');

    if (!ch.sections?.length) {
      err(file, 'chapter has no sections');
      continue;
    }
    ch.sections.forEach((s, si) => {
      stats.sections++;
      const sw = `${file} §${s.id ?? si}`;
      if (!s.id) err(sw, 'section has no id');
      checkT(s.heading, `${sw}.heading`);
      if (!s.blocks?.length) {
        err(sw, 'section has no blocks');
        return;
      }
      s.blocks.forEach((b, bi) => {
        stats.blocks++;
        const bw = `${sw} block ${bi} (${b.type})`;
        const check = BLOCK_CHECKS[b.type];
        if (!check) err(bw, `unknown block type "${b.type}"`);
        else check(b, bw);
      });
    });
  }
}

console.log(`  ${stats.chapters} chapters, ${stats.sections} sections, ` +
            `${stats.blocks} blocks, ${stats.charts} charts`);
console.log(`  content: ${stats.words.zh} zh characters, ` +
            `${stats.words.en} en words, ${stats.words.ms} ms words`);

for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);

if (errors.length) {
  console.log(`\n  ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`\n  content OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
