# Nayboro

A community app that connects people with others from their hometown who live nearby, lets them ask
practical local questions, and lists local events. Launch: Dallas–Fort Worth. Indian community first,
other communities later (hometown data is global on purpose).

@AGENTS.md

## Source of truth
- **Screens:** `design/mockups/*.html`. Open `design/mockups/index.html` in a browser for the list.
  Build every screen to match its mockup: layout, copy, sizes, colours and behaviour.
  The comments marked `Real build:` in the mockups describe what the server must do.
- **Screenshots:** `design/screenshots/` (older 4-tab version; where they differ, the HTML wins).
- **Spec, data model, open questions:** `docs/SPEC.md`.
- **Database:** `supabase/migrations/`. Never edit an applied migration; add a new one.

## Stack
Next.js (App Router, TypeScript, `src/`), Tailwind v4 with tokens in `src/app/globals.css`,
Supabase (Postgres, Auth, Realtime, Storage) via `@supabase/ssr`, hosted on Vercel.
This Next.js version has breaking changes: read `node_modules/next/dist/docs/` before using an API you are unsure of.

## Product rules (never break these)
1. **Chat opens only after the receiver accepts a hello.** Accept goes through `accept_hello()`; never insert conversations directly.
2. **No exact location, ever.** Store and show an area (city) only. Ask for device location once, reverse-geocode to a city, discard the coordinates. Never show distance.
3. **Hometown shows only at the level its owner chose** (city, state or country). This applies to profiles, cards, "in common" tiles and feed tags.
4. **Never show a count below 5** for hometown, region or interest groups (people lists, event "interested" lines, chip counts). Use `safe_count()`; if it returns null, drop the line or say "Be one of the first".
5. **A roots tag on an answer** ("From Rajasthan") appears only when the reader shares those roots, never finer than the writer chose.
6. **Anonymous questions hide the author from everyone except the author.** Read questions only through `question_feed`. Answers are always named.
7. **Never ask for** caste, religion, visa status, income, home address or details about children.
8. **18+ only.** The "I'm 18 or older" box is required to finish setup (enforced by a DB check).
9. **Block and report are one tap away** (⋯ menu) on every profile and chat. A block hides both people from each other everywhere.
10. **Explore is for questions, not commerce.** No buying, selling or ads in questions. Events are curated by the team and link out; we list, we don't host.
11. **Other people's profiles are read only through `public_profiles`.** The base `profiles`, `profile_roots` and `questions` tables are owner-only under RLS.
12. Every table has Row Level Security. A new table without RLS policies is a bug.

## Design
- Colours: green `#1E6B4A` (primary), orange `#F59E4C` (accent), logo orange `#EE8A35`, ground `#F5F7F2`, ink `#17201B`, muted `#56635B`. Use the Tailwind tokens (`bg-green`, `text-muted`, `bg-orange-tint`…), not raw hex.
- Fonts: Bricolage Grotesque for headings (`font-display`), Inter for body.
- Phone-first: wrap screens in `.app-frame` (max 440px, framed on desktop). Tap targets at least 44px.
- Bottom nav has three tabs: Explore, People, Chats. The account menu opens from the orange initial button.

## Next.js + Supabase gotchas in this repo (learned the hard way)
- Cache Components is on. Anything that reads cookies, headers or searchParams must sit inside `<Suspense>` (see `src/app/(app)/layout.tsx`).
- Server: `createClient()` from `@/lib/supabase/server` already calls `connection()`; always use it.
- Browser: call `getClient()` from `@/lib/supabase/client` only inside event handlers and effects, never during render.
- Don't call `router.refresh()` right after `router.push()`: it re-shows the old screen. After sign-in use a full page load.
- Next.js keeps the last screen of each route alive. Reset state on purpose (a `key`, or close sheets when navigating away).

## Working style
- Plan before large changes. Small commits after each working step.
- Write a Supabase migration for every schema change, with RLS policies in the same file.
- Add a case to `supabase/tests/privacy_checks.sql` for every new privacy rule.
- Run `npm run build` and `npm run lint` and fix errors before saying a task is done.
- For any flow change, extend and run `e2e/run.sh` (local Postgres + PostgREST + Chrome, no Supabase account needed).
- Never commit `.env.local` or any key.
