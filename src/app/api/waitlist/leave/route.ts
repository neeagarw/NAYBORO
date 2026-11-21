import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLeaveToken } from "@/lib/email";
import { waitlistStore } from "@/lib/store";
import { sheet } from "@/lib/sheet";

// One-click "Leave the list" from the confirmation email. Signed, so nobody can remove someone else.
async function leave(req: NextRequest) {
  const e = (req.nextUrl.searchParams.get("e") ?? "").toLowerCase();
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!e || !checkLeaveToken(e, t)) return NextResponse.redirect(new URL("/unsubscribed?bad=1", req.url), 303);
  let error: unknown = null;
  if (waitlistStore() === "sheet") error = await sheet.leave(e).then(() => null, (x) => x);
  else ({ error } = await createAdminClient().rpc("leave_waitlist", { p_email: e }));
  if (error) return NextResponse.redirect(new URL("/unsubscribed?bad=1", req.url), 303);
  return req.method === "POST" ? new NextResponse(null, { status: 200 }) : NextResponse.redirect(new URL("/unsubscribed?left=1", req.url), 303);
}
export const GET = leave;
export const POST = leave;
