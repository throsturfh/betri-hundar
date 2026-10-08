/* ===== Pixel art: colour helpers, dog sprites, portraits, blocks, doghouses ===== */
const OUTLINE = '#2a1f3d';
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(...A.map((v, i) => Math.round(v + (B[i] - v) * t))); }
const shade = (c, t) => t < 0 ? mix(c, '#140c24', -t) : mix(c, '#ffffff', t);
const colHex = c => PL.COLORS[c].hex;

/* --- pack dog sprites, built procedurally on a pixel grid then auto-outlined --- */
const SPR = {};
function dogGrid(breed, frame) {
  const W = (breed === 'd' ? 21 : 19) + 2, H = 14 + 2;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const R = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const X = x + 1, Y = y + 3; if (Y >= 0 && Y < H && X >= 0 && X < W) g[Y][X] = ch; } };
  const P = (x, y, ch) => R(x, y, x, y, ch);
  if (breed === 'd') {           // Dachshund: long & low
    if (frame) { P(0, 4, 'b'); P(1, 5, 'b'); } else { P(0, 6, 'b'); P(1, 6, 'b'); }
    R(2, 5, 15, 8, 'b'); R(4, 8, 13, 8, 'w');
    R(14, 2, 17, 6, 'b'); R(17, 4, 19, 6, 'b'); R(17, 6, 19, 6, 'w'); P(19, 4, 'n'); P(16, 3, 'e');
    R(14, 3, 15, 7, 'd'); R(14, 7, 15, 7, 'c');
    if (frame) { R(2, 9, 3, 9, 'b'); R(13, 9, 14, 9, 'b'); P(1, 10, 'b'); P(15, 10, 'b'); }
    else { R(4, 9, 5, 10, 'b'); R(11, 9, 12, 10, 'b'); P(18, 7, 't'); }
  } else {
    const husky = breed === 'h';
    if (husky) { R(0, 1, 1, 2, 'b'); P(1, 3, 'w'); P(2, 4, 'b'); }
    else if (frame) { P(0, 1, 'b'); P(1, 2, 'b'); P(2, 3, 'b'); } else { P(0, 4, 'b'); P(1, 4, 'b'); P(2, 4, 'b'); }
    R(2, 4, 11, 8, 'b'); R(4, 8, 10, 8, 'w');
    R(10, 2, 12, 7, 'b');
    R(11, 0, 15, 4, 'b'); R(15, 2, 17, 4, 'b'); R(15, 4, 17, 4, 'w'); P(17, 2, 'n'); P(13, 1, 'e');
    if (husky) { R(13, 3, 15, 4, 'w'); P(12, -1, 'd'); P(12, -2, 'd'); P(14, -1, 'd'); P(14, -2, 'd'); P(11, 0, 'd'); R(9, 6, 12, 7, 'w'); }
    else R(11, 1, 12, 4, 'd');
    R(10, 5, 12, 5, 'c');
    if (frame) { R(1, 9, 2, 11, 'b'); R(12, 9, 13, 11, 'b'); } else { R(3, 9, 4, 11, 'b'); R(9, 9, 10, 11, 'b'); P(16, 5, 't'); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.') continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = g[y + dy] && g[y + dy][x + dx]; return v && v !== '.' && v !== 'o'; });
    if (n) g[y][x] = 'o';
  }
  return g;
}
function dogSprite(breed, col, frame) {
  const key = breed + col + frame;
  if (SPR[key]) return SPR[key];
  const g = dogGrid(breed, frame), H = g.length, W = g[0].length;
  const base = col.length === 1 ? colHex(col) : col;
  const pal = { b: base, d: shade(base, -0.3), w: shade(base, 0.55), o: OUTLINE, e: '#1c1428', n: '#1c1428', t: '#ff6b8b', c: col === 'R' ? '#ffd23f' : '#ff3355' };
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { const ch = g[y][i]; if (ch !== '.') { x.fillStyle = pal[ch]; x.fillRect(i, y, 1, 1); } }
  return (SPR[key] = cv);
}
function drawDog(ctx, breed, col, frame, cx, by, unit, flip, rot = 0) {
  const s = dogSprite(breed, col, frame);
  ctx.save(); ctx.translate(cx, by); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(s, -s.width * unit / 2, -s.height * unit, s.width * unit, s.height * unit);
  ctx.restore();
}

