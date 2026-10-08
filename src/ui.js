/* ===== DOM screens, modals, fullscreen, persistence ===== */
const $ = s => document.querySelector(s);
const VERSION = '1.1';   // Betri Hundar 1.1 (shown on the home screen; bump sw.js CACHE together with this)
const SAVE_KEY = 'packleader.v2';
const save = loadSave();
function loadSave() {
  const d = { coins: 0, stars: {}, album: [], tips: {}, daily: {}, mute: false, speed: 1, v: 2 };
  try {
    const cur = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (cur) return grantLevelDogs(Object.assign(d, cur));
    // v1 -> v2: keep coins, rescued dogs, tips and settings; the 20 new levels start fresh
    const old = JSON.parse(localStorage.getItem('packleader.v1'));
    if (old) for (const k of ['coins', 'album', 'tips', 'mute', 'speed', 'daily']) if (old[k] != null) d[k] = old[k];
  } catch (e) {}
  return d;
}
/* Betri Hundar: the save key stays 'packleader.v2' so nobody loses progress. Levels that were already cleared
   hand over the dog that now lives on them (e.g. Lotta/Roxy/Rökkvi/Myrkvi on levels 1-4), and dogs that were
   rescued earlier stay in the album. */
function grantLevelDogs(d) {
  for (const l of PL.LEVELS) if (d.stars[l.id] && !d.album.includes(l.dog)) d.album.push(l.dog);
  return d;
}
/* album helpers: a dog is rescued on the level that names it, otherwise by winning a daily puzzle */
const levelOfDog = id => PL.LEVELS.find(l => l.dog === id);
function albumDogs() {
  const lv = PL.DOGS.filter(d => levelOfDog(d.id)).sort((a, b) => levelOfDog(a.id).id - levelOfDog(b.id).id);
  return lv.concat(PL.DOGS.filter(d => !levelOfDog(d.id)));
}
/* the dog waiting at the end of a daily puzzle: the first daily-only dog not yet rescued, else a seeded pick */
function dailyDog(def) {
  const wait = PL.DOGS.find(d => !levelOfDog(d.id) && !save.album.includes(d.id));
  return wait || PL.DOGS[def.dog % PL.DOGS.length];
}
/* gender agreement: Lotta & Roxy are 'hún' (Ein af… / Sérstök vinkona), Rökkvi & Myrkvi are 'hann' (Einn af… / Sérstakur vinur) */
function dogNote(d) { const f = d.g === 'f'; return d.family ? (f ? ' · Ein af hundunum okkar ❤️' : ' · Einn af hundunum okkar ❤️') : d.special ? (f ? ' · Sérstök vinkona! 🇮🇸' : ' · Sérstakur vinur! 🇮🇸') : ''; }
function whereRescued(d) { const l = levelOfDog(d.id); return l ? 'Bjargaðu í borði ' + l.id : 'Bjargaðu í daglegri þraut'; }
/* difficulty tiers (sawtooth): only hard / very hard get a visible badge + coin bonus */
const TIERS = {
  t: { name: 'Auðvelt', bonus: 0 }, e: { name: 'Auðvelt', bonus: 0 }, m: { name: 'Miðlungs', bonus: 0 },
  h: { name: 'Erfitt', bonus: 0.25, cls: 'hard' }, x: { name: 'Mjög erfitt', bonus: 0.5, cls: 'vhard' },
};
const ICON_FLAME = '<svg viewBox="0 0 24 24" class="ti"><path d="M12 2c1 3.5 5.5 6 5.5 11.2A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.8c0-2.4 1.3-3.9 2.3-5 .2 1.6.9 2.7 2 3.2C10.6 8.6 11 5 12 2z" fill="#ff9a2e" stroke="#2a1f3d" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 11.5c.6 1.6 2.6 2.4 2.6 4.4a2.6 2.6 0 0 1-5.2 0c0-1.2.7-1.9 1.3-2.4.1.7.4 1.1.9 1.3-.1-1.2.1-2.3.4-3.3z" fill="#ffd23f"/></svg>';
const ICON_SKULLPAW = '<svg viewBox="0 0 24 24" class="ti"><g fill="#f7efdc" stroke="#2a1f3d" stroke-width="1.5"><ellipse cx="4.6" cy="9.6" rx="2.1" ry="2.7" transform="rotate(-25 4.6 9.6)"/><ellipse cx="9" cy="5.2" rx="2" ry="2.6"/><ellipse cx="15" cy="5.2" rx="2" ry="2.6"/><ellipse cx="19.4" cy="9.6" rx="2.1" ry="2.7" transform="rotate(25 19.4 9.6)"/><path d="M12 9.2c3.9 0 6.3 2.4 6.3 5.4 0 1.9-1 3.1-2.2 3.7v2.3H7.9v-2.3c-1.2-.6-2.2-1.8-2.2-3.7 0-3 2.4-5.4 6.3-5.4z"/></g><g fill="#2a1f3d"><ellipse cx="9.6" cy="14.4" rx="1.5" ry="1.7"/><ellipse cx="14.4" cy="14.4" rx="1.5" ry="1.7"/><path d="M12 16.2l-.9 1.6h1.8z"/><rect x="9.6" y="19" width="1" height="1.6"/><rect x="11.5" y="19" width="1" height="1.6"/><rect x="13.4" y="19" width="1" height="1.6"/></g></svg>';
function tierBadge(t, small) {
  const T = TIERS[t]; if (!T || !T.cls) return '';
  return `<span class="tbadge ${T.cls}${small ? ' sm' : ''}">${t === 'x' ? ICON_SKULLPAW : ICON_FLAME}<span>${T.name}</span></span>`;
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

let scr = 'home';
function setScreen(n) {
  scr = n;
  for (const id of ['home', 'levels', 'album', 'bye']) $('#' + id).classList.toggle('on', id === n);
  $('#ctrls').classList.toggle('on', n === 'game');
  if (typeof updateTiltUI === 'function') updateTiltUI();
  $('#bBack').classList.toggle('hide', n === 'home' || n === 'finale');
  $('#bBack').classList.toggle('gone', n === 'bye');
  $('#bHome').classList.toggle('gone', n === 'home');   // the main-menu button is on every screen except the menu itself
  // in a level the title is two lines (number + name) so the extra menu button fits; textContent stays 'Borð 3 · Matarskál'
  const two = (a, b) => `${a}<span class="sep"> · </span><small>${b}</small>`;
  const tl = $('#title');
  tl.innerHTML = n === 'home' ? 'Betri Hundar' : n === 'levels' ? 'Borðaval' : n === 'album' ? 'Hundaalbúm' : n === 'bye' ? 'Takk fyrir!' :
    n === 'finale' ? 'Sæktu!' : (G && G.daily ? two('Dagleg þraut', G.def.pic || '') : G ? two(`Borð ${G.def.id}`, G.def.name) : 'Betri Hundar');
  tl.classList.toggle('two', n === 'game');
  tl.classList.toggle('long', n !== 'game' && tl.textContent.length > 15); tl.classList.toggle('xlong', n !== 'game' && tl.textContent.length > 20);
  if (n === 'levels') renderLevels();
  if (n === 'album') renderAlbum();
  if (n === 'home') renderHome();
  if (n === 'bye') { const fam = PL.DOGS.filter(d => d.family && save.album.includes(d.id)); $('#byeDog').src = portraitURL(fam.length ? fam[(Math.random() * fam.length) | 0] : PL.DOGS[0]); }
  if (n !== 'game') hideHint();
  if (n !== 'finale') F = null;
  closeModal();
  updateCtrls();
}
/* ---- main menu button (every screen) ---- */
// would leaving now lose anything? (a level in progress; a won level / finale is banked instead, see bankLevel)
const midLevel = () => scr === 'game' && G && !G.won && !G.over && (G.undo.length > 0 || G.eaten > 0);
function goHome() {
  Snd.tap();
  if (scr === 'home') return;
  if (midLevel()) {
    G.paused = true;
    openModal(`<h2>Fara í aðalvalmynd?</h2><p>Ef þú hættir núna tapast framvindan í þessu borði.</p>
      <div class="row"><button class="btn alt" data-act="home-yes">Já, hætta borðinu</button><button class="btn" data-act="close">Halda áfram</button></div>`,
      () => { if (G) G.paused = false; });
    return;
  }
  if ((scr === 'game' || scr === 'finale') && G && G.won && !G.banked) {   // the dog is already rescued: keep it, skip only the fetch bonus
    openModal(`<h2>Fara í aðalvalmynd?</h2><p>${G.dog.name} er þegar ${G.dog.g === 'f' ? 'komin' : 'kominn'} heim og nammið er vistað – þú missir bara Sæktu-bónusinn.</p>
      <div class="row"><button class="btn alt" data-act="home-bank">Já, í valmynd</button><button class="btn" data-act="close">Halda áfram</button></div>`);
    return;
  }
  G = null; setScreen('home');
}
/* ---- quit: save, try to close, leave fullscreen, then a goodbye screen if the tab is still open ---- */
function askQuit() {
  Snd.tap();
  openModal(`<h2>Hætta leik?</h2><p>Framvindan þín er vistuð. Þú getur haldið áfram næst.</p>
    <div class="row"><button class="btn alt" data-act="quit-yes">Já, hætta</button><button class="btn" data-act="close">Nei, spila áfram</button></div>`);
}
async function quitGame() {
  persist(); G = null; F = null;
  fsWanted = false; autoFsArmed = false;
  try { window.close(); } catch (e) {}                     // works in some installed-PWA / script-opened windows
  try { if (fsEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
  setTimeout(() => { if (!window.closed) setScreen('bye'); }, 250);
}
function goBack() {
  Snd.tap();
  if (scr === 'game') { const d = G && G.daily; G = null; setScreen(d ? 'home' : 'levels'); }
  else if (scr === 'levels' || scr === 'album' || scr === 'bye') setScreen('home');
}
function updateCtrls() {
  if (!G) return;
  $('#bUndo').disabled = !G.undo.length || G.won;
  $('#undoN').textContent = G.undos ? `Afturkalla (${G.undos})` : 'Afturkalla';
  const st = G.undos === 0 ? 3 : G.undos <= 2 ? 2 : 1;
  $('#lvlStars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
  const sp = $('#bSpeed'); sp.textContent = (save.speed || 1) + '×'; sp.classList.toggle('fast', save.speed === 2);
}
let shownCoins = -1;
function updateCoins() {
  const v = save.coins + (G && !G.banked && (scr === 'game' || scr === 'finale') ? G.eaten : 0);
  if (v !== shownCoins) {
    if (shownCoins >= 0 && v > shownCoins) { const c = $('#coins'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    shownCoins = v; $('#coinN').textContent = v;
  }
}

/* ---- modal / toast / hint ---- */
let modalOnClose = null;
function openModal(html, onClose) { $('#modalCard').innerHTML = html; $('#modal').classList.add('on'); modalOnClose = onClose || null; }
function closeModal() { if (!$('#modal').classList.contains('on')) return; $('#modal').classList.remove('on'); const f = modalOnClose; modalOnClose = null; if (f) f(); }
let toastT = 0;
function toast(msg, ms = 3500) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
let hintT = 0;
function showHint(txt) { const h = $('#hint'); if (!txt) { hideHint(); return; } h.textContent = txt; h.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(hideHint, 9000); }
function hideHint() { $('#hint').classList.remove('on'); }

/* ---- breed tips (first time only) ---- */
function maybeBreedTip() {
  if (!G) return;
  const has = b => G.p.lanes.some(l => l.some(d => d.b === b));
  const tips = {
    d: ['Nýr hundur: Pylsuhundur!', 'Hann grefur göng og nær nammi einu lagi innar en hinir hundarnir.'],
    h: ['Nýr hundur: Husky!', 'Um leið og hann fer út þeysist hann á sleða eftir neðstu röð síns litar og étur hana alla í einu.'],
  };
  for (const b of ['d', 'h']) {
    if (has(b) && !save.tips[b]) {
      save.tips[b] = true; persist(); G.paused = true;
      const img = dogSprite(b, b === 'd' ? 'O' : 'C', 0);
      const cv = document.createElement('canvas'); cv.width = img.width * 5; cv.height = img.height * 5;
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(img, 0, 0, cv.width, cv.height);
      openModal(`<img class="tipcv" src="${cv.toDataURL()}" alt=""><h2>${tips[b][0]}</h2><p>${tips[b][1]}</p><div class="row"><button class="btn" data-act="close">Ókei!</button></div>`,
        () => { if (G) { G.paused = false; maybeBreedTip(); } });
      Snd.bark(b === 'd' ? 1.4 : 1.1);
      return;
    }
  }
}

/* ---- portraits as images ---- */
const PURL = {};
function portraitURL(dog, locked) {
  const key = dog.id + (locked ? 'L' : '');
  if (PURL[key]) return PURL[key];
  const src = locked ? silhouette(dog) : portrait(dog), cv = document.createElement('canvas');
  cv.width = cv.height = 128; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, 128, 128);
  if (locked) { c.fillStyle = '#fff'; c.font = '900 56px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 64, 70); }
  return (PURL[key] = cv.toDataURL());
}

/* ---- home / levels / album ---- */
function nextLevelId() { for (const l of PL.LEVELS) if (!save.stars[l.id]) return l.id; return PL.LEVELS[PL.LEVELS.length - 1].id; }
function isUnlocked(id) { return id === 1 || !!save.stars[id - 1]; }
function renderHome() {
  const n = nextLevelId();
  $('#hPlay').textContent = `▶ Spila – Borð ${n}`;
  $('#hVer').textContent = 'v' + VERSION;
  $('#hTip').textContent = (!fsSupported() && !isStandalone() && isIOS()) ? 'Á iPhone: ýttu á Deila og veldu „Bæta við heimaskjá“ til að spila á fullum skjá.' : `${save.album.length} / ${PL.DOGS.length} hundum bjargað`;
}
function todayKey(d = new Date()) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function todaySeed(d = new Date()) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
const MONTHS = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
function isDate(d = new Date()) { return d.getDate() + '. ' + MONTHS[d.getMonth()]; }
/* the daily generator runs a few quick simulations to hit its tier, so it is pre-built in idle time after boot
   and cached per day (memory + localStorage) – tapping "Dagleg þraut" is then instant */
let dailyCache = null;
function getDaily() {
  const seed = todaySeed(), key = 'packleader.daily';   // (storage keys keep the old prefix on purpose)
  if (dailyCache && dailyCache.seed === seed) return dailyCache.def;
  try { const c = JSON.parse(localStorage.getItem(key)); if (c && c.seed === seed && c.v === 3 && c.def && c.def.grid) { dailyCache = c; return c.def; } } catch (e) {}
  dailyCache = { seed, v: 3, def: PL.genDaily(seed) };
  try { localStorage.setItem(key, JSON.stringify(dailyCache)); } catch (e) {}
  return dailyCache.def;
}
function prewarmDaily() { const go = () => { try { getDaily(); } catch (e) {} }; if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500); }
function startDaily() { Snd.tap(); startLevel(getDaily(), { daily: true }); }
function renderLevels() {
  const best = save.daily[todayKey()];
  let h = `<div class="h">Veldu borð</div>
    <button class="daily" data-act="daily"><span class="ico">☀️</span><div><b>Dagleg þraut</b><span>${isDate()} · Besta í dag: ${best || '–'}</span></div></button>
    <div class="legend">${tierBadge('h', true)} og ${tierBadge('x', true)} borð gefa aukanammi!</div><div class="grid">`;
  const nx = nextLevelId();
  for (const l of PL.LEVELS) {
    const st = save.stars[l.id] || 0, un = isUnlocked(l.id), T = TIERS[l.tier] || {};
    const cls = ['tile', !un ? 'locked' : '', un && !st && l.id === nx ? 'next' : '', T.cls || ''].join(' ');
    const badge = tierBadge(l.tier, true);
    if (!un) h += `<button class="${cls}" data-act="locked">${badge}<span class="n">🔒</span><span class="nm">Borð ${l.id}</span></button>`;
    else if (st) h += `<button class="${cls}" data-lvl="${l.id}">${badge}<img src="${portraitURL(dogById(l.dog))}" alt=""><span class="st">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span><span class="nm">${l.id}. ${l.name}</span></button>`;
    else h += `<button class="${cls}" data-lvl="${l.id}">${badge}<span class="n">${l.id}</span><span class="nm">${l.name}</span><span class="st">☆☆☆</span></button>`;
  }
  $('#levelsInner').innerHTML = h + '</div>';
}
function renderAlbum() {
  let h = `<div class="h">Hundaalbúm · ${save.album.length}/${PL.DOGS.length}</div><div class="grid">`;
  albumDogs().forEach(d => {
    const got = save.album.includes(d.id), fam = d.family ? 'family' : d.special ? 'special' : '';
    // family dogs always show their name (even before rescue) so it is clear where they are waiting
    h += `<button class="card ${fam} ${got ? '' : 'lock'}" data-dog="${d.id}">${d.family ? '<i class="heart">❤</i>' : ''}<img src="${portraitURL(d, !got)}" alt=""><b>${got || d.family ? d.name : '???'}</b><small>${got ? d.breed : whereRescued(d)}</small></button>`;
  });
  $('#albumInner').innerHTML = h + '</div>';
}
function showDog(id) {
  const d = dogById(id), got = save.album.includes(id), lvl = levelOfDog(id);
  if (!got) { toast(lvl ? `Bjargaðu ${d.family ? (d.dat || d.name) : 'þessum hundi'} í borði ${lvl.id}!` : 'Vinndu daglega þraut til að bjarga þessum hundi!'); return; }
  Snd.bark(1.2);
  openModal(`<img class="bigport${d.family ? ' family' : ''}" src="${portraitURL(d)}" alt=""><h2>${d.name}</h2><p>${d.breed}${dogNote(d)}${d.line ? `<br><i class="dline">${d.line}</i>` : ''}<br>${lvl ? `Bjargað í borði ${lvl.id}: ${lvl.name}` : 'Bjargað í daglegri þraut'}</p><div class="row"><button class="btn" data-act="close">Loka</button></div>`);
}

/* ---- results ---- */
/* banks a won level (coins, stars, album) exactly once; used by the results screen and by the menu button in the finale */
function bankLevel(fetchBonus) {
  const stars = G.undos === 0 ? 3 : G.undos <= 2 ? 2 : 1;
  const starBonus = [0, 0, 10, 30][stars];
  const T = TIERS[G.def.tier] || {}, tierBonus = Math.round(G.total * (T.bonus || 0));
  const earned = G.total + G.comboBonus + fetchBonus + starBonus + tierBonus;
  save.coins += earned; G.banked = true;
  let newDog = false, best = 0;
  if (G.daily) { const k = todayKey(); best = save.daily[k] = Math.max(save.daily[k] || 0, earned); }
  else save.stars[G.def.id] = Math.max(save.stars[G.def.id] || 0, stars);
  if (!save.album.includes(G.dog.id)) { save.album.push(G.dog.id); newDog = true; }
  persist();
  return { stars, starBonus, T, tierBonus, earned, newDog, best };
}
function finishLevel(fetchBonus) {
  const { stars, starBonus, T, tierBonus, earned, newDog, best } = bankLevel(fetchBonus);
  const d = G.dog, wl = d.g === 'f' ? 'Velkomin' : 'Velkominn';
  const nextDef = !G.daily && PL.LEVELS.find(l => l.id === G.def.id + 1);
  openModal(`<h2>${wl} heim, ${d.name}!</h2>
    <img class="bigport${d.family ? ' family' : ''}" src="${portraitURL(d)}" alt="">
    <div style="font-weight:800;margin-top:6px">${d.breed}${dogNote(d)}</div>${d.line ? `<div class="dline">${d.line}</div>` : ''}${T.cls ? `<div style="margin-top:6px">${tierBadge(G.def.tier)}</div>` : ''}
    <div class="stars"><span>★</span><span>★</span><span>★</span></div>
    <div class="sum"><div><span>Nammi étið</span><span>+${G.total}</span></div><div><span>Combo-bónus</span><span>+${G.comboBonus}</span></div>
    <div><span>Sækja-bónus</span><span>+${fetchBonus}</span></div><div><span>Stjörnubónus</span><span>+${starBonus}</span></div>
    ${tierBonus ? `<div class="tb"><span>${T.name}-bónus (+${Math.round(T.bonus * 100)}%)</span><span>+${tierBonus}</span></div>` : ''}
    <div class="tot"><span>Samtals</span><span>+${earned} 🦴</span></div></div>
    ${newDog ? '<p>📖 Ný mynd í Hundaalbúminu!</p>' : ''}${G.daily ? `<p>Besta í dag: ${best} stig</p>` : ''}
    ${stars < 3 ? '<p style="font-size:13px;opacity:.75">3 stjörnur = klára án þess að afturkalla.</p>' : ''}
    <div class="row">${nextDef ? '<button class="btn" data-act="next">Áfram ▶</button>' : `<button class="btn" data-act="${G.daily ? 'home' : 'levels'}">Áfram ▶</button>`}
    <button class="btn green small" data-act="album">📖 Albúm</button></div>`);
  const spans = document.querySelectorAll('.stars span');
  for (let i = 0; i < stars; i++) setTimeout(() => { spans[i] && spans[i].classList.add('on'); Snd.star(i); }, 450 + i * 380);
  Snd.coin();
}

/* ---- fullscreen ---- */
const ICON_FS_IN = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_FS_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
const ICON_SND = '<svg viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path fill="none" d="M17 9l5 6M22 9l-5 6"/></svg>';
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsSupported = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const isStandalone = () => (window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function enterFS() {
  const el = document.documentElement;
  let ok = false;
  try { if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI: 'hide' }); ok = true; } else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); ok = true; } }
  catch (e) { try { if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); ok = !!fsEl(); } } catch (e2) {} }
  if (ok || fsEl()) { fsWanted = true; autoFsArmed = false; }
  try { if (window.screen && screen.orientation && screen.orientation.lock) await screen.orientation.lock('portrait'); } catch (e) { /* not allowed on this device – fine */ }
  return ok;
}
async function toggleFS() {
  Snd.tap();
  autoFsArmed = false;                                      // an explicit choice wins over the automatic first-tap fullscreen
  if (fsEl()) { fsWanted = false; try { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} return; }
  if (!fsSupported()) { toast('Á iPhone: ýttu á Deila ⬆︎ og veldu „Bæta við heimaskjá“ – þá opnast leikurinn á fullum skjá.', 6000); return; }
  await enterFS();
}
/* Automatic fullscreen: browsers only allow it inside a user gesture, so the FIRST tap/click anywhere enters it
   (once per session; re-armed when coming back from a background tab with fullscreen lost). Installed PWAs already
   run fullscreen/standalone and are skipped. A failed attempt (e.g. a touch pointerdown, which is not an
   activating gesture on Android) stays armed so the touchend/click of the same tap tries again. */
