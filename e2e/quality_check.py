"""Quality gate: accessibility (axe, WCAG 2.2 AA) on every screen, and layout at four screen sizes.
Run after screens_flow.py (reuses its users and data) via e2e/run.sh."""
import json, os, re, subprocess
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3123"
OUT = "e2e/out/quality"
os.makedirs(OUT, exist_ok=True)
AXE = open("node_modules/axe-core/axe.min.js").read()
psql = lambda sql: subprocess.run(["psql", "-d", "e2e", "-qtAc", sql], check=True, capture_output=True, text=True).stdout.strip()

rohit = "d0000000-0000-0000-0000-000000000001"
aman_conv = psql("select conversation_id from conversation_members where profile_id='d0000000-0000-0000-0000-000000000003' limit 1")
SIGNED_IN = [("people", "/people"), ("profile", f"/p/{rohit}"), ("chats", "/chats"), ("chat", f"/chats/{aman_conv}"),
             ("explore", "/explore"), ("events", "/explore?tab=events"), ("ask", "/explore/ask"), ("help", "/help"),
             ("admin", "/admin"), ("setup", "/setup"), ("not_found", "/p/00000000-0000-0000-0000-000000000000")]
SIGNED_OUT = [("welcome", "/"), ("login", "/login"), ("unsubscribed", "/unsubscribed")]
SIZES = [("small_phone", 320, 640), ("phone", 390, 844), ("large_phone", 430, 932), ("desktop", 1280, 900)]

def axe(pg):
    pg.add_script_tag(content=AXE)
    res = pg.evaluate("""async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0,3).map(n => n.target.join(' ')) }));
    }""")
    return res

def overflow(pg):
    return pg.evaluate("""() => {
      const de = document.documentElement, app = document.querySelector('.app-frame');
      const bad = [];
      if (de.scrollWidth > window.innerWidth + 1) bad.push('page scrolls sideways (' + de.scrollWidth + 'px)');
      if (app && app.scrollWidth > app.clientWidth + 1) bad.push('app frame overflows (' + app.scrollWidth + ' > ' + app.clientWidth + ')');
      return bad;
    }""")

def sign_in(ctx):
    pg = ctx.new_page()
    pg.goto(B + "/login"); pg.get_by_label("Email").fill("neeraj@example.com"); pg.get_by_role("button", name="Send me a code").click()
    pg.get_by_label("6-digit code").fill("123456"); expect(pg).to_have_url(re.compile(r"/people$"))
    return pg

report = {"axe": {}, "layout": {}}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)
    for size, w, h in SIZES:
        a = browser.new_context(viewport={"width": w, "height": h})
        o = browser.new_context(viewport={"width": w, "height": h})
        pa = sign_in(a); po = o.new_page()
        for pages, pg in ((SIGNED_IN, pa), (SIGNED_OUT, po)):
            for name, path in pages:
                pg.goto(B + path); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(250)
                problems = overflow(pg)
                if problems: report["layout"].setdefault(f"{name}@{size}", problems)
                if size == "phone": report["axe"][name] = axe(pg)
                if size in ("small_phone", "desktop"): pg.screenshot(path=f"{OUT}/{name}_{size}.png")
        a.close(); o.close()
    browser.close()

json.dump(report, open(f"{OUT}/report.json", "w"), indent=2)
issues = sum(len(v) for v in report["axe"].values())
print(f"QUALITY: {len(report['axe'])} screens scanned, {issues} accessibility rule failures, {len(report['layout'])} layout problems")
for screen, vs in report["axe"].items():
    for v in vs: print(f"  axe {screen}: [{v['impact']}] {v['id']} - {v['help']} -> {v['nodes']}")
for k, v in report["layout"].items(): print(f"  layout {k}: {v}")
