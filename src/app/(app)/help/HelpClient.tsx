"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { BackIcon, ShieldIcon, ArrowIcon, friendly } from "@/components/ui";

import { TOPICS } from "./topics";
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function HelpClient({ userId, email: initialEmail, initialTopic }: { userId: string; email: string; initialTopic: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validEmail(email.trim())) return setEmailError(true);
    setSending(true); setError(null);
    const { error } = await getClient().from("contact_messages").insert({ profile_id: userId, topic, body: message.trim(), reply_email: email.trim() });
    setSending(false);
    if (error) return setError(friendly(error, "We couldn't send that. Please try again."));
    setDone(true);
  }

  if (done) {
    return (
      <div className="app-frame">
        <section aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-3.5 px-7 py-8 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-green-tint text-green">
            <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h2 className="m-0 font-display text-[28px] font-extrabold">Thanks, we got it</h2>
          <p className="m-0 text-[15px] leading-normal text-muted">Someone on our team will read your message and reply to <b>{email}</b>.</p>
          <Link href="/people" className="flex h-16 w-full items-center justify-center rounded-[20px] bg-green text-lg font-bold text-white">Back to Nayboro</Link>
          <button onClick={() => { setMessage(""); setDone(false); }} className="h-12 text-[15px] font-bold text-green">Send another message</button>
        </section>
      </div>
    );
  }

  const placeholder = TOPICS.find(([k]) => k === topic)![2];
  return (
    <div className="app-frame">
      <div className="px-5 pb-1 pt-4">
        <button aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push("/people"))} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface"><BackIcon /></button>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-5 pb-7 pt-3">
        <div>
          <h1 className="m-0 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.5px]">Contact us</h1>
          <p className="mt-2 text-[15px] leading-normal text-muted">Tell us what&apos;s going on. A real person on our team reads every message.</p>
        </div>
        <div className="flex flex-col gap-2">
          <span id="topicLabel" className="text-sm font-bold">What&apos;s it about?</span>
          <div role="group" aria-labelledby="topicLabel" className="grid grid-cols-2 gap-2.5">
            {TOPICS.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={topic === k} onClick={() => setTopic(k)}
                className={`flex min-h-14 items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left text-[15px] font-bold ${topic === k ? "border-green bg-green text-white" : "border-line-soft bg-surface"}`}>
                <span className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] ${topic === k ? "bg-white/20 text-white" : "bg-ground text-green"}`}><TopicIcon k={k} /></span>
                {label}
              </button>
            ))}
          </div>
        </div>
        {topic === "safety" && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-orange-tint px-3.5 py-3 text-sm leading-[1.45] text-orange-ink">
            <span className="flex-none text-orange-icon"><ShieldIcon size={20} check={false} /></span>
            <span>About a specific person? The fastest way is to open their profile or chat, tap ⋯ and choose <b>Report</b>. In danger? Call 911 first.</span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between"><label htmlFor="message" className="text-sm font-bold">Your message</label><span className="text-[13px] text-muted">{message.length} of 1000</span></div>
          <textarea id="message" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={placeholder} className="min-h-[132px] w-full resize-none rounded-[18px] border-2 border-line bg-surface px-4 py-3.5 text-base leading-normal outline-none focus:border-green" />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-bold">Reply to</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(false); }} placeholder="you@example.com" className="h-[52px] w-full rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-green" />
          <span className="text-[13px] text-muted">We only use this to answer you.</span>
          {emailError && <span className="text-[13px] font-semibold text-warn">Please check this email address.</span>}
          {error && <span className="text-[13px] font-semibold text-warn">{error}</span>}
        </div>
        <button type="submit" disabled={sending || message.trim().length < 5 || !email.trim()} className="flex h-16 w-full items-center justify-center gap-2 rounded-[20px] bg-green text-lg font-bold text-white disabled:bg-line disabled:text-muted">Send message<ArrowIcon /></button>
        <div className="rounded-2xl bg-orange-tint p-3 text-center text-sm font-bold text-orange-text">In immediate danger? Call 911 first.</div>
      </form>
    </div>
  );
}

function TopicIcon({ k }: { k: string }) {
  const p = { "aria-hidden": true, width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (k) {
    case "account": return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" /></svg>;
    case "safety": return <svg {...p}><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /></svg>;
    case "event": return <svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>;
    case "broken": return <svg {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></svg>;
    case "idea": return <svg {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></svg>;
    default: return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
  }
}
