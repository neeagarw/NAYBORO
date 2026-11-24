import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { getAppConfig } from "@/lib/config";
import { UI } from "@/config/app";
import { listKey } from "@/lib/list-key";
import { AppShell } from "@/components/AppShell";
import { PinIcon } from "@/components/ui";
import { ExploreClient, type Question, type Answer, type Event } from "./ExploreClient";

export const metadata = { title: "Explore" };

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
  const [cfg, { data: qs }, { data: evs }, { data: area }, { data: unanswered }] = await Promise.all([
    getAppConfig(),
    supabase.rpc("questions_for_me", { p_limit: UI.questionsPage }),
    supabase.rpc("events_for_me"),
    supabase.rpc("me_area").maybeSingle(),
    supabase.rpc("unanswered_count"),
  ]);
  const questions = (qs ?? []) as Question[];
  const { data: ans } = questions.length ? await supabase.rpc("answers_for", { qids: questions.map((q) => q.id) }) : { data: [] };
  const answers = (ans ?? []) as Answer[];
  const photos = await signPhotos(answers.map((a) => a.photo_path));
  const a = area as { name: string; metro: string } | null;

  return (
    <AppShell tab="explore" title="Explore" sub={<span className="inline-flex items-center gap-1"><PinIcon />Around {a?.name ?? "you"}</span>}>
      <ExploreClient
        key={listKey(questions, (q) => `${q.id}:${q.answer_count}`)}
        initialTab={tab === "events" ? "e" : "q"}
        questions={questions}
        answers={answers}
        events={(evs ?? []) as Event[]}
        photos={photos}
        topics={cfg.topics}
        tz={cfg.metro?.timezone ?? "UTC"}
        unanswered={unanswered ?? 0}
      />
    </AppShell>
  );
}
