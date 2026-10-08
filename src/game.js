/* ===== Core gameplay screen ===== */
const TICK = 0.13;            // seconds per logic tick at 1x
let G = null;

function dogById(id) { return PL.DOGS.find(d => d.id === id) || PL.DOGS[0]; }
function startLevel(def, opts = {}) {
  const p = PL.parseLevel(def);
  G = {
    def, p, s: PL.newState(p), daily: !!opts.daily, dog: opts.daily ? dailyDog(def) : dogById(def.dog), bdirty: true,
    undo: [], undos: 0, packs: [], runners: [], sleds: [], parts: [], texts: [], banners: [], pending: new Map(),
    acc: 0, eaten: 0, total: p.cells.filter(Boolean).length, clears: 0, comboBonus: 0, lastClearT: -99, comboN: 0,
    over: false, won: false, wonT: 0, loseT: 0, shake: 0, chain: 0, chainT: 0, laneAnim: p.lanes.map(() => 0),
    flash: 0, flashCol: '#fff', hintTaps: 0, paused: false, time: 0, clearedShown: {}, denyT: 0, revealT: 0,
  };
  layoutGame();
  setScreen('game');
  showHint(def.hint || null);
  showTierIntro(def.tier);
  maybeBreedTip();
}
let tierT = 0;
function showTierIntro(t) {
  const chip = $('#tierChip'), box = $('#tierIntro'), T = TIERS[t] || {};
  chip.innerHTML = tierBadge(t, true); chip.classList.toggle('on', !!T.cls); $('#ctrls').classList.toggle('tiered', !!T.cls);
  box.classList.remove('on', 'x'); clearTimeout(tierT);
  if (!T.cls) return;
  box.innerHTML = `${tierBadge(t)}<div class="tsub">${t === 'x' ? 'Hugsaðu vel um hvert pikk!' : 'Passaðu taumana!'}<br>+${Math.round(T.bonus * 100)}% nammi-bónus</div>`;
  void box.offsetWidth; box.classList.add('on'); if (t === 'x') box.classList.add('x');
  Snd.bark(t === 'x' ? 0.8 : 1.0, 0, 0.3); vibrate(t === 'x' ? [40, 40, 40] : 30);
  tierT = setTimeout(() => box.classList.remove('on'), 2600);
}
function restartLevel() { if (G) startLevel(G.def, { daily: G.daily }); }

let L = {};
/* Layout for big (up to 24x24) boards on a ~390px portrait screen: the board takes the full width
   (cells up to 18px); if the screen is short, the doghouses/leash slots shrink first, then the cells. */
function layoutGame() {
  if (!G) return;
  const pad = 10, nl = G.p.lanes.length, bp = 6;
  L.top = 52;
  L.laneW = (W - pad * 2) / nl;
  L.slotW = (W - pad * 2) / 5;
  let hw = Math.min(nl === 2 ? 104 : 94, L.laneW - 16), slotH = Math.min(84, L.slotW * 1.05);
  let cell = Math.max(8, Math.min(18, Math.floor((W - 12 - bp * 2) / G.p.w)));
  const need = () => L.top + bp + cell * G.p.h + bp + pad + 4 + slotH + pad + hw * 0.84 * 2.12 + 14;
  while (need() > H && hw > 72) hw -= 2;
  while (need() > H && slotH > 62) slotH -= 2;
  while (need() > H && cell > 9) cell--;
  L.houseW = hw; L.houseH = hw * 0.84; L.slotH = slotH;
  L.lanesH = L.houseH * (1 + 0.62 + 0.5) + 14;
  L.cell = cell;
  L.bw = L.cell * G.p.w; L.bh = L.cell * G.p.h;
  const avail = H - L.top - L.slotH - L.lanesH - pad * 2 - 6;
  L.bx = Math.round((W - L.bw) / 2); L.by = Math.round(L.top + bp + Math.max(0, (avail - L.bh - bp * 2) / 2));
  L.slotY = L.by + L.bh + bp + pad + 2;
  L.lanesY = L.slotY + L.slotH + pad;
  L.unit = Math.max(1.15, L.cell / 12);
  L.pad = pad;
  G.bdirty = true;
}
const slotPos = k => ({ x: L.pad + L.slotW * (k + 0.5), y: L.slotY + L.slotH * 0.5 });
const laneX = i => L.pad + L.laneW * (i + 0.5);
const cellPos = i => ({ x: L.bx + (i % G.p.w + 0.5) * L.cell, y: L.by + (((i / G.p.w) | 0) + 0.5) * L.cell });

