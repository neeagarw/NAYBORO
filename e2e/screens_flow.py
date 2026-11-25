"""End-to-end test of every main screen with two real users in separate browsers.
Run from the repo root via e2e/run.sh (needs the local stand-in for Supabase + demo data).

Neeraj (Jaipur → Garland) gets the mockup's starting state: 3 hellos, a chat with Aman.
Sana is a second real user. Neeraj says hi to Sana, Sana accepts, they chat both ways.
"""
import json, os, re, subprocess, urllib.error, urllib.parse, urllib.request, uuid
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3123"
OUT = "e2e/out"
os.makedirs(OUT, exist_ok=True)
psql = lambda sql: subprocess.run(["psql", "-d", "e2e", "-qtAc", sql], check=True, capture_output=True, text=True).stdout.strip()
uid = lambda email: str(uuid.uuid5(uuid.NAMESPACE_URL, email))
shots = []

def dispatch(secret="whsec_test"):
    """What the Supabase webhook does: ask the app to send queued email alerts."""
    req = urllib.request.Request(B + "/api/notifications/dispatch", method="POST", headers={"x-webhook-secret": secret})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, None

def emails():
    try: return [json.loads(l) for l in open(f"{OUT}/emails.jsonl")]
    except FileNotFoundError: return []

def shot(pg, name):
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/{name}.png")
    shots.append(name)

def join(browser, email, first, last, town, interests, city_zip):
    ctx = browser.new_context(viewport={"width": 400, "height": 860})
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/login?next=/setup")
    pg.get_by_label("Email").fill(email); pg.get_by_role("button", name="Send me a code").click()
    pg.get_by_label("6-digit code").fill("123456"); expect(pg).to_have_url(re.compile(r"/setup$"))
    pg.get_by_label("Hometown").fill(town[:3]); pg.get_by_role("button", name=re.compile("^" + town)).first.click()
    pg.get_by_role("button", name="Continue").click()
    for i in interests: pg.get_by_role("button", name=i, exact=True).click()
    pg.get_by_role("button", name="Continue").click()
    pg.get_by_role("button", name="Type a city or ZIP instead").click()
    pg.get_by_label("Your city or ZIP").fill(city_zip); pg.get_by_role("button", name=re.compile(r", TX " + city_zip)).first.click()
    pg.get_by_role("button", name="Continue").click()
    pg.get_by_label("First name").fill(first); pg.get_by_label("Last name").fill(last)
    pg.get_by_role("checkbox").check(); pg.get_by_role("button", name="Finish").click()
    expect(pg.get_by_role("heading", name=re.compile("You're in"))).to_be_visible()
    return ctx, pg, errs

