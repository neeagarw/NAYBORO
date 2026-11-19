"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { Avatar, Sheet, Tag, ago, useToast, PlusIcon, PinIcon, MaskIcon } from "@/components/ui";

export type Question = { id: string; body: string; details: string | null; topic: string; is_anonymous: boolean; author_id: string | null; author_name: string; area_label: string; is_mine: boolean; answer_count: number; created_at: string };
export type Answer = { id: string; question_id: string; author_id: string; display_name: string; photo_path: string | null; area_name: string; roots_tag: string | null; body: string; helpful_count: number; i_found_helpful: boolean; is_mine: boolean };
export type Event = { id: string; title: string; starts_at: string; ends_at: string | null; place_name: string; price_label: string; kind: string; host_name: string; url: string; interested_count: number | null; i_am_interested: boolean };

export const TOPIC_COLORS: Record<string, string> = {
  Groceries: "bg-green-tint text-green", Schools: "bg-blue-tint text-blue-text", Food: "bg-[#F7DDE4] text-[#7A2E44]",
  Immigration: "bg-[#E6E1F5] text-[#4A3A7A]", Travel: "bg-orange-tint text-orange-text", Sports: "bg-green-tint text-green",
  Housing: "bg-[#F7E7C6] text-[#6B4A0E]", "Life here": "bg-line-soft text-[#3B463F]", General: "bg-ground text-muted",
};
const TZ = "America/Chicago";
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, ...o });
const timeRange = (e: Event) => {
  const t = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit" });
  return e.ends_at ? `${t(e.starts_at)} to ${t(e.ends_at)}` : t(e.starts_at);
};
/** Saturday or Sunday of the current week (Central time). */
function isThisWeekend(iso: string) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: TZ }));
  const sat = new Date(now); sat.setHours(0, 0, 0, 0); sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7) - (now.getDay() === 0 ? 7 : 0));
  const mon = new Date(sat); mon.setDate(sat.getDate() + 2);
  return d >= sat && d < mon;
}

