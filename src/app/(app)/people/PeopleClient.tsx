"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { Avatar, Tag, XIcon, PlusIcon, useToast, doesLine, signPhotosClient } from "@/components/ui";
import { UI } from "@/config/app";

export type Person = {
  id: string; display_name: string; photo_path: string | null; intro: string | null; area_name: string; shown_root: string | null;
  is_new: boolean; roots_match: string | null; shared_interests: string[]; interests: string[]; score: number;
};
export type Hello = { id: string; from_id: string; display_name: string; photo_path: string | null; shown_root: string | null; message: string; common: string };
export type Counts = { city: string; city_count: number | null; region: string; region_count: number | null };

type Verbs = Record<string, string>;

/** What this person and I share. Same cap as the profile page's tiles, so counts match. */
function reasons(p: Person, verbs: Verbs): string[] {
  const out: string[] = [];
  if (p.roots_match?.startsWith("city:")) out.push(`Also from ${p.roots_match.slice(5)}`);
  else if (p.roots_match?.startsWith("region:")) out.push(`Both from ${p.roots_match.slice(7)}`);
  for (const i of p.shared_interests.slice(0, out.length ? 1 : 2)) out.push(doesLine(i, verbs));
  return out;
}
function whyLine(p: Person, area: string, verbs: Verbs) {
  const root = p.roots_match?.startsWith("city:") ? `From ${p.roots_match.slice(5)}` : p.roots_match ? p.roots_match.slice(7) : null;
  const i = p.shared_interests[0];
  if (root && i) return `${root} · ${i}`;
  if (root) return root;
  if (i) return `${doesLine(i, verbs)}${p.area_name === area ? ` in ${area}` : ""}`;
  return `Lives in ${p.area_name}`;
}

