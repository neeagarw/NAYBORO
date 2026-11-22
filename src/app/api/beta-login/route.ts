import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isBetaSite } from "@/lib/store";
import { signingSecret } from "@/lib/email";

/**
 * Private beta sign-in without email: a tester types their email + the shared beta code.
 * Works only on the beta site (BETA_SITE=1) when BETA_LOGIN_CODE is set, and only for emails on
 * the beta tester list. 8 wrong tries from one network locks it out for 15 minutes.
 * Service role is used because the sign-in has to mint a session for the tester.
 */
const MAX_FAILS = 8;
const WINDOW_MIN = 15;
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digest = (s: string) => createHash("sha256").update(s).digest();

function ipHash(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  let salt = process.env.IP_HASH_SALT ?? "";
  if (!salt) { try { salt = signingSecret(); } catch { /* unsalted */ } }
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Which kind of Supabase key this is (never the key itself): "service_role", "anon", "secret key", ... */
function keyKind(k?: string) {
  if (!k) return "missing";
  if (k.startsWith("sb_secret_")) return "secret key";
  if (k.startsWith("sb_publishable_")) return "publishable key";
  try { return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role ?? "unknown jwt"; } catch { return "not a supabase key"; }
}

export async function POST(req: NextRequest) {
  const secret = process.env.BETA_LOGIN_CODE?.trim();
  if (!isBetaSite() || !secret) return NextResponse.json({ error: "not available" }, { status: 404 });

  let email = "", code = "";
  try { const j = await req.json(); email = String(j.email ?? "").trim().toLowerCase(); code = String(j.code ?? "").trim(); } catch { /* bad body */ }
  if (!validEmail(email) || !code) return NextResponse.json({ error: "Enter your email and the beta code." }, { status: 400 });

  const admin = createAdminClient();
  const ip = ipHash(req);
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { data: fails, error: setupErr } = await admin.from("beta_login_attempts").select("id").eq("ip_hash", ip).gte("at", since).limit(MAX_FAILS);
  if (setupErr) {
    // Only the service role can read this table; anything else means SUPABASE_SERVICE_ROLE_KEY is wrong.
    console.error("beta-login setup", setupErr.message, "| server key type:", keyKind(process.env.SUPABASE_SERVICE_ROLE_KEY));
    return NextResponse.json({ error: "Sign-in isn't set up correctly yet (server key). Please tell the Nayboro team." }, { status: 500 });
  }
  if ((fails?.length ?? 0) >= MAX_FAILS) return NextResponse.json({ error: "Too many tries. Please wait 15 minutes." }, { status: 429 });

  const codeOk = timingSafeEqual(digest(code.toUpperCase()), digest(secret.toUpperCase()));
  const { data: listed } = await admin.from("beta_testers").select("email").eq("email", email).maybeSingle();
  if (!codeOk || !listed) {
    await admin.from("beta_login_attempts").insert({ ip_hash: ip });
    return NextResponse.json({ error: codeOk ? "This email isn't on the beta tester list yet." : "That beta code didn't work." }, { status: 401 });
  }

  // Make sure the account exists, then sign in with a one-time token (nothing is emailed).
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("beta-login link", linkErr?.message);
    return NextResponse.json({ error: "We couldn't sign you in. Please try again." }, { status: 500 });
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    console.error("beta-login verify", error.message);
    return NextResponse.json({ error: "We couldn't sign you in. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
