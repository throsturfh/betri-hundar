/* Betri Hundar 6.07 reset guard.
   The leaderboard is client-authoritative. This module does not cap coins, boards, or rewards.
   It only describes two server facts the 6.07 client also honours:
   - a device key, once stored for a row, is required on later writes
   - an admin reset seals that one row so a later anon write cannot change its progress
   Legacy rows have no secret owner: the player id is public. Sealing is how a targeted
   reset stays sealed. It does not prove who earned a balance. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BHG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function num(v) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.floor(n);
  }
  function iso(ms) { return new Date(ms).toISOString(); }
  function fairReportedCoins(d) {
    d = d || {};
    return Math.max(0, num(d.coins) - Math.max(0, num(d.cheatBones)));
  }
  function yardEmpty(y) {
    if (y == null || typeof y !== 'object') return true;
    const p = y.p53;
    if (p && typeof p === 'object') {
      if (Array.isArray(p.won) && p.won.some(v => num(v) > 0)) return false;
      if (num(p.st) > 0) return false;
    }
    return true;
  }
  function isEmptyReset(row) {
    return !!(row && (row.sealed || (num(row.sync_rev) > 0 && num(row.boards_won) === 0 && num(row.coins) === 0 && num(row.stars) === 0 && num(row.dogs) === 0 && yardEmpty(row.yard))));
  }
  function guardPlayerRow(oldRow, newRow, opt) {
    opt = opt || {};
    const now = opt.now != null ? opt.now : Date.now();
    if (!newRow || typeof newRow !== 'object' || Array.isArray(newRow)) return { reject: 'row', reasons: ['row'] };
    const id = String(newRow.player_id == null ? '' : newRow.player_id);
    if (id.length < 1 || id.length > 64) return { reject: 'player_id', reasons: ['player_id'] };
    if (oldRow && String(oldRow.player_id) !== id) return { reject: 'player_id', reasons: ['player_id'] };
    if (opt.storedKey && opt.key !== opt.storedKey) return { reject: 'key', reasons: ['key'] };
    const name = String(newRow.name == null ? (oldRow && oldRow.name) || '' : newRow.name).replace(/[\u0000-\u001f]/g, '').slice(0, 30);
    if (!oldRow) {
      const row = Object.assign({}, newRow, { player_id: id, name, sealed: false, sync_rev: 0, reset_at: null, last_played: iso(now) });
      return { row, reject: null, frozen: false, reasons: [] };
    }
    if (oldRow.sealed) {
      const row = Object.assign({}, oldRow, { last_played: iso(now) });
      return { row, reject: null, frozen: true, reasons: ['sealed'] };
    }
    const row = Object.assign({}, oldRow, newRow, {
      player_id: id, name, sealed: false, sync_rev: num(oldRow.sync_rev),
      reset_at: oldRow.reset_at || null, first_seen: oldRow.first_seen || iso(now), last_played: iso(now),
    });
    return { row, reject: null, frozen: false, reasons: [] };
  }
  function guardCloudPut(existing, input) {
    const code = String(input && input.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const key = String(input && input.key || '');
    const data = input && input.data;
    if (code.length < 8 || code.length > 12) return { ok: false, error: 'code' };
    if (key.length < 16) return { ok: false, error: 'key' };
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'data' };
    if (JSON.stringify(data).length > 400000) return { ok: false, error: 'size' };
    if (!existing) return { ok: true, code, key, data, reset_gen: 0 };
    if (existing.wkey !== key) return { ok: false, error: 'key' };
    if (num(existing.reset_gen) > 0) return { ok: false, error: 'sealed' };
    return { ok: true, code, key, data, reset_gen: 0 };
  }
  function cloneState(state) {
    return JSON.parse(JSON.stringify(state || { players: {}, clouds: {}, backups: [] }));
  }
  function adminReset(state, playerId, cloudCode, nowMs) {
    const s = cloneState(state);
    const row = s.players[playerId];
    if (!row) return { ok: false, error: 'missing', state: s };
    const now = nowMs != null ? nowMs : Date.now();
    const rev = num(row.sync_rev) + 1;
    const backup = { id: (s.backups.length || 0) + 1, player_id: playerId, at: iso(now), player: JSON.parse(JSON.stringify(row)), cloud: null };
    if (cloudCode) {
      const code = String(cloudCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (s.clouds[code]) {
        backup.cloud = JSON.parse(JSON.stringify(s.clouds[code]));
        s.clouds[code] = Object.assign({}, s.clouds[code], {
          reset_gen: num(s.clouds[code].reset_gen) + 1,
          updated_at: iso(now),
          data: { coins: 0, stars: {}, album: [], v: 2 },
        });
      }
    }
    s.players[playerId] = Object.assign({}, row, {
      board_reached: 1, boards_won: 0, stars: 0, wins: 0, losses: 0,
      daily_played: 0, daily_won: 0, dogs: 0, coins: 0, yard: null,
      sealed: true, sync_rev: rev, reset_at: iso(now), last_played: iso(now),
    });
    s.backups.push(backup);
    return { ok: true, sync_rev: rev, backup_id: backup.id, state: s };
  }
  function adoptServerRev(save, serverRow, nowMs, opt) {
    opt = opt || {};
    const rev = serverRow && num(serverRow.sync_rev);
    if (!save || !serverRow || !(rev > num(save.resetEpoch))) return null;
    const now = nowMs != null ? nowMs : Date.now();
    if (serverRow.sealed || isEmptyReset(serverRow)) {
      return {
        coins: 0, stars: {}, album: [], tips: {}, daily: {}, mute: !!save.mute, speed: save.speed || 1, v: 2, econ: 1,
        playerId: opt.mintId || null, playerKey: opt.mintKey || null, playerName: save.playerName,
        nameAsked: !!(save.nameAsked || save.playerName), statsOff: !!save.statsOff, owner: save.owner,
        resetEpoch: rev,
      };
    }
    return Object.assign({}, save, { resetEpoch: rev });
  }
  function shouldBlockStaleMerge(mine, other) {
    if (!mine || !other || typeof other !== 'object') return false;
    return num(mine.resetEpoch) > num(other.resetEpoch);
  }
  function backupPreference(existingSave, incomingSave) {
    const er = existingSave && num(existingSave.resetEpoch);
    const ir = incomingSave && num(incomingSave.resetEpoch);
    if (ir > er) return 'incoming';
    if (er > ir) return 'existing';
    return 'score';
  }
  return {
    num, fairReportedCoins, yardEmpty, isEmptyReset, guardPlayerRow, guardCloudPut, adminReset, adoptServerRev,
    shouldBlockStaleMerge, backupPreference,
  };
});