export function PeopleClient({ initial, hellos, counts, area, metro, myInterests, photos: initialPhotos, verbs }: {
  initial: Person[]; hellos: Hello[]; counts: Counts | null; area: string; metro: string; myInterests: string[]; photos: Record<string, string>; verbs: Verbs;
}) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [chip, setChip] = useState("foryou");
  const [people, setPeople] = useState(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [more, setMore] = useState(initial.length === UI.peoplePage);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [lastHidden, setLastHidden] = useState<string | null>(null);
  const [hello, setHello] = useState<{ state: "pending" | "accepted" | "hidden"; conv?: string }>({ state: "pending" });
  const [busy, setBusy] = useState(false);

  const newCount = initial.filter((p) => p.is_new).length;
  const chips: [string, string][] = [["foryou", "For you"]];
  if (newCount) chips.push(["new", "New"]);
  if (counts?.city_count) chips.push(["city", `${counts.city} · ${counts.city_count}`]);
  if (counts?.region_count) chips.push(["region", `${counts.region} · ${counts.region_count}`]);
  myInterests.slice(0, UI.peopleChips).forEach((i) => chips.push([i, i]));

  const suggestions = useMemo(
    () => (chip === "foryou" ? people.filter((p) => p.score > 1 && !hidden.includes(p.id)).slice(0, UI.suggestions) : []),
    [chip, people, hidden],
  );
  const list = useMemo(() => {
    const s = new Set(suggestions.map((p) => p.id));
    return people.filter((p) => !s.has(p.id) && !hidden.includes(p.id));
  }, [people, suggestions, hidden]);

  const titles: Record<string, string> = {
    foryou: "MORE PEOPLE NEAR YOU", new: "JUST JOINED",
    city: `FROM ${counts?.city?.toUpperCase()}, AROUND ${metro.toUpperCase()}`, region: `FROM ${counts?.region?.toUpperCase()}, AROUND ${metro.toUpperCase()}`,
  };
  const title = titles[chip] ?? `${verbs[chip] === "play" ? "PLAY" : "INTO"} ${chip.toUpperCase()} NEAR YOU`;

  async function load(next: string, offset: number) {
    setLoading(true);
    const { data, error } = await getClient().rpc("people_for_me", { p_filter: next === "foryou" ? null : next, p_limit: UI.peoplePage, p_offset: offset });
    setLoading(false);
    if (error) return toast("Couldn't load people. Please try again.");
    const rows = (data ?? []) as Person[];
    const signed = await signPhotosClient(rows.map((r) => r.photo_path));
    setPhotos((ph) => ({ ...ph, ...signed }));
    setPeople((prev) => (offset === 0 ? rows : [...prev, ...rows]));
    setMore(rows.length === UI.peoplePage);
  }
  function pick(next: string) {
    setChip(next);
    setPeople([]);
    load(next, 0);
  }
  async function hide(id: string) {
    setHidden((h) => [...h, id]); setLastHidden(id);
    const me = (await getClient().auth.getUser()).data.user!.id;
    await getClient().from("hidden_suggestions").insert({ profile_id: me, hidden_id: id });
  }
  async function undo() {
    if (!lastHidden) return;
    const id = lastHidden; setHidden((h) => h.filter((x) => x !== id)); setLastHidden(null);
    await getClient().from("hidden_suggestions").delete().eq("hidden_id", id);
  }
  async function accept(h: Hello) {
    setBusy(true);
    const { data, error } = await getClient().rpc("accept_hello", { h: h.id });
    setBusy(false);
    if (error) return toast("Couldn't accept. Please try again.");
    setHello({ state: "accepted", conv: data as string });
    toast(`You and ${h.display_name.split(" ")[0]} can chat now`);
  }
  async function notNow(h: Hello) {
    setHello({ state: "hidden" });
    await getClient().from("hellos").update({ status: "not_now", responded_at: new Date().toISOString() }).eq("id", h.id);
    router.refresh();
  }
  async function invite() {
    const url = `${location.origin}/?ref=invite`;
    const text = `Join me on Nayboro to meet people from ${counts?.city ?? "home"} around ${metro}: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: "Nayboro", text, url }); return; } catch { /* closed */ } }
    await navigator.clipboard?.writeText(text);
    toast("Invite link copied");
  }

  const h = hellos[0];
  return (
    <>
      <div className="-mt-1 flex gap-2 overflow-x-auto px-5 pb-2" role="toolbar" aria-label="Filter people">
        {chips.map(([k, label]) => (
          <button key={k} aria-pressed={chip === k} onClick={() => pick(k)}
            className={`inline-flex h-[42px] flex-none items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-bold ${chip === k ? "border-green bg-green text-white" : "border-line-soft bg-surface"}`}>{label}</button>
        ))}
      </div>

      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-5 pt-1.5">
        {chip === "foryou" && h && hello.state !== "hidden" && (
          <section aria-label="Said hi to you" className="flex flex-col gap-2.5 rounded-[22px] bg-orange-tint px-4 pb-4 pt-1.5">
            <div className="flex items-center justify-between">
              <b className="text-[13px] text-orange-text">Said hi to you</b>
              {hellos.length > 1 ? <Link href="/chats" className="flex min-h-11 items-center text-[13px] font-bold text-orange-text">+{hellos.length - 1} more ›</Link> : <span className="h-11" />}
            </div>
            <Link href={`/p/${h.from_id}`} className="flex items-start gap-3">
              <Avatar id={h.from_id} name={h.display_name} url={h.photo_path ? photos[h.photo_path] : null} size={44} radius={14} />
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-bold">{h.display_name} <span className="font-medium text-brown-text">· {h.shown_root}</span></span>
                <span className="text-sm leading-[1.4]">&ldquo;{h.message}&rdquo;</span>
              </span>
            </Link>
            {hello.state === "pending" ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => notNow(h)} className="h-11 rounded-[14px] bg-white text-sm font-bold text-orange-text">Not now</button>
                <button onClick={() => accept(h)} disabled={busy} className="h-11 rounded-[14px] bg-green text-sm font-bold text-white">Accept</button>
              </div>
            ) : (
              <Link href={`/chats/${hello.conv}`} className="flex h-11 items-center justify-center rounded-[14px] bg-green text-sm font-bold text-white">Open chat</Link>
            )}
          </section>
        )}

        {chip === "foryou" && (
          <section aria-label="Suggested for you" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-[1px] text-muted">SUGGESTED FOR YOU</span>
              {suggestions.length > 1 && <span className="text-xs text-muted">{suggestions.length} picked for you · swipe</span>}
            </div>
            <div className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1.5 pt-0.5">
              {suggestions.map((p) => {
                const r = reasons(p, verbs);
                return (
                  <div key={p.id} className="relative flex w-[208px] flex-none snap-start flex-col gap-2.5 rounded-[20px] border border-line-soft bg-surface p-3.5">
                    <button onClick={() => hide(p.id)} aria-label={`Hide ${p.display_name}`} className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl text-muted"><XIcon /></button>
                    <Link href={`/p/${p.id}`} className="flex flex-col gap-2">
                      <Avatar id={p.id} name={p.display_name} url={p.photo_path ? photos[p.photo_path] : null} size={44} radius={14} />
                      <span><b className="block text-base">{p.display_name}</b><span className="text-xs text-muted">{p.shown_root} → {p.area_name}</span></span>
                    </Link>
                    <Tag className="self-start">{r.length > 1 ? `${r.length} in common` : r[0]}</Tag>
                    <span className="h-9 overflow-hidden text-[13px] leading-[1.4] text-slate">{p.intro ? `“${p.intro}”` : ""}</span>
                    <Link href={`/p/${p.id}`} className="flex h-10 items-center justify-center rounded-xl bg-green text-sm font-bold text-white">Say hi</Link>
                  </div>
                );
              })}
              <div className="flex w-[180px] flex-none snap-start flex-col justify-between gap-2.5 rounded-[20px] bg-orange-tint p-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-orange-logo text-ink"><PlusIcon /></span>
                <b className="font-display text-[17px] leading-[1.2]">Know someone from {counts?.city ?? "home"} here?</b>
                <span className="text-xs text-brown-text">Invite them. Your list grows with every friend.</span>
                <button onClick={invite} className="flex h-11 items-center justify-center rounded-[14px] bg-white text-sm font-bold text-orange-text">Invite</button>
              </div>
            </div>
            {lastHidden && (
              <div className="flex items-center justify-between rounded-[14px] border border-dashed border-dash bg-surface py-1 pl-3 pr-1.5">
                <span className="text-[13px] text-muted">Hidden. We&apos;ll suggest fewer like that.</span>
                <button onClick={undo} className="min-h-11 px-2.5 text-[13px] font-bold text-green">Undo</button>
              </div>
            )}
          </section>
        )}

        <h2 className="m-0 text-xs font-bold tracking-[1px] text-muted">{title}</h2>
        {!loading && list.length === 0 && (
          <div className="rounded-[20px] border border-line-soft bg-surface p-4 text-sm leading-normal text-muted">
            Nobody here yet. Be one of the first, and invite a friend from home.
          </div>
        )}
        {list.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-surface p-3.5">
            <Link href={`/p/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar id={p.id} name={p.display_name} url={p.photo_path ? photos[p.photo_path] : null} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2"><b className="text-base">{p.display_name}</b>{p.is_new && <span className="rounded-full bg-orange-tint px-[7px] py-0.5 text-[11px] font-extrabold tracking-[.6px] text-orange-text">NEW</span>}</span>
                <span className="text-[13px] text-muted">{p.shown_root} → {p.area_name}</span>
                <span className="truncate text-[13px] font-semibold text-green">{whyLine(p, area, verbs)}</span>
              </span>
            </Link>
            <Link href={`/p/${p.id}`} aria-label={`Say hi to ${p.display_name}`} className="inline-flex h-11 flex-none items-center rounded-[14px] bg-green-tint px-4 text-sm font-bold text-green">Say hi</Link>
          </div>
        ))}
        {loading && <p className="py-3 text-center text-sm text-muted" role="status">Loading…</p>}
        {more && !loading && (
          <button onClick={() => load(chip, people.length)} className="h-12 rounded-2xl border-2 border-line bg-surface text-sm font-bold text-green">Show more people</button>
        )}
      </main>
      {toastNode}
    </>
  );
}
