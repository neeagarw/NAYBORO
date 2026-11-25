import { Suspense } from "react";
import { isBetaSite, publicSiteUrl } from "@/lib/store";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/config";
import { signPhotos } from "@/lib/photos";
import { AppShell } from "@/components/AppShell";
import { UI } from "@/config/app";
import { listKey } from "@/lib/list-key";
import { PeopleClient, type Person, type Hello, type Counts } from "./PeopleClient";

export const metadata = { title: "People" };

// Port of design/mockups/people.html. First page is rendered on the server; filters and
// "Show more" fetch further pages in the browser.
export default function PeoplePage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" />}>
      <People />
    </Suspense>
  );
}

async function People() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [cfg, { data: people }, { data: hellos }, { data: counts }, { data: mine }, { data: areaRow }] = await Promise.all([
    getAppConfig(),
    supabase.rpc("people_for_me", { p_limit: UI.peoplePage, p_offset: 0 }),
    supabase.rpc("inbox_hellos"),
    supabase.rpc("my_root_counts").maybeSingle(),
    supabase.from("profile_interests").select("interests(label, sort)").eq("profile_id", user!.id),
    supabase.rpc("me_area").maybeSingle(),
  ]);
  const { data: me } = await supabase.from("profiles").select("photo_path").eq("id", user!.id).maybeSingle();

  const photos = await signPhotos([...((people ?? []) as Person[]).map((p) => p.photo_path), ...((hellos ?? []) as Hello[]).map((h) => h.photo_path)]);
  const c = (counts ?? null) as Counts | null;
  const area = areaRow as { name: string } | null;
  const myInterests = (mine ?? [])
    .map((r) => r.interests as unknown as { label: string; sort: number })
    .sort((x, y) => x.sort - y.sort)
    .map((i) => i.label);
  const metro = cfg.metro?.name ?? "";
  // The metro name never splits across lines ("Dallas–" / "Fort Worth").
  const sub = <>Near {area?.name ?? "you"}{c?.city_count ? <> · {c.city_count} from {c.city} around <span className="whitespace-nowrap">{metro}</span></> : null}</>;

  return (
    <AppShell tab="people" title="People" sub={sub}>
      <PeopleClient
        key={listKey([...((people ?? []) as Person[]), ...((hellos ?? []) as Hello[])], (x) => x.id)}
        initial={(people ?? []) as Person[]}
        hellos={(hellos ?? []) as Hello[]}
        counts={c}
        area={area?.name ?? ""}
        metro={metro}
        myInterests={myInterests}
        photos={photos}
        verbs={cfg.verbs}
        hasPhoto={!!me?.photo_path}
        inviteBase={isBetaSite() ? publicSiteUrl() : ""}
      />
    </AppShell>
  );
}
