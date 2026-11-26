-- Current-city search also understands how people write addresses:
--   "Plano, TX" / "Plano TX" / "Plano, Texas"   the state narrows the list (dropped if nothing fits)
--   "75024-1234"                                 a ZIP+4 finds its 5-digit ZIP
-- Same rules as searchAreas() in src/lib/places.ts (the no-database setup).
create or replace function search_areas(p_q text, p_limit int default 8)
returns table (id bigint, name text, state text, metro text, metro_name text, timezone text, zip text)
language plpgsql stable security definer set search_path = public as $$
declare
  t text := btrim(replace(replace(coalesce(p_q, ''), '%', ''), '_', ''));
  n int := least(greatest(coalesce(p_limit, 8), 1), 20);
  head text := t;
  st text;
  m text[];
begin
  if t ~ '^[0-9]{5}-[0-9]{0,4}$' then t := left(t, 5); end if;
  if t ~ '^[0-9]{3,5}$' then
    return query
      select a.id, a.name, a.state, a.metro, mt.name, mt.timezone, z.zip
      from zip_codes z join areas a on a.id = z.area_id join metros mt on mt.code = a.metro
      where z.zip like t || '%'
      order by z.zip
      limit n;
    return;
  end if;
  if t ~ '^[0-9]' or length(t) < 2 then return; end if;

  if position(',' in t) > 0 then
    head := btrim(split_part(t, ',', 1));
    st := lower(btrim(substr(t, position(',' in t) + 1)));
  else
    m := regexp_match(t, '^(.+?)\s+([A-Za-z]{2})$');
    if m is not null then head := m[1]; st := lower(m[2]); end if;
  end if;

  if st is not null and st <> '' and length(head) >= 2 then
    return query
      select a.id, a.name, a.state, a.metro, mt.name, mt.timezone, null::text
      from areas a join metros mt on mt.code = a.metro
      where lower(a.name) like lower(head) || '%'
        and (lower(a.state) = st or (length(st) > 2 and lower(mt.name) like '%' || st || '%'))
      order by a.weight desc, a.name, a.state
      limit n;
    if found then return; end if;
  end if;

  return query
    select a.id, a.name, a.state, a.metro, mt.name, mt.timezone, null::text
    from areas a join metros mt on mt.code = a.metro
    where lower(a.name) like lower(case when position(',' in t) > 0 then head else t end) || '%'
    order by a.weight desc, a.name, a.state
    limit n;
  if found or st is null or position(',' in t) > 0 then return; end if;
  -- "Plano TX" with no city starting "Plano TX": the city part alone.
  return query
    select a.id, a.name, a.state, a.metro, mt.name, mt.timezone, null::text
    from areas a join metros mt on mt.code = a.metro
    where lower(a.name) like lower(head) || '%'
    order by a.weight desc, a.name, a.state
    limit n;
end $$;
grant execute on function search_areas(text, int) to anon, authenticated;
