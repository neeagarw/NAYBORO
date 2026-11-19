import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupFlow, type Area, type InterestGroup, type Place, type Initial } from "./SetupFlow";

export const metadata = { title: "Set up your profile" };


export default function SetupPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/setup");

  const [{ data: myArea }, { data: interests }, { data: profile }, { data: roots }, { data: mine }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("areas(id,name,state,metros(name))").eq("id", user.id).maybeSingle(),
    supabase.from("interests").select("id,label,group_name,group_sort,sort").order("group_sort").order("sort"),
    supabase.from("profiles").select("first_name,last_name,intro,area_id,root_level,photo_path").eq("id", user.id).maybeSingle(),
    supabase.from("profile_roots").select("position, places(id,city,region,country)").eq("profile_id", user.id).order("position"),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", user.id),
    supabase.from("app_settings").select("key,value").in("key", ["min_interests", "max_hometowns"]),
  ]);

  // Groups and their order come from the interests table (group_sort, sort).
  const groups: InterestGroup[] = [];
  for (const i of interests ?? []) {
    let g = groups.find((x) => x.title === i.group_name);
    if (!g) groups.push((g = { title: i.group_name, items: [] }));
    g.items.push({ id: i.id, label: i.label });
  }
  const setting = (k: string, d: number) => Number(settings?.find((x) => x.key === k)?.value ?? d);
  const ar = (myArea?.areas ?? null) as unknown as { id: number; name: string; state: string; metros: { name: string } } | null;
  const initialArea: Area | null = ar ? { id: ar.id, name: ar.name, state: ar.state, metro_name: ar.metros.name } : null;

  // Editing an existing profile ("Edit profile" in the account menu) starts pre-filled.
  const initial: Initial | null = profile
    ? {
        first: profile.first_name ?? "",
        last: profile.last_name ?? "",
        intro: profile.intro ?? "",
        areaId: profile.area_id,
        level: profile.root_level,
        hasPhoto: !!profile.photo_path,
        roots: (roots ?? []).flatMap((r) => (r.places ? [r.places as unknown as Place] : [])),
        interests: (mine ?? []).map((m) => m.interest_id),
      }
    : null;

  // The key remounts the flow whenever saved data changes, so "Edit profile" always opens
  // on step 1 with fresh values (Next.js otherwise restores the last visit's screen).
  const key = JSON.stringify(initial);
  return <SetupFlow key={key} userId={user.id} initialArea={initialArea} groups={groups} initial={initial} minInterests={setting("min_interests", 3)} maxHometowns={setting("max_hometowns", 3)} />;
}
