# Go live with the waitlist (Google Sheet setup)

Before launch, Nayboro needs **no database**: the coming-soon page runs on Vercel and every sign-up
becomes a row in a Google Sheet. About 20 minutes, all free.

```
Visitor ──> nayboro.com (Vercel) ──> Apps Script in your sheet ──> row in "Waitlist" tab
                                                          └──> "You're on the list" email from your Gmail
```

## 1. The Google Sheet (5 min)

1. Open the sheet **Nayboro Waitlist** in your Google Drive (already created), or make any new sheet.
2. **Extensions → Apps Script.** Delete what's there, paste all of `apps-script/Code.gs`, press **Save**.
3. In the function menu at the top choose **setup**, press **Run**. Google asks for permission
   (it's your own script: *Advanced → Go to … (unsafe) → Allow*). It needs the sheet and Gmail.
   The log at the bottom shows **Your SHEET_WEBHOOK_SECRET**: copy it.
4. **Deploy → New deployment →** gear icon **→ Web app.** Execute as: **Me**. Who has access: **Anyone**.
   Press **Deploy** and copy the **Web app URL** (ends in `/exec`). That's `SHEET_WEBHOOK_URL`.

A new tab, **Waitlist**, now has the headers. Each sign-up adds: joined at, email, first name, city,
metro area, home(s), invite code, invited by, a scrambled network code (spam limit), friends invited.
You can sort, filter and add your own columns to the right; don't rename or move the first ten.

> If you change `Code.gs` later: **Deploy → Manage deployments → edit → Version: New version.**
> The URL stays the same.

## 2. Put the code on GitHub (5 min)

Create an empty **private** repository at github.com/new called `nayboro` (no README). Then, in the
unzipped `nayboro` folder:

```bash
git init -b main && git add -A && git commit -m "Nayboro"
git remote add origin https://github.com/<you>/nayboro.git
git push -u origin main
```

(Or connect GitHub to Claude in claude.ai settings and ask Claude to push it.)

## 3. Vercel (5 min)

vercel.com → **Add New → Project → Import** `nayboro`. Framework: Next.js (detected). Before
**Deploy**, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `WAITLIST_STORE` | `sheet` |
| `SHEET_WEBHOOK_URL` | the Web app URL from step 1 |
| `SHEET_WEBHOOK_SECRET` | the secret from step 1 |
| `UNSUBSCRIBE_SECRET` | run `openssl rand -base64 32` |
| `IP_HASH_SALT` | run `openssl rand -base64 32` again |
| `NEXT_PUBLIC_SITE_URL` | `https://nayboro.com` (or the `…vercel.app` address until the domain is set) |

Press **Deploy**. Leave the Supabase variables out: without them only the coming-soon page,
`/privacy` and the invite links work, and every app page sends people to the home page.

## 4. Your domain (5 min)

Vercel project → **Settings → Domains → Add** `nayboro.com` and `www.nayboro.com`, then add the DNS
records Vercel shows at your domain registrar. Update `NEXT_PUBLIC_SITE_URL` and **Redeploy**.

## 5. Check it works

- Open the site on your phone: "Your city" should show your metro area.
- Join with your own email → a row appears in **Waitlist**, and the email arrives (check spam the first time).
- Copy your invite link, open it in a private window and join with a second email → your row's
  **Friends invited** goes to 1.
- Click **Leave the list** in the email → the row disappears.

## Good to know

- **Emails:** sent from your Gmail by the script, up to **100 a day** (Google's limit for personal
  accounts). Sign-ups still save after the limit; only the email is skipped. For more, add a
  `RESEND_API_KEY` (and `EMAIL_FROM`) in Vercel: the site then sends through Resend instead.
- **Before going live:** set your real Instagram link and contact email in `src/config/app.ts`.
- **Launch day:** set up Supabase (docs/SETUP.md), import the sheet (File → Download → CSV), and
  switch `WAITLIST_STORE` to `supabase`.
- Testing this setup locally: `bash e2e/sheet_run.sh` runs the real `Code.gs` against a stand-in sheet.
