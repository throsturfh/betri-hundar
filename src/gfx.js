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
  [11, 19].forEach((ex, k) => {                            // big round 2x3 eyes: dark pupil, coloured iris, white glint
    const ir = Array.isArray(iris) ? iris[k] : iris;       // (an array gives each eye its own colour – merle odd eyes)
    if (rim) { set(ex - 1, 15, rim); set(ex + 2, 15, rim); }
    rect(ex, 15, ex + 1, 17, '#1a0f0a'); set(ex + 1, 16, ir); set(ex + 1, 17, ir); set(ex, 17, ir); set(ex, 15, '#ffffff');
  });
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
  /* ROXY: red & white Border Collie, tall feathered ears with tipped tips, narrow white blaze,
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
  /* RÖKKVI (boy): blue merle Border Collie – silver/blue-grey coat marbled with black and dark-grey patches, tan points
     (brows + cheeks), wide white collie blaze, white muzzle, white collar & chest, white front paws, one brown + one
     blue eye (common in merles). No bandana. Dusk background. */
  rokkvi({ set, ell, rect, tri }) {
    const S = '#93a0b6', s2 = '#b8c3d4', s3 = '#7584a0', G = '#596276', K = '#23212c', W = '#f7f6f2', w = '#d9d8d3', T = '#c98a4a';
    ell(16, 33, 12.8, 8, S, 0.3);                           // shoulders
    ell(5.5, 29.5, 3.2, 2.6, K); ell(27, 30.5, 3, 2.4, G); set(25, 28, K); set(24, 29, K); set(4, 26, G); set(7, 27, s2); set(26, 27, s2);
    ell(16, 29.2, 11, 2.9, W, 0.45); ell(16, 32, 6.4, 4.5, W, 0.3);   // white collar + chest
    [[13, 29], [19, 30], [16, 31], [7, 28], [25, 28]].forEach(([x, y]) => set(x, y, w));
    ell(6.2, 31.4, 2.4, 1.8, W); ell(25.8, 31.4, 2.4, 1.8, W);         // white front paws (with toe lines)
    [[5, 31], [7, 31], [25, 31], [27, 31]].forEach(([x, y]) => set(x, y, '#b7b6b8'));
    rect(9, 30, 10, 31, S); rect(21, 30, 22, 31, S); set(10, 29, G); set(21, 29, K);   // legs between paws and chest
    ell(16, 26.1, 8, 1.6, s3);                              // shadow under the chin (keeps muzzle & collar apart)
    tri(5.5, 3.5, 6, 15, 13, 9, G); tri(26.5, 3.5, 26, 15, 19, 9, K);         // ears: left dark-grey merle, right black
    tri(5.5, 3.5, 1.8, 7.2, 7, 7, K); tri(26.5, 3.5, 30.2, 7.2, 25, 7, G);    // tipped tips
    tri(7, 8, 7, 13, 10.5, 10.5, '#b88f9a'); tri(25, 8, 25, 13, 21.5, 10.5, '#9c7a88');
    set(7, 6, S); set(6, 9, K);
    ell(16, 17.5, 10.2, 9.3, S, 0.28);                      // head (silver-blue)
    ell(21.8, 12.6, 4.4, 4.1, K); ell(9.6, 11.6, 3.3, 2.7, G); ell(23.8, 18.5, 1.8, 2.2, G);   // marbled patches
    [[8, 15], [7, 17], [24, 21], [11, 8], [25, 15], [7, 20], [20, 8]].forEach(([x, y]) => set(x, y, K));
    [[12, 12], [8, 19], [23, 22], [18, 9], [25, 12]].forEach(([x, y]) => set(x, y, G));
    [[12, 9], [13, 10], [17, 10], [9, 16], [22, 16], [10, 21]].forEach(([x, y]) => set(x, y, s2));
    [[11, 13], [8, 18], [24, 20], [21, 17]].forEach(([x, y]) => set(x, y, s3));
    rect(11, 13, 12, 13, T); rect(19, 13, 20, 13, T);       // tan brow points
    rect(9, 19, 10, 21, T); rect(21, 19, 22, 21, T); set(8, 20, T); set(23, 20, T);   // tan cheeks
    rect(15, 6, 16, 9, W); rect(14, 10, 17, 16, W); set(14, 9, W);   // wide white collie blaze
    [[9, 9], [10, 10], [26, 18], [25, 19], [6, 15], [12, 24], [21, 24]].forEach(([x, y]) => set(x, y, G));   // more marbling
    [[22, 23], [9, 23]].forEach(([x, y]) => set(x, y, K));
    ell(16, 21.8, 6.2, 4.1, W); rect(12, 19, 19, 19, W);    // white muzzle
    rect(14, 25, 17, 25, W);
    set(12, 21, w); set(19, 21, w);
    dogEyes(set, rect, ['#8a4f22', '#7cc8f2'], null);       // odd eyes: brown + ice blue
    rect(14, 18, 17, 19, '#121018'); set(14, 18, W); set(17, 18, W); set(15, 18, '#5c586e');   // nose
    set(15, 20, '#121018'); set(16, 20, '#121018'); set(16, 21, '#121018');
    set(14, 22, '#121018'); set(15, 22, '#121018'); set(17, 22, '#121018'); set(18, 22, '#121018');
    rect(15, 23, 17, 24, '#ff6b8b'); set(16, 24, '#e04a6e'); set(16, 25, '#ff6b8b');   // happy tongue
  },
  /* MYRKVI (boy): black & white Border Collie, drawn like Lotta but told apart by: a centred blaze that widens into
     the muzzle (hers is narrow and off-centre), ears folded further forward, a full white collar ruff all round the
     neck, a clean white muzzle with no ticking, warm amber eyes. No bandana. Night sky + eclipse background. */
  myrkvi({ set, ell, rect, tri }) {
    const K = '#1c1a24', K2 = '#2a2735', k = '#3a3f5c', W = '#f7f6f2', w = '#d9d8d3';
    ell(16, 33, 13, 8, K, 0.3);                             // shoulders
    ell(16, 29.4, 12.6, 3.3, W, 0.55); ell(16, 32.5, 7.5, 4.5, W, 0.35);   // full white collar ruff all round + chest
    [[6, 29], [26, 29], [10, 31], [22, 31], [16, 31], [12, 28], [20, 28]].forEach(([x, y]) => set(x, y, w));
    ell(16, 26.3, 8.6, 1.7, K);                             // black neck under the chin (separates muzzle and ruff)
    tri(6.5, 5.5, 6, 15, 13, 9, K); tri(25.5, 5.5, 26, 15, 19, 9, K);         // ears, folded well forward
    tri(6.5, 5.5, 2.6, 10.6, 8.5, 9, K2); tri(25.5, 5.5, 29.4, 10.6, 23.5, 9, K2);
    tri(8, 9.5, 8, 13, 11, 11, '#45384c'); tri(24, 9.5, 24, 13, 21, 11, '#45384c');
    ell(16, 17.5, 10.2, 9.3, K, 0.28);                      // head
    rect(11, 9, 13, 9, k); rect(19, 9, 21, 9, k); set(10, 10, k); set(22, 10, k); set(9, 13, k); set(23, 13, k);   // bluish night sheen
    ell(16, 7.6, 1.5, 1.5, W); rect(15, 8, 16, 13, W); tri(12.2, 19.5, 19.8, 19.5, 16, 12, W);   // centred blaze widening down
    ell(16, 21.8, 6.4, 4.1, W); rect(12, 19, 19, 19, W);    // clean white muzzle (no ticking)
    rect(14, 25, 17, 25, W);
    set(11, 22, w); set(20, 22, w);
    dogEyes(set, rect, '#c9802c', null);
    rect(14, 18, 17, 19, '#121018'); set(14, 18, W); set(17, 18, W); set(15, 18, '#5c586e');   // nose
    set(15, 20, '#121018'); set(16, 20, '#121018'); set(16, 21, '#121018');
    set(14, 22, '#121018'); set(15, 22, '#121018'); set(17, 22, '#121018'); set(18, 22, '#121018');
    set(13, 21, '#121018'); set(19, 21, '#121018');         // little smile
  },
  /* JÖKULL (boy): all-white Border Collie – ivory coat; cream only at the coat edges / ruff folds so he reads on
     the card, and on the face only faint under-eye bags (no rings), dark brown eyes, black nose, semi-erect tipped ears, fluffy ruff. No bandana.
     Glacier background. */
  jokull({ set, ell, rect, tri }) {
    const W = '#fdfcf8', C = '#efe6d3', c = '#ddd0b6', P = '#f2c9c4';
    ell(16, 33, 13, 8.2, C, 0.35);                          // shoulders (cream)
    ell(16, 31.5, 10.5, 7, W, 0.45); ell(16, 27.3, 9.5, 3, W, 0.45);   // big fluffy white ruff
    [[8, 30], [24, 30], [11, 28], [21, 28], [14, 31], [18, 31], [6, 32], [26, 32]].forEach(([x, y]) => set(x, y, c));   // ruff folds
    tri(5.5, 3.5, 6, 15, 13, 9, C); tri(26.5, 3.5, 26, 15, 19, 9, C);         // ears
    tri(5.5, 3.5, 1.8, 7.2, 7, 7, c); tri(26.5, 3.5, 30.2, 7.2, 25, 7, c);    // tipped tips (a shade darker)
    tri(7, 8, 7, 13, 10.5, 10.5, P); tri(25, 8, 25, 13, 21.5, 10.5, P);       // pink inner ears
    ell(16, 17.5, 10.2, 9.3, C, 0.28);                      // head: cream base ...
    ell(15.4, 16.4, 8.9, 8.2, W);                           // ... ivory face, so the cream reads as soft shading at the edges
    rect(12, 9, 14, 9, '#ffffff'); rect(17, 8, 19, 8, '#ffffff');                     // highlights
    ell(16, 22, 6, 4.2, W); rect(13, 25, 18, 25, W);        // muzzle
    dogEyes(set, rect, '#5a3418', null);
    rect(11, 18, 12, 18, C); rect(19, 18, 20, 18, C);       // the ONLY face shading: small soft bags under the eyes (no rings)
    rect(14, 18, 17, 19, '#121018'); set(14, 18, W); set(17, 18, W); set(15, 18, '#5c586e');   // black nose
    set(15, 20, '#121018'); set(16, 20, '#121018'); set(16, 21, '#121018');
    set(14, 22, '#121018'); set(15, 22, '#121018'); set(17, 22, '#121018'); set(18, 22, '#121018');
    rect(15, 23, 16, 24, '#ff6b8b'); set(16, 24, '#e04a6e');   // tongue
  },
  /* EMIL (boy): white Havanese farm dog – round fluffy head, long silky drop ears, fringe, big dark eyes, wide open
     smile with tongue, sturdy broad chest, and always a little muddy (smudges on paws, legs and belly + a stray straw).
     No bandana. Farm background (field + red barn). */
  emil({ set, ell, rect, tri }) {
    const W = '#fffdf6', C = '#f0e6cf', c = '#ddcfae', M = '#8a6440', m = '#a8825a', S = '#f2cf5a';
    ell(16, 34, 12.5, 8, C, 0.4);                           // broad, sturdy shoulders
    ell(16, 31.5, 9.5, 6.5, W, 0.45);                       // fluffy chest
    ell(8.5, 30.4, 2.9, 2.1, W); ell(23.5, 30.4, 2.9, 2.1, W);   // front paws ...
    rect(6, 30, 10, 31, M); set(7, 29, m); set(9, 29, m); rect(22, 30, 25, 31, M); set(23, 29, m); set(25, 29, M); set(8, 31, m); set(23, 31, m);   // ... muddy
    [[12, 30], [13, 31], [19, 31], [20, 30], [16, 31], [10, 28]].forEach(([x, y]) => set(x, y, c));   // fur folds
    set(14, 29, m); set(15, 30, M); set(18, 29, m); set(21, 32, M); set(11, 32, m);                  // muddy belly smudges
    ell(7.6, 20, 3.4, 7.8, C, 0.4); ell(24.4, 20, 3.4, 7.8, C, 0.4);   // long silky drop ears
    [[7, 18], [7, 22], [25, 19], [24, 23], [6, 25], [26, 25]].forEach(([x, y]) => set(x, y, c));
    ell(16, 16.8, 9, 8.6, W, 0.3);                          // round fluffy head
    for (let x = 9; x <= 23; x += 2) set(x, 10, C); for (let x = 10; x <= 22; x += 2) set(x, 11, C);   // fringe
    rect(11, 12, 12, 12, c); rect(19, 12, 20, 12, c);
    ell(16, 22, 6, 4.2, W);                                 // muzzle
    dogEyes(set, rect, '#3a2412', null);
    rect(14, 18, 17, 19, '#121018'); set(14, 18, W); set(17, 18, W); set(15, 18, '#5c586e');   // nose
    set(16, 20, '#121018');
    set(11, 20, '#121018'); set(20, 20, '#121018');         // upturned corners ...
    rect(12, 21, 19, 21, '#121018'); rect(13, 22, 18, 22, '#5a1a24'); rect(14, 23, 17, 23, '#5a1a24');   // ... big open smile
    rect(14, 23, 17, 24, '#ff6b8b'); rect(15, 25, 16, 25, '#ff6b8b'); set(16, 24, '#e04a6e');                        // tongue out
    set(10, 20, '#ffb3c0'); set(21, 20, '#ffb3c0');         // happy cheeks
    set(22, 7, S); set(23, 6, S); set(24, 5, S); set(25, 4, S); set(23, 7, '#d9b03c');   // a stray straw in his hair
  },
  /* VARGUR (boy): Brussels Griffon from ref/vargur.jpg – small rough-coated dog, dark brindle (black + rusty red/tan
     streaks), wiry scruffy face, short flat muzzle with a black nose, slightly undershot chin with a little beard,
     big round glossy dark eyes, semi-folded fluffy ears flopping forward, tan brows/cheeks, rusty chest + leg.
     No bandana. Background: the cream fluffy blanket from the photo. */
  vargur({ set, ell, rect, tri }) {
    const K = '#221c1a', B = '#4a3a30', b = '#3a2e28', R = '#9a5a2e', r = '#b8743e', T = '#c99258', G = '#5e5650', g = '#3c3532';
    ell(16, 34, 13, 8.2, B, 0.4);                           // shoulders (brindle)
    for (let y = 26; y < 32; y++) for (let x = 3; x < 30; x++) if ((x * 2 + y * 3) % 7 === 0) set(x, y, K); else if ((x + y * 2) % 9 === 0) set(x, y, R);
    ell(21.5, 31, 5, 2.6, R, 0.3); [[19, 30], [22, 31], [24, 30], [20, 32]].forEach(([x, y]) => set(x, y, r));   // rusty leg across the chest
    ell(13, 29.5, 3.4, 2.4, T, 0.3);                        // tan chest
    ell(6, 13, 4, 5, K, 0.45); ell(26, 12.5, 4, 5, K, 0.45);           // semi-folded fluffy ears ...
    tri(3, 10, 9, 9, 4.5, 18, b); tri(29, 9.5, 23, 8.5, 27.5, 17.5, b);  // ... tips flopping forward
    set(25, 11, '#6a3a2a'); set(26, 12, '#6a3a2a');           // a hint of pink inside the right ear
    ell(16, 17, 9.8, 9, B, 0.45);                           // big round scruffy head
    for (let y = 9; y < 26; y++) for (let x = 7; x < 26; x++) if ((x * 3 + y * 5) % 11 === 0) set(x, y, K); else if ((x * 5 + y) % 13 === 0) set(x, y, R);   // wiry brindle
    ell(16, 12.2, 1.6, 2.8, T); set(16, 9, r); set(15, 9, r);  // tan forehead between the eyes
    set(10, 13, T); set(11, 13, T); set(20, 13, T); set(21, 13, T); set(9, 14, r); set(22, 14, r);   // tan brows (soft, outer)
    rect(8, 18, 9, 21, R); rect(22, 18, 23, 21, R); set(10, 19, T); set(21, 19, T);     // rusty cheeks
    ell(16, 20.5, 5.6, 4.6, g, 0.3);                        // dark grizzled muzzle
    [[12, 19], [19, 18], [13, 22], [18, 22], [11, 21], [20, 21]].forEach(([x, y]) => set(x, y, G));   // grizzle
    for (const ex of [10, 19]) {                            // big round glossy eyes (3x3)
      rect(ex, 15, ex + 2, 17, '#120a06'); set(ex, 15, '#ffffff'); set(ex + 1, 15, '#8c8480'); set(ex + 2, 17, '#4a2a18');
      set(ex - 1, 16, K); set(ex + 3, 16, K);
    }
    rect(15, 18, 16, 19, '#0e0a0a'); set(14, 19, '#0e0a0a'); set(17, 19, '#0e0a0a'); set(15, 18, '#6a6260');   // short flat muzzle, black nose
    rect(14, 21, 17, 21, '#120d0c');                        // mouth line
    rect(14, 22, 17, 22, '#2e2624'); set(13, 22, K); set(18, 22, K);   // slightly undershot chin ...
    rect(13, 23, 18, 24, g); rect(14, 25, 17, 25, g); set(15, 26, G); set(17, 26, g); set(13, 25, G);   // ... with a little scruffy beard
    [[14, 23], [16, 24], [18, 23], [15, 25], [13, 24]].forEach(([x, y]) => set(x, y, G));
    [[10, 20], [21, 20], [22, 22], [9, 22], [12, 24], [19, 24]].forEach(([x, y]) => set(x, y, G));   // wiry whisker wisps
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
  } else if (dog.sky === 'ice') {      // jökull: icy sky with glacier peaks
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) bg[y * N + x] = y < 9 ? '#cfeeff' : y < 18 ? '#b7e2f8' : '#9fd3ef';
    const peak = (px, py, hw, col) => { for (let y = py; y < N; y++) for (let x = 0; x < N; x++) if (Math.abs(x - px) <= (y - py) * hw) bg[y * N + x] = col; };
    peak(4, 14, 0.8, '#e9f7ff'); peak(27, 12, 0.7, '#e9f7ff'); peak(4, 17, 0.8, '#c3e6f7'); peak(28, 15, 0.7, '#c3e6f7');
    for (let y = 24; y < N; y++) for (let x = 0; x < N; x++) bg[y * N + x] = (x + y) % 7 ? '#f4fbff' : '#dff2fc';
  } else if (dog.sky === 'farm') {     // emil: blue sky, green field, a red barn on the left
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) bg[y * N + x] = y < 19 ? (y < 8 ? '#a9dcff' : '#c6e9ff') : (y < 23 ? '#8fd16a' : (x + y) % 5 ? '#79c257' : '#6bb24c');
    for (let y = 11; y < 21; y++) for (let x = 0; x < 6; x++) bg[y * N + x] = y < 14 && Math.abs(x - 2.5) > (y - 10) * 1.3 ? bg[y * N + x] : '#c8402f';   // barn
    for (let y = 15; y < 21; y++) for (let x = 1; x < 4; x++) bg[y * N + x] = (x + y) % 2 ? '#f6efe0' : '#8a2a1f';
    for (let x = 27; x < N; x++) for (let y = 15; y < 19; y++) bg[y * N + x] = y === 15 || y === 17 ? '#b58a55' : bg[y * N + x];   // fence
  } else if (dog.sky === 'blanket') {  // vargur: the cream fluffy blanket from his photo
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const w = Math.sin(x * 0.9 + y * 0.5) + Math.sin(y * 1.3 - x * 0.4); bg[y * N + x] = y < 10 ? '#f1ebe2' : w > 1 ? '#f6ecda' : w < -1 ? '#d9c6a6' : '#e8d9be'; }
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
  if (dog.sky === 'ice') { c.fillStyle = '#ffffff'; [[3, 3], [28, 6], [10, 1], [24, 1]].forEach(([x, y]) => { if (!out[y * N + x]) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } }); }
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

