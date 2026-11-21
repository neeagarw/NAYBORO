import type { Metadata } from "next";
import Link from "next/link";
import { APP } from "@/config/app";

export const metadata: Metadata = { title: "Privacy policy" };

// Plain-language summary of what Nayboro actually collects (see CLAUDE.md product rules).
// Have a lawyer review it before launch.
const SECTIONS: [string, string[]][] = [
  ["What we collect on the waitlist", [
    "Your email address, the city you live in now, and the places you call home, if you add them.",
    "Your first name, if you choose to add it after joining.",
    "Whether you joined through a friend's invite link, so we can credit them.",
    "To stop spam, a scrambled one-way code made from your network address. We never store the address itself.",
  ]],
  ["How we use it", [
    "To email you when Nayboro opens in your city, and about Nayboro's launch. Nothing else.",
    "To decide which cities to open first, using totals per metro area.",
    "We never sell your information, and we never share it with advertisers.",
  ]],
  ["Your location", [
    "We may guess your metro area from your network address to fill in “Your city”. You can change it.",
    "We only ever keep the city you live in. Never your street address or exact location.",
  ]],
  ["Your choices", [
    "Every email has a one-click link to leave the list, which deletes your sign-up.",
    `To see or delete anything we hold about you, email ${APP.contactEmail}.`,
    "Nayboro is for people 18 and older.",
  ]],
  ["Who helps us run Nayboro", [
    "Supabase stores our data, Vercel hosts the site, and Resend sends our emails. They only process it on our behalf.",
  ]],
];

export default function Privacy() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col gap-8 bg-mist px-5 py-12 text-ink">
      <Link href="/" className="text-[15px] font-bold text-teal">← Back to {APP.name}</Link>
      <h1 className="m-0 font-display text-[40px] font-extrabold leading-tight tracking-[-1px]">Privacy policy</h1>
      <p className="m-0 text-[17px] leading-relaxed text-muted">The short version: we collect as little as we can, we only use it to bring Nayboro to your city, and you can leave any time.</p>
      {SECTIONS.map(([title, items]) => (
        <section key={title} className="flex flex-col gap-3">
          <h2 className="m-0 text-[22px] font-bold">{title}</h2>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-[17px] leading-relaxed">
            {items.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      ))}
      <p className="m-0 text-[15px] text-muted">Questions? <a className="text-teal underline" href={`mailto:${APP.contactEmail}`}>{APP.contactEmail}</a></p>
    </main>
  );
}
