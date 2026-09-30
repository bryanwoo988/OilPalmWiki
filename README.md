# 油棕百科 · OPWiki · Wiki Sawit

An offline, trilingual oil palm field reference. Static PWA — no build step, no
npm dependencies, no CDN.

| | |
|---|---|
| 中文 | 油棕百科 |
| English | OPWiki |
| Bahasa Melayu | Wiki Sawit |

20 chapters, 90 sections, 16 interactive charts, all in Chinese, English and
Malay. Install it to the home screen and it works with no network at all.

---

## Run it

```bash
python3 tools/serve.py
```

Then open <http://127.0.0.1:4180/>. Tests are at `/tests/`.

The dev server exists because two defaults otherwise waste an afternoon: the
browser serves an edited ES module from its disk cache unless `Cache-Control:
no-store` is sent, and it refuses to register a service worker over HTTP/1.0.
`tools/serve.py` fixes both.

---

## Features

- **Offline.** A service worker precaches the entire app — shell, all 20
  chapters, icons, splash screens — on install. 1.4 MB total. There is no
  partial-offline state: either it installed or it did not, and the Info screen
  says which.
- **Three languages, one button.** The header glyph shows the current language
  and cycles 中 → EN → MY → 中. Switching re-renders in place and keeps your
  place in the chapter.
- **Light and dark.** Follows the OS by default; the toggle cycles auto → light
  → dark → auto, so an override can be undone. Applied before first paint, so
  there is no white flash on a dark phone.
- **Reading mode.** The AAA button cycles the text scale 100% → 115% → 130% →
  150%. Everything scales together — body text, tables, chart labels — and at
  130% and above the layout also drops to a single column with looser leading.
- **Search.** Searches all three languages at once, so `Ganoderma` is found
  whether the interface is in Chinese or Malay, and results come back in the
  language being read.
- **Charts.** 16 interactive SVG charts drawn from primary statistics. Each one
  carries a hidden data table, so the numbers survive for a screen reader or if
  the graphic fails.
- **Info screen.** Credit, an offline-generated QR code, the link, data sources
  and the offline/update status.

---

## Content and licensing

The reference PDF in this folder is *The Oil Palm*, 5th edition, Corley &
Tinker, © 2016 John Wiley & Sons — a commercial textbook currently on sale.
**None of it is reproduced here.**

| Source material | Used | Why |
|---|---|---|
| Facts, measurements, agronomic data | yes | facts are not copyrightable |
| Book prose | no | rewritten as original text |
| Book photographs and figures | no | copyrighted images; redrawn as SVG from the data |
| `palm-oil-2.png` | yes | Bryan's own asset |

Charts cite the primary source of their numbers — Oil World, MPOB, FAOSTAT —
not the textbook. The Info screen carries the full attribution.

There is also an engineering reason, independent of licensing: the book's
figures are print-screened scans. Embedding them would push the app past 50 MB,
break offline caching on a modest phone, and leave the text inside them
untranslatable and unaffected by the reading-mode scale. Redrawn SVG is smaller
and does more.

---

## Layout

```
index.html                 single page, all views
manifest.webmanifest
sw.js                      precache-everything service worker (generated block)
css/app.css                tokens, themes, type scale, layout
js/
  app.js                   boot, hash router, view rendering
  config.js                APP_URL — the one line to edit when it gets an address
  prefs.js                 language / theme / font scale, persisted
  i18n.js                  language cycle + UI string table
  content.js               chapter loading + block rendering
  charts.js                SVG chart renderer
  search.js                trilingual client-side search
  qrcode.js                offline QR encoder
data/
  index.json               chapter manifest
  ch01.json … ch20.json    trilingual content
icons/                     app icons, maskable icons, iOS splash screens
tools/                     see below
tests/                     browser test page
docs/superpowers/specs/    design spec
```

Every module owns one thing. `prefs.js` knows nothing about content,
`charts.js` does no fetching, `i18n.js` never touches the DOM, and `app.js` is
the only thing that wires them together. Content is plain JSON so it can be
edited without touching code.

