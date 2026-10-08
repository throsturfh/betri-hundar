#!/usr/bin/env node
/* Betri Hundar – dog-themed pixel pictures (24x24) drawn with small primitives.
   Used at design time by tools/make_levels.js (grids are baked into src/levels.js).
   Palette letters: R O Y G C B P K W N D (see src/logic.js COLORS). */
const N = 24;
function Pic(bg) {
  const g = Array.from({ length: N }, () => Array(N).fill(bg));
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const api = {
    g,
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (inb(x, y)) g[y][x] = c; return api; },
    get(x, y) { return inb(x, y) ? g[y][x] : null; },
    rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.set(x, y, c); return api; },
    // rotated ellipse; centre in continuous coords (cell centres are +0.5)
    ell(cx, cy, rx, ry, c, rot = 0, test) {
      const co = Math.cos(rot), si = Math.sin(rot);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * co + dy * si, v = -dx * si + dy * co;
        if ((u / rx) ** 2 + (v / ry) ** 2 <= 1 && (!test || test(g[y][x], x, y))) g[y][x] = c;
      }
      return api;
    },
    ring(cx, cy, r0, r1, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d >= r0 && d <= r1) g[y][x] = c; } return api; },
    poly(pts, c, test) { // even-odd fill at cell centres
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const px = x + 0.5, py = y + 0.5; let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins;
        }
        if (ins && (!test || test(g[y][x], x, y))) g[y][x] = c;
      }
      return api;
    },
    thick(x0, y0, x1, y1, r, c, test) { // capsule
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const px = x + 0.5, py = y + 0.5, vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy;
        const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (L2 || 1)));
        if (Math.hypot(px - x0 - vx * t, py - y0 - vy * t) <= r && (!test || test(g[y][x], x, y))) g[y][x] = c;
      }
      return api;
    },
    map(fn) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const r = fn(g[y][x], x, y); if (r) g[y][x] = r; } return api; },
    patch(rows, ox = 0, oy = 0) { rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ' ' && ch !== '_') api.set(ox + x, oy + y, ch); })); return api; },
    mirror() { for (let y = 0; y < N; y++) for (let x = 0; x < N / 2; x++) g[y][N - 1 - x] = g[y][x]; return api; },
    str() { return g.map(r => r.join('')).join(' '); },
  };
  return api;
}
const is = (...cs) => v => cs.includes(v);

