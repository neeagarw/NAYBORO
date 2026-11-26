-- Hometown search: an exact older name ("Calcutta", "Bombay") counts as an exact match too, so the big
-- city wins over a small town that happens to have that name (Calcutta, South Africa). Otherwise unchanged.
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
  order by (lower(p.city) = q.s or p.search_name = q.s
            or (p.aliases is not null and exists (select 1 from unnest(p.aliases) a where lower(a) = q.s))) desc,
           p.population desc, p.city
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function search_places(text, int) to anon, authenticated;
