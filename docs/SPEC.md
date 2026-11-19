# Nayboro · Phase 0 spec

Phase 0 is 10 mockup pages, 3 bottom tabs (Explore, People, Chats) and an account menu. This spec maps each
mockup to a route and to the tables behind it. It also lists what the mockups still leave open.

## Screens → routes

| # | Mockup | Route | Reads / writes | Status |
|---|--------|-------|----------------|--------|
| 1 | `welcome.html` | `/` | none | **Ported** (`src/app/page.tsx`) |
| — | *(no mockup)* | `/login` | Supabase Auth (email + 6-digit code) | **Built**, tested end to end |
| 2 | `profile-setup.html` | `/setup` | `save_profile()`, `places`, `areas`, `interests`, `avatars` storage | **Built**, tested end to end; also used for Edit profile |
| 3 | `people.html` | `/people` | `people_for_me()`, `inbox_hellos()`, `my_root_counts()`, `hidden_suggestions` | **Built**, tested end to end |
| 4 | `profile.html` | `/p/[id]` | `profile_card()`, `hellos`, `blocks`, `reports` | **Built**, tested end to end |
| 5 | `explore.html` | `/explore` | `questions_for_me()`, `answers_for()`, `answers` | **Built**, tested end to end |
| 6 | `explore.html?tab=events` | `/explore?tab=events` | `events_for_me()`, `event_interest` | **Built**, tested end to end |
| 7 | `ask.html` | `/explore/ask` | `questions` (area stamped by the database) | **Built**, tested end to end |
| 8 | `chats.html` | `/chats` | `inbox_hellos()`, `my_chats()`, `sent_hellos()`, Realtime | **Built**, tested end to end |
| 9 | `chat.html` | `/chats/[id]` | `chat_header()`, `messages`, `mark_read()`, Realtime | **Built**, tested end to end with two users |
| 10 | `contact.html` | `/help` | `contact_messages` | **Built**, tested end to end |

## Setup flow (from `profile-setup.html`)
1. **Roots:** search hometowns (prefix match), pick 1–3. Choose show level: city / state / country, with a live "Others will see" preview.
2. **Interests:** five groups, 5 visible + "Show N more". At least 3 to continue.
3. **Now:** "Find my city" (location once → city → forget coordinates) or type a city/ZIP. Shows the "What others see" card and the "Never shown to anyone" list.
4. **You:** photo (optional), first name (required), last name (shown as initial), intro ≤160 with starters, 18+ box (required).
5. **Done:** profile preview, then "Start exploring" → `/people`.

## How setup works
- **Location:** the phone's position is matched to the nearest DFW area **on the device** (within 40 km). Coordinates are never sent or stored. Outside DFW, or if location is denied, the person picks their city or types a ZIP.
- **Photo:** shrunk on the phone to 640px JPEG, uploaded to the private `avatars` bucket under the person's own folder.
- **Save:** one call to `save_profile()` writes the profile, hometowns and interests together, or nothing if anything is invalid.

## Extra safety built in beyond the mockups
- Report gives a reason list (fake profile, harassment, scam, inappropriate, other) instead of a bare toast.
- Block asks to confirm first and explains what happens.
- Max 20 hellos per person per day (database-enforced).
- Ask blocks obvious selling/ads ("for sale", "whatsapp me", promo codes) before posting.
- The answer box reminds people never to ask for money or move people to private chats for jobs or visas.
- Opening a chat you're not in shows "not found"; the database returns nothing.

## Data model (see `supabase/migrations/20261118000000_init.sql`)
- **People:** `profiles` (owner-only) · `profile_roots` (≤3, owner-only) · `profile_interests` · `blocks` · `hidden_suggestions`
- **Connections:** `hellos` (pending → accepted / not_now / withdrawn) → `accept_hello()` creates `conversations` + `conversation_members` → `messages`
- **Explore:** `questions` (owner-only base) · `answers` · `answer_helpful` · `events` (team-curated) · `event_interest`
- **Safety and support:** `reports` · `contact_messages`
- **Read-side views:** `public_profiles` (name + initial, area, hometown at chosen level, no blocked people) · `question_feed` (anonymous authors masked) · `event_feed` (interest counts under 5 hidden)
- **Reference:** `places` (36 seeded hometowns), `areas` (10 DFW cities with ZIPs), `interests` (43 in 5 groups)

`supabase/tests/privacy_checks.sql` checks 26 rules against a real Postgres. All pass: hometown level, owner-only base rows, anonymous masking, under-5 counts, hello-only chat, outsiders locked out of chats, block hides and stops hellos, the 18+ check, setup validation (3+ interests, 1–3 hometowns), edit keeps data, and photos only in your own folder.

`e2e/run.sh` drives the real app in Chrome: (1) sign in with a code, all 4 setup steps, Edit profile, log out; (2) every main screen with two real users in separate browsers: hellos, Say hi, accept, chat both ways, answer, events, anonymous ask, help form, block and report, and a non-member opening someone else's chat.

## Suggested build order
1. Supabase project + run migration and seed. Auth (Open 1). `/login`. Route protection: signed-in + onboarded.
2. `/setup` (4 steps + done), writing to `profiles`, `profile_roots`, `profile_interests`.
3. `/people` and `/p/[id]` with Say hi, Report, Block.
4. `/chats` and `/chats/[id]` with Realtime, unread dots, mute.
5. `/explore` questions + answer sheet, `/explore/ask`.
6. Events tab + an admin way to add events (SQL or a protected page).
7. `/help`, the account menu, installable PWA, email notifications (hello received, accepted, new answer).

## Open questions and fixes in the mockups
1. **Sign-in:** decided: email with a 6-digit code (built). Phone codes can be added later; until then, hide the "Phone verified" badge.
2. **Event count under 5:** fixed in the build. Under 5 shows "Be one of the first to show interest".
3. **"In common" count:** fixed in the build. The People card and the profile use the same rule (roots + up to 2 shared interests; a shared event shows on the profile only).
4. **Languages:** profiles show "Speaks", but setup never asks for it. Add a small step to "You", or drop it from profiles.
5. **Scam risk in anonymous immigration posts:** the seeded answer "message me for recruiters" is the classic setup for scams aimed at people on visas. Suggestions: a safety note on Immigration answers, a rate limit on hellos from people you met through answers, and moderator review of reports on that topic first.
6. **Moderation:** `hidden` exists on questions and answers, but nobody owns the review queue yet. Name an owner and a target response time before launch.
7. **Account menu name:** fixed; it shows the signed-in user's name.
8. **Launch date and domain:** the guide says Dec 14, Ankur's plan said Nov 29, and nayboro.com is taken.
9. **Settings and delete account:** no mockup yet. Needed for app store and privacy rules.