/* ---------------- objects ---------------- */
function bein() { // bone, diagonal
  const p = Pic('C');
  p.thick(7, 7, 17, 17, 2.3, 'W');
  for (const [x, y] of [[8.0, 4.4], [4.4, 8.0], [19.6, 16.0], [16.0, 19.6]]) p.ell(x, y, 2.9, 2.9, 'W');
  p.map((v, x, y) => v === 'W' && (p.get(x, y + 1) === 'C' || p.get(x + 1, y) === 'C' || p.get(x + 1, y + 1) === 'C') && (x - y) > -6 && x + y > 9 && !(p.get(x, y - 1) === 'C' || p.get(x - 1, y) === 'C') ? 'Y' : null);
  p.set(7, 3, 'C'); 
  return p;
}
function loppa() { // paw print
  const p = Pic('Y');
  p.ell(12, 16.2, 6.4, 5.0, 'N');
  p.ell(8.6, 18.6, 3.2, 2.6, 'N'); p.ell(15.4, 18.6, 3.2, 2.6, 'N');
  p.ell(4.4, 9.6, 2.4, 3.1, 'N', -0.45); p.ell(9.2, 5.4, 2.3, 3.1, 'N', -0.15);
  p.ell(14.8, 5.4, 2.3, 3.1, 'N', 0.15); p.ell(19.6, 9.6, 2.4, 3.1, 'N', 0.45);
  // highlights
  p.ell(10.2, 14.2, 2.4, 1.3, 'O', -0.2, is('N'));
  for (const [x, y] of [[3.9, 8.4], [8.8, 4.2], [14.3, 4.2], [19.1, 8.4]]) p.ell(x, y, 0.9, 1.2, 'O', 0, is('N'));
  return p;
}
function skal() { // dog bowl with food + bone
  const p = Pic('C');
  p.rect(0, 20, 23, 23, 'B');
  p.ell(12, 21.2, 11, 1.4, 'P', 0, is('B'));
  p.poly([[4, 11.5], [20, 11.5], [22.6, 20.5], [1.4, 20.5]], 'R');     // flared dog bowl
  p.rect(3, 11, 20, 12, 'K');                                           // rim
  p.map((v, x, y) => v === 'R' && x >= 17 && y > 12 ? 'P' : null);
  // little white bone on the front
  p.thick(9, 16.5, 15, 16.5, 0.8, 'W'); for (const [x, y] of [[8, 15], [8, 17], [15, 15], [15, 17], [8, 16], [15, 16]]) p.set(x, y, 'W');
  // food heap
  p.ell(12, 11.2, 8.4, 3.6, 'N', 0, (v, x, y) => y <= 10);
  for (const [x, y, c] of [[6, 10, 'O'], [8, 9, 'Y'], [11, 8, 'O'], [14, 9, 'Y'], [17, 10, 'O'], [9, 10, 'O'], [13, 10, 'Y'], [16, 8, 'O'], [12, 9, 'Y'], [10, 8, 'O'], [15, 10, 'O'], [7, 10, 'Y']]) p.set(x, y, c);
  // bone sticking out
  p.thick(13.5, 7.6, 19.0, 3.2, 1.0, 'W'); p.ell(19.6, 2.0, 1.3, 1.3, 'W'); p.ell(20.6, 3.6, 1.3, 1.3, 'W');
  return p;
}
function bolti() { // tennis ball on grass
  const p = Pic('C');
  p.rect(0, 19, 23, 23, 'G');
  p.ell(12, 19.6, 8, 1.4, 'D', 0, is('G'));           // shadow
  p.ell(12, 11, 8.6, 8.6, 'Y');
  // seams: two arcs from circles centred off the ball
  p.map((v, x, y) => { if (v !== 'Y') return null; const a = Math.hypot(x + 0.5 - 1.6, y + 0.5 - 11), b = Math.hypot(x + 0.5 - 22.4, y + 0.5 - 11); return (Math.abs(a - 7.4) < 0.62 || Math.abs(b - 7.4) < 0.62) ? 'W' : null; });
  // shading lower right, highlight upper left
  p.map((v, x, y) => v === 'Y' && Math.hypot(x + 0.5 - 15.5, y + 0.5 - 14.5) > 0 && ((x + 0.5 - 12) * 0.6 + (y + 0.5 - 11) * 0.8) > 4.6 ? 'O' : null);
  p.ell(8.6, 6.8, 2.0, 1.3, 'W', -0.6, is('Y'));
  p.patch(['W W', ' W '], 18, 3); p.set(20, 1, 'W');
  return p;
}
function kofi() { // doghouse with a puppy peeking
  const p = Pic('C');
  p.rect(0, 20, 23, 23, 'G');
  p.ell(20, 3, 2.6, 2.6, 'Y');
  p.ell(3.5, 3.4, 2.6, 1.4, 'W'); p.ell(5.6, 2.7, 1.8, 1.4, 'W');
  p.poly([[2.2, 9.8], [12, 3.2], [21.8, 9.8], [21.8, 11], [2.2, 11]], 'R');
  p.poly([[1, 10.8], [12, 3.2], [23, 10.8], [23, 11.6], [21.5, 11.6], [12, 5.2], [2.5, 11.6], [1, 11.6]], 'P');
  p.rect(4, 11, 19, 20, 'O');
  for (const y of [13, 16, 19]) p.rect(4, y, 19, y, 'N');
  p.map((v, x, y) => v === 'O' && x >= 17 ? 'N' : null);
  p.ell(12, 15.4, 3.6, 3.6, 'D', 0, (v, x, y) => y <= 20); p.rect(8, 15, 15, 20, 'D');
  p.set(10, 16, 'W'); p.set(13, 16, 'W');                            // eyes peeking in the dark
  p.rect(11, 18, 12, 18, 'N');                                        // nose-ish
  p.rect(10, 8, 13, 9, 'W'); p.set(10, 8, 'Y'); p.set(13, 9, 'Y');
  p.rect(8, 20, 15, 20, 'Y');                                         // bowl at door? no: welcome mat
  p.set(3, 21, 'Y'); p.set(20, 22, 'K'); p.set(22, 21, 'Y');
  return p;
}
function ol() { // collar with a round tag + leash
  const p = Pic('K');
  p.ring(10.5, 10.5, 5.0, 7.8, 'R');
  p.map((v, x, y) => v === 'R' && Math.hypot(x + 0.5 - 10.5, y + 0.5 - 10.5) > 7.0 && y > 10 ? 'P' : null);
  for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2 + 0.26; p.set(10.5 + Math.cos(t) * 6.4 - 0.5, 10.5 + Math.sin(t) * 6.4 - 0.5, 'Y'); }
  p.rect(16, 8, 19, 12, 'Y'); p.rect(17, 9, 18, 11, 'K');            // buckle
  p.set(10, 18, 'D');                                                 // ring link
  p.ell(10.5, 21, 2.6, 2.6, 'Y'); p.rect(9, 21, 11, 21, 'O'); p.set(9, 20, 'O'); p.set(11, 20, 'O'); p.set(9, 22, 'O'); p.set(11, 22, 'O'); // tag with bone
  // leash
  p.thick(19.6, 10, 21.4, 5.5, 1.0, 'B'); p.thick(21.4, 5.5, 21.0, 2.8, 1.0, 'B');
  p.ring(20.8, 1.6, 0.9, 2.0, 'B');
  return p;
}
function frisbi() { // flying disc over a park
  const p = Pic('C');
  p.rect(0, 20, 23, 23, 'G');
  p.ell(18.5, 4, 3.4, 1.6, 'W'); p.ell(20.8, 3.2, 2.0, 1.5, 'W');
  p.ell(4, 18, 3.6, 1.4, 'W');
  p.ell(12.5, 11.5, 9.6, 4.4, 'P', -0.25);
  p.ell(12.5, 11.0, 8.8, 3.6, 'K', -0.25);
  p.ell(12.5, 10.8, 5.6, 2.0, 'P', -0.25);
  p.ell(12.6, 10.6, 4.4, 1.2, 'K', -0.25);
  p.ell(9, 10.4, 1.8, 0.7, 'W', -0.25, is('K'));
  for (const [x, y] of [[0, 10], [0, 13], [1, 16]]) p.rect(x, y, x + 1, y, 'W');
  p.set(2, 21, 'Y'); p.set(7, 22, 'K'); p.set(15, 21, 'Y'); p.set(20, 22, 'W');
  return p;
}
function bruni() { // fire hydrant
  const p = Pic('C');
  p.rect(0, 19, 23, 23, 'G');
  p.ell(12, 21.4, 7.5, 1.3, 'D', 0, is('G'));
  p.ell(12, 3.6, 3.4, 2.4, 'R'); p.rect(11, 0, 12, 1, 'R'); p.set(10, 1, 'R'); p.set(13, 1, 'R'); // cap
  p.rect(6, 5, 17, 6, 'P');                                          // rim
  p.rect(7, 7, 16, 18, 'R');                                         // body
  p.rect(3, 9, 6, 12, 'R'); p.rect(17, 9, 20, 12, 'R');              // side nozzles
  p.rect(2, 10, 2, 11, 'D'); p.rect(21, 10, 21, 11, 'D');
  p.ell(12, 10.5, 2.0, 2.0, 'Y'); p.set(11, 10, 'O'); p.set(12, 11, 'O'); // front cap
  p.rect(7, 14, 16, 14, 'Y');                                        // band
  p.map((v, x, y) => v === 'R' && x >= 14 && y >= 5 && y <= 18 ? 'P' : null);
  p.rect(5, 19, 18, 20, 'D'); p.rect(6, 18, 17, 18, 'P');            // base
  p.rect(8, 7, 8, 12, 'K'); p.set(11, 2, 'K');                      // shine
  return p;
}
function pylsa() { // hot dog (pylsa með öllu)
  const p = Pic('B');
  p.thick(4.5, 17.5, 19.5, 6.5, 4.0, 'O');                           // bun back
  p.thick(3, 16, 21, 8, 2.0, 'R');                                   // sausage
  p.ell(3, 16, 2.2, 2.2, 'R'); p.ell(21, 8, 2.2, 2.2, 'R');
  p.thick(6, 19, 19.5, 10.5, 2.5, 'Y');                              // bun front
  p.map((v, x, y) => v === 'Y' && (x + 0.5) * 0.53 + (y + 0.5) > 23.5 ? 'N' : null);
  // mustard zig-zag along the sausage
  for (let i = 0; i <= 16; i++) { const t = i / 16, x = 4.4 + t * 15.4, y = 15.0 - t * 7.0 + (i % 2 ? -0.7 : 0.6); p.set(x, y, 'W'); }
  p.set(4, 14, 'K'); p.set(19, 7, 'K');
  return p;
}
function hjartaloppa() { // paw with a heart pad
  const p = Pic('C');
  p.ell(4.6, 9.4, 2.4, 3.1, 'N', -0.45); p.ell(9.2, 5.4, 2.3, 3.1, 'N', -0.15);
  p.ell(14.8, 5.4, 2.3, 3.1, 'N', 0.15); p.ell(19.4, 9.4, 2.4, 3.1, 'N', 0.45);
  p.ell(12, 16.2, 7.2, 6.0, 'N');
  // heart in the main pad
  p.ell(9.6, 14.2, 2.6, 2.4, 'R'); p.ell(14.4, 14.2, 2.6, 2.4, 'R');
  p.poly([[6.9, 14.8], [17.1, 14.8], [12, 20.8]], 'R');
  p.set(9, 13, 'K'); p.set(8, 14, 'K');
  for (const [x, y] of [[4.1, 8.2], [8.8, 4.2], [14.3, 4.2], [18.9, 8.2]]) p.ell(x, y, 0.9, 1.2, 'O', 0, is('N'));
  return p;
}
function karfa() { // puppy in a basket
  const p = Pic('G');
  p.rect(0, 0, 23, 5, 'C');
  p.ell(12, 9.5, 6.4, 5.6, 'W');                                     // head
  p.ell(5.6, 9.0, 2.0, 3.8, 'N', 0.35); p.ell(18.4, 9.0, 2.0, 3.8, 'N', -0.35); // ears
  p.ell(9.6, 7.4, 2.2, 2.0, 'N', 0, is('W'));                        // eye patch
  p.rect(9, 8, 10, 9, 'D'); p.set(9, 8, 'W'); p.rect(14, 8, 15, 9, 'D'); p.set(14, 8, 'W');
  p.rect(11, 11, 12, 11, 'D'); p.set(11, 12, 'D'); p.set(12, 12, 'D'); p.rect(11, 13, 12, 13, 'R'); p.set(9, 11, 'K'); p.set(14, 11, 'K');
  p.ell(12, 3.6, 1.0, 1.0, 'W');
  // basket
  p.poly([[1.5, 13.5], [22.5, 13.5], [20, 22.5], [4, 22.5]], 'N');
  p.map((v, x, y) => v === 'N' && y >= 14 && ((x + (y >> 1)) % 3 === 0) ? 'O' : null);
  p.rect(1, 13, 22, 14, 'Y');
  p.rect(6, 12, 7, 13, 'W'); p.rect(16, 12, 17, 13, 'W');            // paws on the rim
  p.ring(12, 13, 9.8, 11.0, 'O', 0); p.map((v, x, y) => v === 'O' && y >= 13 && Math.hypot(x + 0.5 - 12, y + 0.5 - 13) > 9.7 ? (y < 14 ? null : 'G') : null);
  return p;
}
function greifingi() { // dachshund, side view
  const p = Pic('C');
  p.rect(0, 18, 23, 23, 'G');
  p.ell(12, 18.6, 9, 1.0, 'D', 0, is('G'));
  p.thick(4, 12, 15.5, 12, 3.0, 'O');                                // long body
  p.ell(17.5, 8.4, 3.2, 2.8, 'O');                                   // head
  p.thick(18, 9.2, 22.2, 10.2, 1.4, 'O');                            // snout
  p.set(22, 10, 'D'); p.set(23, 10, 'D');                            // nose
  p.ell(15.6, 10.2, 1.6, 3.2, 'N', 0.2);                             // floppy ear
  p.rect(18, 7, 18, 7, 'D'); p.set(19, 7, 'D'); p.set(18, 6, 'W');   // eye
  p.thick(15, 10.6, 15, 13.4, 1.0, 'R'); p.set(15, 14, 'Y');         // collar + tag
  p.rect(5, 14, 6, 17, 'N'); p.rect(8, 14, 9, 17, 'O'); p.rect(13, 14, 14, 17, 'N'); p.rect(16, 13, 17, 17, 'O'); // legs
  p.thick(1.3, 8.0, 3.6, 11.0, 0.8, 'O');                            // tail
  p.map((v, x, y) => v === 'O' && y >= 14 && x < 17 ? 'N' : null);    // belly shade
  p.set(3, 2, 'W'); p.rect(2, 3, 5, 3, 'W'); p.set(15, 2, 'W'); p.rect(14, 3, 17, 3, 'W');
  p.set(2, 20, 'Y'); p.set(20, 21, 'K'); p.set(11, 22, 'Y');
  return p;
}