psql("delete from profiles where id::text not like 'd0000000%'; delete from auth.users where id::text not like 'd0000000%';")
psql("delete from hidden_suggestions; delete from blocks; delete from reports; delete from contact_messages;")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)

    # ── Neeraj joins, gets the mockup's starting state ──
    a_ctx, A, a_errs = join(browser, "neeraj@example.com", "Neeraj", "Agarwala", "Jaipur", ["Tennis", "Cricket", "Chai meetups"], "75040")
    psql(f"select demo_welcome('{uid('neeraj@example.com')}')")

    # People
    A.goto(B + "/people")
    main = A.locator("main:visible")
    expect(A.get_by_text("Near Garland · 6 from Jaipur around Dallas–Fort Worth")).to_be_visible()
    expect(main.get_by_text("Said hi to you")).to_be_visible()
    expect(main).to_contain_text("Need one more for Sunday cricket. You in?")
    expect(main.get_by_text("SUGGESTED FOR YOU")).to_be_visible()
    expect(A.get_by_role("link", name="Chats").get_by_text("4")).to_be_visible()   # 3 hellos + 1 unread chat
    shot(A, "s01_people")
    A.get_by_role("button", name=re.compile(r"^Jaipur · 6$")).click()
    expect(main.get_by_text("FROM JAIPUR, AROUND DALLAS–FORT WORTH")).to_be_visible()
    expect(main.get_by_role("link", name=re.compile("Kavya S\\.")).first).to_be_visible()
    A.get_by_role("button", name="For you").click()

    # Rohit's profile: Rajasthan in common, tennis in common
    A.goto(B + "/p/d0000000-0000-0000-0000-000000000001")
    expect(A.get_by_role("heading", name="Rohit G.")).to_be_visible()
    expect(A.get_by_text("Both from Rajasthan")).to_be_visible()
    expect(A.get_by_text("Both play tennis")).to_be_visible()
    expect(A.get_by_text("Phone verified")).to_have_count(0)        # hidden until phone sign-in exists
    shot(A, "s02_profile")
    A.get_by_role("button", name="Say hi to Rohit").click()
    A.get_by_role("button", name="Up for tennis this weekend?").click()
    expect(A.get_by_text("27/200")).to_be_visible()                  # character count
    shot(A, "s03_say_hi")
    A.get_by_role("button", name="Send hello").click()
    expect(A.get_by_role("button", name="Hello sent")).to_be_visible()

    # Chats: 3 hellos, Aman unread, Ananya + Rohit waiting
    A.goto(B + "/chats")
    main = A.locator("main:visible")
    expect(main.get_by_text("SAID HI TO YOU · 3")).to_be_visible()
    expect(main).to_contain_text("The Firewheel courts are usually free early.")
    expect(main.get_by_text("WAITING FOR A REPLY")).to_be_visible()
    expect(main).to_contain_text("Rohit G.")
    shot(A, "s04_chats")

    # Accept Kavya → opens chat, send a message
    A.locator("section:visible").filter(has_text="Kavya S.").get_by_role("button", name="Accept").click()
    expect(A).to_have_url(re.compile(r"/chats/[0-9a-f-]{36}$"))
    expect(A.get_by_text("You're connected. Say hello!")).to_be_visible()
    A.get_by_label("Message").fill("Hi Kavya! Chai this weekend in Frisco?"); A.keyboard.press("Enter")
    expect(A.locator("main:visible").get_by_text("Hi Kavya! Chai this weekend in Frisco?")).to_be_visible()

    # Chat with Aman (mockup thread)
    A.goto(B + "/chats")
    A.locator("main:visible").get_by_role("link", name=re.compile("Aman K\\.")).click()
    expect(A.get_by_text("You both play tennis in Garland")).to_be_visible()
    expect(A.locator("main:visible")).to_contain_text("Tennis next Saturday at 8?")
    # Opening a chat really marks it read in the database (the badge counts from there)
    unread_sql = f"""select count(*) from conversation_members m where m.profile_id='{uid('neeraj@example.com')}'
      and exists (select 1 from messages x where x.conversation_id=m.conversation_id and x.sender_id<>m.profile_id and x.created_at>m.last_read_at)"""
    for _ in range(20):
        if psql(unread_sql) == "0": break
        A.wait_for_timeout(250)
    assert psql(unread_sql) == "0", "opening a chat should mark it read"
    A.get_by_label("Message").fill("Sounds good, see you at 8!"); A.get_by_role("button", name="Send").click()
    expect(A.locator("main:visible").get_by_text("Sounds good, see you at 8!")).to_be_visible()
    shot(A, "s05_chat")
    A.get_by_role("button", name="Safety tips").click(); expect(A.get_by_role("dialog", name="Chatting safely")).to_be_visible(); shot(A, "s06_safety")
    A.get_by_role("button", name="Got it").click()
    A.get_by_role("button", name="More options for this chat").click(); A.get_by_role("button", name="Mute chat").click()
    expect(A.get_by_text("Chat muted.")).to_be_visible()
    assert psql(f"select muted from conversation_members where profile_id='{uid('neeraj@example.com')}' and muted") == "t"

    # Explore: questions
    A.goto(B + "/explore")
    main = A.locator("main:visible")
    expect(main.get_by_text("Where can I get fresh methi and curry leaves near Garland?")).to_be_visible()
    h1b = A.locator("article:visible").filter(has_text="Laid off on H-1B")
    expect(h1b).to_contain_text("Anonymous · Garland area")
    expect(h1b.get_by_text("From Rajasthan")).to_be_visible()          # Vikram shares Neeraj's region
    expect(h1b.locator("div").first.get_by_role("link")).to_have_count(0)   # anonymous author: no profile link
    shot(A, "s07_explore")
    # Instagram-style top bar: hides while scrolling down, comes back on the first scroll up
    title = A.get_by_role("heading", name="Explore", level=1)
    A.set_viewport_size({"width": 390, "height": 600})
    box = "main:visible >> xpath=.."
    A.locator(box).evaluate("el => el.scrollTo(0, 400)"); A.wait_for_timeout(400)
    assert A.locator(box).evaluate("el => el.scrollTop") > 100, "explore column should scroll"
    assert title.evaluate("h => h.getBoundingClientRect().bottom") <= 0, "top bar should hide on scroll down"
    A.locator(box).evaluate("el => el.scrollTo(0, 380)"); A.wait_for_timeout(30)
    part = title.evaluate("h => h.closest('.sticky').getBoundingClientRect().bottom")
    assert part > 0, "top bar should start sliding back with the first pixels of scrolling up"
    A.locator(box).evaluate("el => el.scrollTo(0, 300)"); A.wait_for_timeout(400)
    assert title.evaluate("h => h.getBoundingClientRect().top") >= 0, "top bar should come back on scroll up"
    A.locator(box).evaluate("el => el.scrollTo(0, 0)")
    A.set_viewport_size({"width": 400, "height": 860})
    # Tapping a question author's name opens their profile
    methi = A.locator("article:visible").filter(has_text="Where can I get fresh methi")
    methi.locator("div").first.get_by_role("link").first.click()
    expect(A).to_have_url(re.compile(r"/p/[0-9a-f-]{36}$"))
    A.goto(B + "/explore")
    unans = A.get_by_role("button", name=re.compile(r"^Unanswered"))
    before = int(re.sub(r"\D", "", unans.inner_text()) or 0); assert before >= 1, before
    unans.click()
    tiffin = A.locator("article:visible").filter(has_text="Any good tiffin service in Plano?")
    tiffin.get_by_role("button", name="Answer").click()
    A.get_by_label("Answer", exact=True).fill("Try the home kitchen near Legacy and Coit, they deliver lunch boxes.")
    A.get_by_role("button", name="Post answer").click()
    expect(A.get_by_text("Answer posted")).to_be_visible()
    # The Unanswered badge drops right away and matches the list
    expect(unans).to_have_text("Unanswered" if before == 1 else f"Unanswered{before - 1}")
    A.locator("nav:visible").get_by_role("link", name="People").click(); expect(A).to_have_url(re.compile(r"/people$")); A.locator("nav:visible").get_by_role("link", name="Explore").click(); expect(A).to_have_url(re.compile(r"/explore$"))
    expect(unans).to_have_text("Unanswered" if before == 1 else f"Unanswered{before - 1}")
    A.get_by_role("button", name="All", exact=True).click()
    expect(A.locator("article:visible").filter(has_text="Any good tiffin service in Plano?")).to_contain_text("Try the home kitchen")

    # Explore: events
    A.get_by_role("tab", name="Events").click()
    expect(A).to_have_url(re.compile(r"tab=events"))
    cricket = A.locator("article:visible").filter(has_text="Saturday morning cricket meetup")
    expect(cricket).to_contain_text("Be one of the first")            # 3 interested is hidden (rule 4)
    popup = A.locator("article:visible").filter(has_text="Rajasthani food pop-up")
    expect(popup).to_contain_text("13 interested")
    cricket.get_by_role("button", name=re.compile("I'm interested")).click()
    expect(cricket.get_by_role("button", name=re.compile("Interested"))).to_have_attribute("aria-pressed", "true")
    shot(A, "s08_events")

    # Typing with real key presses keeps every space (Ask and Help once dropped the first one)
    A.goto(B + "/explore/ask")
    A.get_by_label("Your question").click(); A.keyboard.type("Test hi there friends", delay=40)
    expect(A.get_by_label("Your question")).to_have_value("Test hi there friends")
    A.goto(B + "/help")
    msg = A.locator("textarea:visible").first
    msg.click(); A.keyboard.type("Test validation only do not send", delay=40)
    expect(msg).to_have_value("Test validation only do not send")

    # Ask an anonymous question
    A.goto(B + "/explore/ask")
    A.get_by_label("Your question").fill("Any weekend cricket groups around Garland?")
    expect(A.get_by_text("Suggested from your question.")).to_be_visible()
    A.get_by_role("button", name="Anonymous").click()
    expect(A.get_by_text("Garland area · name and hometown hidden")).to_be_visible()
    shot(A, "s09_ask")
    A.get_by_role("button", name="Post question").click()
    expect(A).to_have_url(re.compile(r"/explore$"))
    expect(A.locator("article:visible").first).to_contain_text("You (anonymous)")
    # Selling is refused
    A.goto(B + "/explore/ask")
    A.get_by_label("Your question").fill("Selling my car, whatsapp me for price")
    expect(A.get_by_text("This looks like selling or an ad.")).to_be_visible()
    expect(A.get_by_role("button", name="Post question")).to_be_disabled()

    # Help
    A.goto(B + "/help?topic=event")
    expect(A.get_by_role("button", name="Suggest an event")).to_have_attribute("aria-pressed", "true")
    expect(A.get_by_label("Reply to")).to_have_value("neeraj@example.com")
    A.get_by_label("Your message").fill("Diwali mela at Frisco Commons on Dec 5, frisco.org/mela")
    shot(A, "s10_help")
    A.get_by_role("button", name="Send message").click()
    expect(A.get_by_text("Thanks, we got it")).to_be_visible()
    assert psql("select count(*) from contact_messages where topic='event'") == "1"

    # Block Vikram from his profile → gone from People and his hello disappears
    A.goto(B + "/p/d0000000-0000-0000-0000-000000000008")
    A.get_by_role("button", name="More options for Vikram").click(); A.get_by_role("button", name="Block Vikram").click()
    A.get_by_role("button", name="Block Vikram").click()
    expect(A).to_have_url(re.compile(r"/people$"))
    expect(A.locator("main:visible")).not_to_contain_text("Vikram")
    A.goto(B + "/chats"); expect(A.locator("main:visible")).not_to_contain_text("Vikram")
    # Report Arjun
    A.goto(B + "/p/d0000000-0000-0000-0000-000000000006")
    A.get_by_role("button", name="More options for Arjun").click(); A.get_by_role("button", name="Report Arjun").click()
    A.get_by_role("button", name="Fake profile").click(); expect(A.get_by_text("Our team will review this.")).to_be_visible()
    assert psql("select count(*) from reports where reason='Fake profile'") == "1"

    # ── Second real user: Sana (Jaipur → Plano) ──
    b_ctx, Bp, b_errs = join(browser, "sana@example.com", "Sana", "Mehra", "Jaipur", ["Tennis", "Book club", "Chai meetups"], "75023")
    sana = uid("sana@example.com")
    A.goto(B + f"/p/{sana}")
    expect(A.get_by_text("Both from Jaipur")).to_be_visible()
    A.get_by_role("button", name="Say hi to Sana").click()
    A.get_by_label("Your message").fill("Hi Sana! Fellow Jaipur person, tennis sometime?")
    A.get_by_role("button", name="Send hello").click(); expect(A.get_by_role("button", name="Hello sent")).to_be_visible()

    Bp.goto(B + "/chats")
    sec = Bp.locator("section:visible").filter(has_text="Neeraj A.")
    expect(sec).to_contain_text("Also from Jaipur")
    expect(sec).to_contain_text("Fellow Jaipur person, tennis sometime?")
    shot(Bp, "s11_sana_hello")
    sec.get_by_role("button", name="Accept").click()
    expect(Bp).to_have_url(re.compile(r"/chats/[0-9a-f-]{36}$"))
    Bp.get_by_label("Message").fill("Yes! Saturday morning works."); Bp.keyboard.press("Enter")
    expect(Bp.locator("main:visible").get_by_text("Yes! Saturday morning works.")).to_be_visible()

    A.goto(B + "/chats")
    row = A.locator("main:visible").get_by_role("link", name=re.compile("Sana M\\."))
    expect(row).to_contain_text("Yes! Saturday morning works.")
    row.click()
    expect(A.locator("main:visible").get_by_text("Yes! Saturday morning works.")).to_be_visible()
    A.get_by_label("Message").fill("Great, Firewheel at 8?"); A.keyboard.press("Enter")
    Bp.reload(); expect(Bp.locator("main:visible").get_by_text("Great, Firewheel at 8?")).to_be_visible()
    shot(Bp, "s12_sana_chat")

    # Sana can't open Neeraj's chat with Aman (not a member) → 404
    aman_conv = psql(f"select conversation_id from conversation_members where profile_id='d0000000-0000-0000-0000-000000000003' limit 1")
    Bp.goto(B + f"/chats/{aman_conv}")
    expect(Bp.get_by_role("heading", name="We couldn't find that")).to_be_visible()
    expect(Bp.locator("body")).not_to_contain_text("Firewheel")

    # ── Email alerts ──
    assert dispatch("wrong")[0] == 401
    psql("update notifications set sent_at = now() where sent_at is null")  # ignore alerts to demo people
    A.goto(B + f"/p/{sana}")
    # (Neeraj already said hi to Sana above and she accepted; send fresh activity for the alert test)
    q = psql(f"insert into questions (author_id, body, topic) values ('{sana}', 'Best place for chai near Plano on weekends?', 'Food') returning id")
    A.goto(B + "/explore")
    A.locator("article:visible").filter(has_text="Best place for chai near Plano").get_by_role("button", name="Answer").click()
    A.get_by_label("Answer", exact=True).fill("Try the cafe on 15th Street, great masala chai.")
    A.get_by_role("button", name="Post answer").click(); expect(A.get_by_text("Answer posted")).to_be_visible()
    status, res = dispatch()
    assert status == 200 and res["emails"] == 1, res
    mail = emails()[-1]
    assert mail["to"] == ["sana@example.com"] and mail["subject"] == "Neeraj A. answered your question on Nayboro", mail["subject"]
    assert "Best place for chai near Plano" in mail["html"] and "Turn off email alerts" in mail["html"]
    assert dispatch()[1]["emails"] == 0                                # each alert goes out once
    # Unsubscribe from the email link (and a tampered link is refused)
    link = re.search(r'href="(http://localhost:3123/api/unsubscribe[^"]+)"', mail["html"]).group(1).replace("&amp;", "&")
    Bp.goto(link[:-3] + "xyz"); expect(Bp.get_by_role("heading", name="That link didn't work")).to_be_visible()
    assert psql(f"select email_alerts from profiles where id='{sana}'") == "t"
    Bp.goto(link); expect(Bp.get_by_role("heading", name="Email alerts are off")).to_be_visible()
    assert psql(f"select email_alerts from profiles where id='{sana}'") == "f"
    shot(Bp, "s13_unsubscribed")
    # Hello + accepted alerts, grouped into one email per person
    psql(f"update profiles set email_alerts = true where id='{sana}'")
    rid = psql("select id from profiles where id::text like 'd0000000%' and first_name='Rohit'")
    psql(f"insert into hellos (from_id, to_id, message) values ('{rid}', '{sana}', 'Hi Sana, doubles on Saturday?')")
    psql(f"insert into hellos (from_id, to_id, message) values ('d0000000-0000-0000-0000-000000000007', '{sana}', 'Hello from a fellow Jaipurite!')")
    status, res = dispatch()
    mail = emails()[-1]
    assert res["emails"] == 1 and mail["subject"] == "2 people said hi on Nayboro", (res, mail["subject"])
    assert "Hi Sana, doubles on Saturday?" in mail["text"]

    # ── Spam limit shows a friendly message ──
    me = uid("neeraj@example.com")
    psql(f"insert into questions (author_id, body) select '{me}', 'Filler question number ' || g from generate_series(1,4) g")
    A.goto(B + "/explore/ask")
    A.get_by_label("Your question").fill("Any badminton courts open late in Garland?")
    A.get_by_role("button", name="Post question").click()
    expect(A.get_by_text("You have asked 5 questions today. Try again tomorrow.")).to_be_visible()

    # ── Report a question, then moderate it in Admin ──
    A.goto(B + "/explore")
    jalebi = A.locator("article:visible").filter(has_text="fresh jalebi")
    jalebi.get_by_role("button", name="Report this question").click()
    A.get_by_role("button", name="Selling or advertising").click(); expect(A.get_by_text("Our team will review this.")).to_be_visible()
    # Non-admins can't open Admin
    Bp.goto(B + "/admin"); expect(Bp.get_by_role("heading", name="We couldn't find that")).to_be_visible()
    psql(f"insert into admins values ('{me}')")
    A.goto(B + "/people")
    A.get_by_role("button", name="Your account").click(); A.get_by_role("link", name="Admin").click()
    expect(A).to_have_url(re.compile(r"/admin$"))
    rep = A.locator("article:visible").filter(has_text="fresh jalebi")
    expect(rep).to_contain_text("Selling or advertising")
    expect(A.locator("article:visible").filter(has_text="Arjun")).to_contain_text("Fake profile")
    shot(A, "s14_admin_reports")
    rep.get_by_role("button", name="Hide question").click(); expect(A.get_by_text("Hidden from everyone")).to_be_visible()
    A.on("dialog", lambda d: d.accept())
    A.locator("article:visible").filter(has_text="Arjun").get_by_role("button", name="Pause account").click()
    expect(A.get_by_text("Arjun Mehta paused")).to_be_visible()
    A.get_by_role("button", name=re.compile(r"^Paused · 1")).click()
    expect(A.locator("main:visible")).to_contain_text("Arjun Mehta")
    A.get_by_role("button", name=re.compile(r"^Messages")).click()
    expect(A.locator("main:visible")).to_contain_text("Diwali mela at Frisco Commons")
    A.get_by_role("button", name="Mark done").first.click(); expect(A.get_by_text("Marked done")).to_be_visible()
    A.get_by_role("button", name=re.compile(r"^Events")).click()
    A.get_by_label("Title").fill("Garba night at Plano Event Center")
    A.get_by_label("Starts").fill("2026-12-12T19:00")
    A.get_by_label("Place").fill("Plano Event Center")
    A.get_by_label("City").fill("Plano"); A.get_by_role("option", name=re.compile(r"^Plano, TX")).click()
    A.get_by_label("Kind").select_option("Festival"); A.get_by_label("Price").fill("$20")
    A.get_by_label("Organiser").fill("DFW Garba Collective"); A.get_by_label("Link to details").fill("https://example.com/garba")
    shot(A, "s15_admin_event")
    A.get_by_role("button", name="Add event").click(); expect(A.get_by_text("Event added")).to_be_visible()
    # Effects for everyone else
    Bp.goto(B + "/explore")
    expect(Bp.locator("main:visible")).not_to_contain_text("fresh jalebi")
    Bp.goto(B + "/explore?tab=events"); expect(Bp.locator("main:visible")).to_contain_text("Garba night at Plano Event Center")
    Bp.goto(B + "/people"); expect(Bp.locator("main:visible")).not_to_contain_text("Arjun")
    Bp.goto(B + "/explore")
    expect(Bp.locator("main:visible")).not_to_contain_text("Count me in! What time do you start?")   # paused person's answer gone

    # ── Nationwide: someone in Fremont, CA uses "Find my city" ──
    c_ctx = browser.new_context(viewport={"width": 400, "height": 860}, geolocation={"latitude": 37.5485, "longitude": -121.9886}, permissions=["geolocation"])
    C = c_ctx.new_page()
    C.goto(B + "/login?next=/setup")
    C.get_by_label("Email").fill("maya@example.com"); C.get_by_role("button", name="Send me a code").click()
    C.get_by_label("6-digit code").fill("123456"); expect(C).to_have_url(re.compile(r"/setup$"))
    C.get_by_label("Hometown").fill("Pun"); C.get_by_role("button", name=re.compile("^Pune")).first.click(); C.get_by_role("button", name="Continue").click()
    for i in ["Running", "Cooking", "Book club"]: C.get_by_role("button", name=i, exact=True).click()
    C.get_by_role("button", name="Continue").click()
    C.get_by_role("button", name="Find my city").click()
    expect(C.get_by_text("You're in Fremont, CA")).to_be_visible()
    expect(C.get_by_text("Part of San Francisco Bay Area")).to_be_visible()
    shot(C, "s17_fremont_found")
    # Typing works for any US city or ZIP too
    C.get_by_role("button", name="Not right? Type a city or ZIP").click()
    C.get_by_label("Your city or ZIP").fill("San Jo")
    expect(C.get_by_role("button", name=re.compile(r"San Jose, CA"))).to_contain_text("San Francisco Bay Area")
    C.get_by_label("Your city or ZIP").fill("02139")
    expect(C.get_by_role("button", name=re.compile(r"Cambridge, MA 02139"))).to_contain_text("Boston area")
    shot(C, "s18_search_any_city")
    C.get_by_role("button", name=re.compile(r"San Jose, CA")).click() if C.get_by_role("button", name=re.compile(r"San Jose, CA")).count() else None
    C.get_by_label("Your city or ZIP").fill("Fremont"); C.get_by_role("button", name=re.compile(r"^Fremont, CA")).click()
    C.get_by_role("button", name="Continue").click()
    C.get_by_label("First name").fill("Maya"); C.get_by_role("checkbox").check(); C.get_by_role("button", name="Finish").click()
    expect(C.get_by_role("heading", name="You're in, Maya!")).to_be_visible()
    C.get_by_role("button", name="Start exploring").click(); expect(C).to_have_url(re.compile(r"/people$"))
    expect(C.get_by_text("Near Fremont")).to_be_visible()
    expect(C.locator("main:visible")).not_to_contain_text("Kavya")         # DFW people are a different community
    C.goto(B + "/explore"); expect(C.get_by_text("Around Fremont")).to_be_visible()
    expect(C.locator("main:visible")).not_to_contain_text("methi and curry leaves")   # DFW questions stay in DFW
    C.goto(B + "/explore/ask"); expect(C.get_by_role("button", name=re.compile("All of San Francisco Bay Area"))).to_be_visible()
    shot(C, "s19_bay_area_ask")
    # Sana (Plano) can't see Maya on People either
    Bp.goto(B + "/people"); expect(Bp.locator("main:visible")).not_to_contain_text("Maya")

    print("SCREENS: ALL STEPS PASSED")
    print("page errors:", (a_errs + b_errs) or "none")
    print("screens:", ", ".join(shots))
    browser.close()
