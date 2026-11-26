"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { fmtIn } from "@/lib/time";
import { Avatar, BackIcon, PersonPlusIcon, CalendarIcon, ThumbIcon, ago } from "@/components/ui";

export type Item = {
  kind: "answer" | "hello" | "accepted" | "helpful" | "new_people" | "event";
  actor_id: string | null; actor_name: string | null; actor_photo: string | null;
  detail: string | null; place: string | null; n: number | null; starts_at: string | null;
  link: string; at: string; unread: boolean;
};

const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const Tile = ({ tone, children }: { tone: "green" | "orange"; children: React.ReactNode }) => (
  <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-full ${tone === "green" ? "bg-green-tint text-green" : "bg-orange-tint text-orange-text"}`}>{children}</span>
);

function Row({ it, photos, tz, metro }: { it: Item; photos: Record<string, string>; tz: string; metro: string }) {
  const who = it.actor_name ?? "Someone";
  let icon: React.ReactNode, title: React.ReactNode, line: React.ReactNode = null;
  switch (it.kind) {
    case "answer":
      icon = <Avatar id={it.actor_id!} name={who} url={it.actor_photo ? photos[it.actor_photo] : null} size={48} radius={999} />;
      title = <><b>{who}</b> answered your question</>;
      line = it.detail && <span className="text-muted">&ldquo;{clip(it.detail)}&rdquo;</span>;
      break;
    case "hello":
      icon = <Avatar id={it.actor_id!} name={who} url={it.actor_photo ? photos[it.actor_photo] : null} size={48} radius={999} />;
      title = <><b>{who}</b> said hi</>;
      line = <span className="font-bold text-green">See their hi</span>;
      break;
    case "accepted":
      icon = <Avatar id={it.actor_id!} name={who} url={it.actor_photo ? photos[it.actor_photo] : null} size={48} radius={999} />;
      title = <><b>{who}</b> accepted your hi</>;
      line = <span className="font-bold text-green">Start chatting</span>;
      break;
    case "helpful":
      icon = <Tile tone="green"><ThumbIcon /></Tile>;
      title = it.n && it.n > 1 ? <>{it.n} people found your answer helpful</> : <>Someone found your answer helpful</>;
      line = it.detail && <span className="text-muted">&ldquo;{clip(it.detail)}&rdquo;</span>;
      break;
    case "new_people":
      // Never a number below 5 (safe_count): "New people from Rajasthan joined" instead.
      icon = <Tile tone="green"><PersonPlusIcon /></Tile>;
      title = it.n ? <><b>{it.n} new people from {it.detail}</b> joined around {metro}</> : <><b>New people from {it.detail}</b> joined around {metro}</>;
      break;
    case "event":
      icon = <Tile tone="orange"><CalendarIcon /></Tile>;
      title = <><b>{it.detail}</b> is {it.starts_at ? fmtIn(it.starts_at, tz, { weekday: "long" }) === fmtIn(new Date().toISOString(), tz, { weekday: "long" }) ? "today" : `this ${fmtIn(it.starts_at, tz, { weekday: "long" })}` : "soon"}</>;
      line = <span className="text-muted">You&apos;re interested{it.place ? ` · ${it.place}` : ""}{it.starts_at ? `, ${fmtIn(it.starts_at, tz, { hour: "numeric", minute: "2-digit" })}` : ""}</span>;
      break;
  }
  return (
    <Link href={it.link} className={`flex items-start gap-3.5 px-4 py-4 ${it.unread ? "bg-mist" : ""}`}>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-[16px] leading-snug">
        <span>{title}</span>
        {line && <span className="line-clamp-2 text-[15px]">{line}</span>}
        <span className="text-[14px] text-muted">{ago(it.at)}</span>
      </span>
      {it.unread && <span aria-label="New" className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-orange" />}
    </Link>
  );
}

function Group({ label, items, ...rest }: { label: string; items: Item[]; photos: Record<string, string>; tz: string; metro: string }) {
  if (!items.length) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <h2 className="m-0 text-xs font-bold tracking-[1px] text-muted">{label.toUpperCase()}</h2>
      <div className="overflow-hidden rounded-[20px] border border-line-soft bg-surface [&>a+a]:border-t [&>a+a]:border-line-soft">
        {items.map((it, i) => <Row key={`${it.kind}-${it.at}-${i}`} it={it} {...rest} />)}
      </div>
    </section>
  );
}

export function ActivityClient({ items: first, photos, tz, metro }: { items: Item[]; photos: Record<string, string>; tz: string; metro: string }) {
  const router = useRouter();
  const [items, setItems] = useState(first);
  // Seen once you've opened Activity: the dots stay on this visit, the bell dot goes away.
  useEffect(() => { void getClient().rpc("mark_activity_seen").then(({ error }) => { if (error) console.error("mark_activity_seen", error.message); }); }, []);
  const fresh = items.filter((i) => i.unread), earlier = items.filter((i) => !i.unread);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <button aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push("/explore"))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface"><BackIcon /></button>
        {fresh.length > 0 && (
          <button onClick={() => setItems(items.map((i) => ({ ...i, unread: false })))} className="min-h-11 px-1 text-[15px] font-bold text-green">Mark all read</button>
        )}
      </div>
      <h1 className="m-0 font-display text-[32px] font-extrabold tracking-[-0.5px]">Activity</h1>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-line-soft bg-surface px-6 py-10 text-center">
          <Tile tone="green"><PersonPlusIcon /></Tile>
          <b className="text-[17px]">Nothing new yet</b>
          <span className="text-[15px] text-muted">Answers to your questions, hellos and new people from home will show up here.</span>
        </div>
      ) : (
        <>
          <Group label="New" items={fresh} photos={photos} tz={tz} metro={metro} />
          <Group label="Earlier" items={earlier} photos={photos} tz={tz} metro={metro} />
        </>
      )}
    </div>
  );
}
