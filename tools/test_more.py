"""v2 extra checks: level select with progress + tier badges, very-hard level start (tier intro), a hard level
played partially (frame time with many packs), forced loss + undo on a very hard level, per-board preview PNGs
(in-game block art) and a contact sheet of all 20 pictures.  Usage: python test_more.py http://127.0.0.1:PORT/index.html"""
import base64, json, random, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
OUT = "/workspace/pack-leader/screenshots/v2/"
BOARDS = "/workspace/pack-leader/screenshots/v2_boards/"
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
errors, fails = [], []
def ok(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=UA)
    pg = ctx.new_page()
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(URL)
    pg.evaluate("""localStorage.setItem('packleader.v2', JSON.stringify({coins: 1200, stars: Object.fromEntries([...Array(9)].map((_, i) => [i + 1, 3 - (i % 3 === 2 ? 1 : 0)])),
        album: ['snati','bangsi','lubbi','skotta','tinna','pila','tryggur','bosi','sami'], tips: {d: true, h: true}, daily: {}, mute: true, speed: 1, v: 2}))""")
    pg.reload(); pg.wait_for_timeout(600)
    alb = pg.evaluate("__pl.save().album")
    ok(all(d in alb for d in ["lotta", "roxy", "rokkvi", "myrkvi", "snati", "bangsi", "lubbi", "skotta"]), f"old save migrated: cleared levels 1-4 hand over Lotta/Roxy/Rökkvi/Myrkvi, earlier dogs kept ({len(alb)} in album)")
    # ---- board previews + contact sheet (rendered with the game's own block sprites) ----
    names = []
    for i in range(1, 21):
        r = pg.evaluate("i => __pl.renderBoard(i, 24)", i)
        open(BOARDS + f"board_{i:02d}.png", "wb").write(base64.b64decode(r["url"].split(",")[1])); names.append((i, r["name"], r["tier"]))
    sheet = pg.evaluate("""async () => {
        const cs = 9, n = 24 * cs, pad = 14, cols = 5, rows = 4, lab = 30, W = cols * (n + pad) + pad, H = rows * (n + pad + lab) + pad + 40;
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
        x.fillStyle = '#2b2350'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffd23f'; x.font = '900 24px system-ui'; x.textAlign = 'center'; x.fillText('Betri Hundar – 20 borð', W / 2, 30);
        const TN = { t: 'auðvelt', e: 'auðvelt', m: 'miðlungs', h: 'ERFITT', x: 'MJÖG ERFITT' }, TC = { t: '#3ddc84', e: '#3ddc84', m: '#3cc8f4', h: '#ff9a2e', x: '#ff4d5e' };
        for (let i = 1; i <= 20; i++) {
          const r = __pl.renderBoard(i, cs), img = new Image(); img.src = r.url; await img.decode();
          const cx = pad + ((i - 1) % cols) * (n + pad), cy = 44 + Math.floor((i - 1) / cols) * (n + pad + lab);
          x.drawImage(img, cx, cy); x.strokeStyle = TC[r.tier]; x.lineWidth = r.tier === 'h' || r.tier === 'x' ? 4 : 2; x.strokeRect(cx - 1, cy - 1, n + 2, n + 2);
          x.font = '800 15px system-ui'; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(i + '. ' + r.name, cx, cy + n + 18);
          x.textAlign = 'right'; x.fillStyle = TC[r.tier]; x.font = '900 12px system-ui'; x.fillText(TN[r.tier], cx + n, cy + n + 18);
        }
        return c.toDataURL(); }""")
    open(OUT + "11_contact_sheet_20_boards.png", "wb").write(base64.b64decode(sheet.split(",")[1]))
    ok(len(names) == 20, "20 board previews written to screenshots/v2_boards/ + contact sheet")
    # ---- level select with progress ----
    pg.tap("#hLevels", force=True); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + "12_level_select_tiers.png")
    pg.evaluate("document.querySelector('#levelsInner').scrollTop = 9999"); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT + "12b_level_select_tiers_bottom.png")
    pg.evaluate("document.querySelector('#levelsInner').scrollTop = 0")
    def lane_point(i):
        return pg.evaluate("""i => { const c = document.getElementById('cv').getBoundingClientRect(), L = __pl.layout();
            return [c.left + __pl.laneX(i), c.top + L.lanesY + L.houseH * 0.5]; }""", i)
    def state():
        return pg.evaluate("""() => { const G = __pl.game(), s = G.s;
          return { won: G.won, over: G.over, free: s.slots.filter(x => !x).length, packs: G.packs.length, runners: G.runners.length, left: s.left, total: G.total,
            lanes: s.lanes.map((l, i) => s.pos[i] < l.length ? (l[s.pos[i]].b === 'h' ? 3 : PL.target(s, l[s.pos[i]], s.D) >= 0 ? 2 : 1) : 0) }; }""")
    # ---- very hard level start (tier intro) ----
    pg.tap('[data-lvl="5"]', force=True); pg.wait_for_timeout(700)
    pg.screenshot(path=OUT + "13_very_hard_level_start.png")
    t5 = pg.evaluate("({tier: __pl.game().def.tier, intro: document.getElementById('tierIntro').className, chip: document.getElementById('tierChip').textContent, title: document.getElementById('title').textContent})")
    ok(t5["tier"] == "x" and "on" in t5["intro"] and "Mjög erfitt" in t5["chip"], f"very hard start shows badge: {json.dumps(t5, ensure_ascii=False)}")
    fitc = pg.evaluate("""() => { const W = innerWidth; return [...document.querySelectorAll('#ctrls > *')].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().right)).concat([W]); }""")
    ok(max(fitc[:-1]) <= fitc[-1], f"top controls (undo, chip, stars, restart, speed) fit on screen: right edges {fitc[:-1]} <= {fitc[-1]}")
    # forced loss on the very hard level: keep tapping lanes whose front cannot eat
    pg.wait_for_timeout(2500)
    for k in range(200):   # (very hard is softer since v3, so this can take more taps)
        st = state()
        if st["over"] or st["won"]: break
        bad = [i for i, v in enumerate(st["lanes"]) if v == 1] or [i for i, v in enumerate(st["lanes"]) if v]
        if st["free"] and bad:
            x, y = lane_point(random.choice(bad)); pg.touchscreen.tap(x, y)
        pg.wait_for_timeout(300)
    pg.wait_for_timeout(1200)
    lost = pg.evaluate("__pl.game().over")
    ok(lost, "forced loss reached on very hard level")
    if lost:
        pg.screenshot(path=OUT + "14_lose_dialog.png")
        pg.tap('#modalCard [data-act="undo"]', force=True); pg.wait_for_timeout(500)
        ok(not pg.evaluate("__pl.game().over") and pg.evaluate("__pl.game().undos") == 1, "undo from lose dialog resumes")
    # ---- hard level 3 played partially (greedy taps), frame time with many packs ----
    pg.tap("#bBack", force=True); pg.wait_for_timeout(300)
    pg.tap('[data-lvl="3"]', force=True); pg.wait_for_timeout(600)
    t3 = pg.evaluate("({tier: __pl.game().def.tier, chip: document.getElementById('tierChip').textContent})")
    ok(t3["tier"] == "h" and "Erfitt" in t3["chip"], f"hard level 3 shows 'Erfitt' chip: {json.dumps(t3, ensure_ascii=False)}")
    pg.wait_for_timeout(2600); pg.evaluate("__pl.resetFrames()")
    shot, maxp = False, 0
    for k in range(16):
        st = state(); maxp = max(maxp, st["packs"])
        if st["over"] or st["won"]: break
        order = sorted([i for i, v in enumerate(st["lanes"]) if v], key=lambda i: -st["lanes"][i])
        if order and st["free"]:
            x, y = lane_point(order[0]); pg.touchscreen.tap(x, y)
        pg.wait_for_timeout(500)
        if not shot and k >= 8 and st["runners"] >= 4:
            pg.screenshot(path=OUT + "15_hard_level_mid.png"); shot = True
    if not shot: pg.screenshot(path=OUT + "15_hard_level_mid.png")
    fr = pg.evaluate("__pl.frames()"); st = state()
    ok(fr["avgWorkMs"] < 8, f"hard level frame work avg {fr['avgWorkMs']:.2f}ms max {fr['maxWorkMs']:.1f}ms, rAF avg {fr['avgFrameMs']:.1f}ms ({fr['n']} frames, up to {maxp} packs)")
    print("hard level 3 after partial play:", json.dumps({k: st[k] for k in ("left", "total", "over", "won", "free")}))
    # ---- results screen of a hard level (board force-cleared via the debug hook) shows the tier coin bonus ----
    pg.tap("#bBack", force=True); pg.wait_for_timeout(300)
    pg.tap('[data-lvl="8"]', force=True); pg.wait_for_timeout(600)
    pg.evaluate("(() => { const s = __pl.game().s; s.cells = s.cells.map(() => null); s.left = 0; for (const k in s.rem) s.rem[k] = 0; __pl.game().bdirty = true; })()")
    pg.wait_for_function("__pl.screen() === 'finale'", timeout=15000); pg.wait_for_timeout(700)
    pg.touchscreen.tap(195, 500); pg.wait_for_timeout(100)
    pg.wait_for_function("__pl.finale() && __pl.finale().state !== 'aim' && __pl.finale().state !== 'intro'", timeout=5000)
    pg.wait_for_selector("#modal.on", timeout=30000); pg.wait_for_timeout(1700)
    pg.screenshot(path=OUT + "17_results_hard_tier_bonus.png")
    txt = pg.evaluate("document.getElementById('modalCard').innerText")
    ok("Erfitt-bónus (+25%)" in txt, "hard level results include 'Erfitt-bónus (+25%)' line")
    pg.tap('#modalCard [data-act="levels"], #modalCard [data-act="next"]', force=True); pg.wait_for_timeout(500)
    if pg.evaluate("__pl.screen()") == "game":
        pg.tap("#bBack", force=True); pg.wait_for_timeout(300)
    # ---- album (9 rescued) ----
    pg.tap("#bBack", force=True); pg.wait_for_timeout(200); pg.tap("#bBack", force=True); pg.wait_for_timeout(200)
    pg.tap("#hAlbum", force=True); pg.wait_for_timeout(500); pg.screenshot(path=OUT + "16_album_progress.png")
    cards = pg.evaluate("[...document.querySelectorAll('#albumInner .card')].map(c => [c.querySelector('b').textContent, c.querySelector('small').textContent, c.className.includes('lock')])")
    ok([c[0] for c in cards[:4]] == ["Lotta", "Roxy", "Rökkvi", "Myrkvi"] and not any(c[2] for c in cards[:4]), f"album shows Lotta, Roxy, Rökkvi, Myrkvi rescued at the top: {cards[:4]}")
    dd = pg.evaluate("PL.DOGS.filter(d => !PL.LEVELS.some(l => l.dog === d.id)).map(d => d.id)")
    ok(sorted(dd) == ["bangsi", "lubbi", "skotta", "snati"], f"dogs without a level (rescued via the daily puzzle): {dd}")
    pg.tap('#albumInner [data-dog="myrkvi"]', force=True); pg.wait_for_timeout(500); pg.screenshot(path=OUT + "18_album_myrkvi.png")
    ok("Einn af hundunum okkar" in pg.inner_text("#modalCard"), "family dog card says 'Einn af hundunum okkar'")
    pg.tap('#modalCard [data-act="close"]', force=True); pg.wait_for_timeout(300)
    pg.tap('#albumInner [data-dog="lotta"]', force=True); pg.wait_for_timeout(600); pg.screenshot(path=OUT + "19_album_lotta.png")
    pg.tap('#modalCard [data-act="close"]', force=True); pg.wait_for_timeout(300)
    # ---- closeup of the hand-drawn Lotta & Roxy portraits (from the user's photos) ----
    cp = b.new_page(viewport={"width": 860, "height": 520})
    cp.on("pageerror", lambda e: errors.append(str(e)))
    cp.goto(URL); cp.wait_for_timeout(700)
    cp.evaluate("""() => { const P = window.__pl; document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#2b2350;font:900 28px system-ui;color:#ffd23f;text-align:center';
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:40px;justify-content:center;padding:24px';
      for (const [id, nm] of [['lotta', 'Lotta'], ['roxy', 'Roxy']]) { const f = document.createElement('div');
        f.innerHTML = `<img src="${P.portrait(id)}" style="width:384px;height:384px;image-rendering:pixelated;border:6px solid #ffd23f;border-radius:18px;box-shadow:0 0 0 6px #ff5f9a"><div style="margin-top:14px">❤ ${nm}</div>`; row.appendChild(f); }
      document.body.appendChild(row); }""")
    cp.wait_for_timeout(300); cp.screenshot(path=OUT + "20_lotta_roxy_closeup.png"); cp.close()
    ok(True, "Lotta & Roxy closeup written")
    b.close()
ok(not errors, "no console errors" + ("" if not errors else ": " + " | ".join(errors[:5])))
print("RESULT:", "PASS" if not fails else "FAIL (%d)" % len(fails))
sys.exit(1 if fails else 0)
