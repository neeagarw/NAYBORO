#!/usr/bin/env python3
"""Builds supabase/geo/us_geo.sql: every US city (with ZIPs and centre point) grouped into metro areas.

Inputs (data/geo/, MIT-licensed public data):
  zips.csv        every active US ZIP: city, state, county, time zone, lat/lng   (from the `zipcodes` package)
  metros.json     392 Census metro areas (CBSA) and their counties               (from @actnowcoalition/regions)
  counties.json   3,224 counties with FIPS codes
  states.json     state names, abbreviations, FIPS codes

How a city gets its metro:  ZIPs → their county → the Census metro containing that county.
Then two editable rules below:
  COMBINE          metros people think of as one place (San Jose + San Francisco = "San Francisco Bay Area")
  FRIENDLY_NAMES   names people actually say ("Dallas–Fort Worth" instead of "Dallas-Fort Worth-Arlington")
Cities in no metro are grouped as "Rest of <State>".

Run:  python3 scripts/build_us_geo.py   (then commit the regenerated SQL)
"""
import csv, json, re, statistics, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "geo"
OUT = ROOT / "supabase" / "geo" / "us_geo.sql"

# ── Editable rules ────────────────────────────────────────────────────────────
# Child metro (CBSA code) → parent metro it should be shown as.
COMBINE = {
    "41940": "41860",   # San Jose-Sunnyvale-Santa Clara      → San Francisco Bay Area
    "42220": "41860",   # Santa Rosa-Petaluma                  → San Francisco Bay Area
    "34900": "41860",   # Napa                                 → San Francisco Bay Area
    "46700": "41860",   # Vallejo                              → San Francisco Bay Area
    "42100": "41860",   # Santa Cruz-Watsonville               → San Francisco Bay Area
}
FRIENDLY_NAMES = {
    "41860": "San Francisco Bay Area",
    "35620": "New York City area",
    "31080": "Los Angeles area",
    "16980": "Chicago area",
    "19100": "Dallas–Fort Worth",
    "26420": "Houston area",
    "47900": "Washington, DC area",
    "33100": "South Florida",
    "37980": "Philadelphia area",
    "12060": "Atlanta area",
    "38060": "Phoenix area",
    "14460": "Boston area",
    "40140": "Inland Empire",
    "19820": "Detroit area",
    "42660": "Seattle area",
    "33460": "Minneapolis–St. Paul",
    "41740": "San Diego area",
    "45300": "Tampa Bay",
    "19740": "Denver area",
    "12580": "Baltimore area",
    "41180": "St. Louis area",
    "38900": "Portland, OR area",
    "29820": "Las Vegas area",
    "12420": "Austin area",
    "41700": "San Antonio area",
    "16740": "Charlotte area",
    "36740": "Orlando area",
    "40900": "Sacramento area",
    "38300": "Pittsburgh area",
    "28140": "Kansas City area",
    "39580": "Raleigh area",
    "20500": "Durham–Chapel Hill",
}
NEAR_KM = 25    # "Around <my city>" radius for questions
MATCH_KM = 40   # phone location must be within this of a ZIP centre to count
KEEP_STATES = None  # None = all 50 states + DC + Puerto Rico; or a set like {"TX","CA"}

# ── Helpers ───────────────────────────────────────────────────────────────────
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(city and borough of|municipality of|county|parish|borough|census area|city and borough|municipality|municipio)\b", "", s)
    s = s.replace("saint ", "st ").replace("st. ", "st ")
    return re.sub(r"[^a-z]", "", s)

def q(s) -> str:
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"

def city_title(c: str) -> str:
    # Data is mostly title case already; keep "McKinney", fix "MC KINNEY"-style capitals if any.
    return c if not c.isupper() else c.title()

# ── Load ──────────────────────────────────────────────────────────────────────
states = json.load(open(SRC / "states.json"))
st_by_fips = {s["fipsCode"]: s for s in states}
st_by_code = {s["stateCode"]: s for s in states}
counties = json.load(open(SRC / "counties.json"))
county_fips = {(c["stateFipsCode"], norm(c["name"])): c["fipsCode"] for c in counties}
metros_raw = json.load(open(SRC / "metros.json"))
metro_of_county = {cf: m["fipsCode"] for m in metros_raw for cf in m["counties"]}
metro_by_code = {m["fipsCode"]: m for m in metros_raw}

zips = [r for r in csv.DictReader(open(SRC / "zips.csv")) if r["state"] in st_by_code and r["lat"] and r["lng"]]
if KEEP_STATES: zips = [r for r in zips if r["state"] in KEEP_STATES]

# ── ZIP → county FIPS → metro ─────────────────────────────────────────────────
unmatched = Counter()
for z in zips:
    sf = st_by_code[z["state"]]["fipsCode"]
    cf = county_fips.get((sf, norm(z["county"] or "")))
    if cf is None and z["county"]:
        # "X city" (independent cities in VA/MD/MO) and accented names
        cf = county_fips.get((sf, norm(z["county"].replace(" city", "")) + "city")) or county_fips.get((sf, norm(z["county"]) + "city"))
    if cf is None and z["state"] == "DC": cf = "11001"   # DC is its own county-equivalent
    z["county_fips"] = cf

