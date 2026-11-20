"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import { APP } from "@/config/app";

// "Join the community": the public home page until launch (site_mode = 'waitlist').

type Place = { id: number; city: string; region: string; country: string };
type City = { id: number; name: string; state: string; metro_name: string; zip?: string | null };
type Done = { refCode: string; city: string | null; metro: string | null; people: number | null; already: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ComingSoon({ refCode, signedInEmail }: { refCode: string | null; signedInEmail: string | null }) {
  const [done, setDone] = useState<Done | null>(null);

  return (
    <div className="min-h-dvh bg-ground text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <span className="inline-flex items-center gap-2 font-display text-[22px] font-extrabold tracking-[-0.4px]"><LogoMark size={36} />nayboro</span>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-green">Beta tester? Log in</Link>
      </header>

      {signedInEmail && (
        <div role="status" className="mx-auto mb-2 max-w-6xl px-5 md:px-8">
          <div className="rounded-2xl bg-orange-tint px-4 py-3 text-sm text-orange-ink">
            You&apos;re signed in as <b>{signedInEmail}</b>, but Nayboro isn&apos;t open for everyone yet. Join the list below and we&apos;ll email you the day it opens.
            <form action="/auth/signout" method="post" className="mt-1 inline"><button className="ml-1 font-bold text-orange-text underline">Log out</button></form>
          </div>
        </div>
      )}

      {/* ───────── hero + form ───────── */}
      <main>
        <section className="mx-auto grid max-w-6xl items-start gap-8 px-5 pb-14 pt-4 md:grid-cols-[1.1fr_1fr] md:gap-12 md:px-8 md:pt-10">
          <div className="flex flex-col gap-5 md:pt-6">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-orange-tint px-3.5 py-1.5 text-[13px] font-bold text-orange-text">
              <span className="h-2 w-2 rounded-full bg-orange-logo" aria-hidden="true" />Coming soon to your city
            </span>
            <h1 className="m-0 font-display text-[40px] font-extrabold leading-[1.02] tracking-[-1px] md:text-[60px]">
              Find <em className="not-italic text-green">your people</em>, wherever you are.
            </h1>
            <p className="m-0 max-w-[34rem] text-[17px] leading-relaxed text-muted md:text-lg">
              Nayboro connects you with people from your hometown who live near you. Make friends, ask questions only locals can answer, and find things to do together.
            </p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {["Meet people from your hometown who live nearby", "Get answers from people who have been there", "Find events and things to do together"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-[1.4]">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-orange" aria-hidden="true"><Check /></span>{t}
                </li>
              ))}
            </ul>
          </div>

          <div id="join" className="rounded-[28px] border border-line-soft bg-surface p-5 shadow-[0_10px_40px_rgba(23,32,27,.08)] md:p-7">
            {done ? <Joined done={done} /> : <JoinForm refCode={refCode} onDone={setDone} defaultEmail={signedInEmail ?? ""} />}
          </div>
        </section>

        {/* ───────── how it works ───────── */}
        <section aria-labelledby="how" className="bg-surface py-14">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 id="how" className="m-0 font-display text-[30px] font-extrabold tracking-[-0.5px] md:text-[36px]">How Nayboro works</h2>
            <ol className="mt-7 grid list-none gap-4 p-0 md:grid-cols-3">
              {[
                ["Say where you're from", "Pick your hometown and choose how much of it to show: city, state or just country."],
                ["Meet people from home", "See people nearby who share your roots or interests. A chat opens only when both of you say yes."],
                ["Ask your new city", "Groceries, schools, visas, cricket on Sunday: get answers from people who have been there."],
              ].map(([t, d], i) => (
                <li key={t} className="flex flex-col gap-2.5 rounded-[22px] bg-ground p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green font-display text-lg font-extrabold text-white">{i + 1}</span>
                  <b className="text-lg">{t}</b>
                  <span className="text-[15px] leading-normal text-muted">{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ───────── safety ───────── */}
        <section aria-labelledby="safe" className="py-14">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 id="safe" className="m-0 font-display text-[30px] font-extrabold tracking-[-0.5px] md:text-[36px]">Built to feel safe</h2>
            <ul className="mt-7 grid list-none gap-3 p-0 sm:grid-cols-2">
              {[
                ["Your city, never your address", "We only show the city you live in. Never your street, distance or where you are right now."],
                ["You choose who can chat", "Someone says hi; a chat opens only if you accept."],
                ["Report and block in one tap", "A real person on our team reviews every report."],
                ["18+ only", "Nayboro is for adults. We never ask for caste, religion, visa status or income."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3 rounded-[22px] border border-line-soft bg-surface p-5">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-green-tint text-green" aria-hidden="true"><Shield /></span>
                  <span className="flex flex-col gap-1"><b className="text-[16px]">{t}</b><span className="text-[15px] leading-normal text-muted">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── closing ───────── */}
        <section className="px-5 pb-14 md:px-8">
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-4 overflow-hidden rounded-[30px] bg-green px-6 py-10 text-white md:flex-row md:items-center md:justify-between md:px-12">
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-hero-blob" />
            <div className="relative">
              <h2 className="m-0 font-display text-[28px] font-extrabold leading-tight md:text-[34px]">Be the first in your city.</h2>
              <p className="m-0 mt-2 text-[16px] text-on-green-muted">We open city by city. The more people from your area join, the sooner it&apos;s yours.</p>
            </div>
            <a href="#join" className="relative inline-flex h-14 flex-none items-center rounded-[18px] bg-white px-7 text-[17px] font-bold text-green">Join the list</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[13px] text-muted md:flex-row md:justify-between md:px-8">
          <span>© {APP.name}. {APP.tagline}</span>
          <span>Free · 18+ · Your exact location is never shared</span>
        </div>
      </footer>
    </div>
  );
}

function JoinForm({ refCode, onDone, defaultEmail }: { refCode: string | null; onDone: (d: Done) => void; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [home, setHome] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [homeHits, setHomeHits] = useState<Place[]>([]);
  const [cityQ, setCityQ] = useState("");
  const [city, setCity] = useState<City | null>(null);
  const [cityHits, setCityHits] = useState<City[]>([]);
  const [locating, setLocating] = useState(false);
  const [adult, setAdult] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = home.trim();
    if (!q || place) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await getClient().rpc("search_places", { p_q: q, p_limit: 5 });
      if (live) setHomeHits((data ?? []) as Place[]);
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [home, place]);

  useEffect(() => {
    const q = cityQ.trim();
    if (q.length < 2 || city) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data } = await getClient().rpc("search_areas", { p_q: q, p_limit: 5 });
      if (live) setCityHits((data ?? []) as City[]);
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [cityQ, city]);

  function findCity() {
    if (!("geolocation" in navigator)) return setError("Your browser can't share location. Type your city or ZIP instead.");
    setLocating(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Sent once to find the nearest city; nothing is stored.
        const { data } = await getClient().rpc("locate_area", { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
        setLocating(false);
        const hit = ((data ?? []) as City[])[0];
        if (hit) { setCity(hit); setCityQ(""); setCityHits([]); }
        else setError("We couldn't match your location to a US city. Type your city or ZIP instead.");
      },
      () => { setLocating(false); setError("We couldn't get your location. Type your city or ZIP instead."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Please check your email address.");
    if (!adult) return setError("Please confirm you're 18 or older.");
    setBusy(true); setError(null);
    const res = await fetch("/api/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), hometown: place ? `${place.city}, ${place.region}` : home.trim() || null, place_id: place?.id ?? null, area_id: city?.id ?? null, ref: refCode, adult, website: trap }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Something went wrong. Please try again.");
    onDone(json as Done);
  }

  const input = "h-[52px] w-full rounded-2xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-green";
  return (
    <form onSubmit={submit} method="post" action="#join" noValidate className="flex flex-col gap-4" aria-labelledby="joinTitle">
      <div>
        <h2 id="joinTitle" className="m-0 font-display text-[26px] font-extrabold tracking-[-0.3px]">Join the community</h2>
        <p className="m-0 mt-1 text-[15px] text-muted">Be first in when Nayboro opens near you.</p>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-bold">Email
        <input className={input} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </label>

      <div className="relative flex flex-col gap-1.5">
        <label htmlFor="home" className="text-[13px] font-bold">Where are your roots? <span className="font-medium text-muted">(optional)</span></label>
        <input id="home" className={input} autoComplete="off" value={place ? `${place.city}, ${place.region}` : home}
          onChange={(e) => { setPlace(null); setHome(e.target.value); if (!e.target.value) setHomeHits([]); }} placeholder="Your hometown" />
        {!place && home.trim() && homeHits.length > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl border border-line-soft bg-surface p-1.5" role="listbox" aria-label="Hometowns">
            {homeHits.map((p) => (
              <button type="button" role="option" aria-selected="false" key={p.id} onClick={() => { setPlace(p); setHomeHits([]); }} className="flex min-h-11 flex-col items-start justify-center rounded-xl px-3 py-1.5 text-left hover:bg-ground">
                <b className="text-[15px]">{p.city}</b><span className="text-xs text-muted">{p.region}, {p.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className="text-[13px] font-bold">Where do you live now?</label>
        {city ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-green-tint px-4 py-2.5 text-green">
            <span className="flex flex-col"><b className="text-[15px]">{city.name}, {city.state}</b><span className="text-xs font-medium">{city.metro_name}</span></span>
            <button type="button" onClick={() => setCity(null)} className="min-h-11 text-sm font-bold underline">Change</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input id="city" className={input} autoComplete="off" value={cityQ} onChange={(e) => { setCityQ(e.target.value); if (e.target.value.trim().length < 2) setCityHits([]); }} placeholder="City or ZIP" />
              <button type="button" onClick={findCity} disabled={locating} aria-label={locating ? "Finding your city" : "Find me using my location"} className="flex h-[52px] flex-none items-center gap-1.5 rounded-2xl border-2 border-green bg-surface px-3.5 text-sm font-bold text-green disabled:opacity-60">
                <Pin />{locating ? "Finding…" : "Find me"}
              </button>
            </div>
            {cityHits.length > 0 && (
              <div className="flex flex-col gap-1 rounded-2xl border border-line-soft bg-surface p-1.5" role="listbox" aria-label="Cities">
                {cityHits.map((c) => (
                  <button type="button" role="option" aria-selected="false" key={`${c.id}-${c.zip ?? ""}`} onClick={() => { setCity(c); setCityHits([]); }} className="flex min-h-11 flex-col items-start justify-center rounded-xl px-3 py-1.5 text-left hover:bg-ground">
                    <b className="text-[15px]">{c.name}, {c.state}{c.zip ? ` ${c.zip}` : ""}</b><span className="text-xs text-muted">{c.metro_name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <span className="text-xs text-muted">We use your city to tell you when Nayboro opens there. Never your address.</span>
      </div>

      {/* Bots fill every field; people never see this one. */}
      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-[1.45]">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="m-0 h-[22px] w-[22px] flex-none accent-green" />
        <span>I&apos;m 18 or older. Email me when Nayboro opens near me.</span>
      </label>
      {error && <p role="alert" className="m-0 text-[13px] font-semibold text-warn">{error}</p>}
      <button disabled={busy} className="flex h-14 items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white disabled:opacity-60">{busy ? "Joining…" : "Join the list"}</button>
      <span className="text-center text-xs text-muted">Free. We only email you about Nayboro, and you can leave any time.</span>
    </form>
  );
}

function Joined({ done }: { done: Done }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${done.refCode}` : "";
  async function share() {
    const text = `I just joined Nayboro to meet people from home who live nearby. Join me: ${link}`;
    if (navigator.share) { try { await navigator.share({ title: APP.name, text, url: link }); return; } catch { /* closed */ } }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  }
  return (
    <div className="flex flex-col items-start gap-4" role="status" aria-live="polite">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-tint text-green"><Check size={28} /></span>
      <h2 className="m-0 font-display text-[28px] font-extrabold leading-tight">{done.already ? "You're already on the list" : "You're on the list!"}</h2>
      <p className="m-0 text-[15px] leading-normal text-muted">
        We&apos;ll email you the day Nayboro opens{done.metro ? <> in <b className="text-ink">{done.metro}</b></> : ""}.
        {done.people ? <> {done.people} people around there have joined so far.</> : ""}
      </p>
      <div className="w-full rounded-2xl bg-orange-tint p-4">
        <b className="text-[15px] text-orange-ink">Want it sooner? Bring friends from home.</b>
        <p className="m-0 mt-1 text-sm text-orange-ink">We open city by city, and every friend who joins with your link brings your city closer.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <code className="flex min-h-11 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-white px-3 text-[13px]">{link}</code>
          <button onClick={share} className="h-11 rounded-xl bg-green px-4 text-sm font-bold text-white">{copied ? "Link copied" : "Share invite link"}</button>
        </div>
      </div>
    </div>
  );
}

const Check = ({ size = 14 }: { size?: number }) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Shield = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;
const Pin = () => <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
