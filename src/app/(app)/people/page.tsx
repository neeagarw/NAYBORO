import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { AppShell } from "@/components/AppShell";
import { PeopleClient, type Person, type Hello, type Counts } from "./PeopleClient";

export const metadata = { title: "People · Nayboro" };

// Port of design/mockups/people.html.
export default function PeoplePage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" />}>
      <People />
    </Suspense>
  );
}

async function People() {
  const supabase = await createClient();
  const [{ data: people }, { data: hellos }, { data: counts }, { data: area }, { data: mine }] = await Promise.all([
    supabase.rpc("people_for_me"),
    supabase.rpc("inbox_hellos"),
    supabase.rpc("my_root_counts").maybeSingle(),
    supabase.rpc("me_area").maybeSingle(),
    supabase.auth.getUser().then(({ data }) =>
      supabase.from("profile_interests").select("interests(label, sort)").eq("profile_id", data.user!.id),
    ),
  ]);

  const photos = await signPhotos([...(people ?? []).map((p: Person) => p.photo_path), ...(hellos ?? []).map((h: Hello) => h.photo_path)]);
  const c = (counts ?? null) as Counts | null;
  const a = area as { name: string; metro: string } | null;
  const myInterests = (mine ?? [])
    .map((r) => r.interests as unknown as { label: string; sort: number })
    .sort((x, y) => x.sort - y.sort)
    .map((i) => i.label);

  const sub = `Near ${a?.name ?? "you"}${c?.city_count ? ` · ${c.city_count} from ${c.city} around ${a?.metro}` : ""}`;

  return (
    <AppShell tab="people" title="People" sub={sub}>
      <PeopleClient
        people={(people ?? []) as Person[]}
        hellos={(hellos ?? []) as Hello[]}
        counts={c}
        area={a?.name ?? ""}
        metro={a?.metro ?? ""}
        myInterests={myInterests}
        photos={photos}
      />
    </AppShell>
  );
}
