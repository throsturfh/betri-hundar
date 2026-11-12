#!/usr/bin/env node
/* Assemble the 6.07 candidate from the published 6.06 build. Does not touch root or older folders. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, '6.06');
const dst = path.join(root, '6.07');
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'sw.js', 'stats.html', 'stats-config.json']) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
let html = fs.readFileSync(path.join(dst, 'index.html'), 'utf8');
html = html.replace("const VERSION = '6.06';   // Betri Hundar 6.05 (shown on the home screen; bump sw.js CACHE together with this)",
  "const VERSION = '6.07';   // Betri Hundar 6.07 (shown on the home screen; bump sw.js CACHE together with this)");
const guard = fs.readFileSync(path.join(root, 'tools/bh_guard.js'), 'utf8').trim();
const client = `
/*BH_GUARD_BEGIN*/
${guard}
/*BH_GUARD_END*/
/* ===== 6.07 reset generation. Published clients keep playing; this build adopts a server reset instead of merging it away. ===== */
function playerKey() {
  if (!save.playerKey || String(save.playerKey).length < 16) {
    save.playerKey = cloudCode(24);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }
  return save.playerKey;
}
let BH_BLOCKED = false;
function adoptAccountReset(serverRow) {
  const wipe = !!(serverRow && (serverRow.sealed || BHG.isEmptyReset(serverRow)));
  const next = BHG.adoptServerRev(save, serverRow, Date.now(), wipe ? {
    mintId: (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)),
    mintKey: cloudCode(24),
  } : {});
  if (!next) return false;
  if (wipe) {
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, next);
    try { ensureEcon(save); } catch (e) {}
    try { grantLevelDogs(save); } catch (e) {}
    persist();
    try { if (typeof renderHome === 'function' && scr === 'home') renderHome(); } catch (e) {}
    try { updateCoins(); } catch (e) {}
    try { toast('Leikurinn var núllstilltur á þessu tæki.', 3200); } catch (e) {}
    setTimeout(() => { try { statsSync(true); } catch (e) {} }, 80);
    return true;
  }
  save.resetEpoch = next.resetEpoch; persist();
  return false;
}
savePayload = (function (orig) { return function () { const d = orig(); delete d.playerKey; d.resetEpoch = save.resetEpoch | 0; return d; }; })(savePayload);
mergeSaves = (function (orig) { return function (mine, other) {
  if (typeof BHG !== 'undefined' && BHG.shouldBlockStaleMerge(mine, other)) return mine;
  const r = orig(mine, other);
  if (r && other && (other.resetEpoch | 0) > (r.resetEpoch | 0)) r.resetEpoch = other.resetEpoch | 0;
  return r;
}; })(mergeSaves);
keepBackup = (function (orig) { return function (raw) {
  let best = null; try { best = readJSON(BK_BEST); } catch (e) {}
  const pref = BHG.backupPreference(best && best.save, raw);
  if (pref === 'existing') return;
  if (pref === 'incoming') { try { localStorage.setItem(BK_BEST, JSON.stringify({ at: Date.now(), ver: VERSION, save: raw })); } catch (e) {} return; }
  return orig(raw);
}; })(keepBackup);
offerRestore = (function (orig) { return function (manual) {
  const i = typeof backupInfo === 'function' ? backupInfo(manual) : null;
  if (i && BHG.shouldBlockStaleMerge(save, i.b.save)) { if (manual) try { toast('Eldra afrit var hunsað eftir núllstillingu.', 2400); } catch (e) {} return false; }
  return orig(manual);
}; })(offerRestore);
adoptForeign = (function (orig) { return function (d, cloud) {
  BH_BLOCKED = false;
  if (d && BHG.shouldBlockStaleMerge(save, d)) { BH_BLOCKED = true; try { toast('Eldri vistun var hunsuð eftir núllstillingu.', 2800); } catch (e) {} return false; }
  return orig(d, cloud);
}; })(adoptForeign);
const statsSyncLegacy = statsSync;
statsSync = function (now) {
  if (save.statsOff || !save.playerName || (typeof VISIT !== 'undefined' && VISIT)) return;
  clearTimeout(STATS.timer);
  STATS.timer = setTimeout(() => { loadStatsCfg().then(c => statsCfgOk(c) ? checkYardCol().then(() => c) : c).then(c => {
    if (!statsCfgOk(c)) return;
    const row = statsPayload(); STATS.last = row;
    supa('rpc/player_put', { p_row: row, p_key: playerKey() }).then(r => {
      if (r.status === 404) { statsSyncLegacy(true); return null; }
      if (!r.ok) { STATS.err = r.status; return null; }
      return r.json();
    }).then(res => {
      if (!res) return;
      if (res.ok === false) { STATS.err = res.error || 'rejected'; return; }
      STATS.sent++; STATS.err = null;
      try { adoptAccountReset(res); } catch (e) {}
    }).catch(e => { STATS.err = String(e && e.message || e); });
  }).catch(() => {}); }, now ? 0 : 1500);
};
cloudLoad = (function () { return function (codeIn) {
  const code = normCode(codeIn);
  if (code.length !== 8) { try { toast('Kóðinn er 8 stafir (t.d. ABCD-2345)', 2200); } catch (e) {} return Promise.resolve(false); }
  CLOUD_ST.busy = true;
  return supa('rpc/cloud_get', { p_code: code }).then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))).then(res => {
    CLOUD_ST.busy = false;
    if (!res || !res.d) { try { toast('Engin vistun fannst með þessum kóða', 2400); } catch (e) {} return false; }
    const adopted = adoptForeign(res.d, { code: code, key: res.k, at: Date.now(), rev: res.rev | 0 });
    if (!adopted) { if (!BH_BLOCKED) try { toast('Vistunin er skemmd', 2000); } catch (e) {} return false; }
    try { closeModal(); toast('Vistunin er komin! 🐾 Ekkert sem þú áttir fyrir tapaðist.', 3000); } catch (e) {}
    return true;
  }).catch(e => { CLOUD_ST.busy = false; CLOUD_ST.err = String(e.message || e); try { toast(/404|nocfg/.test(CLOUD_ST.err) ? 'Skýið er ekki tilbúið enn – notaðu textakóða.' : 'Tókst ekki að tengjast – reyndu aftur.', 2600); } catch (e2) {} return false; });
}; })();
setTimeout(() => { try { statsSync(true); } catch (e) {} }, 400);
`;
if (!html.includes('window.__pl = ')) throw new Error('injection point missing');
html = html.replace('v606: V606DBG(),', 'v607: () => ({ epoch: save.resetEpoch | 0, fair: fairCoins603 }), v606: V606DBG(),');
html = html.replace('window.__pl = ', client + '\nwindow.__pl = ');
fs.writeFileSync(path.join(dst, 'index.html'), html);
let sw = fs.readFileSync(path.join(dst, 'sw.js'), 'utf8');
sw = sw.replace("const CACHE = 'betri-hundar-6.06';", "const CACHE = 'betri-hundar-6.07';");
fs.writeFileSync(path.join(dst, 'sw.js'), sw);
let stats = fs.readFileSync(path.join(dst, 'stats.html'), 'utf8');
stats = stats.replace("const GAME = '../6.04/';", "const GAME = './';");
fs.writeFileSync(path.join(dst, 'stats.html'), stats);
const sql = fs.readFileSync(path.join(root, 'sql/6.07_anticheat.sql'), 'utf8');
const one = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
if (one.includes('\n')) throw new Error('migration did not minify to one line');
fs.writeFileSync(path.join(dst, 'stats-setup-6.07.sql'), one + '\n');
console.log('6.07 assembled', (html.length / 1024).toFixed(1) + ' KB html,', one.length, 'SQL chars');
