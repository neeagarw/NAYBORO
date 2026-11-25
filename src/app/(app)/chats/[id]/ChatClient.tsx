"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { Avatar, Sheet, MenuItem, friendly, useToast, BackIcon, MoreIcon, ShieldIcon, XIcon, ArrowIcon } from "@/components/ui";
import { SafetyTips } from "@/components/SafetyTips";
import { REPORT_REASONS, UI } from "@/config/app";

export type Header = { other_id: string; display_name: string; first_name: string; photo_path: string | null; subtitle: string; context: string; muted: boolean };
export type Msg = { id: string; sender_id: string; body: string; created_at: string };

const REASONS = REPORT_REASONS.chat;

function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date();
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const TIP_KEY = "nayboro.chatTipHidden";
function tipHidden() { try { return localStorage.getItem(TIP_KEY) === "1"; } catch { return false; } }
function subscribeTip(cb: () => void) {
  window.addEventListener(TIP_KEY, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(TIP_KEY, cb); window.removeEventListener("storage", cb); };
}

export function ChatClient({ conv, me, header: h, photoUrl, initial }: { conv: string; me: string; header: Header; photoUrl: string | null; initial: Msg[] }) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // The safety tip stays hidden once dismissed (this device, every chat). Tips stay one tap away in the ⋯ menu.
  const tip = !useSyncExternalStore(subscribeTip, tipHidden, () => false);
  const setTip = (show: boolean) => {
    try { localStorage.setItem(TIP_KEY, show ? "0" : "1"); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(TIP_KEY));
  };
  const [sheet, setSheet] = useState<null | "tips" | "more" | "report" | "block">(null);
  const [muted, setMuted] = useState(h.muted);
  const [older, setOlder] = useState(initial.length === UI.messagesPage);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const threadRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const add = useCallback((m: Msg) => setMsgs((list) => (list.some((x) => x.id === m.id) ? list : [...list, m])), []);

  // Stick to the bottom for new messages, but not when older ones are added at the top.
  const lastId = msgs[msgs.length - 1]?.id;
  useEffect(() => { threadRef.current?.scrollTo(0, threadRef.current.scrollHeight); }, [lastId]);

  async function loadOlder() {
    if (!msgs.length) return;
    setLoadingOlder(true);
    const el = threadRef.current; const before = el?.scrollHeight ?? 0;
    const { data } = await getClient().from("messages").select("id, sender_id, body, created_at")
      .eq("conversation_id", conv).lt("created_at", msgs[0].created_at).order("created_at", { ascending: false }).limit(UI.messagesPage);
    const rows = ((data ?? []) as Msg[]).reverse();
    setMsgs((list) => [...rows, ...list]);
    setOlder(rows.length === UI.messagesPage);
    setLoadingOlder(false);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before; });
  }

  // Mark read on open and whenever a message arrives; listen for new messages live.
  // Supabase only sends a request once it is awaited or .then() is called: a bare rpc() call does nothing.
  useEffect(() => {
    const sb = getClient();
    const markRead = () => { void sb.rpc("mark_read", { conv }).then(({ error }) => { if (error) console.error("mark_read", error.message); }); };
    markRead();
    const ch = sb.channel(`chat-${conv}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conv}` }, (p) => {
        add(p.new as Msg);
        markRead();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [conv, add]);

  function grow() {
    const t = inputRef.current; if (!t) return;
    t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  }
  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await getClient().from("messages").insert({ conversation_id: conv, sender_id: me, body }).select("id, sender_id, body, created_at").single();
    setSending(false);
    if (error) return toast(friendly(error, "Message not sent. Please try again."));
    add(data as Msg);
    setText(""); requestAnimationFrame(grow);
  }
  async function toggleMute() {
    const next = !muted; setMuted(next); setSheet(null);
    await getClient().from("conversation_members").update({ muted: next }).eq("conversation_id", conv).eq("profile_id", me);
    toast(next ? "Chat muted. You won't get notifications." : "Notifications are back on.");
  }
  async function report(reason: string) {
    const { error } = await getClient().from("reports").insert({ reporter_id: me, target_type: "profile", target_id: h.other_id, reason: `${reason} (from chat ${conv})` });
    setSheet(null); toast(error ? friendly(error) : "Thanks. Our team will review this.");
  }
  async function block() {
    await getClient().from("blocks").insert({ blocker_id: me, blocked_id: h.other_id });
    router.push("/chats");
  }

  // Which messages start a new day ("Today", "Yesterday", ...).
  const dayBreaks = useMemo(() => {
    const out: Record<string, string> = {};
    let last = "";
    for (const m of msgs) { const d = dayLabel(m.created_at); if (d !== last) out[m.id] = d; last = d; }
    return out;
  }, [msgs]);

  return (
    <div className="app-frame">
      <header className="flex items-center gap-2.5 border-b border-line-soft bg-surface px-3.5 pb-3 pt-3.5">
        <Link href="/chats" aria-label="Back to chats" className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px]"><BackIcon /></Link>
        <Avatar id={h.other_id} name={h.display_name} url={photoUrl} size={44} radius={14} />
        <Link href={`/p/${h.other_id}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="text-[17px]">{h.display_name}</b>
          <span className="truncate text-[13px] text-muted">{h.subtitle}</span>
        </Link>
        <button aria-label="More options for this chat" onClick={() => setSheet("more")} className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px]"><MoreIcon /></button>
      </header>

      <main ref={threadRef} aria-live="polite" className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-4 pt-3.5">
        {older && <button onClick={loadOlder} disabled={loadingOlder} className="mb-1 self-center rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold text-green">{loadingOlder ? "Loading…" : "Load earlier messages"}</button>}
        <span className="mb-1 self-center rounded-full bg-green-tint px-3 py-1.5 text-xs font-semibold text-green">{h.context}</span>
        {msgs.map((m) => {
          const day = dayBreaks[m.id];
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className="contents">
              {day && <span className="self-center pb-1 pt-2 text-xs font-semibold text-muted">{day}</span>}
              <div className={`max-w-[78%] whitespace-pre-wrap break-words px-3.5 py-[11px] text-[15px] leading-[1.45] ${mine ? "self-end rounded-[20px_20px_6px_20px] bg-green text-white" : "self-start rounded-[20px_20px_20px_6px] border border-line-soft bg-surface"}`}>{m.body}</div>
              <span className={`px-1.5 pb-1.5 text-[11px] text-muted ${mine ? "self-end" : "self-start"}`}>{time(m.created_at)}</span>
            </div>
          );
        })}
        {msgs.length === 0 && <p className="self-center pt-6 text-center text-sm text-muted">You&apos;re connected. Say hello!</p>}
        {tip && (
          <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl bg-green-tint py-1.5 pl-3 pr-1.5 text-green">
            <ShieldIcon />
            <span className="flex-1 text-[13px] text-ink">Keep personal details private until you trust someone.</span>
            <button onClick={() => setSheet("tips")} className="whitespace-nowrap text-[13px] font-bold underline">Safety tips</button>
            <button aria-label="Hide safety tip" onClick={() => setTip(false)} className="flex h-9 w-9 items-center justify-center"><XIcon size={16} /></button>
          </div>
        )}
      </main>

      <div className="flex items-end gap-2 border-t border-line-soft bg-surface px-3 pb-5 pt-2.5">
        <label htmlFor="msgInput" className="sr-only">Message</label>
        <textarea id="msgInput" ref={inputRef} rows={1} maxLength={2000} value={text} placeholder="Write a message"
          onChange={(e) => { setText(e.target.value); grow(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="max-h-[120px] min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-ground px-3.5 py-3 text-base leading-[1.4] outline-none focus:border-green" />
        <button aria-label="Send" onClick={send} disabled={!text.trim() || sending} className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-green text-white disabled:bg-line disabled:text-muted"><ArrowIcon /></button>
      </div>

      <SafetyTips open={sheet === "tips"} onClose={() => setSheet(null)} />
      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} label={h.display_name} title={h.display_name}>
        <Link href={`/p/${h.other_id}`} className="flex min-h-[52px] items-center rounded-[14px] bg-ground px-3.5 text-base font-semibold">View profile</Link>
        <MenuItem onClick={toggleMute}>{muted ? "Unmute chat" : "Mute chat"}</MenuItem>
        <MenuItem warn onClick={() => setSheet("report")}>Report {h.first_name}</MenuItem>
        <MenuItem warn onClick={() => setSheet("block")}>Block {h.first_name}</MenuItem>
        <button onClick={() => setSheet(null)} className="h-11 text-sm font-bold text-green">Cancel</button>
      </Sheet>
      <Sheet open={sheet === "report"} onClose={() => setSheet(null)} label={`Report ${h.first_name}`} title={`Report ${h.first_name}`}>
        <span className="text-[13px] text-muted">{h.first_name} won&apos;t know you reported them. In danger? Call 911 first.</span>
        {REASONS.map((r) => <MenuItem key={r} onClick={() => report(r)}>{r}</MenuItem>)}
        <button onClick={() => setSheet(null)} className="h-11 text-sm font-bold text-green">Cancel</button>
      </Sheet>
      <Sheet open={sheet === "block"} onClose={() => setSheet(null)} label={`Block ${h.first_name}`} title={`Block ${h.first_name}?`}>
        <span className="text-[15px] leading-normal text-muted">This chat closes for both of you and you won&apos;t see each other anywhere on Nayboro. {h.first_name} isn&apos;t told.</span>
        <button onClick={block} className="h-14 rounded-[18px] bg-warn text-base font-bold text-white">Block {h.first_name}</button>
        <button onClick={() => setSheet(null)} className="h-11 text-sm font-bold text-green">Cancel</button>
      </Sheet>
      {toastNode}
    </div>
  );
}
