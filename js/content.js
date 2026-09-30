/**
 * Chapter loading and block rendering.
 *
 * Content is plain JSON so it can be edited without touching code. Every
 * user-visible string is a `{zh, en, ms}` triple resolved through i18n.pick,
 * and every block type is rendered by one small function below.
 */

import { pick, t } from './i18n.js';
import { render as renderChart } from './charts.js';

const cache = new Map();

/**
 * Resolve against this module rather than the page, so content loads the same
 * whether the app is served from the site root, from a project subpath, or
 * from a page in a subdirectory such as tests/.
 */
const asset = path => new URL(`../${path}`, import.meta.url).href;

/** The chapter manifest — titles, blurbs, order. Loaded once. */
export async function loadIndex() {
  if (!cache.has('index')) {
    cache.set('index', fetch(asset('data/index.json')).then(r => {
      if (!r.ok) throw new Error(`index.json: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get('index');
}

export async function loadChapter(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(asset(`data/${id}.json`)).then(r => {
      if (!r.ok) throw new Error(`${id}.json: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(id);
}

/** Every chapter, for search indexing. Served from the SW cache after install. */
export async function loadAll() {
  const idx = await loadIndex();
  return Promise.all(idx.chapters.map(c => loadChapter(c.id)));
}

/* --- Block renderers ------------------------------------------------------ */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const NOTE_ICON = { tip: '💡', warn: '⚠️', key: '🔑' };

const BLOCKS = {
  p: b => el('p', 'blk blk--p', pick(b.text)),

  list(b) {
    const ul = el(b.ordered ? 'ol' : 'ul', 'blk blk--list');
    for (const item of b.items) ul.append(el('li', null, pick(item)));
    return ul;
  },

  keyval(b) {
    const dl = el('dl', 'blk keyval');
    for (const row of b.rows) {
      dl.append(el('dt', null, pick(row.k)), el('dd', null, pick(row.v)));
    }
    return dl;
  },

  table(b) {
    const wrap = el('div', 'blk tablewrap');
    const table = el('table', 'data');
    if (b.caption) table.append(el('caption', null, pick(b.caption)));

    const thead = el('thead');
    const hr = el('tr');
    for (const h of b.headers) {
      const th = el('th', null, pick(h));
      th.scope = 'col';
      hr.append(th);
    }
    thead.append(hr);

    const tbody = el('tbody');
    for (const row of b.rows) {
      const tr = el('tr');
      row.forEach((cell, i) => {
        const node = el(i === 0 ? 'th' : 'td', null, pick(cell));
        if (i === 0) node.scope = 'row';
        tr.append(node);
      });
      tbody.append(tr);
    }

    table.append(thead, tbody);
    wrap.append(table);
    return wrap;
  },

  chart: b => renderChart(b.chart),

  figure(b) {
    const fig = el('figure', 'fig');
    const img = el('img');
    img.src = asset(b.src);
    img.alt = pick(b.alt) || pick(b.caption) || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    fig.append(img);
    if (b.caption) fig.append(el('figcaption', null, pick(b.caption)));
    return fig;
  },

  note(b) {
    const div = el('div', `note note--${b.kind || 'tip'}`);
    div.append(el('span', 'note__ico', NOTE_ICON[b.kind] || NOTE_ICON.tip),
               el('div', null, pick(b.text)));
    return div;
  },
};

function renderBlock(block) {
  const fn = BLOCKS[block.type];
  if (!fn) {
    console.warn(`[content] unknown block type "${block.type}"`);
    return null;
  }
  return fn(block);
}

/** Render a whole chapter body into a fragment. */
export function renderSections(chapter) {
  const frag = document.createDocumentFragment();

  for (const section of chapter.sections) {
    const sec = el('section', 'sec');
    sec.id = `s-${section.id}`;

    const h = el('h2', 'sec__h');
    h.append(el('span', 'sec__n', section.id),
             el('span', null, pick(section.heading)));
    sec.append(h);

    for (const block of section.blocks) {
      const node = renderBlock(block);
      if (node) sec.append(node);
    }
    frag.append(sec);
  }

  if (chapter.sources?.length) {
    const s = el('div', 'sources');
    s.append(el('strong', null, t('sources') + ': '),
             document.createTextNode(chapter.sources.join(' · ')));
    frag.append(s);
  }
  return frag;
}
