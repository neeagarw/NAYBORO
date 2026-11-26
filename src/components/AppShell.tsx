import Link from "next/link";
import { ScrollHeader } from "@/components/ScrollHeader";
import { Logo } from "@/components/Logo";
import { BellIcon } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, DesktopLayout, type Tab } from "@/components/BottomNav";

/** The bell (top right on every tab): opens Activity; a coral dot when something new happened. */
export function Bell({ fresh }: { fresh: boolean }) {
  return (
    <Link href="/activity" aria-label={fresh ? "Activity, new items" : "Activity"}
      className="relative flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line-soft bg-surface text-ink">
      <BellIcon />
      {fresh && <span aria-hidden="true" className="absolute right-[11px] top-[10px] h-2 w-2 rounded-full bg-orange ring-2 ring-surface" />}
    </Link>
  );
}

/** What every tabbed screen's chrome needs: the Chats badge, the bell dot and your initial (You tab). */
export async function shellData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: badge }, { data: fresh }] = await Promise.all([
    supabase.from("public_profiles").select("display_name").eq("id", user!.id).maybeSingle(),
    supabase.rpc("chats_badge"),
    supabase.rpc("has_new_activity"),
  ]);
  return { badge: (badge as number | null) ?? 0, fresh: !!fresh, initial: (me?.display_name ?? "").trim()[0]?.toUpperCase() };
}

/** Header (logo + bell, then title) + body, scrolling together, + bottom nav with the Chats badge. */
export async function AppShell({ tab, title, sub, head, children, overlay }: {
  tab: Tab; title: string; sub?: React.ReactNode; head?: React.ReactNode; children: React.ReactNode; overlay?: React.ReactNode;
}) {
  const { badge, fresh, initial } = await shellData();

  const header = (
      <div className="flex flex-col gap-2.5 px-5 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/explore" aria-label="Nayboro home" className="lg:invisible"><Logo size={30} /></Link>
          <Bell fresh={fresh} />
        </div>
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.5px]">{title}</h1>
          {sub && <span className="text-sm text-muted">{sub}</span>}
        </div>
        {head}
      </div>
  );

  return (
    <DesktopLayout tab={tab} badge={badge} initial={initial}>
    <div className="app-frame">
      {/* Like Instagram: everything scrolls; the top bar slides back when you scroll up. Only the bottom nav is fixed. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ScrollHeader>{header}</ScrollHeader>
        {children}
      </div>
      {overlay}
      <BottomNav tab={tab} badge={badge} initial={initial} />
    </div>
    </DesktopLayout>
  );
}