/* --- 32x32 rescued-dog portraits --- */
const PORTRAITS = {};
/* ---- hand-drawn portraits of our own dogs (drawn from the user's photos in ref/) ---- */
/* red bandana with the Red Cross badge (white disc + red cross), as worn in the photos */
function bandana({ set, ell, rect, tri }) {
  const R = '#e8262e', r = '#b8141e';
  tri(4.5, 24.5, 27.5, 24.5, 16, 33.5, R); rect(6, 24, 25, 25, R);
  for (let x = 6; x <= 25; x++) set(x, 26, R);
  set(6, 24, r); set(25, 24, r); for (let x = 9; x <= 22; x++) set(x, 24, R);
  [[8, 27], [9, 28], [10, 29], [23, 27], [22, 28], [21, 29]].forEach(([x, y]) => set(x, y, r));   // fold shading
  ell(16, 28.5, 3.6, 3.4, '#ffffff');                                                             // white badge disc
  rect(15, 27, 16, 30, '#e02020'); rect(14, 28, 17, 29, '#e02020');                            // red cross
}
function dogEyes(set, rect, iris, rim) {
  for (const ex of [11, 19]) {                             // big round 2x3 eyes: dark pupil, coloured iris, white glint
    if (rim) { set(ex - 1, 15, rim); set(ex + 2, 15, rim); }
    rect(ex, 15, ex + 1, 17, '#1a0f0a'); set(ex + 1, 16, iris); set(ex + 1, 17, iris); set(ex, 17, iris); set(ex, 15, '#ffffff');
  }
}
const CUSTOM_PORTRAIT = {
  /* LOTTA: black border collie, semi-erect ears with tipped tips, narrow off-centre white blaze,
     white muzzle with grey ticking, brown eyes, white chest, red Red Cross bandana */
  lotta({ set, ell, rect, tri, rnd }) {
    const K = '#1e1c26', K2 = '#2c2936', k = '#3b3749', W = '#f6f4ef', w = '#d8d5cf', g = '#8a8794';
    ell(16, 33, 12.5, 8, K, 0.3);                           // shoulders
    ell(16, 32.5, 7.5, 6.5, W, 0.3);                        // white chest
    [[11, 28], [20, 29], [12, 31], [21, 27]].forEach(([x, y]) => set(x, y, g));
    tri(5.5, 3.5, 6, 15, 13, 9, K); tri(26.5, 3.5, 26, 15, 19, 9, K);           // ears (semi-erect)
    tri(5.5, 3.5, 1.8, 7.2, 7, 7, K2); tri(26.5, 3.5, 30.2, 7.2, 25, 7, K2);    // tipped / folded tips
    tri(7, 8, 7, 13, 10.5, 10.5, '#46384a'); tri(25, 8, 25, 13, 21.5, 10.5, '#46384a');
    ell(16, 17.5, 10.2, 9.3, K, 0.28);                      // head, fluffy cheeks
    rect(12, 9, 13, 9, k); rect(18, 8, 20, 8, k); set(21, 9, k); set(11, 10, k);   // sheen
    rect(14, 8, 15, 15, W); set(14, 7, W); set(16, 13, W); set(16, 14, W); set(13, 15, W);   // blaze (off-centre, as in the photos)
    ell(15.6, 22, 6.1, 4.4, W); rect(12, 19, 19, 19, W);    // muzzle
    set(21, 21, K); set(21, 22, K); set(20, 23, K2);        // her muzzle is darker on one side
    rect(13, 25, 18, 25, W);                                // chin
    const tick = [[11, 21], [13, 23], [12, 19], [19, 21], [18, 24], [20, 22], [19, 19], [14, 25], [17, 25], [11, 24]];
    tick.forEach(([x, y]) => set(x, y, g));                // fine grey ticking on the white muzzle
    dogEyes(set, rect, '#8a4f22', null);
    rect(14, 18, 17, 19, '#121018'); set(14, 18, W); set(17, 18, W); set(15, 18, '#5c586e');   // nose
    set(15, 20, '#121018'); set(16, 20, '#121018'); set(16, 21, '#121018');
    set(14, 22, '#121018'); set(15, 22, '#121018'); set(17, 22, '#121018'); set(18, 22, '#121018');
    rect(15, 23, 16, 24, '#ff6b8b'); set(16, 24, '#e04a6e');   // tongue peeking out
    bandana({ set, ell, rect, tri });
  },
  /* ROXY: red-brown & white Aussie/collie type, tall feathered ears with tipped tips, narrow white blaze,
     white muzzle, big fluffy white ruff, amber eyes, brown nose, red Red Cross bandana */
  roxy({ set, ell, rect, tri, rnd }) {
    const B = '#8a4527', B2 = '#a65c36', b = '#6a321b', T = '#c98a5c', W = '#fbf8f2', w = '#e2d9cc';
    ell(16, 33, 13, 8.5, B, 0.3);                           // shoulders
    ell(16, 31, 9.5, 7.5, W, 0.4); ell(16, 27, 8.5, 3.2, W, 0.4);   // big fluffy white ruff
    [[12, 30], [19, 31], [16, 32]].forEach(([x, y]) => set(x, y, w));
    tri(4.5, 1.5, 5.5, 15, 13, 9, B); tri(27.5, 1.5, 26.5, 15, 19, 9, B);       // tall ears
    tri(4.5, 1.5, 1.2, 5.5, 6, 5, b); tri(27.5, 1.5, 30.8, 5.5, 26, 5, b);      // tipped tips
    tri(6.5, 6, 6.5, 13, 10.5, 10, '#e3b48e'); tri(25.5, 6, 25.5, 13, 21.5, 10, '#e3b48e');  // light inner ear
    [[3, 9], [3, 12], [4, 14], [28, 9], [28, 12], [27, 14]].forEach(([x, y]) => set(x, y, T));   // feathering
    ell(16, 17.5, 10.3, 9.4, B, 0.3);                       // head
    rect(9, 18, 10, 21, T); rect(21, 18, 22, 21, T); set(8, 19, T); set(23, 19, T);   // lighter cheeks
    rect(11, 9, 12, 9, B2); rect(19, 9, 20, 9, B2); set(10, 10, B2); set(21, 10, B2); set(12, 13, b); set(19, 13, b);   // forehead highlights
    rect(15, 7, 16, 16, W);                                 // narrow blaze down the centre
    ell(16, 22.2, 5.8, 4.4, W); rect(13, 19, 18, 19, W);    // white muzzle
    rect(13, 25, 18, 25, W);
    set(12, 21, w); set(19, 21, w);
    dogEyes(set, rect, '#d8962e', null);
    rect(14, 18, 17, 19, '#5a2c20'); set(14, 18, W); set(17, 18, W); set(15, 18, '#9a6252');   // brown nose
    set(15, 20, '#5a2c20'); set(16, 20, '#5a2c20'); set(16, 21, '#5a2c20');
    set(14, 22, '#5a2c20'); set(15, 22, '#5a2c20'); set(17, 22, '#5a2c20'); set(18, 22, '#5a2c20');
    bandana({ set, ell, rect, tri });
  },
};
const PMASK = {};   // dog-pixel mask per portrait (for the album silhouettes)
function portrait(dog, N = 32) {
  if (PORTRAITS[dog.id]) return PORTRAITS[dog.id];
  let seed = 7; for (const ch of dog.id) seed = seed * 31 + ch.charCodeAt(0) >>> 0;
  const rnd = PL.rng(seed);
  const bg = new Array(N * N), d = new Array(N * N).fill(null);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = Math.atan2(y - 18, x - 16); bg[y * N + x] = (Math.floor((a + Math.PI) / (Math.PI / 7)) % 2) ? dog.bg1 : dog.bg2;
  }
  if (dog.sky === 'dusk') {            // rökkur: sunset bands + a low sun
    const band = ['#3d2a6b', '#5b3a86', '#8a4c9c', '#c86fae', '#f28c8c', '#ffb36b', '#ffd38a'];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) bg[y * N + x] = band[Math.min(band.length - 1, (y / 4.2) | 0)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - 26) ** 2 + (y - 25) ** 2 < 20) bg[y * N + x] = '#fff0a8';
  } else if (dog.sky === 'night') {    // myrkvi: night sky with stars
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) bg[y * N + x] = y < 11 ? '#1b2250' : y < 22 ? '#25316a' : '#2c3a78';
  }
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) d[y * N + x] = c; };
  const ell = (cx, cy, rx, ry, c, fuzz = 0) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (v <= 1 || (fuzz && v <= 1 + fuzz && rnd() < 0.5)) set(x, y, c);
    }
  };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const tri = (ax, ay, bx, by, cx, cy, c) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax), s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx), s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
      if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) set(x, y, c);
    }
  };
  if (CUSTOM_PORTRAIT[dog.id]) CUSTOM_PORTRAIT[dog.id]({ set, ell, rect, tri, rnd, N, d });
  else {
    const fz = dog.fluffy ? 0.35 : 0, hry = dog.long ? 10.5 : 9.5, hrx = dog.long ? 9 : 10.2;
    ell(16, 33, 12, 7.5, dog.fur, fz);                               // shoulders
    ell(16, 33, 6, 5.5, dog.fur2);                                   // chest
    if (dog.saddle && dog.id === 'loki') ell(16, 34, 12, 3, dog.saddle);
    if (dog.ear === 'flop') { ell(6.5, 18, 3.8, 8, dog.earCol, fz); ell(25.5, 18, 3.8, 8, dog.earCol, fz); }
    else {
      tri(5, 1, 5, 15, 14, 9, dog.earCol); tri(27, 1, 27, 15, 18, 9, dog.earCol);
      tri(6.5, 5, 6.5, 13, 11.5, 10, '#ffb3c7'); tri(25.5, 5, 25.5, 13, 20.5, 10, '#ffb3c7');
      if (dog.ear === 'fold') { rect(4, 4, 8, 6, shade(dog.earCol, -0.25)); rect(24, 4, 28, 6, shade(dog.earCol, -0.25)); for (let y = 0; y < 4; y++) for (let x = 0; x < N; x++) d[y * N + x] = null; }
    }
    ell(16, 17.5, hrx, hry, dog.fur, fz);                            // head
    if (dog.saddle && dog.id !== 'loki') ell(16, 10, 8.5, 4, dog.saddle);
    if (dog.mask) { ell(16, 21, 8.8, 6.5, dog.fur2); ell(11.5, 13.2, 1.6, 1, dog.fur2); ell(20.5, 13.2, 1.6, 1, dog.fur2); }
    if (dog.blaze) { rect(15, 8, 16, 18, dog.fur2); ell(16, 9, 1.5, 1.5, dog.fur2); }
    if (dog.patch) { ell(11.5, 15.5, 4, 3.8, dog.patch); }
    if (dog.spots) for (let i = 0; i < 9; i++) { const x = 8 + rnd() * 16, y = 9 + rnd() * 14; if (Math.abs(y - 16) < 2.5 && (Math.abs(x - 12) < 2.5 || Math.abs(x - 20) < 2.5)) continue; ell(x, y, 1.3, 1.1, dog.spots); }
    if (dog.fringe) { rect(9, 11, 23, 13, shade(dog.fur, -0.12)); for (let x = 9; x <= 23; x += 2) set(x, 14, shade(dog.fur, -0.12)); }
    ell(16, 22.5, 6.2, 4.6, dog.fur2);                               // muzzle
    if (dog.id === 'tryggur') ell(16, 22.5, 5.2, 3.8, '#3a3030');
    const eye = dog.eyeCol;
    if (dog.brows) for (const ex of [11, 20]) { ell(ex + 1, 13.3, 1.4, 0.9, dog.brows); }
    if (dog.eyeRing) for (const ex of [11, 20]) rect(ex - 1, 14, ex + 2, 18, dog.eyeRing);
    if (dog.sheen) { rect(12, 9, 14, 9, dog.sheen); rect(13, 10, 16, 10, dog.sheen); rect(17, 9, 18, 9, dog.sheen); }
    for (const ex of [11, 20]) {
      rect(ex, 15, ex + 1, 17, '#1c1428');
      if (eye) { set(ex, 16, eye); set(ex + 1, 16, eye); set(ex, 17, eye); }
      set(ex, 15, '#ffffff');
    }
    rect(14, 19, 17, 20, '#1c1428'); set(15, 19, '#6e6a8a');       // nose
    set(14, 19, null); set(17, 19, null); rect(14, 19, 14, 19, '#1c1428');
    set(16, 21, '#1c1428'); set(15, 22, '#1c1428'); set(17, 22, '#1c1428'); set(14, 22, '#1c1428'); set(18, 22, '#1c1428');
    if (dog.tongue) { rect(15, 23, 17, 25, '#ff6b8b'); set(16, 24, '#e04a6e'); set(15, 25, null); set(17, 25, null); rect(16, 25, 16, 25, '#ff6b8b'); }
    set(9, 20, '#ff9eb5'); set(10, 20, '#ff9eb5'); set(22, 20, '#ff9eb5'); set(23, 20, '#ff9eb5');
    if (dog.bow) { rect(19, 6, 20, 8, '#ff3355'); rect(23, 6, 24, 8, '#ff3355'); rect(21, 7, 22, 7, '#c4163a'); }
    for (let x = 8; x <= 24; x++) for (const y of [28, 29]) if (d[y * N + x]) d[y * N + x] = '#ff3355';
    if (d[30 * N + 16]) {
      if (dog.family) { rect(14, 30, 15, 30, '#ff4f8b'); rect(17, 30, 18, 30, '#ff4f8b'); rect(14, 31, 18, 31, '#ff4f8b'); rect(15, 32, 17, 32, '#ff4f8b'); set(16, 33, '#ff4f8b'); set(16, 30, '#ff4f8b'); set(14, 30, '#ffa6c6'); }
      else { rect(15, 30, 17, 31, '#ffd23f'); set(16, 31, '#d9a400'); }
    }
  }
  const out = d.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (d[y * N + x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < N && Y < N && d[Y * N + X]; })) out[y * N + x] = OUTLINE;
  }
  PMASK[dog.id] = out.map(Boolean);
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  const c = cv.getContext('2d');
  for (let i = 0; i < N * N; i++) { c.fillStyle = out[i] || bg[i]; c.fillRect(i % N, (i / N) | 0, 1, 1); }
  if (dog.sky === 'night') {
    c.fillStyle = '#fff6d0'; [[2, 3], [9, 1], [29, 9], [3, 13], [30, 18], [24, 2], [1, 22]].forEach(([x, y]) => c.fillRect(x, y, 1, 1));
    c.fillStyle = '#ffffff'; [[2, 3], [29, 9]].forEach(([x, y]) => { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); });
  }
  if (dog.eclipse) {                   // myrkvi = eclipse: dark disc with a golden corona, top-right
    for (let y = 0; y < 10; y++) for (let x = 22; x < N; x++) {
      const r2 = (x + 0.5 - 27) ** 2 + (y + 0.5 - 4.5) ** 2;
      if (r2 <= 9) { if (!out[y * N + x]) { c.fillStyle = '#0e0c18'; c.fillRect(x, y, 1, 1); } }
      else if (r2 <= 16.5 && !out[y * N + x]) { c.fillStyle = r2 <= 12.5 ? '#ffd86b' : '#ff9f43'; c.fillRect(x, y, 1, 1); }
    }
  }
  if (dog.family) { c.fillStyle = '#ff7fae'; [[3, 4], [28, 26]].forEach(([x, y]) => { c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x - 1, y + 1, 3, 1); c.fillRect(x, y + 2, 1, 1); }); }
  if (dog.special) { c.fillStyle = '#fff6b0'; [[3, 3], [28, 5], [4, 26], [27, 24], [2, 14]].forEach(([x, y]) => { c.fillRect(x, y - 1, 1, 3); c.fillRect(x - 1, y, 3, 1); }); }
  return (PORTRAITS[dog.id] = cv);
}
function silhouette(dog) {
  const src = portrait(dog), cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0);
  const im = c.getImageData(0, 0, 32, 32), mask = PMASK[dog.id];
  for (let i = 0; i < im.data.length; i += 4) {
    if (!mask[i >> 2]) { im.data[i] = 70; im.data[i + 1] = 60; im.data[i + 2] = 120; } else { im.data[i] = 38; im.data[i + 1] = 28; im.data[i + 2] = 66; }
  }
  c.putImageData(im, 0, 0); return cv;
}

