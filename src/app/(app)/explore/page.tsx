import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { AppShell } from "@/components/AppShell";
import { PinIcon } from "@/components/ui";
import { ExploreClient, type Question, type Answer, type Event } from "./ExploreClient";

export const metadata = { title: "Explore · Nayboro" };

// Port of design/mockups/explore.html (Questions and Events tabs).
export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="feed" />}>
      <Explore searchParams={searchParams} />
    </Suspense>
  );
}

async function Explore({ searchParams }: { searchParams: PageProps<"/explore">["searchParams"] }) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const [{ data: qs }, { data: evs }, { data: area }] = await Promise.all([
    supabase.rpc("questions_for_me"),
    supabase.rpc("events_for_me"),
    supabase.rpc("me_area").maybeSingle(),
  ]);
  const questions = (qs ?? []) as Question[];
  const { data: ans } = questions.length ? await supabase.rpc("answers_for", { qids: questions.map((q) => q.id) }) : { data: [] };
  const answers = (ans ?? []) as Answer[];
  const photos = await signPhotos(answers.map((a) => a.photo_path));
  const a = area as { name: string; metro: string } | null;

  return (
    <AppShell tab="explore" title="Explore" sub={<span className="inline-flex items-center gap-1"><PinIcon />Around {a?.name ?? "you"}</span>}>
      <ExploreClient
        initialTab={tab === "events" ? "e" : "q"}
        questions={questions}
        answers={answers}
        events={(evs ?? []) as Event[]}
        photos={photos}
      />
    </AppShell>
  );
}
