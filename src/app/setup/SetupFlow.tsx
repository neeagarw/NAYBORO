"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import { shrinkImage } from "@/lib/geo";
import { APP, UI } from "@/config/app";

// Port of design/mockups/profile-setup.html: Roots → Interests → Now → You → Done.

export type Place = { id: number; city: string; region: string; country: string };
/** A US city and the metro area it belongs to (e.g. Fremont, CA · San Francisco Bay Area). */
export type Area = { id: number; name: string; state: string; metro_name: string; zip?: string | null };
export type InterestGroup = { title: string; items: { id: number; label: string }[] };
export type Level = "city" | "state" | "country";
export type Initial = {
  first: string; last: string; intro: string; areaId: number | null; level: Level;
  hasPhoto: boolean; roots: Place[]; interests: number[];
};

/** Unique storage path inside the user's own folder (the storage policy requires it). */
function newPhotoPath(userId: string) {
  return `${userId}/${crypto.randomUUID()}.jpg`;
}

const STEPS = ["Roots", "Interests", "Now", "You"];
const VISIBLE = UI.interestsVisible;

export function SetupFlow({ userId, initialArea, prefillRoot = null, prefillFirst = "", prefillLast = "", groups, initial, minInterests: MIN_INTERESTS, maxHometowns }: { userId: string; initialArea: Area | null; prefillRoot?: Place | null; prefillFirst?: string; prefillLast?: string; groups: InterestGroup[]; initial: Initial | null; minInterests: number; maxHometowns: number }) {
  const router = useRouter();
  const editing = !!initial;

  const [step, setStep] = useState(0);
  // roots
  const [roots, setRoots] = useState<Place[]>(initial?.roots ?? (prefillRoot ? [prefillRoot] : []));
  const [adding, setAdding] = useState(false);
  const [level, setLevel] = useState<Level>(initial?.level ?? "city");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  // interests
  const [picked, setPicked] = useState<number[]>(initial?.interests ?? []);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // now
  const [now, setNow] = useState<Area | null>(initialArea);
  const [typing, setTyping] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  // you
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [first, setFirst] = useState(initial?.first ?? prefillFirst);
  const [last, setLast] = useState(initial?.last ?? prefillLast);
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [adult, setAdult] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const introRef = useRef<HTMLTextAreaElement>(null);

  const searching = roots.length === 0 || adding;
  const [cityResults, setCityResults] = useState<Area[] | null>(null);
  const labels = useMemo(() => new Map(groups.flatMap((g) => g.items.map((i) => [i.id, i.label] as const))), [groups]);

  // Hometown search: prefix match on places, up to 5.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await getClient().from("places").select("id,city,region,country").ilike("city", `${q.replace(/[%_]/g, "")}%`).order("city").limit(UI.hometownResults + 3);
      if (live) setResults((data ?? []).filter((p) => !roots.some((r) => r.id === p.id)).slice(0, UI.hometownResults));
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [query, roots]);

  const displayName = first.trim() ? first.trim() + (last.trim() ? ` ${last.trim()[0].toUpperCase()}.` : "") : "You";
  const shownRoot = roots[0] ? (level === "city" ? roots[0].city : level === "state" ? roots[0].region : roots[0].country) : "Your roots";
  // Catalog order, so the preview doesn't reshuffle when an interest is toggled off and on.
  const order = useMemo(() => new Map(groups.flatMap((g) => g.items.map((i) => i.id)).map((id, n) => [id, n] as const)), [groups]);
  const firstThree = [...picked].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)).slice(0, 3).map((id) => labels.get(id)).filter(Boolean).join(" · ");

  function go(n: number) {
    setStep(n);
    setError(null);
    bodyRef.current?.scrollTo(0, 0);
  }

  // Typed city or ZIP: search every US city (debounced).
  useEffect(() => {
    const q = cityQuery.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await getClient().rpc("search_areas", { p_q: q, p_limit: 6 });
      if (live) setCityResults((data ?? []) as Area[]);
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [cityQuery]);

  function findCity() {
    setLocNote(null);
    if (!("geolocation" in navigator)) { setTyping(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Sent once to find the nearest city; the database returns the city and stores nothing.
        const { data } = await getClient().rpc("locate_area", { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
        setLocating(false);
        const hit = ((data ?? []) as Area[])[0];
        if (hit) { setNow(hit); setTyping(false); }
        else { setTyping(true); setLocNote("We couldn't match your location to a US city. Type your city or ZIP instead."); }
      },
      () => { setLocating(false); setTyping(true); setLocNote("We couldn't get your location. Type your city or ZIP instead."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const blob = await shrinkImage(f, UI.photoMaxPx);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("We couldn't read that photo. Try a different one.");
    }
  }

  async function finish() {
    setSaving(true);
    setError(null);
    let photoPath: string | null = null;
    if (photo) {
      photoPath = newPhotoPath(userId);
      const up = await getClient().storage.from("avatars").upload(photoPath, photo.blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) { setSaving(false); setError("Your photo didn't upload. Try again, or remove it for now."); return; }
    }
    const { error } = await getClient().rpc("save_profile", {
      p_first: first.trim(), p_last: last.trim(), p_intro: intro.trim(), p_photo: photoPath,
      p_area: now!.id, p_level: level, p_roots: roots.map((r) => r.id), p_interests: picked, p_adult: adult,
    });
    if (!error) await getClient().rpc("record_terms", { p_version: APP.termsVersion });   // proof of what was agreed, and when
    setSaving(false);
    if (error) { setError("Something went wrong saving your profile. Please try again."); return; }
    go(4);
  }

  // ───────── footer button ─────────
  let next: { label: React.ReactNode; disabled: boolean; onClick: () => void };
  if (step === 0) next = { label: "Continue", disabled: roots.length === 0, onClick: () => go(1) };
  else if (step === 1) next = { label: "Continue", disabled: picked.length < MIN_INTERESTS, onClick: () => go(2) };
  else if (step === 2)
    next = now
      ? { label: "Continue", disabled: false, onClick: () => go(3) }
      // While typing a city, the main button waits for a pick (it doesn't switch to GPS).
      : typing
        ? { label: "Continue", disabled: true, onClick: () => {} }
        : { label: locating ? "Finding your city..." : <><PinIcon />Find my city</>, disabled: locating, onClick: findCity };
  else if (step === 3) next = { label: saving ? "Saving..." : editing ? "Save" : "Finish", disabled: saving || !first.trim() || !adult, onClick: finish };
  // Full page load: the profile just changed, so every screen (and this one, if reopened) starts fresh.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate fresh load
  else next = { label: editing ? "Back to Nayboro" : "Start exploring", disabled: false, onClick: () => window.location.assign("/people") };

  const filteredCities = cityQuery.trim().length >= 2 ? cityResults ?? [] : [];

  return (
    <div className="app-frame">
      {step < 4 && (
        <div className="flex items-center gap-3.5 px-5 pb-1.5 pt-[18px]">
          {step > 0 ? (
            <button aria-label="Back" onClick={() => go(step - 1)} className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] border border-line bg-surface"><BackIcon /></button>
          ) : editing ? (
            <button aria-label="Close" onClick={() => router.push("/people")} className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] border border-line bg-surface"><BackIcon /></button>
          ) : null}
          <div className="grid flex-1 grid-cols-4 gap-1.5" aria-label="Setup progress">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-col gap-1.5">
                <i className={`h-1.5 rounded-[3px] ${i <= step ? "bg-green" : "bg-line"}`} />
                <span className={`text-xs ${i === step ? "font-bold text-green" : "font-medium text-muted"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <section ref={bodyRef} className={`flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 pt-[18px] ${step === 4 ? "items-center justify-center text-center" : ""}`}>
        {/* ───────── 1. ROOTS ───────── */}
        {step === 0 && (
          <>
            <div className="flex items-center gap-2 font-display text-[22px] font-extrabold tracking-[-0.4px]"><LogoMark size={34} />nayboro</div>
            <Heading title="Where are your roots?" lead="We use your hometown to find people from the same place who live near you." />

            {roots.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-live="polite">
                {roots.map((p) => (
                  <span key={p.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-green-tint pl-3.5 pr-1.5 text-sm font-bold text-green">
                    {p.city} <small className="font-semibold text-muted">{p.region}</small>
                    <button aria-label={`Remove ${p.city}`} onClick={() => { const r = roots.filter((x) => x.id !== p.id); setRoots(r); setAdding(r.length === 0); }} className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-green"><XIcon size={14} /></button>
                  </span>
                ))}
              </div>
            )}

            {searching && (
              <div className="flex flex-col gap-2">
                <label htmlFor="rootSearch" className="text-[13px] font-bold">{roots.length ? "Another place you call home" : "Hometown"}</label>
                <div className="flex h-[52px] items-center gap-2.5 rounded-2xl border-2 border-line bg-surface px-4 text-muted focus-within:border-green">
                  <SearchIcon />
                  <input id="rootSearch" ref={searchRef} type="text" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a city or town" className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none" />
                </div>
                <div className="flex flex-col gap-0.5 rounded-[18px] border border-line-soft bg-surface p-1.5">
                  {!query.trim() && <div className="p-3.5 text-sm text-muted">Type at least one letter. Pick the place you feel you are from.</div>}
                  {query.trim() && results && results.length === 0 && <div className="p-3.5 text-sm text-muted">No match yet. Try a nearby bigger city.</div>}
                  {query.trim() && results?.map((p) => (
                    <button key={p.id} onClick={() => { setRoots([...roots, p]); setAdding(false); setQuery(""); }} className="flex min-h-[60px] w-full items-center gap-3.5 rounded-[14px] px-3.5 py-2.5 text-left hover:bg-ground">
                      <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-radio" />
                      <span><b className="block text-base">{p.city}</b><small className="text-[13px] text-muted">{p.region}, {p.country}</small></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searching && roots.length < maxHometowns && (
              <button onClick={() => { setAdding(true); setTimeout(() => searchRef.current?.focus(), 30); }} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-green">
                <PlusIcon />Grew up in more than one place? Add another
              </button>
            )}

            {roots[0] && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-bold">Show on your profile as</span>
                <div className="grid grid-cols-3 gap-2">
                  {([["city", roots[0].city, "Shows your city"], ["state", roots[0].region, "Hides your city"], ["country", roots[0].country, "Country only"]] as const).map(([v, name, hint]) => (
                    <button key={v} aria-pressed={level === v} onClick={() => setLevel(v)} className={`flex min-w-0 flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left ${level === v ? "border-green bg-green-tint" : "border-line bg-surface"}`}>
                      <b className="text-[15px] [overflow-wrap:anywhere]">{name}</b><small className="text-xs text-muted">{hint}</small>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-line bg-surface px-3 py-2.5 text-[13px] text-muted">
                  Others will see: <strong className="text-ink">{displayName} · {shownRoot} → {now?.name ?? "your city"}</strong>
                </div>
              </div>
            )}
          </>
        )}

        {/* ───────── 2. INTERESTS ───────── */}
        {step === 1 && (
          <>
            <Heading title="What are you into?" lead="Pick three or more things you'd like to do with people nearby." />
            <div className="flex flex-col gap-3.5">
              {groups.map((g) => {
                const open = expanded[g.title];
                const shown = open ? g.items : g.items.slice(0, VISIBLE);
                const n = g.items.filter((i) => picked.includes(i.id)).length;
                return (
                  <div key={g.title} className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-[17px] font-bold">{g.title}</span>
                      <span className="rounded-full bg-orange-tint px-2.5 py-1 text-xs font-bold text-orange-text">{n ? `${n} picked` : "None yet"}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shown.map((i) => {
                        const on = picked.includes(i.id);
                        return (
                          <button key={i.id} aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== i.id) : [...picked, i.id])}
                            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-[15px] font-semibold ${on ? "border-green bg-green text-white" : "border-ground bg-ground"}`}>
                            {on && <CheckIcon />}{i.label}
                          </button>
                        );
                      })}
                      {!open && g.items.length > VISIBLE && (
                        <button onClick={() => setExpanded({ ...expanded, [g.title]: true })} className="min-h-11 px-2.5 text-sm font-bold text-green">Show {g.items.length - VISIBLE} more</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ───────── 3. NOW ───────── */}
        {step === 2 && (
          <>
            <Heading title="Where do you live now?" lead="We only need your city, so we can show you people and questions close by." />
            <div className="flex flex-col gap-4 rounded-3xl bg-green p-[18px] text-white">
              <span className="text-xs font-bold tracking-[1px] text-on-green-muted">WHAT OTHERS SEE</span>
              <div className="flex items-center gap-3">
                <Avatar photo={photo?.url} first={first} />
                <div><div className="text-lg font-bold">{displayName}</div><div className="text-[13px] text-on-green-muted">{firstThree}</div></div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-ink">
                <div><small className="block text-xs font-bold text-muted">From</small><b className="text-[17px]">{shownRoot}</b></div>
                <div aria-hidden="true" className="flex flex-1 items-center gap-1 text-orange-icon"><i className="flex-1 border-t-2 border-dashed border-orange" /><ArrowIcon size={18} /></div>
                <div className="text-right"><small className="block text-[11px] font-bold tracking-[.8px] text-muted">NOW IN</small><b className="text-[17px]">{now?.name ?? "?"}</b></div>
              </div>
            </div>

            {now && !typing && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-green-tint px-3.5 py-3 text-green">
                <CheckIcon size={18} />
                <span className="flex flex-col"><span className="text-[15px] font-semibold">You&apos;re in {now.name}, {now.state}</span><span className="text-[13px] font-medium">Part of {now.metro_name}</span></span>
              </div>
            )}

            {typing && (
              <div className="flex flex-col gap-2">
                {locNote && <p className="text-[13px] font-semibold text-orange-text">{locNote}</p>}
                <label htmlFor="citySearch" className="text-[13px] font-bold">Your city or ZIP</label>
                <div className="flex h-[52px] items-center rounded-2xl border-2 border-line bg-surface px-4 focus-within:border-green">
                  <input id="citySearch" ref={cityRef} type="text" autoComplete="off" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="e.g. Fremont or 94538" className="min-w-0 flex-1 bg-transparent text-base outline-none" />
                </div>
                <div className="flex flex-col gap-1.5" aria-live="polite">
                  {filteredCities.map((c) => (
                    <button key={`${c.id}-${c.zip ?? ""}`} aria-pressed={now?.id === c.id} onClick={() => setNow(c)}
                      className={`flex min-h-[52px] w-full flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left ${now?.id === c.id ? "border-green bg-green-tint" : "border-line-soft bg-surface"}`}>
                      <b className="text-[15px]">{c.name}, {c.state}{c.zip ? ` ${c.zip}` : ""}</b>
                      <span className="text-xs text-muted">{c.metro_name}</span>
                    </button>
                  ))}
                  {cityQuery.trim().length >= 2 && cityResults && filteredCities.length === 0 && <span className="text-[13px] text-muted">No US city or ZIP matches that yet. Check the spelling.</span>}
                  {cityQuery.trim().length < 2 && <span className="text-[13px] text-muted">Type at least 2 letters of your city, or your 5-digit ZIP.</span>}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-surface p-4">
              <span className="text-xs font-bold tracking-[1px] text-muted">NEVER SHOWN TO ANYONE</span>
              {["Your street or address", "How far you are from someone", "Where you are right now"].map((t) => (
                <div key={t} className="flex items-center gap-3 text-[15px]">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-orange-tint text-orange-icon"><NoIcon /></span>{t}
                </div>
              ))}
            </div>
            <p className="text-xs leading-[1.45] text-muted">We check your location once to find your city. It is not tracked in the background. Moving? Change your city any time.</p>
          </>
        )}

        {/* ───────── 4. YOU ───────── */}
        {step === 3 && (
          <>
            <Heading title="A little about you" lead="This is what people see when you say hi. Keep it friendly and short." />
            <div className="flex items-center gap-4">
              <div className="flex h-[88px] w-[88px] flex-none items-center justify-center overflow-hidden rounded-[26px] border-2 border-dashed border-photo-dash bg-orange-tint text-orange-icon">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved photo */}
                {photo ? <img src={photo.url} alt="Your photo" className="h-full w-full object-cover" /> : <PersonIcon />}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="photoInput" className="inline-flex h-11 cursor-pointer items-center gap-1.5 self-start rounded-[14px] border-2 border-green bg-surface px-4 text-sm font-bold text-green">
                  <PlusIcon size={16} />{photo || initial?.hasPhoto ? "Change photo" : "Add a photo"}
                </label>
                <input id="photoInput" type="file" accept="image/*" onChange={onPhoto} className="absolute h-px w-px opacity-0" />
                <span className="text-xs leading-[1.45] text-muted">People with a clear face photo get many more replies.</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-[13px] font-bold">First name</label>
              <input id="firstName" type="text" autoComplete="given-name" maxLength={30} value={first} onChange={(e) => setFirst(e.target.value)} className="h-[52px] w-full rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-green" />
              <label htmlFor="lastName" className="mt-1.5 text-[13px] font-bold">Last name</label>
              <input id="lastName" type="text" autoComplete="family-name" maxLength={30} value={last} onChange={(e) => setLast(e.target.value)} className="h-[52px] w-full rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-green" />
              <span className="text-xs text-muted">{first.trim() ? `Others see you as \u201c${displayName}\u201d` : "Others see your first name and last initial."}</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="intro" className="text-[13px] font-bold">Short intro <span className="font-medium text-muted">(optional)</span></label>
                <span className="text-xs text-muted">{intro.length}/160</span>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Intro ideas">
                {["Moved here from ", "Looking for ", "Ask me about "].map((s) => (
                  <button key={s} type="button" onClick={() => {
                    const v = (intro ? `${intro} ${s}` : s).slice(0, 160);
                    setIntro(v);
                    // Move the cursor into the box so typing continues the sentence (like the mockup).
                    introRef.current?.focus();
                    requestAnimationFrame(() => introRef.current?.setSelectionRange(v.length, v.length));
                  }} className="h-10 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold">+ {s.trim()}…</button>
                ))}
              </div>
              <textarea id="intro" ref={introRef} maxLength={160} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={`e.g. Weekend tennis, always up for chai. New to ${now?.name ?? "the area"}.`} className="min-h-[110px] w-full resize-none rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-base leading-normal outline-none focus:border-green" />
              <span className="text-xs text-muted">Please don&apos;t share your address, phone number or details about children.</span>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm leading-[1.45]">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="m-0 h-[22px] w-[22px] flex-none accent-green" />
              <span>
                I&apos;m 18 or older, and I agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener" className="font-semibold text-green underline">Terms</a>,{" "}
                <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-green underline">Privacy policy</a> and{" "}
                <a href="/guidelines" target="_blank" rel="noopener" className="font-semibold text-green underline">Community guidelines</a>.
              </span>
            </label>
            {error && <p role="alert" className="text-[13px] font-semibold text-warn">{error}</p>}
          </>
        )}

        {/* ───────── DONE ───────── */}
        {step === 4 && (
          <>
            <LogoMark size={72} />
            <Heading title={editing ? "Profile saved" : `You're in, ${first.trim() || "friend"}!`} lead="Here's how your profile looks to others." />
            <div className="flex w-full flex-col gap-3 rounded-3xl border border-line-soft bg-surface p-[18px] text-left">
              <div className="flex items-center gap-3">
                <Avatar photo={photo?.url} first={first} />
                <div><div className="text-lg font-bold">{displayName}</div><div className="text-[13px] text-muted">{shownRoot} → {now?.name}</div></div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-green-tint px-2.5 py-1 text-xs font-bold text-green">From {shownRoot}</span>
                {picked.slice(0, 4).map((id) => <span key={id} className="rounded-full bg-orange-tint px-2.5 py-1 text-xs font-bold text-orange-text">{labels.get(id)}</span>)}
              </div>
              <p className={`m-0 text-[15px] leading-normal ${intro ? "" : "text-muted"}`}>{intro || "Add a short intro any time from your profile."}</p>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col gap-2 border-t border-line-soft bg-ground px-5 pb-6 pt-3">
        {step === 1 && (
          <div className="flex items-center gap-2.5">
            <span>{Array.from({ length: MIN_INTERESTS }, (_, i) => i).map((i) => <i key={i} className={`mr-1 inline-block h-2 w-[22px] rounded ${i < picked.length ? "bg-orange" : "bg-line"}`} />)}</span>
            <span className="text-[13px] font-semibold text-green">{picked.length >= MIN_INTERESTS ? `${picked.length} picked. You can change these later.` : `Pick ${MIN_INTERESTS - picked.length} more to continue`}</span>
          </div>
        )}
        <button onClick={next.onClick} disabled={next.disabled} className="flex h-14 items-center justify-center gap-2 rounded-[18px] bg-green text-[17px] font-bold text-white disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">{next.label}</button>
        {step === 2 && (
          <button onClick={() => { const t = !typing; setTyping(t); setLocNote(null); if (t) setTimeout(() => cityRef.current?.focus(), 30); }} className="h-11 text-[15px] font-bold text-green">
            {typing ? "Use my location instead" : now ? "Not right? Type a city or ZIP" : "Type a city or ZIP instead"}
          </button>
        )}
      </div>
    </div>
  );
}

function Heading({ title, lead }: { title: string; lead: string }) {
  return (
    <div>
      <h1 className="m-0 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.5px]">{title}</h1>
      <p className="mt-1.5 text-[15px] leading-normal text-muted">{lead}</p>
    </div>
  );
}

function Avatar({ photo, first }: { photo?: string; first: string }) {
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-2xl bg-orange font-display text-lg font-extrabold text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved photo */}
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : (first.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

const svg = { "aria-hidden": true, fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const BackIcon = () => <svg {...svg} width="20" height="20" viewBox="0 0 24 24" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>;
const XIcon = ({ size = 16 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.6"><path d="M7 7l10 10M17 7L7 17" /></svg>;
const SearchIcon = () => <svg {...svg} width="20" height="20" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
const PlusIcon = ({ size = 18 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>;
const CheckIcon = ({ size = 16 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.6"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const ArrowIcon = ({ size = 20 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const PinIcon = () => <svg {...svg} width="20" height="20" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
const NoIcon = () => <svg {...svg} width="18" height="18" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>;
const PersonIcon = () => <svg {...svg} width="34" height="34" viewBox="0 0 24 24" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" /></svg>;
