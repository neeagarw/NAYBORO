import Link from "next/link";
import { APP } from "@/config/app";

export type LegalSection = { title: string; items: React.ReactNode[] };

/** Shared layout for Terms, Privacy and Community guidelines: plain language, one column, readable on a phone. */
export function LegalPage({ title, intro, sections, updated }: { title: string; intro: React.ReactNode; sections: LegalSection[]; updated?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col gap-8 bg-mist px-5 py-12 text-ink">
      <Link href="/" className="text-[15px] font-bold text-teal">← Back to {APP.name}</Link>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[40px] font-extrabold leading-tight tracking-[-1px]">{title}</h1>
        {updated && <span className="text-sm text-muted">Last updated {updated}</span>}
      </div>
      <p className="m-0 text-[17px] leading-relaxed text-muted">{intro}</p>
      {sections.map((s, n) => (
        <section key={s.title} className="flex flex-col gap-3">
          <h2 className="m-0 text-[22px] font-bold">{n + 1}. {s.title}</h2>
          <ul className="m-0 flex flex-col gap-2 pl-5 text-[17px] leading-relaxed">
            {s.items.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </section>
      ))}
      <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
        <Link className="text-teal underline" href="/terms">Terms of Service</Link>
        <Link className="text-teal underline" href="/privacy">Privacy policy</Link>
        <Link className="text-teal underline" href="/guidelines">Community guidelines</Link>
        <a className="text-teal underline" href={`mailto:${APP.contactEmail}`}>{APP.contactEmail}</a>
      </nav>
    </main>
  );
}