---

## Tools

| Command | What it does |
|---|---|
| `python3 tools/serve.py [port]` | Dev server. No-store headers, HTTP/1.1, correct MIME types. |
| `node tools/lint-content.mjs` | Checks every chapter: all three languages present, chart series match their categories, table rows match their headers, figure files exist. |
| `node tools/build-sw.mjs` | Regenerates the service worker precache list and its cache name from a content hash. **Run after any content or code change.** |
| `node tools/test-sw.mjs` | Runs `sw.js` in a stubbed ServiceWorkerGlobalScope and exercises install, activate and fetch against a fake network. |
| `venv/bin/python tools/verify-qr.py` | Decodes every mask variant of every test payload with zxing-cpp and checks mask selection against an independent implementation of the ISO 18004 penalty rules. |
| `venv/bin/python tools/make-icons.py` | Regenerates icons and splash screens from `palm-oil-2.png`. |

The Python tools need `pymupdf pillow segno zxing-cpp opencv-python-headless numpy`
in a venv. The Node tools need nothing but Node.

---

## Adding content

1. Edit `data/chNN.json`. Every user-visible string is a `{zh, en, ms}` triple.
2. `node tools/lint-content.mjs`
3. `node tools/build-sw.mjs` — this changes the cache name, which is what makes
   existing installs pick the new content up.

Block types: `p`, `list`, `keyval`, `table`, `chart`, `figure`, `note`.
Chart kinds: `hbar`, `bar`, `stackedBar`, `line`, `donut`.

---

## Deploying

Everything is relative, so it works from a subpath. For GitHub Pages:

1. Set `APP_URL` in `js/config.js` to the published address — that one line is
   also what the QR code encodes.
2. `node tools/build-sw.mjs`
3. Push. Serve over HTTPS; a service worker will not register otherwise.

---

## Verification

| What | How | Result |
|---|---|---|
| Content | `node tools/lint-content.mjs` | 20 chapters, 90 sections, 242 blocks, 16 charts — no missing translations |
| Modules, content, search, charts | `/tests/` in a browser | 45/45 |
| Service worker | `node tools/test-sw.mjs` | 13/13 |
| QR encoder | `tools/verify-qr.py` | 64/64 mask variants decode; penalty scores match the reference |
| QR end to end | extracted the SVG the live Info screen renders and decoded it | returns the correct URL under both zxing-cpp and OpenCV |

Service worker **registration** could not be exercised in the in-app browser
pane, which refuses to register even a two-line worker; the worker's behaviour
is covered by `tools/test-sw.mjs` instead. Install it from a normal browser over
HTTPS to confirm on a real device.

---

## The process, for next time

This is the sequence these PWAs follow:

1. **Check what the source material actually is** before planning around it.
   Licensing and file size both get decided here, and both are expensive to
   revisit later.
2. **Write the spec first** — `docs/superpowers/specs/`. Intent, who it is for,
   what success looks like, then architecture and module boundaries.
3. **Assets early.** Generate icons and splash screens from the supplied logo
   with a script, not by hand, so they can be regenerated when the logo changes.
4. **Shell before content.** Get routing, theme, language and reading mode
   working against one real chapter, and look at it in a browser at phone width
   before writing nineteen more.
5. **Content as data.** JSON with `{zh, en, ms}` everywhere, and a linter that
   fails on a missing translation. A silent English fallback is worse than a
   build error.
6. **Verify, do not assume.** Anything non-obvious — a QR encoder, a service
   worker — gets checked against an independent implementation. The QR encoder
   here had a real bug (reversed Reed–Solomon generator coefficients) that
   looked completely fine on screen.
7. **Regenerate the precache and ship.**

---

Apps created by **Bryan Woo**.

Content written for this app, drawing on established oil palm agronomy.
Principal reference: R.H.V. Corley & P.B. Tinker, *The Oil Palm*, 5th ed.,
Wiley-Blackwell, 2016. Statistical data from Oil World, MPOB and FAOSTAT.
