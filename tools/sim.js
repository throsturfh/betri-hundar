/* Shared design-time helpers: load the rules engine, playout policies, exhaustive solver.
   Used by tools/solver.js and tools/tune.js (never shipped). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function loadPL(fromIndex) {
  let code;
  if (fromIndex && fs.existsSync(path.join(root, 'index.html'))) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const m = /<script id="logic">([\s\S]*?)<\/script>/.exec(html);
    if (!m) throw new Error('logic script not found in index.html');
    code = m[1];
  } else code = ['src/levels.js', 'src/dogs.js', 'src/logic.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  const ctx = { module: { exports: {} } };
  vm.createContext(ctx); vm.runInContext(code + '\nmodule.exports = PL;', ctx);
  return ctx.module.exports;
}
const playout = (PL, p, policy, runs, seed) => PL.playout(p, policy, runs, seed);
/* exhaustive memoised DFS over tap orders (taps happen after packs settle). Keys are hashed (FNV over the
   board) to keep memory small; a hash collision could only hide a solution, never invent one, and any
   solution found is replayed from scratch to prove it. Moves whose front pack can eat are tried first. */
function solve(PL, p, limit = 3e6) {
  const s0 = PL.settle(PL.newState(p));
  const seen = new Set(); let nodes = 0, deadEnds = 0;
  const key = s => {
    let h1 = 2166136261, h2 = 5381;
    for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i] ? s.cells[i].charCodeAt(0) : 46; h1 = Math.imul(h1 ^ c, 16777619); h2 = (Math.imul(h2, 33) ^ c) | 0; }
    return s.pos.join(',') + '|' + s.slots.map(q => q ? q.c + q.n + q.b : '-').join('') + '|' + (h1 >>> 0) + ':' + (h2 >>> 0);
  };
  function order(s) {
    const L = [];
    for (let l = 0; l < s.lanes.length; l++) if (s.pos[l] < s.lanes[l].length) {
      const d = s.lanes[l][s.pos[l]]; L.push([l, (d.b === 'h' || PL.target(s, d, s.D) >= 0) ? 0 : 1]);
    }
    return L.sort((a, b) => a[1] - b[1]).map(x => x[0]);
  }
  function dfs(s) {
    if (PL.isWon(s)) return [];
    if (++nodes > limit) throw new Error('search limit');
    const k = key(s); if (seen.has(k)) return null; seen.add(k);
    for (const l of order(s)) {
      const c = PL.clone(s); const r = PL.place(c, l, null); if (r < 0) continue;
      PL.settle(c);
      if (PL.isWon(c)) return [l];
      if (PL.isStuck(c)) { deadEnds++; continue; }
      const res = dfs(c); if (res) return [l, ...res];
    }
    return null;
  }
  let sol = null, err = null;
  try { sol = dfs(s0); } catch (e) { err = e.message; }
  let proven = false;
  if (sol) { const s = PL.settle(PL.newState(p)); for (const l of sol) { if (PL.place(s, l, null) < 0) break; PL.settle(s); } proven = PL.isWon(s); }
  return { sol, nodes, deadEnds, proven, err };
}
module.exports = { loadPL, playout, solve, root };
