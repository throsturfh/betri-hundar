"""Close-ups of the family-dog portraits. Usage: python portraits_closeup.py URL OUTDIR"""
import sys
from playwright.sync_api import sync_playwright
URL, OUT = sys.argv[1], sys.argv[2].rstrip('/') + '/'
JS = """(ids) => { const P = window.__pl; document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#2b2350;font:900 28px system-ui;color:#ffd23f;text-align:center';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:28px;justify-content:center;padding:24px';
  for (const id of ids) { const d = PL.DOGS.find(x => x.id === id), f = document.createElement('div');
    f.innerHTML = `<img src="${P.portrait(id)}" style="width:${ids.length > 2 ? 320 : 384}px;image-rendering:pixelated;border:6px solid #ffd23f;border-radius:18px;box-shadow:0 0 0 6px #ff5f9a"><div style="margin-top:14px">❤ ${d.name}</div><div style="font-size:18px;color:#fff;opacity:.85">${d.breed}</div>`; row.appendChild(f); }
  document.body.appendChild(row); }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    errs = []
    for ids, name, w in [(["rokkvi"], "portrait_rokkvi.png", 460), (["myrkvi"], "portrait_myrkvi.png", 460), (["jokull"], "portrait_jokull.png", 460), (["emil"], "portrait_emil.png", 460), (["vargur"], "portrait_vargur.png", 460),
                         (["lotta", "roxy", "rokkvi", "myrkvi"], "family_four.png", 1480), (["lotta", "roxy", "rokkvi", "myrkvi", "jokull", "emil", "vargur"], "family_seven.png", 2560)]:
        pg = b.new_page(viewport={"width": w, "height": 520 if len(ids) == 1 else 470})
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(500); pg.evaluate(JS, ids); pg.wait_for_timeout(200)
        pg.screenshot(path=OUT + name); pg.close()
    b.close()
    print("errors:", errs)
