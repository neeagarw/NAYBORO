#!/usr/bin/env python3
"""
Builds the worldwide hometown list (places) from open data. GENERATED output, never hand-edit it:
  supabase/migrations/20261125120000_world_places.sql   (adds every place, keeps existing ids)
  src/data/places.json                                   (the same list for the no-database setup)

Sources (in data/geo/):
  cities5000.csv  every city/town with 5,000+ people   GeoNames (CC BY 4.0), via the geonamescache package
  admin1.csv      state / province names               countries-states-cities-database (ODbL)

Refresh cities5000.csv:  pip install geonamescache && python3 scripts/build_world_places.py --refresh
Then:                    python3 scripts/build_world_places.py
Note: search_places was later refined in 20261125140000_search_places_alias_rank.sql (older names rank as exact).
"""
import csv, json, math, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEO = os.path.join(ROOT, "data", "geo")
OUT_SQL = os.path.join(ROOT, "supabase", "migrations", "20261125120000_world_places.sql")
OUT_JSON = os.path.join(ROOT, "src", "data", "places.json")

# Old or common English names people still type. Only names GeoNames itself lists for the city are used.
ALIASES = {
    "IN": ["Bangalore", "Bombay", "Calcutta", "Madras", "Gurgaon", "Mysore", "Baroda", "Poona", "Cochin",
           "Trivandrum", "Benares", "Banaras", "Allahabad", "Pondicherry", "Vizag", "Calicut", "Mangalore",
           "Trichy", "Simla", "Belgaum", "Hubli", "Gulbarga", "Cawnpore", "Jubbulpore", "Ootacamund", "Ooty",
           "Kalyan", "Bhubaneshwar", "Panaji", "Darjeeling", "Thane", "Vadodara", "Prayagraj", "Gurugram", "Mysuru", "Bengaluru"],
    "BD": ["Dacca", "Chittagong"], "LK": ["Kandy"], "MM": ["Rangoon"], "VN": ["Saigon"], "CN": ["Peking", "Canton"],
}
# Names already in the database under a different spelling: don't add a second copy of the same city.
SAME_AS_EXISTING = {("IN", "Mysore"): "Mysuru", ("IN", "Bangalore"): "Bengaluru"}


