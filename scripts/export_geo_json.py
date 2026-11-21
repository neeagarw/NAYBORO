"""Export the place data the coming-soon page needs to src/data/geo.json, so the page can run
without a database (the Google Sheet setup). Run after loading supabase/seed.sql into a local db:
  PGHOST=... python3 scripts/export_geo_json.py <dbname>
"""
import json, subprocess, sys
db = sys.argv[1] if len(sys.argv) > 1 else "e2e"
def rows(sql):
    out = subprocess.run(["psql", "-d", db, "-qtA", "-F", "\t", "-c", sql], check=True, capture_output=True, text=True).stdout
    return [l.split("\t") for l in out.splitlines() if l]
metros = {c: [n, int(k)] for c, n, k in rows("select code, name, match_km from metros order by code")}
areas = [[int(i), n, s, m, round(float(la), 4), round(float(lo), 4), int(w)] for i, n, s, m, la, lo, w in rows("select id, name, state, metro, lat, lng, weight from areas order by weight desc, name, state")]
zips = [[z, int(a), round(float(la), 4), round(float(lo), 4)] for z, a, la, lo in rows("select zip, area_id, lat, lng from zip_codes order by zip")]
places = [[int(i), c, r, co] for i, c, r, co in rows("select id, city, region, country from places order by city")]
json.dump({"metros": metros, "areas": areas, "zips": zips, "places": places}, open("src/data/geo.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(metros), "metros,", len(areas), "areas,", len(zips), "zips,", len(places), "places")
