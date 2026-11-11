#!/usr/bin/env node
/* Assemble 6.09 from published 6.08. Removes only the hidden manual "Endurheimta framvindu" path. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, '6.08');
const dst = path.join(root, '6.09');
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'sw.js', 'stats.html', 'stats-config.json']) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
let html = fs.readFileSync(path.join(dst, 'index.html'), 'utf8');
if (!html.includes("const VERSION = '6.08';")) throw new Error('expected 6.08 VERSION');
html = html.replace("const VERSION = '6.08';", "const VERSION = '6.09';");

const tap = "let verTaps = 0, verT = 0;\ndocument.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('#hVer')) return; const n = performance.now(); verTaps = n - verT < 900 ? verTaps + 1 : 1; verT = n; if (verTaps >= 5) { verTaps = 0; showManualRestore(); } });\n";
if (!html.includes(tap)) throw new Error('5-tap listener not found');
html = html.replace(tap, '');

const start = html.indexOf('/* hidden manual restore');
const end = html.indexOf("/* 3.5: 'Byrja upp á nýtt'");
if (start < 0 || end < 0 || end <= start) throw new Error('manual restore block not found');
html = html.slice(0, start) + html.slice(end);

const mrest = "    if (b.dataset.act === 'mrestore-ok') { manualRestore(+document.getElementById('rsBoard').value, +document.getElementById('rsCoins').value); return; }\n";
if (!html.includes(mrest)) throw new Error('mrestore-ok handler not found');
html = html.replace(mrest, '');

const rb = "if (b.dataset.act === 'restore-yes' || b.dataset.act === 'restore-backup') { if (b.dataset.act === 'restore-backup') RESTORE_SRC = true; if (b.dataset.act === 'restore-backup' && !backupInfo(true)) { toast('Ekkert afrit fannst', 1800); return; } doRestore(); return; }";
const rb2 = "if (b.dataset.act === 'restore-yes') { doRestore(); return; }";
if (!html.includes(rb)) throw new Error('restore-backup handler not found');
html = html.replace(rb, rb2);

for (const leftover of ['showManualRestore', 'manualRestore', 'mrestore-ok', 'Endurheimta framvindu', 'verTaps', 'restore-backup']) {
  if (html.includes(leftover)) throw new Error('leftover ' + leftover);
}
if (!html.includes("data-act=\"restore-ask\"")) throw new Error('settings backup restore button missing');
if (!html.includes('function offerRestore')) throw new Error('offerRestore missing');
if (!html.includes('function keepBackup')) throw new Error('keepBackup missing');
if (!html.includes('BH608_BEGIN')) throw new Error('6.08 client guard missing');
if (!html.includes('function adoptAccountReset')) throw new Error('6.07 seal handling missing');

fs.writeFileSync(path.join(dst, 'index.html'), html);
let sw = fs.readFileSync(path.join(dst, 'sw.js'), 'utf8');
sw = sw.replace("const CACHE = 'betri-hundar-6.08';", "const CACHE = 'betri-hundar-6.09';");
if (!sw.includes('betri-hundar-6.09')) throw new Error('sw cache not bumped');
fs.writeFileSync(path.join(dst, 'sw.js'), sw);
let stats = fs.readFileSync(path.join(dst, 'stats.html'), 'utf8');
stats = stats.replace(/const GAME = '[^']*';/, "const GAME = './';");
fs.writeFileSync(path.join(dst, 'stats.html'), stats);
console.log('6.09 assembled', (html.length / 1024).toFixed(1) + ' KB');
