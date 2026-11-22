"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { BackIcon, Tag, ago, friendly, useToast } from "@/components/ui";
import { EVENT_KINDS } from "@/config/app";
import { fmtIn, localToUtcIso } from "@/lib/time";

export type Report = { target_type: "profile" | "question" | "answer" | "message"; target_id: string; report_count: number; reasons: string[]; first_reported: string; owner_id: string | null; owner_name: string | null; owner_suspended: boolean; content: string | null; hidden: boolean | null };
export type Contact = { id: string; topic: string; body: string; reply_email: string; name: string | null; created_at: string; handled_at: string | null };
export type Paused = { id: string; name: string; suspended_at: string };
export type EventRow = { id: string; title: string; starts_at: string; place_name: string; price_label: string; kind: string; host_name: string; url: string; timezone: string };
export type WaitlistInfo = {
  mode: "waitlist" | "open"; total: number; last_7_days: number;
  by_metro: { metro: string; n: number }[];
  recent: { email: string; first_name: string | null; hometown: string | null; city: string | null; metro: string | null; created_at: string; invited: number }[];
  beta: string[];
};
export type AreaRow = { id: number; name: string; state: string; metro_name: string; timezone: string };

const KINDS = EVENT_KINDS;
const TYPE_LABEL: Record<Report["target_type"], string> = { profile: "Profile", question: "Question", answer: "Answer", message: "Message" };

