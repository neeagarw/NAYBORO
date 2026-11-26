
-- Hometown search (copied into the generated migration by scripts/build_localities.py).
--   "Kolkata", "Calcutta"         a place by name or older name (as before)
--   "Salt Lake", "Andheri"        a neighbourhood: shows "Salt Lake" and the city it's in
--   "700091", "75024"             an Indian PIN or a US ZIP (prefix from 3 digits)
--   "Plano, TX", "Mumbai India"   the part after a comma (or a last word) narrows by state/country
-- Each row is a place (the city is all that's ever saved); "via" is the neighbourhood or code that matched.
-- Same rules as searchPlaces() in src/lib/places.ts (the no-database setup).
create or replace function search_places_core(p_head text, p_tail text, p_limit int)
returns table (id bigint, city text, region text, country text, via text)
language sql stable security definer set search_path = public as $$
  with q as (
    select lower(p_head) as s,
           btrim(regexp_replace(regexp_replace(lower(p_head), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')) as f,
           nullif(lower(btrim(coalesce(p_tail, ''))), '') as t
  ),
  by_place as (
    select p.id, null::text as via, 0 as kind,
           (lower(p.city) = q.s or p.search_name = q.s
            or (p.aliases is not null and exists (select 1 from unnest(p.aliases) a where lower(a) = q.s))) as exact
    from places p, q
    where length(q.s) >= 1 and (p.search_name like q.s || '%' or lower(p.city) like q.s || '%'
      or (p.aliases is not null and exists (select 1 from unnest(p.aliases) a where lower(a) like q.s || '%')))
  ),
  by_area as (
    select l.place_id as id, l.name as via, 1 as kind, l.search_name = q.f as exact
    from localities l join places p on p.id = l.place_id, q
    where length(q.f) >= 2 and l.search_name like q.f || '%' and l.search_name <> p.search_name
  ),
  hits as (
    select distinct on (h.id) h.id, h.via, h.kind, h.exact
    from (select * from by_place union all select * from by_area) h
    order by h.id, h.exact desc, h.kind, length(h.via)
  )
  select p.id, p.city, p.region, p.country, h.via
  from hits h join places p on p.id = h.id, q
  where q.t is null or lower(p.region) like q.t || '%' or lower(p.country) like q.t || '%'
     or (p.country = 'United States' and length(q.t) = 2
         and exists (select 1 from areas a where lower(a.state) = q.t and lower(a.name) = lower(p.city)))
  order by h.exact desc, h.kind, p.population desc, p.city
  limit p_limit;
$$;
revoke execute on function search_places_core(text, text, int) from public, anon, authenticated;

drop function if exists search_places(text, int);
create function search_places(p_q text, p_limit int default 6)
returns table (id bigint, city text, region text, country text, via text)
language plpgsql stable security definer set search_path = public as $$
declare
  t text := btrim(replace(replace(coalesce(p_q, ''), '%', ''), '_', ''));
  n int := least(greatest(coalesce(p_limit, 6), 1), 20);
  v_code text;
  words text[];
  k int;
begin
  if t = '' then return; end if;
  -- A postal code: digits (spaces or a dash allowed, "700 091", "75024-1234" -> first 5 for a US ZIP+4).
  if t ~ '^[0-9][0-9 -]*$' then
    v_code := regexp_replace(t, '[^0-9]', '', 'g');
    if t ~ '^[0-9]{5}-[0-9]{1,4}$' then v_code := left(v_code, 5); end if;
    if length(v_code) < 3 then return; end if;
    return query
      select p.id, p.city, p.region, p.country, l.code
      from localities l join places p on p.id = l.place_id
      where l.is_main and l.code like v_code || '%'
      order by l.code = v_code desc, length(l.code), l.code
      limit n;
    return;
  end if;
  -- "City, State" / "City, Country": search the first part, narrow by the rest (or drop the rest if nothing fits).
  if position(',' in t) > 0 then
    return query select * from search_places_core(btrim(split_part(t, ',', 1)), btrim(substr(t, position(',' in t) + 1)), n);
    if found then return; end if;
    return query select * from search_places_core(btrim(split_part(t, ',', 1)), null, n);
    return;
  end if;
  return query select * from search_places_core(t, null, n);
  if found then return; end if;
  -- "Mumbai India", "Plano TX": try the last word(s) as the state or country.
  words := regexp_split_to_array(t, '\s+');
  for k in reverse coalesce(array_length(words, 1), 0) - 1 .. greatest(1, coalesce(array_length(words, 1), 0) - 3) loop
    return query select * from search_places_core(array_to_string(words[1:k], ' '), array_to_string(words[k + 1:], ' '), n);
    if found then return; end if;
  end loop;
end $$;
grant execute on function search_places(text, int) to anon, authenticated;