/* --- treat blocks (pre-rendered per colour & size) ---
   Glossy candy look, all baked once per colour/size into a small offscreen canvas (never per block per frame):
   soft drop shadow, darker bevel lip at the bottom, top-light vertical gradient on the face, a thin bright rim at
   the top and a top-left specular "bubble" + glint. The centre of every block stays its true colour so the
   picture the blocks form reads exactly as before. */
const BLK = {};
function blockImg(c, s, locked) {
  const key = c + s + (locked ? 'L' : '');
  if (BLK[key]) return BLK[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const x = cv.getContext('2d'), base = colHex(c);
  const m = Math.max(1, Math.round(s * 0.05)), r = Math.max(2, s * 0.22), w = s - 2 * m, h = s - 2 * m;
  const lip = Math.max(1, Math.round(s * 0.09)), drop = Math.max(1, Math.round(s * 0.04));
  const rr = (a, b, ww, hh, rad) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, ww, hh, rad) : x.rect(a, b, ww, hh); };
  // 1) soft drop shadow + bevel lip (darker body underneath the face)
  x.save(); x.shadowColor = 'rgba(16,6,36,.34)'; x.shadowBlur = Math.max(1, s * 0.06); x.shadowOffsetY = drop;
  rr(m, m, w, h - drop, r); x.fillStyle = shade(base, -0.3); x.fill(); x.restore();
  // 2) face with a gentle top-light gradient (bevel)
  const fh = h - drop - lip, g = x.createLinearGradient(0, m, 0, m + fh);
  g.addColorStop(0, shade(base, 0.24)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, -0.1));
  rr(m, m, w, fh, r); x.fillStyle = g; x.fill();
  if (s >= 10) {
    // 3) thin bright rim along the top edge
    const rg = x.createLinearGradient(0, m, 0, m + fh * 0.6);
    rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    const lw = Math.max(1, s * 0.05); rr(m + lw / 2, m + lw / 2, w - lw, fh - lw, Math.max(1, r - lw / 2)); x.lineWidth = lw; x.strokeStyle = rg; x.stroke();
    // 4) top-left specular bubble + bright glint
    const bx = m + w * 0.14, by = m + fh * 0.1, bw = w * 0.5, bh = fh * 0.3, sg = x.createLinearGradient(0, by, 0, by + bh);
    sg.addColorStop(0, `rgba(255,255,255,${locked ? 0.35 : 0.72})`); sg.addColorStop(1, 'rgba(255,255,255,.04)');
    rr(bx, by, bw, bh, bh / 2); x.fillStyle = sg; x.fill();
    x.fillStyle = `rgba(255,255,255,${locked ? 0.5 : 0.95})`; x.beginPath(); x.arc(m + w * 0.24, m + fh * 0.24, Math.max(0.8, s * 0.06), 0, 7); x.fill();
    // 5) a faint warm bounce-light at the bottom of the face
    x.fillStyle = 'rgba(255,255,255,.10)'; rr(m + w * 0.22, m + fh - Math.max(1, s * 0.09), w * 0.56, Math.max(1, s * 0.05), s * 0.03); x.fill();
  } else { x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(m + 1, m + 1, Math.max(1, w * 0.35), 1); }
  if (locked) { rr(m, m, w, h - drop, r); x.fillStyle = 'rgba(40,20,70,.22)'; x.fill(); }
  return (BLK[key] = cv);
}
/* --- sparkle sprite (soft glow + 4-point star), one per colour, drawn with 'lighter' for the eat burst --- */
const SPK = {};
function sparkleImg(col) {
  if (SPK[col]) return SPK[col];
  const S = 48, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d'), c = S / 2, rgb = hexRgb(col).join(',');
  const g = x.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.18, `rgba(${rgb},.75)`); g.addColorStop(0.5, `rgba(${rgb},.18)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.fillStyle = '#ffffff'; x.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rad = i % 2 ? S * 0.07 : S * 0.46; x.lineTo(c + Math.cos(a) * rad, c + Math.sin(a) * rad); }
  x.closePath(); x.fill();
  return (SPK[col] = cv);
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
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x + w * 0.1 + lw, y + h * 0.36 + lw, w * 0.8 - 2 * lw, h * 0.07);   // glossy wall top
  ctx.fillStyle = 'rgba(40,20,70,.14)'; ctx.fillRect(x + w * 0.1 + lw, y + h * 0.86, w * 0.8 - 2 * lw, h * 0.1 - lw);        // shaded wall foot
  ctx.beginPath(); ctx.moveTo(x - w * 0.02, y + h * 0.44); ctx.lineTo(x + w / 2, y + h * 0.02); ctx.lineTo(x + w * 1.02, y + h * 0.44); ctx.closePath();
  ctx.fillStyle = shade(base, -0.12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.38); ctx.lineTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w * 0.9, y + h * 0.38); ctx.closePath(); ctx.fillStyle = base; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.13, y + h * 0.355); ctx.lineTo(x + w / 2, y + h * 0.1); ctx.lineTo(x + w * 0.54, y + h * 0.15); ctx.lineTo(x + w * 0.24, y + h * 0.355); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();                                                            // glossy roof highlight
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x + w * 0.4, y + h * 0.17, Math.max(1, w * 0.022), 0, 7); ctx.fill();   // glint
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
