/**
 * Language resolution and the UI string table.
 *
 * Every translatable value in this app is a `{zh, en, ms}` object; `pick`
 * is the single place that collapses one to a string. Knows nothing about
 * the DOM.
 */

import { get as getPrefs } from './prefs.js';

/** Fallback order when a language is missing from a translation object. */
const FALLBACK = ['en', 'zh', 'ms'];

/** Short glyph shown on the language button — it displays the *current* one. */
export const LANG_GLYPH = { zh: '中', en: 'EN', ms: 'MY' };

export const LANG_NAME = {
  zh: { zh: '中文', en: 'Chinese', ms: 'Cina' },
  en: { zh: '英文', en: 'English', ms: 'Inggeris' },
  ms: { zh: '马来文', en: 'Malay', ms: 'Melayu' },
};

/**
 * Each language written in itself. The first-run picker is shown before anyone
 * has chosen, so it cannot pick one language to label the others in.
 */
export const LANG_NATIVE = { zh: '中文', en: 'English', ms: 'Bahasa Melayu' };

export function current() {
  return getPrefs().lang;
}

/**
 * Resolve a `{zh, en, ms}` object to the active language.
 * A plain string passes through, so non-translatable values (numbers,
 * species names) can sit in the same content arrays.
 */
export function pick(value, lang = current()) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value[lang]) return value[lang];
  for (const f of FALLBACK) {
    if (value[f]) {
      // A blank would hide the gap; a console warning makes it findable.
      console.warn(`[i18n] missing "${lang}" for:`, value[f].slice?.(0, 40));
      return value[f];
    }
  }
  return '';
}

/* --- UI strings ---------------------------------------------------------- */

