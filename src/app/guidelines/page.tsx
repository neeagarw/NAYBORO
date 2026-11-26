import type { Metadata } from "next";
import Link from "next/link";
import { APP } from "@/config/app";

export const metadata: Metadata = { title: "Community guidelines" };

// Plain-language rules, matching the product rules in CLAUDE.md. Linked from the You tab.
const SECTIONS: [string, string[]][] = [
  ["Be a good neighbor", [
    "Be kind and patient. Many people here are new to the city, or new to the country.",
    "Disagree with ideas, not people. No insults, threats or harassment.",
    "Nayboro is for people 18 and older.",
  ]],
  ["Keep it about life here", [
    "Ask and answer practical questions about living in your city.",
    "No buying, selling, ads or promotions in questions or answers. Events are listed by our team.",
    "Don't post anyone's phone number, address or other private details, including your own.",
  ]],
  ["Respect people's privacy", [
    "Don't ask people about caste, religion, visa status, income, home address or their children.",
    "Hometowns show only at the level each person chose. Don't press for more.",
    "Anonymous questions are anonymous. Don't try to work out who asked.",
  ]],
  ["Meeting up", [
    "A chat only opens when both people agree, so a “no” or no reply is an answer.",
    "Meet in public places the first few times, and tell a friend where you're going.",
    "Never send money, codes or documents to someone you met here.",
  ]],
  ["If something's wrong", [
    "Use Report or Block from the ⋯ menu on any profile or chat. Block hides you from each other everywhere.",
    "We review reports and may hide posts or pause accounts that break these rules.",
    "If you're in danger, call 911 first.",
  ]],
];

export default function Guidelines() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col gap-8 bg-mist px-5 py-12 text-ink">
      <Link href="/" className="text-[15px] font-bold text-teal">← Back to {APP.name}</Link>
      <h1 className="m-0 font-display text-[40px] font-extrabold leading-tight tracking-[-1px]">Community guidelines</h1>
      <p className="m-0 text-[17px] leading-relaxed text-muted">Nayboro works because people treat each other the way good neighbors do. These are the few rules that keep it that way.</p>
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
