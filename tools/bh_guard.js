/* Betri Hundar 6.07 progress guard.
   The browser cannot prove offline play. This is the shared spec for the server trigger
   (sql/6.07_anticheat.sql) and the 6.07 client: implausible leaderboard writes are reduced
   or frozen, and an admin reset of one row cannot be merged back from an older save.
   Local puzzle progress is never edited here. No real-money values. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BHG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BH = {
    ABS_COIN_MAX: 200000000,
    FIRST_SYNC_COINS: 20000000,
    EARN_PER_DAY: 24000000,
    RESET_COIN_BURST: 1000000,
    RESET_BOARD_BURST: 8,
    BOARD_PER_DAY: 24,
    STRUCT_BOARDS: 100,
    STRUCT_STARS: 400,
    STRUCT_DOGS: 400,
    STRUCT_DAILY: 5000,
    STRUCT_WINS: 100000,
    STRUCT_YARD_STARS: 4000,
    YARD_PHASES: 10,
    DOG_EXTRA: 40,
    INT_MAX: 2147483647,
    S531: { it: 400, yl: 21, cab: 50, mg: 100000, sh: 10000, wkw: 520, med: 10000, ci: 500 },
  };

  function num(v) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.floor(n);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, num(v))); }
  function iso(ms) { return new Date(ms).toISOString(); }
  function elapsedSec(fromIso, now) {
    const t = Date.parse(fromIso || '');
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, (now - t) / 1000);
  }
  function monoCap(oldV, reqV, ceil) {
    const o = Math.max(0, num(oldV));
    const r = Math.max(0, num(reqV));
    return Math.min(Math.max(o, num(ceil)), Math.max(o, r));
  }
  function fairReportedCoins(d) {
    d = d || {};
    return Math.max(0, num(d.coins) - Math.max(0, num(d.cheatBones)));
  }
  function starBoards(d) {
    const st = d && d.stars;
    if (!st || typeof st !== 'object') return 0;
    return Object.keys(st).filter(k => num(st[k]) > 0).length;
  }
  function starSum(d) {
    const st = d && d.stars;
    if (!st || typeof st !== 'object') return 0;
    return Object.keys(st).reduce((a, k) => a + Math.max(0, num(st[k])), 0);
  }
  function phaseBoards(d) {
    let n = starBoards(d);
    const v5 = d && d.v5;
    const addGs = gs => { if (gs && typeof gs === 'object') n += Object.keys(gs).filter(k => num(gs[k]) > 0).length; };
    if (v5 && typeof v5 === 'object') {
      addGs(v5.gs);
      const mats = v5.mats;
      if (mats && typeof mats === 'object') for (const m of Object.keys(mats)) addGs(mats[m] && mats[m].gs);
    }
    return n;
  }
  function coinCeilingNormal(oldCoins, elapsed) {
    const old = Math.max(0, Math.min(BH.INT_MAX, num(oldCoins)));
    if (old >= BH.ABS_COIN_MAX) return old;
    const add = Math.floor(BH.EARN_PER_DAY * Math.max(0, elapsed) / 86400);
    return Math.min(BH.ABS_COIN_MAX, old + add);
  }
  function coinCeilingReset(resetAtIso, now, anchor) {
    const base = Math.max(0, num(anchor));
    if (base >= BH.ABS_COIN_MAX) return base;
    const days = elapsedSec(resetAtIso, now) / 86400;
    return Math.min(BH.ABS_COIN_MAX, base + BH.RESET_COIN_BURST + Math.floor(BH.EARN_PER_DAY * days));
  }
  function boardCeilingReset(resetAtIso, now, anchor) {
    const base = Math.max(0, num(anchor));
    return Math.min(BH.STRUCT_BOARDS, phaseCeilingReset(resetAtIso, now, base));
  }
  function phaseCeilingReset(resetAtIso, now, anchor) {
    const base = Math.max(0, num(anchor));
    const days = elapsedSec(resetAtIso, now) / 86400;
    return Math.min(BH.STRUCT_BOARDS * BH.YARD_PHASES, base + BH.RESET_BOARD_BURST + Math.floor(BH.BOARD_PER_DAY * days));
  }
  function capUp(oldV, reqV, cap) {
    const o = Math.max(0, num(oldV));
    const r = Math.max(0, num(reqV));
    return Math.min(Math.max(o, num(cap)), Math.max(o, r));
  }
  function trimKeys(obj, maxN) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const keys = Object.keys(obj);
    if (keys.length <= maxN) return Object.assign({}, obj);
    const out = {};
    keys.sort().slice(0, maxN).forEach(k => { out[k] = obj[k]; });
    return out;
  }
  function clampWk(wk) {
    if (!wk || typeof wk !== 'object' || Array.isArray(wk)) return null;
    const w = String(wk.w || '');
    if (!/^\d{4}-V\d\d$/.test(w)) return null;
    return { w, won: clamp(wk.won, 0, 1), st: clamp(wk.st, 0, 3), mv: clamp(wk.mv, 0, 5000), t: clamp(wk.t, 0, 7200), n: clamp(wk.n, 0, 1000) };
  }
  function clampS531(oldS, reqS, tight) {
    const o = oldS && typeof oldS === 'object' ? oldS : {};
    const r = reqS && typeof reqS === 'object' ? reqS : {};
    const medO = o.med && typeof o.med === 'object' ? o.med : {};
    const medR = r.med && typeof r.med === 'object' ? r.med : {};
    const caps = tight ? { it: 20 + tight, yl: 1 + Math.min(3, tight), cab: 4 + tight, mg: 10 + tight * 2, sh: 4 + tight, wkw: 1 + Math.floor(tight / 8), med: 2 + tight, ci: 20 + tight } : BH.S531;
    const sh = capUp(o.sh, r.sh, caps.sh);
    return {
      v: 1,
      it: capUp(o.it, r.it, caps.it),
      yl: capUp(o.yl, r.yl, caps.yl),
      cab: capUp(o.cab, r.cab, caps.cab),
      ci: capUp(o.ci, r.ci, caps.ci),
      mg: capUp(o.mg, r.mg, caps.mg),
      sh,
      shw: Math.min(sh, capUp(o.shw, r.shw, caps.sh)),
      wkw: capUp(o.wkw, r.wkw, caps.wkw),
      med: { g: capUp(medO.g, medR.g, caps.med), s: capUp(medO.s, medR.s, caps.med), b: capUp(medO.b, medR.b, caps.med) },
    };
  }
  function intList(raw, cap) {
    const src = Array.isArray(raw) ? raw : [];
    const out = [];
    for (let i = 0; i < BH.YARD_PHASES; i++) out.push(clamp(src[i], 0, cap));
    return out;
  }
  function clampYard(oldYard, newYard, maxWonSum) {
    if (newYard == null) return oldYard == null ? null : oldYard;
    if (typeof newYard !== 'object' || Array.isArray(newYard)) return oldYard || null;
    let raw;
    try { raw = JSON.parse(JSON.stringify(newYard)); } catch (e) { return oldYard || null; }
    if (JSON.stringify(raw).length > 400000) return oldYard || null;
    const old = oldYard && typeof oldYard === 'object' && !Array.isArray(oldYard) ? oldYard : {};
    const tight = maxWonSum == null ? null : maxWonSum;
    const op = old.p53 && typeof old.p53 === 'object' ? old.p53 : {};
    const np = raw.p53 && typeof raw.p53 === 'object' ? raw.p53 : null;
    if (np) {
      const oldWon = intList(op.won, BH.STRUCT_BOARDS);
      let won = intList(np.won, BH.STRUCT_BOARDS).map((v, i) => Math.max(oldWon[i], v));
      const sumCap = tight == null ? BH.STRUCT_BOARDS * BH.YARD_PHASES : Math.max(oldWon.reduce((a, v) => a + v, 0), tight);
      let sum = won.reduce((a, v) => a + v, 0);
      for (let i = won.length - 1; i >= 0 && sum > sumCap; i--) {
        const drop = Math.min(won[i] - oldWon[i], sum - sumCap);
        if (drop > 0) { won[i] -= drop; sum -= drop; }
      }
      const oldDogs = intList(op.dogs, BH.STRUCT_DOGS);
      const dogCap = tight == null ? BH.STRUCT_DOGS : Math.min(BH.STRUCT_DOGS, tight + BH.DOG_EXTRA);
      let dogs = intList(np.dogs, BH.STRUCT_DOGS).map((v, i) => Math.max(oldDogs[i], v));
      let dsum = dogs.reduce((a, v) => a + v, 0);
      const dcap = tight == null ? BH.STRUCT_DOGS * BH.YARD_PHASES : Math.max(oldDogs.reduce((a, v) => a + v, 0), dogCap);
      for (let i = dogs.length - 1; i >= 0 && dsum > dcap; i--) {
        const drop = Math.min(dogs[i] - oldDogs[i], dsum - dcap);
        if (drop > 0) { dogs[i] -= drop; dsum -= drop; }
      }
      const wonSum = won.reduce((a, v) => a + v, 0);
      const stCap = tight == null ? Math.max(BH.STRUCT_YARD_STARS, num(op.st)) : Math.max(num(op.st), Math.min(BH.STRUCT_YARD_STARS, wonSum * 3 + 30));
      const st = Math.min(stCap, Math.max(num(op.st), clamp(np.st, 0, BH.STRUCT_YARD_STARS)));
      raw.p53 = Object.assign({}, np, {
        won, dogs, st, tot: dogs.reduce((a, v) => a + v, 0),
        cp: clamp(np.cp, -1, 8), b: clamp(np.b == null ? 1 : np.b, 1, 100),
      });
    }
    if (raw.s531 && typeof raw.s531 === 'object') raw.s531 = clampS531(old.s531, raw.s531, tight);
    if ('wk' in raw) {
      const wk = clampWk(raw.wk);
      if (wk) raw.wk = wk; else delete raw.wk;
    }
    const slotCap = tight == null ? 400 : Math.min(400, 30 + (tight | 0));
    if (raw.slots && typeof raw.slots === 'object') raw.slots = trimKeys(raw.slots, slotCap);
    if (raw.gear && typeof raw.gear === 'object') raw.gear = trimKeys(raw.gear, 400);
    return raw;
  }
  function clampStarMap(oldMap, newMap) {
    if (!newMap || typeof newMap !== 'object' || Array.isArray(newMap)) return oldMap && typeof oldMap === 'object' ? oldMap : {};
    const old = oldMap && typeof oldMap === 'object' ? oldMap : {};
    const out = {};
    for (const k of Object.keys(newMap)) {
      const o = Math.max(0, num(old[k]));
      const r = Math.max(0, num(newMap[k]));
      out[k] = Math.min(Math.max(3, o), Math.max(o, r));
    }
    return out;
  }
  function blankRow(id, now) {
    return {
      player_id: id, name: '', version: '', board_reached: 1, boards_won: 0, stars: 0, wins: 0, losses: 0,
      daily_played: 0, daily_won: 0, dogs: 0, coins: 0, sync_rev: 0, reset_at: null, yard: null,
      first_seen: iso(now), last_played: iso(now),
    };
  }
  function guardPlayerRow(oldRow, newRow, opt) {
    opt = opt || {};
    const now = opt.now != null ? opt.now : Date.now();
    const ack = num(opt.ack);
    const reasons = [];
    if (!newRow || typeof newRow !== 'object' || Array.isArray(newRow)) return { reject: 'row', reasons: ['row'] };
    const id = String(newRow.player_id == null ? '' : newRow.player_id);
    if (id.length < 1 || id.length > 64) return { reject: 'player_id', reasons: ['player_id'] };
    if (oldRow && String(oldRow.player_id) !== id) return { reject: 'player_id', reasons: ['player_id'] };
    if (opt.storedKey && opt.key !== opt.storedKey) return { reject: 'key', reasons: ['key'] };
    const name = String(newRow.name == null ? (oldRow && oldRow.name) || '' : newRow.name).replace(/[\u0000-\u001f]/g, '').slice(0, 30);
    if (!oldRow) {
      const row = blankRow(id, now);
      row.name = name;
      row.version = String(newRow.version || '').slice(0, 40);
      row.board_reached = clamp(newRow.board_reached == null ? 1 : newRow.board_reached, 1, BH.STRUCT_BOARDS);
      row.boards_won = clamp(newRow.boards_won, 0, BH.STRUCT_BOARDS);
      row.stars = clamp(newRow.stars, 0, BH.STRUCT_STARS);
      row.wins = clamp(newRow.wins, 0, BH.STRUCT_WINS);
      row.losses = clamp(newRow.losses, 0, BH.STRUCT_WINS);
      row.daily_played = clamp(newRow.daily_played, 0, BH.STRUCT_DAILY);
      row.daily_won = clamp(newRow.daily_won, 0, row.daily_played);
      row.dogs = clamp(newRow.dogs, 0, BH.STRUCT_DOGS);
      row.coins = clamp(newRow.coins, 0, BH.FIRST_SYNC_COINS);
      row.yard = clampYard(null, newRow.yard, null);
      if (num(newRow.coins) !== row.coins) reasons.push('coins');
      if (num(newRow.boards_won) !== row.boards_won) reasons.push('boards_won');
      if (newRow.yard && JSON.stringify(row.yard) !== JSON.stringify(newRow.yard)) reasons.push('yard');
      return { row, reject: null, frozen: false, reasons };
    }
    const rev = num(oldRow.sync_rev);
    const row = Object.assign({}, oldRow, {
      player_id: id, name, version: String(newRow.version || oldRow.version || '').slice(0, 40),
      last_played: iso(now), sync_rev: rev, reset_at: oldRow.reset_at || null, first_seen: oldRow.first_seen || iso(now),
    });
    if (rev > ack) {
      row.board_reached = oldRow.board_reached;
      row.boards_won = oldRow.boards_won;
      row.stars = oldRow.stars;
      row.wins = oldRow.wins;
      row.losses = oldRow.losses;
      row.daily_played = oldRow.daily_played;
      row.daily_won = oldRow.daily_won;
      row.dogs = oldRow.dogs;
      row.coins = oldRow.coins;
      row.yard = oldRow.yard == null ? null : oldRow.yard;
      reasons.push('stale');
      return { row, reject: null, frozen: true, reasons };
    }
    const resetMode = rev > 0;
    const days = resetMode ? elapsedSec(oldRow.reset_at, now) / 86400 : 0;
    const elapsed = elapsedSec(oldRow.last_played, now);
    const phaseCeil = resetMode ? phaseCeilingReset(oldRow.reset_at, now, 0) : BH.STRUCT_BOARDS * BH.YARD_PHASES;
    const boardCeil = resetMode ? boardCeilingReset(oldRow.reset_at, now, 0) : Math.max(BH.STRUCT_BOARDS, num(oldRow.boards_won));
    const coinCeil = resetMode ? coinCeilingReset(oldRow.reset_at, now, 0) : coinCeilingNormal(oldRow.coins, elapsed);
    const starCeil = resetMode ? Math.min(BH.STRUCT_STARS, boardCeil * 3) : Math.max(BH.STRUCT_STARS, num(oldRow.stars));
    const dogCeil = resetMode ? Math.min(BH.STRUCT_DOGS, boardCeil + BH.DOG_EXTRA) : Math.max(BH.STRUCT_DOGS, num(oldRow.dogs));
    const dailyCeil = resetMode ? Math.min(BH.STRUCT_DAILY, Math.max(2, Math.floor(days) + 2)) : Math.max(BH.STRUCT_DAILY, num(oldRow.daily_played));
    const winCeil = resetMode ? Math.min(BH.STRUCT_WINS, boardCeil * 5 + 20) : Math.max(BH.STRUCT_WINS, num(oldRow.wins), num(oldRow.losses));
    row.boards_won = monoCap(oldRow.boards_won, newRow.boards_won, boardCeil);
    row.stars = monoCap(oldRow.stars, newRow.stars, Math.max(starCeil, num(oldRow.stars)));
    row.dogs = monoCap(oldRow.dogs, newRow.dogs, Math.max(dogCeil, num(oldRow.dogs)));
    row.daily_played = monoCap(oldRow.daily_played, newRow.daily_played, Math.max(dailyCeil, num(oldRow.daily_played)));
    row.daily_won = monoCap(oldRow.daily_won, newRow.daily_won, row.daily_played);
    row.wins = monoCap(oldRow.wins, newRow.wins, Math.max(winCeil, num(oldRow.wins)));
    row.losses = monoCap(oldRow.losses, newRow.losses, Math.max(winCeil, num(oldRow.losses)));
    row.board_reached = clamp(newRow.board_reached == null ? oldRow.board_reached : newRow.board_reached, 1, BH.STRUCT_BOARDS);
    const reqCoins = Math.max(0, Math.min(BH.INT_MAX, num(newRow.coins)));
    const oldCoins = Math.max(0, num(oldRow.coins));
    row.coins = reqCoins <= oldCoins ? reqCoins : Math.min(reqCoins, coinCeil);
    row.yard = clampYard(oldRow.yard, newRow.yard == null ? oldRow.yard : newRow.yard, resetMode ? phaseCeil : null);
    if (row.coins !== reqCoins) reasons.push('coins');
    if (row.boards_won !== Math.max(num(oldRow.boards_won), num(newRow.boards_won))) reasons.push('boards_won');
    if (row.stars !== Math.max(num(oldRow.stars), num(newRow.stars))) reasons.push('stars');
    return { row, reject: null, frozen: false, reasons, coinCeil, boardCeil };
  }
  function guardCloudPut(existing, input, opt) {
    opt = opt || {};
    const now = opt.now != null ? opt.now : Date.now();
    const code = String(input && input.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const key = String(input && input.key || '');
    const data = input && input.data;
    if (code.length < 8 || code.length > 12) return { ok: false, error: 'code' };
    if (key.length < 16) return { ok: false, error: 'key' };
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'data' };
    if (JSON.stringify(data).length > 400000) return { ok: false, error: 'size' };
    if (!existing) {
      const coins = clamp(data.coins, 0, BH.FIRST_SYNC_COINS);
      const stored = Object.assign({}, data, { coins, stars: clampStarMap(null, data.stars) });
      return { ok: true, code, key, data: stored, reset_gen: 0, updated_at: iso(now) };
    }
    if (existing.wkey !== key) return { ok: false, error: 'key' };
    const gen = num(existing.reset_gen);
    if (gen > 0 && num(data.guardRev) < gen) return { ok: false, error: 'stale' };
    const elapsed = elapsedSec(existing.updated_at, now);
    const oldCoins = Math.max(0, num(existing.data && existing.data.coins));
    const req = Math.max(0, Math.min(BH.INT_MAX, num(data.coins)));
    const coins = req <= oldCoins ? req : Math.min(req, coinCeilingNormal(oldCoins, elapsed));
    const stored = Object.assign({}, data, { coins, stars: clampStarMap(existing.data && existing.data.stars, data.stars) });
    return { ok: true, code, key, data: stored, reset_gen: gen, updated_at: iso(now), clampedCoins: coins !== req };
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
        const gen = num(s.clouds[code].reset_gen) + 1;
        s.clouds[code].reset_gen = gen;
        s.clouds[code].updated_at = iso(now);
        s.clouds[code].data = { coins: 0, stars: {}, album: [], v: 2, guardRev: gen };
      }
    }
    s.players[playerId] = Object.assign({}, row, {
      board_reached: 1, boards_won: 0, stars: 0, wins: 0, losses: 0,
      daily_played: 0, daily_won: 0, dogs: 0, coins: 0, yard: null,
      sync_rev: rev, reset_at: iso(now), last_played: iso(now),
    });
    s.backups.push(backup);
    return { ok: true, sync_rev: rev, backup_id: backup.id, state: s };
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
    return !!(row && num(row.sync_rev) > 0 && num(row.boards_won) === 0 && num(row.coins) === 0 && num(row.stars) === 0 && num(row.dogs) === 0 && yardEmpty(row.yard));
  }
  function adoptServerRev(save, serverRow, nowMs) {
    const rev = serverRow && num(serverRow.sync_rev);
    if (!save || !serverRow || rev <= num(save.guardRev)) return null;
    const now = nowMs != null ? nowMs : Date.now();
    if (isEmptyReset(serverRow)) {
      return {
        coins: 0, stars: {}, album: [], tips: {}, daily: {}, mute: !!save.mute, speed: save.speed || 1, v: 2, econ: 1,
        playerId: save.playerId, playerKey: save.playerKey, playerName: save.playerName,
        nameAsked: !!(save.nameAsked || save.playerName), statsOff: !!save.statsOff, owner: save.owner,
        cloud: save.cloud, guardRev: rev, guardAt: iso(now),
      };
    }
    return Object.assign({}, save, { guardRev: rev, guardAt: save.guardAt || iso(now) });
  }
  function shouldBlockStaleMerge(mine, other) {
    if (!mine || !other || typeof other !== 'object') return false;
    return num(mine.guardRev) > num(other.guardRev);
  }
  function shouldBlockCloud(mine, incoming, cloudRev, nowMs) {
    const rev = mine && num(mine.guardRev);
    if (!rev || !incoming || typeof incoming !== 'object') return false;
    if (num(cloudRev) >= rev) return false;
    const now = nowMs != null ? nowMs : Date.now();
    const oldRow = {
      player_id: 'local', sync_rev: rev, reset_at: mine.guardAt || iso(now), last_played: iso(now),
      coins: Math.max(0, fairReportedCoins(mine)), boards_won: Math.min(BH.STRUCT_BOARDS, phaseBoards(mine)),
      stars: Math.min(BH.STRUCT_STARS, starSum(mine)), dogs: Array.isArray(mine.album) ? Math.min(BH.STRUCT_DOGS, mine.album.length) : 0,
      wins: 0, losses: 0, daily_played: 0, daily_won: 0, yard: null,
    };
    const incomingRow = {
      player_id: 'local',
      coins: Math.max(0, num(incoming.coins)),
      boards_won: phaseBoards(incoming),
      stars: starSum(incoming),
      dogs: Array.isArray(incoming.album) ? incoming.album.length : 0,
    };
    const g = guardPlayerRow(oldRow, incomingRow, { ack: rev, now });
    if (!g || g.reject || g.frozen) return true;
    const phaseCeil = phaseCeilingReset(mine.guardAt || iso(now), now, 0);
    if (phaseBoards(incoming) > Math.max(phaseCeil, phaseBoards(mine))) return true;
    if (g.row.coins < Math.max(0, num(incoming.coins))) return true;
    return false;
  }
  function backupPreference(existingSave, incomingSave) {
    const er = existingSave && num(existingSave.guardRev);
    const ir = incomingSave && num(incomingSave.guardRev);
    if (ir > er) return 'incoming';
    if (er > ir) return 'existing';
    return 'score';
  }
  return {
    BH, num, fairReportedCoins, starBoards, starSum, phaseBoards, coinCeilingNormal, coinCeilingReset, boardCeilingReset, phaseCeilingReset,
    clampYard, clampStarMap, guardPlayerRow, guardCloudPut, adminReset, isEmptyReset, adoptServerRev,
    shouldBlockStaleMerge, shouldBlockCloud, backupPreference, yardEmpty,
  };
});
