# OPWiki / 油棕百科 / Wiki Sawit — Design Spec

**Date:** 2026-09-30
**Owner:** Bryan Woo
**Status:** Built. See §14 for what changed during implementation.

---

## 1. Intent

A pocket reference on oil palm agronomy that works with no network, in three
languages, readable by people with different eyesight and in different light.

**Who it is for:** agronomists, estate staff, students and smallholders in
Malaysia and Indonesia, where phone data is unreliable in the field and the
working language changes from person to person.

**Success looks like:** someone opens it standing in a plantation with no
signal, switches to Malay, enlarges the text, and finds the potassium
deficiency symptoms in under 30 seconds.

**What it is not:** a copy of any textbook. See §2.

---

## 2. Content sourcing and licensing

The reference PDF in this folder is *The Oil Palm*, 5th edition, Corley &
Tinker, © 2016 John Wiley & Sons — a commercial textbook currently on sale.
The app therefore does **not** reproduce it.

| Source material | Use | Reason |
|---|---|---|
| Facts, measurements, agronomic data | Used | Facts are not copyrightable |
| Book prose | Not used | Rewritten as original text |
| Book photographs | Not used | Copyrighted images |
| Book figures / scanned charts | Not used | Redrawn as original SVG from the data |
| `palm-oil-2.png` | Used | Bryan's own asset |

Attribution appears on the Info screen and on every chapter's source line:

> Content written for this app, drawing on established oil palm agronomy.
> Principal reference: R.H.V. Corley & P.B. Tinker, *The Oil Palm*, 5th ed.,
> Wiley-Blackwell, 2016. Statistical data from Oil World, MPOB, FAOSTAT.
> App created by Bryan Woo.

Where a figure carries numbers traceable to a primary source (Oil World, MPOB,
FAOSTAT), that primary source is named on the chart itself, not the textbook.

**Engineering note:** even setting licensing aside, the book's figures are
print-screened scans. Embedding them would push the app past 50 MB, break
offline caching on modest phones, and leave the text inside them untranslatable
and unaffected by the reading-mode font scale. Redrawn SVG is both smaller and
more functional.

---

## 3. Names and identity

| Language | Name | Locale tag |
|---|---|---|
| 中文 | 油棕百科 | `zh` |
| English | OPWiki | `en` |
| Bahasa Melayu | Wiki Sawit | `ms` |

Brand palette derived from `palm-oil-2.png`:

| Token | Hex | From |
|---|---|---|
| Leaf green | `#09A76D` | fronds |
| Deep green | `#017B4E` | frond shadow |
| Oil amber | `#FAC600` | oil droplet |
| Amber shade | `#E8B800` | droplet shadow |
| Trunk peach | `#FFBD86` | trunk |
| Bark brown | `#A44F3E` | fruit bunch |
| Ink | `#000000` | outlines |

---

## 4. Architecture

Static PWA, **no build step, no npm, no CDN**. Every byte ships from the
project folder; a CDN reference would defeat the offline requirement.

```
OilPalmV2PWA/
├── index.html                 single page, all views
├── manifest.webmanifest
├── sw.js                      precache-everything service worker
├── css/app.css                tokens, themes, type scale, layout
├── js/
│   ├── app.js                 boot, router, view rendering
│   ├── i18n.js                language cycle + string table
│   ├── prefs.js               theme / lang / font-scale persistence
│   ├── content.js             chapter loading + rendering
│   ├── charts.js              SVG chart renderer
│   ├── search.js              client-side trilingual index
│   └── qrcode.js              offline QR encoder (no network)
├── data/
│   ├── index.json             chapter manifest + UI strings
│   └── ch01.json … ch20.json  trilingual chapter content
├── figures/*.svg              original diagrams
├── icons/                     app icons + splash screens
└── docs/superpowers/specs/    this file
```

**Why no framework:** the app is a content reader. State is three preferences
and a route. A framework would add a build step, a toolchain to keep alive, and
bundle weight, in exchange for nothing this app needs. Chapters are plain JSON,
so content can be edited without touching code — which matters because the
content will keep growing after v1.

### Module boundaries

Each module owns one thing and exposes a narrow surface:

- `prefs.js` — reads/writes `localStorage`, applies `data-theme` and
  `--font-scale` to `<html>`. Exposes `get/set/cycleTheme/cycleFontScale`.
  Knows nothing about content or rendering.
- `i18n.js` — owns the language cycle `zh → en → ms → zh` and the UI string
  table. Exposes `current()`, `cycle()`, `t(key)`, `pick(obj)` where `pick`
  resolves a `{zh,en,ms}` object to the active language. Knows nothing
  about the DOM.
