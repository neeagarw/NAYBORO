import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { BlockedClient, type Blocked } from "./BlockedClient";

export const metadata = { title: "Blocked people" };

// Settings → Blocked people. Unblocking lets you both see each other again; it doesn't reopen old chats.
export default function BlockedPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" />}>
      <BlockedList />
    </Suspense>
  );
}

async function BlockedList() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_blocks");
  const people = (data ?? []) as Blocked[];
  const photos = await signPhotos(people.map((p) => p.photo_path));
  return <BlockedClient people={people} photos={photos} />;
}
