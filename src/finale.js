/* ===== Fetch Finale: one Peggle-style bonus shot ===== */
let F = null;
const FW = 360, FH = 620, BALL_R = 11, GRAV = 760, SHOT = 600;
const MULTS = [1, 2, 5, 2, 1];
function startFinale() {
  const r = PL.rng((G.daily ? 99 : G.def.id) * 7919 + 13);
  const pegs = [];
  for (let row = 0; row < 7; row++) {
    const n = row % 2 ? 6 : 7, y = 165 + row * 52;
    for (let i = 0; i < n; i++) {
      if (r() < 0.12) continue;
      const x = FW / (n + 1) * (i + 1) + (r() - 0.5) * 14;
      pegs.push({ x, y: y + (r() - 0.5) * 10, r: 7, lit: false, bone: false, pop: 0, hitT: 0 });
    }
  }
  const cand = pegs.filter(p => p.y > 200); const bones = [];
  while (bones.length < 4 && cand.length) { const k = (r() * cand.length) | 0; const p = cand.splice(k, 1)[0]; if (bones.every(b => Math.hypot(b.x - p.x, b.y - p.y) > 70)) { p.bone = true; p.r = 10; bones.push(p); } }
  // one purple "×2" peg doubles the whole finale score when hit (juice, never a penalty)
  const dc = pegs.filter(p => !p.bone && p.y > 220 && p.y < 480);
  if (dc.length) { const d = dc[(r() * dc.length) | 0]; d.dbl = true; d.r = 9; }
  F = {
    rings: [], dbl: false, fever: false,
    t: 0, state: 'intro', pegs, aim: Math.PI / 2, aiming: false, ball: null, pts: 0, hits: 0, bones: 0, slow: 1, zoom: 1, camX: FW / 2, camY: FH / 2,
    parts: [], texts: [], shake: 0, bowl: -1, endT: 0, stuckT: 0, trail: [], popI: 0, popT: 0, total: 0, slowT: 0, introT: 0,
    pupCol: G.dog.fur, rot: 0,
  };
  setScreen('finale');
  Snd.whoosh();
}
function fView() { const k = Math.min(W / FW, (H - 6) / FH); return { k, ox: (W - FW * k) / 2, oy: Math.max(0, (H - FH * k) / 2) }; }
function toWorld(x, y) { const v = fView(); return { x: (x - v.ox) / v.k, y: (y - v.oy) / v.k }; }
const LAUNCH = { x: FW / 2, y: 92 };
function aimFrom(px, py) {
  const w = toWorld(px, py);
  let a = Math.atan2(w.y - LAUNCH.y, w.x - LAUNCH.x);
  if (a < 0) a = w.x < LAUNCH.x ? Math.PI - 0.12 : 0.12;
  F.aim = Math.max(0.12, Math.min(Math.PI - 0.12, a));
}
function finaleDown(x, y) { if (!F) return; if (F.state === 'intro') F.state = 'aim'; if (F.state !== 'aim') return; F.aiming = true; aimFrom(x, y); }
function finaleMove(x, y) { if (F && F.aiming && F.state === 'aim') aimFrom(x, y); }
function finaleUp(x, y) {
  if (!F || !F.aiming || F.state !== 'aim') return;
  F.aiming = false; aimFrom(x, y);
  F.ball = { x: LAUNCH.x + Math.cos(F.aim) * 26, y: LAUNCH.y + Math.sin(F.aim) * 26, vx: Math.cos(F.aim) * SHOT, vy: Math.sin(F.aim) * SHOT };
  F.state = 'fly'; F.flyT = 0; Snd.launch(); Snd.bark(1.4, 0.05, 0.35); vibrate(15);
}
function physStep(b, h) {
  b.vy += GRAV * h; b.x += b.vx * h; b.y += b.vy * h;
  if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.8; }
  if (b.x > FW - BALL_R) { b.x = FW - BALL_R; b.vx = -Math.abs(b.vx) * 0.8; }
  if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.8; }
}
function collidePeg(b, p) {
  const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), m = BALL_R + p.r;
  if (d >= m || d === 0) return false;
  const nx = dx / d, ny = dy / d; b.x = p.x + nx * m; b.y = p.y + ny * m;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.78 * vn * nx; b.vy -= 1.78 * vn * ny; b.vx += (Math.random() - 0.5) * 18; }
  return true;
}
function updateFinale(rdt) {
  if (!F) return;
  F.t += rdt; F.introT += rdt;
  const target = F.slowT > 0 ? 0.3 : (F.state === 'fly' && F.ball && F.ball.y > 460 && F.ball.vy > 0 ? 0.32 : 1);
  F.slow += (target - F.slow) * Math.min(1, rdt * 10);
  F.slowT = Math.max(0, F.slowT - rdt);
  const zTarget = F.slow < 0.6 && F.ball ? 1.35 : 1;
  F.zoom += (zTarget - F.zoom) * Math.min(1, rdt * 6);
  if (F.ball) { F.camX += (F.ball.x - F.camX) * Math.min(1, rdt * 8); F.camY += (F.ball.y - F.camY) * Math.min(1, rdt * 8); }
  const dt = rdt * F.slow;
  if (F.state === 'fly') {
    const b = F.ball; F.flyT += dt;
    const sub = 6, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      physStep(b, h);
      for (const p of F.pegs) {
        if (p.pop) continue;
        if (collidePeg(b, p)) {
          if (!p.lit) {
            p.lit = true; p.hitT = 0.25; F.hits++;
            F.rings.push({ x: p.x, y: p.y, t: 0, col: p.bone ? '#ffd23f' : p.dbl ? '#d9a6ff' : '#9fe8ff' });
            if (F.hits % 5 === 0) { fText(p.x, p.y - 34, 'Keðja ×' + F.hits + '!', '#ff7eb9', 20); F.shake = Math.max(F.shake, 4); }
            if (p.dbl) { F.dbl = true; fText(p.x, p.y - 20, 'TVÖFALT!', '#d9a6ff', 26, 1.6); fBurst(p.x, p.y, 26, ['#9b5de5', '#d9a6ff', '#fff']); Snd.combo(3); F.slowT = Math.max(F.slowT, 0.3); }
            if (p.bone) { F.bones++; F.pts += 15; Snd.bone(); fText(p.x, p.y - 16, '+15', '#ffd23f', 24); fBurst(p.x, p.y, 22, ['#ffd23f', '#fff6b0', '#fff']); F.shake = 6; if (F.bones === F.pegs.filter(q => q.bone).length) { F.slowT = 0.7; F.fever = true; fText(FW / 2, 120, 'ÖLL GULLBEININ!', '#ffd23f', 26); } else F.slowT = 0.25; }
            else { F.pts += 2; Snd.peg(F.hits); fText(p.x, p.y - 12, '+2', '#fff', 15); fBurst(p.x, p.y, 6, ['#9fe8ff', '#fff']); }
          } else { p.hitT = 0.15; Snd.bounce(); }
        }
      }
      for (let k = 1; k < 5; k++) { // bowl dividers
        const x = k * 72;
        if (b.y > 548 && Math.abs(b.x - x) < BALL_R + 3) { b.x = x + Math.sign(b.x - x || 1) * (BALL_R + 3); b.vx = -b.vx * 0.5; }
        collidePeg(b, { x, y: 548, r: 4 });
      }
      if (b.y > FH - 30) { landBall(); break; }
    }
    F.rot += b.vx * dt * 0.03;
    F.trail.push({ x: b.x, y: b.y, life: 0.35 }); 
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < 40 && b.y < 540) { F.stuckT += dt; if (F.stuckT > 1.0) { b.vy = -180; b.vx = (Math.random() - 0.5) * 200; F.stuckT = 0; const lit = F.pegs.filter(p => p.lit && !p.pop).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0]; if (lit) lit.pop = 1; } } else F.stuckT = 0;
    if (F.flyT > 14) landBall();
  } else if (F.state === 'land') {
    F.endT += rdt;
    F.popT -= rdt;
    const lit = F.pegs.filter(p => p.lit && !p.pop);
    if (F.popT <= 0 && lit.length) { const p = lit[0]; p.pop = 1; F.popT = 0.07; Snd.pop(F.popI++); fBurst(p.x, p.y, 8, p.bone ? ['#ffd23f', '#fff'] : ['#9fe8ff', '#fff']); }
    if (!lit.length && F.endT > 2.4 && !F.done) { F.done = true; finishLevel(F.total); }
  }
  for (const tr of F.trail) tr.life -= rdt; F.trail = F.trail.filter(t => t.life > 0);
  for (const rg of F.rings) rg.t += rdt; F.rings = F.rings.filter(rg => rg.t < 0.5);
  for (const p of F.pegs) p.hitT = Math.max(0, p.hitT - rdt);
  stepParts(F.parts, rdt); stepTexts(F.texts, rdt);
  F.shake = Math.max(0, F.shake - rdt * 25);
}
function landBall() {
  const b = F.ball; F.state = 'land'; F.endT = 0; F.slow = 1;
  F.bowl = Math.max(0, Math.min(4, Math.floor(b.x / 72)));
  const mult = MULTS[F.bowl];
  F.total = Math.max(5, F.pts) * mult * (F.dbl ? 2 : 1);
  b.y = FH - 30; b.vx = 0; b.vy = 0;
  Snd.happyBark(); Snd.clear(); vibrate([40, 50, 40]);
  F.shake = mult >= 5 ? 18 : 10;
  fBurst(b.x, b.y - 10, mult >= 5 ? 160 : 80, ['#ff4d5e', '#ffd23f', '#3ddc84', '#3cc8f4', '#ff7eb9', '#9b5de5'], true);
  fText(FW / 2, 250, mult >= 5 ? 'FRÁBÆRT! ×5' : mult >= 2 ? 'Vel gert! ×' + mult : 'Gott skot!', '#ffd23f', 34, 2.6);
  fText(FW / 2, 300, '+' + F.total + ' nammi' + (F.dbl ? ' (×2!)' : ''), '#fff', 26, 2.6);
}
function fText(x, y, txt, col, size, life = 1.2) { F.texts.push({ x, y, txt, col, size, life, max: life }); }
function fBurst(x, y, n, cols, conf) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (conf ? 200 : 60) + Math.random() * (conf ? 420 : 160);
    F.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (conf ? 300 : 40), life: conf ? 1.4 + Math.random() : 0.4 + Math.random() * 0.3, max: conf ? 2.4 : 0.7, col: cols[i % cols.length], size: conf ? 5 + Math.random() * 4 : 3 + Math.random() * 3, g: conf ? 500 : 200, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, conf: !!conf });
  }
}
function renderFinale() {
  if (!F) return;
  const v = fView(), t = F.t;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2d2360'); g.addColorStop(1, '#5b3d8f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (F.shake) ctx.translate((Math.random() - 0.5) * F.shake, (Math.random() - 0.5) * F.shake);
  ctx.translate(v.ox, v.oy); ctx.scale(v.k, v.k);
  if (F.zoom > 1.01) { ctx.translate(F.camX, F.camY); ctx.scale(F.zoom, F.zoom); ctx.translate(-F.camX, -F.camY); }
  // field
  roundRect(ctx, 0, 0, FW, FH, 18); ctx.fillStyle = '#3b2f7a'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 53) % FW, (i * 97) % FH, 3, 3);
  // bowls
  for (let i = 0; i < 5; i++) {
    const x = i * 72, m = MULTS[i], hl = F.bowl === i;
    ctx.fillStyle = m >= 5 ? '#ffd23f' : m >= 2 ? '#ff7eb9' : '#3cc8f4';
    if (hl) ctx.fillStyle = '#ffffff';
    roundRect(ctx, x + 6, FH - 46, 60, 40, 10); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×' + m, x + 36, FH - 24);
  }
  for (let k = 1; k < 5; k++) { ctx.fillStyle = '#d9d2ff'; ctx.fillRect(k * 72 - 2, 548, 4, FH - 548); ctx.beginPath(); ctx.arc(k * 72, 548, 4, 0, 7); ctx.fill(); }
  // pegs & golden bones
  for (const p of F.pegs) {
    if (p.pop) continue;
    const s = 1 + p.hitT * 1.6;
    if (p.bone) { if (p.lit) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; } drawBone(ctx, p.x, p.y, 20 * s, p.lit ? '#fff3a0' : '#ffc21a', Math.sin(t * 2 + p.x) * 0.2); ctx.shadowBlur = 0; }
    else if (p.dbl) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * s * (1 + Math.sin(t * 6) * 0.08), 0, 7); ctx.fillStyle = p.lit ? '#e9d2ff' : '#9b5de5';
      ctx.shadowColor = '#d9a6ff'; ctx.shadowBlur = p.lit ? 18 : 8; ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×2', p.x, p.y + 0.5);
    }
    else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * s, 0, 7); ctx.fillStyle = p.lit ? '#bff3ff' : '#3cc8f4';
      if (p.lit) { ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = 14; }
      ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = OUTLINE; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(p.x - 3, p.y - 4, 2, 2);
    }
  }
  // launcher
  drawHouse(ctx, LAUNCH.x - 42, 14, 84, 70, 'O', null, 'l', { time: t, empty: F.state !== 'aim' && F.state !== 'intro' });
  // aim preview
  if (F.state === 'aim' || F.state === 'intro') {
    const b = { x: LAUNCH.x + Math.cos(F.aim) * 26, y: LAUNCH.y + Math.sin(F.aim) * 26, vx: Math.cos(F.aim) * SHOT, vy: Math.sin(F.aim) * SHOT };
    for (let i = 0; i < 48; i++) {
      for (let s = 0; s < 4; s++) physStep(b, 1 / 240);
      if (F.pegs.some(p => !p.pop && Math.hypot(b.x - p.x, b.y - p.y) < BALL_R + p.r)) break;
      if (i % 2 === 0) { ctx.globalAlpha = 1 - i / 48; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.2, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    drawDog(ctx, 'l', F.pupCol, ((t * 6) | 0) % 2, LAUNCH.x + Math.cos(F.aim) * 8, LAUNCH.y + 12 + Math.sin(t * 8) * 2, 2.1, Math.cos(F.aim) < 0);
  }
  for (const rg of F.rings) { ctx.globalAlpha = 1 - rg.t / 0.5; ctx.strokeStyle = rg.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rg.x, rg.y, 8 + rg.t * 70, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  const RB = ['#ff4d5e', '#ff9a2e', '#ffd23f', '#3ddc84', '#3cc8f4', '#9b5de5'];
  for (const [ti, tr] of F.trail.entries()) { ctx.globalAlpha = tr.life * 1.5; ctx.fillStyle = F.fever ? RB[ti % RB.length] : '#ffd23f'; ctx.beginPath(); ctx.arc(tr.x, tr.y, BALL_R * tr.life * 2, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (F.ball) {
    const b = F.ball;
    if (F.state === 'land') drawDog(ctx, 'l', F.pupCol, ((t * 10) | 0) % 2, b.x, b.y + 4 - Math.abs(Math.sin(t * 9)) * 14, 2.1, false);
    else { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(F.rot); drawDog(ctx, 'l', F.pupCol, ((t * 14) | 0) % 2, 0, 12, 1.8, false); ctx.restore(); }
  }
  const sv = ctx; void sv;
  drawPartsF(F.parts); drawTextsW(F.texts);
  ctx.restore();
  // HUD
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '900 30px system-ui, Roboto, sans-serif'; ctx.lineWidth = 7; ctx.strokeStyle = OUTLINE;
  const title = 'Sæktu!';
  const ty = v.oy > 70 ? v.oy / 2 - 10 : v.oy + 128 * v.k;
  if (F.state === 'intro' || F.state === 'aim') {
    const sc = 1 + Math.sin(t * 5) * 0.04;
    ctx.save(); ctx.translate(W / 2, ty); ctx.scale(sc, sc); ctx.strokeText(title, 0, 0); ctx.fillStyle = '#ffd23f'; ctx.fillText(title, 0, 0); ctx.restore();
    ctx.font = '800 15px system-ui, Roboto, sans-serif'; ctx.lineWidth = 5;
    const tip = 'Dragðu til að miða – slepptu til að kasta!';
    ctx.strokeText(tip, W / 2, ty + 30); ctx.fillStyle = '#fff'; ctx.fillText(tip, W / 2, ty + 30);
  }
  ctx.font = '900 17px system-ui'; ctx.lineWidth = 5;
  ctx.textAlign = 'left'; ctx.strokeText(`🦴 ${F.bones}/4`, v.ox + 12, v.oy + 22); ctx.fillStyle = '#ffd23f'; ctx.fillText(`🦴 ${F.bones}/4`, v.ox + 12, v.oy + 22);
  if (F.dbl) { ctx.textAlign = 'center'; ctx.strokeText('×2', W / 2, v.oy + 22); ctx.fillStyle = '#d9a6ff'; ctx.fillText('×2', W / 2, v.oy + 22); }
  ctx.textAlign = 'right'; ctx.strokeText(`✨ ${F.pts}`, v.ox + FW * v.k - 12, v.oy + 22); ctx.fillStyle = '#fff'; ctx.fillText(`✨ ${F.pts}`, v.ox + FW * v.k - 12, v.oy + 22);
  ctx.textAlign = 'center';
  if (F.slow < 0.6) { ctx.fillStyle = `rgba(255,255,255,${0.08})`; ctx.fillRect(0, 0, W, H); }
}
function drawPartsF(arr) { drawParts(arr); }
function drawTextsW(arr) { drawTexts(arr); }
