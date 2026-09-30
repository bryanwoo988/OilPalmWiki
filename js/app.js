/**
 * Boot, routing and view rendering — the only module that wires the others
 * together.
 *
 * Routes are hash-based (`#/ch/ch05`) rather than history-based because the app
 * is served as static files, often from a project subpath, and must resolve
 * deep links with no server rewrite and no network at all.
 */

import * as prefs from './prefs.js';
import { pick, t, UI, LANG_GLYPH } from './i18n.js';
import { loadIndex, loadChapter, renderSections } from './content.js';
import { redrawAll } from './charts.js';
import { search as runSearch } from './search.js';
import { toSVG } from './qrcode.js';
import { APP_URL, APP_VERSION, AUTHOR } from './config.js';

const main = document.getElementById('main');
const toastEl = document.getElementById('toast');

let index = null;
let swRegistration = null;
let updateWaiting = null;

/* --- Small DOM helpers ---------------------------------------------------- */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function icon(paths, size = 15) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [].concat(paths)) {
    const p = document.createElementNS(svg.namespaceURI, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1900);
}

const go = hash => { location.hash = hash; };

/* --- Views ---------------------------------------------------------------- */

function viewHome() {
  const view = el('div', 'view');

  const hero = el('header', 'hero');
  const mark = el('img', 'hero__mark');
  mark.src = 'icons/icon-512.png';
  mark.alt = '';
  mark.width = 84;
  mark.height = 84;
  hero.append(mark, el('h1', 'hero__title', t('appName')));

  // The other two names, so a reader who knows only one of them recognises it.
  const others = ['zh', 'en', 'ms']
    .filter(l => l !== prefs.get().lang)
    .map(l => UI.appName[l])
    .join('  ·  ');
  hero.append(el('p', 'hero__alt', others), el('p', 'hero__tag', t('tagline')));
  view.append(hero);

  const bar = el('div', 'searchbar');
  bar.append(icon(['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M16 16l4.5 4.5'], 19));
  const input = el('input');
  input.type = 'search';
  input.placeholder = t('searchPrompt');
  input.setAttribute('aria-label', t('search'));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) {
      go(`#/search/${encodeURIComponent(input.value.trim())}`);
    }
  });
  bar.append(input);
  view.append(bar);

  view.append(el('h2', 'section-label', t('chapters')));

  const grid = el('div', 'chapters');
  for (const c of index.chapters) {
    const card = el('button', 'chapcard');
    card.type = 'button';
    card.append(
      el('span', 'chapcard__num', String(c.num).padStart(2, '0')),
      el('span', 'chapcard__title', pick(c.title)),
      el('span', 'chapcard__blurb', pick(c.blurb)),
    );
    card.addEventListener('click', () => go(`#/ch/${c.id}`));
    grid.append(card);
  }
  view.append(grid);

  return view;
}

