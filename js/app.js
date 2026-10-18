/**
 * Boot, routing and view rendering — the only module that wires the others
 * together.
 *
 * Routes are hash-based (`#/ch/ch05`) rather than history-based because the app
 * is served as static files, often from a project subpath, and must resolve
 * deep links with no server rewrite and no network at all.
 */

import * as prefs from './prefs.js';
import { pick, t, UI, LANG_NATIVE } from './i18n.js';
import { loadIndex, loadChapter, renderSections } from './content.js';
import { redrawAll } from './charts.js';
import { search as runSearch } from './search.js';
import { toSVG } from './qrcode.js';
import { APP_URL, APP_VERSION, AUTHOR } from './config.js';
import { RELEASES } from './releases.js';

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

/** A row of buttons, one of them on: language, theme, text size. */
function segmented(options, current, onPick) {
  const seg = el('div', 'rd-seg setseg');
  for (const [value, label] of options) {
    const b = el('button', value === current ? 'on' : null, label);
    b.type = 'button';
    b.addEventListener('click', () => onPick(value));
    seg.append(b);
  }
  return seg;
}

/* Theme looks as small previews: page, card and accent colour of each look.
   Keep in step with the [data-palette] blocks in css/app.css. */
const LOOK_COLOURS = {
  classic: ['#FBFAF6', '#FFFFFF', '#016F46'], paper: ['#f6f1e7', '#fffdf8', '#a8571a'],
  mint: ['#eef7f3', '#ffffff', '#0b7f62'], lavender: ['#f5f3fc', '#ffffff', '#5b45c4'],
  midnight: ['#0F1412', '#171E1A', '#45D69A'], oled: ['#000000', '#0d0d0d', '#45D69A'],
  slate: ['#23272f', '#2c313b', '#8cbcea'], grape: ['#17121f', '#221a2e', '#b89dff'],
};
function swatches(names, current, onPick) {
  const wrap = el('div', 'looks');
  for (const n of names) {
    const [bg, surface, accent] = LOOK_COLOURS[n];
    const b = el('button', n === current ? 'look on' : 'look');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(n === current));
    const prev = el('span', 'look-prev'); prev.style.background = bg;
    const card = el('span', 'look-card'); card.style.background = surface;
    const bar = el('i'); bar.style.background = accent;
    card.append(bar, el('b')); prev.append(card);
    b.append(prev, el('span', 'look-name', t(`look_${n}`)));
    b.addEventListener('click', () => onPick(n));
    wrap.append(b);
  }
  return wrap;
}

function viewInfo() {
  const view = el('div', 'view');
  const wrap = el('div', 'info');

  wrap.append(el('h1', 'chapter__title', t('settings')));

  // Language, appearance, text size, read aloud — what used to be the buttons
  // at the top of the screen.
  const set = el('div', 'card setgroup');
  const row = (title, control) => {
    const r = el('div', 'setrow');
    r.append(el('h3', null, title), control);
    return r;
  };
  const p = prefs.get();
  set.append(row(t('language'), segmented(
    ['zh', 'en', 'ms'].map(l => [l, LANG_NATIVE[l]]), p.lang, l => {
      prefs.chooseLang(l);
      applyLabels();
      render(true);
      toast(t('langSet'));
    })));
  set.append(row(t('theme'), segmented(
    [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], p.theme, th => {
      prefs.setTheme(th);
      render(true);
    })));
  set.lastChild.append(el('p', 'theme-note', t('themeNote')));
  set.append(row(t('lightLooks'), swatches(prefs.LIGHT_THEMES, p.lightTheme, n => { prefs.setLightTheme(n); render(true); })));
  set.append(row(t('darkLooks'), swatches(prefs.DARK_THEMES, p.darkTheme, n => { prefs.setDarkTheme(n); render(true); })));
  set.append(row(t('textSize'), segmented(
    prefs.SCALES.map(sc => [sc, `${Math.round(sc * 100)}%`]), p.fontScale, sc => {
      prefs.setFontScale(sc);
      redrawAll();
      render(true);
    })));
  const tts = el('div');
  set.append(row(t('readAloud'), tts));
  window.Reader.renderSettings(tts);
  wrap.append(set);

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
  const share = el('button', 'btn', t('shareApp'));
  share.type = 'button';
  share.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t('appName'), url: APP_URL }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(APP_URL); toast(t('linkCopied')); } catch { toast(APP_URL); }
  });
  qr.append(share);
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

  const ver = el('p', null, `${t('version')} ${window.WhatsNew?.label(RELEASES) || APP_VERSION} · content ${index.version} · `);
  const notes = el('a', null, t('whatsNew'));
  notes.href = '#';
  notes.addEventListener('click', e => { e.preventDefault(); window.WhatsNew?.history(); });
  ver.append(notes);
  status.append(ver);
  wrap.append(status);

  view.append(wrap);
  return view;
}

