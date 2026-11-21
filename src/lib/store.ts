/**
 * Where waitlist sign-ups are kept.
 * - "sheet": a Google Sheet, through the Apps Script web app in apps-script/Code.gs. Pre-launch only:
 *   the coming-soon page works with no database, and every app page redirects to "/".
 * - "supabase": the database (needed once the app opens).
 * Set WAITLIST_STORE explicitly; with no Supabase URL configured the site falls back to "sheet".
 */
export function waitlistStore(): "sheet" | "supabase" {
  const s = process.env.WAITLIST_STORE;
  if (s === "sheet" || s === "supabase") return s;
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "sheet";
}
