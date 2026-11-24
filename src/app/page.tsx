import { Suspense } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Welcome } from "@/components/Welcome";
import { ComingSoon, type City } from "@/components/ComingSoon";
import { waitlistStore, isBetaSite, publicSiteUrl } from "@/lib/store";
import { BetaGate } from "@/components/BetaGate";
import { locateArea } from "@/lib/places";

// Home page. Before launch (site_mode = 'waitlist') it's the coming-soon waitlist page;
// after launch (Admin → Waitlist → Open Nayboro) it's the normal welcome.
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-mist" />}>
      <HomeInner searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeInner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [sp, h] = await Promise.all([searchParams, headers()]);
  const ref = typeof sp.ref === "string" ? sp.ref : null;
  const lat = Number(h.get("x-vercel-ip-latitude")), lng = Number(h.get("x-vercel-ip-longitude"));
  const located = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng);
  const year = new Date().getFullYear();

  // Google Sheet setup: no database, always the coming-soon page.
  if (waitlistStore() === "sheet") {
    return <ComingSoon refCode={ref} signedInEmail={null} guessedCity={located ? locateArea(lat, lng) : null} year={year} showLogin={false} />;
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
  if (isBetaSite()) return <>{deleted}<BetaGate notListedEmail={sp.notyet ? user?.email ?? null : null} joinUrl={publicSiteUrl()} /></>;

  // Prefill "Your city" from the visitor's approximate location. Vercel adds these headers from the
  // network address (no browser prompt). Used once to find the metro; never stored.
  let city: City | null = null;
  if (located) {
    const { data } = await supabase.rpc("locate_area", { p_lat: lat, p_lng: lng });
    city = ((data ?? []) as City[])[0] ?? null;
  }

  return <>{deleted}<ComingSoon refCode={ref} signedInEmail={sp.notyet ? user?.email ?? null : null} guessedCity={city} year={year} showLogin /></>;
}
