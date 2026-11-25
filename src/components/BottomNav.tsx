import Link from "next/link";

export type Tab = "explore" | "people" | "chats";

/** The three tabs. Plain markup (no data), so loading screens can show the real nav too. */
export function BottomNav({ tab, badge }: { tab: Tab; badge: number }) {
  const items: [Tab, string, string, React.ReactNode][] = [
    ["explore", "/explore", "Explore", <><circle key="a" cx="12" cy="12" r="9" /><path key="b" d="M15.5 8.5l-2 5-5 2 2-5z" /></>],
    ["people", "/people", "People", <><circle key="a" cx="9" cy="8" r="3.5" /><path key="b" d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle key="c" cx="17" cy="9" r="2.5" /><path key="d" d="M17.5 14.5c2 .3 3.4 1.9 4 4.5" /></>],
    ["chats", "/chats", "Chats", <path key="a" d="M4 5h16v11H9l-5 4z" />],
  ];
  return (
    <nav aria-label="Main" className="grid grid-cols-3 border-t border-line-soft bg-surface px-2 pb-5 pt-2">
      {items.map(([key, href, label, icon]) => {
        const on = key === tab;
        return (
          <Link key={key} href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-1.5 text-xs ${on ? "font-bold text-green" : "font-semibold text-muted"}`}>
            <span className={`flex h-[30px] w-14 items-center justify-center rounded-full ${on ? "bg-green-tint" : ""}`}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
            </span>
            {key === "chats" && badge > 0 && (
              <span className="absolute left-[54%] top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-[5px] text-[11px] font-extrabold text-ink" aria-label={`${badge} new`}>{badge}</span>
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