/* ---------- input ---------- */
function gameTap(x, y) {
  if (!G || G.over || G.won || G.paused) return;
  if (y < L.lanesY - 14) return;
  const i = Math.max(0, Math.min(G.p.lanes.length - 1, Math.floor((x - L.pad) / L.laneW)));
  tapLane(i);
}
function tapLane(i) {
  const snap = { s: PL.clone(G.s), eaten: G.eaten, clears: G.clears, comboBonus: G.comboBonus, cleared: Object.assign({}, G.clearedShown) };
  const ev = [];
  const r = PL.place(G.s, i, ev);
  if (r === -1) { Snd.deny(); return; }
  if (r === -2) { Snd.deny(); G.denyT = 0.5; floatText(W / 2, L.slotY - 8, 'Allir taumar uppteknir!', '#ff6b8b', 16); vibrate(30); return; }
  G.undo.push(snap); G.hintTaps++;
  if (G.hintTaps >= 2) hideHint();
  G.laneAnim[i] = 1;
  Snd.place(); vibrate(12);
  handleEvents(ev, i);
  updateCtrls();
}
function doUndo() {
  if (!G || !G.undo.length || G.won) return;
  const u = G.undo.pop();
  G.s = u.s; G.eaten = u.eaten; G.clears = u.clears; G.comboBonus = u.comboBonus; G.clearedShown = u.cleared;
  G.undos++; G.runners = []; G.sleds = []; G.pending.clear(); G.over = false; G.loseT = 0; G.bdirty = true;
  G.packs = G.s.slots.map((p, k) => p && makePackVis(p, k, null)).filter(Boolean);
  closeModal(); Snd.whoosh(); updateCtrls();
  floatText(W / 2, L.by + L.bh / 2, 'Afturkallað', '#fff', 20);
}

/* ---------- logic events -> visuals ---------- */
function makePackVis(p, k, fromLane) {
  const sp = slotPos(k);
  const pv = { id: p.id, slot: k, c: p.c, b: p.b, total: p.n, shown: p.n, out: 0, homeAfter: false, leaving: 0, t: 0, x: sp.x, y: sp.y, seed: Math.random() * 4 };
  if (fromLane != null) pv.fly = { x0: laneX(fromLane), y0: L.lanesY + L.houseH * 0.5, t: 0 };
  return pv;
}
const packById = id => G.packs.find(p => p.id === id);
function handleEvents(ev, lane) {
  for (const e of ev) {
    if (e.t === 'eat' || e.t === 'sled') G.bdirty = true;
    if (e.t === 'place') { G.packs.push(makePackVis(e.p, e.slot, lane)); }
    else if (e.t === 'eat') {
      const pv = packById(e.id), sp = slotPos(e.slot), cp = cellPos(e.cell);
      const dist = Math.hypot(cp.x - sp.x, cp.y - sp.y);
      G.runners.push({ pid: e.id, c: e.c, b: e.b, cell: e.cell, sx: sp.x, sy: sp.y - 6, tx: cp.x, ty: cp.y + L.cell * 0.35, t: 0, dur: 0.16 + dist / 900, phase: 0, seed: Math.random() * 9 });
      G.pending.set(e.cell, e.c);
      if (pv) pv.out++;
    } else if (e.t === 'home') { const pv = packById(e.id); if (pv) pv.homeAfter = true; }
    else if (e.t === 'sled') {
      const pv = packById(e.id);
      e.cells.forEach(i => G.pending.set(i, e.c));
      G.sleds.push({ pid: e.id, c: e.c, row: e.row, cells: e.cells.slice(), t: -0.25, popped: 0 });
      if (pv) pv.out++;
      Snd.sled(); G.shake = Math.max(G.shake, 4);
    }
  }
}
function eatVisual(cell, c, pid) {
  G.pending.delete(cell);
  G.eaten++;
  const cp = cellPos(cell);
  G.chain++; G.chainT = 0.7;
  Snd.crunch(G.chain);
  const base = colHex(c);
  for (let k = 0; k < 6; k++) G.parts.push({ x: cp.x, y: cp.y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 220 - 40, life: 0.5 + Math.random() * 0.3, max: 0.8, col: k < 4 ? base : '#fff', size: L.cell * (0.12 + Math.random() * 0.14), g: 700 });
  // sparkle burst: a quick colour ring + a few glowing 4-point stars (cached sprite, additive)
  G.parts.push({ ring: true, x: cp.x, y: cp.y, life: 0.32, max: 0.32, col: shade(base, 0.5), size: L.cell * 1.1 });
  const ns = G.sleds.length ? 1 : 3;   // husky sleds eat a whole row at once: keep it light
  for (let k = 0; k < ns; k++) { const a = Math.random() * 6.28, sp = 30 + Math.random() * 70;
    G.parts.push({ spark: true, x: cp.x, y: cp.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.38 + Math.random() * 0.22, max: 0.6, col: base, size: L.cell * (1.5 + Math.random() * 1.0), g: 60, rot: Math.random() * 1.6, vr: (Math.random() - 0.5) * 6 }); }
  const pv = packById(pid); if (pv) pv.shown = Math.max(0, pv.shown - 1);
  if (G.s.rem[c] === 0 && !G.clearedShown[c] && ![...G.pending.values()].includes(c)) colourCleared(c);
}
function colourCleared(c) {
  G.clearedShown[c] = true; G.clears++;
  const combo = (G.time - G.lastClearT < 6) ? ++G.comboN : (G.comboN = 1);
  G.lastClearT = G.time;
  const bonus = 10 * combo; G.comboBonus += bonus;
  const nm = PL.COLORS[c].name;
  banner(`Allt ${nm} nammið búið!`, combo > 1 ? `COMBO ×${combo}  +${bonus}` : `+${bonus} nammi`, colHex(c));
  Snd.clear(); if (combo > 1) Snd.combo(combo);
  G.flash = 0.5; G.flashCol = colHex(c); G.shake = Math.max(G.shake, 6 + combo * 2);
  confetti(W / 2, L.by + L.bh * 0.5, 40 + combo * 15, [colHex(c), '#fff', '#ffd23f']);
  vibrate(25);
}

