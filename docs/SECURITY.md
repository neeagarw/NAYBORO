# Security and privacy: what's in place, and what to do if something goes wrong

Plain-language notes for the team. Not legal advice; have a lawyer review the Terms, Privacy policy and this plan
before public launch.

## In place
- **Row level security on every table.** `20261127000000_api_role_grants.sql` refuses to run if a public table
  lacks RLS. Other people's data is read only through `public_profiles` and the screen functions.
- **No exact location, ever.** Only a city is stored. Photos are re-encoded in the browser before upload, which drops
  the GPS data phones embed. The avatars bucket is private; photos are shown through short-lived signed URLs.
- **Network addresses are never stored**, only a salted one-way hash used for spam limits.
- **Spam and abuse limits**: hellos, posts and writes (`guard_write`), waitlist sign-ups (5/hour per network),
  beta-code sign-in (8 wrong tries per network = 15-minute lockout).
- **Secrets** live only in Vercel and GitHub secrets. The service role key is used only in `src/app/api/*`.
- **Security headers** on every response (`next.config.ts`): CSP `frame-ancestors 'none'; base-uri 'self';
  object-src 'none'; form-action 'self'`, X-Frame-Options DENY, nosniff, strict Referrer-Policy,
  Permissions-Policy (location only, no camera/microphone), HSTS, COOP same-origin.
- **Delete my account** (account menu): removes photos from storage, then `delete_my_account()` deletes the auth
  user, which cascades to the profile and everything linked to it, plus the waitlist row and contact messages.
- **Consent record**: `profiles.terms_version` / `terms_agreed_at`, set when Setup is saved
  (`APP.termsVersion` in `src/config/app.ts`; bump it when the Terms or Privacy policy change materially).
- No analytics, ad or tracking cookies; only Supabase sign-in cookies.

## Owner checklist (things code can't do)
- Two-step login on the Google, GitHub, Vercel and Supabase accounts.
- A long beta code (`BETA_LOGIN_CODE`, rotate it in Vercel when testers change).
- A real inbox for `APP.contactEmail`, and a postal address (PO box) for marketing-email footers (CAN-SPAM).
- Register a DMCA designated agent with the US Copyright Office before opening to the public.
- Accept the Supabase and Vercel data processing agreements; move the waitlist out of the personal Google account.

## If there's a breach
1. **Contain**: rotate the affected keys (Supabase service role / JWT secret, DB password, Vercel env vars,
   `BETA_LOGIN_CODE`, Gmail app password), pause sign-ups (`app_settings.site_mode`), revoke sessions if needed.
2. **Understand**: what data, whose, since when. Keep notes with times; save logs (Supabase auth/API logs,
   Vercel logs) before they expire.
3. **Notify** (Texas law, Bus. & Com. Code §521.053):
   - affected people without unreasonable delay and **within 60 days** of determining the breach;
   - the **Texas Attorney General within 30 days** if 250 or more Texans are affected, using the AG's online form.
   Other states' residents may have their own rules; check with a lawyer.
4. **Fix and follow up**: patch the cause, add a test that would have caught it, write a short post-mortem.
