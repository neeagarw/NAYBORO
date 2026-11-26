import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/config";
import { AskClient } from "./AskClient";

export const metadata = { title: "New question" };

// Port of design/mockups/ask.html.
// ?q= comes from "Ask it" when an Explore search found nothing: the question starts with those words.
export default function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <Ask searchParams={searchParams} />
    </Suspense>
  );
}

async function Ask({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [cfg, { data: me }, { data: area }] = await Promise.all([
    getAppConfig(),
    supabase.from("public_profiles").select("display_name, shown_root").eq("id", user!.id).maybeSingle(),
    supabase.rpc("me_area").maybeSingle(),
  ]);
  const a = area as { name: string; metro: string } | null;
  return <AskClient userId={user!.id} name={me?.display_name?.split(" ")[0] ?? "You"} roots={me?.shown_root ?? ""} area={a?.name ?? ""} metro={cfg.metro?.name ?? ""} otherAreas={cfg.metro_areas.filter((n) => n !== a?.name)} topics={cfg.topics} initialText={(q ?? "").slice(0, 200)} />;
}