async function viewChapter(id, anchor) {
  const meta = index.chapters.find(c => c.id === id);
  if (!meta) return viewMissing();

  const view = el('div', 'view');
  const wrap = el('article', 'chapter');

  const back = el('button', 'crumb');
  back.type = 'button';
  back.append(icon('M15 5l-7 7 7 7'), document.createTextNode(t('chapters')));
  back.addEventListener('click', () => go('#/'));
  wrap.append(back);

  wrap.append(
    el('p', 'chapter__num', t('chapter', { n: meta.num })),
    el('h1', 'chapter__title', pick(meta.title)),
  );

  const body = el('div');
  body.append(el('p', 'empty', t('loading')));
  wrap.append(body);
  view.append(wrap);

  let chapter;
  try {
    chapter = await loadChapter(id);
  } catch (err) {
    console.error(err);
    body.replaceChildren(el('p', 'empty', t('loadError')));
    return view;
  }

  // Section chips, inserted above the body once the sections are known.
  const toc = el('nav', 'toc');
  toc.setAttribute('aria-label', pick(meta.title));
  for (const s of chapter.sections) {
    const b = el('button', null, `${s.id}  ${pick(s.heading)}`);
    b.type = 'button';
    b.addEventListener('click', () => {
      document.getElementById(`s-${s.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toc.append(b);
  }
  wrap.insertBefore(toc, body);

  body.replaceChildren(renderSections(chapter));

  // Previous / next chapter
  const i = index.chapters.indexOf(meta);
  const pager = el('nav', 'pager');
  const link = (target, label) => {
    const b = el('button');
    b.type = 'button';
    b.append(el('small', null, label), el('span', null, pick(target.title)));
    b.addEventListener('click', () => go(`#/ch/${target.id}`));
    return b;
  };
  if (i > 0) pager.append(link(index.chapters[i - 1], t('prev')));
  if (i < index.chapters.length - 1) pager.append(link(index.chapters[i + 1], t('next')));
  if (pager.children.length) wrap.append(pager);

  if (anchor) {
    requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    });
  }
  return view;
}

async function viewSearch(query) {
  const view = el('div', 'view');
  const wrap = el('div', 'results');

  const back = el('button', 'crumb');
  back.type = 'button';
  back.append(icon('M15 5l-7 7 7 7'), document.createTextNode(t('home')));
  back.addEventListener('click', () => go('#/'));
  wrap.append(back);

  const bar = el('div', 'searchbar');
  bar.append(icon(['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M16 16l4.5 4.5'], 19));
  const input = el('input');
  input.type = 'search';
  input.value = query;
  input.placeholder = t('searchPrompt');
  input.setAttribute('aria-label', t('search'));
  bar.append(input);
  wrap.append(bar);

  const list = el('div');
  wrap.append(list);
  view.append(wrap);

  const show = async q => {
    if (!q.trim()) { list.replaceChildren(el('p', 'empty', t('searchHint'))); return; }
    const hits = await runSearch(q, prefs.get().lang);
    if (!hits.length) { list.replaceChildren(el('p', 'empty', t('noResults'))); return; }

    const frag = document.createDocumentFragment();
    frag.append(el('p', 'section-label', t('resultCount', { n: hits.length })));
    for (const hit of hits) {
      const b = el('button', 'result');
      b.type = 'button';
      b.append(el('div', 'result__where',
        `${t('chapter', { n: hit.chapterNum })} · ${hit.sectionId} ${pick(hit.heading)}`));

      // Built from text nodes and <mark>, never innerHTML — the query is
      // whatever the reader typed.
      const snip = el('div', 'result__snip');
      for (const part of hit.parts) {
        if (part.mark) snip.append(el('mark', null, part.text));
        else snip.append(document.createTextNode(part.text));
      }
      b.append(snip);
      b.addEventListener('click', () => go(`#/ch/${hit.chapterId}/s-${hit.sectionId}`));
      frag.append(b);
    }
    list.replaceChildren(frag);
  };

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = input.value.trim();
      history.replaceState(null, '', `#/search/${encodeURIComponent(q)}`);
      show(q);
    }, 160);
  });

  await show(query);
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
  return view;
}

function viewInfo() {
  const view = el('div', 'view');
  const wrap = el('div', 'info');

  const back = el('button', 'crumb');
  back.type = 'button';
  back.append(icon('M15 5l-7 7 7 7'), document.createTextNode(t('home')));
  back.addEventListener('click', () => go('#/'));
  wrap.append(back);

  // Byline
  const by = el('div', 'card byline');
  const mark = el('img', 'byline__mark');
  mark.src = 'icons/icon-512.png';
  mark.alt = '';
  mark.width = 62;
  mark.height = 62;
  by.append(mark,
    el('div', 'byline__name', t('appName')),
    el('div', 'byline__by', `Apps created by ${AUTHOR}`));
  wrap.append(by);

  // QR — generated on device, so it works with no network.
  const qr = el('div', 'card qr');
  const frame = el('div', 'qr__frame');
  try {
    frame.append(toSVG(APP_URL, { quiet: 2 }));
    qr.append(frame);
  } catch (err) {
    console.error('[qr]', err);
  }
  qr.append(el('p', 'qr__link', t('scanToOpen')));
  const link = el('a', null, APP_URL);
  link.href = APP_URL;
  link.rel = 'noopener';
  link.className = 'qr__link';
  qr.append(link);
  wrap.append(qr);

  const card = (title, ...paras) => {
    const c = el('div', 'card');
    c.append(el('h2', null, title));
    for (const p of paras) c.append(el('p', null, p));
    return c;
  };

  wrap.append(card(t('aboutApp'), t('aboutAppBody')));
  wrap.append(card(t('sourcesTitle'), t('sourcesBody')));
  wrap.append(card(t('disclaimerTitle'), t('disclaimerBody')));

  // Offline status
  const status = el('div', 'card');
  status.append(el('h2', null, t('offlineTitle')));
  const line = el('p');
  const dot = el('span', 'statusdot');
  line.append(dot, document.createTextNode(t('offlineBusy')));
  status.append(line);

  const setStatus = (cls, label) => {
    dot.className = `statusdot ${cls}`;
    line.replaceChildren(dot, document.createTextNode(label));
  };
  if (!('serviceWorker' in navigator)) {
    setStatus('', t('offlineNo'));
  } else {
    navigator.serviceWorker.ready
      .then(() => setStatus('statusdot--ok', t('offlineReady')))
      .catch(() => setStatus('', t('offlineNo')));
  }

  if (updateWaiting) {
    const btn = el('button', 'btn', t('updateNow'));
    btn.type = 'button';
    btn.addEventListener('click', () => {
      updateWaiting.postMessage({ type: 'SKIP_WAITING' });
    });
    status.append(el('p', null, t('updateReady')), btn);
  }

  status.append(el('p', null, `${t('version')} ${APP_VERSION} · content ${index.version}`));
  wrap.append(status);

  view.append(wrap);
  return view;
}