export const UI = {
  appName:   { zh: '油棕百科', en: 'OPWiki', ms: 'Wiki Sawit' },
  tagline:   { zh: '离线可用的油棕种植知识手册，中英马三语',
               en: 'An offline oil palm field reference, in three languages',
               ms: 'Rujukan sawit luar talian, dalam tiga bahasa' },

  search:        { zh: '搜索', en: 'Search', ms: 'Cari' },
  searchPrompt:  { zh: '搜索病虫害、养分、品种…',
                   en: 'Search pests, nutrients, varieties…',
                   ms: 'Cari perosak, nutrien, varieti…' },
  switchLanguage:{ zh: '切换语言', en: 'Switch language', ms: 'Tukar bahasa' },
  readingSize:   { zh: '阅读字号', en: 'Reading size', ms: 'Saiz bacaan' },
  theme:         { zh: '深浅色模式', en: 'Appearance', ms: 'Penampilan' },
  about:         { zh: '关于', en: 'About', ms: 'Tentang' },
  home:          { zh: '首页', en: 'Home', ms: 'Laman utama' },
  back:          { zh: '返回', en: 'Back', ms: 'Kembali' },
  skipToContent: { zh: '跳到正文', en: 'Skip to content', ms: 'Langkau ke kandungan' },

  chapters:    { zh: '全部章节', en: 'All chapters', ms: 'Semua bab' },
  chapter:     { zh: '第 {n} 章', en: 'Chapter {n}', ms: 'Bab {n}' },
  prev:        { zh: '上一章', en: 'Previous', ms: 'Sebelumnya' },
  next:        { zh: '下一章', en: 'Next', ms: 'Seterusnya' },
  sources:     { zh: '资料来源', en: 'Sources', ms: 'Sumber' },
  source:      { zh: '来源', en: 'Source', ms: 'Sumber' },
  dataTable:   { zh: '图表数据', en: 'Chart data', ms: 'Data carta' },

  resultsFor:  { zh: '“{q}” 的搜索结果', en: 'Results for “{q}”', ms: 'Hasil untuk “{q}”' },
  resultCount: { zh: '{n} 条结果', en: '{n} results', ms: '{n} hasil' },
  noResults:   { zh: '没有找到相关内容', en: 'Nothing found', ms: 'Tiada hasil dijumpai' },
  searchHint:  { zh: '三种语言同时搜索，无论界面是哪一种',
                 en: 'Searches all three languages at once, whatever the interface is set to',
                 ms: 'Mencari dalam ketiga-tiga bahasa serentak' },

  /* First-run language picker */
  chooseLanguage: { zh: '选择语言', en: 'Choose your language', ms: 'Pilih bahasa anda' },
  changeLater: {
    zh: '之后随时可以用顶部的语言按钮切换。',
    en: 'You can change this any time with the language button at the top.',
    ms: 'Anda boleh menukarnya bila-bila masa dengan butang bahasa di atas.',
  },

  themeAuto:  { zh: '跟随系统', en: 'Match system', ms: 'Ikut sistem' },
  themeLight: { zh: '浅色', en: 'Light', ms: 'Cerah' },
  themeDark:  { zh: '深色', en: 'Dark', ms: 'Gelap' },
  langSet:    { zh: '已切换到中文', en: 'Switched to English', ms: 'Ditukar ke Bahasa Melayu' },
  scaleSet:   { zh: '字号 {n}%', en: 'Text size {n}%', ms: 'Saiz teks {n}%' },

  /* Info screen */
  createdBy:    { zh: 'Apps created by Bryan Woo', en: 'Apps created by Bryan Woo',
                  ms: 'Apps created by Bryan Woo' },
  scanToOpen:   { zh: '扫码打开本 App', en: 'Scan to open this app', ms: 'Imbas untuk buka apl ini' },
  aboutApp:     { zh: '关于本 App', en: 'About this app', ms: 'Tentang apl ini' },
  aboutAppBody: {
    zh: '一本可以离线使用的油棕种植参考手册，涵盖植物学、气候与土壤、育种与育苗、田间管理、养分、病虫害、加工与可持续发展等 20 个主题。三种语言随时切换，字号可放大，装到主屏幕后无网络也能用。',
    en: 'An offline field reference for oil palm, covering botany, climate and soils, breeding and nurseries, field management, nutrition, pests and diseases, processing and sustainability across 20 topics. Switch language at any time, enlarge the text, and once added to the home screen it works with no network at all.',
    ms: 'Rujukan lapangan sawit luar talian yang merangkumi botani, iklim dan tanah, pembiakbakaan dan tapak semaian, pengurusan ladang, pemakanan, perosak dan penyakit, pemprosesan serta kelestarian dalam 20 topik. Tukar bahasa bila-bila masa, besarkan teks, dan setelah ditambah ke skrin utama ia berfungsi tanpa rangkaian.',
  },
  sourcesTitle: { zh: '内容与数据来源', en: 'Content and data sources', ms: 'Sumber kandungan dan data' },
  sourcesBody: {
    zh: '本 App 的文字为原创撰写，内容体系与事实依据主要参考 R.H.V. Corley 与 P.B. Tinker 合著《The Oil Palm》第五版（Wiley-Blackwell, 2016）。统计数据来自 Oil World、马来西亚棕油局（MPOB）与 FAOSTAT 等公开来源，图表均按原始数据重新绘制。本 App 不包含上述著作的原文、原图或照片。',
    en: 'The text in this app is original. Its structure and its facts draw principally on R.H.V. Corley & P.B. Tinker, The Oil Palm, 5th edition (Wiley-Blackwell, 2016). Statistics come from public sources including Oil World, the Malaysian Palm Oil Board (MPOB) and FAOSTAT; every chart here was redrawn from that underlying data. This app contains no text, figures or photographs from that book.',
    ms: 'Teks dalam apl ini adalah asli. Struktur dan faktanya merujuk terutamanya kepada R.H.V. Corley & P.B. Tinker, The Oil Palm, edisi ke-5 (Wiley-Blackwell, 2016). Statistik diambil daripada sumber awam termasuk Oil World, Lembaga Minyak Sawit Malaysia (MPOB) dan FAOSTAT; setiap carta di sini dilukis semula daripada data asas tersebut. Apl ini tidak mengandungi teks, rajah atau gambar daripada buku tersebut.',
  },
  disclaimerTitle: { zh: '使用提示', en: 'A note on use', ms: 'Nota penggunaan' },
  disclaimerBody: {
    zh: '本 App 提供的是一般性农艺参考。各地的土壤、气候与品种差异很大，施肥量、防治方案与经营决策请以当地农艺师的实地建议和试验结果为准。',
    en: 'This is general agronomic reference material. Soils, climate and planting material vary widely between sites, so fertiliser rates, control measures and management decisions should follow local agronomic advice and local trial results.',
    ms: 'Ini adalah bahan rujukan agronomi umum. Tanah, iklim dan bahan tanaman berbeza-beza antara lokasi, jadi kadar baja, langkah kawalan dan keputusan pengurusan hendaklah mengikut nasihat agronomi dan keputusan ujian tempatan.',
  },
  offlineTitle: { zh: '离线状态', en: 'Offline status', ms: 'Status luar talian' },
  offlineReady: { zh: '全部内容已缓存，可离线使用', en: 'All content cached — works offline',
                  ms: 'Semua kandungan disimpan — berfungsi luar talian' },
  offlineBusy:  { zh: '正在缓存内容…', en: 'Caching content…', ms: 'Menyimpan kandungan…' },
  offlineNo:    { zh: '尚未缓存（请在有网络时打开一次）',
                  en: 'Not cached yet — open once while online',
                  ms: 'Belum disimpan — buka sekali semasa dalam talian' },
  updateReady:  { zh: '有新版本内容', en: 'An update is ready', ms: 'Kemas kini sedia' },
  updateNow:    { zh: '立即更新', en: 'Update now', ms: 'Kemas kini sekarang' },
  version:      { zh: '版本', en: 'Version', ms: 'Versi' },
  loading:      { zh: '载入中…', en: 'Loading…', ms: 'Memuatkan…' },
  loadError:    { zh: '内容载入失败', en: 'Could not load that chapter', ms: 'Gagal memuatkan bab' },
};

/** Look up a UI string, with `{token}` interpolation. */
export function t(key, vars) {
  let s = pick(UI[key]);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
