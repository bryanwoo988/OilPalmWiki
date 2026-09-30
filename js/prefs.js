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

// English is the default so that the first screen, which is shown before anyone
// has chosen, reads for the widest audience. `langChosen` records whether that
// choice has actually been made — without it there is no way to tell a first
// visit from someone who deliberately picked English.
const DEFAULTS = { lang: 'en', theme: 'auto', fontScale: 1, langChosen: false };

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
    // Anything other than a stored `true` counts as not yet chosen, so a
    // corrupted value shows the picker again rather than silently skipping it.
    langChosen: raw.langChosen === true && LANGS.includes(raw.lang),
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

/** Has the reader picked a language yet? False on a first visit. */
export function hasChosenLang() {
  return state.langChosen;
}

/**
 * Set the language from the first-run picker. Unlike cycleLang this also
 * records that the choice was made, so the picker is not shown again.
 */
export function chooseLang(lang) {
  if (!LANGS.includes(lang)) throw new RangeError(`unknown language: ${lang}`);
  state.lang = lang;
  state.langChosen = true;
  apply();
  write();
  emit('lang');
  return state.lang;
}

/** Advance zh → en → ms → zh. Returns the new language. */
export function cycleLang() {
  state.lang = step(LANGS, state.lang);
  // Using the header toggle is a choice too; the picker should not reappear.
  state.langChosen = true;
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
