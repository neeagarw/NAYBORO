import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Welcome } from "@/components/Welcome";
import { ComingSoon } from "@/components/ComingSoon";

// Home page. Before launch (site_mode = 'waitlist') it's the "Join the community" page;
// after launch (Admin → Waitlist → Open Nayboro) it's the normal welcome.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ground" />}>
      <HomeInner searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeInner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const supabase = await createClient();
  const [{ data: mode }, { data: { user } }, sp] = await Promise.all([supabase.rpc("site_mode"), supabase.auth.getUser(), searchParams]);
  if (mode === "open") return <Welcome />;
  const ref = typeof sp.ref === "string" ? sp.ref : null;
  return <ComingSoon refCode={ref} signedInEmail={sp.notyet ? user?.email ?? null : null} />;
}
