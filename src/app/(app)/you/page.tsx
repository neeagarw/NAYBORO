import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { YouClient, type Prefs } from "./YouClient";

export const metadata = { title: "You" };

// The You tab: profile, notification switches, privacy and safety, support. Replaces the old account menu.
export default function YouPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" title="You" tab="you" />}>
      <You />
    </Suspense>
  );
}

async function You() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: p }, { data: pub }, { data: root }, { count: blocked }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("root_level, alert_answers, alert_hellos, alert_new_people, alert_events, email_alerts").eq("id", user!.id).maybeSingle(),
    supabase.from("public_profiles").select("display_name, shown_root, area_name").eq("id", user!.id).maybeSingle(),
    supabase.from("profile_roots").select("position, places(city, region, country)").eq("profile_id", user!.id).eq("position", 1).maybeSingle(),
    supabase.from("blocks").select("blocked_id", { count: "exact", head: true }).eq("blocker_id", user!.id),
    supabase.rpc("is_admin"),
  ]);
  const place = (root?.places ?? null) as unknown as { city: string; region: string; country: string } | null;
  const prefs: Prefs = {
    answers: !!p?.alert_answers && !!p?.email_alerts,
    hellos: !!p?.alert_hellos && !!p?.email_alerts,
    new_people: !!p?.alert_new_people && !!p?.email_alerts,
    events: !!p?.alert_events && !!p?.email_alerts,
  };
  return (
    <AppShell tab="you" title="You" sub={pub ? `${pub.display_name} · ${pub.shown_root ?? ""} → ${pub.area_name ?? ""}` : undefined}>
      <YouClient
        prefs={prefs}
        level={(p?.root_level ?? "city") as "city" | "state" | "country"}
        place={place}
        area={pub?.area_name ?? ""}
        blocked={blocked ?? 0}
        admin={!!admin}
        userId={user!.id}
      />
    </AppShell>
  );
}
