#!/usr/bin/env node
/* Assemble 7.0 from published 6.09. Writes only 7.0/. Does not touch root or older folders. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src609 = path.join(root, '6.09');
const dst = path.join(root, '7.0');
const pack = '/workspace/pack-leader';
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'sw.js', 'stats.html', 'stats-config.json']) {
  fs.copyFileSync(path.join(src609, f), path.join(dst, f));
}
let html = fs.readFileSync(path.join(dst, 'index.html'), 'utf8');
if (!html.includes("const VERSION = '6.09';")) throw new Error('expected 6.09 VERSION');
html = html.replace("const VERSION = '6.09';", "const VERSION = '7.0';");

const matsEnd = "{ k: 'sts', pre: 'stjörnusteins', n: 'Stjörnusteinn', b: 'Stjörnusteinsborð', ic: '🌟', a: '#ffcf4a', b2: '#fff3b0', d: '#3a2a7a', ink: '#2a1a5a', gem: '#ffe680', dog: 'stjörnukraga og stjörnuregn', tint: 'rgba(80,60,160,.20)', star: true }];";
if (!html.includes(matsEnd)) throw new Error('MATS end not found');
html = html.replace(matsEnd, matsEnd.replace('star: true }];',
  "star: true },\n  { k: 'edm', pre: 'demanta', n: 'Eilífðardemantur', b: 'Demantaborð', ic: '💠', a: '#7ad8ff', b2: '#e8fbff', d: '#1a4a6a', ink: '#0a2430', gem: '#bff3ff', dog: 'eilífðardemantskraga og djúpt glit', tint: 'rgba(122,216,255,.16)', edm: true }];"));

const matdn = "const MAT_DN = ['Gull', 'Platínu', 'Safír', 'Smaragðs', 'Rúbín', 'Demants', 'Svartdemants', 'Norðurljósa', 'Stjörnu'];";
if (!html.includes(matdn)) throw new Error('MAT_DN not found');
html = html.replace(matdn, "const MAT_DN = ['Gull', 'Platínu', 'Safír', 'Smaragðs', 'Rúbín', 'Demants', 'Svartdemants', 'Norðurljósa', 'Stjörnu', 'Demanta'];");

html = html.replace("v.ltab = v.ltab === 'gold' || /^m[1-8]$/.test(v.ltab || '') ? v.ltab : '';",
  "v.ltab = v.ltab === 'gold' || /^m\\d+$/.test(v.ltab || '') ? v.ltab : '';");
html = html.replace(/for \(let m = 1; m <= 8; m\+\+\)/g, 'for (let m = 1; m <= NMAT; m++)');
html = html.replace(/for \(let m = 0; m <= 8; m\+\+\)/g, 'for (let m = 0; m <= NMAT; m++)');
html = html.replace('y.md[id] >= 1 && y.md[id] <= 8)', 'y.md[id] >= 1 && y.md[id] <= NMAT)');
html = html.replace(/\[0, 1, 2, 3, 4, 5, 6, 7, 8\]/g, 'Array.from({length: NMAT + 1}, (_, i) => i)');
// Code that runs before `const NMAT` must not read NMAT (TDZ). Use a fixed cap of 12 there.
(function () {
  const i = html.indexOf('const NMAT');
  if (i < 0) throw new Error('NMAT decl missing');
  let pre = html.slice(0, i), post = html.slice(i);
  pre = pre.replace(/for \(let m = 1; m <= NMAT; m\+\+\)/g, 'for (let m = 1; m <= 12; m++)');
  pre = pre.replace(/for \(let m = 0; m <= NMAT; m\+\+\)/g, 'for (let m = 0; m <= 12; m++)');
  pre = pre.replace(/Array\.from\(\{length: NMAT \+ 1\}, \(_, i\) => i\)/g, 'Array.from({length: 13}, (_, i) => i)');
  if (pre.includes('m <= NMAT') || pre.includes('NMAT + 1}, (_, i)')) throw new Error('NMAT still used before declaration');
  html = pre + post;
})();

const css = `
.ltabs button.mat-edm, .goldtile.mat-edm, .btn.goldbtn.mat-edm, .btn.mat-edm { background: radial-gradient(circle at 30% 30%, #fff 0 8%, transparent 9%), linear-gradient(#7ad8ff, #2a6a8a 60%, #0a3048) !important; color: #e8fbff !important; border-color: #1a4a6a !important; --edge: #1a4a6a; }
.prog .pg.mat-edm b { color: #7ad8ff; } .prog .pg.mat-edm i::after { background: linear-gradient(90deg, #0a3048, #7ad8ff, #e8fbff); }
`;
const cssAnchor = '.prog .pg.mat-sts i::after { background: linear-gradient(90deg, #3a2a7a, #ffcf4a, #fff3b0); }';
if (!html.includes(cssAnchor)) throw new Error('CSS anchor missing');
html = html.replace(cssAnchor, cssAnchor + css);

const phase70 = fs.readFileSync(path.join(pack, 'src/phase70.js'), 'utf8');
const v70 = fs.readFileSync(path.join(pack, 'src/v70.js'), 'utf8');
if (!phase70.includes('const PHASE70')) throw new Error('PHASE70 missing');
if (!v70.includes('Betri Hundar 7.0')) throw new Error('v70 missing');
const inj = '\n/* ===== Betri Hundar 7.0 ===== */\n' + phase70 + '\n' + v70 + '\n';
const hook = 'window.__pl =';
if (!html.includes(hook)) throw new Error('window.__pl hook missing');
if (html.includes('const PHASE70')) throw new Error('PHASE70 already present');
html = html.replace(hook, inj + hook);