/* --- treat blocks (pre-rendered per colour & size) --- */
const BLK = {};
function blockImg(c, s, locked) {
  const key = c + s + (locked ? 'L' : '');
  if (BLK[key]) return BLK[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const x = cv.getContext('2d'), base = colHex(c), r = Math.max(2, s * 0.2), m = Math.max(1, Math.round(s * 0.04));
  const rr = (a, b, w, h, rad) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, rad) : x.rect(a, b, w, h); };
  rr(m, m, s - 2 * m, s - 2 * m, r); x.fillStyle = shade(base, -0.35); x.fill();
  rr(m, m, s - 2 * m, s - 2 * m - Math.max(2, s * 0.1), r); x.fillStyle = base; x.fill();
  if (!locked) { rr(m + s * 0.12, m + s * 0.1, s * 0.45, s * 0.16, s * 0.08); x.fillStyle = 'rgba(255,255,255,.5)'; x.fill(); }
  x.fillStyle = locked ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,.6)'; x.fillRect(Math.round(s * 0.66), Math.round(s * 0.2), Math.max(1, s * 0.09), Math.max(1, s * 0.09));
  x.fillStyle = shade(base, -0.18); // tiny kibble pattern
  x.fillRect(Math.round(s * 0.3), Math.round(s * 0.55), Math.max(1, s * 0.1), Math.max(1, s * 0.1));
  x.fillRect(Math.round(s * 0.6), Math.round(s * 0.62), Math.max(1, s * 0.1), Math.max(1, s * 0.1));
  if (locked) { rr(m, m, s - 2 * m, s - 2 * m, r); x.fillStyle = 'rgba(40,20,70,.2)'; x.fill(); }
  return (BLK[key] = cv);
}

