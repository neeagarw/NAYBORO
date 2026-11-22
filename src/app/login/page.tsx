import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { LoginForm } from "./LoginForm";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { isBetaSite, publicSiteUrl } from "@/lib/store";

export const metadata = { title: "Log in" };

// searchParams is request-time data, so it is read inside a Suspense boundary (Cache Components).
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <WithNext searchParams={searchParams} />
    </Suspense>
  );
}

async function WithNext({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [{ next }, supabase] = await Promise.all([searchParams, createClient()]);
  // Before launch only beta testers can get in, so the screen says so.
  const { data: mode } = await supabase.rpc("site_mode");
  return <LoginForm next={safeNext(typeof next === "string" ? next : undefined)} prelaunch={mode !== "open"} joinUrl={isBetaSite() ? publicSiteUrl() : "/"} />;
}
