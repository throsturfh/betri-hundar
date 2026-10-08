"""1.1 test: tilt steering in the Fetch Finale via synthetic deviceorientation events (calibration, dead zone,
left/right path shift, on/off setting, hint).  Usage: python test_tilt.py http://127.0.0.1:PORT/index.html"""
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
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA, locale="is-IS")
    pg = ctx.new_page()
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    cdp = ctx.new_cdp_session(pg)
    def to_finale(first=False):
        if first:
            pg.goto(URL); pg.evaluate("localStorage.clear()")
            pg.evaluate("localStorage.setItem('packleader.v2', JSON.stringify({coins: 0, stars: {}, album: [], tips: {d: true, h: true}, daily: {}, mute: true, speed: 1, v: 2}))")
        pg.reload(); pg.wait_for_timeout(600)
        pg.evaluate("""() => { Math.random = () => 0.5; window.__tiltG = 10;   // deterministic bounces; phone held 10° tilted
          setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 50, gamma: window.__tiltG })), 30); }""")
        pg.tap("#bFS", force=True); pg.tap("#bFS", force=True)   # (keeps auto-fullscreen out of the way)
        pg.tap("#hPlay", force=True); pg.wait_for_timeout(500)
        if pg.evaluate("document.getElementById('modal').classList.contains('on')"): pg.tap('#modalCard [data-act="close"]', force=True)
        pg.evaluate("(() => { const s = __pl.game().s; s.cells = s.cells.map(() => null); s.left = 0; for (const k in s.rem) s.rem[k] = 0; __pl.game().bdirty = true; })()")
        pg.wait_for_function("__pl.screen() === 'finale'", timeout=15000); pg.wait_for_timeout(500)
    def shoot(gamma_after, nopegs=False):
        if nopegs: pg.evaluate('__pl.finale().pegs = []')   # peg-free field: the path then shows the tilt push alone
        v = pg.evaluate("(() => { const c = document.getElementById('cv').getBoundingClientRect(); const f = __pl.fview(); return {l: c.left, t: c.top, k: f.k, ox: f.ox, oy: f.oy}; })()")
        Wd = lambda wx, wy: {"x": v["l"] + v["ox"] + wx * v["k"], "y": v["t"] + v["oy"] + wy * v["k"]}
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [Wd(180, 300)]}); pg.wait_for_timeout(60)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [Wd(181, 320)]}); pg.wait_for_timeout(60)
        pg.evaluate(f"""() => {{ window.__samp = []; const go = () => {{ const F = __pl.finale(); if (F && F.ball && F.state === 'fly') {{ window.__samp.push([F.flyT, F.ball.x, F.tiltA, F.tilt0]); if (F.flyT > 0.05) window.__tiltG = {gamma_after}; }}
          if (window.__samp.length < 400 && (!F || F.state !== 'land')) requestAnimationFrame(go); }}; requestAnimationFrame(go); }}""")
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        pg.wait_for_function("__pl.finale() && (__pl.finale().state === 'land' || (__pl.finale().flyT || 0) > 1.6)", timeout=20000)
        sm = pg.evaluate("window.__samp")
        win = [s for s in sm if 0.25 < s[0] < 1.4]
        mean = sum(s[1] for s in win) / max(1, len(win))
        maxA = max((abs(s[2]) for s in win), default=0); sgnA = max(win, key=lambda s: abs(s[2]))[2] if win else 0
        return {"meanX": round(mean, 1), "maxTiltA": round(maxA, 1), "tiltA": round(sgnA, 1), "tilt0": sm[0][3] if sm else None, "n": len(win), "lastX": round(sm[-1][1], 1) if sm else None}
    to_finale(first=True)
    pg.wait_for_timeout(300); pg.screenshot(path=OUT + "11_finale_tilt_hint.png")
    ok(pg.evaluate("__pl.finale().tiltHint") and pg.evaluate("document.getElementById('bTilt').classList.contains('on')"), "finale shows the tilt hint + 'Halla: Á' toggle")
    ok(pg.evaluate("__pl.save().tilt") in (None, True), "tilt is on by default")
    neutral = shoot(10, True); print("held at 10°, no change (no pegs):", neutral)
    ok(neutral["tilt0"] is not None and abs(neutral["tilt0"] - 10) < 0.5 and neutral["maxTiltA"] < 1, "neutral calibrated at the shot (phone held at 10° does not drift)")
    to_finale(); right = shoot(40, True); print("tilt right (+30°, no pegs):", right)
    to_finale(); left = shoot(-20, True); print("tilt left (-30°, no pegs):", left)
    to_finale(); pr = shoot(40); to_finale(); p0 = shoot(10); print("with pegs: tilt right", pr, "| neutral", p0, "(pegs still decide the bounces)")
    ok(right["tiltA"] > 100 and left["tiltA"] < -100, f"tilt produces a capped sideways push (right {right['tiltA']}, left {left['tiltA']} px/s², cap 220)")
    ok(right["lastX"] > neutral["lastX"] + 8 and left["lastX"] < neutral["lastX"] - 8 and right["meanX"] > neutral["meanX"] > left["meanX"],
       f"ball path shifts with tilt: landing x left {left['lastX']} < neutral {neutral['lastX']} < right {right['lastX']} (mean x {left['meanX']} / {neutral['meanX']} / {right['meanX']})")
    to_finale(); dz = shoot(12.5); print("inside dead zone (+2.5°):", dz)
    ok(dz["maxTiltA"] < 1, "3° dead zone: a 2.5° wobble does nothing")
    to_finale()
    pg.tap("#bTilt", force=True); pg.wait_for_timeout(200)
    ok(pg.evaluate("__pl.save().tilt") is False and "Af" in pg.inner_text("#bTilt"), "tilt toggle turns it off (saved)")
    off = shoot(40); print("setting off, tilt right:", off)
    ok(off["maxTiltA"] < 1, "with tilt off, tilting does nothing")
    pg.wait_for_timeout(300); pg.reload(); pg.wait_for_timeout(500)
    ok(pg.evaluate("__pl.save().tilt") is False, "tilt setting persists")
    b.close()
ok(not errors, "no console errors" + ("" if not errors else ": " + " | ".join(errors[:5])))
print("RESULT:", "PASS" if not fails else "FAIL (%d)" % len(fails))
sys.exit(1 if fails else 0)
