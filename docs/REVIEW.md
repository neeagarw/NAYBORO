# Senior review: UI, functionality, scale, hard-coding

Date: 19 Nov 2026 · Scope: every screen, every database function, the test suites.
Result: **all 14 screens pass accessibility (WCAG 2.2 AA) and layout checks at 4 screen sizes; every query except People stays under 30 ms at 100,000 people per metro; no city, time zone or list is hard-coded in the app.**

## 1. Evidence

| Check | Result |
|---|---|
| Database privacy and rule checks (`supabase/tests/run.sh`) | 39 checks, all as expected (17 are refusals the test expects) |
| End-to-end, sign-in and setup (`e2e/setup_flow.py`) | Passed |
| End-to-end, every screen with two real users (`e2e/screens_flow.py`) | Passed, 0 page errors, 0 server errors |
| Accessibility, axe WCAG 2.2 AA on 14 screens (`e2e/quality_check.py`) | 0 failures |
| Layout at 320 / 390 / 430 / 1280 px (14 screens each) | 0 sideways scrolling, 0 overflow |
| Lint and type check | Clean |

### Speed of each screen's main query (`supabase/tests/load_test.sql`)
One metro, measured as a user with 2,000 chats.

| Screen | Before (20k people) | After (20k) | After (100k) |
|---|---|---|---|
| People | 2,827 ms | 63 ms | 422 ms |
| Hometown counts | 570 ms | 6 ms | 21 ms |
| Explore | 5,352 ms | 3 ms | 3 ms |
| Answers (one page) | 4,783 ms | 6 ms | 7 ms |
| Chats list | 91 ms | 26 ms | 27 ms |
| Chats badge | 89 ms | 4 ms | 3 ms |
| Profile | 4 ms | 4 ms | 5 ms |

People grows with metro size (it ranks everyone in the metro). Next step when one metro passes ~50,000 people: pre-compute matches every few minutes into a table (about a day of work).

## 2. What was hard-coded, and where it lives now

| Was in the app | Now |
|---|---|
| "DFW", "Dallas–Fort Worth", "America/Chicago" in 4 screens | `metros` table (name, time zone, radius); new city = insert rows |
| 25 km "around me" and 40 km location cut-off | `metros.near_km`, `metros.match_km` |
| City names in Ask ("Plano, Frisco, Richardson") and placeholders | Built from the person's metro areas |
| Question topics (enum + 3 lists in the app) | `topics` table: name, colour, keywords |
| "Sports" list deciding "Plays" vs "Into" (2 copies) | `interests.verb` |
| Interest group order | `interests.group_sort` |
| Spam limits inside triggers | `rate_limits` table (change a number, no deploy) |
| Under-5 rule, "New" for 14 days, 3 interests, 3 hometowns | `app_settings` table |
| Report reasons (3 copies), safety tips, event kinds, page sizes | `src/config/app.ts` (one file) |
| 36 raw colour values | Design tokens in `globals.css` |
| Event times in the phone's or server's time zone | The event city's time zone (`src/lib/time.ts`, daylight-saving safe) |

## 3. Scaling fixes
- **22 new database indexes** on every foreign key and every "who did what recently" lookup.
- **Set-based queries:** People computes matches once for the metro, then fills names only for the page shown. Explore precomputes nearby areas instead of measuring distance per question.
- **Pagination everywhere:** People (40 at a time), Explore (20), Chats (50), messages ("Load earlier messages", 50).
- **Live updates scoped to the person:** previously the Chats screen listened to every message in the database. Now it listens only to your hellos and your own conversations.
- **Spam guard** reads one config row and uses an index for its count.

## 4. UI and behaviour fixes found in this review
| Issue | Fix |
|---|---|
| After answering under "Unanswered", going back to "All" showed the old list | Filters always fetch fresh data |
| Lists could show stale data when returning to a screen (Next.js keeps screens alive) | Lists reset when server data changes (`src/lib/list-key.ts`) |
| Answering reloaded the whole page | Only that question's answers refresh |
| "Not now" blocked the sender forever | They can say hi again after 30 days (`hello_retry_days`) |
| Profile scroll area unreachable by keyboard | Focusable with a label |
| "Anonymous" button's spoken name didn't match its text | Fixed for voice control and screen readers |
| No keyboard focus outline | Visible orange focus ring; honours "reduce motion" |
| Signed-in people saw the Welcome page | Go straight to People |
| No app icon, install support or link preview | Icons, manifest (install as an app), WhatsApp/iMessage preview image, search rules (only Welcome is indexed) |

## 5. Known limits (honest list)
- **Live updates and real email delivery are untested here:** the local stand-in can't run Supabase Realtime or Resend. Test both on the live site first.
- **People at very large metros:** see section 1 (pre-computed matches).
- **Desktop shows a centred phone-sized frame.** That's deliberate for a phone-first app; a wide desktop layout is a separate project.
- **The welcome illustration uses example names** (Priya, Vikram): marketing art, not data.
- **Help topics** stay in code because they match fixed database values (`contact_topic`).
- **Languages** are shown on profiles but not collected in setup (decide: add a step or drop it).
