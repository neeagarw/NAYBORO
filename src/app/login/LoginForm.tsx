"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { safeNext } from "@/lib/safe-next";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

// Email sign-in with a one-time code (no password, no magic link).
// A code works inside an installed home-screen app, where a magic link would open the browser instead.
// Supabase setup: Auth → Email Templates → "Magic Link" must include {{ .Token }} (see docs/SETUP.md).

const RESEND_SECONDS = 30;
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const noSubscribe = () => () => {};
const readParam = (k: string) => () => new URLSearchParams(window.location.search).get(k) ?? "";

// The page around this form is static (it shows instantly). The few request-time details come from the browser:
// where to go after signing in (?next=), a failed Google sign-in (?error=google), and whether Nayboro is open yet.
export function LoginForm({ joinUrl = "/", betaCode = false, google = false }: { joinUrl?: string; betaCode?: boolean; google?: boolean }) {
  const next = safeNext(useSyncExternalStore(noSubscribe, readParam("next"), () => ""));
  const googleFailed = useSyncExternalStore(noSubscribe, readParam("error"), () => "") === "google";
  // Pre-launch wording by default (that's today); switches if the site reports it's open.
  const [prelaunch, setPrelaunch] = useState(true);
  useEffect(() => {
    let live = true;
    void getClient().rpc("site_mode").then(({ data }) => { if (live && data === "open") setPrelaunch(false); });
    return () => { live = false; };
  }, []);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownError = error ?? (googleFailed ? "Google sign-in didn't finish. Please try again, or use your email." : null);

  // "Continue with Google": Google confirms the email; /auth/callback turns that into a session.
  // The beta tester list and the 18+ box still apply afterwards.
  async function googleSignIn() {
    setBusy(true); setError(null);
    const { error: e } = await getClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: "select_account" } },
    });
    if (e) { setBusy(false); setError("Google sign-in isn't available right now. Please use your email."); }
  }
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Private beta: email + shared beta code, no email sent.
  const [beta, setBeta] = useState("");
  async function betaSignIn(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!validEmail(v)) return setError("Please check this email address.");
    if (!beta.trim()) return setError("Enter the beta code you were given.");
    setBusy(true);
    setError(null);
    const r = await fetch("/api/beta-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: v, code: beta }) }).catch(() => null);
    if (r?.ok) return window.location.assign(next);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    setError(j?.error ?? "We couldn't sign you in. Please try again.");
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const v = email.trim().toLowerCase();
    if (!validEmail(v)) return setError("Please check this email address.");
    setBusy(true);
    setError(null);
    const { error } = await getClient().auth.signInWithOtp({ email: v, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : "We couldn't send the code. Please try again.");
      return;
    }
    setEmail(v);
    setStep("code");
    setCode("");
    setWait(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    const { error } = await getClient().auth.verifyOtp({ email, token: value, type: "email" });
    if (error) {
      setBusy(false);
      setError("That code didn't work. Check it, or send a new one.");
      return;
    }
    // Full page load: the session cookie just changed, so every server check should see it fresh.
    window.location.assign(next);
  }

  function onCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 8);
    setCode(digits);
    setError(null);
    if (digits.length === 6 && !busy) verify(digits);
  }

  return (
    <div className="app-frame">
      <div className="px-5 pt-4">
        {step === "email" ? (
          <Link href="/" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface">
            <BackIcon />
          </Link>
        ) : (
          <button type="button" aria-label="Back" onClick={() => { setStep("email"); setError(null); }} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface">
            <BackIcon />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 pt-4">
        <Logo size={34} />

        {step === "email" ? (
          <form onSubmit={betaCode ? betaSignIn : sendCode} className="flex flex-1 flex-col gap-5" noValidate>
            <div>
              <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.5px]">{prelaunch ? "Beta tester sign in" : "Log in or join"}</h1>
              <p className="mt-1.5 text-[15px] leading-normal text-muted">{betaCode ? (google ? "Continue with Google, or use the email you were invited with and your beta code." : "Use the email you were invited with and the beta code we gave you.") : "We\u2019ll email you a 6-digit code. No password to remember."}</p>
            </div>
            {google && (
              <>
                <button type="button" onClick={googleSignIn} disabled={busy}
                  className="flex h-14 items-center justify-center gap-3 rounded-[18px] border-2 border-line bg-surface text-[16px] font-bold text-ink disabled:opacity-60">
                  <GoogleG /> Continue with Google
                </button>
                <div className="flex items-center gap-3 text-xs font-semibold text-muted" aria-hidden="true">
                  <span className="h-px flex-1 bg-line" />or use your email<span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-[13px] font-bold">Email</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@example.com"
                className="h-[52px] w-full rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-green"
              />
              {!betaCode && shownError && <span role="alert" className="text-[13px] font-semibold text-warn">{shownError}</span>}
            </div>
            {betaCode && (
              <div className="flex flex-col gap-2">
                <label htmlFor="betacode" className="text-[13px] font-bold">Beta code</label>
                <input
                  id="betacode"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={beta}
                  onChange={(e) => { setBeta(e.target.value); setError(null); }}
                  className="h-[52px] w-full rounded-2xl border-2 border-line bg-surface px-4 text-base uppercase tracking-[2px] outline-none focus:border-green"
                />
                {shownError && <span role="alert" className="text-[13px] font-semibold text-warn">{shownError}</span>}
              </div>
            )}
            <div className="flex-1" />
            <div className="flex flex-col gap-2">
              <button type="submit" disabled={busy || !email.trim() || (betaCode && !beta.trim())} className="flex h-14 items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white disabled:bg-line disabled:text-muted">
                {betaCode ? (busy ? "Signing in..." : "Sign in") : busy ? "Sending..." : "Send me a code"}
              </button>
              <span className="text-center text-xs leading-[1.45] text-muted">By continuing you agree to our <Link href="/terms" className="font-semibold text-green underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-green underline">Privacy policy</Link>.</span>
              {prelaunch ? (
                <span className="text-center text-xs leading-[1.45] text-muted">Not a beta tester? <a href={joinUrl} className="font-bold text-green underline">Join the waitlist</a> and we&apos;ll email you when we open.</span>
              ) : (
                <span className="text-center text-xs leading-[1.45] text-muted">New here? The same code creates your account. 18+ only.</span>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.5px]">Check your email</h1>
              <p className="mt-1.5 text-[15px] leading-normal text-muted">
                We sent a code to <b className="text-ink">{email}</b>. It can take a minute. Check spam too.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="code" className="text-[13px] font-bold">6-digit code</label>
              <input
                id="code"
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => onCode(e.target.value)}
                placeholder="••••••"
                className="h-[58px] w-full rounded-[18px] border-2 border-line bg-surface px-4 text-center font-display text-[26px] font-extrabold tracking-[10px] outline-none focus:border-green"
              />
              {error && <span role="alert" className="text-[13px] font-semibold text-warn">{error}</span>}
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setStep("email")} className="min-h-11 text-sm font-bold text-green">Use a different email</button>
              <button type="button" disabled={wait > 0 || busy} onClick={() => sendCode()} className="min-h-11 text-sm font-bold text-green disabled:text-muted">
                {wait > 0 ? `Send again in ${wait}s` : "Send a new code"}
              </button>
            </div>
            <div className="flex-1" />
            <button type="button" disabled={busy || code.length < 6} onClick={() => verify(code)} className="flex h-14 items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white disabled:bg-line disabled:text-muted">
              {busy ? "Checking..." : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Google's "G" mark, as Google's sign-in branding guidelines ask for on "Continue with Google" buttons. */
function GoogleG() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
