#!/usr/bin/env node
/* Level tuner (design time). For a level from tools/levelspec.js:
   1. builds doghouse sequences by forward play with the real rules (PL.genSequence => always solvable),
   2. hill-climbs the lane assignment (any assignment that keeps sequence order inside each lane stays solvable,
      because the original order is still a valid interleaving) towards the tier's greedy/random win band,
   3. confirms with the exact solver metrics (400 greedy + 400 random playouts, same seeds as tools/solver.js).
   Writes tools/tuned/L<id>.json.  Usage: node tools/tune.js 3 5 10   [TIME=seconds per level] */
const fs = require('fs'), path = require('path');
const { loadPL, playout, root } = require('./sim');
const { ART } = require('./art');
const { TIERS, LEVELS } = require('./levelspec');
const PL = loadPL(false);
fs.mkdirSync(path.join(root, 'tools/tuned'), { recursive: true });
const tok = d => d.c + d.n + (d.b === 'l' ? '' : d.b);
function lanesStr(seq, a, nl) { const L = Array.from({ length: nl }, () => []); seq.forEach((d, i) => L[a[i]].push(tok(d))); return L.map(l => l.join(' ')).join(' | '); }
function dist(v, [lo, hi]) { return v < lo ? lo - v : v > hi ? v - hi : 0; }
function cost(T, g, r) { return 3 * dist(g, T.g) + 2 * dist(r, T.r) + 0.15 * Math.abs(g - T.aim[0]) + 0.05 * Math.abs(r - T.aim[1]); }

