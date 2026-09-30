/**
 * Declarative SVG charts — no chart library, no canvas, no network.
 *
 * Two decisions shape this module:
 *
 * 1. The SVG viewBox is mapped 1:1 to the measured pixel width, so a
 *    font-size of 11 really is 11 CSS pixels. Charts are therefore redrawn
 *    on resize and when reading mode changes, via a ResizeObserver. The
 *    alternative — a fixed viewBox — makes axis labels shrink to ~7px on a
 *    phone and ignores the reading-mode setting entirely.
 * 2. Colours are CSS custom properties, never literals, so switching theme
 *    repaints without re-rendering.
 *
 * Values are labelled directly on the marks. There are no tooltips: this app
 * is used outdoors, one-handed, often in gloves.
 */

import { pick, t } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const SERIES_VARS = ['--c-1', '--c-2', '--c-3', '--c-4', '--c-5', '--c-6'];

function svgEl(tag, attrs = {}, children = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) n.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c != null) n.append(c);
  }
  return n;
}

function text(str, x, y, cls, extra = {}) {
  const n = svgEl('text', { x, y, class: cls, ...extra });
  n.textContent = str;
  return n;
}

const colorOf = (i, token) =>
  `var(${token && token.startsWith('--') ? token : SERIES_VARS[i % SERIES_VARS.length]})`;

/** Current reading-mode multiplier, so label gutters grow with the type. */
const scale = () =>
  parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--font-scale')) || 1;

/** Round to at most `d` decimals without trailing zeros. */
function fmt(v, d = 2) {
  if (v == null || Number.isNaN(v)) return '–';
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return String(r);
}

/** "Nice" axis maximum, so gridlines land on readable numbers. */
function niceMax(max) {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const n = max / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

/* --- Chart kinds --------------------------------------------------------- */

/** Horizontal bars with the label above each bar — tolerates any label length,
 *  which matters when the same chart renders in Chinese, English and Malay. */
function drawHBar(spec, w) {
  const s = scale();
  const cats = spec.x.categories;
  const vals = spec.series[0].values;
  const rowH = 40 * s;
  const barH = 15 * s;
  const padT = 4 * s;
  const padR = 46 * s;              // room for the value at the bar's end
  const h = padT + cats.length * rowH;
  const max = niceMax(Math.max(...vals.filter(Number.isFinite)));
  const trackW = w - padR;

  const g = [];
  cats.forEach((cat, i) => {
    const y = padT + i * rowH;
    const v = vals[i];
    const bw = Number.isFinite(v) ? Math.max(1, (v / max) * trackW) : 0;
    // One series means one colour: the bars are already distinguished by their
    // labels, and a different hue per row would imply a grouping that is not
    // there. A per-bar `colors` array overrides this when the categories
    // genuinely are different things.
    const token = spec.series[0].colors?.[i] ?? spec.series[0].color ?? '--c-1';
    const color = colorOf(0, token);

    g.push(text(pick(cat), 0, y + 11 * s, 'tick'));
    g.push(svgEl('rect', {
      x: 0, y: y + 16 * s, width: trackW, height: barH,
      rx: 3, fill: 'var(--grid)', opacity: .5,
    }));
    g.push(svgEl('rect', {
      x: 0, y: y + 16 * s, width: bw, height: barH, rx: 3, fill: color,
    }));
    g.push(text(fmt(v) + (spec.y.unit ? ' ' + spec.y.unit : ''),
      bw + 7 * s, y + 16 * s + barH * 0.78, 'vlab'));
  });

  return { h, nodes: g };
}

/** Grouped vertical bars across categories. */
function drawBar(spec, w) {
  const s = scale();
  const cats = spec.x.categories;
  const series = spec.series;
  const padL = 40 * s, padR = 6 * s, padT = 16 * s, padB = 34 * s;
  const h = Math.min(Math.max(w * 0.6, 190 * s), 330 * s);
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const max = niceMax(Math.max(...series.flatMap(x => x.values.filter(Number.isFinite))));

  const g = [];
  const y = v => padT + plotH - (v / max) * plotH;

  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    g.push(svgEl('line', { x1: padL, x2: w - padR, y1: y(v), y2: y(v), class: 'grid' }));
    g.push(text(fmt(v, 1), padL - 6 * s, y(v) + 4 * s, 'tick', { 'text-anchor': 'end' }));
  }

  const slot = plotW / cats.length;
  const groupW = slot * 0.72;
  const barW = groupW / series.length;

  cats.forEach((cat, ci) => {
    const x0 = padL + slot * ci + (slot - groupW) / 2;
    series.forEach((ser, si) => {
      const v = ser.values[ci];
      if (!Number.isFinite(v)) return;
      const bx = x0 + si * barW;
      g.push(svgEl('rect', {
        x: bx + barW * 0.06, y: y(v),
        width: barW * 0.88, height: Math.max(1, padT + plotH - y(v)),
        rx: 2.5, fill: colorOf(si, ser.color),
      }));
      if (series.length <= 2) {
        g.push(text(fmt(v, 1), bx + barW / 2, y(v) - 5 * s, 'vlab',
          { 'text-anchor': 'middle' }));
      }
    });
    g.push(text(pick(cat), padL + slot * ci + slot / 2, h - padB + 16 * s, 'tick',
      { 'text-anchor': 'middle' }));
  });

  g.push(svgEl('line', {
    x1: padL, x2: w - padR, y1: padT + plotH, y2: padT + plotH, class: 'ax',
  }));
  if (spec.y.label) {
    g.push(text(pick(spec.y.label), padL - 34 * s, padT - 5 * s, 'alab'));
  }
  return { h, nodes: g };
}