/* ---------------- dog busts (template) ---------------- */
function bust(o) {
  const p = Pic(o.bg);
  if (o.bg2) p.rect(0, o.bg2y || 18, 23, 23, o.bg2);
  if (o.under) o.under(p);
  const fur = o.fur, sh = o.shade || fur, m = o.muzzle || 'W';
  // shoulders + chest
  p.poly([[5.5, 17], [18.5, 17], [22.5, 24], [1.5, 24]], fur);
  if (o.chest) p.poly([[9, 19], [15, 19], [16, 24], [8, 24]], o.chest);
  // ears behind head
  if (o.ear === 'flop') { p.ell(5.0, 11.6, 2.7, 5.6, o.earCol, 0.28); p.ell(19.0, 11.6, 2.7, 5.6, o.earCol, -0.28); }
  if (o.ear === 'up') {
    p.poly([[4.2, 9], [5.8, 0.6], [11, 5.2]], o.earCol); p.poly([[19.8, 9], [18.2, 0.6], [13, 5.2]], o.earCol);
    if (o.inner) { p.poly([[5.6, 7.2], [6.4, 2.8], [9.2, 5.6]], o.inner); p.poly([[18.4, 7.2], [17.6, 2.8], [14.8, 5.6]], o.inner); }
  }
  if (o.ear === 'small') { p.ell(5.4, 5.6, 2.0, 1.6, o.earCol, -0.6); p.ell(18.6, 5.6, 2.0, 1.6, o.earCol, 0.6); }
  p.ell(12, 10.8, o.hw || 7.4, o.hh || 6.9, fur);                    // head
  if (o.ear === 'flop' && o.earFront) { p.ell(5.2, 12.0, 2.3, 5.0, o.earCol, 0.28); p.ell(18.8, 12.0, 2.3, 5.0, o.earCol, -0.28); }
  if (o.ear === 'small') { p.ell(6.0, 5.4, 1.6, 1.3, o.earCol, -0.6); p.ell(18.0, 5.4, 1.6, 1.3, o.earCol, 0.6); }
  // right-side shading
  if (sh !== fur) p.map((v, x, y) => v === fur && (x + 0.5 - 12) > 3.2 && (x + 0.5 - 12) * 0.85 + (y - 10) * 0.25 > 4.2 ? sh : null);
  if (o.blaze) p.poly([[11, 4.2], [13, 4.2], [13.8, 12], [10.2, 12]], m);
  if (o.mask) { p.ell(8.8, 9.4, 2.6, 1.9, m); p.ell(15.2, 9.4, 2.6, 1.9, m); p.ell(12, 15.6, 5.6, 3.6, m); }
  p.ell(12, 14.9, o.mw || 4.8, o.mh || 3.4, m);                      // muzzle
  if (o.beforeFace) o.beforeFace(p);
  // eyes
  const ey = o.ey || 9;
  for (const ex of [8, 14]) { p.rect(ex, ey, ex + 1, ey + 1, 'D'); p.set(ex, ey, 'W'); if (o.eye) p.set(ex + 1, ey + 1, o.eye); }
  // nose + mouth
  p.rect(10, 12, 13, 12, 'D'); p.rect(11, 13, 12, 13, 'D');
  if (!o.noMouth) { p.set(10, 15, 'D'); p.set(13, 15, 'D'); p.rect(11, 14, 12, 14, 'D'); }
  if (o.tongue) { p.rect(11, 15, 12, 16, 'R'); p.set(11, 16, 'K'); }
  if (o.cheek) { p.set(7, 13, o.cheek); p.set(16, 13, o.cheek); }
  // collar + tag
  if (o.collar) { p.map((v, x, y) => (y === 18 || y === 19) && v !== o.bg && v !== o.bg2 && v !== (o.keep || '') && x > 3 && x < 20 ? o.collar : null); p.rect(11, 20, 12, 21, o.tag || 'Y'); }
  if (o.after) o.after(p);
  return p;
}
const labrador = () => bust({ bg: 'C', bg2: 'G', fur: 'Y', shade: 'O', ear: 'flop', earCol: 'O', earFront: true, muzzle: 'W', tongue: true, collar: 'R', tag: 'B', cheek: 'K' });
const husky = () => bust({ bg: 'B', fur: 'D', ear: 'up', earCol: 'D', inner: 'K', mask: true, muzzle: 'W', eye: 'C', tongue: true, collar: 'R', chest: 'W', blaze: true,
  after: p => { p.set(3, 2, 'W'); p.set(20, 3, 'W'); p.set(2, 15, 'W'); p.set(22, 12, 'W'); p.set(21, 20, 'W'); } });
