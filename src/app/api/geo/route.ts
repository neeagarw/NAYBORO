import { NextResponse, type NextRequest } from "next/server";
import { waitlistStore } from "@/lib/store";
import { locateArea, searchAreas, searchPlaces } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";

// GET /api/geo?kind=city&q=Frem | kind=home&q=Jai | kind=locate&lat=..&lng=..
// Used by the coming-soon page. In the Google Sheet setup it answers from the bundled place data;
// with Supabase it asks the database (so area ids match the database's).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams, kind = sp.get("kind"), q = (sp.get("q") ?? "").slice(0, 60);
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  const headers = { "Cache-Control": kind === "locate" ? "no-store" : "public, max-age=3600" };

  if (waitlistStore() === "sheet") {
    const data = kind === "city" ? searchAreas(q, 5) : kind === "home" ? searchPlaces(q, 5) : kind === "locate" ? [locateArea(lat, lng)].filter(Boolean) : null;
    return data ? NextResponse.json(data, { headers }) : NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const supabase = await createClient();
  const call = kind === "city" ? supabase.rpc("search_areas", { p_q: q, p_limit: 5 })
    : kind === "home" ? supabase.rpc("search_places", { p_q: q, p_limit: 5 })
    : kind === "locate" ? supabase.rpc("locate_area", { p_lat: lat, p_lng: lng }) : null;
  if (!call) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { data } = await call;
  return NextResponse.json(data ?? [], { headers });
}
