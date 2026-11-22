"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

// Email sign-in with a one-time code (no password, no magic link).
// A code works inside an installed home-screen app, where a magic link would open the browser instead.
// Supabase setup: Auth → Email Templates → "Magic Link" must include {{ .Token }} (see docs/SETUP.md).

const RESEND_SECONDS = 30;
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function LoginForm({ next, prelaunch = false }: { next: string; prelaunch?: boolean }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

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
          <form onSubmit={sendCode} className="flex flex-1 flex-col gap-5" noValidate>
            <div>
              <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.5px]">{prelaunch ? "Beta tester sign in" : "Log in or join"}</h1>
              <p className="mt-1.5 text-[15px] leading-normal text-muted">We&apos;ll email you a 6-digit code. No password to remember.</p>
            </div>
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
              {error && <span role="alert" className="text-[13px] font-semibold text-warn">{error}</span>}
            </div>
            <div className="flex-1" />
            <div className="flex flex-col gap-2">
              <button type="submit" disabled={busy || !email.trim()} className="flex h-14 items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white disabled:bg-line disabled:text-muted">
                {busy ? "Sending..." : "Send me a code"}
              </button>
              {prelaunch ? (
                <span className="text-center text-xs leading-[1.45] text-muted">Not a beta tester? <Link href="/" className="font-bold text-green underline">Join the waitlist</Link> and we&apos;ll email you when we open.</span>
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