if (!html.includes("const VERSION = '7.0';")) throw new Error('VERSION not bumped');
if (!html.includes("k: 'edm'")) throw new Error('MATS edm missing');
if (!html.includes("'Demanta'")) throw new Error('MAT_DN Demanta missing');
if (html.includes('m <= 8')) throw new Error('leftover m <= 8');
if (html.includes('/^m[1-8]$/')) throw new Error('leftover ltab 1-8');
if (!html.includes('BH608_BEGIN')) throw new Error('6.08 client guard missing');
if (!html.includes('function adoptAccountReset')) throw new Error('6.07 seal handling missing');
if (!html.includes("SAVE_KEY = 'packleader.v2'")) throw new Error('save key changed');
if (html.includes('showManualRestore') || html.includes('Endurheimta framvindu')) throw new Error('manual restore leaked back');

fs.writeFileSync(path.join(dst, 'index.html'), html);

let sw = fs.readFileSync(path.join(dst, 'sw.js'), 'utf8');
sw = sw.replace("const CACHE = 'betri-hundar-6.09';", "const CACHE = 'betri-hundar-7.0';");
if (!sw.includes('betri-hundar-7.0')) throw new Error('sw cache not bumped');
fs.writeFileSync(path.join(dst, 'sw.js'), sw);

let stats = fs.readFileSync(path.join(dst, 'stats.html'), 'utf8');
const phOld = "const PH = [['Borð', '🐶', 'Venjulegir'], ['Gullborð', '✨', 'Gull'], ['Platínuborð', '🤍', 'Platínu'], ['Safírborð', '🔷', 'Safír'], ['Smaragðsborð', '💚', 'Smaragðs'], ['Rúbínborð', '❤️', 'Rúbín'], ['Demantsborð', '💎', 'Demants'], ['Svartdemantsborð', '🖤', 'Svartdemants'], ['Norðurljósasteinsborð', '🌌', 'Norðurljósa'], ['Stjörnusteinsborð', '⭐', 'Stjörnu']];";
const phNew = "const PH = [['Borð', '🐶', 'Venjulegir'], ['Gullborð', '✨', 'Gull'], ['Platínuborð', '🤍', 'Platínu'], ['Safírborð', '🔷', 'Safír'], ['Smaragðsborð', '💚', 'Smaragðs'], ['Rúbínborð', '❤️', 'Rúbín'], ['Demantsborð', '💎', 'Demants'], ['Svartdemantsborð', '🖤', 'Svartdemants'], ['Norðurljósasteinsborð', '🌌', 'Norðurljósa'], ['Stjörnusteinsborð', '⭐', 'Stjörnu'], ['Demantaborð', '💠', 'Demanta']];";
if (!stats.includes(phOld)) throw new Error('stats PH not found');
stats = stats.replace(phOld, phNew);
stats = stats.replace("cp = Math.max(-1, Math.min(8, p.cp | 0));", "cp = Math.max(-1, Math.min(PH.length - 2, p.cp | 0));");
stats = stats.replace("dogs = p.dogs.slice(0, 10).map(num);", "dogs = p.dogs.slice(0, PH.length).map(num);");
stats = stats.replace("won = (p.won || []).slice(0, 10).map(num);", "won = (p.won || []).slice(0, PH.length).map(num);");
stats = stats.replace("for (let m = 1; m <= 8; m++) won.push(Math.min(100, mv.filter(v => v >= m).length));",
  "for (let m = 1; m <= PH.length - 2; m++) won.push(Math.min(100, mv.filter(v => v >= m).length));");
// title next to name, backward compatible: missing v70 is ignored
if (!stats.includes('v70title')) {
  // inject a small helper after esc()
  const mark = "const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[c]);";
  if (stats.includes(mark)) {
    stats = stats.replace(mark, mark + "\nconst titleOf = x => { try { const y = x && x.yard; const t = (y && y.v70 && y.v70.title) || (y && y.v60 && y.v60.v70title) || ''; return String(t).replace(/[<>&\"']/g,'').slice(0, 40); } catch (e) { return ''; } };");
  }
  // try to wrap displayed name – look for typical name render
  if (stats.includes('${esc(x.name') || stats.includes('esc(x.name)') || stats.includes('esc(p.name)')) {
    stats = stats.replace(/esc\((x|p)\.name\)/g, "esc($1.name) + (titleOf($1) ? ' · ' + esc(titleOf($1)) : '')");
  } else if (stats.includes('${esc(r.name)}')) {
    stats = stats.replace(/\$\{esc\(r\.name\)\}/g, "${esc(r.name)}${titleOf(r) ? ' · ' + esc(titleOf(r)) : ''}");
  }
}
stats = stats.replace(/const GAME = '[^']*';/, "const GAME = './';");
fs.writeFileSync(path.join(dst, 'stats.html'), stats);

console.log('7.0 assembled', (html.length / 1024).toFixed(1) + ' KB', 'stats', (stats.length / 1024).toFixed(1) + ' KB');
