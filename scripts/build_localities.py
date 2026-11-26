#!/usr/bin/env python3
"""
Builds the neighbourhood / postal-code lookup used by hometown search. GENERATED output, never hand-edit it:
  supabase/migrations/20261130000000_localities.sql   (table localities + search_places that uses it)
  src/data/localities.json                             (the same list for the no-database setup)

Each locality points at a place (a city or town from build_world_places.py). Search shows the locality
("Salt Lake", "700091", "75024"), but only the city is ever saved: hometowns stay city-level (product rule 2/3).

Sources (in data/geo/):
  in_post_offices.csv      every Indian post office: name, PIN, district, state   (India Post directory, Open
                           Government Data License - India, via the MIT-licensed indian-pincodes package)
  in_pincode_coords.csv    rough centre of each PIN                               (pincode-lat-long package, ISC)
  in_localities_extra.csv  well-known neighbourhoods that aren't post office names (hand-made; name, PIN)
  zips.csv                 every US ZIP with its city                             (already used for current city)

Run: python3 scripts/build_localities.py
"""
import collections, csv, json, math, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_world_places import world_rows, ascii_fold  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "data", "geo")
OUT_SQL = os.path.join(ROOT, "supabase", "migrations", "20261130000000_localities.sql")
OUT_JSON = os.path.join(ROOT, "src", "data", "localities.json")

BIG_CITY = 1_000_000   # a neighbourhood this close to a city this big belongs to it (Salt Lake -> Kolkata)
BIG_KM, NAME_KM, DISTRICT_KM, NEAR_KM = 20, 30, 60, 35
# Post office state names that differ from the place list's region names.
STATE_SAME = {"Orissa": "Odisha", "Pondicherry": "Puducherry", "Chattisgarh": "Chhattisgarh",
              "Delhi": "Delhi", "Andaman & Nicobar Islands": "Andaman and Nicobar Islands"}


def km(a, b, c, d):
    return 111.2 * math.hypot(a - c, (b - d) * math.cos(math.radians((a + c) / 2)))


