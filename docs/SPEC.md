# Nayboro · Phase 0 spec

Phase 0 is 10 mockup pages, 3 bottom tabs (Explore, People, Chats) and an account menu. This spec maps each
mockup to a route and to the tables behind it. It also lists what the mockups still leave open.

## Screens → routes

| # | Mockup | Route | Reads / writes | Status |
|---|--------|-------|----------------|--------|
| 1 | `welcome.html` | `/` | none | **Ported** (`src/app/page.tsx`) |
| — | *(no mockup)* | `/login` | Supabase Auth | Needs design (see Open 1) |
| 2 | `profile-setup.html` | `/setup` | `profiles`, `profile_roots`, `profile_interests`, `places`, `areas`, `interests` | To build |
| 3 | `people.html` | `/people` | `public_profiles`, `hellos`, `hidden_suggestions`, `profile_interests` | To build |
| 4 | `profile.html` | `/p/[id]` | `public_profiles`, `hellos` (send), `blocks`, `reports`, `event_interest` | To build |
| 5 | `explore.html` | `/explore` | `question_feed`, `answers`, `answer_helpful` | To build |
| 6 | `explore.html?tab=events` | `/explore?tab=events` | `event_feed`, `event_interest` | To build |
| 7 | `ask.html` | `/explore/ask` | `questions` (insert) | To build |
| 8 | `chats.html` | `/chats` | `hellos`, `conversation_members`, `messages` (Realtime) | To build |
| 9 | `chat.html` | `/chats/[id]` | `messages` (Realtime), `conversation_members` (mute, last read), `blocks`, `reports` | To build |
| 10 | `contact.html` | `/help` | `contact_messages` | To build |

## Setup flow (from `profile-setup.html`)
1. **Roots:** search hometowns (prefix match), pick 1–3. Choose show level: city / state / country, with a live "Others will see" preview.
2. **Interests:** five groups, 5 visible + "Show N more". At least 3 to continue.
3. **Now:** "Find my city" (location once → city → forget coordinates) or type a city/ZIP. Shows the "What others see" card and the "Never shown to anyone" list.
4. **You:** photo (optional), first name (required), last name (shown as initial), intro ≤160 with starters, 18+ box (required).
5. **Done:** profile preview, then "Start exploring" → `/people`.

## Data model (see `supabase/migrations/20261118000000_init.sql`)
- **People:** `profiles` (owner-only) · `profile_roots` (≤3, owner-only) · `profile_interests` · `blocks` · `hidden_suggestions`
- **Connections:** `hellos` (pending → accepted / not_now / withdrawn) → `accept_hello()` creates `conversations` + `conversation_members` → `messages`
- **Explore:** `questions` (owner-only base) · `answers` · `answer_helpful` · `events` (team-curated) · `event_interest`
- **Safety and support:** `reports` · `contact_messages`
- **Read-side views:** `public_profiles` (name + initial, area, hometown at chosen level, no blocked people) · `question_feed` (anonymous authors masked) · `event_feed` (interest counts under 5 hidden)
- **Reference:** `places` (36 seeded hometowns), `areas` (10 DFW cities with ZIPs), `interests` (43 in 5 groups)

`supabase/tests/privacy_checks.sql` checks 13 rules against a real Postgres. All pass: hometown level, owner-only base rows, anonymous masking, under-5 counts, hello-only chat, outsiders locked out of chats, block hides and stops hellos, and the 18+ check.

## Suggested build order
1. Supabase project + run migration and seed. Auth (Open 1). `/login`. Route protection: signed-in + onboarded.
2. `/setup` (4 steps + done), writing to `profiles`, `profile_roots`, `profile_interests`.
3. `/people` and `/p/[id]` with Say hi, Report, Block.
4. `/chats` and `/chats/[id]` with Realtime, unread dots, mute.
5. `/explore` questions + answer sheet, `/explore/ask`.
6. Events tab + an admin way to add events (SQL or a protected page).
7. `/help`, the account menu, installable PWA, email notifications (hello received, accepted, new answer).

## Open questions and fixes in the mockups
1. **Sign-in has no design.** "Log in" currently links to People. The profile shows a "Phone verified" badge, so decide: phone (SMS via Twilio) or email magic link. Phone is better for trust, but SMS costs money.
2. **Event count under 5:** the cricket event says "3 from Rajasthan interested". This breaks rule 4. `event_feed` already hides it. Change the mockup copy to "Be one of the first" or drop the line.
3. **"In common" count mismatch:** Rohit's card says "2 in common", but his profile lists 3 (Rajasthan, tennis, cricket meetup). Decide whether shared events count.
4. **Languages:** profiles show "Speaks", but setup never asks for it. Add a small step to "You", or drop it from profiles.
5. **Scam risk in anonymous immigration posts:** the seeded answer "message me for recruiters" is the classic setup for scams aimed at people on visas. Suggestions: a safety note on Immigration answers, a rate limit on hellos from people you met through answers, and moderator review of reports on that topic first.
6. **Moderation:** `hidden` exists on questions and answers, but nobody owns the review queue yet. Name an owner and a target response time before launch.
7. **Account menu name:** it says "Neeraj S."; use the signed-in user's name.
8. **Launch date and domain:** the guide says Dec 14, Ankur's plan said Nov 29, and nayboro.com is taken.
9. **Settings and delete account:** no mockup yet. Needed for app store and privacy rules.
