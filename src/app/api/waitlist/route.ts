import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWaitlistEmail, sendEmail, signingSecret } from "@/lib/email";
import { waitlistStore } from "@/lib/store";
import { areaById } from "@/lib/places";
import { sheet, SheetError } from "@/lib/sheet";

// POST /api/waitlist  { email, hometown?, place_id?, area_id?, ref?, adult: true }
// PATCH /api/waitlist { email, refCode, firstName }
// Runs on the server so it can rate-limit by network (a salted hash of the IP, never the IP itself)
// and send the confirmation email. Sign-ups go to the Google Sheet or the database (src/lib/store.ts).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITED = "Too many";

function ipHash(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return null;
  let salt = process.env.IP_HASH_SALT ?? "";
  if (!salt) { try { salt = signingSecret(); } catch { /* no secret configured: unsalted */ } }
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

async function body(req: NextRequest) {
  try { return (await req.json()) as Record<string, unknown>; } catch { return null; }
}

function fail(message: string) {
  const limited = message.startsWith(LIMITED);
  return NextResponse.json({ error: limited ? message : "Something went wrong. Please try again." }, { status: limited ? 429 : 500 });
}

export async function POST(req: NextRequest) {
  const b = await body(req);
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const email = String(b.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: "Please check your email address." }, { status: 400 });
  if (b.adult !== true) return NextResponse.json({ error: "Nayboro is for people 18 and older." }, { status: 400 });
  if (typeof b.website === "string" && b.website) return NextResponse.json({ ok: true, refCode: "", city: null, metro: null, people: null }); // bot trap

  const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
  const hometown = typeof b.hometown === "string" ? b.hometown.slice(0, 200) : null;
  const ref = typeof b.ref === "string" ? b.ref.slice(0, 16) : null;
  const mailVia = process.env.RESEND_API_KEY ? "resend" : waitlistStore() === "sheet" && (process.env.UNSUBSCRIBE_SECRET || process.env.SHEET_WEBHOOK_SECRET) ? "sheet" : null;

  // ── Google Sheet ──
  if (waitlistStore() === "sheet") {
    const area = num(b.area_id) ? areaById(num(b.area_id)!) : null;
    const city = area ? `${area.name}, ${area.state}` : null, metro = area?.metro_name ?? null;
    try {
      // The email needs the invite code, which the sheet makes: build it with a placeholder and fill it in there.
      const mail = mailVia === "sheet" ? buildWaitlistEmail({ email, city, metro, refCode: "{{CODE}}" }) : null;
      const row = await sheet.join({ email, city, metro, homes: hometown, ref, ipHash: ipHash(req), mail: mail && { subject: mail.subject, html: mail.html, text: mail.text } });
      if (!row.already && mailVia === "resend") await sendEmail(buildWaitlistEmail({ email, city, metro, refCode: row.ref_code })).catch((e) => console.error("waitlist email failed", e.message));
      return NextResponse.json({ ok: true, refCode: row.ref_code, city, metro, people: null, already: row.already });
    } catch (e) {
      console.error("waitlist sheet", (e as Error).message);
      return fail(e instanceof SheetError ? e.message : "");
    }
  }

  // ── Supabase ──
  const { data, error } = await createAdminClient().rpc("join_waitlist", {
    p_email: email, p_hometown: hometown, p_place: num(b.place_id), p_area: num(b.area_id), p_ref: ref, p_ip_hash: ipHash(req),
  });
  if (error) return fail(error.message);
  const row = (data as { ref_code: string; city: string | null; metro_name: string | null; people_in_metro: number | null; already: boolean }[])[0];
  if (!row.already && mailVia === "resend") {
    try { await sendEmail(buildWaitlistEmail({ email, city: row.city, metro: row.metro_name, refCode: row.ref_code })); }
    catch (e) { console.error("waitlist email failed", (e as Error).message); }
  }
  return NextResponse.json({ ok: true, refCode: row.ref_code, city: row.city, metro: row.metro_name, people: row.people_in_metro, already: row.already });
}

// The optional "First name" box after joining. Needs the invite code too, which only the person who just joined has.
export async function PATCH(req: NextRequest) {
  const b = await body(req);
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const email = String(b.email ?? "").trim().toLowerCase();
  const ref = String(b.refCode ?? "").slice(0, 16);
  const name = String(b.firstName ?? "").trim().slice(0, 40);
  if (!EMAIL.test(email) || !ref) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  let updated = false;
  try {
    if (waitlistStore() === "sheet") updated = (await sheet.setName(email, ref, name)).updated;
    else {
      const { data, error } = await createAdminClient().rpc("waitlist_set_name", { p_email: email, p_ref: ref, p_name: name });
      if (error) throw error;
      updated = !!data;
    }
  } catch (e) {
    console.error("waitlist name", (e as Error).message);
    return NextResponse.json({ error: "We couldn't save that. Please try again." }, { status: 500 });
  }
  return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "We couldn't save that. Please try again." }, { status: 404 });
}
