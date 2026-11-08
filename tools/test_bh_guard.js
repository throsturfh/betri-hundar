#!/usr/bin/env node
/* Behaviour tests for the 6.07 progress guard. No network, no live database, no player identities. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('./bh_guard.js');
const BH = G.BH;
const root = path.join(__dirname, '..');
let pass = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  pass++;
}
const T0 = Date.parse('2026-11-01T12:00:00Z');
const DAY = 86400000;

function row(over) {
  return Object.assign({
    player_id: 'player-existing', name: 'Leikmaður', version: '6.06', board_reached: 40,
    boards_won: 39, stars: 70, wins: 36, losses: 18, daily_played: 4, daily_won: 3, dogs: 39,
    coins: 80000, sync_rev: 0, reset_at: null, yard: { v: 1, lvl: 1, slots: { m1: 'sign' }, p53: { won: [39], dogs: [39], st: 70, cp: -1, b: 40 } },
    first_seen: new Date(T0 - 7 * DAY).toISOString(), last_played: new Date(T0).toISOString(),
  }, over);
}
function put(old, neu, opt) {
  return G.guardPlayerRow(old, Object.assign({ player_id: old ? old.player_id : neu.player_id, name: 'Leikmaður' }, neu), opt);
}

/* ---- legitimate shapes stay ---- */
{
  const old = row();
  const g = put(old, { coins: 80000, boards_won: 39, stars: 70, dogs: 39, wins: 36, losses: 18 }, { now: T0 + 60000, ack: 0 });
  ok(!g.reject && !g.frozen, 'board-39-shaped save is not rejected');
  ok(g.row.coins === 80000 && g.row.boards_won === 39 && g.row.stars === 70 && g.row.dogs === 39, 'board-39 progress is unchanged');
  ok(!g.reasons.includes('stale'), 'an un-reset row is not frozen');
}
{
  const old = row({ boards_won: 100, stars: 300, dogs: 100, coins: 1564609, wins: 400, losses: 80, board_reached: 100 });
  const g = put(old, { coins: 1600000, boards_won: 100, stars: 300, dogs: 100, wins: 401, losses: 80 }, { now: T0 + DAY, ack: 0 });
  ok(g.row.coins === 1600000 && g.row.boards_won === 100 && g.row.stars === 300, 'high but plausible balance and a full normal campaign still sync');
}
{
  /* Wins below boards is not treated as proof of anything and must not be rejected by itself. */
  const old = row({ boards_won: 100, stars: 300, dogs: 100, coins: 50000, wins: 37, losses: 61 });
  const g = put(old, { boards_won: 100, stars: 300, dogs: 100, coins: 50000, wins: 37, losses: 61 }, { now: T0 + DAY, ack: 0 });
  ok(!g.reject && g.row.wins === 37 && g.row.boards_won === 100, 'a low win counter is kept and does not reject the row');
}
{
  const fair = G.fairReportedCoins({ coins: 310000, cheatBones: 300000 });
  ok(fair === 10000, 'three intentional +100k code uses stay off the reported balance');
  const old = row({ coins: 10000 });
  const g = put(old, { coins: fair, boards_won: 39 }, { now: T0 + DAY, ack: 0 });
  ok(g.row.coins === 10000, 'reported coins after the code are accepted when they fit the earn rate');
  const raw = put(old, { coins: 310000 }, { now: T0, ack: 0 });
  ok(raw.row.coins === 10000 && raw.reasons.includes('coins'), 'a client that forgets to subtract code bones cannot jump coins in one instant sync');
}