/** One bar per category, split into proportional parts — compositions. */
function drawStacked(spec, w) {
  const s = scale();
  const cats = spec.x.categories;
  const padL = 0, padT = 4 * s;
  const rowH = 54 * s, barH = 22 * s;
  const h = padT + cats.length * rowH;
  const g = [];

  cats.forEach((cat, ci) => {
    const yTop = padT + ci * rowH;
    const total = spec.series.reduce((a, ser) => a + (ser.values[ci] || 0), 0) || 1;
    let x = padL;
    g.push(text(pick(cat), 0, yTop + 11 * s, 'tick'));
    spec.series.forEach((ser, si) => {
      const v = ser.values[ci] || 0;
      const segW = (v / total) * w;
      if (segW <= 0) return;
      g.push(svgEl('rect', {
        x, y: yTop + 16 * s, width: Math.max(0.5, segW - 1), height: barH,
        rx: 2, fill: colorOf(si, ser.color),
      }));
      // Only label a segment wide enough to hold the number.
      if (segW > 30 * s) {
        g.push(text(fmt(v, 1), x + segW / 2, yTop + 16 * s + barH * 0.7, 'vlab',
          { 'text-anchor': 'middle', fill: '#fff', style: 'paint-order:stroke' }));
      }
      x += segW;
    });
  });
  return { h, nodes: g };
}

/** Lines over an ordered x axis — growth and yield curves. */
function drawLine(spec, w) {
  const s = scale();
  const cats = spec.x.categories;
  const padL = 40 * s, padR = 10 * s, padT = 16 * s, padB = 34 * s;
  const h = Math.min(Math.max(w * 0.58, 190 * s), 320 * s);
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const all = spec.series.flatMap(x => x.values.filter(Number.isFinite));
  const max = niceMax(Math.max(...all));

  const X = i => padL + (cats.length === 1 ? plotW / 2 : (i / (cats.length - 1)) * plotW);
  const Y = v => padT + plotH - (v / max) * plotH;

  const g = [];
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    g.push(svgEl('line', { x1: padL, x2: w - padR, y1: Y(v), y2: Y(v), class: 'grid' }));
    g.push(text(fmt(v, 1), padL - 6 * s, Y(v) + 4 * s, 'tick', { 'text-anchor': 'end' }));
  }

  spec.series.forEach((ser, si) => {
    const color = colorOf(si, ser.color);
    const pts = ser.values
      .map((v, i) => (Number.isFinite(v) ? [X(i), Y(v)] : null))
      .filter(Boolean);
    if (!pts.length) return;
    if (ser.area) {
      g.push(svgEl('path', {
        d: `M${pts[0][0]},${padT + plotH} ` +
           pts.map(p => `L${p[0]},${p[1]}`).join(' ') +
           ` L${pts.at(-1)[0]},${padT + plotH} Z`,
        fill: color, opacity: .13, stroke: 'none',
      }));
    }
    g.push(svgEl('path', {
      d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' '),
      fill: 'none', stroke: color, 'stroke-width': 2.4 * s,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
    for (const p of pts) {
      g.push(svgEl('circle', {
        cx: p[0], cy: p[1], r: 3.2 * s, fill: 'var(--surface)',
        stroke: color, 'stroke-width': 2 * s,
      }));
    }
  });

  // Label every nth category so ticks never collide.
  const every = Math.ceil(cats.length / Math.max(3, Math.floor(plotW / (44 * s))));
  cats.forEach((c, i) => {
    if (i % every && i !== cats.length - 1) return;
    g.push(text(pick(c), X(i), h - padB + 16 * s, 'tick', { 'text-anchor': 'middle' }));
  });

  g.push(svgEl('line', {
    x1: padL, x2: w - padR, y1: padT + plotH, y2: padT + plotH, class: 'ax',
  }));
  if (spec.y.label) {
    g.push(text(pick(spec.y.label), padL - 34 * s, padT - 5 * s, 'alab'));
  }
  return { h, nodes: g };
}

/** Ring showing parts of a whole. */
function drawDonut(spec, w) {
  const s = scale();
  const h = Math.min(w * 0.62, 260 * s);
  const cx = w / 2, cy = h / 2;
  const r = Math.min(cx, cy) * 0.86;
  const thick = r * 0.42;
  const vals = spec.series[0].values;
  const total = vals.reduce((a, b) => a + (b || 0), 0) || 1;

  const g = [];
  let a0 = -Math.PI / 2;
  vals.forEach((v, i) => {
    const a1 = a0 + (v / total) * Math.PI * 2;
    const rOut = r, rIn = r - thick;
    const p = (ang, rad) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
    const [x1, y1] = p(a0, rOut), [x2, y2] = p(a1, rOut);
    const [x3, y3] = p(a1, rIn), [x4, y4] = p(a0, rIn);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    g.push(svgEl('path', {
      d: `M${x1},${y1} A${rOut},${rOut} 0 ${big} 1 ${x2},${y2} ` +
         `L${x3},${y3} A${rIn},${rIn} 0 ${big} 0 ${x4},${y4} Z`,
      fill: colorOf(i, spec.series[0].colors?.[i]),
      stroke: 'var(--surface)', 'stroke-width': 2,
    }));
    if (v / total > 0.06) {
      const [lx, ly] = p((a0 + a1) / 2, r - thick / 2);
      g.push(text(`${Math.round((v / total) * 100)}%`, lx, ly + 4 * s, 'vlab',
        { 'text-anchor': 'middle', fill: '#fff' }));
    }
    a0 = a1;
  });
  return { h, nodes: g };
}

const KINDS = {
  hbar: drawHBar, bar: drawBar, stackedBar: drawStacked,
  line: drawLine, donut: drawDonut,
};

/* --- Public API ---------------------------------------------------------- */

/** A table of the same numbers, for screen readers and for when SVG fails. */
function dataTable(spec) {
  const d = document.createElement('details');
  d.className = 'chart__data';
  const sm = document.createElement('summary');
  sm.textContent = t('dataTable');
  sm.style.cssText = 'font-size:var(--step--1);color:var(--text-faint);cursor:pointer';
  const wrap = document.createElement('div');
  wrap.className = 'tablewrap';
  const tbl = document.createElement('table');
  tbl.className = 'data';

  const cell = (tag, str, scope) => {
    const c = document.createElement(tag);
    if (scope) c.scope = scope;
    c.textContent = str;
    return c;
  };

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  hr.append(cell('th', '', 'col'));
  for (const s of spec.series) hr.append(cell('th', pick(s.name), 'col'));
  thead.append(hr);

  const tbody = document.createElement('tbody');
  spec.x.categories.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.append(cell('th', pick(c), 'row'));
    for (const s of spec.series) tr.append(cell('td', fmt(s.values[i])));
    tbody.append(tr);
  });

  tbl.append(thead, tbody);
  wrap.append(tbl);
  d.append(sm, wrap);
  return d;
}