function viewMissing() {
  const view = el('div', 'view');
  view.append(el('p', 'empty', t('noResults')));
  return view;
}

/* --- Router --------------------------------------------------------------- */

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'ch') return { name: 'chapter', id: parts[1], anchor: parts[2] };
  if (parts[0] === 'search') return { name: 'search', q: decodeURIComponent(parts[1] || '') };
  if (parts[0] === 'info') return { name: 'info' };
  return { name: 'home' };
}

let renderToken = 0;

async function render(keepScroll = false) {
  const route = parseRoute();
  const token = ++renderToken;
  const y = window.scrollY;

  let view;
  switch (route.name) {
    case 'chapter': view = await viewChapter(route.id, route.anchor); break;
    case 'search':  view = await viewSearch(route.q); break;
    case 'info':    view = viewInfo(); break;
    default:        view = viewHome();
  }

  // A newer navigation started while this one was awaiting content.
  if (token !== renderToken) return;

  main.replaceChildren(view);
  // All three names, always: the tab title is also what a bookmark and a
  // shared link are labelled with, and those outlive the reader's language.
  document.title = `${UI.appName.zh} · ${UI.appName.en} · ${UI.appName.ms}`;
  document.getElementById('app-name').textContent = t('appName');

  if (keepScroll) window.scrollTo(0, y);
  else if (!route.anchor) window.scrollTo(0, 0);
}

/* --- Controls ------------------------------------------------------------- */

function wireControls() {
  document.getElementById('btn-home')
    .addEventListener('click', () => go('#/'));

  document.getElementById('btn-search').addEventListener('click', () => {
    const route = parseRoute();
    if (route.name !== 'search') go('#/search/');
  });

  document.getElementById('btn-lang').addEventListener('click', () => {
    const lang = prefs.cycleLang();
    document.getElementById('lang-glyph').textContent = LANG_GLYPH[lang];
    applyLabels();
    // Re-render in place: switching language should not lose the reader's spot.
    render(true);
    toast(t('langSet'));
  });

  document.getElementById('btn-read').addEventListener('click', () => {
    const scale = prefs.cycleFontScale();
    document.getElementById('read-glyph').textContent =
      'A'.repeat(prefs.SCALES.indexOf(scale) + 1);
    // Chart gutters are sized from the scale, so they need a redraw.
    redrawAll();
    toast(t('scaleSet', { n: Math.round(scale * 100) }));
  });

  document.getElementById('btn-theme').addEventListener('click', () => {
    const theme = prefs.cycleTheme();
    toast(t({ auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' }[theme]));
  });

  document.getElementById('btn-info')
    .addEventListener('click', () => go('#/info'));
}

/** Refresh every aria-label and static label after a language change. */
function applyLabels() {
  for (const node of document.querySelectorAll('[data-i18n-label]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nLabel));
    node.title = t(node.dataset.i18nLabel);
  }
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  document.getElementById('app-name').textContent = t('appName');
}

/* --- Service worker ------------------------------------------------------- */

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // file:// has no service worker; the app still runs, just without offline.
  if (location.protocol === 'file:') return;

  navigator.serviceWorker.register('sw.js', { scope: './' })
    .then(reg => {
      swRegistration = reg;
      if (reg.waiting) updateWaiting = reg.waiting;
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            updateWaiting = sw;
            toast(t('updateReady'));
          }
        });
      });
    })
    .catch(err => console.warn('[sw] registration failed', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

/* --- Boot ----------------------------------------------------------------- */

async function boot() {
  const state = prefs.init();
  document.getElementById('lang-glyph').textContent = LANG_GLYPH[state.lang];
  document.getElementById('read-glyph').textContent =
    'A'.repeat(prefs.SCALES.indexOf(state.fontScale) + 1);
  applyLabels();
  wireControls();

  try {
    index = await loadIndex();
  } catch (err) {
    console.error(err);
    main.replaceChildren(el('p', 'empty', t('loadError')));
    return;
  }

  window.addEventListener('hashchange', () => render());
  await render();
  registerSW();
}

boot();
