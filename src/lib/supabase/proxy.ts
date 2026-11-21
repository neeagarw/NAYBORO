import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Pages anyone can open without signing in. */
// /api routes check their own secrets or signed links; /unsubscribed is reached from an email.
const PUBLIC = [/^\/$/, /^\/login$/, /^\/auth\//, /^\/api\//, /^\/unsubscribed$/, /^\/privacy$/, /^\/r\//];

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to /login (keeping where they were going in ?next=).
 * The "finished setup?" check lives in src/app/(app)/layout.tsx, not here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Do not put code between createServerClient and getUser: it can log users out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((re) => re.test(path));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  // Signed-in people skip the welcome and login pages.
  // ("/?notyet=1" is where the pre-launch gate sends people, so it must not bounce back.)
  if (user && (path === "/login" || (path === "/" && !request.nextUrl.search))) {
    const url = request.nextUrl.clone();
    url.pathname = "/people";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
