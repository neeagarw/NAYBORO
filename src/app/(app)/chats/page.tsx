import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { AppShell } from "@/components/AppShell";
import { UI } from "@/config/app";
import { listKey } from "@/lib/list-key";
import { ChatsClient, type Chat, type Hello, type Sent } from "./ChatsClient";

export const metadata = { title: "Chats" };

// Port of design/mockups/chats.html.
export default function ChatsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" />}>
      <Chats />
    </Suspense>
  );
}

async function Chats() {
  const supabase = await createClient();
  const [{ data: { user } }, { data: hellos }, { data: chats }, { data: sent }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("inbox_hellos"),
    supabase.rpc("my_chats", { p_limit: UI.chatsPage, p_offset: 0 }),
    supabase.rpc("sent_hellos"),
  ]);
  const photos = await signPhotos([
    ...((hellos ?? []) as Hello[]).map((h) => h.photo_path),
    ...((chats ?? []) as Chat[]).map((c) => c.photo_path),
    ...((sent ?? []) as Sent[]).map((s) => s.photo_path),
  ]);
  return (
    <AppShell tab="chats" title="Chats" sub="A chat opens when both of you say yes">
      <ChatsClient key={listKey((chats ?? []) as Chat[], (c) => `${c.conversation_id}:${c.last_at}`)} me={user!.id} hellos={(hellos ?? []) as Hello[]} chats={(chats ?? []) as Chat[]} sent={(sent ?? []) as Sent[]} photos={photos} />
    </AppShell>
  );
}
