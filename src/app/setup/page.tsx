import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupFlow, type Area, type InterestGroup, type Place, type Initial } from "./SetupFlow";

export const metadata = { title: "Set up your profile" };


export default function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <Setup searchParams={searchParams} />
    </Suspense>
  );
}

async function Setup({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  // ?step=photo (the "Add a photo" tip) opens straight on the photo step, for people who already have a profile.
  const { step } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/setup");
  const { data: allowed } = await supabase.rpc("can_enter");
  if (!allowed) redirect("/?notyet=1");

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

  // Editing an existing profile ("Edit profile" on the You tab) starts pre-filled.
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
  // ?step=area ("My area" on the You tab) opens on the city step.
  const startStep = !initial ? 0 : step === "photo" ? 3 : step === "area" ? 2 : 0;
  const key = JSON.stringify(initial) + startStep;

  // A new profile starts with what this person gave when they joined the waitlist (same email).
  let prefill: { area: Area | null; root: Place | null; first: string } | null = null;
  if (!initial) {
    const { data: w } = await supabase.rpc("my_waitlist_prefill").maybeSingle();
    const r = w as { area_id: number | null; area_name: string; area_state: string; metro_name: string; place_id: number | null; place_city: string; place_region: string; place_country: string; first_name: string | null } | null;
    if (r) prefill = {
      area: r.area_id ? { id: r.area_id, name: r.area_name, state: r.area_state, metro_name: r.metro_name } : null,
      root: r.place_id ? { id: r.place_id, city: r.place_city, region: r.place_region, country: r.place_country } : null,
      first: r.first_name ?? "",
    };
  }
  // Signed in with Google: start from the name on the Google account (the person can change it).
  const meta = (initial ? {} : user.user_metadata ?? {}) as { given_name?: string; family_name?: string; full_name?: string; name?: string };
  const full = (meta.full_name ?? meta.name ?? "").trim();
  const gFirst = (meta.given_name ?? full.split(/\s+/)[0] ?? "").slice(0, 40);
  const gLast = (meta.family_name ?? (full.includes(" ") ? full.slice(full.indexOf(" ") + 1) : "")).slice(0, 40);
  return <SetupFlow key={key} startStep={startStep} userId={user.id} initialArea={initialArea ?? prefill?.area ?? null} prefillRoot={prefill?.root ?? null} prefillFirst={prefill?.first || gFirst} prefillLast={gLast} groups={groups} initial={initial} minInterests={setting("min_interests", 3)} maxHometowns={setting("max_hometowns", 3)} />;
}