def fold(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", s)).strip()


def nice(name):
    """Post office names are often ALL CAPS or end in S.O / B.O / H.O; show them as people write them."""
    n = re.sub(r"\s+", " ", re.sub(r"\s+\(?[SBH]\.?\s?O\.?\)?$", "", name.strip()))
    if n.isupper():
        n = " ".join(w.capitalize() if len(w) > 2 else w for w in n.split())
    return n


class Grid:
    def __init__(self, pts):
        self.cells = collections.defaultdict(list)
        for p in pts:
            self.cells[(int(p["lat"] * 2), int(p["lng"] * 2))].append(p)

    def near(self, lat, lng, r_km):
        out, cy, cx, n = [], int(lat * 2), int(lng * 2), 1 + int(r_km / 50)
        for y in range(cy - n, cy + n + 1):
            for x in range(cx - n, cx + n + 1):
                for p in self.cells.get((y, x), ()):
                    d = km(lat, lng, p["lat"], p["lng"])
                    if d <= r_km:
                        out.append((d, p))
        return out


def main():
    rows, coords = world_rows()
    index = {(c, r, co): i for i, (c, r, co, *_rest) in enumerate(rows)}   # position in places.json
    def pts(country):
        out = []
        for (c, r, co, pop, al) in rows:
            if co == country and (c, r, co) in coords:
                la, lo = coords[(c, r, co)]
                out.append({"key": (c, r, co), "pop": pop, "lat": la, "lng": lo, "region": r,
                            "names": {fold(c)} | {fold(a) for a in al}})
        return out

    out = []   # (display name, code, place key)

    # ---- India: post offices and hand-made neighbourhoods, placed by their PIN's position.
    india = pts("India")
    grid = Grid(india)
    regions = {p["region"] for p in india}
    pin_at = {r["pincode"]: (float(r["lat"]), float(r["lng"])) for r in csv.DictReader(open(os.path.join(GEO, "in_pincode_coords.csv")))
              if 6 < float(r["lat"]) < 37.5 and 68 < float(r["lng"]) < 98}
    offices = list(csv.DictReader(open(os.path.join(GEO, "in_post_offices.csv"), encoding="utf-8")))
    pin_info = {}
    for o in offices:
        pin_info.setdefault(o["pincode"], (o["district"], o["state"]))
    extra = [{"name": r["name"], "pincode": r["pincode"], "district": pin_info.get(r["pincode"], ("", ""))[0],
              "state": pin_info.get(r["pincode"], ("", ""))[1]} for r in csv.DictReader(open(os.path.join(GEO, "in_localities_extra.csv"), encoding="utf-8"))]
    missing = [e["name"] for e in extra if e["pincode"] not in pin_at]
    if missing:
        print("extra localities with an unknown PIN (skipped):", missing)

    def state_of(s):
        s = STATE_SAME.get(s, s)
        if s in regions:
            return s
        f = fold(s)
        for r in regions:
            if fold(r) == f or fold(r).startswith(f) or f.startswith(fold(r)):
                return r
        return None

    unplaced = 0
    for o in offices + extra:
        at = pin_at.get(o["pincode"])
        if not at:
            unplaced += 1
            continue
        lat, lng = at
        st = state_of(o["state"])
        name = nice(o["name"])
        fn, fd = fold(name), fold(o["district"])
        cand = grid.near(lat, lng, DISTRICT_KM)
        same = [(d, p) for d, p in cand if st is None or p["region"] == st]
        pick = None
        # 1. The office is named after a town nearby ("Noida Sector 12" -> Noida).
        named = [(d, p) for d, p in same if d <= NAME_KM and any(len(n) >= 4 and (fn == n or fn.startswith(n + " ")) for n in p["names"])]
        if named:
            pick = max(named, key=lambda x: x[1]["pop"])[1]
        # 2. A big city close by ("Salt Lake" -> Kolkata).
        if not pick:
            big = [(d, p) for d, p in same if d <= BIG_KM and p["pop"] >= BIG_CITY]
            if big:
                pick = max(big, key=lambda x: x[1]["pop"])[1]
        # 3. The district is named after its main town (Howrah, Thane, Gurgaon).
        if not pick and fd:
            dist = [(d, p) for d, p in same if fd in p["names"] or fold(re.sub(r"\(.*\)", "", o["district"])) in p["names"]]
            if dist:
                pick = min(dist, key=lambda x: x[0])[1]
        # 4. Otherwise the nearest town.
        if not pick:
            near = [(d, p) for d, p in cand if d <= NEAR_KM]
            if near:
                pick = min(near, key=lambda x: x[0])[1]
        if not pick:
            unplaced += 1
            continue
        out.append((name, o["pincode"], pick["key"]))
    print(f"India: {len(out)} localities placed, {unplaced} left out (no PIN position or no town within {NEAR_KM} km)")

    # ---- United States: each ZIP points at its city (or the nearest town on the list).
    us = pts("United States")
    ugrid = Grid(us)
    states = {s["stateCode"]: s["name"] for s in json.load(open(os.path.join(GEO, "states.json")))}
    n_us = 0
    for z in csv.DictReader(open(os.path.join(GEO, "zips.csv"), encoding="utf-8")):
        if not z["lat"]:
            continue
        lat, lng, st, fn = float(z["lat"]), float(z["lng"]), states.get(z["state"], ""), fold(z["city"])
        cand = ugrid.near(lat, lng, NEAR_KM)
        same = [(d, p) for d, p in cand if p["region"] == st]
        named = [(d, p) for d, p in same if fn in p["names"]]          # "New York" is an older name of New York City
        big = [(d, p) for d, p in same if d <= BIG_KM and p["pop"] >= BIG_CITY]
        p = (max(named, key=lambda x: x[1]["pop"]) if named else max(big, key=lambda x: x[1]["pop"]) if big
             else min(cand, key=lambda x: x[0]) if cand else (None, None))[1]
        if p:
            out.append((z["city"].title() if z["city"].isupper() else z["city"], z["zip"], p["key"])); n_us += 1
    print(f"US: {n_us} ZIPs placed")

    # One row per (name, code, place). The first row of each code is the one a code search shows: the place most
    # of that code's localities belong to.
    seen, rows_out = set(), []
    by_code = collections.defaultdict(collections.Counter)
    for name, code, key in out:
        by_code[code][key] += 1
    main_place = {c: cnt.most_common(1)[0][0] for c, cnt in by_code.items()}
    for name, code, key in out:
        k = (fold(name), code, key)
        if k in seen:
            continue
        seen.add(k)
        rows_out.append((name, fold(name), code, key))
    done_code = set()
    final = []
    for name, sname, code, key in rows_out:
        primary = key == main_place[code] and code not in done_code
        if primary:
            done_code.add(code)
        final.append((name, sname, code, key, primary))

    def q(s):
        return "'" + s.replace("'", "''") + "'"

    with open(OUT_SQL, "w", encoding="utf-8") as f:
        f.write("-- GENERATED by scripts/build_localities.py from data/geo/. Do not edit by hand.\n")
        f.write("-- Neighbourhoods and postal codes (Indian PINs, US ZIPs) for hometown search. Each points at a city in\n")
        f.write("-- places; search shows the neighbourhood or code but only the city is ever saved.\n\n")
        f.write("""create table if not exists localities (
  id          bigserial primary key,
  name        text not null,
  search_name text not null,
  code        text not null,
  is_main     boolean not null default false,   -- the row a search by this code shows
  place_id    bigint not null references places on delete cascade
);
alter table localities enable row level security;
create policy "read localities" on localities for select to authenticated using (true);

create temporary table _l (name text, search_name text, code text, is_main boolean, city text, region text, country text);
""")
        for i in range(0, len(final), 2000):
            vals = ",\n".join(f"({q(n)},{q(s)},{q(c)},{'true' if m else 'false'},{q(k[0])},{q(k[1])},{q(k[2])})"
                              for n, s, c, k, m in final[i:i + 2000])
            f.write(f"insert into _l values\n{vals};\n")
        f.write("""
insert into localities (name, search_name, code, is_main, place_id)
select l.name, l.search_name, l.code, l.is_main, p.id from _l l join places p on p.city = l.city and p.region = l.region and p.country = l.country;
drop table _l;

create index if not exists localities_search on localities (search_name text_pattern_ops);
create index if not exists localities_code on localities (code text_pattern_ops) where is_main;
create index if not exists localities_place on localities (place_id);
""")
        f.write(open(os.path.join(ROOT, "scripts", "search_places.sql"), encoding="utf-8").read())

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        # [name, search name, code, is main (1/0), place position in places.json]
        json.dump([[n, s, c, 1 if m else 0, index[k]] for n, s, c, k, m in final], f, separators=(",", ":"), ensure_ascii=False)
    print(len(final), "localities ->", os.path.relpath(OUT_SQL, ROOT), "and", os.path.relpath(OUT_JSON, ROOT))


if __name__ == "__main__":
    main()