/* ---- implausible coins and structural overflows ---- */
{
  const g = put(null, { player_id: 'new-player', coins: 2000000000, boards_won: 500, stars: 99999, dogs: 9000, yard: { p53: { won: [10000000, 10000000], st: 999999, dogs: [99999] } } }, { now: T0 });
  ok(!g.reject, 'a brand-new row is clamped, not dropped, so the client is not locked out');
  ok(g.row.coins === BH.FIRST_SYNC_COINS, 'insert cannot store a multi-billion coin balance');
  ok(g.row.boards_won === 100 && g.row.stars === BH.STRUCT_STARS && g.row.dogs === BH.STRUCT_DOGS, 'insert structural fields stop at the game maximum');
  ok(g.row.yard.p53.won[0] === 100 && g.row.yard.p53.won[1] === 100 && g.row.yard.p53.st <= BH.STRUCT_YARD_STARS, 'yard phase totals cannot exceed a finished phase');
}
{
  const old = row({ coins: 1000, last_played: new Date(T0).toISOString() });
  const g = put(old, { coins: 2000000000, boards_won: 39 }, { now: T0, ack: 0 });
  ok(g.row.coins === 1000, 'an existing row cannot jump to a multi-billion balance with no time since the previous sync');
  ok(g.reasons.includes('coins'), 'the coin jump is reported as reduced');
}
{
  const old = row({ coins: 1000, last_played: new Date(T0).toISOString() });
  const g = put(old, { coins: 1000 + 50000, boards_won: 40, stars: 73 }, { now: T0 + DAY, ack: 0 });
  ok(g.row.coins === 51000 && g.row.boards_won === 40, 'a day of ordinary earnings and one more board is stored whole');
}
{
  const old = row({ coins: 1800000000, last_played: new Date(T0).toISOString() });
  const g = put(old, { coins: 1800000000, boards_won: 39 }, { now: T0 + DAY, ack: 0 });
  ok(g.row.coins === 1800000000, 'a balance already above the ceiling is left in place until an admin reset');
  const up = put(old, { coins: 1800000100 }, { now: T0 + DAY, ack: 0 });
  ok(up.row.coins === 1800000000, 'that grandfathered balance cannot grow further');
}

/* ---- ownership ---- */
{
  const old = row();
  const bad = put(old, { coins: 1 }, { storedKey: 'correct-key-0123456789', key: 'wrong-key-0123456789', now: T0 + DAY, ack: 0 });
  ok(bad.reject === 'key', 'a row that already has a device key rejects a different key');
  const legacy = put(old, { coins: 80000 }, { now: T0 + DAY, ack: 0 });
  ok(!legacy.reject, 'a legacy row with no device key still syncs');
  const owned = put(old, { name: 'Nýtt nafn', coins: 80000 }, { storedKey: 'correct-key-0123456789', key: 'correct-key-0123456789', now: T0 + DAY, ack: 0 });
  ok(!owned.reject && owned.row.name === 'Nýtt nafn', 'the matching device key can rename and sync');
}
{
  const badId = put(null, { player_id: '', coins: 1 }, { now: T0 });
  ok(badId.reject === 'player_id', 'an empty id is rejected');
}

/* ---- admin reset and stale reupload ---- */
{
  const other = row({ player_id: 'someone-else', name: 'Annar', coins: 2222, boards_won: 12, stars: 20, dogs: 12 });
  const state = { players: { 'player-existing': row({ coins: 2000000000, boards_won: 100, stars: 300, dogs: 100 }), 'someone-else': other }, clouds: { ABCD2345: { wkey: 'k'.repeat(24), reset_gen: 0, updated_at: new Date(T0).toISOString(), data: { coins: 120000, stars: { 1: 3 } } } }, backups: [] };
  const beforeOther = JSON.stringify(state.players['someone-else']);
  const reset = G.adminReset(state, 'player-existing', 'ABCD2345', T0);
  ok(reset.ok && reset.sync_rev === 1, 'targeted reset bumps the generation');
  ok(JSON.stringify(reset.state.players['someone-else']) === beforeOther, 'reset does not change any other player');
  const cleared = reset.state.players['player-existing'];
  ok(cleared.coins === 0 && cleared.boards_won === 0 && cleared.stars === 0 && cleared.dogs === 0 && cleared.yard == null, 'reset clears progress fields on that row only');
  ok(cleared.name === 'Leikmaður' && cleared.player_id === 'player-existing', 'reset keeps the row id and display name so the generation stays attached');
  ok(reset.state.clouds.ABCD2345.reset_gen === 1 && reset.state.clouds.ABCD2345.data.coins === 0, 'when a cloud code is supplied, that cloud copy is reset too');
  ok(reset.backup_id === 1 && reset.state.backups[0].player.coins === 2000000000, 'the previous row is kept in the operator backup');

  const stale = put(cleared, { coins: 2000000000, boards_won: 100, stars: 300, dogs: 100, wins: 37, losses: 61, yard: { p53: { won: [100], st: 300, dogs: [100] } } }, { now: T0 + 5000, ack: 0 });
  ok(stale.frozen && stale.row.coins === 0 && stale.row.boards_won === 0 && stale.row.stars === 0 && stale.row.dogs === 0, 'a stale upload that does not acknowledge the reset cannot restore progress');
  ok(stale.row.yard == null, 'a stale upload cannot restore the yard snapshot either');

  const acked = put(cleared, { coins: 2000000000, boards_won: 100, stars: 300, dogs: 100 }, { now: T0 + 5000, ack: 1 });
  const burstCoins = BH.RESET_COIN_BURST + Math.floor(BH.EARN_PER_DAY * 5 / 86400);
  ok(!acked.frozen && acked.row.boards_won === BH.RESET_BOARD_BURST && acked.row.coins === burstCoins, 'acknowledging the reset still cannot replay the old snapshot; only the post-reset burst fits');
  const again = put(Object.assign({}, cleared, { boards_won: acked.row.boards_won, coins: acked.row.coins, stars: acked.row.stars, dogs: acked.row.dogs }), { coins: 2000000000, boards_won: 100 }, { now: T0 + 5000, ack: 1 });
  ok(again.row.boards_won === BH.RESET_BOARD_BURST && again.row.coins === burstCoins, 'repeating the upload at the same moment does not stack the burst');

  const later = put(cleared, { coins: 2000000000, boards_won: 100 }, { now: T0 + 2 * DAY, ack: 1 });
  ok(later.row.boards_won === BH.RESET_BOARD_BURST + 2 * BH.BOARD_PER_DAY, 'two days later the board ceiling has moved by the daily rate, not back to a full forged campaign in one step from day zero');
  ok(later.row.coins === BH.RESET_COIN_BURST + 2 * BH.EARN_PER_DAY, 'coin ceiling follows the same reset clock');

  const fresh = { playerId: 'player-existing', playerName: 'Leikmaður', coins: 2000000000, stars: { 1: 3, 2: 3 }, album: ['a'], cheatBones: 100000, guardRev: 0, mute: true, cloud: { code: 'ABCD2345', key: 'secret' } };
  const wiped = G.adoptServerRev(fresh, cleared, T0);
  ok(wiped && wiped.coins === 0 && wiped.guardRev === 1 && wiped.playerId === 'player-existing' && wiped.mute === true && !wiped.cheatBones, '6.07 replaces local progress when the server row is a full reset');
  ok(wiped.cloud && wiped.cloud.code === 'ABCD2345', 'device cloud credentials survive the local wipe');
  const keep = G.adoptServerRev(fresh, Object.assign({}, cleared, { coins: 5000, boards_won: 10, stars: 20, dogs: 10, yard: { p53: { won: [10], st: 20 } } }), T0);
  ok(keep.coins === 2000000000 && keep.stars[1] === 3 && keep.guardRev === 1, 'a generation bump that is not an empty reset does not wipe a local save');
}