export function ExploreClient({ initialTab, questions, answers, events, photos }: {
  initialTab: "q" | "e"; questions: Question[]; answers: Answer[]; events: Event[]; photos: Record<string, string>;
}) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [tab, setTab] = useState(initialTab);
  const [qChip, setQChip] = useState("All");
  const [eChip, setEChip] = useState("All");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [answering, setAnswering] = useState<Question | null>(null);
  const [ansText, setAnsText] = useState("");
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState<string[]>(events.filter((e) => e.i_am_interested).map((e) => e.id));

  const byQ = useMemo(() => {
    const m: Record<string, Answer[]> = {};
    for (const a of answers) (m[a.question_id] ??= []).push(a);
    return m;
  }, [answers]);
  const unanswered = questions.filter((q) => !byQ[q.id]?.length).length;
  const topics = [...new Set(questions.map((q) => q.topic))].filter((t) => t !== "General");
  const qList = questions.filter((q) => qChip === "All" || (qChip === "Unanswered" ? !byQ[q.id]?.length : q.topic === qChip));

  const kinds = [...new Set(events.map((e) => e.kind))];
  const eChips = ["All", "This weekend", "Free", ...kinds, `Interested`];
  const eList = events.filter((e) =>
    eChip === "All" || (eChip === "This weekend" ? isThisWeekend(e.starts_at) : eChip === "Free" ? e.price_label === "Free" : eChip === "Interested" ? liked.includes(e.id) : e.kind === eChip));

  function switchTab(t: "q" | "e") {
    setTab(t);
    router.replace(t === "e" ? "/explore?tab=events" : "/explore", { scroll: false });
  }
  async function postAnswer() {
    if (!answering) return;
    setPosting(true);
    const me = (await getClient().auth.getUser()).data.user!.id;
    const { error } = await getClient().from("answers").insert({ question_id: answering.id, author_id: me, body: ansText.trim() });
    setPosting(false);
    if (error) return toast("Couldn't post your answer. Please try again.");
    setOpen((o) => ({ ...o, [answering.id]: true }));
    setAnswering(null); setAnsText("");
    toast("Answer posted");
    router.refresh();
  }
  async function toggleInterest(e: Event) {
    const on = liked.includes(e.id);
    setLiked((l) => (on ? l.filter((x) => x !== e.id) : [...l, e.id]));
    const sb = getClient();
    const me = (await sb.auth.getUser()).data.user!.id;
    if (on) await sb.from("event_interest").delete().eq("event_id", e.id).eq("profile_id", me);
    else await sb.from("event_interest").insert({ event_id: e.id, profile_id: me });
  }

  const chipCls = (on: boolean) => `inline-flex h-10 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-surface"}`;

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-2">
        <div className="flex gap-[22px] border-b border-line" role="tablist">
          {(["q", "e"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
              className={`h-[42px] border-b-[3px] px-0.5 text-[15px] ${tab === t ? "border-green font-bold text-ink" : "border-transparent font-semibold text-muted"}`}>
              {t === "q" ? "Questions" : "Events"}
            </button>
          ))}
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {tab === "q"
            ? ["All", "Unanswered", ...topics].map((n) => (
                <button key={n} aria-pressed={qChip === n} onClick={() => setQChip(n)} className={chipCls(qChip === n)}>
                  {n}{n === "Unanswered" && unanswered > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-[5px] text-xs text-ink">{unanswered}</span>}
                </button>
              ))
            : eChips.map((n) => (
                <button key={n} aria-pressed={eChip === n} onClick={() => setEChip(n)} className={chipCls(eChip === n)}>
                  {n === "Interested" ? `Interested · ${liked.length}` : n}
                </button>
              ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-[110px] pt-1.5">
        {tab === "q" && (
          <>
            {qList.length === 0 && <p className="px-2.5 py-8 text-center text-sm text-muted">Nothing here yet. Ask the first question on this topic.</p>}
            {qList.map((q) => {
              const list = byQ[q.id] ?? [];
              const shown = open[q.id] ? list : list.slice(0, 1);
              return (
                <article key={q.id} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TOPIC_COLORS[q.topic] ?? TOPIC_COLORS.General}`}>{q.topic}</span>
                    <span className="inline-flex items-center gap-[5px]">
                      {q.is_anonymous && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-line-soft text-[#3B463F]"><MaskIcon size={13} /></span>}
                      {q.is_mine && q.is_anonymous ? "You (anonymous)" : q.author_name} · {q.area_label} · {ago(q.created_at)}
                    </span>
                  </div>
                  <h2 className="m-0 text-lg leading-[1.35]">{q.body}</h2>
                  {q.details && <p className="-mt-1 text-sm leading-normal text-[#3B463F]">{q.details}</p>}
                  {shown.map((a) => (
                    <div key={a.id} className="flex gap-2.5 rounded-2xl bg-ground p-3">
                      <Link href={a.is_mine ? "/setup" : `/p/${a.author_id}`}><Avatar id={a.author_id} name={a.display_name} url={a.photo_path ? photos[a.photo_path] : null} size={34} radius={12} /></Link>
                      <div className="flex min-w-0 flex-col gap-1 text-sm leading-[1.45]">
                        <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                          <b>{a.is_mine ? "You" : a.display_name}</b><span className="text-muted">· lives in {a.area_name}</span>
                          {a.roots_tag && <Tag className="px-[7px] py-0.5 text-[11px]">{a.roots_tag}</Tag>}
                        </span>
                        <span className="whitespace-pre-wrap">{a.body}</span>
                        {a.helpful_count > 0 && <span className="text-xs text-muted">{a.helpful_count} found this helpful</span>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2.5">
                    {list.length === 0 ? <span className="text-[13px] text-muted">No answers yet</span>
                      : list.length === 1 ? <span />
                      : <button onClick={() => setOpen((o) => ({ ...o, [q.id]: !o[q.id] }))} className="min-h-11 text-sm font-bold text-green">{open[q.id] ? "Show less" : `See all ${list.length} answers`}</button>}
                    {!q.is_mine && <button onClick={() => { setAnswering(q); setAnsText(""); }} className="inline-flex h-11 flex-none items-center rounded-[14px] border-2 border-green bg-surface px-[18px] text-sm font-bold text-green">Answer</button>}
                  </div>
                </article>
              );
            })}
          </>
        )}

        {tab === "e" && (
          <>
            {["This weekend", "Coming up"].map((g) => {
              const part = eList.filter((e) => (g === "This weekend") === isThisWeekend(e.starts_at));
              if (!part.length) return null;
              return (
                <section key={g} className="flex flex-col gap-3.5">
                  <h2 className="mt-1.5 font-display text-[19px] font-extrabold">{g}</h2>
                  {part.map((e) => {
                    const on = liked.includes(e.id);
                    const n = e.interested_count != null ? e.interested_count + (on && !e.i_am_interested ? 1 : !on && e.i_am_interested ? -1 : 0) : null;
                    return (
                      <article key={e.id} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-surface p-3.5">
                        <div className="flex gap-3">
                          <div aria-hidden="true" className="w-14 flex-none self-start overflow-hidden rounded-2xl border border-line-soft text-center">
                            <b className="block bg-orange-logo py-1 text-[11px] tracking-[1px]">{fmt(e.starts_at, { month: "short" }).toUpperCase()}</b>
                            <i className="block pt-1 font-display text-2xl font-extrabold not-italic">{fmt(e.starts_at, { day: "numeric" })}</i>
                            <small className="block pb-1.5 text-[11px] font-bold text-muted">{fmt(e.starts_at, { weekday: "short" }).toUpperCase()}</small>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                            <h3 className="m-0 text-[17px] leading-[1.3]">{e.title}</h3>
                            <span className="text-[13px] text-muted">{timeRange(e)}</span>
                            <span className="flex items-center gap-[5px] text-[13px] text-muted"><PinIcon />{e.place_name}</span>
                            <span className="flex gap-1.5 pt-0.5"><Tag tone={e.price_label === "Free" ? "green" : "orange"}>{e.price_label}</Tag><Tag tone="blue">{e.kind}</Tag></span>
                          </div>
                        </div>
                        <span className="text-[13px] text-[#3B463F]">{n != null && n >= 5 ? `${n} interested` : "Be one of the first to show interest"}</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button aria-pressed={on} onClick={() => toggleInterest(e)} className={`flex h-11 items-center justify-center rounded-[14px] border-2 border-green text-sm font-bold ${on ? "bg-green text-white" : "bg-white text-green"}`}>{on ? "★ Interested" : "☆ I'm interested"}</button>
                          <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center rounded-[14px] bg-ground text-sm font-bold">Details ↗</a>
                        </div>
                        <span className="text-xs text-muted">Hosted by {e.host_name}</span>
                      </article>
                    );
                  })}
                </section>
              );
            })}
            {eList.length === 0 && <p className="px-2.5 py-8 text-center text-sm text-muted">No events here this week. New ones are added every few days.</p>}
            <div className="flex items-center gap-3 rounded-[18px] bg-green-tint p-3.5 text-[13px] leading-[1.45]">
              <span className="flex-1"><b>Know an event we should list?</b> Local organisers run these. We update the list every few days.</span>
              <Link href="/help?topic=event" className="inline-flex h-11 flex-none items-center rounded-[14px] bg-white px-4 text-sm font-bold text-green">Tell us</Link>
            </div>
          </>
        )}
      </main>

      {tab === "q" && (
        <Link href="/explore/ask" className="absolute bottom-[92px] right-5 z-[2] flex h-14 items-center gap-2 rounded-full bg-green pl-[18px] pr-[22px] text-base font-bold text-white shadow-[0_8px_20px_rgba(30,107,74,.35)]">
          <PlusIcon />Ask a question
        </Link>
      )}

      <Sheet open={!!answering} onClose={() => setAnswering(null)} label="Your answer" title="Your answer">
        <span className="text-sm text-muted">{answering?.body}</span>
        <label htmlFor="ansText" className="sr-only">Answer</label>
        <textarea id="ansText" maxLength={600} value={ansText} onChange={(e) => setAnsText(e.target.value)} placeholder="Share what you know" className="min-h-[110px] w-full resize-none rounded-2xl border-2 border-line bg-surface px-3.5 py-3 text-base leading-normal outline-none focus:border-green" />
        <span className="text-xs text-muted">Answers always show your name, so help stays trusted. Never ask for money or move people to private chats for jobs or visas.</span>
        <button onClick={postAnswer} disabled={posting || ansText.trim().length < 3} className="h-14 rounded-[18px] bg-green text-[17px] font-bold text-white disabled:bg-line disabled:text-muted">Post answer</button>
        <button onClick={() => setAnswering(null)} className="h-11 text-sm font-bold text-green">Cancel</button>
      </Sheet>
      {toastNode}
    </>
  );
}
