/**
 * What changed, newest first. Every update adds an entry here; after the
 * update the app shows the new entries once (whatsnew.js), and the Info
 * screen shows the version and opens the whole list. APP_VERSION follows
 * the first entry.
 */
export const RELEASES = [
  { v: '1.3.0', date: '2026-10-13', notes: {
    zh: ['任何段落都可以用荧光笔或下划线标记，有五种颜色：点一下段落，选「荧光笔」或「下划线」，再选颜色',
         '可以在任何段落加笔记和书签；全部集中在底部的「笔记」和「书签」里，点一下就回到原文',
         '朗读：从你正在看的地方开始一段一段读给你听，读完一章自动接下一章；语速和声音可在「设置」里调整',
         '新的底部菜单栏：目录、朗读、笔记、书签、设置，单手用拇指就按得到',
         '语言、深浅色和字号都移到「设置」里；也可以在那里备份笔记'],
    en: ['Highlight or underline any paragraph in five colours: tap it, pick Highlight or Underline, then a colour',
         'Add your own notes and bookmarks to any paragraph; find them under Notes and Bookmarks, and tap one to jump back to it',
         'Read aloud: the app reads to you from where you are, paragraph by paragraph, and carries on into the next chapter; speed and voice are in Settings',
         'New menu bar at the bottom of the screen — Contents, Read aloud, Notes, Bookmarks and Settings — easier to reach with your thumb',
         'Language, light/dark mode and text size have moved into Settings; you can also back up your notes there'],
    ms: ['Serlah atau garis bawah mana-mana perenggan dalam lima warna: ketik perenggan, pilih Serlah atau Garis bawah, kemudian warna',
         'Tambah nota dan penanda sendiri pada mana-mana perenggan; semuanya di bawah Nota dan Penanda, ketik untuk kembali ke teks',
         'Baca kuat: aplikasi membacakan dari tempat anda berada, perenggan demi perenggan, dan terus ke bab seterusnya; kelajuan dan suara dalam Tetapan',
         'Bar menu baharu di bawah skrin — Kandungan, Baca kuat, Nota, Penanda dan Tetapan — lebih mudah dicapai dengan ibu jari',
         'Bahasa, mod cerah/gelap dan saiz teks kini dalam Tetapan; anda juga boleh membuat sandaran nota di sana'] } },
  { v: '1.2.0', date: '2026-10-13', notes: {
    zh: ['「关于」页的二维码下面新增「分享 App 链接」按钮',
         '「关于」页显示版本号和这一版的更新日期、时间',
         '有新版本时不再突然重新载入：会出现提示，可以选择「立即更新」或「稍后」'],
    en: ['The Info screen has a \u201cShare the app link\u201d button under the QR code',
         'The Info screen shows the version with the date and time of this update',
         'A new version no longer reloads the app without warning: a bar offers \u201cUpdate now\u201d or \u201cLater\u201d'],
    ms: ['Skrin Info kini ada butang \u201cKongsi pautan aplikasi\u201d di bawah kod QR',
         'Skrin Info menunjukkan versi bersama tarikh dan masa kemas kini ini',
         'Versi baharu tidak lagi memuat semula aplikasi tanpa amaran: bar menawarkan \u201cKemas kini\u201d atau \u201cNanti\u201d'] } },
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
