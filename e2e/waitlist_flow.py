"""End-to-end test of the pre-launch "Join the community" page and the launch switch.
Run from the repo root via e2e/run.sh. Starts in waitlist mode and leaves the site in 'open'
mode for the other flows.
"""
import json, os, re, subprocess, urllib.error, urllib.parse, urllib.request, uuid
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3123"
OUT = "e2e/out"
psql = lambda sql: subprocess.run(["psql", "-d", "e2e", "-qtAc", sql], check=True, capture_output=True, text=True).stdout.strip()
uid = lambda email: str(uuid.uuid5(uuid.NAMESPACE_URL, email))

def emails():
    try: return [json.loads(l) for l in open(f"{OUT}/emails.jsonl")]
    except FileNotFoundError: return []

def api_join(body, ip="203.0.113.9"):
    req = urllib.request.Request(B + "/api/waitlist", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-forwarded-for": ip})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

def finish_setup(pg, first):
    """The setup steps after sign-in (same as a real first visit)."""
    expect(pg).to_have_url(re.compile(r"/setup$"))
    pg.get_by_label("Hometown").fill("Jai"); pg.get_by_role("button", name=re.compile("^Jaipur")).first.click()
    pg.get_by_role("button", name="Continue").click()
    for i in ["Tennis", "Cricket", "Chai meetups"]: pg.get_by_role("button", name=i, exact=True).click()
    pg.get_by_role("button", name="Continue").click()
    pg.get_by_role("button", name="Type a city or ZIP instead").click()
    pg.get_by_label("Your city or ZIP").fill("75040"); pg.get_by_role("button", name=re.compile(r", TX 75040")).first.click()
    pg.get_by_role("button", name="Continue").click()
    pg.set_input_files("#photoInput", "e2e/face.jpg")
    pg.get_by_label("First name").fill(first); pg.get_by_label("Last name").fill("Test")
    pg.get_by_role("checkbox").check(); pg.get_by_role("button", name="Finish").click()
    expect(pg.get_by_role("heading", name=re.compile("You're in"))).to_be_visible()

def sign_in(browser, email, next_path="/setup", heading=None):
    ctx = browser.new_context(viewport={"width": 400, "height": 860})
    pg = ctx.new_page()
    pg.goto(B + "/login?next=" + next_path)
    if heading:
        expect(pg.get_by_role("heading", name=heading)).to_be_visible()
        pg.screenshot(path=f"{OUT}/login-prelaunch.png")
    pg.get_by_label("Email", exact=True).fill(email); pg.get_by_role("button", name="Send me a code").click()
    pg.get_by_label("6-digit code").fill("123456")
    return ctx, pg

psql("update app_settings set value='\"waitlist\"' where key='site_mode'; delete from waitlist; delete from beta_testers;")
psql("delete from profiles where id::text not like 'd0000000%'; delete from auth.users where id::text not like 'd0000000%';")
before = 0  # set after the friend joins

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)

    # ── A visitor joins from a phone ──
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    s, friend = api_join({"email": "aman@example.com", "adult": True}, ip="192.0.2.50")
    assert s == 200 and len(friend["refCode"]) == 8, friend
    before = len(emails())
    pg.goto(B + "/r/" + friend["refCode"])                       # short invite link
    expect(pg).to_have_url(re.compile(r"/\?ref=" + friend["refCode"] + "$"))
    expect(pg.get_by_role("heading", name="Join the waitlist")).to_be_visible()
    pg.wait_for_load_state("networkidle")
    expect(pg.get_by_text("Coming soon to Dallas-Fort Worth")).to_be_visible()
    pg.screenshot(path=f"{OUT}/waitlist-phone.png", full_page=True)

    pg.get_by_role("button", name="Join the waitlist").click()
    expect(pg.locator("form p[role=alert]")).to_have_text("Please check your email address and confirm you're 18 or older.")   # both problems at once
    pg.get_by_label("Email", exact=True).fill("priya@example.com")
    pg.get_by_role("button", name="Join the waitlist").click()
    expect(pg.locator("form p[role=alert]")).to_have_text(re.compile("18 or older"))

    # First name up front (optional), one hometown picked from the list
    pg.get_by_label("First name").fill("Priya")
    home1 = pg.get_by_role("combobox", name="Hometown")
    # Worldwide hometowns: a US city and an old Indian city name both work
    home1.fill("Chicago"); expect(pg.get_by_role("option", name=re.compile("^Chicago.*Illinois")).first).to_be_visible()
    home1.fill("Bangalore"); expect(pg.get_by_role("option", name=re.compile("^Bengaluru")).first).to_be_visible()
    home1.fill("Calcutta"); expect(pg.get_by_role("option").first).to_contain_text("Kolkata")   # old name of a big city ranks first
    # A neighbourhood, a PIN and "City, State" all find the city (only the city is kept)
    home1.fill("Salt Lake"); expect(pg.get_by_role("option").first).to_have_text(re.compile("^Salt Lake.*Kolkata, West Bengal"))
    home1.fill("700091"); expect(pg.get_by_role("option").first).to_have_text(re.compile("^700091.*Kolkata"))
    home1.fill("Mumbai, India"); expect(pg.get_by_role("option").first).to_have_text(re.compile("^Mumbai"))
    home1.fill("Andheri"); pg.get_by_role("option").first.click(); expect(home1).to_have_value("Mumbai, Maharashtra")
    home1.fill("Jai")
    pg.get_by_role("option", name=re.compile("^Jaipur")).first.click()
    expect(home1).to_have_value(re.compile("^Jaipur"))
    # Address-style typing: "Plano, TX" narrows by state; a full ZIP picks its city without tapping the list
    pg.get_by_label("Current city").fill("Plano, TX"); expect(pg.get_by_role("option").first).to_have_text(re.compile("^Plano, TX"))
    pg.get_by_label("Current city").fill("75024"); expect(pg.get_by_label("Current city")).to_have_value("Plano, TX")
    expect(pg.get_by_text("Part of Dallas")).to_be_visible()
    pg.get_by_label("Current city").fill("Fremont")
    pg.get_by_role("option", name=re.compile(r"^Fremont, CA")).first.click()
    expect(pg.get_by_text("Part of San Francisco Bay Area")).to_be_visible()
    pg.get_by_role("checkbox").check()
    pg.get_by_role("button", name="Join the waitlist").click()
    expect(pg.get_by_role("heading", name="You're on the list.")).to_be_visible()
    expect(pg.get_by_role("status").get_by_text("San Francisco Bay Area")).to_be_visible()
    code = psql("select ref_code from waitlist where email='priya@example.com'")
    expect(pg.get_by_text(f"localhost:3123/r/{code}")).to_be_visible()
    expect(pg.get_by_text("What happens next")).to_be_visible()
    pg.screenshot(path=f"{OUT}/waitlist-joined.png", full_page=True)
    assert psql("select referred_by || '|' || metro || '|' || hometown from waitlist where email='priya@example.com'") == friend["refCode"] + "|41860|Jaipur, Rajasthan", psql("select * from waitlist")

    # The first name typed in the form was saved with the sign-up
    assert psql("select first_name from waitlist where email='priya@example.com'") == "Priya"
    req = urllib.request.Request(B + "/api/waitlist", data=json.dumps({"email": "priya@example.com", "refCode": "WRONGCOD", "firstName": "X"}).encode(), method="PATCH", headers={"Content-Type": "application/json"})
    try: urllib.request.urlopen(req); assert False, "wrong code must not save"
    except urllib.error.HTTPError as e: assert e.code == 404
    assert psql("select first_name from waitlist where email='priya@example.com'") == "Priya"
    assert not errs, errs

    # Confirmation email with invite link and a signed leave link
    new = emails()[before:]
    to = new[0]["to"] if new else None
    assert len(new) == 1 and to in ("priya@example.com", ["priya@example.com"]), new
    html = new[0]["html"]
    assert f"/r/{code}" in html and "San Francisco Bay Area" in html
    leave = re.search(r'href="(http://localhost:3123/api/waitlist/leave[^"]+)"', html).group(1).replace("&amp;", "&")

    # Same email again: same code, no second email, says "already"
    s, j = api_join({"email": "PRIYA@example.com", "adult": True})
    assert s == 200 and j["already"] and j["refCode"] == code, j
    assert len(emails()) == before + 1

    # Server-side checks
    assert api_join({"email": "nope", "adult": True})[0] == 400
    assert api_join({"email": "kid@example.com"})[0] == 400
    s, j = api_join({"email": "bot@example.com", "adult": True, "website": "spam.example"})
    assert s == 200 and psql("select count(*) from waitlist where email='bot@example.com'") == "0"

    # Rate limit: at most 5 new sign-ups per network per hour
    codes = [api_join({"email": f"fill{i}@example.com", "adult": True}, ip="198.51.100.7")[0] for i in range(6)]
    assert codes == [200] * 5 + [429], codes
    assert psql("select count(distinct ip_hash) from waitlist where email like 'fill%'") == "1"
    assert psql("select count(*) from waitlist where ip_hash like '%198.51%'") == "0"  # a salted hash, never the raw IP

    # A tampered leave link does nothing; the real one removes her
    bad = leave.replace("t=", "t=x")
    urllib.request.urlopen(bad)
    assert psql("select count(*) from waitlist where email='priya@example.com'") == "1"
    pg.goto(leave)
    expect(pg.get_by_role("heading", name="You've left the list")).to_be_visible()
    assert psql("select count(*) from waitlist where email='priya@example.com'") == "0"

    # Laptop layout. One location method (same as the app's setup): nothing is guessed from the network;
    # "Use my location" asks the browser once (here Frisco, TX).
    wide = browser.new_context(viewport={"width": 1600, "height": 1250}, geolocation={"latitude": 33.1507, "longitude": -96.8236}, permissions=["geolocation"],
                               extra_http_headers={"x-vercel-ip-latitude": "33.5779", "x-vercel-ip-longitude": "-101.8552"}).new_page()
    wide.goto(B + "/")
    expect(wide.get_by_role("heading", name="Join the waitlist")).to_be_visible()
    expect(wide.get_by_label("Current city")).to_have_value("")                      # no Lubbock guess from the network
    wide.get_by_role("button", name="Use my location").click()
    expect(wide.get_by_label("Current city")).to_have_value("Frisco, TX")
    expect(wide.get_by_text("We're starting in")).to_have_count(0)        # Dallas area: no "not here yet" note
    # Keyboard: ↓ then Enter picks a hometown suggestion
    wide.get_by_label("Hometown").fill("Bangalore"); expect(wide.get_by_role("option").first).to_be_visible()
    wide.get_by_label("Hometown").press("ArrowDown"); wide.get_by_label("Hometown").press("Enter")
    expect(wide.get_by_label("Hometown")).to_have_value("Bengaluru, Karnataka")
    wide.get_by_label("Hometown").fill("")
    far = browser.new_context(viewport={"width": 1440, "height": 900}, geolocation={"latitude": 33.5779, "longitude": -101.8552}, permissions=["geolocation"]).new_page()
    far.goto(B + "/"); far.get_by_role("button", name="Use my location").click()
    expect(far.get_by_text(re.compile("We're starting in Dallas-Fort Worth. Join anyway"))).to_be_visible()   # Lubbock visitor
    far.context.close()
    wide.wait_for_load_state("networkidle")
    wide.screenshot(path=f"{OUT}/waitlist-laptop.png", full_page=True)
    wide.get_by_role("link", name="Privacy policy").first.click()
    expect(wide.get_by_role("heading", name="Privacy policy")).to_be_visible()

    # ── Before launch, a stranger who signs in is sent back to the waitlist ──
    status, _ = api_join({"email": "stranger@example.com", "hometown": "Jaipur", "adult": True}, ip="203.0.113.77"); assert status == 200, status
    psql("update waitlist set place_id = (select id from places where city = 'Jaipur' and country = 'India'), area_id = (select id from areas where name = 'Garland' and state = 'TX'), first_name = 'Sam' where email = 'stranger@example.com'")
    s_ctx, S = sign_in(browser, "stranger@example.com", heading="Beta tester sign in")
    # (sign_in typed the code already; the login screen said "Beta tester sign in" before launch)
    expect(S).to_have_url(re.compile(r"/\?notyet=1$"))
    expect(S.get_by_text("isn't open for everyone yet")).to_be_visible()
    expect(S.get_by_label("Email", exact=True)).to_have_value("stranger@example.com")
    S.goto(B + "/people"); expect(S).to_have_url(re.compile(r"/\?notyet=1$"))

    # ── The founder's first time: beta tester first (so setup is allowed), then admin ──
    a_ctx, A = sign_in(browser, "admin@example.com", "/people")
    expect(A).to_have_url(re.compile(r"/\?notyet=1$"))
    psql("insert into beta_testers values ('admin@example.com')")
    A.goto(B + "/setup"); finish_setup(A, "Founder")
    psql(f"insert into admins values ('{uid('admin@example.com')}')")
    A.goto(B + "/admin")
    A.get_by_role("button", name=re.compile("^Waitlist")).click()
    expect(A.get_by_text("Pre-launch: waitlist only")).to_be_visible()
    A.get_by_label("Beta tester email").fill("Stranger@Example.com")
    A.get_by_role("button", name="Add", exact=True).click()
    expect(A.get_by_text("stranger@example.com", exact=True)).to_be_visible()
    A.screenshot(path=f"{OUT}/admin-waitlist.png", full_page=True)
    with A.expect_download() as d:
        A.get_by_role("button", name="Download CSV").click()
    assert "fill0@example.com" in open(d.value.path()).read()

    S.goto(B + "/setup"); expect(S).to_have_url(re.compile(r"/setup$"))   # beta tester gets in
    # Setup starts with the hometown, city and first name from the waitlist
    expect(S.get_by_text("Jaipur").first).to_be_visible()
    S.get_by_role("button", name="Continue").click()
    for i in ["Tennis", "Cricket", "Chai meetups"]: S.get_by_role("button", name=i, exact=True).click()
    S.get_by_role("button", name="Continue").click()
    expect(S.get_by_text("Garland").first).to_be_visible()
    S.get_by_role("button", name="Continue").click()
    expect(S.get_by_label("First name")).to_have_value("Sam")
    S.screenshot(path=f"{OUT}/setup-prefilled-you.png")
    expect(S.get_by_role("button", name="Finish")).to_be_disabled()    # 18+ still required; photo is not
    S.get_by_role("checkbox").check(); expect(S.get_by_role("button", name="Finish")).to_be_enabled()
    S.get_by_role("button", name="Finish").click()
    expect(S.get_by_role("heading", name=re.compile("You're in"))).to_be_visible()
    S.goto(B + "/people"); expect(S.get_by_role("region", name="Add a photo")).to_be_visible()
    S.screenshot(path=f"{OUT}/people-photo-tip.png")

    A.get_by_role("button", name="Open Nayboro to everyone").click()
    A.get_by_role("button", name="Yes, open Nayboro").click()
    expect(A.get_by_text("Nayboro is open to everyone")).to_be_visible()
    assert psql("select value from app_settings where key='site_mode'") == '"open"'

    fresh = browser.new_context().new_page()
    fresh.goto(B + "/")
    expect(fresh.get_by_role("heading", name="Join the waitlist")).to_have_count(0)
    expect(fresh.get_by_role("link", name=re.compile("Get started|Sign up|Join", re.I)).first).to_be_visible()

    browser.close()

psql("delete from profiles where id::text not like 'd0000000%'; delete from auth.users where id::text not like 'd0000000%'; delete from admins;")
print("waitlist flow: all checks passed")
