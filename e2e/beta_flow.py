"""Private beta site (BETA_SITE=1): a sign-in page instead of the waitlist form, testers only,
not indexed by search engines. Run from the repo root via e2e/run.sh (after the other flows).
"""
import os, re, subprocess, urllib.request, uuid
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3123"
OUT = "e2e/out"
psql = lambda sql: subprocess.run(["psql", "-d", "e2e", "-qtAc", sql], check=True, capture_output=True, text=True).stdout.strip()

psql("update app_settings set value='\"waitlist\"' where key='site_mode'; delete from beta_testers;")
psql("insert into beta_testers values ('neeraj@example.com')")

# Not indexed, and the waitlist API isn't served here.
with urllib.request.urlopen(B + "/") as r:
    assert "noindex" in (r.headers.get("X-Robots-Tag") or ""), r.headers.get("X-Robots-Tag")

def sign_in(browser, email):
    ctx = browser.new_context(viewport={"width": 400, "height": 860})
    pg = ctx.new_page()
    pg.goto(B + "/")
    expect(pg.get_by_role("heading", name="You're early.")).to_be_visible()
    expect(pg.get_by_label("Email", exact=True)).to_have_count(0)          # no waitlist form here
    expect(pg.get_by_role("link", name="Join the waitlist")).to_have_attribute("href", "https://nayboro.example")
    pg.get_by_role("link", name="Beta tester sign in").click()
    expect(pg.get_by_role("heading", name="Beta tester sign in")).to_be_visible()
    pg.get_by_label("Email", exact=True).fill(email); pg.get_by_role("button", name="Send me a code").click()
    pg.get_by_label("6-digit code").fill("123456")
    return ctx, pg

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)

    # Someone not on the list is turned away kindly.
    s_ctx, S = sign_in(browser, "someone@example.com")
    expect(S).to_have_url(re.compile(r"/\?notyet=1$"))
    expect(S.locator("main").get_by_role("alert")).to_contain_text("someone@example.com isn't on the beta tester list yet")
    S.screenshot(path=f"{OUT}/beta-not-listed.png")
    S.goto(B + "/people"); expect(S).to_have_url(re.compile(r"/\?notyet=1$"))

    # A beta tester gets in.
    t_ctx, T = sign_in(browser, "neeraj@example.com")
    expect(T).to_have_url(re.compile(r"/(people|setup)$"))
    T.goto(B + "/people"); expect(T.get_by_role("heading", name="People", exact=True)).to_be_visible()

    G = browser.new_context(viewport={"width": 400, "height": 860}).new_page()
    G.goto(B + "/"); expect(G.get_by_role("heading", name="You're early.")).to_be_visible(); G.screenshot(path=f"{OUT}/beta-home.png")
    browser.close()

psql("update app_settings set value='\"open\"' where key='site_mode'")
print("beta flow: all checks passed")
