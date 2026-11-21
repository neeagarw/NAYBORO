"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { APP } from "@/config/app";

// The public home page until launch (site_mode = 'waitlist'). Design: the two waitlist screens
// ("Join the waitlist" and "You're on the list").

export type City = { id: number; name: string; state: string; metro_name: string; zip?: string | null };
type Place = { id: number; city: string; region: string; country: string };
type Home = { key: number; text: string; place: Place | null };
type Done = { email: string; refCode: string; city: string | null; metro: string | null; already: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HOMES = 3;
/** City and hometown lookups go through /api/geo, which works with or without the database. */
async function geo<T>(params: Record<string, string>): Promise<T[]> {
  const res = await fetch(`/api/geo?${new URLSearchParams(params)}`).catch(() => null);
  return res?.ok ? ((await res.json()) as T[]) : [];
}

const CORAL = "#F2876B", TEAL = "#1F6F6B", WHITE = "#FFFFFF";

/** "Dallas–Fort Worth, TX" for a metro, "Marfa, TX" for a city outside any metro. */
function cityLabel(c: City, preferMetro: boolean) {
  if (preferMetro && !c.metro_name.startsWith("Rest of")) return c.metro_name.includes(",") ? c.metro_name : `${c.metro_name}, ${c.state}`;
  return `${c.name}, ${c.state}`;
}

export function ComingSoon({ refCode, signedInEmail, guessedCity, year, showLogin }: { refCode: string | null; signedInEmail: string | null; guessedCity: City | null; year: number; showLogin: boolean }) {
  const [done, setDone] = useState<Done | null>(null);

  return (
    <div className="min-h-dvh bg-mist text-ink">
      <div className="mx-auto max-w-[1400px] px-5 md:px-8 xl:px-0">
        <header className="flex items-center justify-between py-6 md:py-9">
          <span className="inline-flex items-center gap-2.5 font-display text-[26px] font-extrabold tracking-[-0.5px] md:text-[30px]">
            <LogoMark size={46} left={CORAL} right={TEAL} label={null} />nayboro
          </span>
          <a href={APP.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[16px] font-bold text-teal md:text-[19px]">
            Follow on Instagram
          </a>
        </header>

        {signedInEmail && (
          <div role="status" className="mb-5 rounded-2xl bg-teal-tint px-5 py-3 text-[15px] text-ink">
            You&apos;re signed in as <b>{signedInEmail}</b>, but Nayboro isn&apos;t open for everyone yet. Join the waitlist and we&apos;ll email you the day it opens.
            <form action="/auth/signout" method="post" className="inline"><button className="ml-1 font-bold text-teal underline">Log out</button></form>
          </div>
        )}

        <main className="grid items-stretch gap-6 lg:grid-cols-[723fr_647fr] lg:gap-[30px]">
          <Hero />
          <div id="join" className="rounded-[32px] border border-teal-line bg-white p-6 sm:p-10 md:rounded-[44px] md:p-[50px]">
            {done ? <Joined done={done} /> : <JoinForm refCode={refCode} onDone={setDone} defaultEmail={signedInEmail ?? ""} guessedCity={guessedCity} />}
          </div>
        </main>

        <footer className="flex flex-col gap-3 py-8 text-[15px] text-muted sm:flex-row sm:items-center sm:justify-between md:text-[17px]">
          <span>© {year} {APP.name} · 18+ only</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link href="/privacy" className="underline decoration-1 underline-offset-4 text-teal">Privacy policy</Link>
            <a href={`mailto:${APP.contactEmail}`} className="underline decoration-1 underline-offset-4 text-teal">Contact</a>
            {showLogin && <Link href="/login" className="underline decoration-1 underline-offset-4 text-muted">Beta tester log in</Link>}
          </nav>
        </footer>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero" className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[32px] bg-teal px-7 pb-40 pt-9 text-white md:rounded-[44px] md:px-[60px] md:pt-[60px] lg:min-h-[880px]">
      <span aria-hidden="true" className="absolute -right-[142px] -top-[125px] h-[300px] w-[300px] rounded-full bg-teal-dark md:h-[380px] md:w-[380px]" />
      <span aria-hidden="true" className="absolute -bottom-[200px] -left-[150px] h-[340px] w-[340px] rounded-full bg-teal-dark md:-bottom-[290px] md:-left-[165px] md:h-[480px] md:w-[480px]" />

      <div className="relative flex flex-col gap-7">
        <span className="self-start rounded-full bg-coral px-5 py-2 text-[15px] font-semibold text-coral-ink md:text-[17px]">Coming soon to {APP.launchMetro}</span>
        <h1 id="hero" className="m-0 font-display text-[46px] font-extrabold leading-[1.02] tracking-[-1.5px] sm:text-[58px] md:text-[68px] md:tracking-[-2.5px]">
          Your people are closer than you think.
        </h1>
        <p className="m-0 max-w-[36rem] text-[19px] leading-[1.6] text-on-teal-muted md:text-[22px]">
          Something new is on the way. Join the waitlist to get early access when we open in your city.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          <h2 className="m-0 text-[14px] font-bold uppercase tracking-[1.5px] text-on-teal-muted md:text-[15px]">A sneak peek</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {["People from back home, closer than you think", "Real answers from people nearby", "And much more"].map((t) => (
              <li key={t} className="flex items-center gap-4 text-[18px] font-semibold md:text-[20px]">
                <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full bg-coral" />{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <span aria-hidden="true" className="absolute bottom-[56px] right-[56px] md:bottom-[68px] md:right-[66px]">
        <LogoMark size={128} left={CORAL} right={WHITE} label={null} />
      </span>
    </section>
  );
}

const INPUT = "h-16 w-full rounded-2xl border-2 border-teal-line bg-white px-5 text-[18px] text-ink outline-none placeholder:text-muted focus:border-teal md:text-[19px]";
const LABEL = "text-[17px] font-bold md:text-[18px]";
const HINT = "m-0 text-[15px] text-muted md:text-[16px]";
const OPTIONS = "mt-2 flex flex-col gap-1 rounded-2xl border border-teal-line bg-white p-1.5 shadow-[0_10px_30px_rgba(23,32,27,.08)]";
const OPTION = "flex min-h-12 flex-col items-start justify-center rounded-xl px-4 py-2 text-left hover:bg-mist focus:bg-mist focus:outline-none";

function JoinForm({ refCode, onDone, defaultEmail, guessedCity }: { refCode: string | null; onDone: (d: Done) => void; defaultEmail: string; guessedCity: City | null }) {
  const [email, setEmail] = useState(defaultEmail);
  const [city, setCity] = useState<City | null>(guessedCity);
  const [cityText, setCityText] = useState(guessedCity ? cityLabel(guessedCity, true) : "");
  const [guessed, setGuessed] = useState(!!guessedCity);
  const [cityHits, setCityHits] = useState<City[]>([]);
  const [homes, setHomes] = useState<Home[]>([{ key: 0, text: "", place: null }]);
  const [adult, setAdult] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = cityText.trim();
    if (city || q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const data = await geo<City>({ kind: "city", q });
      if (live) setCityHits(data);
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [cityText, city]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!EMAIL.test(em)) return setError("Please check your email address.");
    if (!adult) return setError("Please confirm you're 18 or older.");
    setBusy(true); setError(null);
    const named = homes.map((h) => (h.place ? `${h.place.city}, ${h.place.region}` : h.text.trim())).filter(Boolean);
    const res = await fetch("/api/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, hometown: named.join(" · ") || null, place_id: homes.find((h) => h.place)?.place?.id ?? null, area_id: city?.id ?? null, ref: refCode, adult, website: trap }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Something went wrong. Please try again.");
    onDone({ ...(json as Omit<Done, "email">), email: em });
  }

  return (
    <form onSubmit={submit} method="post" action="#join" noValidate className="flex flex-col gap-6" aria-labelledby="joinTitle">
      <div className="flex flex-col gap-2">
        <h2 id="joinTitle" className="m-0 font-display text-[32px] font-extrabold tracking-[-0.8px] md:text-[38px]">Join the waitlist</h2>
        <p className={HINT}>It takes 20 seconds. We&apos;ll let you know the moment we open.</p>
      </div>

      <label className="flex flex-col gap-3"><span className={LABEL}>Email</span>
        <input className={INPUT} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </label>

      <div className="flex flex-col gap-3">
        <label htmlFor="city" className={LABEL}>Your city</label>
        <div>
          <input id="city" className={INPUT} autoComplete="off" role="combobox" aria-expanded={cityHits.length > 0} aria-controls="cityOptions" aria-autocomplete="list"
            value={cityText} placeholder="City or ZIP"
            onChange={(e) => { setCity(null); setGuessed(false); setCityText(e.target.value); if (e.target.value.trim().length < 2) setCityHits([]); }} />
          {cityHits.length > 0 && (
            <div id="cityOptions" role="listbox" aria-label="Cities" className={OPTIONS}>
              {cityHits.map((c) => (
                <button type="button" role="option" aria-selected="false" key={`${c.id}-${c.zip ?? ""}`} className={OPTION}
                  onClick={() => { setCity(c); setCityText(cityLabel(c, false)); setCityHits([]); }}>
                  <b className="text-[16px]">{c.name}, {c.state}{c.zip ? ` ${c.zip}` : ""}</b><span className="text-[13px] text-muted">{c.metro_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className={HINT}>
          {guessed ? "We filled this in from your location. Change it if it's not right."
            : city ? <>Part of <b className="font-semibold text-ink">{city.metro_name}</b>. We only use your city, never your address.</>
            : "Type your city or ZIP. We only use your city, never your address."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span id="homesLabel" className={LABEL}>Where&apos;s home for you?</span>
        {homes.map((h, i) => (
          <HomeField key={h.key} home={h} index={i} removable={homes.length > 1}
            onChange={(next) => setHomes((all) => all.map((x) => (x.key === h.key ? next : x)))}
            onRemove={() => setHomes((all) => all.filter((x) => x.key !== h.key))} />
        ))}
        {homes.length < MAX_HOMES && (
          <button type="button" onClick={() => setHomes((all) => [...all, { key: Math.max(...all.map((x) => x.key)) + 1, text: "", place: null }])}
            className="mt-2 inline-flex min-h-11 items-center self-start text-[17px] font-bold text-teal md:text-[19px]">
            + Add another home
          </button>
        )}
        <p className={HINT}>A city, state or country. Lots of people have more than one.</p>
      </div>

      {/* Bots fill every field; people never see this one. */}
      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>

      <label className="flex cursor-pointer items-center gap-4 text-[18px] font-medium md:text-[19px]">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="m-0 h-6 w-6 flex-none accent-teal" />
        I&apos;m 18 or older
      </label>

      {error && <p role="alert" className="m-0 text-[15px] font-semibold text-warn">{error}</p>}
      <button disabled={busy} className="flex h-[68px] items-center justify-center rounded-[18px] bg-teal text-[19px] font-bold text-white disabled:opacity-60 md:text-[21px]">
        {busy ? "Joining…" : "Join the waitlist"}
      </button>
      <p className="m-0 text-center text-[15px] leading-normal text-muted md:text-[16px]">
        We&apos;ll only email you about Nayboro&apos;s launch. No spam, unsubscribe anytime. <Link href="/privacy" className="text-teal underline underline-offset-2">Privacy policy</Link>
      </p>
    </form>
  );
}

function HomeField({ home, index, removable, onChange, onRemove }: { home: Home; index: number; removable: boolean; onChange: (h: Home) => void; onRemove: () => void }) {
  const [hits, setHits] = useState<Place[]>([]);
  const id = useId();
  const text = home.place ? `${home.place.city}, ${home.place.region}` : home.text;

  useEffect(() => {
    const q = home.text.trim();
    if (home.place || q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const data = await geo<Place>({ kind: "home", q });
      if (live) setHits(data);
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [home.text, home.place]);

  return (
    <div>
      <div className="flex gap-2">
        <input className={INPUT} autoComplete="off" role="combobox" aria-expanded={hits.length > 0} aria-controls={`${id}-opts`} aria-autocomplete="list"
          aria-labelledby={index ? undefined : "homesLabel"} aria-label={index ? `Home ${index + 1}` : undefined}
          value={text} placeholder={index ? "Another home" : "e.g. Jaipur, India"}
          onChange={(e) => { onChange({ ...home, text: e.target.value, place: null }); if (e.target.value.trim().length < 2) setHits([]); }} />
        {removable && (
          <button type="button" onClick={onRemove} aria-label={`Remove home ${index + 1}`} className="flex h-16 w-14 flex-none items-center justify-center rounded-2xl text-[26px] text-muted hover:bg-mist">×</button>
        )}
      </div>
      {!home.place && hits.length > 0 && (
        <div id={`${id}-opts`} role="listbox" aria-label="Places" className={OPTIONS}>
          {hits.map((p) => (
            <button type="button" role="option" aria-selected="false" key={p.id} className={OPTION} onClick={() => { onChange({ ...home, place: p }); setHits([]); }}>
              <b className="text-[16px]">{p.city}</b><span className="text-[13px] text-muted">{p.region}, {p.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Joined({ done }: { done: Done }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Only shown after a sign-up, so this always runs in the browser.
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const link = `${origin}/r/${done.refCode}`;
  const shown = link.replace(/^https?:\/\//, "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setNameError(null);
    const res = await fetch("/api/waitlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: done.email, refCode: done.refCode, firstName: name }) });
    setSaving(false);
    if (res.ok) setSaved(name.trim()); else setNameError("We couldn't save that. Please try again.");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { if (navigator.share) await navigator.share({ title: APP.name, url: link }).catch(() => {}); }
  }

  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="flex h-[70px] w-[70px] items-center justify-center rounded-[20px] bg-teal-tint text-teal" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-display text-[32px] font-extrabold tracking-[-0.8px] md:text-[38px]">{done.already ? "You're already on the list." : "You're on the list."}</h2>
        <p className="m-0 text-[17px] text-muted md:text-[19px]">
          We&apos;ll email you when Nayboro opens in {done.metro ? <b className="font-semibold text-ink">{done.metro}</b> : "your city"}.
        </p>
      </div>

      {saved ? (
        <p className="m-0 rounded-[28px] bg-mist px-7 py-6 text-[17px]">Thanks, <b>{saved}</b>! Our emails will say hi.</p>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3 rounded-[28px] bg-mist p-6 md:p-7">
          <span className="text-[14px] font-bold uppercase tracking-[1.5px] text-muted md:text-[15px]">Optional · helps us get ready</span>
          <label className="flex flex-col gap-3"><span className={LABEL}>First name</span>
            <input className={INPUT} autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="So our emails can say hi" />
          </label>
          {nameError && <p role="alert" className="m-0 text-[15px] font-semibold text-warn">{nameError}</p>}
          <button disabled={saving || !name.trim()} className="mt-1 h-[58px] self-start rounded-2xl border-2 border-teal bg-white px-7 text-[18px] font-bold text-teal disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-display text-[24px] font-extrabold md:text-[28px]">Want in sooner?</h3>
        <p className="m-0 text-[17px] leading-relaxed text-muted md:text-[19px]">Share your link with friends here. Every friend who joins moves you up the list.</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <code className="flex h-16 w-full min-w-0 items-center sm:flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-2xl border-2 border-dashed border-teal-line px-5 font-sans text-[17px] font-medium text-ink md:text-[19px]">{shown}</code>
          <button onClick={copy} className="h-16 flex-none rounded-2xl bg-coral px-7 text-[18px] font-bold text-coral-ink md:text-[19px]">{copied ? "Link copied" : "Copy link"}</button>
        </div>
      </div>
    </div>
  );
}