# A ZIP with a missing or odd county takes the most common county of the other ZIPs in the same city.
city_county = defaultdict(Counter)
for z in zips:
    if z["county_fips"]: city_county[(z["city"], z["state"])][z["county_fips"]] += 1
for z in zips:
    if not z["county_fips"] and city_county[(z["city"], z["state"])]:
        z["county_fips"] = city_county[(z["city"], z["state"])].most_common(1)[0][0]
    if not z["county_fips"]: unmatched[(z["state"], z["county"])] += 1
for z in zips:
    cf = z["county_fips"]
    m = metro_of_county.get(cf) if cf else None
    m = COMBINE.get(m, m)
    z["metro"] = m or f"RS-{z['state']}"

# ── Cities (areas) ────────────────────────────────────────────────────────────
by_city = defaultdict(list)
for z in zips: by_city[(city_title(z["city"]), z["state"])].append(z)
areas = []
for (name, st), zs in by_city.items():
    std = [z for z in zs if z["type"] == "STANDARD"] or zs
    areas.append({
        "name": name, "state": st,
        "metro": Counter(z["metro"] for z in std).most_common(1)[0][0],
        "timezone": Counter(z["timezone"] for z in std if z["timezone"]).most_common(1)[0][0] if any(z["timezone"] for z in std) else None,
        "lat": round(statistics.mean(float(z["lat"]) for z in std), 5),
        "lng": round(statistics.mean(float(z["lng"]) for z in std), 5),
        "zips": sorted(z["zip"] for z in zs),
        "weight": len(zs),
    })

# ── Metros ────────────────────────────────────────────────────────────────────
first_word = Counter(m["name"].split("-")[0] for m in metros_raw)
used = defaultdict(list)
for a in areas: used[a["metro"]].append(a)
metros = []
for code, members in used.items():
    tz = Counter(a["timezone"] for a in members if a["timezone"]).most_common(1)
    tz = tz[0][0] if tz else "America/Chicago"
    if code.startswith("RS-"):
        name = f"Rest of {st_by_code[code[3:]]['name']}"
    elif code in FRIENDLY_NAMES:
        name = FRIENDLY_NAMES[code]
    else:
        raw = metro_by_code[code]["name"]
        first = raw.split("-")[0]
        st = Counter(a["state"] for a in members).most_common(1)[0][0]
        name = f"{first}, {st} area" if first_word[first] > 1 else f"{first} area"
    metros.append({"code": code, "name": name, "timezone": tz})

# ── Write SQL ─────────────────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w") as f:
    f.write("-- GENERATED by scripts/build_us_geo.py. Do not edit by hand; edit the script's rules and re-run.\n")
    f.write(f"-- {len(metros)} metro groups, {len(areas)} cities, {len(zips)} ZIP codes. Sources and licences: data/geo/.\n\n")
    f.write("insert into metros (code, name, timezone, near_km, match_km) values\n")
    f.write(",\n".join(f"  ({q(m['code'])}, {q(m['name'])}, {q(m['timezone'])}, {NEAR_KM}, {MATCH_KM})" for m in sorted(metros, key=lambda m: m["code"])))
    f.write("\non conflict (code) do update set name = excluded.name, timezone = excluded.timezone;\n\n")
    for i in range(0, len(areas), 1000):
        chunk = areas[i:i + 1000]
        f.write("insert into areas (name, state, metro, zips, lat, lng, timezone, weight) values\n")
        f.write(",\n".join(
            f"  ({q(a['name'])}, {q(a['state'])}, {q(a['metro'])}, '{{{','.join(a['zips'])}}}', {a['lat']}, {a['lng']}, {q(a['timezone'])}, {a['weight']})"
            for a in chunk))
        f.write("\non conflict (name, state) do update set metro = excluded.metro, zips = excluded.zips, lat = excluded.lat, lng = excluded.lng, timezone = excluded.timezone, weight = excluded.weight;\n\n")
    for i in range(0, len(zips), 2000):
        chunk = zips[i:i + 2000]
        f.write("insert into zip_codes (zip, area_id, lat, lng)\nselect z.zip, a.id, z.lat, z.lng from (values\n")
        f.write(",\n".join(f"  ({q(z['zip'])}, {q(city_title(z['city']))}, {q(z['state'])}, {float(z['lat'])}, {float(z['lng'])})" for z in chunk))
        f.write("\n) z(zip, city, state, lat, lng) join areas a on a.name = z.city and a.state = z.state\non conflict (zip) do update set area_id = excluded.area_id, lat = excluded.lat, lng = excluded.lng;\n\n")

real = sum(1 for m in metros if not m["code"].startswith("RS-"))
print(f"metros: {real} metro areas + {len(metros) - real} rest-of-state groups")
print(f"cities: {len(areas)}   zips: {len(zips)}   counties not matched: {sum(unmatched.values())} ZIPs in {len(unmatched)} counties")
for k, v in unmatched.most_common(8): print("   unmatched", k, v)
print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
