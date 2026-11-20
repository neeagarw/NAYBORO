import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWaitlistEmail, sendEmail } from "@/lib/email";

// POST /api/waitlist  { email, hometown?, place_id?, area_id?, ref?, adult: true }
// Runs on the server so it can rate-limit by network (a salted hash of the IP, never the IP itself)
// and send the confirmation email. The database refuses direct sign-ups from browsers.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ipHash(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? process.env.UNSUBSCRIBE_SECRET ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: "Please check your email address." }, { status: 400 });
  if (body.adult !== true) return NextResponse.json({ error: "Nayboro is for people 18 and older." }, { status: 400 });
  if (typeof body.website === "string" && body.website) return NextResponse.json({ ok: true, refCode: "", city: null, metro: null, people: null }); // bot trap

  const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);
  const { data, error } = await createAdminClient().rpc("join_waitlist", {
    p_email: email,
    p_hometown: typeof body.hometown === "string" ? body.hometown.slice(0, 120) : null,
    p_place: num(body.place_id),
    p_area: num(body.area_id),
    p_ref: typeof body.ref === "string" ? body.ref.slice(0, 16) : null,
    p_ip_hash: ipHash(req),
  });
  if (error) {
    const limited = error.message.startsWith("Too many");
    return NextResponse.json({ error: limited ? error.message : "Something went wrong. Please try again." }, { status: limited ? 429 : 500 });
  }
  const row = (data as { ref_code: string; city: string | null; metro_name: string | null; people_in_metro: number | null; already: boolean }[])[0];

  // Confirmation email for new sign-ups only (best effort: the sign-up already worked).
  if (!row.already && process.env.RESEND_API_KEY) {
    try { await sendEmail(buildWaitlistEmail({ email, city: row.city, metro: row.metro_name, refCode: row.ref_code })); }
    catch (e) { console.error("waitlist email failed", (e as Error).message); }
  }
  return NextResponse.json({ ok: true, refCode: row.ref_code, city: row.city, metro: row.metro_name, people: row.people_in_metro, already: row.already });
}