const corgi = () => bust({ bg: 'G', fur: 'O', shade: 'N', ear: 'up', earCol: 'O', inner: 'K', blaze: true, muzzle: 'W', tongue: true, collar: 'B', tag: 'Y', chest: 'W', hw: 7.8, cheek: 'K' });
const _mops_old = () => bust({ bg: 'K', fur: 'Y', shade: 'O', ear: 'small', earCol: 'D', muzzle: 'D', ey: 8, tongue: true, collar: 'P', tag: 'Y', mw: 4.4, mh: 3.6, noMouth: true,
  beforeFace: p => { p.rect(10, 6, 13, 6, 'O'); p.rect(9, 7, 10, 7, 'O'); p.rect(13, 7, 14, 7, 'O'); },
  after: p => { for (const ex of [8, 14]) { p.rect(ex - 1, 8, ex + 1, 9, 'D'); p.set(ex - 1, 8, 'W'); p.set(ex, 8, 'W'); } p.rect(10, 12, 13, 12, 'N'); p.rect(11, 13, 12, 13, 'N'); } });
const dalmatia = () => bust({ bg: 'R', fur: 'W', ear: 'flop', earCol: 'D', muzzle: 'W', tongue: true, collar: 'B', tag: 'Y', shade: 'C',
  after: p => { for (const [x, y] of [[9, 5], [14, 5], [6, 9], [17, 8], [11, 7], [7, 12], [16, 12], [5, 21], [17, 21], [9, 22], [19, 23], [14, 23], [3, 23]]) if (p.get(x, y) === 'W' || p.get(x, y) === 'C') { p.set(x, y, 'D'); } } });
