import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { UI } from "@/config/app";
import { ChatClient, type Header, type Msg } from "./ChatClient";

export const metadata = { title: "Chat" };

// Port of design/mockups/chat.html.
export default function ChatPage({ params }: PageProps<"/chats/[id]">) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="chat" />}>
      <Chat params={params} />
    </Suspense>
  );
}

async function Chat({ params }: { params: PageProps<"/chats/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: header }, { data: msgs }, { data: auth }] = await Promise.all([
    supabase.rpc("chat_header", { conv: id }),
    supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(UI.messagesPage),
    supabase.auth.getUser(),
  ]);
  if (!header) notFound();
  const h = header as Header;
  const photos = await signPhotos([h.photo_path]);
  return (
    <ChatClient
      conv={id}
      me={auth.user!.id}
      header={h}
      photoUrl={h.photo_path ? photos[h.photo_path] : null}
      initial={((msgs ?? []) as Msg[]).reverse()}
    />
  );
}