/* --- doghouse --- */
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
function drawHouse(ctx, x, y, w, h, c, n, breed, o = {}) {
  const base = colHex(c), t = o.time || 0;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = 'rgba(20,10,40,.25)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.98, w * 0.46, h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  const lw = Math.max(2, w * 0.035);
  ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
  roundRect(ctx, x + w * 0.1, y + h * 0.36, w * 0.8, h * 0.6, w * 0.06); ctx.fillStyle = shade(base, 0.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 1; i < 4; i++) ctx.fillRect(x + w * 0.1 + lw, y + h * (0.36 + i * 0.15), w * 0.8 - 2 * lw, Math.max(1, h * 0.015));
  ctx.beginPath(); ctx.moveTo(x - w * 0.02, y + h * 0.44); ctx.lineTo(x + w / 2, y + h * 0.02); ctx.lineTo(x + w * 1.02, y + h * 0.44); ctx.closePath();
  ctx.fillStyle = shade(base, -0.12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.38); ctx.lineTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w * 0.9, y + h * 0.38); ctx.closePath(); ctx.fillStyle = base; ctx.fill();
  const dw = w * 0.3, dh = h * 0.36, dx = x + w * 0.5 - dw / 2, dy = y + h * 0.96 - dh;
  ctx.beginPath(); ctx.moveTo(dx, dy + dh); ctx.lineTo(dx, dy + dw / 2); ctx.arc(dx + dw / 2, dy + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, dy + dh); ctx.closePath();
  ctx.fillStyle = '#2a1f3d'; ctx.fill();
  const blink = ((t * 0.7 + (o.seed || 0)) % 4) < 0.12;
  const ey = dy + dh * 0.55, er = Math.max(1.5, dw * 0.11);
  if (!o.empty) {
    for (const ex of [dx + dw * 0.32, dx + dw * 0.68]) {
      ctx.fillStyle = '#fff'; if (blink) ctx.fillRect(ex - er, ey, er * 2, Math.max(1, er * 0.4)); else { ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill(); ctx.fillStyle = '#1c1428'; ctx.beginPath(); ctx.arc(ex + er * 0.25, ey + er * 0.15, er * 0.55, 0, 7); ctx.fill(); }
    }
  }
  if (n != null) {
    const fs = Math.round(h * (o.big ? 0.36 : 0.32));
    ctx.font = `900 ${fs}px system-ui, Roboto, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, fs * 0.22); ctx.strokeStyle = OUTLINE; ctx.strokeText(n, x + w / 2, y + h * 0.31);
    ctx.fillStyle = '#fff'; ctx.fillText(n, x + w / 2, y + h * 0.31);
  }
  if (breed && breed !== 'l') {
    const br = h * 0.2, bx = x + w * 0.9, by = y + h * 0.8;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fillStyle = breed === 'd' ? '#ffe2b8' : '#d8f1ff'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUTLINE; ctx.stroke();
    const spr = dogSprite(breed, breed === 'd' ? '#b0683a' : '#7c8799', 1), u = (br * 1.7) / spr.width;
    ctx.drawImage(spr, bx - spr.width * u / 2, by - spr.height * u * 0.62, spr.width * u, spr.height * u);
  }
  ctx.restore();
}
function drawBone(ctx, x, y, s, col, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = col; ctx.strokeStyle = OUTLINE; ctx.lineWidth = Math.max(1.5, s * 0.12);
  ctx.beginPath(); ctx.rect(-s * 0.55, -s * 0.18, s * 1.1, s * 0.36);
  for (const [a, b] of [[-0.6, -0.2], [-0.6, 0.2], [0.6, -0.2], [0.6, 0.2]]) { ctx.moveTo(a * s + s * 0.22, b * s); ctx.arc(a * s, b * s, s * 0.22, 0, 7); }
  ctx.stroke(); ctx.fill();
  ctx.restore();
}
