import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { createClient } from "@/lib/supabase/server";

type Tab = "explore" | "people" | "chats";

/** Header (logo, account button, title) + scrolling body + bottom nav with the Chats badge. */
export async function AppShell({ tab, title, sub, head, children, overlay }: {
  tab: Tab; title: string; sub?: React.ReactNode; head?: React.ReactNode; children: React.ReactNode; overlay?: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: badge }, { data: admin }] = await Promise.all([
    supabase.from("public_profiles").select("display_name, shown_root, area_name").eq("id", user!.id).maybeSingle(),
    supabase.rpc("chats_badge"),
    supabase.rpc("is_admin"),
  ]);

  return (
    <div className="app-frame">
      {/* Compact header: title + place on the left, account on the right, so content starts high on a phone. */}
      <div className="flex flex-col gap-2.5 px-5 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.5px]">{title}</h1>
            {sub && <span className="text-sm text-muted">{sub}</span>}
          </div>
          <AccountMenu name={me?.display_name ?? "You"} route={`${me?.shown_root ?? ""} → ${me?.area_name ?? ""}`} admin={!!admin} />
        </div>
        {head}
      </div>
      {children}
      {overlay}
      <BottomNav tab={tab} badge={badge ?? 0} />
    </div>
  );
}

function BottomNav({ tab, badge }: { tab: Tab; badge: number }) {
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
