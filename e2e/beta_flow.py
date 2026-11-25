"""Private beta site (BETA_SITE=1): a sign-in page instead of the waitlist form, testers only,
not indexed by search engines. Run from the repo root via e2e/run.sh (after the other flows).
"""
import os, re, subprocess, urllib.request, urllib.error, uuid
from playwright.sync_api import sync_playwright, expect

B = "http://localhost:3123"
OUT = "e2e/out"
psql = lambda sql: subprocess.run(["psql", "-d", "e2e", "-qtAc", sql], check=True, capture_output=True, text=True).stdout.strip()

psql("update app_settings set value='\"waitlist\"' where key='site_mode'; delete from beta_testers;")
psql("insert into beta_testers values ('neeraj@example.com')")

# Not indexed, and the waitlist API isn't served here.
with urllib.request.urlopen(B + "/") as r:
    assert "noindex" in (r.headers.get("X-Robots-Tag") or ""), r.headers.get("X-Robots-Tag")
    # Security headers on every page
    assert "frame-ancestors 'none'" in (r.headers.get("Content-Security-Policy") or ""), r.headers.get("Content-Security-Policy")
    assert r.headers.get("X-Frame-Options") == "DENY" and r.headers.get("X-Content-Type-Options") == "nosniff"
    assert "camera=()" in (r.headers.get("Permissions-Policy") or "")

def sign_in(browser, email, code="TEST-CODE-42"):
    ctx = browser.new_context(viewport={"width": 400, "height": 860})
    pg = ctx.new_page()
    pg.goto(B + "/")
    expect(pg.get_by_role("heading", name="You're early.")).to_be_visible()
    expect(pg.get_by_label("Email", exact=True)).to_have_count(0)          # no waitlist form here
    expect(pg.get_by_role("link", name="Join the waitlist")).to_have_attribute("href", "https://nayboro.example")
    pg.get_by_role("link", name="Beta tester sign in").click()
    expect(pg.get_by_role("heading", name="Beta tester sign in")).to_be_visible()
    pg.get_by_label("Email", exact=True).fill(email)
    pg.get_by_label("Beta code").fill(code)
    pg.get_by_role("button", name="Sign in", exact=True).click()
    return ctx, pg

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME") or None)

    # Google sign-in that didn't finish (no code) comes back to sign-in with a clear message, and keeps "next"
    gpg = browser.new_context(viewport={"width": 400, "height": 860}).new_page()
    gpg.goto(B + "/auth/callback?next=/chats")
    expect(gpg).to_have_url(re.compile(r"/login\?error=google&next=%2Fchats$"))
    expect(gpg.locator("form").get_by_role("alert")).to_contain_text("Google sign-in didn't finish")
    expect(gpg.get_by_role("button", name="Continue with Google")).to_have_count(0)   # hidden until NEXT_PUBLIC_GOOGLE_SIGNIN=1

    # Wrong code: refused, no account made.
    w_ctx, W = sign_in(browser, "neeraj@example.com", code="nope")
    expect(W.locator("form").get_by_role("alert")).to_have_text("That beta code didn't work.")
    W.screenshot(path=f"{OUT}/beta-login.png")
    # Right code, but not on the tester list: refused too.
    s_ctx, S = sign_in(browser, "someone@example.com")
    expect(S.locator("form").get_by_role("alert")).to_have_text("This email isn't on the beta tester list yet.")
    assert psql("select count(*) from auth.users where email='someone@example.com'") == "0"
    S.goto(B + "/people"); expect(S).not_to_have_url(re.compile(r"/people$"))

    # A beta tester gets in (code is not case sensitive).
    t_ctx, T = sign_in(browser, "Neeraj@Example.com", code="test-code-42")
    expect(T).to_have_url(re.compile(r"/(people|setup)$"))
    T.goto(B + "/people"); expect(T.get_by_role("heading", name="People", exact=True)).to_be_visible()

    G = browser.new_context(viewport={"width": 400, "height": 860}).new_page()
    G.goto(B + "/"); expect(G.get_by_role("heading", name="You're early.")).to_be_visible(); G.screenshot(path=f"{OUT}/beta-home.png")
    # Laptop: the front page explains Nayboro and how to become a tester (not a lone phone card)
    L = browser.new_context(viewport={"width": 1440, "height": 800}).new_page()
    L.goto(B + "/"); expect(L.get_by_role("heading", name="Your people are closer than you think.")).to_be_visible()
    expect(L.get_by_text("Want to help test?")).to_be_visible()
    expect(L.get_by_role("link", name="Beta tester sign in")).to_be_in_viewport()
    L.screenshot(path=f"{OUT}/beta-home-laptop.png")
    browser.close()

# Too many wrong tries from one network: locked out for a while.
for i in range(8):
    req = urllib.request.Request(B + "/api/beta-login", data=b'{"email":"x@example.com","code":"bad"}', headers={"Content-Type": "application/json", "X-Forwarded-For": "198.51.100.9"})
    try: urllib.request.urlopen(req)
    except urllib.error.HTTPError as e: assert e.code == 401, e.code
req = urllib.request.Request(B + "/api/beta-login", data=b'{"email":"neeraj@example.com","code":"TEST-CODE-42"}', headers={"Content-Type": "application/json", "X-Forwarded-For": "198.51.100.9"})
try: urllib.request.urlopen(req); raise AssertionError("not locked out")
except urllib.error.HTTPError as e: assert e.code == 429, e.code

psql("delete from beta_login_attempts; update app_settings set value='\"open\"' where key='site_mode'")
print("beta flow: all checks passed")