/* ---------- juice helpers ---------- */
function floatText(x, y, txt, col, size = 18, life = 1.1) { (G || F).texts.push({ x, y, txt, col, size, life, max: life }); }
function banner(a, b, col) { G.banners.push({ a, b, col, t: 0, life: 2.0 }); }
function confetti(x, y, n, cols, target) {
  const arr = (target || G).parts;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 150 + Math.random() * 420;
    arr.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 250, life: 1.2 + Math.random() * 1.2, max: 2.4, col: cols[i % cols.length], size: 4 + Math.random() * 5, g: 520, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, conf: true });
  }
}
function vibrate(ms) { try { if (!save.mute && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

/* ---------- update ---------- */
function updateGame(dt) {
  if (!G) return;
  const sp = save.speed || 1;
  G.time += dt;
  if (!G.paused && !G.over && !G.won) {
    G.acc += dt * sp;
    let guard = 0;
    while (G.acc >= TICK && guard++ < 6) {
      G.acc -= TICK;
      const ev = []; PL.tick(G.s, ev); if (ev.length) handleEvents(ev);
    }
    if (G.acc > TICK) G.acc = 0;
  }
  const vdt = dt * sp;
  // runners
  for (const r of G.runners) {
    r.t += vdt;
    if (r.phase === 0 && r.t >= r.dur) { r.phase = 1; r.t = 0; eatVisual(r.cell, r.c, r.pid); }
    else if (r.phase === 1 && r.t >= 0.12) { r.phase = 2; r.t = 0; }
    else if (r.phase === 2 && r.t >= r.dur * 0.85) { r.done = true; const pv = packById(r.pid); if (pv) pv.out--; }
  }
  G.runners = G.runners.filter(r => !r.done);
  // husky sleds
  for (const sl of G.sleds) {
    sl.t += vdt;
    const prog = sl.t / 0.6, row0 = sl.cells[0] % G.p.w, row1 = sl.cells[sl.cells.length - 1] % G.p.w;
    const xNow = row0 + (row1 - row0 + 1) * prog;
    while (sl.popped < sl.cells.length && (sl.cells[sl.popped] % G.p.w) + 0.5 <= xNow) { eatVisual(sl.cells[sl.popped], sl.c, sl.pid); sl.popped++; }
    if (prog >= 1.25 && sl.popped >= sl.cells.length) { sl.done = true; const pv = packById(sl.pid); if (pv) pv.out--; }
  }
  G.sleds = G.sleds.filter(s => !s.done);
  // packs
  for (const pv of G.packs) {
    pv.t += dt;
    if (pv.fly) { pv.fly.t += dt / 0.3; if (pv.fly.t >= 1) pv.fly = null; }
    const lp = G.s.slots[pv.slot];
    pv.wait = !!(lp && lp.id === pv.id && lp.wait);
    if (pv.homeAfter && pv.out <= 0 && !pv.leaving) { pv.leaving = 0.001; Snd.bark(1.5, 0, 0.18); }
    if (pv.leaving) { pv.leaving += dt / 0.45; if (pv.leaving >= 1) pv.gone = true; }
  }
  G.packs = G.packs.filter(p => !p.gone);
  for (let i = 0; i < G.laneAnim.length; i++) G.laneAnim[i] = Math.max(0, G.laneAnim[i] - dt * 5);
  if (G.chainT > 0) { G.chainT -= dt; if (G.chainT <= 0) { if (G.chain >= 15) floatText(W / 2, L.by + L.bh - 10, `Namm ×${G.chain}!`, '#ffd23f', 22); G.chain = 0; } }
  stepParts(G.parts, dt); stepTexts(G.texts, dt);
  for (const b of G.banners) b.t += dt; G.banners = G.banners.filter(b => b.t < b.life);
  G.shake = Math.max(0, G.shake - dt * 30); G.flash = Math.max(0, G.flash - dt * 1.5); G.denyT = Math.max(0, G.denyT - dt);
  // win / lose
  if (!G.won && !G.over && PL.isWon(G.s) && !G.pending.size && !G.runners.length && !G.sleds.length) winLevel();
  if (!G.won && !G.over && G.s.slots.every(Boolean) && !G.runners.length && !G.sleds.length && PL.isStuck(G.s)) {
    G.loseT += dt; if (G.loseT > 0.7) loseLevel();
  } else G.loseT = 0;
  if (G.won) { G.wonT += dt; G.revealT = Math.min(1, G.revealT + dt * 0.8); if (G.wonT > 2.6 && !G.toFinale) { G.toFinale = true; startFinale(); } }
}
function stepParts(arr, dt) {
  for (const p of arr) { p.life -= dt; p.vy += (p.g || 0) * dt; p.vx *= (p.conf ? 0.985 : 1); p.x += p.vx * dt; p.y += p.vy * dt; if (p.rot != null) p.rot += p.vr * dt; }
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0) arr.splice(i, 1);
}
function stepTexts(arr, dt) { for (const t of arr) { t.life -= dt; t.y -= 34 * dt; } for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0) arr.splice(i, 1); }

function winLevel() {
  G.won = true; G.wonT = 0; hideHint(); G.banners = [];
  Snd.win(); vibrate([30, 60, 30]);
  confetti(W / 2, L.by + L.bh / 2, 140, ['#ff4d5e', '#ffd23f', '#3ddc84', '#3cc8f4', '#ff7eb9', '#9b5de5']);
  G.shake = 14;
  banner('Bjargað!', `${G.dog.name} er frjáls!`, '#ffd23f');
  updateCtrls();
}
function loseLevel() {
  G.over = true; Snd.lose(); vibrate(80);
  openModal(`<h2>Æ nei! 🐾</h2><p>Allir 5 taumarnir eru fullir og enginn hundur nær í nammi.</p>
    <div class="row">${G.undo.length ? '<button class="btn" data-act="undo">↶ Afturkalla</button>' : ''}
    <button class="btn alt" data-act="restart">⟲ Reyna aftur</button></div>`);
}

/* ---------- render ---------- */
function renderGame() {
  if (!G) return;
  const t = G.time;
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  drawBackdrop(t);   // (also contains the glossy board frame, baked into the cached backdrop layer)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(portrait(G.dog), L.bx, L.by, L.bw, L.bh);
  // blocks: static ones come from a cached layer (redrawn only when the board changes); blocks a runner is
  // on its way to eat are drawn live with a little wobble
  const s = G.s, cs = L.cell;
  ctx.drawImage(boardLayer(), L.bx, L.by, L.bw, L.bh);
  if (G.pending.size) {
    const pxs = Math.round(cs * DPR);
    for (const [i, c] of G.pending) {
      if (s.cells[i]) continue;
      const x = L.bx + (i % s.w) * cs, y = L.by + ((i / s.w) | 0) * cs, k = 1 + Math.sin(t * 40 + i) * 0.08;
      ctx.drawImage(blockImg(c, pxs, false), x + cs * (1 - k) / 2, y + cs * (1 - k) / 2, cs * k, cs * k);
    }
  }
  // idle shimmer: a faint diagonal shine glides over the board every ~7s (one gradient, only while it is visible)
  const sh = (t % 7) / 0.9;
  if (!G.won && sh < 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(L.bx, L.by, L.bw, L.bh); ctx.clip();
    const sx = L.bx - L.bw * 0.6 + sh * L.bw * 2.2, gr = ctx.createLinearGradient(sx, L.by, sx + L.bw * 0.35, L.by + L.bh * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.13)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(L.bx, L.by, L.bw, L.bh); ctx.restore();
  }
  if (G.flash > 0) { ctx.globalAlpha = G.flash * 0.5; ctx.strokeStyle = G.flashCol; ctx.lineWidth = 8; roundRect(ctx, L.bx - 4, L.by - 4, L.bw + 8, L.bh + 8, 10); ctx.stroke(); ctx.globalAlpha = 1; }
  if (G.won) { // shine sweep over the revealed portrait
    ctx.save(); roundRect(ctx, L.bx, L.by, L.bw, L.bh, 4); ctx.clip();
    const sx = L.bx - L.bw + G.revealT * L.bw * 2.4;
    const gr = ctx.createLinearGradient(sx, L.by, sx + L.bw * 0.4, L.by + L.bh);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(L.bx, L.by, L.bw, L.bh); ctx.restore();
  }
  // husky sleds
  for (const sl of G.sleds) {
    const x0 = L.bx + (sl.cells[0] % s.w) * cs, x1 = L.bx + (sl.cells[sl.cells.length - 1] % s.w + 1) * cs;
    const y = L.by + (sl.row + 1) * cs - 2, x = x0 + (x1 - x0) * Math.max(0, sl.t / 0.6);
    ctx.fillStyle = '#c0392b'; roundRect(ctx, x - cs * 1.2, y - cs * 0.35, cs * 1.1, cs * 0.3, 4); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - cs * 1.3, y - 3, cs * 1.4, 3);
    drawDog(ctx, 'h', sl.c, ((t * 12) | 0) % 2, x + cs * 0.2, y, L.unit, false);
    for (let k = 0; k < 2; k++) G.parts.push({ x: x - cs, y, vx: -60 - Math.random() * 80, vy: -Math.random() * 60, life: 0.4, max: 0.4, col: '#ffffff', size: 3 + Math.random() * 3, g: 100 });
  }
  drawSlots(t);
  drawLanes(t);
  // runners on top
  for (const r of G.runners) {
    let x, y, f = ((t * 12 + r.seed) | 0) % 2, flip;
    if (r.phase === 0) { const k = easeInOut(r.t / r.dur); x = r.sx + (r.tx - r.sx) * k; y = r.sy + (r.ty - r.sy) * k - Math.abs(Math.sin(k * Math.PI * 3)) * 6; flip = r.tx < r.sx; }
    else if (r.phase === 1) { x = r.tx; y = r.ty + Math.sin(r.t * 60) * 1.5; f = 0; flip = r.tx < r.sx; }
    else { const k = easeInOut(Math.min(1, r.t / (r.dur * 0.85))); x = r.tx + (r.sx - r.tx) * k; y = r.ty + (r.sy - r.ty) * k - Math.abs(Math.sin(k * Math.PI * 3)) * 6; flip = r.sx < r.tx; ctx.globalAlpha = 1 - k * 0.5; }
    drawDog(ctx, r.b, r.c, f, x, y, L.unit, flip);
    ctx.globalAlpha = 1;
  }
  drawParts(G.parts); drawTexts(G.texts);
  // tutorial pointer
  if (G.def.id === 1 && G.hintTaps === 0 && !G.won) {
    const hx = laneX(0) + 10, hy = L.lanesY + L.houseH * 0.7 + Math.abs(Math.sin(t * 4)) * -12;
    ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👆', hx, hy + 30);
    ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    roundRect(ctx, laneX(0) - L.houseW / 2 - 6, L.lanesY - 6, L.houseW + 12, L.houseH + 12, 14); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawBanners(G.banners);
  ctx.restore();
}
function boardLayer() {
  const s = G.s, pxs = Math.max(4, Math.round(L.cell * DPR)), key = pxs + 'x' + s.w + 'x' + s.h;
  if (!G.bc || G.bc.key !== key) { const c = document.createElement('canvas'); c.width = pxs * s.w; c.height = pxs * s.h; G.bc = { cv: c, ctx: c.getContext('2d'), key }; G.bdirty = true; }
  if (G.bdirty) {
    const b = G.bc.ctx, D = s.D; b.clearRect(0, 0, G.bc.cv.width, G.bc.cv.height);
    for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i]; if (c) b.drawImage(blockImg(c, pxs, D[i] > 1), (i % s.w) * pxs, ((i / s.w) | 0) * pxs); }
    G.bdirty = false; G.layerDraws = (G.layerDraws || 0) + 1;
  }
  return G.bc.cv;
}
const easeInOut = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const easeOutBack = k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