const beagle = () => bust({ bg: 'G', fur: 'N', shade: 'N', ear: 'flop', earCol: 'D', earFront: true, blaze: true, muzzle: 'W', tongue: true, collar: 'R', tag: 'Y', chest: 'W',
  after: p => { p.rect(7, 4, 16, 6, 'D'); p.poly([[11, 4], [13, 4], [13.6, 7], [10.4, 7]], 'W'); p.set(8, 8, 'O'); p.set(9, 8, 'O'); p.set(14, 8, 'O'); p.set(15, 8, 'O'); } });
const _pudla_old = () => bust({ bg: 'P', fur: 'W', ear: 'flop', earCol: 'K', earFront: true, muzzle: 'W', hw: 6.6, hh: 6.4,
  under: p => { p.ell(12, 3.6, 4.2, 3.2, 'W'); },
  beforeFace: p => { p.ell(12, 14.9, 4.6, 3.2, 'K'); p.ell(12, 14.4, 3.8, 2.6, 'W'); },
  collar: 'R', tag: 'Y',
  after: p => { p.rect(9, 1, 10, 2, 'R'); p.rect(13, 1, 14, 2, 'R'); p.rect(11, 2, 12, 2, 'R'); // bow
    p.map((v, x, y) => v === 'W' && (x + y * 2) % 5 === 0 && y < 7 ? 'K' : null); p.set(11, 15, 'R'); p.set(12, 15, 'R'); } });
