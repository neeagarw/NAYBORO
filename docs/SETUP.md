# Going live: Supabase + Vercel setup (about 45 minutes)

## 1. Supabase project (10 min)
1. supabase.com → New project → name `nayboro`, region **US East** or **US Central**, save the database password.
2. Project Settings → API: copy the **Project URL** and **anon public** key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
3. Apply the database:
   ```bash
   npx supabase login
   npx supabase link --project-ref xxxx
   npx supabase db push                       # runs supabase/migrations in order
   psql "<connection string from Settings → Database>" -f supabase/seed.sql   # includes every US city (~30 s)
   ```
   Do **not** run `supabase/demo_seed.sql` here: it adds fake people and only works on the local test setup.
4. Database → Replication (Realtime): make sure `messages` and `hellos` are turned on, so chats update live.

## 2. Email sign-in with a 6-digit code (10 min)
1. Authentication → Sign In / Providers → **Email**: on. "Confirm email": on.
2. Authentication → **Email Templates → Magic Link**. Replace the body so it sends the code, not a link:
   ```html
   <h2>Your Nayboro code</h2>
   <p>Enter this code to log in or join:</p>
   <p style="font-size:28px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>
   <p>It expires in 1 hour. If you didn't ask for it, ignore this email.</p>
   ```
   Do the same for **Confirm signup** (new users get that template).
3. Authentication → Settings: **Email OTP length = 6**, and set the OTP expiry to 3600 seconds.
4. **Custom SMTP (required before beta).** Supabase's built-in email only sends a handful of emails an hour, which breaks sign-in once more than a few people try. Create a free Resend account, verify your domain, then Authentication → SMTP Settings → host `smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender `hello@<your domain>`.
5. Authentication → URL Configuration: Site URL = your Vercel URL (later your domain).

## 3. Email alerts (15 min)
Alerts go out when someone says hi to you, accepts your hello, or answers your question. One email per person per batch, with a one-click "Turn off email alerts" link.
1. Resend: verify your domain and create an API key (the same account you set up for sign-in emails).
2. Generate four secrets: run `openssl rand -base64 32` four times, for `NOTIFY_WEBHOOK_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET` and `IP_HASH_SALT`.
3. Supabase → Database → **Webhooks** → Create:
   - Table `notifications`, event **Insert**
   - Type HTTP Request, method **POST**, URL `https://<your site>/api/notifications/dispatch`
   - Header `x-webhook-secret` = your `NOTIFY_WEBHOOK_SECRET`
4. `vercel.json` already adds a daily safety-net run at 8–9am Central (Vercel sends `CRON_SECRET` itself).

## 4. Make yourself an admin (2 min)
The site starts in **pre-launch mode**: the home page is the "Join the community" waitlist, and only beta testers and admins can sign in to the app. So the first time, let yourself in as a beta tester, finish setup, then make yourself admin. In Supabase → SQL Editor:
```sql
insert into beta_testers values ('you@example.com');   -- your email, lowercase
```
Open the site → "Beta tester? Log in" → finish setup. Then:
```sql
insert into admins select id from profiles where first_name = 'Neeraj';   -- check it picked only you
```
Then "Admin" appears in your account menu: open reports, hide questions/answers, pause or restore accounts, help messages, and add or delete events.

## Pre-launch waitlist and launch day
- **Admin → Waitlist** shows how many joined, which metro areas they live in, the latest 500 sign-ups (with how many friends each invited) and a **Download CSV** button.
- **Beta testers:** type an email and press Add, or press "Let in" next to anyone on the list. They sign in from "Beta tester? Log in" with that email.
- **Launch:** press "Open Nayboro to everyone". The home page switches to the normal welcome and anyone can sign up. You can switch back the same way.
- Everyone who joins gets a "You're on the list" email with their invite link (`/?ref=CODE`) and a one-click "Leave the list" link. Sign-ups are limited to 5 per network per hour; we store a salted hash of the network address, never the address itself.
- To email the list on launch day: Download CSV and import it into Resend (Audiences → Import) or any email tool.

## 5. Vercel (10 min)
1. Push the repo to GitHub, then vercel.com → Add New Project → import it.
2. Environment Variables: add every name in `.env.example` (Supabase URL and anon key, service role key, site URL, Resend key and sender, the four secrets). Deploy.
3. Use the paid plan before launch (the free plan doesn't allow commercial use).

## Cities and metro areas
Every US city (29,598), ZIP code (41,045) and metro area (387, plus "Rest of <State>" groups) is loaded by `seed.sql`. Nothing to add when people join from a new city.
- **Merge or rename metros** (e.g. add Stockton to the Bay Area): edit `COMBINE` / `FRIENDLY_NAMES` in `scripts/build_us_geo.py`, run `python3 scripts/build_us_geo.py`, then run `psql ... -f supabase/geo/us_geo.sql` on the live database. It updates in place.
- **Refresh ZIP data** once a year: `pip install zipcodes`, regenerate `data/geo/zips.csv` (see the script's header), re-run the script.
- Data sources and licences (MIT): `data/geo/`.

## 6. Smoke test on your phone (10 min)
Open the Vercel URL → join the waitlist from a second email and check the confirmation email arrives → "Beta tester? Log in" → enter your email → type the code → finish setup → People shows "You're set up as…".
Then Edit profile from the orange button, change something, and save. Log out and log back in.
From a second account, say hi to yourself: you should get an alert email within a minute. Click its "Turn off email alerts" link once to check it works, then turn alerts back on in SQL (`update profiles set email_alerts = true where ...`).

## Checks you can run any time
- `supabase/tests/run.sh`: 20 database privacy checks against a local Postgres.
- `e2e/run.sh`: the whole sign-in and setup flow in a real browser, against a local stand-in for Supabase.