/** Notes and highlights share a screen; bookmarks have their own. */
let notesKind = 'notes';

function viewLibrary(kind) {
  const view = el('div', 'view');
  const wrap = el('div', 'info lib');
  wrap.append(el('h1', 'chapter__title', t(kind === 'bookmarks' ? 'bookmarks' : 'notes')));
  const list = el('div', 'card');
  if (kind !== 'bookmarks') {
    wrap.append(segmented([['notes', t('notes')], ['marks', t('highlights')]], notesKind, k => {
      notesKind = k;
      render(true);
    }));
  }
  wrap.append(list);
  window.Reader.renderList(list, kind === 'bookmarks' ? 'bookmarks' : notesKind);
  view.append(wrap);
  return view;
}

function viewMissing() {
  const view = el('div', 'view');
  view.append(el('p', 'empty', t('noResults')));
  return view;
}

/**
 * First-run language picker.
 *
 * Shown before anything else on a first visit, so it cannot be written in one
 * language: each option is labelled in its own language and previews the app's
 * tagline in that language, and the heading appears in all three.
 */
function viewLanguagePicker() {
  const view = el('div', 'view langpick');

  const mark = el('img', 'langpick__mark');
  mark.src = 'icons/icon-512.png';
  mark.alt = '';
  mark.width = 76;
  mark.height = 76;

  const names = el('div', 'langpick__names');
  for (const l of ['zh', 'en', 'ms']) names.append(el('span', null, UI.appName[l]));

  const head = el('div', 'langpick__head');
  // English first: it is the default, and the option a reader who knows none of
  // the three is most likely to manage.
  for (const l of ['en', 'zh', 'ms']) head.append(el('p', null, UI.chooseLanguage[l]));

  view.append(mark, names, head);

  const list = el('div', 'langpick__list');
  for (const l of ['en', 'zh', 'ms']) {
    const b = el('button', 'langopt');
    b.type = 'button';
    b.lang = l;
    b.setAttribute('aria-label', `${LANG_NATIVE[l]} — ${UI.chooseLanguage[l]}`);
    b.append(
      el('span', 'langopt__name', LANG_NATIVE[l]),
      el('span', 'langopt__tag', UI.tagline[l]),
    );
    b.addEventListener('click', () => {
      prefs.chooseLang(l);
      delete document.documentElement.dataset.onboarding;
      applyLabels();
      // Re-render whatever route was actually requested, so a shared deep link
      // still lands where it was pointing after the language is picked.
      render();
      toast(t('changeLater'));
    });
    list.append(b);
  }
  view.append(list);

  requestAnimationFrame(() => list.firstElementChild?.focus({ preventScroll: true }));
  return view;
}

/* --- Router --------------------------------------------------------------- */

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'ch') return { name: 'chapter', id: parts[1], anchor: parts[2] };
  if (parts[0] === 'search') return { name: 'search', q: decodeURIComponent(parts[1] || '') };
  if (parts[0] === 'info' || parts[0] === 'settings') return { name: 'info' };
  if (parts[0] === 'notes') return { name: 'notes' };
  if (parts[0] === 'bookmarks') return { name: 'bookmarks' };
  return { name: 'home' };
}

let renderToken = 0;

async function render(keepScroll = false) {
  const route = parseRoute();
  const token = ++renderToken;
  const y = window.scrollY;

  // Nothing else renders until a language has been picked. The route is left
  // untouched, so the picker hands the reader on to wherever they were headed.
  if (!prefs.hasChosenLang()) {
    document.documentElement.dataset.onboarding = 'on';
    main.replaceChildren(viewLanguagePicker());
    window.scrollTo(0, 0);
    return;
  }

  let view;
  switch (route.name) {
    case 'chapter': view = await viewChapter(route.id, route.anchor); break;
    case 'search':  view = await viewSearch(route.q); break;
    case 'info':    view = viewInfo(); break;
    case 'notes':   view = viewLibrary('notes'); break;
    case 'bookmarks': view = viewLibrary('bookmarks'); break;
    default:        view = viewHome();
  }

  // A newer navigation started while this one was awaiting content.
  if (token !== renderToken) return;

  // Reading aloud follows the chapter it started in. Going anywhere else stops
  // it, unless the reading itself turned the page (readerNext below).
  if (!ttsTurningPage) window.Reader.stop();

  main.replaceChildren(view);
  window.Reader.refresh();
  markNav();
  if (pendingReveal && route.name === 'chapter') {
    const key = pendingReveal;
    pendingReveal = null;
    requestAnimationFrame(() => window.Reader.reveal(key));
  }
  // All three names, always: the tab title is also what a bookmark and a
  // shared link are labelled with, and those outlive the reader's language.
  document.title = `${UI.appName.zh} · ${UI.appName.en} · ${UI.appName.ms}`;
  document.getElementById('app-name').textContent = t('appName');

  if (keepScroll) window.scrollTo(0, y);
  else if (!route.anchor && !pendingReveal) window.scrollTo(0, 0);
  for (const fn of afterRender.splice(0)) fn();
}