export function AdminClient({ reports, contact, paused, events, waitlist }: { reports: Report[]; contact: Contact[]; paused: Paused[]; events: EventRow[]; waitlist: WaitlistInfo }) {
  const router = useRouter();
  const [toast, toastNode] = useToast("top");
  const [tab, setTab] = useState<"reports" | "messages" | "events" | "paused" | "waitlist">("reports");
  const [busy, setBusy] = useState(false);
  const openMsgs = contact.filter((c) => !c.handled_at).length;

  async function run(fn: () => PromiseLike<{ error: { message?: string } | null }>, done: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast(friendly(error, error.message ?? "Failed"));
    toast(done);
    router.refresh();
  }
  const sb = () => getClient();

  const tabs: [typeof tab, string][] = [["reports", `Reports · ${reports.length}`], ["messages", `Messages · ${openMsgs}`], ["events", `Events · ${events.length}`], ["paused", `Paused · ${paused.length}`], ["waitlist", `Waitlist · ${waitlist.total}`]];

  return (
    <div className="app-frame">
      <div className="flex flex-col gap-3 px-5 pb-2 pt-4">
        <div className="flex items-center gap-3">
          <Link href="/people" aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface"><BackIcon /></Link>
          <h1 className="m-0 font-display text-[28px] font-extrabold">Admin</h1>
        </div>
        <div className="-mx-5 flex gap-2 chip-row overflow-x-auto px-5">
          {tabs.map(([k, label]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} className={`inline-flex h-10 flex-none items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold ${tab === k ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}>{label}</button>
          ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-8 pt-1.5">
        {tab === "reports" && (
          <>
            {reports.length === 0 && <Empty text="No open reports. Nice." />}
            {reports.map((r) => (
              <article key={r.target_type + r.target_id} className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={r.report_count >= 3 ? "orange" : "plain"}>{TYPE_LABEL[r.target_type]} · {r.report_count} report{r.report_count > 1 ? "s" : ""}</Tag>
                  <span className="text-xs text-muted">{ago(r.first_reported)}</span>
                  {r.hidden && <Tag tone="plain">Hidden</Tag>}
                  {r.owner_suspended && <Tag tone="orange">Owner paused</Tag>}
                </div>
                <p className="m-0 whitespace-pre-wrap rounded-xl bg-ground p-3 text-sm leading-normal">{r.content ?? "(deleted)"}</p>
                <span className="text-[13px] text-muted">
                  By {r.owner_id ? <Link href={`/p/${r.owner_id}`} className="font-bold text-green">{r.owner_name}</Link> : "unknown"} · Reasons: {r.reasons.join(", ")}
                </span>
                <div className="flex flex-wrap gap-2">
                  <AdminBtn disabled={busy} onClick={() => run(() => sb().rpc("admin_resolve", { p_type: r.target_type, p_target: r.target_id, p_action: "dismiss" }), "Report dismissed")}>Dismiss</AdminBtn>
                  {(r.target_type === "question" || r.target_type === "answer") && !r.hidden && (
                    <AdminBtn disabled={busy} onClick={() => run(() => sb().rpc("admin_resolve", { p_type: r.target_type, p_target: r.target_id, p_action: "hide" }), "Hidden from everyone")}>Hide {r.target_type}</AdminBtn>
                  )}
                  {!r.owner_suspended && r.owner_id && (
                    <AdminBtn warn disabled={busy} onClick={() => confirm(`Pause ${r.owner_name}? They disappear for everyone and can't post or message.`) && run(() => sb().rpc("admin_resolve", { p_type: r.target_type, p_target: r.target_id, p_action: "suspend" }), `${r.owner_name} paused`)}>Pause account</AdminBtn>
                  )}
                </div>
              </article>
            ))}
          </>
        )}

        {tab === "messages" && (
          <>
            {contact.length === 0 && <Empty text="No messages yet." />}
            {contact.map((c) => (
              <article key={c.id} className={`flex flex-col gap-2 rounded-[20px] border border-line-soft p-4 ${c.handled_at ? "bg-ground" : "bg-surface"}`}>
                <div className="flex flex-wrap items-center gap-2"><Tag tone={c.topic === "safety" ? "orange" : "green"}>{c.topic}</Tag><span className="text-xs text-muted">{c.name ?? "Signed-out"} · {ago(c.created_at)}</span>{c.handled_at && <Tag tone="plain">Done</Tag>}</div>
                <p className="m-0 whitespace-pre-wrap text-sm leading-normal">{c.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`mailto:${c.reply_email}?subject=${encodeURIComponent("Re: your message to Nayboro")}`} className="inline-flex h-10 items-center rounded-xl bg-green-tint px-3.5 text-sm font-bold text-green">Reply to {c.reply_email}</a>
                  {!c.handled_at && <AdminBtn disabled={busy} onClick={() => run(() => sb().rpc("admin_mark_handled", { p: c.id }), "Marked done")}>Mark done</AdminBtn>}
                </div>
              </article>
            ))}
          </>
        )}

        {tab === "waitlist" && <Waitlist w={waitlist} busy={busy} run={run} />}

        {tab === "events" && <Events events={events} busy={busy} run={run} />}

        {tab === "paused" && (
          <>
            {paused.length === 0 && <Empty text="No paused accounts." />}
            {paused.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-line-soft bg-surface p-4">
                <span className="flex flex-col"><b>{p.name}</b><span className="text-xs text-muted">Paused {ago(p.suspended_at)}</span></span>
                <AdminBtn disabled={busy} onClick={() => run(() => sb().rpc("admin_unsuspend", { p: p.id }), `${p.name} restored`)}>Restore</AdminBtn>
              </div>
            ))}
          </>
        )}
      </main>
      {toastNode}
    </div>
  );
}

