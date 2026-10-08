/* ===== Betri Hundar – shared rules engine (used by the game AND tools/solver.js) ===== */
const PL = (function () {
  'use strict';
  const COLORS = {
    R: { hex: '#ff4d5e', name: 'rauða' },
    O: { hex: '#ff9a2e', name: 'appelsínugula' },
    Y: { hex: '#ffd23f', name: 'gula' },
    G: { hex: '#3ddc84', name: 'græna' },
    C: { hex: '#3cc8f4', name: 'ljósbláa' },
    B: { hex: '#3f6df2', name: 'bláa' },
    P: { hex: '#9b5de5', name: 'fjólubláa' },
    K: { hex: '#ff7eb9', name: 'bleika' },
    W: { hex: '#f7efdc', name: 'hvíta' },
    N: { hex: '#a8693f', name: 'brúna' },
    D: { hex: '#4a4e6e', name: 'dökka' },
  };
  const SLOTS = 5;

  function parseLevel(def) {
    const rows = def.grid.trim().split(/\s+/);
    const h = rows.length, w = rows[0].length;
    const cells = [];
    rows.forEach((r, y) => {
      if (r.length !== w) throw new Error('Row ' + y + ' width ' + r.length + ' != ' + w + ' in ' + (def.name || def.id));
      for (const ch of r) {
        if (ch === '.') cells.push(null);
        else if (COLORS[ch]) cells.push(ch);
        else throw new Error('Unknown colour ' + ch);
      }
    });
    const lanes = def.lanes.split('|').map(l => l.trim().split(/\s+/).filter(Boolean).map(tok => {
      const m = /^([A-Z])(\d+)([ldh]?)$/.exec(tok);
      if (!m || !COLORS[m[1]]) throw new Error('Bad doghouse token ' + tok);
      return { c: m[1], n: +m[2], b: m[3] || 'l' };
    }));
    return { w, h, cells, lanes };
  }

  function colourCounts(cells) {
    const m = {};
    for (const c of cells) if (c) m[c] = (m[c] || 0) + 1;
    return m;
  }
  function houseCounts(lanes) {
    const m = {};
    for (const l of lanes) for (const d of l) m[d.c] = (m[d.c] || 0) + d.n;
    return m;
  }

  function newState(p) {
    return {
      w: p.w, h: p.h, cells: p.cells.slice(), lanes: p.lanes, pos: p.lanes.map(() => 0),
      slots: new Array(SLOTS).fill(null), rem: colourCounts(p.cells),
      left: p.cells.filter(Boolean).length, uid: 0, taps: 0, D: depths(p.w, p.h, p.cells),
    };
  }
  function clone(s) {
    return Object.assign({}, s, {
      cells: s.cells.slice(), pos: s.pos.slice(), rem: Object.assign({}, s.rem), D: s.D.slice(),
      slots: s.slots.map(p => p && Object.assign({}, p)),
    });
  }

  /* depth map: D[i] = number of blocks crossed to reach cell i from outside (incl. itself).
     A block is "exposed" when D==1 (touches outside through empty cells). Only depths 0..2 matter to the
     rules (dachshunds reach 2), so the 0-1 BFS stops there and everything deeper is reported as DCAP (=3).
     This keeps 24x24 boards cheap without changing behaviour. */
  const DCAP = 3;
  function depths(w, h, cells) {
    const N = w * h, D = new Int8Array(N).fill(DCAP), B = [[], [], []];
    const push = (i, d) => { if (d < D[i] && d < DCAP) { D[i] = d; B[d].push(i); } };
    for (let x = 0; x < w; x++) { push(x, cells[x] ? 1 : 0); const j = (h - 1) * w + x; push(j, cells[j] ? 1 : 0); }
    for (let y = 0; y < h; y++) { const a = y * w, b = y * w + w - 1; push(a, cells[a] ? 1 : 0); push(b, cells[b] ? 1 : 0); }
    for (let d = 0; d < DCAP; d++) {
      const bk = B[d];
      for (let k = 0; k < bk.length; k++) {
        const i = bk[k]; if (D[i] !== d) continue;
        const x = i % w;
        if (x > 0) push(i - 1, d + (cells[i - 1] ? 1 : 0));
        if (x < w - 1) push(i + 1, d + (cells[i + 1] ? 1 : 0));
        if (i >= w) push(i - w, d + (cells[i - w] ? 1 : 0));
        if (i < N - w) push(i + w, d + (cells[i + w] ? 1 : 0));
      }
    }
    return D;
  }
  /* incremental update after the block at i was removed: depths can only drop (by at most 1), so a small
     label-correcting flood from i keeps s.D exactly equal to depths(...) (capped at DCAP). */
  function relax(s, i) {
    const { w, h, cells, D } = s, N = w * h;
    const x = i % w, y = (i / w) | 0;
    let best = (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? 0 : DCAP;
    if (x > 0 && D[i - 1] < best) best = D[i - 1];
    if (x < w - 1 && D[i + 1] < best) best = D[i + 1];
    if (y > 0 && D[i - w] < best) best = D[i - w];
    if (y < h - 1 && D[i + w] < best) best = D[i + w];
    if (best >= D[i]) return;
    D[i] = best;
    const q = [i];
    for (let k = 0; k < q.length; k++) {
      const j = q[k], d = D[j], jx = j % w;
      const tryN = n => { const c = d + (cells[n] ? 1 : 0); if (c < D[n]) { D[n] = c; q.push(n); } };
      if (jx > 0) tryN(j - 1);
      if (jx < w - 1) tryN(j + 1);
      if (j >= w) tryN(j - w);
      if (j < N - w) tryN(j + w);
    }
  }
  const reach = b => (b === 'd' ? 2 : 1); // dachshund tunnels one layer deeper

  function target(s, p, D) {
    const { w, h, cells } = s, md = reach(p.b);
    let best = -1, bs = 1e9;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== p.c || D[i] > md) continue;
      const x = i % w, y = (i / w) | 0;
      const sc = D[i] * 10000 + (h - 1 - y) * 100 + Math.abs(x * 2 - (w - 1));
      if (sc < bs) { bs = sc; best = i; }
    }
    return best;
  }

  function eatCell(s, i, ev, k, p, kind) {
    const c = s.cells[i];
    s.cells[i] = null; s.left--; s.rem[c]--; p.n--; relax(s, i);
    if (ev) ev.push({ t: kind || 'eat', slot: k, cell: i, c, b: p.b, id: p.id });
    if (s.rem[c] === 0 && ev) ev.push({ t: 'clear', c });
  }

  /* one logic tick: every occupied slot (in slot order) eats at most one block.
     The depth map is recomputed only after a block was actually eaten (identical results, far fewer passes). */
  function tick(s, ev) {
    let any = false;
    for (let k = 0; k < SLOTS; k++) {
      const p = s.slots[k]; if (!p) continue;
      const t = target(s, p, s.D);
      if (t < 0) { p.wait = true; continue; }
      p.wait = false; any = true;
      eatCell(s, t, ev, k, p);
      if (p.n <= 0) { s.slots[k] = null; if (ev) ev.push({ t: 'home', slot: k, id: p.id, c: p.c, b: p.b }); }
    }
    return any;
  }
  function sledRun(s, c) {
    // bottom-most row containing colour c; longest horizontal run of c in that row (leftmost on tie)
    for (let y = s.h - 1; y >= 0; y--) {
      let best = null, cur = null;
      for (let x = 0; x <= s.w; x++) {
        const on = x < s.w && s.cells[y * s.w + x] === c;
        if (on) { if (!cur) cur = [x, x]; else cur[1] = x; }
        else if (cur) { if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur; cur = null; }
      }
      if (best) { const r = []; for (let x = best[0]; x <= best[1]; x++) r.push(y * s.w + x); return { y, cells: r }; }
    }
    return null;
  }

  /* tap a lane: the front doghouse moves into the first free leash slot.
     returns slot index, -1 = lane empty, -2 = no free slot */
  function place(s, lane, ev) {
    const L = s.lanes[lane];
    if (!L || s.pos[lane] >= L.length) return -1;
    const k = s.slots.indexOf(null);
    if (k < 0) return -2;
    const src = L[s.pos[lane]++];
    const p = { c: src.c, n: src.n, b: src.b, id: ++s.uid, wait: false, lane };
    s.slots[k] = p; s.taps++;
    if (ev) ev.push({ t: 'place', lane, slot: k, p: Object.assign({}, p) });
    if (p.b === 'h') {
      const run = sledRun(s, p.c);
      if (run) {
        const eaten = [];
        for (const i of run.cells) { if (p.n <= 0) break; eatCell(s, i, null, k, p); eaten.push(i); }
        if (ev) { ev.push({ t: 'sled', slot: k, row: run.y, cells: eaten, c: p.c, id: p.id }); if (s.rem[p.c] === 0) ev.push({ t: 'clear', c: p.c }); }
      }
      if (p.n <= 0) { s.slots[k] = null; if (ev) ev.push({ t: 'home', slot: k, id: p.id, c: p.c, b: p.b }); }
    }
    return k;
  }

  function settle(s, ev) { let g = 0; while (tick(s, ev) && ++g < 100000); return s; }
  function canAnyEat(s) {
    return s.slots.some(p => p && target(s, p, s.D) >= 0);
  }
  function isWon(s) { return s.left === 0; }
  function isStuck(s) { return s.slots.every(Boolean) && !canAnyEat(s); }
  function lanesLeft(s) { return s.lanes.reduce((a, l, i) => a + l.length - s.pos[i], 0); }

  /* ---------- difficulty metric: automated players (also used by tools/solver.js) ----------
     random: taps any non-empty lane. greedy: taps a random lane whose front pack can eat right now (huskies count). */
  function playout(p, policy, runs, seed) {
    const rnd = rng(seed); let wins = 0;
    for (let r = 0; r < runs; r++) {
      const s = settle(newState(p));
      for (;;) {
        if (isWon(s)) { wins++; break; }
        if (isStuck(s)) break;
        let moves = []; for (let i = 0; i < s.lanes.length; i++) if (s.pos[i] < s.lanes[i].length) moves.push(i);
        if (!moves.length) break;
        if (policy === 'greedy') {
          const good = moves.filter(i => { const d = s.lanes[i][s.pos[i]]; return d.b === 'h' || target(s, d, s.D) >= 0; });
          if (good.length) moves = good;
        }
        if (place(s, moves[(rnd() * moves.length) | 0], null) === -2) break;
        settle(s);
      }
    }
    return wins / runs;
  }

  /* ---------- seeded RNG + daily puzzle generator ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  /* Builds a doghouse sequence by forward play with the real rules (so a solution always exists).
     waitBias > 0 sometimes sends packs whose colour is still locked (they must wait) -> tension. */
  function genSequence(w, h, cells, r, o) {
    o = Object.assign({ minN: 5, maxN: 12, waitBias: 0.25, dachs: 0, husky: 0, maxWait: 3 }, o || {});
    const lane = [], s = newState({ w, h, cells, lanes: [lane] });
    const un = colourCounts(cells); const seq = [];
    settle(s);
    let guard = 0;
    while (Object.values(un).some(v => v > 0)) {
      if (++guard > 400) return null;
      const D = s.D;
      const waiting = s.slots.filter(Boolean).length;
      const opts = [];
      for (const c of Object.keys(un)) {
        if (un[c] <= 0) continue;
        const now = target(s, { c, b: 'l' }, D) >= 0;
        opts.push({ c, b: 'l', now, w: now ? 1 : 0 });
        if (o.dachs && target(s, { c, b: 'd' }, D) >= 0 && !now) opts.push({ c, b: 'd', now: true, w: o.dachs * 4 });
        else if (o.dachs && now) opts.push({ c, b: 'd', now: true, w: o.dachs });
        if (o.husky) { const run = sledRun(s, c); if (run && run.cells.length >= 4) opts.push({ c, b: 'h', now: true, w: o.husky * 3, run: run.cells.length }); }
      }
      let pool = opts.filter(x => x.now);
      const locked = opts.filter(x => !x.now);
      if (locked.length && waiting < o.maxWait && (r() < o.waitBias || !pool.length)) pool = locked.map(x => Object.assign(x, { w: 1 }));
      if (!pool.length) return null;
      let tot = pool.reduce((a, x) => a + x.w, 0), pick = r() * tot, ch = pool[0];
      for (const x of pool) { pick -= x.w; if (pick <= 0) { ch = x; break; } }
      let n = o.minN + ((r() * (o.maxN - o.minN + 1)) | 0);
      if (ch.b === 'h') n = Math.max(n, ch.run);
      n = Math.min(n, un[ch.c]);
      if (un[ch.c] - n < Math.ceil(o.minN / 2)) n = un[ch.c];
      const snap = clone(s);
      lane.push({ c: ch.c, n, b: ch.b });
      place(s, 0, null); settle(s);
      if (isStuck(s) && !isWon(s)) { lane.pop(); Object.assign(s, snap); continue; }
      un[ch.c] -= n; seq.push({ c: ch.c, n, b: ch.b });
    }
    settle(s);
    return isWon(s) ? seq : null;
  }
  function distribute(seq, r, nl, cluster = 0) {
    // cluster > 0 keeps colours together in "their" lane (harder: inner colours queue up behind each other)
    const lanes = Array.from({ length: nl }, () => []), home = {};
    let next = 0;
    seq.forEach((d, i) => {
      if (home[d.c] == null) home[d.c] = (next++) % nl;
      const k = r() < cluster ? home[d.c] : (r() * nl) | 0;
      lanes[k].push(d);
    });
    for (let k = 0; k < nl; k++) if (!lanes[k].length) { const src = lanes.reduce((a, l, j) => l.length > lanes[a].length ? j : a, 0); lanes[k].push(lanes[src].pop()); }
    return lanes.map(l => l.map(d => d.c + d.n + (d.b === 'l' ? '' : d.b)).join(' ')).join(' | ');
  }
  /* Daily puzzle: one of the 20 dog pictures + a seeded random tier. Medium / hard / very hard dailies use the
     pre-tuned, solver-verified DAILY_BANK (tools/tune.js d-<art>-<tier>); easy ones are built by forward play
     (always solvable). The background is often recoloured with an unused colour – a pure colour swap, so the
     puzzle's difficulty is unchanged. Deterministic per seed and instant (no simulation at runtime). */
  const TIER_GEN = {
    e: { minN: 14, maxN: 30, waitBias: 0.1, maxWait: 2 },
    m: { minN: 10, maxN: 22, waitBias: 0.4, maxWait: 3 },
    h: { minN: 8, maxN: 18, waitBias: 0.6, maxWait: 4 },
    x: { minN: 7, maxN: 17, waitBias: 0.75, maxWait: 4 },
  };
  function genDaily(seed) {
    const r = rng(seed);
    const pics = typeof LEVEL_DEFS !== 'undefined' ? LEVEL_DEFS : [], BANK = typeof DAILY_BANK !== 'undefined' ? DAILY_BANK : {};
    const roll = r(); let tier = roll < 0.3 ? 'e' : roll < 0.58 ? 'm' : roll < 0.84 ? 'h' : 'x';
    let cand = tier === 'e' ? pics : pics.filter(l => BANK[l.id] && BANK[l.id][tier]);
    if (!cand.length) { tier = 'e'; cand = pics; }
    const src = cand[(r() * cand.length) | 0];
    const p0 = parseLevel({ grid: src.grid, lanes: 'R1' }), W = p0.w, H = p0.h;
    // recolour the background (most common border colour) with an unused colour now and then
    const bc = {};
    for (let i = 0; i < p0.cells.length; i++) { const x = i % W, y = (i / W) | 0; if (p0.cells[i] && (x === 0 || y === 0 || x === W - 1)) bc[p0.cells[i]] = (bc[p0.cells[i]] || 0) + 1; }
    const bg = Object.keys(bc).sort((a, b) => bc[b] - bc[a])[0], used = colourCounts(p0.cells);
    const free = ['C', 'K', 'G', 'B', 'P', 'Y', 'O'].filter(c => !used[c]), map = {};
    if (free.length && r() < 0.6) map[bg] = free[(r() * free.length) | 0];
    const cells = p0.cells.map(c => (c && map[c]) || c);
    const grid = []; for (let y = 0; y < H; y++) grid.push(cells.slice(y * W, y * W + W).map(c => c || '.').join(''));
    const bank = tier !== 'e' && BANK[src.id] && BANK[src.id][tier];
    let lanes;
    if (bank) lanes = bank.split(' ').map(t => (t !== '|' && map[t[0]]) ? map[t[0]] + t.slice(1) : t).join(' ');
    else {
      const kn = Object.assign({ dachs: 0.12, husky: 0.1 }, TIER_GEN[tier]);
      let seq = null;
      for (let t = 0; t < 20 && !seq; t++) seq = genSequence(W, H, cells, r, kn);
      if (!seq) seq = genSequence(W, H, cells, r, { minN: 14, maxN: 30, waitBias: 0 });
      lanes = distribute(seq, r, 3, 0.4);
    }
    return { id: 'daily', name: 'Dagleg þraut', pic: src.name, tier, grid: grid.join(' '), lanes, dog: seed };
  }

  const api = { COLORS, SLOTS, DOGS: typeof DOG_DEFS !== 'undefined' ? DOG_DEFS : [], LEVELS: typeof LEVEL_DEFS !== 'undefined' ? LEVEL_DEFS : [],
    parseLevel, colourCounts, houseCounts, newState, clone, depths, relax, DCAP, reach, target, tick, place, settle, canAnyEat,
    isWon, isStuck, lanesLeft, rng, genDaily, genSequence, distribute, sledRun, playout, TIER_GEN };
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
