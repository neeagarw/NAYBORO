import Link from "next/link";
import { Logo } from "@/components/Logo";

export type Tab = "explore" | "people" | "chats";

const ITEMS: [Tab, string, string, React.ReactNode][] = [
  ["explore", "/explore", "Explore", <><circle key="a" cx="12" cy="12" r="9" /><path key="b" d="M15.5 8.5l-2 5-5 2 2-5z" /></>],
  ["people", "/people", "People", <><circle key="a" cx="9" cy="8" r="3.5" /><path key="b" d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle key="c" cx="17" cy="9" r="2.5" /><path key="d" d="M17.5 14.5c2 .3 3.4 1.9 4 4.5" /></>],
  ["chats", "/chats", "Chats", <path key="a" d="M4 5h16v11H9l-5 4z" />],
];

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Badge = ({ n, className }: { n: number; className: string }) => (
  <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-[5px] text-[11px] font-extrabold text-ink ${className}`} aria-label={`${n} new`}>{n}</span>
);

/** The three tabs at the bottom (phones and tablets). Plain markup (no data), so loading screens can show it too. */
export function BottomNav({ tab, badge }: { tab: Tab; badge: number }) {
  return (
    <nav aria-label="Main" className="grid grid-cols-3 border-t border-line-soft bg-surface px-2 pb-5 pt-2 lg:hidden">
      {ITEMS.map(([key, href, label, icon]) => {
        const on = key === tab;
        return (
          <Link key={key} href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-1.5 text-xs ${on ? "font-bold text-green" : "font-semibold text-muted"}`}>
            <span className={`flex h-[30px] w-14 items-center justify-center rounded-full ${on ? "bg-green-tint" : ""}`}><Icon>{icon}</Icon></span>
            {key === "chats" && badge > 0 && <Badge n={badge} className="absolute left-[54%] top-0.5" />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Laptops and wider: the same three tabs in a sidebar next to the content (like Instagram on desktop). */
export function SideNav({ tab, badge }: { tab?: Tab; badge: number }) {
  return (
    <aside className="sticky top-6 hidden w-[220px] flex-none flex-col gap-6 pt-2 lg:flex">
      <Link href="/explore" aria-label="Nayboro home" className="px-3"><Logo size={34} /></Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {ITEMS.map(([key, href, label, icon]) => {
          const on = key === tab;
          return (
            <Link key={key} href={href} aria-current={on ? "page" : undefined}
              className={`relative flex h-12 items-center gap-3.5 rounded-2xl px-3 text-[16px] ${on ? "bg-green-tint font-bold text-green" : "font-semibold text-ink hover:bg-surface"}`}>
              <Icon>{icon}</Icon>{label}
              {key === "chats" && badge > 0 && <Badge n={badge} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Puts the screen next to the sidebar on laptops; on phones it's just the screen. */
export function DesktopLayout({ tab, badge, children }: { tab?: Tab; badge: number; children: React.ReactNode }) {
  return (
    <div className="lg:mx-auto lg:flex lg:max-w-[860px] lg:items-start lg:gap-6">
      <SideNav tab={tab} badge={badge} />
      <div className="lg:min-w-0 lg:flex-1">{children}</div>
    </div>
  );
}