def ascii_fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def refresh():
    import geonamescache  # noqa: only needed to refresh
    d = os.path.join(os.path.dirname(geonamescache.__file__), "data")
    cities = json.load(open(os.path.join(d, "cities5000.json"), encoding="utf-8"))
    wanted = {a.lower() for v in ALIASES.values() for a in v}
    with open(os.path.join(GEO, "cities5000.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["geonameid", "name", "lat", "lng", "country", "population", "admin1", "aliases"])
        for c in cities.values():
            seen, al = {c["name"].lower()}, []
            for a in sorted(c.get("alternatenames", [])):
                if a.lower() in wanted and a.lower() not in seen:
                    seen.add(a.lower()); al.append(a)
            w.writerow([c["geonameid"], c["name"], round(c["latitude"], 4), round(c["longitude"], 4), c["countrycode"],
                        c["population"], c["admin1code"], "|".join(al)])
    countries = json.load(open(os.path.join(d, "countries.json"), encoding="utf-8"))
    with open(os.path.join(GEO, "countries.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["iso", "name"])
        for c in sorted(countries.values(), key=lambda c: c["iso"]):
            w.writerow([c["iso"], c["name"]])
    print("refreshed", len(cities), "cities")


def build():
    countries = {r["iso"]: r["name"] for r in csv.DictReader(open(os.path.join(GEO, "countries.csv"), encoding="utf-8"))}
    countries["US"] = "United States"
    states = {}
    by_country = {}
    for r in csv.DictReader(open(os.path.join(GEO, "admin1.csv"), encoding="utf-8")):
        for code in (r["fips"], r["iso"]):
            if code:
                states.setdefault((r["country"], code), r["name"])
        if r["lat"] and r["lng"]:
            by_country.setdefault(r["country"], []).append((float(r["lat"]), float(r["lng"]), r["name"]))

    def km(a, b, c, d):
        return 111 * math.hypot(a - c, (b - d) * math.cos(math.radians(a)))

    centroid = {(cc, n): (la, lo) for cc, lst in by_country.items() for la, lo, n in lst}

    # The two datasets number states differently in a few countries. Check each state code once: the
    # middle of that code's cities must sit near the state it names; if not, use the nearest state instead.
    pts = {}
    for r in csv.DictReader(open(os.path.join(GEO, "cities5000.csv"), encoding="utf-8")):
        pts.setdefault((r["country"], r["admin1"]), []).append((float(r["lat"]), float(r["lng"])))
    trusted = set()
    for (cc, code), lst in pts.items():
        named = states.get((cc, code))
        if not named or (cc, named) not in centroid:
            continue
        la = sorted(p[0] for p in lst)[len(lst) // 2]; lo = sorted(p[1] for p in lst)[len(lst) // 2]
        nearest = min(km(la, lo, a, b) for a, b, _ in by_country[cc])
        if km(la, lo, *centroid[(cc, named)]) <= 1.5 * nearest + 60:
            trusted.add((cc, code))

    def region_for(cc, code, lat, lng):
        if (cc, code) in trusted:
            return states[(cc, code)]
        cand = by_country.get(cc)
        if cand:
            return min(cand, key=lambda s: km(lat, lng, s[0], s[1]))[2]
        return states.get((cc, code), "")

    # Places already in the database (supabase/seed.sql) keep their spelling of the region.
    seed = open(os.path.join(ROOT, "supabase", "seed.sql"), encoding="utf-8").read()
    block = seed[seed.index("insert into places"):]
    block = block[:block.index(";")]
    existing = {(c, co): r for c, r, co in re.findall(r"\('([^']*)','([^']*)','([^']*)'\)", block)}
    biggest = {}
    for r in csv.DictReader(open(os.path.join(GEO, "cities5000.csv"), encoding="utf-8")):
        k = (SAME_AS_EXISTING.get((r["country"], r["name"]), r["name"]), countries.get(r["country"]))
        if k in existing and int(r["population"] or 0) > biggest.get(k, (0, None))[0]:
            biggest[k] = (int(r["population"] or 0), r["geonameid"])
    seed_ids = {v[1]: existing[k] for k, v in biggest.items()}

    best = {}
    for r in csv.DictReader(open(os.path.join(GEO, "cities5000.csv"), encoding="utf-8")):
        cc = r["country"]
        if cc not in countries:
            continue
        name = SAME_AS_EXISTING.get((cc, r["name"]), r["name"])
        lat, lng, pop = float(r["lat"]), float(r["lng"]), int(r["population"] or 0)
        region = seed_ids.get(r["geonameid"]) or region_for(cc, r["admin1"], lat, lng) or countries[cc]
        key = (name, region, countries[cc])
        aliases = [a for a in r["aliases"].split("|") if a and a != name]
        if key not in best or pop > best[key][3]:
            best[key] = (name, region, countries[cc], pop, aliases)

    rows = sorted(best.values(), key=lambda x: (-x[3], x[0]))

    def q(s):
        return "'" + s.replace("'", "''") + "'"

    with open(OUT_SQL, "w", encoding="utf-8") as f:
        f.write("-- GENERATED by scripts/build_world_places.py from data/geo/. Do not edit by hand.\n")
        f.write("-- Every city and town in the world with 5,000+ people becomes a possible hometown.\n")
        f.write("-- Places already in the table keep their ids (people's saved hometowns don't change).\n\n")
        f.write("alter table places add column if not exists population int not null default 0;\n")
        f.write("alter table places add column if not exists aliases text[];\n")
        f.write("alter table places add column if not exists search_name text;\n\n")
        f.write("create temporary table _p (city text, region text, country text, population int, aliases text[], search_name text);\n")
        for i in range(0, len(rows), 1000):
            chunk = rows[i:i + 1000]
            vals = ",\n".join(
                f"({q(c)},{q(r)},{q(co)},{p},{('array[' + ','.join(q(a) for a in al) + ']') if al else 'null'},{q(ascii_fold(c))})"
                for c, r, co, p, al in chunk)
            f.write(f"insert into _p values\n{vals};\n")
        f.write("""
-- Existing places: fill in population, aliases and the search name.
update places p set population = x.population, aliases = x.aliases, search_name = x.search_name
from _p x where x.city = p.city and x.region = p.region and x.country = p.country;
update places set search_name = lower(city) where search_name is null;

insert into places (city, region, country, population, aliases, search_name)
select city, region, country, population, aliases, search_name from _p
on conflict (city, region, country) do nothing;

-- Places added later (seed file, admin) get a search name automatically.
create or replace function places_search_name() returns trigger language plpgsql as $f$
begin
  if new.search_name is null then new.search_name := lower(new.city); end if;
  return new;
end $f$;
drop trigger if exists places_search_name on places;
create trigger places_search_name before insert or update of city on places for each row execute function places_search_name();
alter table places alter column search_name set not null;
create index if not exists places_search on places (search_name text_pattern_ops, population desc);
create index if not exists places_city_lower on places (lower(city) text_pattern_ops);
create index if not exists places_with_aliases on places (id) where aliases is not null;

-- Hometown search: prefix match on the name (accents ignored) or a known older name; biggest places first.
create or replace function search_places(p_q text, p_limit int default 6)
returns table (id bigint, city text, region text, country text)
language sql stable security definer set search_path = public as $$
  with q as (select lower(replace(replace(btrim(p_q), '%', ''), '_', '')) as s),
  hits as (
    select p.id from places p, q where length(q.s) >= 1 and p.search_name like q.s || '%'
    union select p.id from places p, q where length(q.s) >= 1 and lower(p.city) like q.s || '%'
    union select p.id from places p, q where length(q.s) >= 1 and p.aliases is not null
      and exists (select 1 from unnest(p.aliases) a where lower(a) like q.s || '%')
  )
  select p.id, p.city, p.region, p.country from places p join hits h on h.id = p.id, q
  order by (lower(p.city) = q.s or p.search_name = q.s) desc, p.population desc, p.city
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function search_places(text, int) to anon, authenticated;
drop table _p;
""")
    # For the no-database (Google Sheet) setup: [city, region, country, population, search_name, aliases]
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump([[c, r, co, p, ascii_fold(c), al] for c, r, co, p, al in rows], f, separators=(",", ":"), ensure_ascii=False)
    print(len(rows), "places ->", os.path.relpath(OUT_SQL, ROOT), "and", os.path.relpath(OUT_JSON, ROOT))


if __name__ == "__main__":
    refresh() if "--refresh" in sys.argv else build()
