import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUnsubscribeToken } from "@/lib/email";

// One-click "Turn off email alerts" from the email footer.
// GET = the person clicked the link; POST = their email app's one-click unsubscribe button.
async function unsubscribe(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(u) || !checkUnsubscribeToken(u, t)) {
    return NextResponse.redirect(new URL("/unsubscribed?bad=1", req.url), 303);
  }
  const { error } = await createAdminClient().rpc("set_email_alerts", { p: u, p_on: false });
  if (error) return NextResponse.redirect(new URL("/unsubscribed?bad=1", req.url), 303);
  return req.method === "POST" ? new NextResponse(null, { status: 200 }) : NextResponse.redirect(new URL("/unsubscribed", req.url), 303);
}

export const GET = unsubscribe;
export const POST = unsubscribe;