- `content.js` — fetches chapter JSON, renders blocks to DOM. Depends on
  `i18n.pick` and `charts.render`. Knows nothing about routing.
- `charts.js` — takes a chart spec object, returns an `<svg>` element. Pure;
  no fetch, no globals. Theme-aware via CSS custom properties, so a theme
  switch needs no re-render.
- `search.js` — builds an in-memory index across all three languages at first
  use, returns ranked hits. Pure over the loaded content.
- `qrcode.js` — byte-mode QR encoder, returns an `<svg>`. Self-contained.
- `app.js` — the only module that touches the router and wires the others.

All content is bundled, so `fetch` on a chapter is served from the SW cache
after first load; there is no loading state to design around beyond a skeleton.

---

## 5. Content model

`data/index.json`

```json
{
  "version": "1.0.0",
  "app": { "zh": "油棕百科", "en": "OPWiki", "ms": "Wiki Sawit" },
  "ui": { "search": { "zh": "搜索", "en": "Search", "ms": "Cari" }, "...": {} },
  "chapters": [
    { "id": "ch01", "num": 1, "icon": "history",
      "title": { "zh": "…", "en": "…", "ms": "…" },
      "blurb": { "zh": "…", "en": "…", "ms": "…" } }
  ]
}
```

`data/chNN.json`

```json
{
  "id": "ch05",
  "num": 5,
  "title": { "zh": "…", "en": "…", "ms": "…" },
  "sections": [
    {
      "id": "5.1",
      "heading": { "zh": "…", "en": "…", "ms": "…" },
      "blocks": [
        { "type": "p",       "text": { "zh": "…", "en": "…", "ms": "…" } },
        { "type": "list",    "items": [ { "zh": "…", "en": "…", "ms": "…" } ] },
        { "type": "keyval",  "rows": [ { "k": {…}, "v": {…} } ] },
        { "type": "table",   "caption": {…}, "headers": [ {…} ], "rows": [[…]] },
        { "type": "chart",   "chart": { … see §6 … } },
        { "type": "figure",  "src": "figures/bunch-anatomy.svg", "caption": {…} },
        { "type": "note",    "kind": "tip|warn|key", "text": {…} }
      ]
    }
  ],
  "sources": [ "Oil World Annual 2013", "MPOB", "Corley & Tinker 2016" ]
}
```

Every user-visible string is a `{zh,en,ms}` triple. A missing language falls
back to `en`, then `zh`, and is logged to the console in development — a silent
blank is worse than an obviously untranslated line.

---

## 6. Charts

`charts.js` renders from a declarative spec; no chart library.

```json
{ "kind": "bar|line|stackedBar|donut|range",
  "title": {…}, "note": {…}, "source": "Oil World 2013",
  "x": { "label": {…}, "categories": ["…"] },
  "y": { "label": {…}, "unit": "t/ha" },
  "series": [ { "name": {…}, "color": "leaf", "values": [1,2,3] } ] }
```

Rules:

- Rendered as inline `<svg>` with a `viewBox` and no fixed pixel size, so it
  scales with the reading-mode font scale and the viewport.
- Colours reference palette **tokens** (`leaf`, `amber`, `bark`, …) resolved to
  CSS custom properties, so light/dark switching requires no re-render.
- Every chart carries `<title>`/`<desc>` for screen readers plus a visually
  hidden data table, so the numbers survive when the graphic does not.
- Numeric labels are drawn directly on bars/points; there are no tooltips,
  because a tooltip is useless on a phone in bright sun with gloves on.
- Source line renders beneath every chart.

Planned v1 charts (all redrawn from primary statistics):

| Chapter | Chart | Data source |
|---|---|---|
| 1 | Oil yield per hectare: palm vs soy, rapeseed, sunflower | Oil World 2013 |
| 1 | World palm oil production by country | Oil World 2013 |
| 2 | Fruit form inheritance (dura/tenera/pisifera shell) | classical genetics |
| 3 | Rainfall / temperature suitability envelope | agroclimatic zones |
| 5 | FFB yield against palm age | field-trial norms |
| 5 | Dry-matter partitioning | growth analysis |
| 11 | Bunch composition by palm age | bunch analysis |
| 12 | Nutrient removal per tonne FFB (N, P, K, Mg) | nutrient budgets |
| 15 | Fatty acid composition, palm oil vs palm kernel oil | MPOB |
| 15 | Mill mass balance, FFB → CPO + PK + EFB + POME | mill norms |
| 18 | Energy balance of palm biodiesel | energy budgets |
| 19 | Land area needed per tonne oil, by crop | Oil World 2013 |