const fjarhundur = () => bust({ bg: 'C', bg2: 'G', bg2y: 20, fur: 'O', shade: 'N', ear: 'up', earCol: 'O', inner: 'K', blaze: true, muzzle: 'W', tongue: true, chest: 'W', collar: 'R', tag: 'Y',
  under: p => { // Icelandic mountains with snow caps
    p.poly([[0, 20], [0, 14.5], [3.5, 10.5], [7.5, 15.5], [7.5, 20]], 'P'); p.poly([[24, 20], [24, 14], [20.5, 10], [16.5, 15.5], [16.5, 20]], 'P');
    p.poly([[1.9, 12.4], [3.5, 10.5], [5.2, 12.6], [4.2, 12.2], [3.5, 13], [2.8, 12.2]], 'W'); p.poly([[18.9, 11.9], [20.5, 10], [22.2, 12.1], [21.2, 11.7], [20.5, 12.5], [19.8, 11.7]], 'W');
    p.ell(3.4, 2.6, 1.8, 0.9, 'W'); p.ell(21.0, 3.4, 1.6, 0.9, 'W');
  },

  after: p => { // curled tail over the shoulder (signature of the breed)
    p.ring(20.2, 19.2, 1.4, 3.2, 'O'); p.ell(20.2, 19.2, 1.2, 1.2, 'W'); p.set(21, 21, 'N'); p.set(22, 20, 'N'); } });

