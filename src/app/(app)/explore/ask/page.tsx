import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { AskClient } from "./AskClient";

export const metadata = { title: "New question · Nayboro" };

// Port of design/mockups/ask.html.
export default function AskPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <Ask />
    </Suspense>
  );
}

async function Ask() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: area }] = await Promise.all([
    supabase.from("public_profiles").select("display_name, shown_root").eq("id", user!.id).maybeSingle(),
    supabase.rpc("me_area").maybeSingle(),
  ]);
  const a = area as { name: string; metro: string } | null;
  return <AskClient userId={user!.id} name={me?.display_name?.split(" ")[0] ?? "You"} roots={me?.shown_root ?? ""} area={a?.name ?? ""} metro={a?.metro ?? ""} />;
}