/* ---- merges and cloud ---- */
{
  const mine = { coins: 0, stars: {}, album: [], guardRev: 1, guardAt: new Date(T0).toISOString() };
  ok(G.shouldBlockStaleMerge(mine, { coins: 2000000000, stars: { 1: 3 }, guardRev: 0 }), 'an older backup cannot merge over a reset');
  ok(!G.shouldBlockStaleMerge(mine, { coins: 10, stars: {}, guardRev: 1 }), 'a save that already acknowledges the reset can merge');
  ok(!G.shouldBlockStaleMerge({ guardRev: 0, coins: 10 }, { coins: 20, guardRev: 0 }), 'ordinary saves with no reset generation merge as before');
  ok(G.shouldBlockCloud(mine, { coins: 2000000000, stars: { 1: 3 }, album: ['a'] }, 0, T0 + 1000), 'a pre-reset cloud copy is ignored after the reset');
  ok(!G.shouldBlockCloud(mine, { coins: 20000, stars: { 1: 1, 2: 1, 3: 1 }, album: ['a'] }, 0, T0 + 1000), 'small progress earned after the reset still fits through cloud');
  ok(!G.shouldBlockCloud({ guardRev: 0, coins: 1, stars: {} }, { coins: 999, stars: { 1: 3 } }, 0, T0), 'cloud merge is unchanged when the account was never reset');
  ok(G.backupPreference({ guardRev: 0, coins: 9 }, { guardRev: 1, coins: 0 }) === 'incoming', 'the post-reset save replaces a richer pre-reset backup');
  ok(G.backupPreference({ guardRev: 1, coins: 0 }, { guardRev: 0, coins: 9 }) === 'existing', 'a pre-reset backup cannot become the best backup again');
}
{
  const key = 'write-key-24-characters';
  const badKey = G.guardCloudPut({ wkey: key, reset_gen: 0, updated_at: new Date(T0).toISOString(), data: { coins: 100, stars: {} } }, { code: 'ABCD2345', key: 'nope-nope-nope-nope', data: { coins: 1, stars: {} } }, { now: T0 });
  ok(badKey.ok === false && badKey.error === 'key', 'cloud write without the matching key is rejected');
  const stale = G.guardCloudPut({ wkey: key, reset_gen: 2, updated_at: new Date(T0).toISOString(), data: { coins: 0, stars: {} } }, { code: 'ABCD2345', key, data: { coins: 50, stars: {}, guardRev: 0 } }, { now: T0 });
  ok(stale.ok === false && stale.error === 'stale', 'cloud write from before the cloud reset generation is rejected');
  const jump = G.guardCloudPut({ wkey: key, reset_gen: 0, updated_at: new Date(T0).toISOString(), data: { coins: 1000, stars: { 1: 2 } } }, { code: 'ABCD2345', key, data: { coins: 2000000000, stars: { 1: 9 } } }, { now: T0 });
  ok(jump.ok && jump.data.coins === 1000 && jump.data.stars[1] === 3, 'cloud coin jumps are cut and star counts stay in the 0..3 range');
  const okPut = G.guardCloudPut({ wkey: key, reset_gen: 0, updated_at: new Date(T0).toISOString(), data: { coins: 1000, stars: { 1: 2 }, album: ['lotta'] } }, { code: 'ABCD2345', key, data: { coins: 5000, stars: { 1: 3 }, album: ['lotta'] } }, { now: T0 + DAY });
  ok(okPut.ok && okPut.data.coins === 5000 && okPut.data.album[0] === 'lotta', 'a normal cloud update keeps the save and the new earnings');
  const created = G.guardCloudPut(null, { code: 'NEWCODE1', key, data: { coins: 2000000000, stars: { 1: 1 }, v: 2 } }, { now: T0 });
  ok(created.ok && created.data.coins === BH.FIRST_SYNC_COINS, 'a new cloud code cannot be born with a multi-billion balance');
}

