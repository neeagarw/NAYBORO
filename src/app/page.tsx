import { Suspense } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Welcome } from "@/components/Welcome";
import { ComingSoon, type City } from "@/components/ComingSoon";

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
  const supabase = await createClient();
  const [{ data: mode }, { data: { user } }, sp, h] = await Promise.all([supabase.rpc("site_mode"), supabase.auth.getUser(), searchParams, headers()]);
  if (mode === "open") return <Welcome />;

  // Prefill "Your city" from the visitor's approximate location. Vercel adds these headers from the
  // network address (no browser prompt). Used once to find the metro; never stored.
  let city: City | null = null;
  const lat = Number(h.get("x-vercel-ip-latitude")), lng = Number(h.get("x-vercel-ip-longitude"));
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
    const { data } = await supabase.rpc("locate_area", { p_lat: lat, p_lng: lng });
    city = ((data ?? []) as City[])[0] ?? null;
  }

  const ref = typeof sp.ref === "string" ? sp.ref : null;
  return <ComingSoon refCode={ref} signedInEmail={sp.notyet ? user?.email ?? null : null} guessedCity={city} year={new Date().getFullYear()} />;
}
