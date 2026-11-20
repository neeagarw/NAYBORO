import Link from "next/link";
import { Logo } from "@/components/Logo";

// Port of design/mockups/welcome.html: the logged-out landing once the site is open.

const PROMISES = [
  "Meet people from your hometown who live nearby",
  "Get answers from people who have been there",
  "Find events and things to do together",
];

function Check() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Pill({ initials, tone, name, route, className }: { initials: string; tone: string; name: string; route: string; className: string }) {
  return (
    <div className={`absolute flex items-center gap-2.5 rounded-full bg-white py-[7px] pl-[7px] pr-4 shadow-[0_10px_22px_rgba(10,40,26,.3)] ${className}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-[13px] font-extrabold ${tone}`}>{initials}</span>
      <span>
        <b className="block text-[15px]">{name}</b>
        <small className="text-xs text-muted">{route}</small>
      </span>
    </div>
  );
}

export function Welcome() {
  return (
    <div className="app-frame">
      <div className="flex flex-1 flex-col overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <Logo size={36} />
          <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-bold text-green">
            Log in
          </Link>
        </div>

        <div aria-hidden="true" className="relative mt-3 h-[290px] flex-none overflow-hidden rounded-[30px] bg-green">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-hero-blob" />
          <div className="absolute -bottom-[50px] -left-[30px] h-[140px] w-[140px] rounded-full bg-hero-blob" />
          <Pill initials="PS" tone="bg-yellow-tint text-yellow-text" name="Priya" route="Jaipur → Richardson" className="left-4 top-[22px]" />
          <span className="absolute right-4 top-[74px] rotate-[4deg] rounded-full bg-orange px-3.5 py-2 text-[13px] font-bold text-ink">Both from Rajasthan</span>
          <Pill initials="VB" tone="bg-green-tint text-green" name="Vikram" route="Bikaner → Garland" className="right-4 top-[118px]" />
          <Pill initials="MP" tone="bg-blue-tint text-blue-text" name="Meera" route="Pune → Plano" className="left-[30px] top-[198px]" />
          <span className="absolute right-[22px] top-[222px] -rotate-[4deg] rounded-full bg-orange px-3.5 py-2 text-[13px] font-bold text-ink">Both play tennis</span>
        </div>

        <h1 className="mt-6 font-display text-[40px] font-extrabold leading-none tracking-[-1px]">
          Find <em className="not-italic text-green">your people</em>, wherever you are.
        </h1>

        <ul className="my-5 flex flex-col gap-3">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] leading-[1.4]">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-orange">
                <Check />
              </span>
              {p}
            </li>
          ))}
        </ul>

        <div className="flex-1" />
        <Link href="/setup" className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-green text-[17px] font-bold text-white">
          Get started
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
        <span className="mt-3 text-center text-xs text-muted">Free · 18+ · Your exact location is never shared</span>
      </div>
    </div>
  );
}