let autoFsArmed = true, fsWanted = false, fsPending = false;
function autoFS(e) {
  if (!autoFsArmed || fsPending || isStandalone() || fsEl() || !fsSupported()) return;
  if (e && e.target && e.target.closest && e.target.closest('#bFS')) return;   // the toggle button handles itself
  fsPending = true;
  enterFS().finally(() => { fsPending = false; });
}
function onVisible() {
  if (document.visibilityState === 'visible' && fsWanted && !fsEl() && !isStandalone()) autoFsArmed = true;
}
function updateFSIcon() {
  const b = $('#bFS');
  b.innerHTML = fsEl() ? ICON_FS_OUT : ICON_FS_IN;
  b.setAttribute('aria-label', fsEl() ? 'Hætta í fullum skjá' : 'Fullur skjár');
  b.classList.toggle('gone', isStandalone());
  setTimeout(resize, 60);
}
function updateMuteIcon() { $('#bMute').innerHTML = save.mute ? ICON_MUTE : ICON_SND; }

function bindUI() {
  $('#bBack').addEventListener('click', goBack);
  $('#bFS').addEventListener('click', toggleFS);
  document.addEventListener('fullscreenchange', updateFSIcon);
  document.addEventListener('webkitfullscreenchange', updateFSIcon);
  $('#bMute').addEventListener('click', () => { save.mute = !save.mute; persist(); updateMuteIcon(); Snd.tap(); toast(save.mute ? 'Hljóð af' : 'Hljóð á', 1200); });
  $('#bUndo').addEventListener('click', () => { Snd.tap(); doUndo(); });
  $('#bRestart').addEventListener('click', () => { Snd.tap(); restartLevel(); });
  $('#bSpeed').addEventListener('click', () => { save.speed = save.speed === 2 ? 1 : 2; persist(); Snd.tap(); updateCtrls(); });
  $('#hPlay').addEventListener('click', () => { Snd.tap(); if (!isStandalone() && !fsEl() && fsSupported() && !fsPending) enterFS(); startLevel(PL.LEVELS.find(l => l.id === nextLevelId())); });
  $('#bHome').addEventListener('click', goHome);
  $('#bTilt').addEventListener('click', () => { save.tilt = !(save.tilt !== false); persist(); Snd.tap(); updateTiltUI(); toast(save.tilt ? 'Hallastýring á' : 'Hallastýring af', 1200); });
  $('#hQuit').addEventListener('click', askQuit);
  $('#byeAgain').addEventListener('click', () => { Snd.tap(); if (!isStandalone() && !fsEl() && fsSupported()) enterFS(); setScreen('home'); });
  for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, autoFS, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisible);
  $('#hLevels').addEventListener('click', () => { Snd.tap(); setScreen('levels'); });
  $('#hDaily').addEventListener('click', startDaily);
  $('#hAlbum').addEventListener('click', () => { Snd.tap(); setScreen('album'); });
  $('#levelsInner').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lvl) { Snd.tap(); startLevel(PL.LEVELS.find(l => l.id === +b.dataset.lvl)); }
    else if (b.dataset.act === 'daily') startDaily();
    else if (b.dataset.act === 'locked') { Snd.deny(); toast('Kláraðu fyrra borðið fyrst!', 1600); }
  });
  $('#albumInner').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.dog) showDog(b.dataset.dog); });
  $('#modalCard').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.act; Snd.tap();
    if (a === 'close') closeModal();
    else if (a === 'undo') doUndo();
    else if (a === 'restart') { closeModal(); restartLevel(); }
    else if (a === 'next') { const n = PL.LEVELS.find(l => l.id === G.def.id + 1); closeModal(); startLevel(n); }
    else if (a === 'levels') { G = null; setScreen('levels'); }
    else if (a === 'home') { G = null; setScreen('home'); }
    else if (a === 'home-yes') { G = null; setScreen('home'); }
    else if (a === 'home-bank') { if (G && !G.banked) bankLevel(0); G = null; setScreen('home'); }
    else if (a === 'quit-yes') { closeModal(); quitGame(); }
    else if (a === 'album') { G = null; setScreen('album'); }
  });
  updateFSIcon(); updateMuteIcon();
  if (window.matchMedia) matchMedia('(display-mode: fullscreen)').addEventListener?.('change', updateFSIcon);
}
