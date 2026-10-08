"""Frame-work comparison v2.1 vs 1.1 on the 24x24 level 3 with 4x CPU throttling (rough mid-range Android proxy).
Usage: python perf_v1_1.py http://127.0.0.1:PORT/"""
import json, sys, time
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1].rstrip('/') + '/'
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
SAVE = "localStorage.setItem('packleader.v2', JSON.stringify({coins: 0, stars: {1: 3, 2: 3}, album: ['lotta','roxy'], tips: {d: true, h: true}, daily: {}, mute: true, speed: 2, v: 2}))"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=no-user-gesture-required"])
    for tag, url in [("v2.1", ROOT + "releases/v2.1/index.html"), ("1.1", ROOT + "index.html")]:
        c = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2.5, is_mobile=True, has_touch=True, user_agent=UA)
        pg = c.new_page(); cdp = c.new_cdp_session(pg)
        pg.goto(url); pg.evaluate(SAVE); pg.reload(); pg.wait_for_timeout(700)
        pg.tap("#hLevels", force=True); pg.wait_for_timeout(300); pg.tap('[data-lvl="3"]', force=True); pg.wait_for_timeout(3000)
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        pg.evaluate("__pl.resetFrames()"); t0 = time.time(); taps = 0
        while time.time() - t0 < 14:
            st = pg.evaluate("""() => { const G = __pl.game(), s = G.s; return { free: s.slots.filter(x => !x).length, over: G.over || G.won,
              lanes: s.lanes.map((l, i) => s.pos[i] < l.length ? (PL.target(s, l[s.pos[i]], s.D) >= 0 ? 2 : 1) : 0) }; }""")
            if st["over"]: break
            good = [i for i, v in enumerate(st["lanes"]) if v == 2]
            if good:
                xy = pg.evaluate("i => { const c = document.getElementById('cv').getBoundingClientRect(), L = __pl.layout(); return [c.left + __pl.laneX(i), c.top + L.lanesY + L.houseH * 0.5]; }", good[0])
                pg.touchscreen.tap(*xy); taps += 1
            pg.wait_for_timeout(350)
        fr = pg.evaluate("__pl.frames()"); g = pg.evaluate("(() => { const G = __pl.game(); return { eaten: G.eaten, layerDraws: G.layerDraws, blk: Object.keys(BLK || {}).length } })()") if False else pg.evaluate("(() => { const G = __pl.game(); return { eaten: G.eaten, layerDraws: G.layerDraws } })()")
        print(tag, "4x CPU throttle:", json.dumps({k: round(v, 2) for k, v in fr.items()}), json.dumps(g), "taps", taps)
        c.close()
    b.close()