const mops = () => Pic('K').patch(["KKKKKKKKKKKKKKKKKKKKKKKK", "KKKKKKKKKKKKKKKKKKKKKKKK", "KKKKKKKKYYYYYYYYKKKKKKKK", "KKKKKKYYYYYYYYYYYYKKKKKK", "KKKDDYYYYOYYYYOYYYYDDKKK", "KKDDDYYYYYOOOOYYYYYDDDKK", "KKDDYYYYYYYYYYYYYYYYDDKK", "KKKYYYYYYYYYYYYYYYYYYKKK", "KKYYYYDDDYYYYYYDDDYYYOKK", "KKYYYDDWWDYYYYDDWWDYYOKK", "KKYYYDDWDDYYYYDDWDDYYOKK", "KKYYYYDDDYYYYYYDDDYYYOKK", "KKYYYYYYYYDDDDYYYYYYOOKK", "KKKYYYYYYDDDDDDYYYYYOKKK", "KKKYYYYYDDDNNDDDYYYOOKKK", "KKKKYYYYDDDDDDDDYYYOKKKK", "KKKKKYYYYDDDDDDYYYOKKKKK", "KKKKKKYYYYDRRDYYYOKKKKKK", "KKKKKBBBBBBBBBBBBBBKKKKK", "KKKKBBBBBBBBBBBBBBBBKKKK", "KKKYYYYYYYYWWYYYYYOOOKKK", "KKKYYYYYYYYWWYYYYYOOOOKK", "KKYYYYYYYYYYYYYYYYYOOOKK", "KKYYYYYYYYYYYYYYYYYOOOKK"]);
const pudla = () => { // pink poodle with pom-poms and a shaved face
  const p = Pic('C');
  p.poly([[6, 17], [18, 17], [22, 24], [2, 24]], 'K');                     // body
  p.ell(12, 22.5, 9, 3.2, 'K');
  p.ell(12, 12.0, 4.6, 5.8, 'W');                                           // shaved face
  p.ell(12, 4.2, 5.4, 3.6, 'K');                                            // top-knot pom
  p.ell(5.0, 12.6, 3.3, 5.0, 'K'); p.ell(19.0, 12.6, 3.3, 5.0, 'K');       // ear poms
  for (const [x, y] of [[9, 2], [14, 3], [11, 5], [4, 10], [6, 14], [3, 15], [18, 10], [20, 14], [17, 16], [5, 22], [18, 22], [10, 23]]) p.set(x, y, 'P'); // curls
  p.rect(9, 10, 10, 11, 'D'); p.rect(13, 10, 14, 11, 'D'); p.set(9, 10, 'P'); p.set(13, 10, 'P'); // eyes
  p.rect(10, 13, 13, 13, 'D'); p.rect(11, 14, 12, 14, 'D');                 // nose
  p.set(10, 15, 'D'); p.set(13, 15, 'D'); p.rect(11, 15, 12, 16, 'R');     // mouth + tongue
  p.set(8, 13, 'K'); p.set(15, 13, 'K');
  p.rect(7, 18, 16, 19, 'Y'); p.rect(11, 20, 12, 21, 'R');                  // collar + tag
  p.rect(9, 0, 10, 1, 'R'); p.rect(13, 0, 14, 1, 'R'); p.rect(11, 1, 12, 1, 'R'); // bow
  return p;
};
const ART = { bein, loppa, skal, bolti, kofi, ol, frisbi, bruni, pylsa, labrador, greifingi, husky, dalmatia, mops, corgi, karfa, beagle, pudla, hjartaloppa, fjarhundur };
module.exports = { ART, N, Pic };

