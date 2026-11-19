"""End-to-end test of every main screen with two real users in separate browsers.
Run from the repo root via e2e/run.sh (needs the local stand-in for Supabase + demo data).

Neeraj (Jaipur → Garland) gets the mockup's starting state: 3 hellos, a chat with Aman.
Sana is a second real user. Neeraj says hi to Sana, Sana accepts, they chat both ways.
"""
import os, re, subprocess, uuid
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3123"
OUT = "e2e/out"
os.makedirs(OUT, exist_ok=True)
psql = lambda sql: subprocess.run(["psql", "-d", "e2e", "-qtAc", sql], check=True, capture_output=True, text=True).stdout.strip()
uid = lambda email: str(uuid.uuid5(uuid.NAMESPACE_URL, email))
shots = []

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
    pg.get_by_label("Your city or ZIP").fill(city_zip); pg.get_by_role("button", name=re.compile(r", TX$")).first.click()
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
    expect(A.get_by_text("Near Garland · 6 from Jaipur around DFW")).to_be_visible()
    expect(main.get_by_text("Said hi to you")).to_be_visible()
    expect(main).to_contain_text("Need one more for Sunday cricket. You in?")
    expect(main.get_by_text("SUGGESTED FOR YOU")).to_be_visible()
    expect(A.get_by_role("link", name="Chats").get_by_text("4")).to_be_visible()   # 3 hellos + 1 unread chat
    shot(A, "s01_people")
    A.get_by_role("button", name=re.compile(r"^Jaipur · 6$")).click()
    expect(main.get_by_text("FROM JAIPUR, AROUND DFW")).to_be_visible()
    expect(main.get_by_role("link", name=re.compile("Kavya S\\."))).to_be_visible()
    A.get_by_role("button", name="For you").click()

    # Rohit's profile: Rajasthan in common, tennis in common
    A.goto(B + "/p/d0000000-0000-0000-0000-000000000001")
    expect(A.get_by_role("heading", name="Rohit G.")).to_be_visible()
    expect(A.get_by_text("Both from Rajasthan")).to_be_visible()
    expect(A.get_by_text("Both play tennis")).to_be_visible()
    shot(A, "s02_profile")
    A.get_by_role("button", name="Say hi to Rohit").click()
    A.get_by_role("button", name="Up for tennis this weekend?").click()
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
    shot(A, "s07_explore")
    A.get_by_role("button", name=re.compile(r"^Unanswered")).click()
    tiffin = A.locator("article:visible").filter(has_text="Any good tiffin service in Plano?")
    tiffin.get_by_role("button", name="Answer").click()
    A.get_by_label("Answer", exact=True).fill("Try the home kitchen near Legacy and Coit, they deliver lunch boxes.")
    A.get_by_role("button", name="Post answer").click()
    expect(A.get_by_text("Answer posted")).to_be_visible()
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

    # Ask an anonymous question
    A.goto(B + "/explore/ask")
    A.get_by_label("Your question").fill("Any weekend cricket groups around Garland?")
    expect(A.get_by_text("Suggested from your question.")).to_be_visible()
    A.get_by_role("button", name="Post anonymously").click()
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
    expect(Bp.get_by_text("This page could not be found.")).to_be_visible()
    expect(Bp.locator("body")).not_to_contain_text("Firewheel")

    print("SCREENS: ALL STEPS PASSED")
    print("page errors:", (a_errs + b_errs) or "none")
    print("screens:", ", ".join(shots))
    browser.close()
