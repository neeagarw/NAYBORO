import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { AccountMenu } from "@/components/AccountMenu";

export const metadata = { title: "People · Nayboro" };

// Placeholder: the full People screen (design/mockups/people.html) is the next task in Week 1.
export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="app-frame" />}>
      <People />
    </Suspense>
  );
}

async function People() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("public_profiles").select("display_name, shown_root, area_name").eq("id", user!.id).maybeSingle();

  return (
    <div className="app-frame">
      <div className="flex flex-col gap-3 px-5 pb-2 pt-[18px]">
        <div className="flex items-center justify-between">
          <Logo />
          <AccountMenu name={me?.display_name ?? "You"} route={`${me?.shown_root ?? ""} → ${me?.area_name ?? ""}`} />
        </div>
        <h1 className="m-0 font-display text-[34px] font-extrabold leading-[1.02] tracking-[-0.5px]">People</h1>
      </div>
      <main className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-5 pt-1.5">
        <div className="rounded-[20px] border border-line-soft bg-surface p-4 text-[15px] leading-normal">
          You&apos;re set up as <b>{me?.display_name}</b>, {me?.shown_root} → {me?.area_name}. The People list is coming next.
        </div>
      </main>
    </div>
  );
}
