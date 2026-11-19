import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmail, sendEmail, type Alert } from "@/lib/email";

// Sends queued email alerts (said hi, accepted, new answer).
// Called by:
//   - a Supabase Database Webhook on INSERT into `notifications` (POST, header x-webhook-secret), so alerts go out right away
//   - a Vercel Cron once a day (GET, Authorization: Bearer CRON_SECRET), as a safety net
// Each alert is claimed once in the database, so overlapping calls never double-send.

function allowed(req: NextRequest) {
  const hook = process.env.NOTIFY_WEBHOOK_SECRET;
  const cron = process.env.CRON_SECRET;
  if (hook && req.headers.get("x-webhook-secret") === hook) return true;
  if (cron && req.headers.get("authorization") === `Bearer ${cron}`) return true;
  return false;
}

async function dispatch(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_notifications", { p_limit: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // One email per person, even if several things happened.
  const byPerson = new Map<string, Alert[]>();
  for (const a of (data ?? []) as Alert[]) byPerson.set(a.recipient_id, [...(byPerson.get(a.recipient_id) ?? []), a]);

  let sent = 0;
  const failed: string[] = [];
  for (const items of byPerson.values()) {
    try {
      await sendEmail(buildEmail(items));
      sent++;
    } catch (e) {
      failed.push(items[0].recipient_id);
      console.error("alert email failed", (e as Error).message);
    }
  }
  return NextResponse.json({ claimed: data?.length ?? 0, emails: sent, failed: failed.length });
}

export const POST = dispatch;
export const GET = dispatch;
