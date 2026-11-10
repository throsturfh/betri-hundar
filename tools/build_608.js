#!/usr/bin/env node
/* Assemble 6.08 from published 6.07. Does not touch root or older folders. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, '6.07');
const dst = path.join(root, '6.08');
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'sw.js', 'stats.html', 'stats-config.json']) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
let html = fs.readFileSync(path.join(dst, 'index.html'), 'utf8');
if (!html.includes("const VERSION = '6.07';")) throw new Error('expected 6.07 VERSION');
html = html.replace("const VERSION = '6.07';", "const VERSION = '6.08';");
const patch = `
/*BH608_BEGIN*/
/* 6.08: server rate/consistency guard. On clamped/rejected sync, keep the local save and keep playing. */
statsSync = (function (orig) { return function (now) {
  if (save.statsOff || !save.playerName || (typeof VISIT !== 'undefined' && VISIT)) return;
  clearTimeout(STATS.timer);
  STATS.timer = setTimeout(() => { loadStatsCfg().then(c => statsCfgOk(c) ? checkYardCol().then(() => c) : c).then(c => {
    if (!statsCfgOk(c)) return;
    const row = statsPayload(); STATS.last = row;
    const key = (typeof playerKey === 'function') ? playerKey() : null;
    const req = key ? supa('rpc/player_put', { p_row: row, p_key: key }) : Promise.resolve({ ok: false, status: 404 });
    req.then(r => {
      if (!key || r.status === 404) { try { return orig(true); } catch (e) { return null; } }
      if (!r.ok) { STATS.err = r.status; return null; }
      return r.json();
    }).then(res => {
      if (!res || typeof res !== 'object') return;
      if (res.ok === false) { STATS.err = res.error || 'rejected'; return; }
      STATS.sent++; STATS.err = null;
      if (res.clamped) {
        try { STATS.clamped = (STATS.clamped | 0) + 1; } catch (e) {}
        /* Keep playing with the local save. Do not wipe progress. */
        return;
      }
      try { if (typeof adoptAccountReset === 'function') adoptAccountReset(res); } catch (e) {}
    }).catch(e => { STATS.err = String(e && e.message || e); });
  }).catch(() => {}); }, now ? 0 : 1500);
}; })(statsSync);
try { if (typeof dbg === 'object' && dbg) dbg.v608 = () => ({ clamped: STATS.clamped | 0, err: STATS.err || null }); } catch (e) {}
/*BH608_END*/
`;
if (!html.includes('window.__pl = ')) throw new Error('injection point missing');
if (html.includes('/*BH608_BEGIN*/')) throw new Error('already patched');
html = html.replace('window.__pl = ', patch + '\nwindow.__pl = ');
fs.writeFileSync(path.join(dst, 'index.html'), html);
let sw = fs.readFileSync(path.join(dst, 'sw.js'), 'utf8');
sw = sw.replace("const CACHE = 'betri-hundar-6.07';", "const CACHE = 'betri-hundar-6.08';");
if (!sw.includes('betri-hundar-6.08')) throw new Error('sw cache not bumped');
fs.writeFileSync(path.join(dst, 'sw.js'), sw);
let stats = fs.readFileSync(path.join(dst, 'stats.html'), 'utf8');
stats = stats.replace(/const GAME = '[^']*';/, "const GAME = './';");
fs.writeFileSync(path.join(dst, 'stats.html'), stats);
const sql = fs.readFileSync(path.join(root, 'sql/6.08_rate_guard.sql'), 'utf8');
const one = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
fs.writeFileSync(path.join(dst, 'stats-setup-6.08.sql'), one + '\n');
console.log('6.08 assembled', (html.length/1024).toFixed(1)+' KB, SQL', one.length);