/* ---- published files and the SQL text ---- */
{
  const sql = fs.readFileSync(path.join(root, 'sql/6.07_anticheat.sql'), 'utf8');
  const one = fs.readFileSync(path.join(root, '6.07/stats-setup-6.07.sql'), 'utf8').replace(/\n$/, '');
  ok(!one.includes('\n'), 'owner migration file is a single line');
  const minify = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
  ok(minify(sql) === one.trim(), 'one-line migration matches the reviewed SQL');
  for (const n of [BH.ABS_COIN_MAX, BH.FIRST_SYNC_COINS, BH.EARN_PER_DAY, BH.RESET_COIN_BURST, BH.RESET_BOARD_BURST, BH.BOARD_PER_DAY, BH.STRUCT_BOARDS, BH.STRUCT_STARS, BH.STRUCT_DOGS]) {
    ok(sql.includes(String(n)), 'SQL contains guard constant ' + n);
  }
  ok(/revoke all on function public\.bh_admin_reset\(text, text\) from public, anon, authenticated/i.test(sql), 'admin reset is not executable by the public game key');
  ok(/grant execute on function public\.player_put\(jsonb, text\) to anon/i.test(sql), 'the game may call player_put');
  ok(!/update\s+public\.players\s+set\s+coins\s*=\s*0/i.test(sql), 'the migration itself does not zero every player');
  ok(!/dvmufututcxyanfovikm|eyJ|sb_publishable|sb_secret|service_role/i.test(sql), 'migration file has no project secrets');
  const html = fs.readFileSync(path.join(root, '6.07/index.html'), 'utf8');
  const marked = html.match(/\/\*BH_GUARD_BEGIN\*\/([\s\S]*?)\/\*BH_GUARD_END\*\//);
  ok(marked && marked[1].trim() === fs.readFileSync(path.join(root, 'tools/bh_guard.js'), 'utf8').trim(), '6.07 client carries the same guard source the tests run');
  ok(/const VERSION = '6\.07'/.test(html), '6.07 build version');
  ok(/r\.coins = fairCoins603\(\)/.test(html), 'intentional code bones are still removed from the leaderboard payload');
  ok(/CHEAT603 = \{ salt:/.test(html) && /bones: 100000/.test(html), 'the +100k code is unchanged');
  ok(/function adoptAccountReset/.test(html) && /shouldBlockStaleMerge/.test(html), 'client installs reset adoption and stale-merge refusal');
  const sw = fs.readFileSync(path.join(root, '6.07/sw.js'), 'utf8');
  ok(/betri-hundar-6\.07/.test(sw), '6.07 service worker cache name');
  ok(fs.readFileSync(path.join(root, '6.06/sw.js'), 'utf8').includes('betri-hundar-6.06'), 'published 6.06 service worker was not retargeted');
  ok(fs.readFileSync(path.join(root, 'index.html')).equals(fs.readFileSync(path.join(root, '6.06/index.html'))), 'root index stays byte-identical to published 6.06');
}

console.log('bh_guard tests ok (' + pass + ')');
