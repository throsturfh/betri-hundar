"""1.1 test: automatic fullscreen on the first tap (+ re-arm after a background tab), the toggle button, the main-menu
button on every screen (with confirm mid-level, banking in the finale), 'Hætta leik' + goodbye screen, version label.
Screenshots -> screenshots/v1_1/.  Usage: python test_menu.py http://127.0.0.1:PORT/index.html"""
import json, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
OUT = "/workspace/pack-leader/screenshots/v1_1/"
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
errors, fails = [], []
def ok(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=UA, locale="is-IS")
    pg = ctx.new_page()
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.goto(URL); pg.evaluate("localStorage.clear()")
    pg.evaluate("localStorage.setItem('packleader.v2', JSON.stringify({coins: 300, stars: {1: 3, 2: 3}, album: ['lotta', 'roxy'], tips: {d: true, h: true}, daily: {}, mute: true, speed: 2, v: 2}))")
    pg.reload(); pg.wait_for_timeout(800)
    fs = lambda: pg.evaluate("!!document.fullscreenElement")
    vis = lambda sel: pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }})()")
    # ---- version label ----
    ok(pg.inner_text("#hVer") == "v1.1" and vis("#hVer") and pg.evaluate("__pl.version") == "1.1", "home shows a subtle 'v1.1' label")
    # ---- automatic fullscreen on the first tap anywhere ----
    ok(not fs() and pg.evaluate("__pl.fsState().armed"), "not fullscreen before any tap; auto-fullscreen armed")
    pg.touchscreen.tap(195, 120); pg.wait_for_timeout(500)
    ok(fs(), "first tap anywhere (empty home area) entered fullscreen")
    ok(pg.evaluate("__pl.screen()") == "home", "the first tap did nothing else (still on home)")
    pg.touchscreen.tap(195, 140); pg.wait_for_timeout(300)
    ok(fs() and not pg.evaluate("__pl.fsState().armed"), "auto-fullscreen fires once per session")
    # lost fullscreen while in a background tab -> next tap re-enters
    pg.evaluate("document.exitFullscreen()"); pg.wait_for_timeout(400)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(100)
    ok(not fs() and pg.evaluate("__pl.fsState().armed"), "after returning with fullscreen lost, auto-fullscreen is re-armed")
    pg.touchscreen.tap(195, 120); pg.wait_for_timeout(500)
    ok(fs(), "tap after returning re-entered fullscreen")
    # toggle button still works (off, then on)
    pg.tap("#bFS", force=True); pg.wait_for_timeout(400); off = fs()
    pg.tap("#bFS", force=True); pg.wait_for_timeout(400); on = fs()
    ok(not off and on, f"fullscreen toggle button still works (off={not off}, on={on})")
    pg.tap("#bFS", force=True); pg.wait_for_timeout(400)
    pg.touchscreen.tap(195, 120); pg.wait_for_timeout(400)
    ok(not fs(), "after the user turns fullscreen off with the button, taps don't force it back on")
    # play button itself triggers fullscreen (fresh session)
    pg.reload(); pg.wait_for_timeout(700)
    pg.tap("#hPlay"); pg.wait_for_timeout(700)
    ok(fs() and pg.evaluate("__pl.screen()") == "game", "the Spila button enters fullscreen and starts the level")
    # ---- main-menu button in a level, confirm when progress would be lost ----
    ok(vis("#bHome"), "menu (home) button visible in the level")
    ok(pg.evaluate("document.getElementById('title').textContent").startswith("Borð 3 · "), "in-level title keeps 'Borð N · name' text (two-line layout)")
    def lane_point(i):
        return pg.evaluate("i => { const c = document.getElementById('cv').getBoundingClientRect(), L = __pl.layout(); return [c.left + __pl.laneX(i), c.top + L.lanesY + L.houseH * 0.5]; }", i)
    for _ in range(3):
        st = pg.evaluate("(() => { const s = __pl.game().s; return s.lanes.map((l, i) => s.pos[i] < l.length && PL.target(s, l[s.pos[i]], s.D) >= 0); })()")
        if any(st): pg.touchscreen.tap(*lane_point(st.index(True))); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('hint').classList.remove('on')"); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT + "05_menu_button_in_level.png")
    pg.tap("#bHome", force=True); pg.wait_for_timeout(400)
    txt = pg.inner_text("#modalCard")
    ok(pg.evaluate("document.getElementById('modal').classList.contains('on')") and "Fara í aðalvalmynd?" in txt and pg.evaluate("__pl.game().paused"),
       "menu button mid-level asks for confirmation and pauses the level")
    pg.screenshot(path=OUT + "06_leave_level_confirm.png")
    pg.tap('#modalCard [data-act="close"]', force=True); pg.wait_for_timeout(300)
    ok(pg.evaluate("__pl.screen()") == "game" and not pg.evaluate("__pl.game().paused"), "'Halda áfram' resumes the level")
    pg.tap("#bHome", force=True); pg.wait_for_timeout(300); pg.tap('#modalCard [data-act="home-yes"]', force=True); pg.wait_for_timeout(400)
    ok(pg.evaluate("__pl.screen()") == "home" and not vis("#bHome"), "confirm -> main menu (menu button hidden on the menu itself)")
    # ---- menu button on level select + album (no confirm needed) ----
    for btn, scr in [("#hLevels", "levels"), ("#hAlbum", "album")]:
        pg.tap(btn, force=True); pg.wait_for_timeout(400)
        v = vis("#bHome"); pg.tap("#bHome", force=True); pg.wait_for_timeout(300)
        ok(v and pg.evaluate("__pl.screen()") == "home" and not pg.evaluate("document.getElementById('modal').classList.contains('on')"), f"menu button on {scr} goes straight home")
    # ---- menu button in the finale: banks the rescue, then home ----
    pg.tap("#hLevels", force=True); pg.wait_for_timeout(300); pg.tap('[data-lvl="3"]', force=True); pg.wait_for_timeout(600)
    pg.evaluate("(() => { const s = __pl.game().s; s.cells = s.cells.map(() => null); s.left = 0; for (const k in s.rem) s.rem[k] = 0; __pl.game().bdirty = true; })()")
    pg.wait_for_function("__pl.screen() === 'finale'", timeout=15000); pg.wait_for_timeout(500)
    ok(vis("#bHome"), "menu button visible in the finale")
    pg.screenshot(path=OUT + "07_menu_button_finale.png")
    pg.tap("#bHome", force=True); pg.wait_for_timeout(300)
    ok("Sæktu-bónusinn" in pg.inner_text("#modalCard"), "finale: confirm explains only the fetch bonus is skipped")
    pg.tap('#modalCard [data-act="home-bank"]', force=True); pg.wait_for_timeout(400)
    sv = pg.evaluate("__pl.save()")
    ok(pg.evaluate("__pl.screen()") == "home" and sv["stars"].get("3") and "rokkvi" in sv["album"], f"leaving the finale banked level 3 (stars {sv['stars']}, Rökkvi in album)")
    # ---- Hætta leik ----
    pg.wait_for_timeout(300); pg.screenshot(path=OUT + "08_main_menu_quit.png")
    ok(vis("#hQuit") and "Hætta leik" in pg.inner_text("#hQuit"), "main menu has a 'Hætta leik' button")
    pg.evaluate("window.__closeCalls = 0; window.close = () => { window.__closeCalls++; }; 0")   # stub: a real close is blocked for this tab anyway
    if not fs(): pg.tap("#bFS", force=True); pg.wait_for_timeout(400)
    pg.tap("#hQuit", force=True); pg.wait_for_timeout(400)
    ok("Hætta leik?" in pg.inner_text("#modalCard"), "quit asks for confirmation")
    pg.screenshot(path=OUT + "09_quit_confirm.png")
    pg.evaluate("localStorage.removeItem('packleader.v2')")
    pg.tap('#modalCard [data-act="quit-yes"]', force=True); pg.wait_for_timeout(800)
    saved = pg.evaluate("JSON.parse(localStorage.getItem('packleader.v2') || 'null')")
    cc = pg.evaluate("window.__closeCalls"); ok(cc == 1, f"quit tried window.close() ({cc} call)")
    ok(saved is not None and saved["coins"] == sv["coins"], "quit saved progress to 'packleader.v2'")
    ok(not fs(), "quit left fullscreen")
    ok(pg.evaluate("__pl.screen()") == "bye" and "Takk fyrir að spila!" in pg.inner_text("#bye") and "Þú getur lokað glugganum núna." in pg.inner_text("#bye"), "goodbye screen shown")
    pg.wait_for_timeout(300); pg.screenshot(path=OUT + "10_goodbye.png")
    pg.tap("#byeAgain", force=True); pg.wait_for_timeout(500)
    ok(pg.evaluate("__pl.screen()") == "home", "'Spila aftur' returns to the main menu")
    b.close()
ok(not errors, "no console errors" + ("" if not errors else ": " + " | ".join(errors[:5])))
print("RESULT:", "PASS" if not fails else "FAIL (%d)" % len(fails))
sys.exit(1 if fails else 0)
