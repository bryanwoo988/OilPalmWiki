/* reader.js — highlight, underline, notes, bookmarks and read-aloud.

   Shared by Oil Palm Basics (SawitBasics) and OPWiki. Keep both copies
   identical: anything app-specific comes in through Reader.init(options).

   The unit of marking is a block — a paragraph, a list item, a table row, a
   callout — not a run of characters. Every block exists in all three
   languages with the same key, so a highlight made in 中文 is still on the
   same paragraph after switching to English or BM. Character ranges would
   only survive in the language they were made in.

   Reader.init({
     app:    "opb",                     // storage prefix
     root:   () => Element,             // where the content is
     units:  "css selector",            // markable blocks; each must carry data-rk
     lang:   () => "en" | "zh" | "ms",
     where:  (unitEl) => string,        // "Chapter · Topic" label for lists
     open:   (key) => void,             // take the reader to a saved block
     next:   async () => boolean,       // optional: load the next chapter for read-aloud
     toast:  (msg) => void,
     onState: (listening) => void,      // optional: read-aloud started / stopped
     topOffset: () => number,           // optional: height covered by a sticky header
   })
*/
(function () {
  "use strict";

  const COLORS = ["yellow", "green", "blue", "pink", "orange"];
  const RATES = [0.7, 0.85, 1, 1.15, 1.3];

  const S = {
    hl:        { zh: "荧光笔", en: "Highlight", ms: "Serlah" },
    ul:        { zh: "下划线", en: "Underline", ms: "Garis bawah" },
    note:      { zh: "笔记", en: "Note", ms: "Nota" },
    bookmark:  { zh: "书签", en: "Bookmark", ms: "Penanda" },
    unbookmark:{ zh: "取消书签", en: "Remove bookmark", ms: "Buang penanda" },
    read:      { zh: "朗读", en: "Read aloud", ms: "Baca kuat" },
    copy:      { zh: "复制", en: "Copy", ms: "Salin" },
    clear:     { zh: "清除", en: "Clear", ms: "Padam" },
    done:      { zh: "完成", en: "Done", ms: "Selesai" },
    save:      { zh: "保存", en: "Save", ms: "Simpan" },
    cancel:    { zh: "取消", en: "Cancel", ms: "Batal" },
    del:       { zh: "删除", en: "Delete", ms: "Padam" },
    close:     { zh: "关闭", en: "Close", ms: "Tutup" },
    notePh:    { zh: "写下你的笔记…", en: "Write your note…", ms: "Tulis nota anda…" },
    noteTitle: { zh: "笔记", en: "Note", ms: "Nota" },
    saved:     { zh: "笔记已保存", en: "Note saved", ms: "Nota disimpan" },
    deleted:   { zh: "笔记已删除", en: "Note deleted", ms: "Nota dipadam" },
    bmAdded:   { zh: "已加入书签", en: "Bookmarked", ms: "Ditanda" },
    bmRemoved: { zh: "已移除书签", en: "Bookmark removed", ms: "Penanda dibuang" },
    copied:    { zh: "已复制", en: "Copied", ms: "Disalin" },
    copyFail:  { zh: "无法复制", en: "Could not copy", ms: "Tidak dapat menyalin" },
    tapHint:   { zh: "点一下段落即可画线、做笔记或加书签", en: "Tap a paragraph to highlight, add a note or bookmark it", ms: "Ketik perenggan untuk serlah, tambah nota atau tanda" },
    notes:     { zh: "笔记", en: "Notes", ms: "Nota" },
    marks:     { zh: "画线", en: "Highlights", ms: "Serlahan" },
    bookmarks: { zh: "书签", en: "Bookmarks", ms: "Penanda" },
    emptyNotes:{ zh: "还没有笔记。点一下任何段落，再按「笔记」。", en: "No notes yet. Tap any paragraph, then Note.", ms: "Belum ada nota. Ketik mana-mana perenggan, kemudian Nota." },
    emptyMarks:{ zh: "还没有画线。点一下段落，选荧光笔或下划线和颜色。", en: "Nothing highlighted yet. Tap a paragraph, then pick Highlight or Underline and a colour.", ms: "Belum ada serlahan. Ketik perenggan, kemudian pilih Serlah atau Garis bawah dan warna." },
    emptyBm:   { zh: "还没有书签。点一下段落，再按「书签」。", en: "No bookmarks yet. Tap a paragraph, then Bookmark.", ms: "Belum ada penanda. Ketik perenggan, kemudian Penanda." },
    confirmDel:{ zh: "删除这条笔记？", en: "Delete this note?", ms: "Padam nota ini?" },
    remove:    { zh: "移除", en: "Remove", ms: "Buang" },
    yellow:    { zh: "黄色", en: "Yellow", ms: "Kuning" },
    green:     { zh: "绿色", en: "Green", ms: "Hijau" },
    blue:      { zh: "蓝色", en: "Blue", ms: "Biru" },
    pink:      { zh: "粉色", en: "Pink", ms: "Merah jambu" },
    orange:    { zh: "橙色", en: "Orange", ms: "Oren" },
    // read aloud
    ttsNone:   { zh: "这台设备的浏览器不支持朗读", en: "This browser cannot read aloud", ms: "Pelayar ini tidak boleh membaca kuat" },
    ttsNothing:{ zh: "先展开一个主题，或点一下要开始朗读的段落", en: "Open a topic first, or tap the paragraph to start from", ms: "Buka satu topik dahulu, atau ketik perenggan untuk mula" },
    ttsEnd:    { zh: "朗读完毕", en: "Finished reading", ms: "Selesai dibaca" },
    ttsNoVoice:{ zh: "手机里没有这个语言的朗读声音，会用系统默认的声音。可在手机「设置 → 文字转语音」下载。",
                 en: "No voice for this language on this phone, so the default voice is used. You can download one in the phone's Settings → Text-to-speech.",
                 ms: "Tiada suara untuk bahasa ini dalam telefon, jadi suara lalai digunakan. Muat turun suara di Tetapan → Teks-ke-pertuturan." },
    pause:     { zh: "暂停", en: "Pause", ms: "Jeda" },
    play:      { zh: "继续", en: "Play", ms: "Main" },
    prev:      { zh: "上一段", en: "Previous paragraph", ms: "Perenggan sebelum" },
    nextP:     { zh: "下一段", en: "Next paragraph", ms: "Perenggan seterusnya" },
    stop:      { zh: "停止朗读", en: "Stop reading", ms: "Henti membaca" },
    speed:     { zh: "语速", en: "Speed", ms: "Kelajuan" },
    voice:     { zh: "朗读声音", en: "Voice", ms: "Suara" },
    voiceAuto: { zh: "自动选择", en: "Automatic", ms: "Automatik" },
    voiceTest: { zh: "试听", en: "Test", ms: "Uji" },
    voiceSample:{ zh: "油棕是马来西亚最重要的经济作物之一。", en: "Oil palm is one of Malaysia's most important crops.", ms: "Kelapa sawit ialah salah satu tanaman terpenting di Malaysia." },
    readAloud: { zh: "朗读", en: "Read aloud", ms: "Baca kuat" },
    // backup
    backup:    { zh: "笔记备份", en: "Notes backup", ms: "Sandaran nota" },
    backupHint:{ zh: "笔记、画线和书签只存在这台手机里。换手机或清除浏览器资料前，先导出一份。",
                 en: "Notes, highlights and bookmarks are stored only on this phone. Export a copy before changing phones or clearing browser data.",
                 ms: "Nota, serlahan dan penanda hanya disimpan dalam telefon ini. Eksport salinan sebelum menukar telefon atau memadam data pelayar." },
    exportB:   { zh: "导出", en: "Export", ms: "Eksport" },
    importB:   { zh: "导入", en: "Import", ms: "Import" },
    imported:  { zh: "已导入", en: "Imported", ms: "Diimport" },
    badFile:   { zh: "这不是本 App 的备份文件", en: "That is not a backup from this app", ms: "Itu bukan fail sandaran aplikasi ini" },
  };

  const ICON = {
    note: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    bm: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    read: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    clear: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 5v14M19 5L9 12l10 7z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  let cfg = null;
  let data = { marks: {}, notes: {}, bookmarks: {}, settings: { rate: 1, voice: {} } };
  const selected = new Set();       // keys
  let mode = "hl";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const lang = () => (cfg && cfg.lang()) || "en";
  const t = (k) => { const v = S[k]; return v ? (v[lang()] || v.en) : k; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const toast = (m) => cfg && cfg.toast && cfg.toast(m);

  /* ---------------- storage ---------------- */

  const storeKey = () => cfg.app + ".reader";

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey()) || "{}");
      data.marks = raw.marks || {};
      data.notes = raw.notes || {};
      data.bookmarks = raw.bookmarks || {};
      data.settings = Object.assign({ rate: 1, voice: {} }, raw.settings || {});
    } catch (e) { /* private mode or corrupt: start empty */ }
  }

  function persist() {
    try { localStorage.setItem(storeKey(), JSON.stringify(data)); }
    catch (e) { /* full or private mode: works for this session only */ }
  }

  /* ---------------- painting marks onto blocks ---------------- */

  const root = () => cfg.root();
  const units = () => { const r = root(); return r ? $$(cfg.units, r) : []; };
  const unitOf = (key) => { const r = root(); return r ? r.querySelector('[data-rk="' + CSS.escape(key) + '"]') : null; };

  /* How a block takes colour:
     row  — table rows and key/value pairs: cell by cell;
     card — blocks with block-level children (cards, callouts): tinted whole;
     ink  — plain text (paragraphs, list items): the text is wrapped once, so
            the colour follows the lines the way a highlighter pen does. */
  function kindOf(u) {
    if (u.tagName === "TR" || getComputedStyle(u).display === "contents") return "row";
    const blocky = Array.from(u.children).some((c) =>
      !c.classList.contains("rd-ink") && !c.classList.contains("rd-badges") &&
      /^(block|flex|grid|table|list-item|flow-root)$/.test(getComputedStyle(c).display));
    return blocky ? "card" : "ink";
  }
  const isRowLike = (u) => kindOf(u) === "row";

  /* the text a block reads as — without our badges */
  function textOf(u) {
    if (!u) return "";
    const c = u.cloneNode(true);
    $$(".rd-badges", c).forEach((b) => b.remove());
    if (isRowLike(u)) return Array.from(c.children).map((x) => x.textContent.trim()).filter(Boolean).join(" — ");
    // blocks inside a card read as separate phrases, not one run-on word
    $$("div, p, li, span.lab, dt, dd", c).forEach((x) => x.append(" "));
    return c.textContent.replace(/\s+/g, " ").trim();
  }

  function badgeHost(u, kind) {
    if (kind === "row") return u.lastElementChild || u;
    if (kind === "card") return u.lastElementChild || u;
    return $(":scope > .rd-ink", u) || u;
  }

  function paint(u) {
    const key = u.dataset.rk;
    const m = data.marks[key];
    const note = data.notes[key];
    const bm = data.bookmarks[key];

    let ink = $(":scope > .rd-ink", u);
    if (ink) {                       // start from the plain block every time
      while (ink.firstChild) u.insertBefore(ink.firstChild, ink);
      ink.remove();
      ink = null;
    }
    $$(".rd-badges", u).forEach((b) => b.remove());
    const kind = kindOf(u);
    if (m && kind === "ink") {
      ink = document.createElement("span");
      ink.className = "rd-ink";
      while (u.firstChild) ink.appendChild(u.firstChild);
      u.appendChild(ink);
    }
    const target = kind === "ink" ? ink : u;
    u.classList.toggle("rd-row", kind === "row");
    u.classList.toggle("rd-card", kind === "card");
    delete u.dataset.hl;
    delete u.dataset.ul;
    if (m && target) {
      if (m.hl) target.dataset.hl = m.hl;
      if (m.ul) target.dataset.ul = m.ul;
    }

    if (note || bm) {
      const b = document.createElement("span");
      b.className = "rd-badges";
      if (bm) b.insertAdjacentHTML("beforeend", '<span class="rd-bm" aria-label="' + esc(t("bookmark")) + '">' + ICON.bm + "</span>");
      if (note) b.insertAdjacentHTML("beforeend", '<button type="button" class="rd-nb" aria-label="' + esc(t("note")) + '">' + ICON.note + "</button>");
      badgeHost(u, kind).appendChild(b);
    }
    u.classList.toggle("rd-sel", selected.has(key));
  }

  /* Called by the app after every render. Also refreshes the saved snippet
     and location label, so lists follow the reader's current language. */
  function refresh() {
    if (!cfg) return;
    selected.clear();
    hideBar();
    let changed = false;
    units().forEach((u) => {
      paint(u);
      const k = u.dataset.rk;
      for (const bag of [data.marks, data.notes, data.bookmarks]) {
        const it = bag[k];
        if (!it) continue;
        const q = textOf(u).slice(0, 240), w = cfg.where(u) || "";
        if (it.q !== q || it.w !== w) { it.q = q; it.w = w; changed = true; }
      }
    });
    if (changed) persist();
    if (tts.on) relocateReading();
  }

  /* ---------------- selecting blocks ---------------- */

  function onClick(e) {
    if (!cfg) return;
    const r = root();
    if (!r || !r.contains(e.target)) return;
    const nb = e.target.closest(".rd-nb");
    if (nb) {
      e.preventDefault();
      const u = nb.closest("[data-rk]");
      if (u) openNote([u.dataset.rk]);
      return;
    }
    if (e.target.closest("a, button, input, select, textarea, summary, label, img, svg, video, .chart, canvas")) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;          // the reader is selecting text to copy
    const u = e.target.closest(cfg.units);
    if (!u || !u.dataset.rk || !r.contains(u)) return;
    if (tts.on && !selected.size) {             // while listening, a tap moves the reading there
      ttsJumpTo(u);
      return;
    }
    toggle(u);
  }

  function toggle(u) {
    const k = u.dataset.rk;
    if (selected.has(k)) selected.delete(k); else selected.add(k);
    u.classList.toggle("rd-sel", selected.has(k));
    updateBar();
  }

  function clearSelection() {
    selected.clear();
    $$(".rd-sel").forEach((n) => n.classList.remove("rd-sel"));
    updateBar();
  }

  /* selected keys in reading order */
  function selectedKeys() {
    const order = units().map((u) => u.dataset.rk);
    return Array.from(selected).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  /* ---------------- action bar ---------------- */

  let bar = null;

  function buildBar() {
    bar = document.createElement("div");
    bar.className = "rd-bar";
    bar.hidden = true;
    bar.setAttribute("role", "toolbar");
    document.body.appendChild(bar);
    bar.addEventListener("mousedown", (e) => e.preventDefault());
    bar.addEventListener("click", onBarClick);
  }

  function renderBar() {
    const keys = selectedKeys();
    const allBm = keys.length && keys.every((k) => data.bookmarks[k]);
    const cur = keys.length === 1 && data.marks[keys[0]] ? data.marks[keys[0]][mode] : null;
    bar.innerHTML =
      '<div class="rd-row1">' +
        '<div class="rd-seg">' +
          '<button type="button" data-mode="hl" class="' + (mode === "hl" ? "on" : "") + '">' + esc(t("hl")) + "</button>" +
          '<button type="button" data-mode="ul" class="' + (mode === "ul" ? "on" : "") + '">' + esc(t("ul")) + "</button>" +
        "</div>" +
        '<div class="rd-colors">' + COLORS.map((c) =>
          '<button type="button" data-c="' + c + '" class="rd-c-' + c + (c === cur ? " on" : "") + '" aria-label="' + esc(t(c)) + '"></button>').join("") +
        "</div>" +
      "</div>" +
      '<div class="rd-row2">' +
        btn("note", ICON.note, t("note")) +
        btn("bookmark", ICON.bm, t(allBm ? "unbookmark" : "bookmark"), allBm ? "on" : "") +
        btn("read", ICON.read, t("read")) +
        btn("copy", ICON.copy, t("copy")) +
        btn("clear", ICON.clear, t("clear")) +
        '<button type="button" data-act="done" class="rd-done">' + esc(t("done")) + "</button>" +
      "</div>";
  }

  const btn = (act, icon, label, cls) =>
    '<button type="button" data-act="' + act + '" class="' + (cls || "") + '">' + icon + "<span>" + esc(label) + "</span></button>";

  function updateBar() {
    if (!bar) return;
    const on = selected.size > 0;
    bar.hidden = !on;
    document.documentElement.classList.toggle("rd-selecting", on);
    if (on) renderBar();
  }

  function hideBar() {
    if (!bar) return;
    bar.hidden = true;
    document.documentElement.classList.remove("rd-selecting");
  }

  async function onBarClick(e) {
    const m = e.target.closest("[data-mode]");
    if (m) { mode = m.dataset.mode; renderBar(); return; }
    const c = e.target.closest("[data-c]");
    if (c) { applyColor(c.dataset.c); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const keys = selectedKeys();
    switch (a.dataset.act) {
      case "note":
        openNote(keys);
        break;
      case "bookmark": {
        const add = !keys.every((k) => data.bookmarks[k]);
        keys.forEach((k) => {
          if (add) data.bookmarks[k] = stamp(k);
          else delete data.bookmarks[k];
        });
        persist();
        repaint(keys);
        toast(t(add ? "bmAdded" : "bmRemoved"));
        clearSelection();
        break;
      }
      case "read": {
        const first = unitOf(keys[0]);
        clearSelection();
        ttsStart(first);
        break;
      }
      case "copy": {
        const text = keys.map((k) => textOf(unitOf(k))).join("\n\n");
        const u = unitOf(keys[0]);
        const where = u ? cfg.where(u) : "";
        try {
          await navigator.clipboard.writeText(text + (where ? "\n— " + where : ""));
          toast(t("copied"));
        } catch (err) { toast(t("copyFail")); }
        clearSelection();
        break;
      }
      case "clear":
        keys.forEach((k) => delete data.marks[k]);
        persist();
        repaint(keys);
        clearSelection();
        break;
      case "done":
        clearSelection();
    }
  }

  /* a saved item remembers what it said and where it was, for the lists */
  function stamp(k, extra) {
    const u = unitOf(k);
    return Object.assign({ t: Date.now(), q: textOf(u).slice(0, 240), w: u ? cfg.where(u) : "" }, extra || {});
  }

  function applyColor(color) {
    const keys = selectedKeys();
    // Tapping the colour every selected block already has takes it off again.
    const remove = keys.every((k) => data.marks[k] && data.marks[k][mode] === color);
    keys.forEach((k) => {
      const m = Object.assign({}, data.marks[k] || {});
      if (remove) delete m[mode]; else m[mode] = color;
      if (m.hl || m.ul) data.marks[k] = Object.assign(stamp(k), { hl: m.hl, ul: m.ul });
      else delete data.marks[k];
      if (!data.marks[k]) return;
      if (!data.marks[k].hl) delete data.marks[k].hl;
      if (!data.marks[k].ul) delete data.marks[k].ul;
    });
    persist();
    repaint(keys);
    clearSelection();
  }

  function repaint(keys) {
    keys.forEach((k) => { const u = unitOf(k); if (u) paint(u); });
  }

  /* ---------------- bottom sheet (notes) ---------------- */

  let sheet = null;

  function openSheet(title, html) {
    closeSheet();
    sheet = document.createElement("div");
    sheet.className = "rd-scrim";
    sheet.innerHTML =
      '<section class="rd-sheet" role="dialog" aria-modal="true">' +
        '<header class="rd-sheet-head"><h2>' + esc(title) + '</h2>' +
        '<button type="button" class="rd-x" aria-label="' + esc(t("close")) + '">' + ICON.x + "</button></header>" +
        '<div class="rd-sheet-body">' + html + "</div>" +
      "</section>";
    document.body.appendChild(sheet);
    document.documentElement.classList.add("rd-sheet-open");
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.closest(".rd-x")) closeSheet();
    });
    return $(".rd-sheet-body", sheet);
  }

  function closeSheet() {
    if (sheet) sheet.remove();
    sheet = null;
    document.documentElement.classList.remove("rd-sheet-open");
  }

  /* One note per block. Several blocks selected: the note goes on the first,
     and quotes all of them so it still reads in context. */
  function openNote(keys) {
    const k = keys[0];
    const u = unitOf(k);
    const existing = data.notes[k];
    const quote = keys.map((x) => textOf(unitOf(x))).join(" ") || (existing && existing.q) || "";
    const where = u ? cfg.where(u) : (existing && existing.w) || "";
    const body = openSheet(t("noteTitle"),
      (where ? '<div class="rd-where">' + esc(where) + "</div>" : "") +
      '<blockquote class="rd-quote">' + esc(quote.length > 400 ? quote.slice(0, 400) + "…" : quote) + "</blockquote>" +
      '<textarea class="rd-input" rows="5" placeholder="' + esc(t("notePh")) + '">' + esc(existing ? existing.text : "") + "</textarea>" +
      '<div class="rd-actions">' +
        (existing ? '<button type="button" class="rd-btn rd-danger" data-do="del">' + esc(t("del")) + "</button>" : "") +
        '<button type="button" class="rd-btn" data-do="cancel">' + esc(t("cancel")) + "</button>" +
        '<button type="button" class="rd-btn rd-primary" data-do="save">' + esc(t("save")) + "</button>" +
      "</div>");
    const ta = $("textarea", body);
    setTimeout(() => ta.focus(), 60);
    body.addEventListener("click", (e) => {
      const d = e.target.closest("[data-do]");
      if (!d) return;
      if (d.dataset.do === "cancel") return closeSheet();
      const text = d.dataset.do === "save" ? ta.value.trim() : "";
      if (text) data.notes[k] = Object.assign(stamp(k), { text: text, q: quote.slice(0, 240) });
      else delete data.notes[k];
      persist();
      repaint([k]);
      closeSheet();
      clearSelection();
      toast(t(text ? "saved" : "deleted"));
      if (onChange) onChange();
    });
  }

  let onChange = null;   // the list page re-draws itself when a note changes

  /* ---------------- lists: notes, highlights, bookmarks ---------------- */

  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleDateString({ zh: "zh-CN", en: "en-GB", ms: "ms-MY" }[lang()] || "en-GB",
        { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return new Date(ts).toISOString().slice(0, 10); }
  }

  /* kind: "notes" | "marks" | "bookmarks" */
  function renderList(container, kind) {
    const bag = kind === "notes" ? data.notes : kind === "marks" ? data.marks : data.bookmarks;
    const items = Object.keys(bag).map((k) => Object.assign({ k: k }, bag[k])).sort((a, b) => (b.t || 0) - (a.t || 0));
    if (!items.length) {
      container.innerHTML = '<p class="rd-empty">' + esc(t(kind === "notes" ? "emptyNotes" : kind === "marks" ? "emptyMarks" : "emptyBm")) + "</p>";
      return;
    }
    container.innerHTML = '<ul class="rd-list">' + items.map((it) => {
      const color = it.hl || it.ul;
      const dot = kind === "marks"
        ? '<span class="rd-dot rd-c-' + esc(color) + (it.hl ? "" : " rd-dot-ul") + '"></span>'
        : kind === "bookmarks" ? '<span class="rd-dot-ico">' + ICON.bm + "</span>" : "";
      return '<li><button type="button" class="rd-item" data-k="' + esc(it.k) + '">' +
          '<span class="rd-item-top">' + dot + '<span class="rd-item-where">' + esc(it.w || "") + "</span>" +
          '<span class="rd-item-date">' + esc(fmtDate(it.t)) + "</span></span>" +
          '<span class="rd-item-q">' + esc(it.q || "") + "</span>" +
          (kind === "notes" ? '<span class="rd-item-note">' + esc(it.text) + "</span>" : "") +
        "</button>" +
        '<button type="button" class="rd-item-del" data-del="' + esc(it.k) + '" aria-label="' + esc(t("remove")) + '">' + ICON.x + "</button></li>";
    }).join("") + "</ul>";
    container.onclick = (e) => {
      const del = e.target.closest("[data-del]");
      if (del) {
        const k = del.dataset.del;
        if (kind === "notes" && !window.confirm(t("confirmDel"))) return;
        delete bag[k];
        persist();
        repaint([k]);
        renderList(container, kind);
        return;
      }
      const it = e.target.closest("[data-k]");
      if (it) cfg.open(it.dataset.k);
    };
  }

  function counts() {
    return { notes: Object.keys(data.notes).length, marks: Object.keys(data.marks).length, bookmarks: Object.keys(data.bookmarks).length };
  }

  /* Bring a saved block on screen: open what it sits in, scroll, flash. */
  function reveal(key) {
    const u = unitOf(key);
    if (!u) return false;
    const d = u.closest("details");
    if (d && !d.open) d.open = true;
    u.scrollIntoView({ behavior: "smooth", block: "center" });
    u.classList.remove("rd-flash");
    void u.offsetWidth;
    u.classList.add("rd-flash");
    setTimeout(() => u.classList.remove("rd-flash"), 1800);
    return true;
  }

  /* ---------------- read aloud ---------------- */

  const synth = window.speechSynthesis;
  const tts = { on: false, playing: false, key: null, parts: [], part: 0, token: 0, wake: null, warned: {} };
  let player = null;

  const LANG_RE = { zh: /^(zh|cmn)/i, en: /^en/i, ms: /^(ms|zsm)/i };
  const FALLBACK_RE = { ms: /^(id|in)[-_]/i };     // Indonesian is the nearest voice most phones have
  const BCP = { zh: "zh-CN", en: "en-GB", ms: "ms-MY" };

  function voicesFor(l) {
    if (!synth) return [];
    const all = synth.getVoices();
    const own = all.filter((v) => LANG_RE[l].test(v.lang));
    const near = FALLBACK_RE[l] ? all.filter((v) => FALLBACK_RE[l].test(v.lang)) : [];
    const rank = (v) => {
      let r = 0;
      if (l === "zh" && /TW|HK|yue/i.test(v.lang)) r += 2;
      if (l === "en" && !/GB|MY|SG|US/i.test(v.lang)) r += 1;
      if (/Google|Siri|Premium|Enhanced|Microsoft/i.test(v.name)) r -= 1;
      return r;
    };
    return own.sort((a, b) => rank(a) - rank(b)).concat(near);
  }

  function pickVoice(l) {
    const want = data.settings.voice && data.settings.voice[l];
    const list = voicesFor(l);
    return (want && list.find((v) => v.voiceURI === want)) || list[0] || null;
  }

  /* Short pieces: Chrome stops long utterances partway through, and a pause
     between sentences keeps the reading position honest. */
  function chunks(text) {
    const out = [];
    const sentences = text.match(/[^。！？；.!?;]+[。！？；.!?;]*\s*/g) || [text];
    let buf = "";
    sentences.forEach((s) => {
      if ((buf + s).length > 180 && buf) { out.push(buf.trim()); buf = ""; }
      buf += s;
      while (buf.length > 220) { out.push(buf.slice(0, 200)); buf = buf.slice(200); }
    });
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /* blocks in reading order that are not inside something hidden on purpose */
  function readable() {
    return units().filter((u) => !u.closest("[hidden]"));
  }

  function firstOnScreen() {
    const top = (cfg.topOffset ? cfg.topOffset() : 0) + 8;
    // Chrome gives closed <details> content boxes too, so rule those out by hand
    const shown = readable().filter((u) => u.getClientRects().length && !u.closest("details:not([open])"));
    return shown.find((u) => u.getBoundingClientRect().bottom > top) || null;
  }

  function ttsStart(fromUnit) {
    if (!synth) { toast(t("ttsNone")); return; }
    const u = fromUnit || firstOnScreen();
    if (!u) { toast(t("ttsNothing")); return; }
    synth.cancel();
    tts.on = true;
    tts.playing = true;
    loadUnit(u);
    keepAwake(true);
    updatePlayer();
    speak();
  }

  function loadUnit(u) {
    tts.key = u.dataset.rk;
    tts.parts = chunks(textOf(u));
    tts.part = 0;
    markReading(u);
  }

  function markReading(u) {
    $$(".rd-reading").forEach((n) => n.classList.remove("rd-reading"));
    if (!u) return;
    const d = u.closest("details");
    if (d && !d.open) d.open = true;
    u.classList.add("rd-reading");
    if (!sheet && !selected.size) u.scrollIntoView({ behavior: "smooth", block: "center" });
    updatePlayer();
  }

  function relocateReading() {
    const u = tts.key && unitOf(tts.key);
    if (u) u.classList.add("rd-reading");
  }

  function speak() {
    if (!tts.on || !tts.playing) return;
    if (tts.part >= tts.parts.length) return advance(1);
    const l = lang();
    const u = new SpeechSynthesisUtterance(tts.parts[tts.part]);
    const v = pickVoice(l);
    if (v) { u.voice = v; u.lang = v.lang; }
    else {
      u.lang = BCP[l];
      if (synth.getVoices().length && !tts.warned[l]) { tts.warned[l] = true; toast(t("ttsNoVoice")); }
    }
    u.rate = data.settings.rate || 1;
    const token = ++tts.token;
    u.onend = () => { if (token === tts.token && tts.playing) { tts.part++; speak(); } };
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled" || token !== tts.token) return;
      tts.part++;
      speak();
    };
    synth.speak(u);
  }

  async function advance(step) {
    const list = readable();
    const i = list.findIndex((u) => u.dataset.rk === tts.key);
    const n = list[i + step];
    if (n) { loadUnit(n); return speak(); }
    if (step > 0 && cfg.next) {
      const token = tts.token;
      const more = await cfg.next();
      if (more && tts.on && token === tts.token) {
        const first = readable()[0];
        if (first) { loadUnit(first); return speak(); }
      }
    }
    if (step > 0) { ttsStop(); toast(t("ttsEnd")); }
  }

  function ttsJump(step) {
    tts.token++;
    synth.cancel();
    const list = readable();
    const i = list.findIndex((u) => u.dataset.rk === tts.key);
    const n = list[Math.max(0, i + step)];
    if (!n) return;
    loadUnit(n);
    if (tts.playing) setTimeout(speak, 60);
  }

  function ttsJumpTo(u) {
    tts.token++;
    synth.cancel();
    loadUnit(u);
    tts.playing = true;
    keepAwake(true);
    updatePlayer();
    setTimeout(speak, 60);
  }

  function ttsPause() {
    tts.playing = false;
    tts.token++;
    synth.cancel();
    keepAwake(false);
    updatePlayer();
  }

  function ttsResume() {
    tts.playing = true;
    tts.part = 0;               // restart the paragraph: resume() is unreliable on phones
    keepAwake(true);
    updatePlayer();
    speak();
  }

  function ttsStop() {
    if (!tts.on) return;
    tts.on = tts.playing = false;
    tts.token++;
    if (synth) synth.cancel();
    keepAwake(false);
    $$(".rd-reading").forEach((n) => n.classList.remove("rd-reading"));
    updatePlayer();
  }

  async function keepAwake(on) {
    try {
      if (on && !tts.wake && navigator.wakeLock) tts.wake = await navigator.wakeLock.request("screen");
      if (!on && tts.wake) { await tts.wake.release(); tts.wake = null; }
    } catch (e) { /* not allowed here: the screen may dim, reading still works */ }
  }

  function buildPlayer() {
    player = document.createElement("div");
    player.className = "rd-player";
    player.hidden = true;
    document.body.appendChild(player);
    player.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pl]");
      if (!b) return;
      switch (b.dataset.pl) {
        case "play": tts.playing ? ttsPause() : ttsResume(); break;
        case "prev": ttsJump(-1); break;
        case "next": ttsJump(1); break;
        case "stop": ttsStop(); break;
        case "speed": {
          const i = RATES.indexOf(data.settings.rate);
          data.settings.rate = RATES[(i + 1) % RATES.length];
          persist();
          updatePlayer();
          if (tts.playing) { tts.token++; synth.cancel(); setTimeout(speak, 60); }
          break;
        }
        case "where": { const u = unitOf(tts.key); if (u) u.scrollIntoView({ behavior: "smooth", block: "center" }); }
      }
    });
  }

  function updatePlayer() {
    if (!player) return;
    player.hidden = !tts.on;
    document.documentElement.classList.toggle("rd-playing", tts.on);
    if (cfg.onState) cfg.onState(tts.on);
    if (!tts.on) return;
    const u = unitOf(tts.key);
    const where = u ? cfg.where(u) : "";
    player.innerHTML =
      '<button type="button" class="rd-pl-where" data-pl="where">' + esc(where) + "</button>" +
      '<div class="rd-pl-ctrl">' +
        '<button type="button" data-pl="speed" class="rd-pl-speed" aria-label="' + esc(t("speed")) + '">' + (data.settings.rate || 1) + "×</button>" +
        '<button type="button" data-pl="prev" aria-label="' + esc(t("prev")) + '">' + ICON.prev + "</button>" +
        '<button type="button" data-pl="play" class="rd-pl-big" aria-label="' + esc(t(tts.playing ? "pause" : "play")) + '">' + (tts.playing ? ICON.pause : ICON.play) + "</button>" +
        '<button type="button" data-pl="next" aria-label="' + esc(t("nextP")) + '">' + ICON.next + "</button>" +
        '<button type="button" data-pl="stop" aria-label="' + esc(t("stop")) + '">' + ICON.stop + "</button>" +
      "</div>";
  }

  /* bottom-nav button: start from what is on screen, or stop */
  function listen() {
    if (tts.on) ttsStop();
    else ttsStart(selected.size ? unitOf(selectedKeys()[0]) : null);
  }

  /* ---------------- settings: voice, speed, backup ---------------- */

  function renderSettings(container) {
    const l = lang();
    const voices = voicesFor(l);
    const want = data.settings.voice && data.settings.voice[l];
    container.innerHTML =
      '<div class="rd-set">' +
        '<div class="rd-set-row"><span>' + esc(t("speed")) + '</span><div class="rd-seg rd-rates">' +
          RATES.map((r) => '<button type="button" data-rate="' + r + '" class="' + (r === data.settings.rate ? "on" : "") + '">' + r + "×</button>").join("") +
        "</div></div>" +
        '<div class="rd-set-row"><span>' + esc(t("voice")) + '</span>' +
          '<select class="rd-voice"><option value="">' + esc(t("voiceAuto")) + "</option>" +
          voices.map((v) => '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === want ? " selected" : "") + ">" + esc(v.name + " (" + v.lang + ")") + "</option>").join("") +
          "</select>" +
          '<button type="button" class="rd-btn rd-test">' + esc(t("voiceTest")) + "</button>" +
        "</div>" +
        (synth ? "" : '<p class="rd-hint">' + esc(t("ttsNone")) + "</p>") +
        '<h3 class="rd-set-h">' + esc(t("backup")) + "</h3>" +
        '<p class="rd-hint">' + esc(t("backupHint")) + "</p>" +
        '<div class="rd-set-row"><button type="button" class="rd-btn rd-export">' + esc(t("exportB")) + "</button>" +
        '<label class="rd-btn rd-import">' + esc(t("importB")) + '<input type="file" accept="application/json,.json" hidden></label></div>' +
      "</div>";

    // Voices arrive late on Chrome; draw again once the list is known.
    if (synth && !voices.length && !container.dataset.waited) {
      container.dataset.waited = "1";
      synth.addEventListener("voiceschanged", () => renderSettings(container), { once: true });
    }

    $$("[data-rate]", container).forEach((b) => b.addEventListener("click", () => {
      data.settings.rate = Number(b.dataset.rate);
      persist();
      renderSettings(container);
      updatePlayer();
    }));
    $(".rd-voice", container).addEventListener("change", (e) => {
      data.settings.voice = Object.assign({}, data.settings.voice, { [l]: e.target.value });
      persist();
    });
    $(".rd-test", container).addEventListener("click", () => {
      if (!synth) return toast(t("ttsNone"));
      synth.cancel();
      const u = new SpeechSynthesisUtterance(t("voiceSample"));
      const v = pickVoice(l);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = BCP[l];
      u.rate = data.settings.rate || 1;
      synth.speak(u);
    });
    $(".rd-export", container).addEventListener("click", exportBackup);
    $(".rd-import input", container).addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importBackup(f);
      e.target.value = "";
    });
  }

  function exportBackup() {
    const out = { app: cfg.app + "-reader", version: 1, exported: new Date().toISOString(),
      marks: data.marks, notes: data.notes, bookmarks: data.bookmarks };
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = cfg.app + "-notes-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function importBackup(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || d.app !== cfg.app + "-reader") throw new Error("not ours");
        Object.assign(data.marks, d.marks || {});
        Object.assign(data.notes, d.notes || {});
        Object.assign(data.bookmarks, d.bookmarks || {});
        persist();
        units().forEach(paint);
        toast(t("imported"));
        if (onChange) onChange();
      } catch (e) { toast(t("badFile")); }
    };
    r.readAsText(file);
  }

  /* ---------------- wiring ---------------- */

  function init(options) {
    cfg = options;
    load();
    buildBar();
    buildPlayer();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (sheet) closeSheet();
      else if (selected.size) clearSelection();
    });
    // A reload or a closed tab must not leave the phone still talking.
    window.addEventListener("pagehide", () => { if (synth) synth.cancel(); });
    if (synth) synth.getVoices();
  }

  window.Reader = {
    init: init,
    refresh: refresh,
    reveal: reveal,
    listen: listen,
    stop: ttsStop,
    isListening: () => tts.on,
    isBusy: () => !!sheet || selected.size > 0,
    renderList: renderList,
    renderSettings: renderSettings,
    counts: counts,
    onChange: (fn) => { onChange = fn; },
    clearSelection: clearSelection,
    t: t,
  };
})();
