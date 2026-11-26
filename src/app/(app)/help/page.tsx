import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { HelpClient } from "./HelpClient";
import { TOPICS } from "./topics";

export const metadata = { title: "Contact us" };

// Port of design/mockups/contact.html. Opened from the You tab and from "Tell us" on Events.
export default function HelpPage({ searchParams }: PageProps<"/help">) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <Help searchParams={searchParams} />
    </Suspense>
  );
}

async function Help({ searchParams }: { searchParams: PageProps<"/help">["searchParams"] }) {
  const { topic } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = typeof topic === "string" && TOPICS.some(([k]) => k === topic) ? topic : "account";
  return <HelpClient userId={user!.id} email={user!.email ?? ""} initialTopic={t} />;
}
