"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { APP } from "@/config/app";

// The public home page until launch (site_mode = 'waitlist'). Design: the two waitlist screens
// ("Join the waitlist" and "You're on the list").

export type City = { id: number; name: string; state: string; metro_name: string; zip?: string | null };
type Place = { id: number; city: string; region: string; country: string };
type Home = { text: string; place: Place | null };
type Done = { email: string; refCode: string; city: string | null; metro: string | null; already: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

/** `beta` turns this into the private beta's front page: same story on the left, tester sign-in on the right. */
export function ComingSoon({ refCode, signedInEmail, guessedCity, year, showLogin, beta }: { refCode: string | null; signedInEmail: string | null; guessedCity: City | null; year: number; showLogin: boolean; beta?: { notListedEmail: string | null; joinUrl: string } }) {
  const [done, setDone] = useState<Done | null>(null);

  return (
    <div className="min-h-dvh bg-mist text-ink">
      <div className="mx-auto max-w-[1480px] px-5 md:px-8 xl:px-10">
        <SiteHeader />

        {signedInEmail && (
          <div role="status" className="mb-5 rounded-2xl bg-teal-tint px-5 py-3 text-[15px] text-ink">
            You&apos;re signed in as <b>{signedInEmail}</b>, but Nayboro isn&apos;t open for everyone yet. Join the waitlist and we&apos;ll email you the day it opens.
            <form action="/auth/signout" method="post" className="inline"><button className="ml-1 font-bold text-teal underline">Log out</button></form>
          </div>
        )}

        <main className="grid items-stretch gap-6 md:grid-cols-[723fr_647fr] md:gap-5 xl:gap-[30px]">
          <Hero beta={!!beta} />
          <div id="join" className="rounded-[32px] border border-teal-line bg-white p-6 sm:p-9 md:rounded-[36px] md:p-8 xl:rounded-[44px] xl:p-10 short:p-7 short:xl:px-9 tiny:p-6 tiny:xl:px-8">
            {beta ? <BetaPanel {...beta} />
              : done ? <Joined done={done} /> : <JoinForm refCode={refCode} onDone={setDone} defaultEmail={signedInEmail ?? ""} guessedCity={guessedCity} />}
          </div>
        </main>

        <footer className="flex flex-col gap-3 py-8 text-[15px] text-muted sm:flex-row sm:items-center sm:justify-between md:text-[17px]">
          <span>© {year} {APP.name} · 18+ only</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link href="/privacy" className="underline decoration-1 underline-offset-4 text-teal">Privacy policy</Link>
            <Link href="/terms" className="underline decoration-1 underline-offset-4 text-teal">Terms</Link>
            <Link href="/guidelines" className="underline decoration-1 underline-offset-4 text-teal">Guidelines</Link>
            <a href={`mailto:${APP.contactEmail}`} className="underline decoration-1 underline-offset-4 text-teal">Contact: {APP.contactEmail}</a>
            {showLogin && <Link href="/login" className="underline decoration-1 underline-offset-4 text-muted">Beta tester log in</Link>}
          </nav>
        </footer>
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-5 xl:py-6 short:py-3 tiny:py-2">
      <span className="inline-flex items-center gap-2.5 font-display text-[26px] font-extrabold tracking-[-0.5px] md:text-[30px]">
        <LogoMark size={46} left={CORAL} right={TEAL} label={null} />nayboro
      </span>
      <a href={APP.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[16px] font-bold text-teal md:text-[19px]">
        Follow on Instagram
      </a>
    </header>
  );
}

/** What the home page shows while it loads: the real header and story, with the form area pulsing. */
export function ComingSoonShell({ beta }: { beta: boolean }) {
  return (
    <div className="min-h-dvh bg-mist text-ink" aria-busy="true">
      <div className="mx-auto max-w-[1480px] px-5 md:px-8 xl:px-10">
        <SiteHeader />
        <main className="grid items-stretch gap-6 md:grid-cols-[723fr_647fr] md:gap-5 xl:gap-[30px]">
          <Hero beta={beta} />
          <div className="flex flex-col gap-5 rounded-[32px] border border-teal-line bg-white p-6 sm:p-9 md:rounded-[36px] md:p-8 xl:rounded-[44px] xl:p-10" aria-label="Loading">
            {[60, 30, 100, 100, 100, 100].map((w, i) => <div key={i} className="animate-pulse rounded-2xl bg-line-soft" style={{ width: `${w}%`, height: i < 2 ? 22 : 52 }} />)}
          </div>
        </main>
      </div>
    </div>
  );
}

function Hero({ beta }: { beta: boolean }) {
  return (
    <section aria-labelledby="hero" className="relative flex flex-col overflow-hidden rounded-[32px] bg-teal px-7 pb-32 pt-8 text-white md:rounded-[36px] md:px-9 md:pb-40 md:pt-10 xl:rounded-[44px] xl:px-[60px] xl:pt-[52px] short:pb-28 short:pt-8 short:xl:pt-10 tiny:pb-24 tiny:pt-6 tiny:xl:pt-7">
      <span aria-hidden="true" className="absolute -right-[142px] -top-[125px] h-[300px] w-[300px] rounded-full bg-teal-dark md:h-[380px] md:w-[380px]" />
      <span aria-hidden="true" className="absolute -bottom-[200px] -left-[150px] h-[340px] w-[340px] rounded-full bg-teal-dark md:-bottom-[290px] md:-left-[165px] md:h-[480px] md:w-[480px]" />

      <div className="relative flex flex-col gap-6 xl:gap-7 short:gap-5 tiny:gap-4">
        <span className="self-start rounded-full bg-coral px-5 py-2 text-[15px] font-semibold text-coral-ink md:text-[17px]">{beta ? "Private beta" : `Coming soon to ${APP.launchMetro}`}</span>
        <h1 id="hero" className="m-0 font-display text-[44px] font-extrabold leading-[1.02] tracking-[-1.5px] sm:text-[54px] md:text-[46px] lg:text-[58px] xl:text-[68px] xl:tracking-[-2.5px] short:lg:text-[50px] short:xl:text-[56px] tiny:text-[40px] tiny:lg:text-[44px] tiny:xl:text-[48px]">
          Your people are closer than you think.
        </h1>
        <p className="m-0 max-w-[36rem] text-[19px] leading-[1.55] text-on-teal-muted xl:text-[21px] short:xl:text-[19px] tiny:text-[16px] tiny:xl:text-[17px]">
          {beta
            ? "Nayboro helps you meet people from your hometown who live near you, ask locals real questions, and find events worth showing up to. This is the test version."
            : "Something new is on the way. Join the waitlist to get early access when we open in your city."}
        </p>
        <div className="mt-1 flex flex-col gap-4 xl:mt-3 tiny:mt-0 tiny:gap-3 tiny:xl:mt-0">
          <h2 className="m-0 text-[14px] font-bold uppercase tracking-[1.5px] text-on-teal-muted md:text-[15px]">A sneak peek</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 tiny:gap-2">
            {["People from your hometown, closer than you think", "Real answers from people nearby", "Local events, picked by our team"].map((t) => (
              <li key={t} className="flex items-center gap-4 text-[17px] font-semibold xl:text-[19px]">
                <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full bg-coral" />{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <span aria-hidden="true" className="absolute bottom-[36px] right-[36px] origin-bottom-right scale-[.6] md:bottom-[44px] md:right-[44px] md:scale-75 xl:bottom-[60px] xl:right-[60px] xl:scale-100 short:scale-[.6] short:xl:bottom-[44px] short:xl:right-[44px] tiny:scale-50 tiny:bottom-[28px] tiny:right-[28px] tiny:xl:bottom-[32px] tiny:xl:right-[32px]">
        <LogoMark size={128} left={CORAL} right={WHITE} label={null} />
      </span>
    </section>
  );
}

const INPUT = "h-14 w-full rounded-2xl border-2 border-teal-line bg-white px-5 text-[17px] text-ink outline-none placeholder:text-muted focus:border-teal xl:h-[58px] xl:text-[18px] short:h-12 short:xl:h-12 short:text-[16px] short:xl:text-[16px] tiny:h-11 tiny:xl:h-11 tiny:rounded-xl";
const LABEL = "text-[16px] font-semibold xl:text-[17px] short:text-[15px] short:xl:text-[15px] tiny:text-[14px] tiny:xl:text-[14px]";
const HINT = "m-0 text-[14px] text-muted xl:text-[15px] short:text-[13px] short:xl:text-[13px]";
const OPTIONS = "mt-2 flex flex-col gap-1 rounded-2xl border border-teal-line bg-white p-1.5 shadow-[0_10px_30px_rgba(23,32,27,.08)]";
const OPTION = "flex min-h-12 flex-col items-start justify-center rounded-xl px-4 py-2 text-left hover:bg-mist focus:bg-mist focus:outline-none";

/** Keyboard for a suggestion list: ↓/↑ move, Enter picks, Escape closes. The input keeps focus (aria-activedescendant). */
function useListKeys<T>(items: T[], pick: (item: T) => void, close: () => void) {
  const [active, setActive] = useState(-1);
  const [seen, setSeen] = useState(items);
  if (seen !== items) { setSeen(items); setActive(-1); }   // new results: nothing highlighted yet
  function onKeyDown(e: React.KeyboardEvent) {
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") { close(); }
  }
  return { active, onKeyDown };
}

// "Dallas–Fort Worth" (data) and "Dallas-Fort Worth" (copy) are the same place.
const sameMetro = (a: string, b: string) => a.replace(/[\u2013\u2014-]/g, "-").toLowerCase() === b.replace(/[\u2013\u2014-]/g, "-").toLowerCase();

function BetaPanel({ notListedEmail, joinUrl }: { notListedEmail: string | null; joinUrl: string }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-display text-[30px] font-extrabold tracking-[-0.8px] xl:text-[36px]">You&apos;re early.</h2>
        <p className="m-0 text-[16px] leading-relaxed text-muted xl:text-[17px]">This test version is open to invited beta testers. Sign in with Google or with the email you were invited with.</p>
      </div>
      {notListedEmail && (
        <div role="alert" className="rounded-2xl border border-teal-line bg-mist p-4 text-[15px] leading-normal">
          <b>{notListedEmail}</b> isn&apos;t on the beta tester list yet. If you were invited, ask us to add this exact email.
        </div>
      )}
      <Link href="/login" className="flex h-14 items-center justify-center rounded-[16px] bg-teal text-[18px] font-bold text-white">
        {notListedEmail ? "Try another email" : "Beta tester sign in"}
      </Link>
      <hr className="m-0 border-0 border-t border-teal-line" />
      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[17px] font-bold">Want to help test?</h3>
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Email <a href={`mailto:${APP.contactEmail}?subject=Nayboro%20beta`} className="font-semibold text-teal underline underline-offset-2">{APP.contactEmail}</a> with
          your city. We&apos;re adding testers in {APP.launchMetro} first.
        </p>
      </div>
      <p className="m-0 mt-auto text-[15px] text-muted">
        Not ready to test? <a href={joinUrl} className="font-bold text-teal underline underline-offset-2">Join the waitlist</a> and we&apos;ll email you when we open.
      </p>
    </div>
  );
}

function JoinForm({ refCode, onDone, defaultEmail, guessedCity }: { refCode: string | null; onDone: (d: Done) => void; defaultEmail: string; guessedCity: City | null }) {
  const [first, setFirst] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [city, setCity] = useState<City | null>(guessedCity);
  const [cityText, setCityText] = useState(guessedCity ? cityLabel(guessedCity, false) : "");
  // "Use my location": the phone's position, sent once to find the city (same as the app's setup). Never stored.
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  function findMyCity() {
    if (!("geolocation" in navigator)) { setLocNote("Your browser can't share a location. Type your city or ZIP instead."); return; }
    setLocating(true); setLocNote(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const [hit] = await geo<City>({ kind: "locate", lat: String(coords.latitude), lng: String(coords.longitude) });
        setLocating(false);
        if (hit) { setCity(hit); setCityText(cityLabel(hit, false)); setCityHits([]); }
        else setLocNote("We couldn't match your location to a US city. Type your city or ZIP instead.");
      },
      () => { setLocating(false); setLocNote("We couldn't get your location. Type your city or ZIP instead."); },
      { maximumAge: 600000, timeout: 10000 },
    );
  }
  const [cityHits, setCityHits] = useState<City[]>([]);
  const pickCity = (c: City) => { setCity(c); setCityText(cityLabel(c, false)); setCityHits([]); };
  const cityKeys = useListKeys(cityHits, pickCity, () => setCityHits([]));
  const [home, setHome] = useState<Home>({ text: "", place: null });
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
    if (!EMAIL.test(em) && !adult) return setError("Please check your email address and confirm you're 18 or older.");
    if (!EMAIL.test(em)) return setError("Please check your email address.");
    if (!adult) return setError("Please confirm you're 18 or older.");
    setBusy(true); setError(null);
    const named = home.place ? `${home.place.city}, ${home.place.region}` : home.text.trim();
    const res = await fetch("/api/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, firstName: first.trim() || undefined, hometown: named || null, place_id: home.place?.id ?? null, area_id: city?.id ?? null, ref: refCode, adult, website: trap }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Something went wrong. Please try again.");
    onDone({ ...(json as Omit<Done, "email">), email: em });
  }

  return (
    <form onSubmit={submit} method="post" action="#join" noValidate className="flex flex-col gap-5 short:gap-4 tiny:gap-3" aria-labelledby="joinTitle">
      <div className="flex flex-col gap-2 short:gap-1">
        <h2 id="joinTitle" className="m-0 font-display text-[30px] font-extrabold tracking-[-0.8px] xl:text-[36px] short:text-[28px] short:xl:text-[30px] tiny:text-[26px] tiny:xl:text-[26px]">Join the waitlist</h2>
        <p className="m-0 text-[16px] text-muted xl:text-[17px] short:text-[15px] short:xl:text-[15px] tiny:text-[14px] tiny:xl:text-[14px]">Takes 20 seconds. We&apos;ll email you the moment we open.</p>
      </div>

      {/* On laptop-height windows, name and email share a row so the button stays in view. */}
      <div className="flex flex-col gap-5 short:gap-4 short:lg:grid short:lg:grid-cols-2 tiny:gap-3">
      <div className="flex flex-col gap-2 tiny:gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="firstName" className={LABEL}>First name</label>
          <span className="text-[14px] leading-none text-muted xl:text-[15px] short:text-[13px] short:xl:text-[13px]">Optional</span>
        </div>
        <input id="firstName" className={INPUT} autoComplete="given-name" maxLength={40} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Your first name" />
      </div>

      <label className="flex flex-col gap-2 tiny:gap-1.5"><span className={LABEL}>Email</span>
        <input className={INPUT} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </label>
      </div>

      <div className="flex flex-col gap-2 tiny:gap-1.5">
        <label htmlFor="city" className={LABEL}>Current city</label>
        <div>
          <input id="city" className={INPUT} autoComplete="off" role="combobox" aria-expanded={cityHits.length > 0} aria-controls="cityOptions" aria-autocomplete="list"
            aria-activedescendant={cityKeys.active >= 0 ? `cityOptions-${cityKeys.active}` : undefined}
            value={cityText} placeholder="City or ZIP" onKeyDown={cityKeys.onKeyDown} onBlur={() => setCityHits([])}
            onChange={(e) => { setCity(null); setCityText(e.target.value); if (e.target.value.trim().length < 2) setCityHits([]); }} />
          {cityHits.length > 0 && (
            <div id="cityOptions" role="listbox" aria-label="Cities" className={OPTIONS}>
              {cityHits.map((c, i) => (
                <button type="button" role="option" id={`cityOptions-${i}`} aria-selected={i === cityKeys.active} tabIndex={-1} key={`${c.id}-${c.zip ?? ""}`}
                  className={`${OPTION} ${i === cityKeys.active ? "bg-mist" : ""}`}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => pickCity(c)}>
                  <b className="text-[16px]">{c.name}, {c.state}{c.zip ? ` ${c.zip}` : ""}</b><span className="text-[13px] text-muted">{c.metro_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className={HINT}>
          {city ? <>Part of <b className="font-semibold text-ink">{city.metro_name}</b>. We only use your city, never your address.</>
            : locNote ?? "Type your city or ZIP. We only use your city, never your address."}
          {!city && (
            <> <button type="button" onClick={findMyCity} disabled={locating} className="font-semibold text-teal underline underline-offset-2 disabled:opacity-60">
              {locating ? "Finding your city…" : "Use my location"}</button></>
          )}
        </p>
        {city && !sameMetro(city.metro_name, APP.launchMetro) && (
          <p className="m-0 rounded-xl bg-mist px-3.5 py-2.5 text-[14px] leading-snug text-ink short:py-2 short:text-[13px]">
            We&apos;re starting in {APP.launchMetro}. Join anyway and we&apos;ll email you when Nayboro reaches {city.metro_name || "your area"}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 tiny:gap-1.5">
        <label htmlFor="home" className={LABEL}>Hometown</label>
        <HomeField home={home} onChange={setHome} />
        <p className={HINT}>Where you grew up. We&apos;ll connect you with people from there.</p>
      </div>

      {/* Bots fill every field; people never see this one. */}
      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>

      <hr className="m-0 border-0 border-t border-teal-line" />
      <label className="flex cursor-pointer items-center gap-4 text-[17px] xl:text-[18px] short:text-[16px] short:xl:text-[16px] tiny:text-[15px] tiny:xl:text-[15px]">
        <input type="checkbox" required aria-required="true" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="m-0 h-6 w-6 flex-none accent-teal" />
        I confirm I&apos;m 18 or older
      </label>

      {error && <p role="alert" className="m-0 text-[15px] font-semibold text-warn">{error}</p>}
      <button disabled={busy} className="flex h-14 items-center justify-center rounded-[16px] bg-teal text-[18px] font-bold text-white disabled:opacity-60 xl:h-[62px] xl:text-[19px] short:h-12 short:xl:h-12 short:text-[17px] short:xl:text-[17px] tiny:h-11 tiny:xl:h-11 tiny:text-[16px] tiny:xl:text-[16px]">
        {busy ? "Joining…" : "Join the waitlist"}
      </button>
      <p className="m-0 text-center text-[14px] leading-normal text-muted xl:text-[15px] short:text-[13px] short:xl:text-[13px]">
        We&apos;ll only email you about Nayboro&apos;s launch. No spam, unsubscribe anytime. <Link href="/privacy" className="text-teal underline underline-offset-2">Privacy policy</Link>
      </p>
    </form>
  );
}

function HomeField({ home, onChange }: { home: Home; onChange: (h: Home) => void }) {
  const [hits, setHits] = useState<Place[]>([]);
  const id = useId();
  const text = home.place ? `${home.place.city}, ${home.place.region}` : home.text;
  const pick = (p: Place) => { onChange({ ...home, place: p }); setHits([]); };
  const keys = useListKeys(hits, pick, () => setHits([]));

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

  const open = !home.place && hits.length > 0;
  return (
    <div>
      <input id="home" className={INPUT} autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-opts`} aria-autocomplete="list"
        aria-activedescendant={open && keys.active >= 0 ? `${id}-opt-${keys.active}` : undefined}
        placeholder="City or town you grew up in" value={text} onKeyDown={keys.onKeyDown} onBlur={() => setHits([])}
        onChange={(e) => { onChange({ text: e.target.value, place: null }); if (e.target.value.trim().length < 2) setHits([]); }} />
      {open && (
        <div id={`${id}-opts`} role="listbox" aria-label="Places" className={OPTIONS}>
          {hits.map((p, i) => (
            <button type="button" role="option" id={`${id}-opt-${i}`} aria-selected={i === keys.active} tabIndex={-1} key={p.id}
              className={`${OPTION} ${i === keys.active ? "bg-mist" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
              <b className="text-[16px]">{p.city}</b><span className="text-[13px] text-muted">{p.region}, {p.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Joined({ done }: { done: Done }) {
  const [copied, setCopied] = useState(false);
  // Only shown after a sign-up, so this always runs in the browser.
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const link = `${origin}/r/${done.refCode}`;
  const shown = link.replace(/^https?:\/\//, "");

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { if (navigator.share) await navigator.share({ title: APP.name, url: link }).catch(() => {}); }
  }

  const steps: React.ReactNode[] = [
    "Check your inbox for a confirmation email.",
    "We'll invite people in waves as we open in your city.",
    <>Follow us on <a href={APP.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal underline underline-offset-2">Instagram</a> for sneak peeks.</>,
  ];

  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-teal-tint text-teal" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-display text-[30px] font-extrabold tracking-[-0.8px] xl:text-[36px] short:text-[28px] short:xl:text-[30px] tiny:text-[26px] tiny:xl:text-[26px]">{done.already ? "You're already on the list." : "You're on the list."}</h2>
        <p className="m-0 text-[17px] leading-relaxed text-muted md:text-[19px]">
          We&apos;ll email you when Nayboro opens in {done.metro ? <b className="font-semibold text-ink">{done.metro}</b> : "your city"}.
        </p>
      </div>

      <hr className="m-0 border-0 border-t border-teal-line" />

      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-display text-[22px] font-extrabold xl:text-[26px]">Want in sooner?</h3>
        <p className="m-0 text-[17px] leading-relaxed text-muted md:text-[18px]">Share your link with friends. Every friend who joins moves you up the list.</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <code className="flex h-16 w-full min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-2xl border-2 border-dashed border-teal-line bg-mist px-5 font-sans text-[17px] font-medium text-ink sm:flex-1 md:text-[18px]">{shown}</code>
          <button onClick={copy} className="h-16 flex-none rounded-2xl bg-coral px-7 text-[18px] font-bold text-coral-ink md:text-[19px]">{copied ? "Link copied" : "Copy link"}</button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[24px] bg-mist p-6 md:p-7">
        <h3 className="m-0 text-[14px] font-bold uppercase tracking-[1.5px] text-muted md:text-[15px]">What happens next</h3>
        <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
          {steps.map((t, i) => (
            <li key={i} className="flex items-start gap-4 text-[17px] leading-snug md:text-[18px]">
              <span aria-hidden="true" className="mt-px flex h-7 w-7 flex-none items-center justify-center rounded-full bg-teal text-[14px] font-bold text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
