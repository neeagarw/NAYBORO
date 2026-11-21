import "server-only";
import geo from "@/data/geo.json";

// City / ZIP / hometown lookups from the bundled place data (src/data/geo.json, made by
// scripts/export_geo_json.py from the same source as the database). Same rules as the SQL
// functions search_areas, locate_area and search_places, so both setups behave alike.

type Area = [id: number, name: string, state: string, metro: string, lat: number, lng: number, weight: number];
type Zip = [zip: string, areaId: number, lat: number, lng: number];
type PlaceRow = [id: number, city: string, region: string, country: string];
const G = geo as unknown as { metros: Record<string, [string, number]>; areas: Area[]; zips: Zip[]; places: PlaceRow[] };

export type City = { id: number; name: string; state: string; metro: string; metro_name: string; zip?: string | null };
export type Place = { id: number; city: string; region: string; country: string };

const byId = new Map(G.areas.map((a) => [a[0], a]));
const city = (a: Area, zip: string | null = null): City => ({ id: a[0], name: a[1], state: a[2], metro: a[3], metro_name: G.metros[a[3]]?.[0] ?? "", zip });
const clamp = (n: number) => Math.min(Math.max(Math.trunc(n) || 8, 1), 20);

/** Typed search: ZIP prefix ("945") or city name prefix ("Frem"); biggest cities first (areas are pre-sorted by weight). */
export function searchAreas(q: string, limit = 8): City[] {
  const t = q.trim(), n = clamp(limit), out: City[] = [];
  if (/^[0-9]{3,5}$/.test(t)) {
    for (const z of G.zips) { if (z[0].startsWith(t)) { const a = byId.get(z[1]); if (a) out.push(city(a, z[0])); if (out.length >= n) break; } }
    return out;
  }
  if (/^[0-9]/.test(t) || t.length < 2) return out;
  const p = t.toLowerCase();
  for (const a of G.areas) { if (a[1].toLowerCase().startsWith(p)) { out.push(city(a)); if (out.length >= n) break; } }
  return out;
}

/** Nearest ZIP to a position, if it's within its metro's matching distance. Nothing is stored. */
export function locateArea(lat: number, lng: number): City | null {
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  const dLng = 0.6 / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  let best: Zip | null = null, bestKm = Infinity;
  for (const z of G.zips) {
    if (Math.abs(z[2] - lat) > 0.6 || Math.abs(z[3] - lng) > dLng) continue;
    const km = haversine(lat, lng, z[2], z[3]);
    if (km < bestKm) { bestKm = km; best = z; }
  }
  const a = best && byId.get(best[1]);
  if (!a) return null;
  return bestKm <= (G.metros[a[3]]?.[1] ?? 0) ? city(a) : null;
}

/** Hometown suggestions (city name prefix). People can also type anything. */
export function searchPlaces(q: string, limit = 6): Place[] {
  const p = q.trim().toLowerCase();
  if (!p) return [];
  return G.places.filter((r) => r[1].toLowerCase().startsWith(p)).slice(0, clamp(limit)).map(([id, c, r, co]) => ({ id, city: c, region: r, country: co }));
}

export function areaById(id: number): City | null {
  const a = byId.get(id);
  return a ? city(a) : null;
}

function haversine(la1: number, lo1: number, la2: number, lo2: number) {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
