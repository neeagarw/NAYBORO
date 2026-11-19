-- Nationwide: every US city, grouped into metro areas (data: supabase/geo/us_geo.sql, built by scripts/build_us_geo.py).
-- "Find my city" sends the phone's position here once; we return the city and never store the position.

alter table areas add column timezone text;
alter table areas add column weight int not null default 1;     -- number of ZIPs: a simple "how big is this city"
create index areas_name_prefix on areas (lower(name) text_pattern_ops);
create index on areas (metro, weight desc);

create table zip_codes (
  zip      text primary key,
  area_id  bigint not null references areas on delete cascade,
  lat      double precision not null,
  lng      double precision not null
);
create index on zip_codes (lat, lng);
create index on zip_codes (area_id);
alter table zip_codes enable row level security;
create policy "read zip codes" on zip_codes for select to authenticated using (true);

-- Phone position → city and metro. Nearest ZIP centre within the metro's match_km.
-- Nothing is written: the position exists only for the length of this call.
create or replace function locate_area(p_lat double precision, p_lng double precision)
returns table (id bigint, name text, state text, metro text, metro_name text, km numeric)
language sql stable security definer set search_path = public as $$
  with box as (
    select z.area_id, 6371 * 2 * asin(sqrt(power(sin(radians(z.lat - p_lat) / 2), 2)
             + cos(radians(p_lat)) * cos(radians(z.lat)) * power(sin(radians(z.lng - p_lng) / 2), 2))) as km
    from zip_codes z
    where z.lat between p_lat - 0.6 and p_lat + 0.6
      and z.lng between p_lng - 0.6 / greatest(cos(radians(p_lat)), 0.2) and p_lng + 0.6 / greatest(cos(radians(p_lat)), 0.2)
    order by 2 limit 1
  )
  select a.id, a.name, a.state, a.metro, m.name, round(box.km::numeric, 1)
  from box join areas a on a.id = box.area_id join metros m on m.code = a.metro
  where p_lat between -90 and 90 and p_lng between -180 and 180 and box.km <= m.match_km;
$$;

-- Typed search: city name prefix ("Frem") or ZIP prefix ("945"). Biggest cities first.
create or replace function search_areas(p_q text, p_limit int default 8)
returns table (id bigint, name text, state text, metro text, metro_name text, timezone text, zip text)
language sql stable security definer set search_path = public as $$
  with q as (select btrim(p_q) as t)
  select * from (
    select a.id, a.name, a.state, a.metro, m.name, m.timezone, z.zip
    from q, zip_codes z join areas a on a.id = z.area_id join metros m on m.code = a.metro
    where q.t ~ '^[0-9]{3,5}$' and z.zip like q.t || '%'
    order by z.zip
    limit least(greatest(p_limit, 1), 20)
  ) by_zip
  union all
  select * from (
    select a.id, a.name, a.state, a.metro, m.name, m.timezone, null::text
    from q, areas a join metros m on m.code = a.metro
    where q.t !~ '^[0-9]' and length(q.t) >= 2
      and lower(a.name) like lower(replace(replace(q.t, '%', ''), '_', '')) || '%'
    order by a.weight desc, a.name, a.state
    limit least(greatest(p_limit, 1), 20)
  ) by_name;
$$;

-- The person's metro: name, time zone and its biggest cities (for copy like "Fremont, Oakland, San Jose and more").
create or replace function app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'metro', (select to_jsonb(m) - 'active' from metros m join areas a on a.metro = m.code join profiles p on p.area_id = a.id where p.id = auth.uid()),
    'metro_areas', (select coalesce(jsonb_agg(x.name), '[]') from (
        select a.name from areas a where a.metro = (me_area()).metro order by a.weight desc, a.name limit 8) x),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'tone', tone, 'keywords', keywords) order by sort), '[]') from topics where active),
    'verbs', (select coalesce(jsonb_object_agg(label, verb), '{}') from interests),
    'settings', (select jsonb_object_agg(key, value) from app_settings)
  );
$$;

grant execute on function locate_area(double precision, double precision), search_areas(text, int) to authenticated;
