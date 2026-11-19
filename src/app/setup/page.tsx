import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupFlow, type Area, type InterestGroup, type Place, type Initial } from "./SetupFlow";

export const metadata = { title: "Set up your profile · Nayboro" };

// Group order and names match design/mockups/profile-setup.html.
const GROUP_ORDER = ["Sport and fitness", "Food and drink", "Family and home", "Culture and hobbies", "Life and work"];

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

  const [{ data: areas }, { data: interests }, { data: profile }, { data: roots }, { data: mine }] = await Promise.all([
    supabase.from("areas").select("id,name,state,zips,lat,lng").order("name"),
    supabase.from("interests").select("id,label,group_name,sort").order("sort"),
    supabase.from("profiles").select("first_name,last_name,intro,area_id,root_level,photo_path").eq("id", user.id).maybeSingle(),
    supabase.from("profile_roots").select("position, places(id,city,region,country)").eq("profile_id", user.id).order("position"),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", user.id),
  ]);

  const groups: InterestGroup[] = GROUP_ORDER.map((title) => ({
    title,
    items: (interests ?? []).filter((i) => i.group_name === title).map((i) => ({ id: i.id, label: i.label })),
  })).filter((g) => g.items.length);

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
  return <SetupFlow key={key} userId={user.id} areas={(areas ?? []) as Area[]} groups={groups} initial={initial} />;
}
