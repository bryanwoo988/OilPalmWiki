/**
 * User preferences: language, theme, reading-mode font scale.
 *
 * Owns localStorage and the `<html>` attributes the stylesheet reads.
 * Knows nothing about content, routing or the DOM beyond documentElement.
 */

const KEY = 'opwiki.prefs';

export const LANGS = ['zh', 'en', 'ms'];
export const THEMES = ['auto', 'light', 'dark'];
export const SCALES = [1, 1.15, 1.3, 1.5];

const DEFAULTS = { lang: 'zh', theme: 'auto', fontScale: 1 };

let state = { ...DEFAULTS };
const listeners = new Set();

/** localStorage throws in some private-browsing modes; defaults are fine. */
function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* preferences simply do not persist this session */
  }
}

/** Reject stored values that are no longer valid rather than trusting them. */
function sanitise(raw) {
  return {
    lang: LANGS.includes(raw.lang) ? raw.lang : DEFAULTS.lang,
    theme: THEMES.includes(raw.theme) ? raw.theme : DEFAULTS.theme,
    fontScale: SCALES.includes(raw.fontScale) ? raw.fontScale : DEFAULTS.fontScale,
  };
}

function apply() {
  const r = document.documentElement;
  r.lang = state.lang;
  r.dataset.theme = state.theme;
  r.dataset.scale = String(state.fontScale);
  r.style.setProperty('--font-scale', String(state.fontScale));
  // Reading mode at 1.3+ also relaxes the layout — see css/app.css.
  if (state.fontScale >= 1.3) r.dataset.wide = 'on';
  else delete r.dataset.wide;
}

function emit(what) {
  for (const fn of listeners) fn(what, state);
}

export function init() {
  state = sanitise(read());
  apply();
  return state;
}

export function get() {
  return { ...state };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function step(list, current) {
  return list[(list.indexOf(current) + 1) % list.length];
}

/** Advance zh → en → ms → zh. Returns the new language. */
export function cycleLang() {
  state.lang = step(LANGS, state.lang);
  apply();
  write();
  emit('lang');
  return state.lang;
}

/** Advance auto → light → dark → auto, so an override can be undone. */
export function cycleTheme() {
  state.theme = step(THEMES, state.theme);
  apply();
  write();
  emit('theme');
  return state.theme;
}

/** Advance 1 → 1.15 → 1.3 → 1.5 → 1. Returns the new scale. */
export function cycleFontScale() {
  state.fontScale = step(SCALES, state.fontScale);
  apply();
  write();
  emit('fontScale');
  return state.fontScale;
}
