"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { REPORT_REASONS, PHONE_VERIFICATION_LIVE, UI } from "@/config/app";
import { Sheet, MenuItem, friendly, useToast, bothLine, BackIcon, MoreIcon, ShieldIcon, ChatIcon, FlagIcon, BlockIcon, Avatar } from "@/components/ui";

export type Card = {
  id: string; display_name: string; first_name: string; photo_path: string | null; intro: string | null;
  area_name: string; shown_root: string | null; phone_verified: boolean; is_new: boolean; roots_match: string | null;
  interests: string[]; shared_interests: string[]; languages: string[]; my_languages: string[];
  shared_event: { title: string; mon: string; day: number } | null;
  hello_state: "none" | "sent" | "received" | "connected"; hello_id: string | null; conversation_id: string | null;
};

const REASONS = REPORT_REASONS.profile;

export function ProfileClient({ card: c, photoUrl, myArea, myRegion, verbs }: { card: Card; photoUrl: string | null; myArea: string; myRegion: string; verbs: Record<string, string> }) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [state, setState] = useState(c.hello_state);
  const [conv, setConv] = useState(c.conversation_id);
  const [sheet, setSheet] = useState<null | "hi" | "more" | "report" | "block">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // "You two have in common" tiles. The count on the People card uses the same rules.
  const tiles: { icon: "pin" | "ball" | "star"; text: string }[] = [];
  if (c.roots_match?.startsWith("city:")) tiles.push({ icon: "pin", text: `Both from ${c.roots_match.slice(5)}` });
  else if (c.roots_match?.startsWith("region:")) tiles.push({ icon: "pin", text: `Both from ${c.roots_match.slice(7)}` });
  c.shared_interests.slice(0, tiles.length ? 1 : 2).forEach((i) => tiles.push({ icon: verbs[i] === "play" ? "ball" : "star", text: bothLine(i, verbs) }));

  const starters = [
    c.shared_interests[0] && (verbs[c.shared_interests[0]] === "play" ? `Up for ${c.shared_interests[0].toLowerCase()} this weekend?` : `Fellow ${c.shared_interests[0].toLowerCase()} fan here! Want to meet up?`),
    c.roots_match && `Hi from a fellow ${c.roots_match.startsWith("city:") ? c.roots_match.slice(5) : myRegion} person in ${myArea}!`,
    c.shared_event && `Are you going to the ${c.shared_event.title.toLowerCase()}?`,
  ].filter(Boolean) as string[];
  if (starters.length < 2) starters.push(`Hi ${c.first_name}! I'm new around ${myArea}. Coffee sometime?`);

  async function sendHello() {
    setBusy(true);
    const { error } = await getClient().rpc("say_hi", { p_to: c.id, p_message: text.trim() });
    setBusy(false);
    if (error) return toast(friendly(error, "Couldn't send. Please try again."));
    setSheet(null); setState("sent"); toast(`Hello sent to ${c.first_name}`);
  }
  async function accept() {
    setBusy(true);
    const { data, error } = await getClient().rpc("accept_hello", { h: c.hello_id });
    setBusy(false);
    if (error) return toast("Couldn't accept. Please try again.");
    setConv(data as string); setState("connected"); toast(`You and ${c.first_name} can chat now`);
  }
  async function report(reason: string) {
    const me = (await getClient().auth.getUser()).data.user!.id;
    const { error } = await getClient().from("reports").insert({ reporter_id: me, target_type: "profile", target_id: c.id, reason });
    setSheet(null); toast(error ? friendly(error) : "Thanks. Our team will review this.");
  }
  async function block() {
    const me = (await getClient().auth.getUser()).data.user!.id;
    await getClient().from("blocks").insert({ blocker_id: me, blocked_id: c.id });
    setSheet(null);
    router.push("/people");
  }

  return (
    <div className="app-frame">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <button aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push("/people"))} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface"><BackIcon /></button>
        <button aria-label={`More options for ${c.first_name}`} onClick={() => setSheet("more")} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface"><MoreIcon /></button>
      </div>

      <main tabIndex={0} aria-label={`${c.display_name}'s profile`} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-6 pt-1">
        <section aria-labelledby="name" className="flex flex-col items-center gap-2.5 rounded-3xl border border-line-soft bg-surface px-[18px] py-[22px] text-center">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
            <img src={photoUrl} alt={`${c.first_name}'s photo`} className="h-[104px] w-[104px] rounded-[32px] object-cover" />
          ) : (
            <Avatar id={c.id} name={c.display_name} size={104} radius={32} />
          )}
          <h1 id="name" className="mt-1 font-display text-[30px] font-extrabold leading-none">{c.display_name}</h1>
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <span>{c.shown_root}</span><i aria-hidden="true" className="w-7 border-t-2 border-dashed border-orange" /><span>{c.area_name}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {/* "Phone verified" stays hidden until phone sign-in exists (docs/SPEC.md). */}
            {PHONE_VERIFICATION_LIVE && c.phone_verified && <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2.5 py-[5px] text-xs font-bold text-green"><ShieldIcon size={14} />Phone verified</span>}
            {c.is_new && <span className="rounded-full bg-ground px-2.5 py-[5px] text-xs font-bold text-muted">New</span>}
          </div>
        </section>

        {(tiles.length > 0 || c.shared_event) && (
          <section aria-label="What you have in common" className="flex flex-col gap-2.5 rounded-3xl bg-green-tint p-4">
            <span className="text-xs font-bold tracking-[1px] text-green">YOU TWO HAVE IN COMMON</span>
            {tiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {tiles.map((t) => (
                  <div key={t.text} className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-orange-tint text-orange-icon"><TileIcon kind={t.icon} /></span>
                    <b className="text-sm leading-[1.3]">{t.text}</b>
                  </div>
                ))}
              </div>
            )}
            {c.shared_event && (
              <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <div aria-hidden="true" className="w-[42px] flex-none overflow-hidden rounded-xl border border-line-soft text-center">
                  <div className="bg-orange-logo py-0.5 text-[9px] font-extrabold tracking-[1px]">{c.shared_event.mon}</div>
                  <div className="py-0.5 pb-[3px] font-display text-base font-extrabold">{c.shared_event.day}</div>
                </div>
                <span className="text-sm leading-[1.35]">Both interested in <b>{c.shared_event.title}</b></span>
              </div>
            )}
          </section>
        )}

        {c.intro && (
          <section className="rounded-3xl border border-line-soft bg-surface p-[18px]">
            <span className="text-xs font-bold tracking-[1px] text-muted">ABOUT</span>
            <p className="mt-2 text-[15px] leading-[1.55]">{c.intro}</p>
          </section>
        )}
        {c.interests.length > 0 && (
          <section className="rounded-3xl border border-line-soft bg-surface p-[18px]">
            <span className="text-xs font-bold tracking-[1px] text-muted">INTO</span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {c.interests.map((i) => <span key={i} className={`rounded-full px-3.5 py-2 text-sm font-semibold ${c.shared_interests.includes(i) ? "bg-green-tint text-green" : "bg-ground"}`}>{i}</span>)}
            </div>
          </section>
        )}
        {c.languages.length > 0 && (
          <section className="rounded-3xl border border-line-soft bg-surface p-[18px]">
            <span className="text-xs font-bold tracking-[1px] text-muted">SPEAKS</span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {c.languages.map((l) => <span key={l} className={`rounded-full px-3.5 py-2 text-sm font-semibold ${c.my_languages.includes(l) ? "bg-green-tint text-green" : "bg-ground"}`}>{l}</span>)}
            </div>
          </section>
        )}
      </main>

      <div className="flex flex-col gap-2 border-t border-line-soft bg-surface px-5 pb-6 pt-3">
        {state === "none" && <button onClick={() => setSheet("hi")} className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-green text-[17px] font-bold text-white"><ChatIcon />Say hi to {c.first_name}</button>}
        {state === "sent" && <button aria-disabled="true" className="flex h-14 w-full cursor-default items-center justify-center gap-2 rounded-[18px] bg-green-tint text-[17px] font-bold text-green"><ChatIcon />Hello sent</button>}
        {state === "received" && <button onClick={accept} disabled={busy} className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-green text-[17px] font-bold text-white"><ChatIcon />{c.first_name} said hi. Accept</button>}
        {state === "connected" && <Link href={`/chats/${conv}`} className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-green text-[17px] font-bold text-white"><ChatIcon />Open chat</Link>}
        <span className="text-center text-xs text-muted">
          {state === "none" && `Chat opens only if ${c.first_name} accepts.`}
          {state === "sent" && `We'll let you know when ${c.first_name} replies.`}
          {state === "received" && "Accepting opens a chat for both of you."}
          {state === "connected" && "You're connected."}
        </span>
      </div>

      <Sheet open={sheet === "hi"} onClose={() => setSheet(null)} label={`Say hi to ${c.first_name}`} title={`Say hi to ${c.first_name}`}>
        <span className="text-[13px] text-muted">Pick a starter or write your own. A short, specific hello gets the most replies.</span>
        <div className="flex flex-col gap-2">
          {starters.slice(0, 3).map((s) => (
            <button key={s} aria-pressed={text === s} onClick={() => setText(s)} className={`min-h-12 rounded-[14px] border-2 px-3.5 py-2.5 text-left text-[15px] ${text === s ? "border-green bg-green-tint" : "border-line-soft bg-ground"}`}>{s}</button>
          ))}
        </div>
        <label htmlFor="hiText" className="sr-only">Your message</label>
        <textarea id="hiText" maxLength={UI.helloMax} aria-describedby="hiCount" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a short hello" className="min-h-[90px] w-full resize-none rounded-2xl border-2 border-line bg-surface px-3.5 py-3 text-base leading-normal outline-none focus:border-green" />
        <span id="hiCount" aria-live="polite" className={`-mt-1 self-end text-xs ${text.length >= UI.helloMax ? "font-bold text-warn" : "text-muted"}`}>{text.length}/{UI.helloMax}</span>
        <button onClick={sendHello} disabled={busy || text.trim().length < 2} className="h-14 rounded-[18px] bg-green text-base font-bold text-white disabled:bg-line disabled:text-muted">Send hello</button>
        <button onClick={() => setSheet(null)} className="h-12 text-[15px] font-bold text-green">Cancel</button>
      </Sheet>

      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} label={c.display_name} title={c.display_name}>
        <MenuItem warn onClick={() => setSheet("report")}><FlagIcon />Report {c.first_name}</MenuItem>
        <MenuItem warn onClick={() => setSheet("block")}><BlockIcon />Block {c.first_name}</MenuItem>
        <button onClick={() => setSheet(null)} className="h-12 text-[15px] font-bold text-green">Cancel</button>
      </Sheet>

      <Sheet open={sheet === "report"} onClose={() => setSheet(null)} label={`Report ${c.first_name}`} title={`Report ${c.first_name}`}>
        <span className="text-[13px] text-muted">{c.first_name} won&apos;t know you reported them. In danger? Call 911 first.</span>
        {REASONS.map((r) => <MenuItem key={r} onClick={() => report(r)}>{r}</MenuItem>)}
        <button onClick={() => setSheet(null)} className="h-12 text-[15px] font-bold text-green">Cancel</button>
      </Sheet>

      <Sheet open={sheet === "block"} onClose={() => setSheet(null)} label={`Block ${c.first_name}`} title={`Block ${c.first_name}?`}>
        <span className="text-[15px] leading-normal text-muted">You won&apos;t see each other anywhere on Nayboro, and {c.first_name} can&apos;t message you. They aren&apos;t told.</span>
        <button onClick={block} className="h-14 rounded-[18px] bg-warn text-base font-bold text-white">Block {c.first_name}</button>
        <button onClick={() => setSheet(null)} className="h-12 text-[15px] font-bold text-green">Cancel</button>
      </Sheet>
      {toastNode}
    </div>
  );
}

function TileIcon({ kind }: { kind: "pin" | "ball" | "star" }) {
  const p = { "aria-hidden": true, width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (kind === "pin") return <svg {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
  if (kind === "ball") return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M5.5 6.5c3 2.5 3 8.5 0 11M18.5 6.5c-3 2.5-3 8.5 0 11" /></svg>;
  return <svg {...p}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>;
}
