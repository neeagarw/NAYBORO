import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Welcome } from "@/components/Welcome";
import { ComingSoon, ComingSoonShell } from "@/components/ComingSoon";
import { waitlistStore, isBetaSite, publicSiteUrl } from "@/lib/store";
import { BetaGate } from "@/components/BetaGate";

// Home page. Before launch (site_mode = 'waitlist') it's the coming-soon waitlist page;
// after launch (Admin → Waitlist → Open Nayboro) it's the normal welcome.
// Before launch the home page is the waitlist (or the beta front page): its real story shows while it loads.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<ComingSoonShell beta={isBetaSite()} />}>
      <HomeInner searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeInner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref : null;
  const year = new Date().getFullYear();

  // Google Sheet setup: no database, always the coming-soon page.
  if (waitlistStore() === "sheet") {
    return <ComingSoon refCode={ref} signedInEmail={null} guessedCity={null} year={year} showLogin={false} />;
  }

  const supabase = await createClient();
  const [{ data: mode }, { data: { user } }] = await Promise.all([supabase.rpc("site_mode"), supabase.auth.getUser()]);
  // After "Delete my account": a short confirmation on whichever home page shows.
  const deleted = sp.deleted ? (
    <div role="status" className="fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[90vw] rounded-2xl bg-green px-4 py-3 text-sm font-semibold text-white shadow-lg">
      Your account and everything in it has been deleted.
    </div>
  ) : null;
  if (mode === "open") return <>{deleted}<Welcome /></>;
  if (isBetaSite()) return <>{deleted}<BetaGate notListedEmail={sp.notyet ? user?.email ?? null : null} joinUrl={publicSiteUrl()} year={year} /></>;

  return <>{deleted}<ComingSoon refCode={ref} signedInEmail={sp.notyet ? user?.email ?? null : null} guessedCity={null} year={year} showLogin /></>;
}