/* ids: level numbers, or daily-bank entries "d-<art>-<tier>" (e.g. d-corgi-h) -> tools/tuned/daily/<art>_<tier>.json */
fs.mkdirSync(path.join(root, 'tools/tuned/daily'), { recursive: true });
for (const arg of process.argv.slice(2)) {
  const dm = /^d-(\w+)-([emhx])$/.exec(arg);
  const id = dm ? arg : +arg;
  const spec = dm ? { id: arg, art: dm[1], tier: dm[2], dachs: 0.1, husky: 0.1 } : LEVELS.find(l => l.id === id);
  const T0 = TIERS[spec.tier], nl = spec.lanes || 3;
  // optional AIM=g,r env override (e.g. AIM=0.53,0.2 to aim low inside the band)
  const T = process.env.AIM ? Object.assign({}, T0, { aim: process.env.AIM.split(',').map(Number) }) : T0;
  const idNum = dm ? [...arg].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 17) % 100000 + 500 : id;
  const grid = ART[spec.art]().str();
  const base = PL.parseLevel({ grid, lanes: 'R1' });
  const budget = (+process.env.TIME || 150) * 1000, t0 = Date.now();
  const r = PL.rng(idNum * 7777 + (+process.env.SEED || 0));
  const evalA = (seq, a, nG, nR) => {
    const p = PL.parseLevel({ grid, lanes: lanesStr(seq, a, nl) });
    const g = playout(PL, p, 'greedy', nG, 101), rr = playout(PL, p, 'random', nR, 202);
    return { g, r: rr, c: cost(T, g, rr) };
  };
  const okLanes = a => { const c = new Array(nl).fill(0); a.forEach(k => c[k]++); return c.every(v => v >= 2); };
  let best = null, tries = 0;
  while (Date.now() - t0 < budget * 0.75 && !(best && best.final && best.houses <= (T.cap || 40))) {
    tries++;
    const kn = Object.assign({}, T.knobs, { dachs: spec.dachs || 0, husky: spec.husky || 0 });
    if (tries > 1) { kn.minN = Math.max(3, kn.minN + ((r() * 5) | 0) - 2); kn.maxN = Math.max(kn.minN + 3, kn.maxN + ((r() * 7) | 0) - 3); kn.waitBias = Math.min(0.95, Math.max(0, kn.waitBias + (r() - 0.5) * 0.3)); }
    let seq = null; for (let k = 0; k < 20 && !seq; k++) seq = PL.genSequence(base.w, base.h, base.cells, r, kn);
    if (!seq) continue;
    // initial assignment: colour-clustered lanes with some noise
    const home = {}; let nx = 0; const cl = r();
    let a = seq.map(d => { if (home[d.c] == null) home[d.c] = (nx++) % nl; return r() < cl ? home[d.c] : (r() * nl) | 0; });
    if (!okLanes(a)) a = seq.map((d, i) => i % nl);
    let cur = Object.assign(evalA(seq, a, 48, 32), { a });
    const steps = spec.tier === 't' || spec.tier === 'e' ? 50 : 140;
    for (let st = 0; st < steps && cur.c > 0.004 && Date.now() - t0 < budget * 0.8; st++) {
      const b = cur.a.slice(); const nm = 1 + ((r() * 3) | 0);
      for (let m = 0; m < nm; m++) { const i = (r() * b.length) | 0; if (r() < 0.5) b[i] = (b[i] + 1 + ((r() * (nl - 1)) | 0)) % nl; else { const j = (r() * b.length) | 0; [b[i], b[j]] = [b[j], b[i]]; } }
      if (!okLanes(b)) continue;
      const e = evalA(seq, b, 48, 32);
      if (e.c <= cur.c) cur = Object.assign(e, { a: b });
    }
    if (!best || cur.c < best.c) {
      // exact check with solver seeds/sample sizes
      const p = PL.parseLevel({ grid, lanes: lanesStr(seq, cur.a, nl) });
      const g = playout(PL, p, 'greedy', 400, 9), rr = playout(PL, p, 'random', 400, 7);
      const inBand = dist(g, T.g) === 0 && dist(rr, T.r) === 0;
      const hp = 0.004 * Math.max(0, seq.length - (T.cap || 40));
      const cand = { c: cost(T, g, rr) - (inBand ? 1 : 0) + hp, g, r: rr, lanes: lanesStr(seq, cur.a, nl), houses: seq.length, final: inBand, seq, a: cur.a };
      if (!best || cand.c < best.c) best = cand;
      console.log(`L${id} try ${tries}: quick g=${cur.g.toFixed(2)} r=${cur.r.toFixed(2)} | exact g=${g.toFixed(3)} r=${rr.toFixed(3)} houses=${seq.length} ${inBand ? 'IN BAND' : ''}`);
    }
  }
  // polish: if not in band, keep climbing on the best with exact-size evaluation
  if (best && !best.final) {
    let a = best.a;
    while (Date.now() - t0 < budget && !best.final) {
      const b = a.slice(); const i = (r() * b.length) | 0; b[i] = (b[i] + 1 + ((r() * (nl - 1)) | 0)) % nl;
      if (!okLanes(b)) continue;
      const p = PL.parseLevel({ grid, lanes: lanesStr(best.seq, b, nl) });
      const g = playout(PL, p, 'greedy', 400, 9), rr = playout(PL, p, 'random', 400, 7);
      const inBand = dist(g, T.g) === 0 && dist(rr, T.r) === 0, c = cost(T, g, rr) - (inBand ? 1 : 0) + 0.004 * Math.max(0, best.houses - (T.cap || 40));
      if (c <= best.c) { a = b; Object.assign(best, { c, g, r: rr, lanes: lanesStr(best.seq, b, nl), final: inBand, a: b }); console.log(`L${id} polish g=${g.toFixed(3)} r=${rr.toFixed(3)}${inBand ? ' IN BAND' : ''}`); }
    }
  }
  const out = { id, tier: spec.tier, g: best.g, r: best.r, inBand: best.final, houses: best.houses, lanes: best.lanes, secs: Math.round((Date.now() - t0) / 1000) };
  const outFile = dm ? path.join(root, 'tools/tuned/daily', dm[1] + '_' + dm[2] + '.json') : path.join(root, 'tools/tuned/L' + id + (process.env.SUFFIX || '') + '.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(`DONE L${id} tier=${spec.tier} g=${best.g.toFixed(3)} r=${best.r.toFixed(3)} band=${best.final} houses=${best.houses} ${out.secs}s`);
}
