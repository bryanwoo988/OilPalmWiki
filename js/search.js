/**
 * Client-side search across all three languages at once.
 *
 * Someone reading the Malay interface still searches for "Ganoderma" or
 * "空果串", so the index holds every language regardless of the active one and
 * results are shown in the language the reader is currently using.
 *
 * CJK has no word boundaries, so Latin text is matched on tokens and CJK on
 * substrings. The corpus is roughly 20 chapters of prose — small enough that a
 * linear scan over a flat array is instant and needs no inverted index.
 */

import { pick } from './i18n.js';
import { loadIndex, loadAll } from './content.js';

const LANGS = ['zh', 'en', 'ms'];
let entries = null;

const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const hasCJK = s => /[㐀-鿿豈-﫿]/.test(s);

/** Pull every translatable string out of a block, per language. */
function harvest(block, out) {
  const add = v => {
    if (!v || typeof v !== 'object') return;
    for (const l of LANGS) if (v[l]) out[l].push(v[l]);
  };

  switch (block.type) {
    case 'p':
    case 'note':
      add(block.text);
      break;
    case 'list':
      block.items.forEach(add);
      break;
    case 'keyval':
      block.rows.forEach(r => { add(r.k); add(r.v); });
      break;
    case 'table':
      add(block.caption);
      block.headers.forEach(add);
      block.rows.flat().forEach(add);
      break;
    case 'chart':
      add(block.chart.title);
      add(block.chart.note);
      block.chart.x?.categories?.forEach(add);
      block.chart.series?.forEach(s => add(s.name));
      break;
    case 'figure':
      add(block.caption);
      add(block.alt);
      break;
  }
}

async function build() {
  const [index, chapters] = await Promise.all([loadIndex(), loadAll()]);
  const byId = new Map(index.chapters.map(c => [c.id, c]));
  const list = [];

  for (const ch of chapters) {
    const meta = byId.get(ch.id);
    for (const section of ch.sections) {
      const text = { zh: [], en: [], ms: [] };
      for (const l of LANGS) if (section.heading?.[l]) text[l].push(section.heading[l]);
      for (const block of section.blocks) harvest(block, text);

      const joined = {};
      const needle = {};
      for (const l of LANGS) {
        joined[l] = text[l].join(' · ');
        needle[l] = norm(joined[l]);
      }

      list.push({
        chapterId: ch.id,
        chapterNum: ch.num,
        chapterTitle: meta?.title ?? ch.title,
        sectionId: section.id,
        heading: section.heading,
        text: joined,
        needle,
      });
    }
  }
  entries = list;
  return list;
}

/** Build the index once, lazily — it is only needed when someone searches. */
export async function ready() {
  if (!entries) await build();
  return entries;
}

function scoreEntry(entry, query) {
  const q = norm(query);
  const terms = hasCJK(q) ? [q] : q.split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;

  let best = 0;
  for (const l of LANGS) {
    const hay = entry.needle[l];
    if (!hay) continue;
    let score = 0;
    for (const term of terms) {
      const at = hay.indexOf(term);
      if (at < 0) { score = 0; break; }
      // A hit in the heading, or at the very start of a section, is a
      // stronger signal than one buried in the middle of a paragraph.
      score += 10 + Math.max(0, 8 - at / 120);
      if (norm(pick(entry.heading, l)).includes(term)) score += 25;
    }
    best = Math.max(best, score);
  }
  return best;
}

/** A snippet around the first hit, split into plain/marked runs. */
function snippet(entry, query, lang) {
  const text = entry.text[lang] || entry.text.en || entry.text.zh || '';
  const q = norm(query);
  const terms = hasCJK(q) ? [q] : q.split(/\s+/).filter(Boolean);
  const hay = norm(text);

  let at = -1;
  let hitLen = 0;
  for (const term of terms) {
    const i = hay.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) { at = i; hitLen = term.length; }
  }
  if (at < 0) return [{ text: text.slice(0, 150), mark: false }];

  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + hitLen + 110);
  const lead = (start > 0 ? '…' : '') + text.slice(start, at);
  const tail = text.slice(at + hitLen, end) + (end < text.length ? '…' : '');

  return [
    { text: lead, mark: false },
    { text: text.slice(at, at + hitLen), mark: true },
    { text: tail, mark: false },
  ];
}

/**
 * Search all languages.
 * @returns ranked results, each with a snippet in `lang`.
 */
export async function search(query, lang, limit = 40) {
  if (!query || query.trim().length < 1) return [];
  const list = await ready();

  return list
    .map(e => ({ entry: e, score: scoreEntry(e, query) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.chapterNum - b.entry.chapterNum)
    .slice(0, limit)
    .map(r => ({
      chapterId: r.entry.chapterId,
      chapterNum: r.entry.chapterNum,
      chapterTitle: r.entry.chapterTitle,
      sectionId: r.entry.sectionId,
      heading: r.entry.heading,
      parts: snippet(r.entry, query, lang),
    }));
}
