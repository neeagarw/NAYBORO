import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { waitlistStore, isBetaSite } from "@/lib/store";

// Google Sheet setup (pre-launch, no database): only the coming-soon page and what it needs are reachable.
const SHEET_PUBLIC = [/^\/$/, /^\/privacy$/, /^\/unsubscribed$/, /^\/r\//, /^\/api\/waitlist(\/|$)/, /^\/api\/geo$/, /^\/(manifest\.webmanifest|robots\.txt|sitemap\.xml)$/, /^\/(opengraph|twitter)-image/, /^\/(icon|apple-icon)/];

export async function proxy(request: NextRequest) {
  if (waitlistStore() === "sheet") {
    const path = request.nextUrl.pathname;
    if (SHEET_PUBLIC.some((re) => re.test(path))) return NextResponse.next();
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isBetaSite()) {
    // The waitlist lives on the public site; the beta site only signs testers in.
    if (/^\/(api\/waitlist(\/|$)|r\/)/.test(request.nextUrl.pathname)) return NextResponse.redirect(new URL("/", request.url));
    const res = await updateSession(request);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  return updateSession(request);
}

export const config = {
  // Everything except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