/**
 * Render a chart spec into a self-contained element.
 * Redraws itself on resize and on reading-mode changes.
 */
export function render(spec) {
  const fig = document.createElement('figure');
  fig.className = 'chart';

  if (spec.title) {
    const h = document.createElement('figcaption');
    h.className = 'chart__t';
    h.textContent = pick(spec.title);
    fig.append(h);
  }
  if (spec.note) {
    const p = document.createElement('p');
    p.className = 'chart__sub';
    p.textContent = pick(spec.note);
    fig.append(p);
  }

  const holder = document.createElement('div');
  fig.append(holder);

  const draw = () => {
    const w = Math.max(220, Math.round(holder.clientWidth || 320));
    const fn = KINDS[spec.kind] || drawBar;
    const { h, nodes } = fn(spec, w);
    const svg = svgEl('svg', {
      viewBox: `0 0 ${w} ${Math.round(h)}`,
      width: w, height: Math.round(h),
      role: 'img', 'aria-label': pick(spec.title) || 'chart',
    });
    svg.append(svgEl('title', {}, [pick(spec.title) || '']));
    if (spec.note) svg.append(svgEl('desc', {}, [pick(spec.note)]));
    for (const n of nodes) svg.append(n);
    holder.replaceChildren(svg);
  };

  // Multi-series charts need a key; a single-series chart labels itself.
  if (spec.series.length > 1) {
    const leg = document.createElement('div');
    leg.className = 'chart__legend';
    spec.series.forEach((s, i) => {
      const sp = document.createElement('span');
      const sw = document.createElement('i');
      sw.className = 'chart__sw';
      sw.style.background = colorOf(i, s.color);
      sp.append(sw, document.createTextNode(pick(s.name)));
      leg.append(sp);
    });
    fig.append(leg);
  }

  fig.append(dataTable(spec));

  if (spec.source) {
    const src = document.createElement('p');
    src.className = 'chart__src';
    // A source may be a plain string (a citation that does not translate, such
    // as "Oil World Annual 2013") or a {zh,en,ms} triple when it is descriptive.
    src.textContent = `${t('source')}: ${pick(spec.source)}`;
    fig.append(src);
  }

  // Draw once now and again whenever the width changes. The immediate draw
  // uses a fallback width, because clientWidth is 0 until the figure is in the
  // document — but it means a chart is never blank, including in a background
  // tab, where a requestAnimationFrame-based first paint would never run.
  draw();
  const ro = new ResizeObserver(draw);
  ro.observe(holder);
  fig._redraw = draw;
  return fig;
}

/** Called after a reading-mode change so label gutters are recomputed. */
export function redrawAll(root = document) {
  for (const f of root.querySelectorAll('.chart')) f._redraw?.();
}
