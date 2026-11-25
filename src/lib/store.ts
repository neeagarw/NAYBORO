import { APP } from "@/config/app";

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

/**
 * BETA_SITE=1 marks the private beta deployment (e.g. nayboro-beta.vercel.app). Its home page is a
 * sign-in page for beta testers only: no waitlist form (the public waitlist lives on the main site),
 * and search engines are told not to index it.
 */
export function isBetaSite(): boolean {
  return process.env.BETA_SITE === "1";
}

/** The public site, where people join the waitlist. */
export function publicSiteUrl(): string {
  // WAITLIST_SITE_URL only for tests; the real address is product config (nayboro.com is canonical).
  return (process.env.WAITLIST_SITE_URL || APP.publicUrl).replace(/\/$/, "");
}
