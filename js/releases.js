/**
 * What changed, newest first. Every update adds an entry here; after the
 * update the app shows the new entries once (whatsnew.js), and the Info
 * screen shows the version and opens the whole list. APP_VERSION follows
 * the first entry.
 */
export const RELEASES = [
  { v: '1.1.0', date: '2026-10-13', notes: {
    zh: ['App 更新后会自动弹出「更新了什么」：版本号、日期和改动内容；在「关于」页可以随时查看全部更新记录',
         '修好：本 App 的离线缓存只清理自己的旧资料，不再影响同一个网站上的其他 App'],
    en: ['After an update the app now shows what changed: the version, the date and what is new; the full list is on the Info screen',
         'Fixed: the offline cache now clears only this app’s own old files, leaving the other apps on the same site alone'],
    ms: ['Selepas kemas kini, aplikasi kini menunjukkan apa yang berubah: versi, tarikh dan perkara baharu; senarai penuh ada di skrin Info',
         'Dibaiki: cache luar talian kini hanya membuang fail lama aplikasi ini sendiri, tanpa menjejaskan aplikasi lain di laman yang sama'] } },
  { v: '1.0.0', date: '2026-09-30', notes: {
    zh: ['第一版：油棕百科，中文、英文、马来文三种语言，可离线使用；第一次打开时选择语言'],
    en: ['First release: the oil palm reference in Chinese, English and Malay, usable offline; choose a language on first launch'],
    ms: ['Keluaran pertama: rujukan kelapa sawit dalam bahasa Cina, Inggeris dan Melayu, boleh digunakan luar talian; pilih bahasa semasa kali pertama dibuka'] } },
];
