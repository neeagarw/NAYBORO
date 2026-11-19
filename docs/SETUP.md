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
   psql "<connection string from Settings → Database>" -f supabase/seed.sql
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

## 3. Vercel (10 min)
1. Push the repo to GitHub, then vercel.com → Add New Project → import it.
2. Environment Variables: add the two `NEXT_PUBLIC_SUPABASE_*` values. Deploy.
3. Use the paid plan before launch (the free plan doesn't allow commercial use).

## 4. Smoke test on your phone (10 min)
Open the Vercel URL → Get started → enter your email → type the code → finish setup → People shows "You're set up as…".
Then Edit profile from the orange button, change something, and save. Log out and log back in.

## Checks you can run any time
- `supabase/tests/run.sh`: 20 database privacy checks against a local Postgres.
- `e2e/run.sh`: the whole sign-in and setup flow in a real browser, against a local stand-in for Supabase.
