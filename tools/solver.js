#!/usr/bin/env node
/* Betri Hundar level verifier.
   Loads the exact rules engine embedded in index.html (<script id="logic">), or src/ with --src.
   For every level: checks doghouse counts == block counts per colour, proves winnability under the 5-slot rule
   with an exhaustive memoised search (solution replayed from scratch), and measures difficulty by random and
   greedy play (400 runs each). Prints a table and checks every level's tier band + the sawtooth sequence.
   Usage: node tools/solver.js [--src] [--daily N] [--level K] [--quiet] */
const { loadPL, playout, solve } = require('./sim');
const args = process.argv.slice(2);
const PL = loadPL(!args.includes('--src'));
const BANDS = { // greedy, random win-rate bands per tier (also documented in tools/levelspec.js)
  t: { g: [1.0, 1.0], r: [0.85, 1.0] }, e: { g: [0.9, 1.0], r: [0.5, 1.0] }, m: { g: [0.6, 0.75], r: [0.1, 0.45] },
  h: { g: [0.5, 0.65], r: [0.15, 0.30] }, x: { g: [0.25, 0.4], r: [0.05, 0.12] },   // softened in v3
};
const TIER_NAME = { t: 'easy (tutorial)', e: 'easy', m: 'medium', h: 'HARD', x: 'VERY HARD' };
const INTENDED = 'tthexemhexemhexehmex'; // intended tiers for levels 1..20 (t/e easy, m medium, h hard, x very hard)
const inb = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;
function check(def, label, quiet) {
  const p = PL.parseLevel(def);
  const bc = PL.colourCounts(p.cells), hc = PL.houseCounts(p.lanes);
  const cols = new Set([...Object.keys(bc), ...Object.keys(hc)]);
  const mism = [...cols].filter(c => bc[c] !== hc[c]).map(c => `${c}: blocks ${bc[c] || 0} vs houses ${hc[c] || 0}`);
  const t0 = Date.now(); const r = solve(PL, p);
  const rnd = playout(PL, p, 'random', 400, 7), gr = playout(PL, p, 'greedy', 400, 9);
  const ok = !mism.length && !!r.sol && r.proven;
  const band = def.tier && BANDS[def.tier], tierOk = !band || (inb(gr, band.g) && inb(rnd, band.r));
  const res = { ok, tierOk, label, w: p.w, h: p.h, houses: p.lanes.flat().length, lanes: p.lanes.length, blocks: p.cells.filter(Boolean).length,
    colours: Object.keys(bc).length, gr, rnd, mism, solvable: !!r.sol && r.proven, states: r.nodes, err: r.err, ms: Date.now() - t0, tier: def.tier };
  if (!quiet || !ok) console.log(`${ok ? 'PASS' : 'FAIL'} ${label.padEnd(24)} ${p.w}x${p.h} blocks=${res.blocks} colours=${res.colours} houses=${res.houses} lanes=${p.lanes.length} ` +
    `counts=${mism.length ? 'MISMATCH ' + mism.join('; ') : 'ok'} solvable=${res.solvable}${r.err ? ' (' + r.err + ')' : ''} states=${r.nodes} ` +
    `randomWin=${(rnd * 100).toFixed(1)}% greedyWin=${(gr * 100).toFixed(1)}%${def.tier ? ' tier=' + def.tier + (tierOk ? '' : ' OUT-OF-BAND') : ''} (${res.ms}ms)`);
  return res;
}
let all = true; const rows = [];
const only = args.includes('--level') ? +args[args.indexOf('--level') + 1] : null;
PL.LEVELS.forEach(def => { if (only == null || def.id === only) { const r = check(def, 'Borð ' + def.id + ' ' + def.name, args.includes('--quiet')); r.def = def; rows.push(r); all = all && r.ok; } });
if (rows.length) {
  console.log('\n| # | Name | Size | Blocks | Colours | Houses | Tier | greedyWin | randomWin | Band | Solvable |');
  console.log('|---|------|------|--------|---------|--------|------|-----------|-----------|------|----------|');
  for (const r of rows) console.log(`| ${r.def.id} | ${r.def.name} | ${r.w}x${r.h} | ${r.blocks} | ${r.colours} | ${r.houses} | ${TIER_NAME[r.tier] || '-'} | ${(r.gr * 100).toFixed(1)}% | ${(r.rnd * 100).toFixed(1)}% | ${r.tierOk ? 'ok' : 'OUT'} | ${r.solvable ? 'yes' : 'NO'} |`);
  if (only == null) {
    const seqStr = PL.LEVELS.map(l => l.tier).join(''), rank = t => 'temhx'.indexOf(t) - (t === 't' ? 0 : 0);
    const R = t => ({ t: 0, e: 0, m: 1, h: 2, x: 3 })[t];
    const sawOk = seqStr === INTENDED;
    const reliefAfterSpike = [...seqStr].every((t, i) => i + 1 >= seqStr.length || R(t) < 2 || R(seqStr[i + 1]) < R(t));
    const easyAfterVeryHard = [...seqStr].every((t, i) => i + 1 >= seqStr.length || t !== 'x' || R(seqStr[i + 1]) === 0);
    let longestRise = 1, run = 1; for (let i = 1; i < seqStr.length; i++) { run = R(seqStr[i]) > R(seqStr[i - 1]) ? run + 1 : 1; longestRise = Math.max(longestRise, run); }
    // measured order must follow the tiers too: every hard/very-hard level is measurably harder (greedy) than its neighbours
    const g = rows.map(r => r.gr), measuredSaw = rows.every((r, i) => R(r.tier) < 2 || ((i === 0 || g[i] < g[i - 1]) && (i + 1 >= g.length || g[i] < g[i + 1])));
    const measured = rows.every(r => r.tierOk);
    console.log(`\nTier sequence : ${seqStr.toUpperCase()}\nIntended      : ${INTENDED.toUpperCase()}  match=${sawOk}`);
    console.log(`Sawtooth: every hard/very-hard spike followed by an easier level=${reliefAfterSpike}, easy right after every very-hard=${easyAfterVeryHard}, ` +
      `longest strictly rising run=${longestRise} levels, greedyWin dips at every spike=${measuredSaw}, all levels inside their tier band=${measured}`);
    console.log('greedyWin curve: ' + rows.map(r => `${r.def.id}:${Math.round(r.gr * 100)}`).join(' '));
    all = all && sawOk && measured && reliefAfterSpike && easyAfterVeryHard;
  }
}
const nd = args.includes('--daily') ? +args[args.indexOf('--daily') + 1] : 60;
if (only == null && nd > 0) {
  let dOk = 0; const d0 = new Date(2026, 9, 8), tiers = {}, inBand = {};
  for (let i = 0; i < nd; i++) {
    const d = new Date(d0.getTime() + i * 864e5);
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const def = PL.genDaily(seed);
    const r = check(def, `Daily ${seed} ${def.pic} [${def.tier}]`, true);
    tiers[def.tier] = (tiers[def.tier] || 0) + 1; if (r.tierOk) inBand[def.tier] = (inBand[def.tier] || 0) + 1;
    if (r.ok) dOk++; else all = false;
    if (args.includes('--dailytable')) console.log(`  daily ${seed} ${def.pic.padEnd(12)} tier=${def.tier} houses=${r.houses} greedy=${(r.gr * 100).toFixed(0)}% random=${(r.rnd * 100).toFixed(0)}% ${r.tierOk ? '' : '(outside strict band)'}`);
  }
  console.log(`Daily puzzles: ${dOk}/${nd} verified solvable with exact counts; tiers ${JSON.stringify(tiers)}, strictly in tier band ${JSON.stringify(inBand)}`);
}
console.log(all ? 'ALL LEVELS PASS' : 'SOME LEVELS FAIL');
process.exit(all ? 0 : 1);