/* --- Notes, bookmarks, read aloud (js/reader.js) --------------------------- */

let pendingReveal = null;
let ttsTurningPage = false;
const afterRender = [];

/** "Chapter 5 · 5.2 Heading" — where a saved block lives. */
function whereOf(u) {
  const chap = u.closest('.chapter')?.querySelector('.chapter__num')?.textContent || '';
  const sec = u.closest('.sec')?.querySelector('.sec__h');
  const head = sec ? [...sec.children].map(c => c.textContent).join(' ') : '';
  return [chap, head].filter(Boolean).join(' · ');
}

/** Go to the chapter a saved block is in, then bring the block on screen. */
function openSaved(key) {
  const chapterId = key.split('/')[0];
  const route = parseRoute();
  if (route.name === 'chapter' && route.id === chapterId && window.Reader.reveal(key)) return;
  pendingReveal = key;
  go(`#/ch/${chapterId}`);
}

/** Reading aloud reached the end of a chapter: turn to the next one. */
async function readerNext() {
  const route = parseRoute();
  if (route.name !== 'chapter') return false;
  const i = index.chapters.findIndex(c => c.id === route.id);
  const next = index.chapters[i + 1];
  if (!next) return false;
  ttsTurningPage = true;
  const done = new Promise(resolve => afterRender.push(resolve));
  go(`#/ch/${next.id}`);
  await done;
  ttsTurningPage = false;
  return true;
}

function markNav() {
  const route = parseRoute().name;
  const tab = { home: 'home', chapter: 'home', search: 'home', info: 'settings',
                notes: 'notes', bookmarks: 'bookmarks' }[route];
  const listening = window.Reader.isListening();
  for (const b of document.querySelectorAll('#bottomnav [data-nav]')) {
    b.classList.toggle('on', b.dataset.nav === 'listen' ? listening : b.dataset.nav === tab);
  }
  document.getElementById('nav-listen').textContent = t(listening ? 'stopReading' : 'readAloud');
}

function wireBottomNav() {
  document.getElementById('bottomnav').addEventListener('click', e => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    switch (b.dataset.nav) {
      case 'home': go('#/'); break;
      case 'listen':
        if (!window.Reader.isListening() && parseRoute().name !== 'chapter') {
          toast(t('openChapter'));
          return;
        }
        window.Reader.listen();
        break;
      case 'notes': go('#/notes'); break;
      case 'bookmarks': go('#/bookmarks'); break;
      case 'settings': go('#/settings'); break;
    }
  });
}

/* --- Controls ------------------------------------------------------------- */

function wireControls() {
  document.getElementById('btn-home')
    .addEventListener('click', () => go('#/'));

  document.getElementById('btn-search').addEventListener('click', () => {
    const route = parseRoute();
    if (route.name !== 'search') go('#/search/');
  });

  wireBottomNav();

  window.Reader.init({
    app: 'opw',
    root: () => main,
    units: '[data-rk]',
    lang: () => prefs.get().lang,
    where: whereOf,
    open: openSaved,
    next: readerNext,
    toast,
    onState: markNav,
    topOffset: () => document.querySelector('.appbar').getBoundingClientRect().bottom,
  });
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
          }
        });
      });
    })
    .catch(err => console.warn('[sw] registration failed', err));

  // A new worker has taken over with new content. Ask before reloading: a
  // reload in the middle of reading loses the reader's place. The first
  // install also fires this, with nothing new to show.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    if (window.WhatsNew) window.WhatsNew.offerUpdate(reload);
    else reload();
  });
}

/* --- Boot ----------------------------------------------------------------- */

async function boot() {
  const state = prefs.init();
  // Nothing chosen yet: a first-ever launch, with no update to catch up on.
  const newUser = !state.langChosen;
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
  // After an update: what changed, once.
  window.WhatsNew?.init({
    version: APP_VERSION, releases: RELEASES, key: 'opw.seenVersion',
    lang: () => prefs.get().lang, isNewUser: () => newUser,
  });
}

boot();