---

## 7. Interaction design

### Language toggle
One button in the header showing the **current** language as a short glyph:
`中` → `EN` → `MY` → `中`. Each press advances one step and re-renders in
place, preserving scroll position and the open chapter. Persisted; `<html lang>`
and `<title>` update with it. Pressing it never navigates.

### Theme
Follows the OS on first run. The toggle then cycles `auto → light → dark →
auto`, so a user who overrides can get back to automatic. Icon reflects the
current state. Persisted. Implemented as `data-theme` on `<html>` with CSS
custom properties; no flash on load because the preference is applied by a
tiny inline script in `<head>` before first paint.

### Reading mode — the "AAA" button
Cycles a root `--font-scale`: `1.0 → 1.15 → 1.3 → 1.5 → 1.0`. The button's
label grows with the setting (`A` / `AA` / `AAA` / `AAAA`) so the control shows
its own state. Everything typographic is sized in `rem`-derived units off that
scale, including chart text and table cells, so the whole app grows together
rather than the body text outgrowing its containers.

At scale ≥ 1.3 the layout also drops to a single column and increases line
height — large type in a narrow multi-column layout is harder to read, not
easier.

### Search
Full-text over all three languages at once, so a user searching `Ganoderma`
finds it whether the interface is in Chinese or Malay. Results show the chapter,
the section, and a highlighted snippet. Substring match for CJK (no word
boundaries), token match for Latin scripts.

### Info screen
- "Apps created by Bryan Woo"
- QR code, generated offline by `qrcode.js`, pointing at the app URL
- The same URL as a tappable link
- Data sources and the attribution block from §2
- App version and content version
- Offline status: whether the content is fully cached

---

## 8. Offline strategy

`sw.js`, cache name versioned `opwiki-v<N>`:

1. **install** — precache the full shell: HTML, CSS, JS, `index.json`, all 20
   chapter JSONs, all figures, all icons. The app is small enough (target
   < 3 MB) to cache completely on install, so there is no partial-offline state
   to explain to the user.
2. **activate** — delete caches that do not match the current version.
3. **fetch** — cache-first for everything precached; network-only for the
   external link on the Info screen.
4. Navigation requests fall back to `index.html` so deep links work offline.

Bumping the cache version is the only step needed to ship new content. The Info
screen surfaces "update available" when a new SW is waiting, with a button to
apply it, rather than silently changing content under the reader.

---

## 9. Icons and splash

Generated from `palm-oil-2.png` with Pillow:

- `icon-192.png`, `icon-512.png` — transparent, for `manifest`
- `icon-maskable-192/512.png` — logo inset to 80 % on a leaf-green safe area,
  so Android's adaptive mask does not clip the fronds
- `apple-touch-icon-180.png` — opaque background, since iOS does not composite
  transparency
- `favicon.ico` / `favicon-32.png`
- iOS splash screens for the common device sizes, logo centred on the theme
  background, with a dark variant

`manifest.webmanifest`: `display: standalone`, `orientation: any`,
`theme_color` from the palette, `background_color` matching the splash,
`start_url: "./"`, `scope: "./"` — relative so it works on GitHub Pages under a
subpath.

---

## 10. Accessibility

- Colour contrast ≥ 4.5:1 for body text in both themes; ≥ 3:1 for chart strokes
  and UI borders. Verified, not assumed.
- Charts never rely on colour alone — series are distinguished by direct
  labels, and each chart has a hidden data table.
- Every control is a real `<button>` with an `aria-label` in the active
  language, reachable by keyboard, with a visible focus ring.
- Touch targets ≥ 44 px, which is also why the header holds four controls and
  not six.
- `prefers-reduced-motion` disables view transitions.

---

## 11. Testing

No framework; a `tests/` page that runs in the browser and reports pass/fail.

| Area | Check |
|---|---|
| i18n | every key in `index.json` and every chapter has all three languages; cycle returns to start after 3 presses |
| prefs | theme and font-scale round-trip through `localStorage`; unknown stored values fall back to defaults |
| charts | a spec with known values produces the expected SVG geometry; empty and single-point series do not throw |
| qrcode | encoded payload decodes back to the input URL |
| search | a known term is found in each of the three languages |
| content | every chapter JSON parses; every `figure.src` exists; every `chart` spec has matching series lengths |
| sw | precache list covers every file the app requests |

A content-lint script (`tools/lint-content.mjs`, run with plain `node`) runs
the content checks from the command line so a missing translation is caught
before it ships.

---

## 12. Out of scope for v1

