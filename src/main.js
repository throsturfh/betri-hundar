/* ===== Boot, canvas, input, main loop ===== */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let W = 360, H = 640, DPR = 1, T = 0;
function resize() {
  const st = document.getElementById('stage');
  W = st.clientWidth; H = st.clientHeight; DPR = Math.min(2.5, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  layoutGame();
}
const MENU_DOGS = [];
function renderMenuBg(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4a3c9e'); g.addColorStop(0.7, '#7b62d6'); g.addColorStop(1, '#3d8f5a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 18; i++) drawBone(ctx, (i * 83 + T * 12) % (W + 40) - 20, (i * 137) % H, 16, '#ffffff', i + T * 0.3);
  ctx.globalAlpha = 1;
  const gy = H - 70;
  ctx.fillStyle = '#4fae6a'; ctx.beginPath(); ctx.moveTo(0, gy); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.04 + 1) * 6); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  if (!MENU_DOGS.length) { const cols = ['R', 'Y', 'C', 'K', 'G', 'O', 'P', 'W']; for (let i = 0; i < 8; i++) MENU_DOGS.push({ x: -40 - i * 52, c: cols[i], b: i === 3 ? 'd' : i === 6 ? 'h' : 'l', s: 120 + (i % 3) * 14 }); }
  ctx.imageSmoothingEnabled = false;
  for (const d of MENU_DOGS) {
    d.x += d.s * dt; if (d.x > W + 60) d.x -= W + 480;
    drawDog(ctx, d.b, d.c, ((T * 10 + d.s) | 0) % 2, d.x, gy + 26 - Math.abs(Math.sin(T * 10 + d.s)) * 5, 2, false);
  }
}
function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
cv.addEventListener('pointerdown', e => {
  Snd.unlock(); const p = pt(e);
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  if (scr === 'game') gameTap(p.x, p.y); else if (scr === 'finale') finaleDown(p.x, p.y);
});
cv.addEventListener('pointermove', e => { if (scr === 'finale') { const p = pt(e); finaleMove(p.x, p.y); } });
cv.addEventListener('pointerup', e => { if (scr === 'finale') { const p = pt(e); finaleUp(p.x, p.y); } });
cv.addEventListener('pointercancel', e => { if (scr === 'finale') { const p = pt(e); finaleUp(p.x, p.y); } });
document.addEventListener('pointerdown', () => Snd.unlock(), { once: false, passive: true });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

let last = performance.now();
const FS = { n: 0, work: 0, maxWork: 0, gaps: 0, maxGap: 0, reset() { this.n = this.work = this.maxWork = this.gaps = this.maxGap = 0; } }; // frame-time stats (for tests)
function frame(now) {
  const w0 = performance.now(), gap = now - last;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; T += dt;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  try {
    if (scr === 'game' && G) { updateGame(dt); renderGame(); }
    else if (scr === 'finale' && F) { updateFinale(dt); renderFinale(); }
    else renderMenuBg(dt);
  } catch (err) { console.error(err); }
  updateCoins();
  const wk = performance.now() - w0; FS.n++; FS.work += wk; FS.maxWork = Math.max(FS.maxWork, wk); FS.gaps += gap; FS.maxGap = Math.max(FS.maxGap, gap);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
bindUI(); resize(); setScreen('home'); setTimeout(prewarmDaily, 1200);
requestAnimationFrame(frame);
// Android back button -> in-game back
try { history.replaceState({ pl: 0 }, ''); history.pushState({ pl: 1 }, ''); } catch (e) {}
window.addEventListener('popstate', () => { if (scr !== 'home') { goBack(); try { history.pushState({ pl: 1 }, ''); } catch (e) {} } });
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
// test/debug hook (read-only helpers)
window.__pl = { screen: () => scr, game: () => G, finale: () => F, layout: () => L, laneX, slotPos, fview: () => fView(), launch: () => LAUNCH, save: () => save,
  frames: () => ({ n: FS.n, avgWorkMs: FS.work / Math.max(1, FS.n), maxWorkMs: FS.maxWork, avgFrameMs: FS.gaps / Math.max(1, FS.n), maxFrameMs: FS.maxGap }), resetFrames: () => FS.reset(),
  // album portrait (or locked silhouette) of a dog as a data URL, for previews / tests
  portrait: (id, locked) => { const d = PL.DOGS.find(x => x.id === id); return d ? (locked ? silhouette(d) : portrait(d)).toDataURL() : null; },
  // renders a level's (or a daily seed's) full picture with the in-game block art, for previews / contact sheets
  renderBoard: (id, cs = 16) => {
    const def = PL.LEVELS.find(l => l.id === id) || PL.genDaily(id), p = PL.parseLevel(def), c = document.createElement('canvas');
    c.width = p.w * cs; c.height = p.h * cs; const x = c.getContext('2d'); x.fillStyle = '#2a1f3d'; x.fillRect(0, 0, c.width, c.height);
    p.cells.forEach((col, i) => { if (col) x.drawImage(blockImg(col, cs, false), (i % p.w) * cs, ((i / p.w) | 0) * cs); });
    return { url: c.toDataURL(), name: def.pic || def.name, tier: def.tier };
  } };
