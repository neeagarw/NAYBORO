import { AccountMenu } from "@/components/AccountMenu";
import { ScrollHeader } from "@/components/ScrollHeader";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, DesktopLayout, type Tab } from "@/components/BottomNav";

/** Header (title, account button) + body, scrolling together, + bottom nav with the Chats badge. */
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

  // Compact header: title + place on the left, account on the right, so content starts high on a phone.
  const header = (
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
  );

  return (
    <DesktopLayout tab={tab} badge={badge ?? 0}>
    <div className="app-frame">
      {/* Like Instagram: everything scrolls; the top bar slides back when you scroll up. Only the bottom nav is fixed. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ScrollHeader>{header}</ScrollHeader>
        {children}
      </div>
      {overlay}
      <BottomNav tab={tab} badge={badge ?? 0} />
    </div>
    </DesktopLayout>
  );
}