/* Backdrop: the warm sky gradient, soft bokeh, the glossy board frame and the grass are baked into one offscreen
   canvas per layout (one drawImage per frame); only a few twinkles are drawn live. */
let BG = null;
function backdropLayer() {
  const key = [W, H, DPR, L.bx, L.by, L.bw, L.bh, L.slotY].join(',');
  if (BG && BG.key === key) return BG.cv;
  const P = 20, D = DPR, cv = document.createElement('canvas'); cv.width = Math.round((W + P * 2) * D); cv.height = Math.round((H + P * 2) * D);
  const c = cv.getContext('2d'); c.setTransform(D, 0, 0, D, Math.round(P * D), Math.round(P * D));
  const gy = L.slotY - 4, sky = c.createLinearGradient(0, -P, 0, gy);
  sky.addColorStop(0, '#3a2690'); sky.addColorStop(0.35, '#6a43c4'); sky.addColorStop(0.72, '#b55fc0'); sky.addColorStop(1, '#ffa77a');
  c.fillStyle = sky; c.fillRect(-P, -P, W + P * 2, H + P * 2);
  const glow = c.createRadialGradient(W / 2, L.by + L.bh * 0.45, 10, W / 2, L.by + L.bh * 0.45, Math.max(W, L.bh) * 0.8);
  glow.addColorStop(0, 'rgba(255,214,150,.30)'); glow.addColorStop(1, 'rgba(255,214,150,0)');
  c.fillStyle = glow; c.fillRect(-P, -P, W + P * 2, H + P * 2);
  for (let i = 0; i < 9; i++) {   // soft bokeh dots
    const x = (i * 131 + 40) % W, y = (i * 89 + 20) % Math.max(60, gy - 20), r = 14 + (i % 3) * 10, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,240,255,.16)'); g.addColorStop(1, 'rgba(255,240,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // grass hill with a glossy lip
  c.beginPath(); c.moveTo(-P, gy); for (let x = -P; x <= W + P; x += 10) c.lineTo(x, gy + Math.sin(x * 0.05) * 4); c.lineTo(W + P, H + P); c.lineTo(-P, H + P); c.closePath();
  const gg = c.createLinearGradient(0, gy - 4, 0, H); gg.addColorStop(0, '#6fd47a'); gg.addColorStop(0.12, '#4fb867'); gg.addColorStop(1, '#2f8a4e');
  c.fillStyle = gg; c.fill();
  c.beginPath(); for (let x = -P; x <= W + P; x += 10) c.lineTo(x, gy + 2 + Math.sin(x * 0.05) * 4); c.strokeStyle = 'rgba(220,255,200,.55)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = 'rgba(30,110,60,.55)'; for (let x = 6; x < W; x += 23) c.fillRect(x, L.slotY + 6 + ((x * 7) % 30), 3, 6);
  // glossy board frame with a soft drop shadow
  const bp = 6, fx = L.bx - bp, fy = L.by - bp, fw = L.bw + bp * 2, fh = L.bh + bp * 2;
  c.save(); c.shadowColor = 'rgba(20,8,45,.55)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
  roundRect(c, fx, fy, fw, fh, 13); c.fillStyle = '#2a1f3d'; c.fill(); c.restore();
  const fr = c.createLinearGradient(0, fy, 0, fy + fh); fr.addColorStop(0, '#8a78e6'); fr.addColorStop(0.5, '#5546a8'); fr.addColorStop(1, '#3b2f80');
  roundRect(c, fx + 3, fy + 3, fw - 6, fh - 6, 11); c.fillStyle = fr; c.fill();
  roundRect(c, fx + 4, fy + 4, fw - 8, fh - 8, 10); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#2a1f3d'; c.fillRect(L.bx - 1, L.by - 1, L.bw + 2, L.bh + 2);   // crisp dark well under the picture
  BG = { key, cv };
  return cv;
}
function drawBackdrop(t) {
  // baked at the exact device-pixel ratio and blitted 1:1 in device pixels (no resampling; the sky ignores screen shake)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(backdropLayer(), -Math.round(20 * DPR), -Math.round(20 * DPR)); ctx.restore();
  // twinkles (cheap: two thin rects each)
  const gy = L.slotY ? L.slotY - 30 : H * 0.6;
  for (let i = 0; i < 12; i++) {
    const a = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7); if (a < 0.35) continue;
    const x = (i * 97 + t * 6) % (W + 20) - 10, y = (i * 61 + 14) % Math.max(40, gy), r = 1.5 + a * 2.5;
    ctx.fillStyle = `rgba(255,248,220,${(a * 0.55).toFixed(2)})`; ctx.fillRect(x - r, y - 0.75, r * 2, 1.5); ctx.fillRect(x - 0.75, y - r, 1.5, r * 2);
  }
}
function drawSlots(t) {
  const full = G.s.slots.filter(Boolean).length;
  for (let k = 0; k < 5; k++) {
    const p = slotPos(k), w = L.slotW - 8, h = L.slotH - 6;
    const danger = full >= 4 && !G.won;
    if (!L.slotGrad || L.slotGrad.y !== p.y) { const g = ctx.createLinearGradient(0, p.y - h / 2, 0, p.y + h / 2); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(0.5, 'rgba(40,24,80,.22)'); g.addColorStop(1, 'rgba(20,12,50,.38)'); g.y = p.y; L.slotGrad = g; }
    roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 14);
    ctx.fillStyle = danger ? `rgba(255,77,94,${0.18 + 0.12 * Math.sin(t * 8)})` : L.slotGrad; ctx.fill();
    ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = danger ? '#ff8a96' : 'rgba(255,255,255,.45)'; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; roundRect(ctx, p.x - w / 2 + 6, p.y - h / 2 + 4, w - 12, 5, 3); ctx.fill();   // inner top highlight
    // leash post
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(p.x - 3, p.y + h / 2 - 20, 6, 14); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(p.x, p.y + h / 2 - 22, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(p.x - 1.6, p.y + h / 2 - 23.6, 1.6, 0, 7); ctx.fill();   // glint on the post knob
  }
  if (G.denyT > 0) { ctx.save(); ctx.globalAlpha = G.denyT * 2; ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 4; roundRect(ctx, L.pad, L.slotY, W - L.pad * 2, L.slotH, 14); ctx.stroke(); ctx.restore(); }
  for (const pv of G.packs) {
    const p = slotPos(pv.slot); let x = p.x, y = p.y, sc = 1, a = 1;
    const hw = Math.min(L.slotW - 14, L.slotH * 0.95), hh = hw * 0.84;
    if (pv.fly) { const k = easeInOut(pv.fly.t); x = pv.fly.x0 + (p.x - pv.fly.x0) * k; y = pv.fly.y0 + (p.y - pv.fly.y0) * k - Math.sin(k * Math.PI) * 50; sc = (L.houseW / hw) * (1 - k) + k; }
    if (pv.leaving) { const k = pv.leaving; y -= Math.sin(k * Math.PI) * 30; sc = 1 - k * 0.6; a = 1 - k; }
    const bob = pv.wait ? Math.sin(t * 3 + pv.seed) * 2 : (pv.out > 0 ? Math.abs(Math.sin(t * 14 + pv.seed)) * -3 : 0);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y + bob); ctx.scale(sc, sc);
    drawHouse(ctx, -hw / 2, -hh / 2 - 4, hw, hh, pv.c, pv.shown, pv.b, { time: t, seed: pv.seed, empty: pv.out > 0 });
    ctx.restore();
    if (!pv.fly && !pv.leaving && pv.wait && pv.out <= 0) {
      const bx = x + hw * 0.36, by = y - hh * 0.62 + Math.sin(t * 4 + pv.seed) * 3;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 11, 0, 7); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = OUTLINE; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(((t + pv.seed) % 2 < 1) ? '?' : 'z', bx, by + 1);
    }
  }
}
function drawLanes(t) {
  const nl = G.p.lanes.length;
  for (let i = 0; i < nl; i++) {
    const lane = G.p.lanes[i], pos = G.s.pos[i], x = laneX(i);
    const shift = G.laneAnim[i];
    // lane tray
    if (!L.laneGrad || L.laneGrad.y !== L.lanesY) { const g = ctx.createLinearGradient(0, L.lanesY - 6, 0, H); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(0.08, 'rgba(20,12,40,.16)'); g.addColorStop(1, 'rgba(20,12,40,.30)'); g.y = L.lanesY; L.laneGrad = g; }
    roundRect(ctx, x - L.laneW / 2 + 4, L.lanesY - 6, L.laneW - 8, H - L.lanesY - 2, 16); ctx.fillStyle = L.laneGrad; ctx.fill();
    if (pos >= lane.length) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Tómt', x, L.lanesY + L.houseH * 0.5); continue; }
    const scales = [1, 0.74, 0.6], gaps = [0, L.houseH * 0.98, L.houseH * 1.66];
    for (let k = Math.min(2, lane.length - pos - 1); k >= 0; k--) {
      const d = lane[pos + k];
      const kk = Math.max(0, k - 0) + shift; // slide up animation
      const sc = k === 0 ? 1 - shift * 0.26 : scales[k] + (scales[k - 1] - scales[k]) * shift;
      const yy = L.lanesY + (k === 0 ? gaps[0] + shift * (gaps[1] - gaps[0]) : gaps[k] + (gaps[k - 1] - gaps[k]) * shift);
      const w = L.houseW * sc, h = L.houseH * sc;
      const pulse = k === 0 ? 1 + Math.sin(t * 3 + i) * 0.015 : 1;
      ctx.save(); ctx.translate(x, yy + h / 2); ctx.scale(pulse, pulse);
      drawHouse(ctx, -w / 2, -h / 2, w, h, d.c, d.n, d.b, { time: t, seed: i * 1.7 + k, alpha: k === 0 ? 1 : 0.9 - k * 0.15, big: k === 0 });
      ctx.restore();
      void kk;
    }
    const more = lane.length - pos - 3;
    if (more > 0) {
      const mx = x + L.houseW * 0.36, my = L.lanesY + L.houseH * 1.78;
      ctx.beginPath(); ctx.arc(mx, my, 14, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.fillStyle = OUTLINE; ctx.font = '900 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+' + more, mx, my + 1);
    }
  }
}
function drawParts(arr) {
  for (const p of arr) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
    ctx.fillStyle = p.col;
    if (p.spark) {
      const k = p.life / p.max, sz = p.size * (0.4 + 0.6 * Math.sin(Math.min(1, k) * Math.PI));
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(sparkleImg(p.col), -sz / 2, -sz / 2, sz, sz); ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.ring) {
      const k = 1 - p.life / p.max; ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1.5, p.size * 0.18 * (1 - k));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.35 + k * 0.9), 0, 7); ctx.stroke();
    } else if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
    else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawTexts(arr) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of arr) {
    const k = 1 - t.life / t.max, sc = k < 0.15 ? easeOutBack(k / 0.15) : 1;
    ctx.globalAlpha = Math.min(1, t.life * 3);
    ctx.font = `900 ${Math.round(t.size * sc)}px system-ui, Roboto, sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE; ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
function drawBanners(arr) {
  arr.forEach((b, i) => {
    const k = b.t, sc = k < 0.35 ? easeOutBack(k / 0.35) : 1, a = Math.min(1, (b.life - k) * 3);
    const y = (G ? L.by + L.bh * 0.42 : H * 0.3) + i * 70;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y); ctx.scale(sc, sc); ctx.rotate(Math.sin(k * 3) * 0.02);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = b.a.length > 14 ? 24 : 40;
    ctx.font = `900 ${big}px system-ui, Roboto, sans-serif`;
    ctx.lineWidth = 9; ctx.strokeStyle = OUTLINE; ctx.strokeText(b.a, 0, 0); ctx.fillStyle = b.col; ctx.fillText(b.a, 0, 0);
    if (b.b) { ctx.font = '900 19px system-ui, Roboto, sans-serif'; ctx.lineWidth = 6; ctx.strokeText(b.b, 0, big * 0.85); ctx.fillStyle = '#fff'; ctx.fillText(b.b, 0, big * 0.85); }
    ctx.restore();
  });
}
