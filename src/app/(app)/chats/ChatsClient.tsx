"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { Avatar, ShieldIcon, useToast, signPhotosClient } from "@/components/ui";
import { UI } from "@/config/app";
import { SafetyTips } from "@/components/SafetyTips";

export type Hello = { id: string; from_id: string; display_name: string; photo_path: string | null; shown_root: string | null; message: string; common: string };
export type Chat = { conversation_id: string; other_id: string; display_name: string; photo_path: string | null; last_body: string | null; last_from_me: boolean; last_at: string; unread: boolean; muted: boolean };
export type Sent = { id: string; to_id: string; display_name: string; photo_path: string | null };

/** "10:42 AM", "Yesterday", "Mon", "Nov 3". */
export function when(iso: string) {
  const d = new Date(iso), now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatsClient({ me, hellos, chats: initialChats, sent, photos: initialPhotos }: { me: string; hellos: Hello[]; chats: Chat[]; sent: Sent[]; photos: Record<string, string> }) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [gone, setGone] = useState<string[]>([]);
  const [tips, setTips] = useState(false);
  const [chats, setChats] = useState(initialChats);
  const [photos, setPhotos] = useState(initialPhotos);
  const [more, setMore] = useState(initialChats.length === UI.chatsPage);

  // Live updates, scoped to this person: hellos sent to me, and messages in my own chats only
  // (never a subscription to the whole messages table).
  const convIds = initialChats.slice(0, 100).map((c) => c.conversation_id).join(",");
  useEffect(() => {
    const sb = getClient();
    let ch = sb.channel(`chats-${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hellos", filter: `to_id=eq.${me}` }, () => router.refresh());
    if (convIds) ch = ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=in.(${convIds})` }, () => router.refresh());
    ch.subscribe();
    return () => { sb.removeChannel(ch); };
  }, [router, me, convIds]);

  async function loadMore() {
    const { data } = await getClient().rpc("my_chats", { p_limit: UI.chatsPage, p_offset: chats.length });
    const rows = (data ?? []) as Chat[];
    setPhotos({ ...photos, ...(await signPhotosClient(rows.map((r) => r.photo_path))) });
    setChats([...chats, ...rows]);
    setMore(rows.length === UI.chatsPage);
  }

  async function accept(h: Hello) {
    const { data, error } = await getClient().rpc("accept_hello", { h: h.id });
    if (error) return toast("Couldn't accept. Please try again.");
    toast(`You and ${h.display_name.split(" ")[0]} can chat now`);
    router.push(`/chats/${data}`);
  }
  async function notNow(h: Hello) {
    setGone((g) => [...g, h.id]);
    await getClient().from("hellos").update({ status: "not_now", responded_at: new Date().toISOString() }).eq("id", h.id);
    router.refresh();
  }

  const waiting = hellos.filter((h) => !gone.includes(h.id));
  return (
    <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-5 pt-1.5">
      {waiting.length > 0 && <span className="text-xs font-bold tracking-[1px] text-muted">SAID HI TO YOU · {waiting.length}</span>}
      {waiting.map((h) => (
        <section key={h.id} className="flex flex-col gap-2.5 rounded-[20px] bg-orange-tint p-3.5">
          <div className="flex items-start gap-3">
            <Link href={`/p/${h.from_id}`}><Avatar id={h.from_id} name={h.display_name} url={h.photo_path ? photos[h.photo_path] : null} size={44} radius={14} /></Link>
            <span className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-bold">{h.display_name} <span className="font-medium text-brown-text">· {h.shown_root}</span></span>
              <span className="self-start rounded-full bg-white px-2.5 py-1 text-xs font-bold text-green">{h.common}</span>
              <span className="text-sm leading-[1.4]">&ldquo;{h.message}&rdquo;</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => notNow(h)} className="h-11 rounded-[14px] bg-white text-sm font-bold text-orange-text">Not now</button>
            <button onClick={() => accept(h)} className="h-11 rounded-[14px] bg-green text-sm font-bold text-white">Accept</button>
          </div>
        </section>
      ))}

      <span className="text-xs font-bold tracking-[1px] text-muted">MESSAGES</span>
      {chats.length === 0 && (
        <div className="rounded-[20px] border border-line-soft bg-surface p-4 text-sm leading-normal text-muted">
          No chats yet. Say hi to someone on <Link href="/people" className="font-bold text-green">People</Link>. A chat opens when they accept.
        </div>
      )}
      {chats.map((c) => (
        <Link key={c.conversation_id} href={`/chats/${c.conversation_id}`} className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-surface p-3.5">
          <Avatar id={c.other_id} name={c.display_name} url={c.photo_path ? photos[c.photo_path] : null} />
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="flex items-center justify-between gap-2.5"><b className="text-base">{c.display_name}</b><span className="text-xs text-muted">{when(c.last_at)}</span></span>
            <span className={`truncate text-sm ${c.unread ? "font-semibold text-ink" : "text-muted"}`}>
              {c.last_body ? `${c.last_from_me ? "You: " : ""}${c.last_body}` : "Say hello 👋"}
            </span>
          </span>
          {c.unread && <span className="h-2.5 w-2.5 flex-none rounded-full bg-orange-logo" aria-label="Unread" />}
        </Link>
      ))}

      {more && <button onClick={loadMore} className="h-12 rounded-2xl border-2 border-line bg-surface text-sm font-bold text-green">Show older chats</button>}

      {sent.length > 0 && <span className="text-xs font-bold tracking-[1px] text-muted">WAITING FOR A REPLY</span>}
      {sent.map((s) => (
        <Link key={s.id} href={`/p/${s.to_id}`} className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-surface p-3.5">
          <Avatar id={s.to_id} name={s.display_name} url={s.photo_path ? photos[s.photo_path] : null} />
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]"><b className="text-base">{s.display_name}</b><span className="truncate text-sm text-muted">You said hi. The chat opens if they accept.</span></span>
        </Link>
      ))}

      <div className="flex items-center gap-2.5 rounded-2xl bg-green-tint px-3.5 py-3 text-[13px] leading-[1.45]">
        <span className="text-green"><ShieldIcon /></span>
        <span className="flex-1">Keep personal details private until you trust someone.</span>
        <button onClick={() => setTips(true)} className="whitespace-nowrap font-bold text-green">Safety tips</button>
      </div>
      <SafetyTips open={tips} onClose={() => setTips(false)} />
      {toastNode}
    </main>
  );
}
