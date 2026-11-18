import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every page in (app) needs a signed-in user who has finished setup.
// The check reads cookies (request-time data), so it sits inside Suspense.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="app-frame" />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
  if (!profile?.onboarded_at) redirect("/setup");

  return children;
}
