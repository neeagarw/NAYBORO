import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { AppShell } from "@/components/AppShell";
import { ChatsClient, type Chat, type Hello, type Sent } from "./ChatsClient";

export const metadata = { title: "Chats · Nayboro" };

// Port of design/mockups/chats.html.
export default function ChatsPage() {
  return (
    <Suspense fallback={<div className="app-frame" />}>
      <Chats />
    </Suspense>
  );
}

async function Chats() {
  const supabase = await createClient();
  const [{ data: hellos }, { data: chats }, { data: sent }] = await Promise.all([
    supabase.rpc("inbox_hellos"),
    supabase.rpc("my_chats"),
    supabase.rpc("sent_hellos"),
  ]);
  const photos = await signPhotos([
    ...((hellos ?? []) as Hello[]).map((h) => h.photo_path),
    ...((chats ?? []) as Chat[]).map((c) => c.photo_path),
    ...((sent ?? []) as Sent[]).map((s) => s.photo_path),
  ]);
  return (
    <AppShell tab="chats" title="Chats" sub="A chat opens when both of you say yes">
      <ChatsClient hellos={(hellos ?? []) as Hello[]} chats={(chats ?? []) as Chat[]} sent={(sent ?? []) as Sent[]} photos={photos} />
    </AppShell>
  );
}
