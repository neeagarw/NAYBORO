import "server-only";
import geo from "@/data/geo.json";
import world from "@/data/places.json";
import localities from "@/data/localities.json";

// City / ZIP / hometown lookups from the bundled place data (src/data/geo.json, made by
// scripts/export_geo_json.py from the same source as the database). Same rules as the SQL
// functions search_areas, locate_area and search_places, so both setups behave alike.

type Area = [id: number, name: string, state: string, metro: string, lat: number, lng: number, weight: number];
type Zip = [zip: string, areaId: number, lat: number, lng: number];
type PlaceRow = [id: number, city: string, region: string, country: string];
const G = geo as unknown as { metros: Record<string, [string, number]>; areas: Area[]; zips: Zip[]; places: PlaceRow[] };

export type City = { id: number; name: string; state: string; metro: string; metro_name: string; zip?: string | null };
export type Place = { id: number; city: string; region: string; country: string; via?: string | null };

const byId = new Map(G.areas.map((a) => [a[0], a]));
const city = (a: Area, zip: string | null = null): City => ({ id: a[0], name: a[1], state: a[2], metro: a[3], metro_name: G.metros[a[3]]?.[0] ?? "", zip });
const clamp = (n: number) => Math.min(Math.max(Math.trunc(n) || 8, 1), 20);

/** Typed search: ZIP prefix ("945", "75024-1234") or city name prefix ("Frem"), optionally with a state
 * ("Plano, TX", "Plano TX"); biggest cities first (areas are pre-sorted by weight). Same rules as SQL search_areas. */
export function searchAreas(q: string, limit = 8): City[] {
  let t = q.trim();
  const n = clamp(limit), out: City[] = [];
  if (/^[0-9]{5}-[0-9]{0,4}$/.test(t)) t = t.slice(0, 5);
  if (/^[0-9]{3,5}$/.test(t)) {
    for (const z of G.zips) { if (z[0].startsWith(t)) { const a = byId.get(z[1]); if (a) out.push(city(a, z[0])); if (out.length >= n) break; } }
    return out;
  }
  if (/^[0-9]/.test(t) || t.length < 2) return out;
  const comma = t.indexOf(",");
  let head = t, st: string | null = null;
  if (comma >= 0) { head = t.slice(0, comma).trim(); st = t.slice(comma + 1).trim().toLowerCase(); }
  else { const m = /^(.+?)\s+([A-Za-z]{2})$/.exec(t); if (m) { head = m[1]; st = m[2].toLowerCase(); } }
  const find = (name: string, state: string | null) => {
    const p = name.toLowerCase(), res: City[] = [];
    for (const a of G.areas) {
      if (!a[1].toLowerCase().startsWith(p)) continue;
      if (state && a[2].toLowerCase() !== state && !(state.length > 2 && (G.metros[a[3]]?.[0] ?? "").toLowerCase().includes(state))) continue;
      res.push(city(a)); if (res.length >= n) break;
    }
    return res;
  };
  if (st && head.length >= 2) { const r = find(head, st); if (r.length) return r; }
  const r = find(comma >= 0 ? head : t, null);
  if (r.length || !st || comma >= 0) return r;
  return find(head, null);
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
// Worldwide hometowns (src/data/places.json, made by scripts/build_world_places.py), biggest first:
// [city, region, country, population, search name (no accents), older names]. Ids here are list positions;
// the no-database setup only keeps the place's name.
type WorldRow = [city: string, region: string, country: string, population: number, search: string, aliases: string[]];
const W = world as unknown as WorldRow[];

// Neighbourhoods and postal codes (src/data/localities.json, made by scripts/build_localities.py):
// [name, search name, code, is the row a code search shows (1/0), place position in places.json].
type LocalityRow = [name: string, search: string, code: string, main: number, place: number];
const L = localities as unknown as LocalityRow[];
const foldQ = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const asPlace = (i: number, via: string | null = null): Place => ({ id: i + 1, city: W[i][0], region: W[i][1], country: W[i][2], via });

/** Hometown search: same rules as the SQL search_places (scripts/search_places.sql): a place by name or older
 * name, a neighbourhood ("Salt Lake" -> Kolkata), a PIN/ZIP ("700091"), and "City, State" narrowing. */
export function searchPlaces(q: string, limit = 6): Place[] {
  const t = q.trim().replace(/[%_]/g, ""), n = clamp(limit);
  if (!t) return [];
  if (/^[0-9][0-9 -]*$/.test(t)) {
    let code = t.replace(/[^0-9]/g, "");
    if (/^[0-9]{5}-[0-9]{1,4}$/.test(t)) code = code.slice(0, 5);
    if (code.length < 3) return [];
    return L.filter((r) => r[3] && r[2].startsWith(code))
      .sort((a, b) => Number(b[2] === code) - Number(a[2] === code) || a[2].length - b[2].length || a[2].localeCompare(b[2]))
      .slice(0, n).map((r) => asPlace(r[4], r[2]));
  }
  const comma = t.indexOf(",");
  if (comma >= 0) {
    const head = t.slice(0, comma).trim(), r = placesCore(head, t.slice(comma + 1).trim(), n);
    return r.length ? r : placesCore(head, null, n);
  }
  const r = placesCore(t, null, n);
  if (r.length) return r;
  const words = t.split(/\s+/);
  for (let k = words.length - 1; k >= Math.max(1, words.length - 3); k--) {
    const x = placesCore(words.slice(0, k).join(" "), words.slice(k).join(" "), n);
    if (x.length) return x;
  }
  return [];
}

function placesCore(head: string, tail: string | null, n: number): Place[] {
  const p = head.toLowerCase(), f = foldQ(head), tl = tail?.toLowerCase().trim() || null;
  if (!p) return [];
  const best = new Map<number, { via: string | null; kind: number; exact: boolean }>();
  const add = (i: number, via: string | null, kind: number, exact: boolean) => {
    const o = best.get(i);
    if (!o || Number(exact) > Number(o.exact) || (exact === o.exact && (kind < o.kind || (kind === o.kind && (via?.length ?? 0) < (o.via?.length ?? 0))))) best.set(i, { via, kind, exact });
  };
  for (let i = 0; i < W.length; i++) {
    const [c, , , , s, al] = W[i], lc = c.toLowerCase();
    if (s.startsWith(p) || lc.startsWith(p) || al.some((a) => a.toLowerCase().startsWith(p)))
      add(i, null, 0, lc === p || s === p || al.some((a) => a.toLowerCase() === p));   // an older name counts as exact
  }
  if (f.length >= 2) for (const r of L) if (r[1].startsWith(f) && r[1] !== W[r[4]][4]) add(r[4], r[0], 1, r[1] === f);
  const fits = (i: number) => {
    if (!tl) return true;
    const [c, region, country] = W[i];
    if (region.toLowerCase().startsWith(tl) || country.toLowerCase().startsWith(tl)) return true;
    return country === "United States" && tl.length === 2 && G.areas.some((a) => a[2].toLowerCase() === tl && a[1].toLowerCase() === c.toLowerCase());
  };
  return [...best.entries()].filter(([i]) => fits(i))
    .sort(([i, a], [j, b]) => Number(b.exact) - Number(a.exact) || a.kind - b.kind || W[j][3] - W[i][3] || W[i][0].localeCompare(W[j][0]))
    .slice(0, n).map(([i, v]) => asPlace(i, v.via));
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
