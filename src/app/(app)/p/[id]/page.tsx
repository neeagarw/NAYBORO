import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { getAppConfig } from "@/lib/config";
import { ProfileClient, type Card } from "./ProfileClient";

export const metadata = { title: "Profile" };

// Port of design/mockups/profile.html (someone else's profile).
export default function ProfilePage({ params }: PageProps<"/p/[id]">) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="profile" />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: PageProps<"/p/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [cfg, { data: card }, { data: area }, { data: auth }] = await Promise.all([
    getAppConfig(),
    supabase.rpc("profile_card", { p: id }),
    supabase.rpc("me_area").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!card) notFound();
  const c = card as Card;
  const photos = await signPhotos([c.photo_path]);
  const { data: myRoot } = await supabase.from("profile_roots").select("places(city, region)").eq("profile_id", auth.user!.id).eq("position", 1).maybeSingle();
  const place = myRoot?.places as unknown as { city: string; region: string } | null;
  return (
    <ProfileClient
      card={c}
      photoUrl={c.photo_path ? photos[c.photo_path] : null}
      myArea={(area as { name: string } | null)?.name ?? ""}
      myRegion={place?.region ?? ""}
      verbs={cfg.verbs}
    />
  );
}
