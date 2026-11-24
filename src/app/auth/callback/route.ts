import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Where Google (or any OAuth provider) sends people back after "Continue with Google".
 * Swaps the one-time code for a session cookie, then goes on to where they were heading.
 * Beta and 18+ rules still apply after this: the app layout checks can_enter(), and Setup requires the 18+ box.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL(`/login?error=google&next=${encodeURIComponent(next)}`, request.url));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth callback", error.message);
    return NextResponse.redirect(new URL(`/login?error=google&next=${encodeURIComponent(next)}`, request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
