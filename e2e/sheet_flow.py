"""Google Sheet setup: the coming-soon page with no database. Run via e2e/sheet_run.sh."""
import json, os, re, urllib.error, urllib.request
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3124"
OUT = "e2e/out"
rows = lambda: json.load(open(f"{OUT}/sheet.json"))[1:]
row = lambda email: next((r for r in rows() if r[1] == email), None)
mails = lambda: [json.loads(l) for l in open(f"{OUT}/sheet-mail.jsonl")] if os.path.exists(f"{OUT}/sheet-mail.jsonl") else []

def api(method, body, ip="203.0.113.9"):
    req = urllib.request.Request(B + "/api/waitlist", data=json.dumps(body).encode(), method=method,
                                 headers={"Content-Type": "application/json", "x-forwarded-for": ip})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

def get_json(path):
    with urllib.request.urlopen(B + path) as r: return json.loads(r.read())

# Place lookups work without a database
assert get_json("/api/geo?kind=city&q=Frem")[0]["metro_name"] == "San Francisco Bay Area"
assert get_json("/api/geo?kind=city&q=75040")[0]["name"] == "Garland"
assert "Jaipur" in [x["city"] for x in get_json("/api/geo?kind=home&q=Jai")]
assert get_json("/api/geo?kind=locate&lat=33.1507&lng=-96.8236")[0]["metro_name"].startswith("Dallas")
assert get_json("/api/geo?kind=locate&lat=30&lng=-60") == []   # the ocean

# A friend joins first (API), so there's an invite code to use
s, friend = api("POST", {"email": "aman@example.com", "adult": True}, ip="192.0.2.50")
assert s == 200 and len(friend["refCode"]) == 8 and not friend["already"], friend

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)
    ctx = browser.new_context(viewport={"width": 1440, "height": 1100}, geolocation={"latitude": 32.9126, "longitude": -96.6389}, permissions=["geolocation"])
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/r/" + friend["refCode"])
    expect(pg.get_by_role("heading", name="Join the waitlist")).to_be_visible()
    pg.wait_for_load_state("networkidle")
    expect(pg.get_by_label("Current city")).to_have_value("")
    pg.get_by_role("button", name="Use my location").click()                     # works without a database too
    expect(pg.get_by_label("Current city")).to_have_value("Garland, TX")
    expect(pg.get_by_role("link", name="Beta tester log in")).to_have_count(0)   # no app to log in to yet

    pg.get_by_label("Email", exact=True).fill("priya@example.com")
    pg.get_by_label("First name").fill("Priya")
    home = pg.get_by_role("combobox", name="Hometown")
    # Worldwide hometowns: a US city and an old Indian city name both work
    home.fill("Chicago"); expect(pg.get_by_role("option", name=re.compile("^Chicago.*Illinois")).first).to_be_visible()
    home.fill("Bangalore"); expect(pg.get_by_role("option", name=re.compile("^Bengaluru")).first).to_be_visible()
    home.fill("Jai"); pg.get_by_role("option", name=re.compile("^Jaipur")).first.click()
    pg.get_by_role("checkbox").check()
    pg.get_by_role("button", name="Join the waitlist").click()
    expect(pg.get_by_role("heading", name="You're on the list.")).to_be_visible()
    expect(pg.get_by_role("status").get_by_text(re.compile("Dallas.Fort Worth"))).to_be_visible()

    r = row("priya@example.com")
    assert r, rows()
    code = r[6]
    assert r[3] == "Garland, TX" and r[4].startswith("Dallas") and r[5] == "Jaipur, Rajasthan" and r[7] == friend["refCode"], r
    assert len(r[8]) == 32 and "203.0" not in r[8]   # scrambled network, never the address
    assert row("aman@example.com")[9] == 1, row("aman@example.com")   # friend credited
    expect(pg.get_by_text(f"localhost:3124/r/{code}")).to_be_visible()

    assert row("priya@example.com")[2] == "Priya"
    assert api("PATCH", {"email": "priya@example.com", "refCode": "wrongcod", "firstName": "X"})[0] == 404
    assert row("priya@example.com")[2] == "Priya"
    assert not errs, errs

    # Confirmation email sent by the sheet (Gmail), with the real invite code and a leave link
    m = [x for x in mails() if x["to"] == "priya@example.com"]
    assert len(m) == 1 and f"/r/{code}" in m[0]["htmlBody"] and "{{CODE}}" not in m[0]["htmlBody"] + m[0]["body"], m
    leave = re.search(r'href="(http://localhost:3124/api/waitlist/leave[^"]+)"', m[0]["htmlBody"]).group(1).replace("&amp;", "&")

    # Joining again: same code, no second email
    s, j = api("POST", {"email": "Priya@Example.com", "adult": True})
    assert s == 200 and j["already"] and j["refCode"] == code, j
    assert len([x for x in mails() if x["to"] == "priya@example.com"]) == 1

    # Spam limit: 5 per network per hour
    codes = [api("POST", {"email": f"fill{i}@example.com", "adult": True}, ip="198.51.100.7")[0] for i in range(6)]
    assert codes == [200] * 5 + [429], codes
    assert api("POST", {"email": "nope", "adult": True})[0] == 400

    # App pages aren't reachable before launch
    for path in ["/people", "/login", "/admin", "/setup"]:
        pg.goto(B + path); expect(pg).to_have_url(B + "/")
    pg.goto(B + "/privacy"); expect(pg.get_by_role("heading", name="Privacy policy")).to_be_visible()

    # Leave the list from the email
    pg.goto(leave.replace("t=", "t=x")); assert row("priya@example.com")
    pg.goto(leave)
    expect(pg.get_by_role("heading", name="You've left the list")).to_be_visible()
    assert row("priya@example.com") is None
    browser.close()

print("sheet flow: all checks passed")