function Events({ events, busy, run }: { events: EventRow[]; busy: boolean; run: (fn: () => PromiseLike<{ error: { message?: string } | null }>, done: string) => void }) {
  const empty = { title: "", start: "", end: "", place: "", price: "Free", kind: "Sports", host: "", url: "" };
  const [city, setCity] = useState<AreaRow | null>(null);
  const [cityQ, setCityQ] = useState("");
  const [cityHits, setCityHits] = useState<AreaRow[]>([]);
  async function searchCity(q: string) {
    setCityQ(q); setCity(null);
    if (q.trim().length < 2) return setCityHits([]);
    const { data } = await getClient().rpc("search_areas", { p_q: q.trim(), p_limit: 6 });
    setCityHits((data ?? []) as AreaRow[]);
  }
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ready = city && f.title.trim() && f.start && f.place.trim() && f.host.trim() && /^https?:\/\//i.test(f.url.trim());
  const tz = city?.timezone ?? "UTC";
  const input = "h-11 w-full rounded-xl border-2 border-line bg-surface px-3 text-[15px] outline-none focus:border-green";

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => getClient().rpc("admin_add_event", {
            p_title: f.title, p_starts: localToUtcIso(f.start, tz), p_ends: f.end ? localToUtcIso(f.end, tz) : null,
            p_place: f.place, p_area: city!.id, p_price: f.price, p_kind: f.kind, p_host: f.host, p_url: f.url,
          }), "Event added");
          setF(empty); setCity(null); setCityQ(""); setCityHits([]);
        }}
        className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-surface p-4"
      >
        <b className="text-[15px]">Add an event</b>
        <span className="text-xs text-muted">Times are local to the event&apos;s city{city ? ` (${tz.replace("_", " ")})` : ""}. We list events and link to the organizer; we don&apos;t host.</span>
        <label className="text-[13px] font-bold">Title<input className={input} value={f.title} onChange={set("title")} placeholder="What is it?" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[13px] font-bold">Starts<input type="datetime-local" className={input} value={f.start} onChange={set("start")} /></label>
          <label className="text-[13px] font-bold">Ends (optional)<input type="datetime-local" className={input} value={f.end} onChange={set("end")} /></label>
        </div>
        <label className="text-[13px] font-bold">Place<input className={input} value={f.place} onChange={set("place")} placeholder="Venue or park, and city" /></label>
        <label className="text-[13px] font-bold">City
          <input className={input} value={city ? `${city.name}, ${city.state}` : cityQ} onChange={(e) => searchCity(e.target.value)} placeholder="Type a city or ZIP" autoComplete="off" />
        </label>
        {!city && cityHits.length > 0 && (
          <div className="flex flex-col gap-1" role="listbox" aria-label="Matching cities">
            {cityHits.map((c) => (
              <button type="button" role="option" aria-selected="false" key={`${c.id}`} onClick={() => { setCity(c); setCityHits([]); }} className="flex flex-col items-start rounded-xl bg-ground px-3 py-2 text-left">
                <b className="text-sm">{c.name}, {c.state}</b><span className="text-xs text-muted">{c.metro_name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[13px] font-bold">Kind<select className={input} value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="text-[13px] font-bold">Price<input className={input} value={f.price} onChange={set("price")} placeholder="Free" /></label>
        </div>
        <label className="text-[13px] font-bold">Organiser<input className={input} value={f.host} onChange={set("host")} placeholder="Who runs it" /></label>
        <label className="text-[13px] font-bold">Link to details<input className={input} value={f.url} onChange={set("url")} placeholder="https://..." /></label>
        <button disabled={!ready || busy} className="h-12 rounded-2xl bg-green text-base font-bold text-white disabled:bg-line disabled:text-muted">Add event</button>
      </form>
      {events.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-line-soft bg-surface p-4">
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="truncate">{e.title}</b>
            <span className="text-xs text-muted">{fmtIn(e.starts_at, e.timezone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {e.place_name}</span>
          </span>
          <AdminBtn warn disabled={busy} onClick={() => confirm(`Delete "${e.title}"?`) && run(() => getClient().rpc("admin_delete_event", { p: e.id }), "Event deleted")}>Delete</AdminBtn>
        </div>
      ))}
    </>
  );
}

function AdminBtn({ children, warn, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { warn?: boolean }) {
  return <button {...p} className={`inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-bold disabled:opacity-50 ${warn ? "bg-warn-tint text-warn" : "bg-ground text-ink"}`}>{children}</button>;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-[20px] border border-line-soft bg-surface p-4 text-sm text-muted">{text}</p>;
}

function Waitlist({ w, busy, run }: { w: WaitlistInfo; busy: boolean; run: (fn: () => PromiseLike<{ error: { message?: string } | null }>, done: string) => void }) {
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const sb = () => getClient();
  const beta = new Set(w.beta);
  const open = w.mode === "open";

  function csv() {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["email", "first name", "hometown", "city", "metro", "joined", "friends invited", "beta"], ...w.recent.map((r) => [r.email, r.first_name, r.hometown, r.city, r.metro, r.created_at, r.invited, beta.has(r.email) ? "yes" : ""])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "nayboro-waitlist.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="launchH" className={`flex flex-col gap-2 rounded-[22px] p-4 ${open ? "bg-green-tint" : "bg-orange-tint"}`}>
        <h2 id="launchH" className="m-0 text-base font-extrabold">{open ? "Nayboro is open to everyone" : "Pre-launch: waitlist only"}</h2>
        <p className="m-0 text-sm text-muted">{open ? "The home page shows the normal welcome and anyone can sign up." : "The home page is the \u201cJoin the community\u201d page. Only admins and beta testers can sign in to the app."}</p>
        {confirming ? (
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => { setConfirming(false); run(() => sb().rpc("admin_set_site_mode", { p_mode: open ? "waitlist" : "open" }), open ? "Back to waitlist mode" : "Nayboro is open"); }} className="h-11 flex-1 rounded-xl bg-ink text-sm font-bold text-white">{open ? "Yes, close sign-ups" : "Yes, open Nayboro"}</button>
            <button onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-bold">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className={`h-11 rounded-xl text-sm font-bold ${open ? "border border-line bg-surface" : "bg-green text-white"}`}>{open ? "Go back to waitlist mode" : "Open Nayboro to everyone"}</button>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] border border-line-soft bg-surface p-4"><b className="font-display text-[28px]">{w.total}</b><div className="text-[13px] text-muted">on the list</div></div>
        <div className="rounded-[18px] border border-line-soft bg-surface p-4"><b className="font-display text-[28px]">{w.last_7_days}</b><div className="text-[13px] text-muted">joined this week</div></div>
      </div>

      <section aria-labelledby="metroH" className="flex flex-col gap-2">
        <h2 id="metroH" className="m-0 text-base font-extrabold">Where they live</h2>
        {w.by_metro.length === 0 && <p className="m-0 text-sm text-muted">No sign-ups yet.</p>}
        {w.by_metro.map((m) => (
          <div key={m.metro} className="flex items-center gap-3 text-sm">
            <span className="w-40 flex-none truncate">{m.metro}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line-soft"><span className="block h-full rounded-full bg-green" style={{ width: `${Math.max(4, (m.n / Math.max(1, w.by_metro[0].n)) * 100)}%` }} /></span>
            <b className="w-10 text-right">{m.n}</b>
          </div>
        ))}
      </section>

      <section aria-labelledby="betaH" className="flex flex-col gap-2">
        <h2 id="betaH" className="m-0 text-base font-extrabold">Beta testers · {w.beta.length}</h2>
        <p className="m-0 text-[13px] text-muted">These emails can sign in before launch. Send them to the site and they log in with their email.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) { run(() => sb().rpc("admin_add_beta", { p_email: email.trim() }), "Beta tester added"); setEmail(""); } }} className="flex gap-2">
          <label className="sr-only" htmlFor="betaEmail">Beta tester email</label>
          <input id="betaEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 text-[15px] outline-none focus:border-green" />
          <button disabled={busy || !email.trim()} className="h-11 rounded-xl bg-green px-4 text-sm font-bold text-white disabled:opacity-50">Add</button>
        </form>
        {w.beta.map((b) => (
          <div key={b} className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-surface px-3 py-1.5 text-sm">
            <span className="truncate">{b}</span>
            <button disabled={busy} onClick={() => run(() => sb().rpc("admin_remove_beta", { p_email: b }), "Removed")} className="min-h-11 font-bold text-warn">Remove</button>
          </div>
        ))}
      </section>

      <section aria-labelledby="recentH" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 id="recentH" className="m-0 text-base font-extrabold">Latest sign-ups</h2>
          <button onClick={csv} disabled={!w.recent.length} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-bold disabled:opacity-50">Download CSV</button>
        </div>
        {w.recent.slice(0, 100).map((r) => (
          <div key={r.email} className="flex items-start justify-between gap-2 rounded-xl border border-line-soft bg-surface px-3 py-2">
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-sm">{r.first_name ? `${r.first_name} · ` : ""}{r.email}</b>
              <span className="text-xs text-muted">{[r.city ?? r.metro, r.hometown && `from ${r.hometown}`, r.invited ? `${r.invited} invited` : null, ago(r.created_at)].filter(Boolean).join(" · ")}</span>
            </span>
            {beta.has(r.email) ? <Tag tone="green">Beta</Tag> : (
              <button disabled={busy} onClick={() => run(() => sb().rpc("admin_add_beta", { p_email: r.email }), "Beta tester added")} className="min-h-11 flex-none text-sm font-bold text-green">Let in</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
