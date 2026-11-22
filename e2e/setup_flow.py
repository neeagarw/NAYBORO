"""End-to-end test: sign in with an email code, complete setup, edit profile, log out.
Run from the repo root with e2e/run.sh."""
import json, re
from playwright.sync_api import sync_playwright, expect
B='http://localhost:3123'; shots=[]
import subprocess, os
os.makedirs('e2e/out', exist_ok=True)
subprocess.run(['psql','-d','e2e','-qc',"delete from profiles where id::text not like 'd0000000%'; delete from auth.users where id::text not like 'd0000000%';"],check=True)
def shot(pg,name): pg.wait_for_timeout(350); pg.screenshot(path=f'e2e/out/{name}.png'); shots.append(name)
with sync_playwright() as p:
    import os
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    ctx=b.new_context(viewport={'width':400,'height':860}, geolocation={'latitude':32.915,'longitude':-96.64}, permissions=['geolocation'])
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type=='error' and errs.append(m.text)); pg.on('response', lambda r: r.status>=400 and errs.append(f'{r.status} {r.url}'))
    pg.goto(B+'/'); pg.get_by_role('link', name='Get started').click()
    expect(pg).to_have_url(re.compile(r'login\?next=%2Fsetup$')); shot(pg,'01_login')
    pg.get_by_label('Email').fill('neeraj@example.com'); pg.get_by_role('button', name='Send me a code').click()
    expect(pg.get_by_text('Check your email')).to_be_visible()
    pg.get_by_label('6-digit code').fill('111111'); expect(pg.get_by_text("That code didn't work")).to_be_visible(); shot(pg,'02_code_wrong')
    pg.get_by_label('6-digit code').fill('123456'); expect(pg).to_have_url(re.compile(r'setup$'))
    # Roots
    pg.get_by_label('Hometown').fill('Jai'); expect(pg.get_by_role('button', name='Jaipur Rajasthan, India')).to_be_visible(); shot(pg,'03_roots_search')
    pg.get_by_role('button', name='Jaipur Rajasthan, India').click()
    expect(pg.get_by_text('Others will see:')).to_contain_text('You · Jaipur → your city'); shot(pg,'04_roots_picked')
    pg.get_by_role('button', name='Continue').click()
    # Interests
    expect(pg.get_by_role('button', name='Continue')).to_be_disabled()
    for n in ['Tennis','Cricket','Chai meetups']: pg.get_by_role('button', name=n, exact=True).click()
    expect(pg.get_by_role('button', name='Continue')).to_be_enabled(); shot(pg,'05_interests')
    pg.get_by_role('button', name='Continue').click()
    # Now
    shot(pg,'06_now_before'); pg.get_by_role('button', name='Find my city').click()
    expect(pg.get_by_text("You're in Garland, TX")).to_be_visible(); expect(pg.get_by_text("Part of Dallas–Fort Worth")).to_be_visible(); shot(pg,'07_now_found')
    pg.get_by_role('button', name='Continue').click()
    # You
    expect(pg.get_by_role('button', name='Finish')).to_be_disabled()
    pg.set_input_files('#photoInput','e2e/face.jpg')
    pg.get_by_label('First name').fill('Neeraj'); pg.get_by_label('Last name').fill('Agarwala')
    pg.get_by_role('button', name='+ Moved here from…').click(); pg.wait_for_timeout(150); pg.keyboard.type('Jaipur. Weekend tennis, always up for chai.')
    expect(pg.get_by_text('Others see you as “Neeraj A.”')).to_be_visible()
    expect(pg.get_by_label('Short intro')).to_have_value('Moved here from Jaipur. Weekend tennis, always up for chai.')
    pg.get_by_role('checkbox').check(); shot(pg,'08_you')
    pg.get_by_role('button', name='Finish').click()
    expect(pg.get_by_text("You're in, Neeraj!")).to_be_visible(); shot(pg,'09_done')
    pg.get_by_role('button', name='Start exploring').click(); expect(pg).to_have_url(re.compile(r'people$'))
    expect(pg.get_by_text(re.compile(r'^Near Garland'))).to_be_visible(); shot(pg,'10_people')
    # Edit profile is pre-filled
    pg.get_by_role('button', name='Your account').click(); expect(pg.get_by_role('dialog')).to_contain_text('Neeraj A.'); expect(pg.get_by_role('dialog')).to_contain_text('Jaipur → Garland'); shot(pg,'11_menu')
    pg.get_by_role('link', name='Edit profile').click(); expect(pg).to_have_url(re.compile(r'/setup$'))
    expect(pg.get_by_role('button', name='Remove Jaipur')).to_be_visible()
    pg.get_by_role('button', name='Rajasthan Hides your city').click()
    for _ in range(3): pg.get_by_role('button', name='Continue').click()
    expect(pg.get_by_label('First name')).to_have_value('Neeraj'); expect(pg.get_by_role('button', name='Save')).to_be_enabled()
    pg.get_by_role('button', name='Save').click(); expect(pg.get_by_role('heading', name='Profile saved')).to_be_visible()
    pg.get_by_role('button', name='Back to Nayboro').click(); expect(pg).to_have_url(re.compile(r'/people$'))
    pg.get_by_role('button', name='Your account').click(); expect(pg.get_by_role('dialog')).to_contain_text('Rajasthan → Garland'); pg.get_by_role('button', name='Cancel').click()
    # Re-entering Setup after saving: fully editable every time, and Close always exits (P0-3)
    for attempt in range(3):
        pg.get_by_role('button', name='Your account').click(); pg.get_by_role('link', name='Edit profile').click(); expect(pg).to_have_url(re.compile(r'/setup$'))
        pg.get_by_role('button', name='Jaipur Shows your city' if attempt % 2 == 0 else 'Rajasthan Hides your city').click()
        pg.get_by_role('button', name='Continue').click(); expect(pg.get_by_role('button', name='Back')).to_be_visible()
        for _ in range(2): pg.get_by_role('button', name='Continue').click()
        pg.get_by_role('button', name='Save').click(); expect(pg.get_by_role('heading', name='Profile saved')).to_be_visible()
        pg.get_by_role('button', name='Back to Nayboro').click(); expect(pg).to_have_url(re.compile(r'/people$'))
    pg.goto(B + '/setup'); pg.get_by_role('button', name='Close').click(); expect(pg).to_have_url(re.compile(r'/people$'))   # opened by URL: Close still exits
    # Log out
    pg.get_by_role('button', name='Your account').click(); pg.get_by_role('button', name='Log out').click(); expect(pg).to_have_url(B+'/')
    pg.goto(B+'/people'); expect(pg).to_have_url(re.compile(r'login\?next=%2Fpeople$'))
    print('ALL STEPS PASSED'); print('browser errors:', errs or 'none')
    b.close()