if (require.main === module) {
  // preview: block-style contact sheet via SVG -> PNG (ImageMagick)
  const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
  const COL = { R: '#ff4d5e', O: '#ff9a2e', Y: '#ffd23f', G: '#3ddc84', C: '#3cc8f4', B: '#3f6df2', P: '#9b5de5', K: '#ff7eb9', W: '#f7efdc', N: '#a8693f', D: '#4a4e6e' };
  const dark = h => { const n = parseInt(h.slice(1), 16); const f = v => Math.round(v * 0.62); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  const out = process.argv[2] || '/tmp/plart/art.png', s = 12, cols = 5;
  const keys = Object.keys(ART);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * (N * s + 24) + 8}" height="${Math.ceil(keys.length / cols) * (N * s + 40) + 8}"><rect width="100%" height="100%" fill="#2a1f3d"/>`;
  keys.forEach((k, i) => {
    const g = ART[k]().g, ox = 12 + (i % cols) * (N * s + 24), oy = 8 + Math.floor(i / cols) * (N * s + 40);
    svg += `<text x="${ox}" y="${oy + 14}" font-size="15" fill="#fff" font-family="sans-serif" font-weight="bold">${i + 1}. ${k}</text>`;
    g.forEach((r, y) => r.forEach((c, x) => {
      const X = ox + x * s, Y = oy + 22 + y * s;
      svg += `<rect x="${X + 0.5}" y="${Y + 0.5}" width="${s - 1}" height="${s - 1}" rx="2.5" fill="${dark(COL[c])}"/><rect x="${X + 0.5}" y="${Y + 0.5}" width="${s - 1}" height="${s - 2.4}" rx="2.5" fill="${COL[c]}"/>`;
    }));
  });
  fs.writeFileSync('/tmp/plart/art.svg', svg + '</svg>');
  execSync(`convert /tmp/plart/art.svg ${out}`);
  console.log('wrote', out);
}
