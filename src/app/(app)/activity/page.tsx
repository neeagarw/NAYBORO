import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { getAppConfig } from "@/lib/config";
import { shellData } from "@/components/AppShell";
import { BottomNav, DesktopLayout } from "@/components/BottomNav";
import { ActivityClient, type Item } from "./ActivityClient";

export const metadata = { title: "Activity" };

// Opened from the bell on every tab: answers, hellos, accepted hellos, "found your answer helpful", new people
// from home and events you're interested in. Read through activity_for_me (privacy rules live there).
export default function ActivityPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" />}>
      <Activity />
    </Suspense>
  );
}

async function Activity() {
  const supabase = await createClient();
  const [cfg, shell, { data }] = await Promise.all([getAppConfig(), shellData(), supabase.rpc("activity_for_me", { p_limit: 30 })]);
  const items = (data ?? []) as Item[];
  const photos = await signPhotos(items.map((i) => i.actor_photo));
  return (
    <DesktopLayout badge={shell.badge} initial={shell.initial}>
      <div className="app-frame">
        <ActivityClient items={items} photos={photos} tz={cfg.metro?.timezone ?? "UTC"} metro={cfg.metro?.name ?? "you"} />
        <BottomNav badge={shell.badge} initial={shell.initial} />
      </div>
    </DesktopLayout>
  );
}
