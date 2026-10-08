"""v2 end-to-end test: Android-Chrome emulation (390x844, touch). Plays level 1 to a win by taps (measuring frame
time on the 24x24 board), fires the Fetch Finale with a touch drag, checks the album, toggles fullscreen on/off,
starts the daily puzzle, and saves screenshots to screenshots/v1_1/tests/.  Usage: python test_play.py http://127.0.0.1:PORT/index.html"""
import json, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = "/workspace/pack-leader/screenshots/v1_1/tests/"
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
errors, logs, fails = [], [], []
def ok(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)
def touch(cdp, typ, pts):
    cdp.send("Input.dispatchTouchEvent", {"type": typ, "touchPoints": [{"x": x, "y": y} for x, y in pts]})

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=UA, locale="is-IS")
    pg = ctx.new_page()
    pg.on("console", lambda m: (errors if m.type == "error" else logs).append(m.text))
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(800)
    cdp = ctx.new_cdp_session(pg)
    pg.screenshot(path=OUT + "00_home.png")
    nm = pg.evaluate("""async () => { const m = await (await fetch('manifest.json')).json();
      return { doc: document.title, logo: document.querySelector('.logo').innerText.replace(/\\s+/g, ' '), bar: document.getElementById('title').textContent,
        apple: document.querySelector('meta[name=apple-mobile-web-app-title]').content, mname: m.name, mshort: m.short_name }; }""")
    ok(all(v == "Betri Hundar" for v in nm.values()), "game is named 'Betri Hundar' everywhere: " + json.dumps(nm, ensure_ascii=False))

    # ---- fullscreen toggle on/off (home) ----
    pg.tap("#bFS", force=True); pg.wait_for_timeout(500)
    fs_on = pg.evaluate("!!document.fullscreenElement"); label_on = pg.get_attribute("#bFS", "aria-label")
    pg.tap("#bFS", force=True); pg.wait_for_timeout(500)
    fs_off = pg.evaluate("!!document.fullscreenElement"); label_off = pg.get_attribute("#bFS", "aria-label")
    ok(fs_on and not fs_off, f"fullscreen toggle on ({label_on}) -> off ({label_off})")

    # ---- level select with tier badges ----
    pg.tap("#hLevels", force=True); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + "01_level_select_fresh.png")
    nb = pg.evaluate("[document.querySelectorAll('.tile .tbadge.hard').length, document.querySelectorAll('.tile .tbadge.vhard').length, document.querySelectorAll('.tile').length]")
    ok(nb == [4, 4, 20], f"level select: 20 tiles, 4 'Erfitt' + 4 'Mjög erfitt' badges -> {nb}")
    pg.tap('[data-lvl="1"]', force=True); pg.wait_for_timeout(900)
    pg.screenshot(path=OUT + "02_level1_start_hint.png")
    ok(pg.evaluate("__pl.screen()") == "game", "level 1 started")
    info = pg.evaluate("(() => { const G = __pl.game(), L = __pl.layout(); return { w: G.p.w, h: G.p.h, cell: L.cell, blocks: G.total, bottom: L.lanesY + L.houseH * 2.12, H: document.getElementById('stage').clientHeight }; })()")
    ok(info["w"] >= 24 and info["h"] >= 24, f"level 1 board {info['w']}x{info['h']} = {info['blocks']} blocks, cell {info['cell']}px")
    ok(info["bottom"] <= info["H"] + 1, f"board + 5 slots + 3 lane rows fit without scrolling (content bottom {info['bottom']:.0f} <= stage {info['H']})")

    def lane_point(i):
        return pg.evaluate("""i => { const c = document.getElementById('cv').getBoundingClientRect(), L = __pl.layout();
            return [c.left + __pl.laneX(i), c.top + L.lanesY + L.houseH * 0.5]; }""", i)

    pg.evaluate("__pl.resetFrames()")
    taps, mid_shot, t0 = 0, False, time.time()
    while time.time() - t0 < 150:
        st = pg.evaluate("""() => { const G = __pl.game(); if (!G) return null; const s = G.s;
            const lanes = s.lanes.map((l, i) => s.pos[i] < l.length ? (PL.target(s, l[s.pos[i]], s.D) >= 0 ? 2 : 1) : 0);
            return { won: G.won, over: G.over, free: s.slots.filter(x => !x).length, lanes, left: s.left, total: G.total, scr: __pl.screen(), packs: G.packs.length, runners: G.runners.length }; }""")
        if not st or st["scr"] != "game" or st["won"]: break
        if st["over"]: print("LOST?!"); break
        if not mid_shot and st["left"] < st["total"] * 0.55 and taps >= 3 and st["runners"] > 3:
            pg.screenshot(path=OUT + "03_mid_level_big_board.png"); mid_shot = True
        cand = [i for i, v in enumerate(st["lanes"]) if v == 2] or [i for i, v in enumerate(st["lanes"]) if v == 1]
        if st["free"] > 0 and cand:
            x, y = lane_point(cand[0]); pg.touchscreen.tap(x, y); taps += 1
            if taps == 3: pg.tap("#bSpeed", force=True)  # 2x mid-level
        pg.wait_for_timeout(450)
    fr = pg.evaluate("__pl.frames()")
    won = pg.evaluate("__pl.game() && __pl.game().won")
    ok(won, f"level 1 won with {taps} taps")
    ok(fr["avgWorkMs"] < 8, f"frame work avg {fr['avgWorkMs']:.2f}ms max {fr['maxWorkMs']:.1f}ms; rAF interval avg {fr['avgFrameMs']:.1f}ms over {fr['n']} frames")
    pg.wait_for_timeout(1200); pg.screenshot(path=OUT + "04_level_cleared_reveal.png")
    pg.wait_for_function("__pl.screen() === 'finale'", timeout=15000); pg.wait_for_timeout(600)

    # ---- Fetch Finale: touch drag to aim, release to fling ----
    v = pg.evaluate("(() => { const c = document.getElementById('cv').getBoundingClientRect(); const f = __pl.fview(); return {l: c.left, t: c.top, k: f.k, ox: f.ox, oy: f.oy}; })()")
    Wd = lambda wx, wy: (v["l"] + v["ox"] + wx * v["k"], v["t"] + v["oy"] + wy * v["k"])
    sx, sy = Wd(150, 300)
    touch(cdp, "touchStart", [(sx, sy)])
    for i in range(1, 9):
        touch(cdp, "touchMove", [Wd(150 + i * 3, 300 + i * 6)]); pg.wait_for_timeout(40)
    pg.wait_for_timeout(200); pg.screenshot(path=OUT + "05_finale_aim.png")
    touch(cdp, "touchEnd", [])
    pg.wait_for_timeout(1100); pg.screenshot(path=OUT + "06_finale_flight.png")
    pg.wait_for_function("__pl.finale() && __pl.finale().state === 'land'", timeout=20000)
    pg.wait_for_timeout(450); pg.screenshot(path=OUT + "07_finale_landed.png")
    fin = pg.evaluate("(() => { const F = __pl.finale(); return F && {bowl: F.bowl, pts: F.pts, hits: F.hits, bones: F.bones, dbl: F.dbl, total: F.total, pegs: F.pegs.length, dblPeg: F.pegs.some(p => p.dbl)}; })()")
    ok(fin and fin["total"] > 0 and fin["pegs"] > 30, f"finale landed: {json.dumps(fin)}")
    pg.wait_for_selector("#modal.on", timeout=15000); pg.wait_for_timeout(1700)
    pg.screenshot(path=OUT + "08_results.png")

    # ---- album ----
    pg.tap('#modalCard [data-act="album"]', force=True); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT + "09_album.png")
    sv = pg.evaluate("__pl.save()")
    ok(sv["album"] == ["lotta"] and sv["stars"].get("1") == 3 and sv["coins"] > 500, "save after win: " + json.dumps({k: sv[k] for k in ("coins", "stars", "album")}, ensure_ascii=False))
    al = pg.evaluate("[...document.querySelectorAll('#albumInner .card')].map(c => c.querySelector('b').textContent)")
    ok(len(al) == 27 and al[:7] == ["Lotta", "Roxy", "Rökkvi", "Myrkvi", "Jökull", "Emil", "Vargur"], f"album lists {len(al)} dogs, family first: {al[:6]}")
    smalls = pg.evaluate("[...document.querySelectorAll('#albumInner .card small')].map(c => c.textContent)")
    ok(smalls.count("Bjargaðu í daglegri þraut") == 7, f"7 extra dogs are rescued in the daily puzzle ({smalls.count('Bjargaðu í daglegri þraut')})")
    fam = pg.evaluate("[...document.querySelectorAll('#albumInner .card.family')].map(c => c.className)")
    ok(len(fam) == 7 and "lock" not in fam[0], f"7 family cards (Lotta rescued, others shown by name): {fam}")

    # ---- daily start (bigger board, random tier) + undo + in-game fullscreen ----
    pg.tap("#bBack", force=True); pg.wait_for_timeout(300); pg.tap("#hDaily", force=True); pg.wait_for_timeout(1500)
    d = pg.evaluate("(() => { const G = __pl.game(); return { scr: __pl.screen(), w: G.p.w, h: G.p.h, tier: G.def.tier, pic: G.def.pic, lanes: G.p.lanes.length, title: document.getElementById('title').textContent }; })()")
    pg.screenshot(path=OUT + "10_daily.png")
    ok(d["scr"] == "game" and d["w"] == 24, f"daily: {json.dumps(d, ensure_ascii=False)}")
    ddog = pg.evaluate("__pl.game().dog.id")
    ok(ddog == "snati", f"daily puzzle rescues the next daily-only dog: {ddog}")
    for _ in range(3):
        if pg.evaluate("document.querySelector('#modal').classList.contains('on')"):
            pg.tap('#modalCard [data-act="close"]', force=True); pg.wait_for_timeout(400)
    x, y = lane_point(0); pg.touchscreen.tap(x, y); pg.wait_for_timeout(300); pg.tap("#bUndo", force=True); pg.wait_for_timeout(300)
    ok(pg.evaluate("__pl.game().undos === 1 && __pl.game().s.taps === 0"), "undo restores the board")
    pg.tap("#bFS", force=True); pg.wait_for_timeout(400); in_game_fs = pg.evaluate("!!document.fullscreenElement")
    pg.tap("#bFS", force=True); pg.wait_for_timeout(400)
    ok(in_game_fs and not pg.evaluate("!!document.fullscreenElement"), "in-game fullscreen toggle on -> off")
    b.close()
ok(not errors, "no console errors" + ("" if not errors else ": " + " | ".join(errors[:5])))
print("RESULT:", "PASS" if not fails else "FAIL (%d)" % len(fails))
sys.exit(1 if fails else 0)
