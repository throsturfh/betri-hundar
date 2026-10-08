"""1.1 screenshots (390x844 Android emulation) into screenshots/v1_1/ + v2.1-vs-1.1 before/after board comparison.
Usage: python shots_v1_1.py http://127.0.0.1:PORT/   (server root = /workspace/pack-leader)"""
import base64, json, sys, time
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1].rstrip('/') + '/'
NEW, OLD = ROOT + "index.html", ROOT + "releases/v2.1/index.html"
OUT = "/workspace/pack-leader/screenshots/v1_1/"
UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
SAVE = "localStorage.setItem('packleader.v2', JSON.stringify({coins: 1500, stars: {1: 3, 2: 3, 3: 2, 4: 3, 5: 2, 6: 3, 7: 3}, album: ['lotta','roxy','rokkvi','myrkvi','jokull','emil','vargur','tinna'], tips: {d: true, h: true}, daily: {}, mute: true, speed: 1, v: 2}))"
errors = []
def newpage(b):
    c = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=UA, locale="is-IS")
    pg = c.new_page()
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    return pg
def open_level(pg, url, lvl):
    pg.goto(url); pg.evaluate(SAVE); pg.reload(); pg.wait_for_timeout(700)
    pg.tap("#hLevels", force=True); pg.wait_for_timeout(400)
    pg.tap(f'[data-lvl="{lvl}"]', force=True); pg.wait_for_timeout(3300)
    pg.evaluate("document.getElementById('hint').classList.remove('on')"); pg.wait_for_timeout(350)
def board_clip(pg, extra=0):
    r = pg.evaluate("(() => { const c = document.getElementById('cv').getBoundingClientRect(), L = __pl.layout(); return [c.left + L.bx - 10, c.top + L.by - 10, L.bw + 20, L.bh + 20]; })()")
    return {"x": r[0], "y": r[1], "width": r[2], "height": r[3] + extra}
def lane_point(pg, i):
    return pg.evaluate("i => { const c = document.getElementById('cv').getBoundingClientRect(), L = __pl.layout(); return [c.left + __pl.laneX(i), c.top + L.lanesY + L.houseH * 0.5]; }", i)
def smart_tap(pg):
    st = pg.evaluate("""() => { const G = __pl.game(), s = G.s; return { free: s.slots.filter(x => !x).length,
      lanes: s.lanes.map((l, i) => s.pos[i] < l.length ? (PL.target(s, l[s.pos[i]], s.D) >= 0 ? 2 : 1) : 0) }; }""")
    good = [i for i, v in enumerate(st["lanes"]) if v == 2] or ([i for i, v in enumerate(st["lanes"]) if v == 1] if st["free"] > 2 else [])
    if not good: return False
    x, y = lane_point(pg, good[0]); pg.touchscreen.tap(x, y); return True
def b64(path): return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--autoplay-policy=no-user-gesture-required"])
    pg = newpage(b)
    pg.goto(NEW); pg.evaluate(SAVE); pg.reload(); pg.wait_for_timeout(1200)
    pg.screenshot(path=OUT + "01_home.png")
    # album top with the four family dogs
    pg.tap("#hAlbum", force=True); pg.wait_for_timeout(700); pg.screenshot(path=OUT + "04_album_top.png")
    cards = pg.evaluate("[...document.querySelectorAll('#albumInner .card')].slice(0, 7).map(c => c.querySelector('b').textContent + ' / ' + c.querySelector('small').textContent)")
    notes = {}
    for d in ["lotta", "roxy", "rokkvi", "myrkvi", "jokull", "emil", "vargur"]:
        pg.tap(f'#albumInner [data-dog="{d}"]', force=True); pg.wait_for_timeout(450)
        notes[d] = pg.inner_text("#modalCard").replace("\n", " | ")
        if d == "rokkvi": pg.screenshot(path=OUT + "04b_album_rokkvi_card.png")
        if d == "emil": pg.screenshot(path=OUT + "04c_album_emil_card.png")
        if d == "vargur": pg.screenshot(path=OUT + "04d_album_vargur_card.png")
        pg.tap('#modalCard [data-act="close"]', force=True); pg.wait_for_timeout(250)
    print("album cards:", json.dumps(cards, ensure_ascii=False)); print("album notes:", json.dumps(notes, ensure_ascii=False, indent=1))
    # level 3 mid-play + eat sparkle + frame time
    pg.tap("#bBack", force=True); pg.wait_for_timeout(300)
    open_level(pg, NEW, 3)
    pg.evaluate("__pl.resetFrames()")
    spark_shot, t0 = False, time.time()
    while time.time() - t0 < 25:
        if not smart_tap(pg): pg.wait_for_timeout(250); continue
        if not spark_shot:
            try:
                pg.wait_for_function("__pl.game().parts.filter(p => p.spark).length >= 6", timeout=1500)
                pg.screenshot(path=OUT + "03_eat_sparkle.png"); pg.screenshot(path=OUT + "03b_eat_sparkle_zoom.png", clip=board_clip(pg, 90)); spark_shot = True
            except Exception: pass
        pg.wait_for_timeout(420)
        if pg.evaluate("__pl.game().over || __pl.game().won"): break
    pg.wait_for_timeout(600); pg.evaluate("document.getElementById('hint').classList.remove('on')")
    pg.screenshot(path=OUT + "02_level3_midplay.png")
    fr = pg.evaluate("__pl.frames()"); st = pg.evaluate("(() => { const G = __pl.game(); return { left: G.s.left, total: G.total, layerDraws: G.layerDraws }; })()")
    print("level 3 frames:", json.dumps({k: round(v, 2) for k, v in fr.items()}), json.dumps(st))
    # before / after: the same level-3 board at start, v2.1 vs 1.1
    shots = {}
    for tag, url in [("old", OLD), ("new", NEW)]:
        q = newpage(b); open_level(q, url, 3); clip = board_clip(q, 120)
        q.screenshot(path=f"/tmp/ba_{tag}.png", clip=clip)
        q.screenshot(path=f"/tmp/ba_{tag}_zoom.png", clip={"x": clip["x"] + 10, "y": clip["y"] + 10, "width": 110, "height": 110})
        q.context.close()
    cp = b.new_page(viewport={"width": 1000, "height": 1500})
    cp.set_content(f"""<body style="margin:0;background:#1f1840;font:900 30px system-ui;color:#fff;text-align:center">
      <div style="display:flex;gap:24px;justify-content:center;padding:22px 20px 10px">
        <div><div style="margin-bottom:10px;color:#cfc6f5">v2.1 (fyrir)</div><img src="{b64('/tmp/ba_old.png')}" style="width:470px;border-radius:14px"></div>
        <div><div style="margin-bottom:10px;color:#ffd23f">1.1 (eftir)</div><img src="{b64('/tmp/ba_new.png')}" style="width:470px;border-radius:14px"></div></div>
      <div style="font-size:20px;opacity:.8;margin:6px 0">Borð 3 · nærmynd af kubbum</div>
      <div style="display:flex;gap:24px;justify-content:center">
        <img src="{b64('/tmp/ba_old_zoom.png')}" style="width:470px;image-rendering:pixelated;border-radius:14px">
        <img src="{b64('/tmp/ba_new_zoom.png')}" style="width:470px;image-rendering:pixelated;border-radius:14px"></div></body>""")
    cp.wait_for_timeout(300)
    h = cp.evaluate("document.body.scrollHeight"); cp.set_viewport_size({"width": 1000, "height": h + 20}); cp.screenshot(path=OUT + "before_after.png")
    b.close()
print("spark shot:", spark_shot, "| console errors:", errors)