- User accounts, sync, notes, bookmarks
- Any embedding of the source PDF
- Server-side anything
- Languages beyond the three specified

---

## 13. Build order

1. Scaffold, palette, themes, header controls, prefs — a running shell
2. Icons and splash from `palm-oil-2.png`; manifest; service worker; verify
   installable and offline
3. Content model, chapter renderer, one real chapter end to end
4. Chart renderer plus the v1 chart set
5. Original SVG figures
6. Remaining chapters, all three languages
7. Search
8. Info screen with offline QR
9. Accessibility and contrast pass; content lint; browser test page

---

## 14. As built — deviations from this spec

Five things changed while building. All are recorded here rather than quietly
folded into the sections above, so the spec stays readable as the design that
was agreed and this section carries what the work actually taught.

**A dev server was needed (`tools/serve.py`).** Not anticipated. Two browser
defaults cost real debugging time: an edited ES module keeps being served from
the disk cache unless `Cache-Control: no-store` is sent, and a service worker
script will not register over HTTP/1.0, which is the Python stdlib default. The
server sets both, plus the MIME types the stdlib gets wrong.

**Charts draw immediately as well as on resize.** §6 specified a
ResizeObserver. That alone leaves a chart blank in a background or hidden tab,
because observer callbacks are delivered with the rendering steps, which a
hidden tab does not run. `render()` now draws once synchronously with a fallback
width and lets the observer correct it.

**Content is fetched relative to the module, not the page.** `content.js`
resolves `data/` against `import.meta.url`. Page-relative paths broke as soon as
anything outside the root — the test page — imported the module, and would also
have broken under a nested deploy.

**Chart `source` accepts a translation triple.** §6 typed it as a string.
Several charts need a descriptive source rather than a citation, so it accepts
either; `charts.js` resolves it through `i18n.pick` and the linter rejects a
partial object, which previously rendered as `[object Object]`.

**Service worker registration is untested in-browser.** §11 assumed the browser
test page could cover it. The in-app browser pane refuses to register even a
two-line worker, so `tools/test-sw.mjs` runs `sw.js` in a stubbed
`ServiceWorkerGlobalScope` and exercises install, activate and fetch against a
fake network and fake Cache Storage instead. Registration itself still needs a
check from a normal browser over HTTPS.

### One bug worth recording

The QR encoder produced codes that looked perfectly plausible on screen and
decoded in nothing. The generator polynomial was built in ascending order
(constant term first) while `rsEncode` consumed it descending, so every error
correction codeword was wrong. It was found only by diffing against an
independent implementation — no amount of looking at the rendered code would
have surfaced it. Hence the verification approach: every mask of every payload
is decoded with zxing-cpp, and mask selection is scored against a separately
written implementation of the ISO 18004 penalty rules.

---

## 15. Added after the first deploy

**A first-run language picker.** §7 had the app open in Chinese and offer a
toggle. That is the wrong first impression for most of the people §1 describes,
and a toggle only helps someone who already recognises the interface. A new
reader now chooses before anything else: each option is labelled in its own
language and previews the tagline in it, because the screen is shown before any
language has been agreed. English is the default and listed first. The app bar
is hidden until the choice is made, since its controls are labelled in a
language nobody has picked. The route is untouched throughout, so a shared deep
link still lands where it pointed.

`prefs` gained `langChosen`, which is separate from the language itself:
without it there is no way to distinguish a first visit from someone who
deliberately chose English. Using the header toggle also sets it.

**Deployment moved into CI.** §8 said bumping the cache version was "the only
step needed to ship new content", which was true and also a step that would
eventually be forgotten — and forgetting it means installed copies never see the
update. `.github/workflows/deploy.yml` now lints the content, regenerates the
service worker, runs the service worker tests and deploys on every push to
`main`. GitHub Pages builds from the workflow rather than from the branch.

Verified by changing `index.html` and pushing *without* running the generator
locally: CI regenerated the cache name from `opwiki-892a5c861d` to
`opwiki-936c9276a0` and deployed with it.

**Two things the live deployment exposed that local serving could not.** The
service worker's opportunistic caching of any successful response pinned stale
copies of files outside the precache — its own script included, so an updated
worker appeared not to deploy. It was removed; the app is precached in full, so
it covered nothing that should be cached. Separately, navigations to a nested
path were served the shell, whose relative `css/` and `js/` then resolved against
the wrong depth; those now redirect to the scope root, but only when the network
is unavailable, so real sub-pages such as `tests/` stay reachable.

The iOS launch images were generated and precached from the start but never
referenced from the shell, so iOS showed a blank frame while the app started.
`index.html` now carries a line per device size and pixel ratio, in both themes.
