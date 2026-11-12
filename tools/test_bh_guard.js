#!/usr/bin/env node
/* No network and no live database. Economy caps are intentionally absent. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('./bh_guard.js');
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
    coins: 80000, sealed: false, sync_rev: 0, reset_at: null,
    yard: { v: 1, lvl: 2, slots: { m1: 'sign' }, p53: { won: [39], dogs: [39], st: 70, cp: -1, b: 40 } },
    first_seen: new Date(T0 - 7 * DAY).toISOString(), last_played: new Date(T0).toISOString(),
  }, over);
}
function put(old, neu, opt) {
  return G.guardPlayerRow(old, Object.assign({ player_id: old ? old.player_id : neu.player_id, name: 'Leikmaður' }, neu), opt);
}

{
  const old = row();
  const g = put(old, { coins: 80000, boards_won: 39, stars: 70, dogs: 39, wins: 36, losses: 18, yard: old.yard }, { now: T0 + DAY });
  ok(!g.reject && !g.frozen && g.row.coins === 80000 && g.row.boards_won === 39 && g.row.stars === 70, 'a board-39 save is stored unchanged');
}
{
  const old = row({ coins: 1800000000, boards_won: 100, stars: 300, dogs: 120, wins: 37, losses: 61 });
  const g = put(old, { coins: 1900000000, boards_won: 140, stars: 420, dogs: 180, wins: 37, losses: 61 }, { now: T0 + 1000 });
  ok(!g.reject && g.row.coins === 1900000000 && g.row.boards_won === 140 && g.row.stars === 420 && g.row.dogs === 180, 'an existing high balance and a large offline jump are not reduced');
  ok(g.row.wins === 37 && g.row.boards_won === 140, 'a low win count is not a reason to reject or trim the row');
}
{
  const fair = G.fairReportedCoins({ coins: 310000, cheatBones: 300000 });
  ok(fair === 10000, 'three uses of the +100k code stay off the reported total');
  const g = put(row({ coins: 10000 }), { coins: fair + 250000, boards_won: 50 }, { now: T0 + 1000 });
  ok(g.row.coins === 260000, 'reported earnings plus ordinary play are stored whole');
}
{
  const born = put(null, { player_id: 'brand-new', coins: 1800000000, boards_won: 250, stars: 900, dogs: 300, yard: { p53: { won: [100, 100, 80], st: 700 } } }, { now: T0 });
  ok(!born.reject && born.row.coins === 1800000000 && born.row.boards_won === 250 && born.row.yard.p53.won[2] === 80, 'a first sync is not capped');
  ok(born.row.sealed === false && born.row.sync_rev === 0, 'a new row is not sealed');
}
{
  const old = row();
  ok(put(old, { coins: 1 }, { storedKey: 'correct-key-0123456789', key: 'wrong-key-0123456789' }).reject === 'key', 'a stored device key rejects a different key');
  ok(!put(old, { coins: 123456 }, { now: T0 + DAY }).reject && put(old, { coins: 123456 }, { now: T0 + DAY }).row.coins === 123456, 'a legacy row with no device key still syncs its balance');
  const owned = put(old, { name: 'Nýtt nafn', coins: 80000 }, { storedKey: 'correct-key-0123456789', key: 'correct-key-0123456789' });
  ok(!owned.reject && owned.row.name === 'Nýtt nafn', 'the matching device key can update the row');
  ok(put(null, { player_id: '', coins: 1 }).reject === 'player_id', 'an empty id is rejected');
}

{
  const other = row({ player_id: 'someone-else', name: 'Annar', coins: 2222, boards_won: 12, stars: 20, dogs: 12 });
  const state = {
    players: {
      'player-existing': row({ coins: 1800000000, boards_won: 100, stars: 300, dogs: 100, yard: { p53: { won: [100], st: 300 } } }),
      'someone-else': other,
    },
    clouds: { ABCD2345: { wkey: 'k'.repeat(24), reset_gen: 0, data: { coins: 1800000000, stars: { 1: 3 }, album: ['a'] } } },
    backups: [],
  };
  const beforeOther = JSON.stringify(state.players['someone-else']);
  const reset = G.adminReset(state, 'player-existing', 'ABCD2345', T0);
  ok(reset.ok && reset.sync_rev === 1 && reset.state.players['player-existing'].sealed === true, 'targeted reset seals that row and bumps the generation');
  ok(JSON.stringify(reset.state.players['someone-else']) === beforeOther, 'reset does not change any other player');
  const cleared = reset.state.players['player-existing'];
  ok(cleared.coins === 0 && cleared.boards_won === 0 && cleared.yard == null && cleared.name === 'Leikmaður', 'reset clears progress and keeps the row id');
  ok(reset.state.clouds.ABCD2345.reset_gen === 1 && reset.state.clouds.ABCD2345.data.coins === 0, 'a supplied cloud code is retired with the reset');
  ok(reset.state.backups[0].player.coins === 1800000000, 'the pre-reset row is kept in the private backup');

  const stale = put(cleared, { coins: 1800000000, boards_won: 100, stars: 300, dogs: 100, yard: { p53: { won: [100], st: 300 } } }, { now: T0 + DAY, ack: 1 });
  ok(stale.frozen && stale.row.coins === 0 && stale.row.boards_won === 0 && stale.row.yard == null, 'a later upload cannot restore a sealed row, even if it echoes the generation');
  const again = put(stale.row, { coins: 1800000000, boards_won: 500 }, { now: T0 + 2 * DAY, ack: 99 });
  ok(again.row.coins === 0 && again.row.boards_won === 0, 'repeating the upload still cannot unseal the row');

  const fresh = { playerId: 'player-existing', playerName: 'Leikmaður', coins: 1800000000, stars: { 1: 3 }, album: ['a'], cheatBones: 100000, resetEpoch: 0, mute: true, cloud: { code: 'ABCD2345', key: 'secret' } };
  const wiped = G.adoptServerRev(fresh, cleared, T0, { mintId: 'new-id', mintKey: 'new-key-0123456789abcd' });
  ok(wiped && wiped.coins === 0 && wiped.resetEpoch === 1 && wiped.playerId === 'new-id' && wiped.playerKey === 'new-key-0123456789abcd' && wiped.playerName === 'Leikmaður' && wiped.mute === true && !wiped.cloud, '6.07 drops the sealed progress and continues under a new id');
  const keep = G.adoptServerRev(fresh, Object.assign({}, cleared, { sealed: false, coins: 1800000000, boards_won: 100, stars: 300, dogs: 100, yard: { p53: { won: [100], st: 300 } } }), T0);
  ok(keep.coins === 1800000000 && keep.stars[1] === 3 && keep.playerId === 'player-existing' && keep.resetEpoch === 1, 'a generation bump that is not a seal does not wipe local progress');
}

{
  const mine = { coins: 0, stars: {}, album: [], resetEpoch: 1 };
  ok(G.shouldBlockStaleMerge(mine, { coins: 1800000000, stars: { 1: 3 }, resetEpoch: 0 }), 'a pre-reset backup cannot merge over the reset');
  ok(!G.shouldBlockStaleMerge(mine, { coins: 10, stars: {}, resetEpoch: 1 }), 'progress from the new life can still merge');
  ok(!G.shouldBlockStaleMerge({ resetEpoch: 0, coins: 10 }, { coins: 20, resetEpoch: 0 }), 'saves that were never reset merge as before');
  ok(G.backupPreference({ resetEpoch: 0, coins: 9 }, { resetEpoch: 1, coins: 0 }) === 'incoming', 'the post-reset save replaces a richer pre-reset backup');
  ok(G.backupPreference({ resetEpoch: 1, coins: 0 }, { resetEpoch: 0, coins: 9 }) === 'existing', 'a pre-reset backup cannot become the best backup again');
}
{
  const key = 'write-key-24-characters';
  const existing = { wkey: key, reset_gen: 0, data: { coins: 1800000000, stars: { 1: 3 } } };
  ok(G.guardCloudPut(existing, { code: 'ABCD2345', key: 'nope-nope-nope-nope', data: { coins: 1, stars: {} } }).error === 'key', 'cloud write without the matching key is rejected');
  const kept = G.guardCloudPut(existing, { code: 'ABCD2345', key, data: { coins: 1900000000, stars: { 1: 3 }, album: ['lotta'] } });
  ok(kept.ok && kept.data.coins === 1900000000 && kept.data.album[0] === 'lotta', 'an unsealed cloud save stores the client balance whole');
  const sealed = Object.assign({}, existing, { reset_gen: 1, data: { coins: 0, stars: {} } });
  const stale = G.guardCloudPut(sealed, { code: 'ABCD2345', key, data: { coins: 1900000000, stars: { 1: 9 }, guardRev: 99 } });
  ok(stale.ok === false && stale.error === 'sealed', 'a retired cloud code rejects every later write, including one that claims the new generation');
}

{
  const sql = fs.readFileSync(path.join(root, 'sql/6.07_anticheat.sql'), 'utf8');
  const one = fs.readFileSync(path.join(root, '6.07/stats-setup-6.07.sql'), 'utf8').replace(/\n$/, '');
  ok(!one.includes('\n'), 'owner migration file is a single line');
  const minify = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
  ok(minify(sql) === one.trim(), 'one-line migration matches the reviewed SQL');
  ok(!/200000000|24000000|20000000|EARN_PER_DAY|BOARD_PER_DAY|RESET_COIN|FIRST_SYNC/.test(sql), 'migration has no blanket coin or board ceilings');
  ok(/revoke all on function public\.bh_admin_reset\(text, text\) from public, anon, authenticated/i.test(sql), 'admin reset is not executable by the public game key');
  ok(/grant execute on function public\.player_put\(jsonb, text\) to anon/i.test(sql), 'the game may call player_put');
  ok(!/update\s+public\.players\s+set[\s\S]*coins\s*=\s*0/i.test(sql.replace(/function public\.bh_admin_reset[\s\S]*?\$\$;/i, '')), 'the migration statement itself does not zero players');
  ok(/sealed = true/.test(sql) && /player_reset_backup/.test(sql), 'targeted reset still seals one row and writes a private backup');
  const html = fs.readFileSync(path.join(root, '6.07/index.html'), 'utf8');
  const marked = html.match(/\/\*BH_GUARD_BEGIN\*\/([\s\S]*?)\/\*BH_GUARD_END\*\//);
  ok(marked && marked[1].trim() === fs.readFileSync(path.join(root, 'tools/bh_guard.js'), 'utf8').trim(), '6.07 client carries the same guard source the tests run');
  ok(/const VERSION = '6\.07'/.test(html), '6.07 build version');
  ok(/r\.coins = fairCoins603\(\)/.test(html) && /bones: 100000/.test(html), 'the +100k code and its leaderboard exclusion are unchanged');
  ok(/function adoptAccountReset/.test(html) && /shouldBlockStaleMerge/.test(html) && /mintId/.test(html), 'client adopts a seal by starting a new id and refuses stale merges');
  ok(!/ABS_COIN_MAX|RESET_BOARD_BURST|EARN_PER_DAY/.test(html), 'the shipped client has no blanket earn cap');
  ok(/betri-hundar-6\.07/.test(fs.readFileSync(path.join(root, '6.07/sw.js'), 'utf8')), '6.07 service worker cache name');
  ok(fs.readFileSync(path.join(root, '6.06/sw.js'), 'utf8').includes('betri-hundar-6.06'), 'published 6.06 service worker was not retargeted');
  ok(fs.readFileSync(path.join(root, 'index.html')).equals(fs.readFileSync(path.join(root, '6.06/index.html'))), 'root index stays byte-identical to published 6.06');
}

console.log('bh_guard tests ok (' + pass + ')');
