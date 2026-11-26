-- Explore search: "Search questions around Dallas". Finds questions you can already see (same rules as before:
-- your area, anonymous authors hidden, blocks, hidden posts) whose question or any visible answer matches.
-- Each word matches as a prefix ("pan" finds "paneer") and by its stem ("groceries" finds "grocery").
create index if not exists questions_search on questions using gin (to_tsvector('english', body || ' ' || coalesce(details, '')));
create index if not exists answers_search on answers using gin (to_tsvector('english', body));

-- "paneer near Richardson!" -> 'paneer:* & near:* & richardson:*' (letters and digits only, so it can never break the query)
create or replace function search_tsquery(p_q text) returns tsquery
language sql immutable as $$
  -- Only stop words ("the", "a") means no search at all, not "match nothing".
  select case when w = '' or numnode(to_tsquery('english', w)) = 0 then null else to_tsquery('english', w) end
  from (select coalesce(string_agg(t || ':*', ' & '), '') as w
        from (select t from regexp_split_to_table(lower(coalesce(p_q, '')), '[^[:alnum:]]+') t where t <> '' limit 8) x) y;
$$;

drop function if exists questions_for_me(text, boolean, timestamptz, int);
drop function if exists questions_for_me(text, boolean, timestamptz, int, text);
create function questions_for_me(p_topic text default null, p_unanswered boolean default false,
                                 p_before timestamptz default null, p_limit int default 20, p_q text default null)
returns table (id uuid, body text, details text, topic text, is_anonymous boolean, author_id uuid, author_name text,
               area_label text, is_mine boolean, answer_count bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with s as (select search_tsquery(p_q) as tq),
  -- Questions whose text, or any visible answer from someone you haven't blocked, has the words (both use the indexes).
  hits as (
    select q2.id from questions q2, s
    where s.tq is not null and to_tsvector('english', q2.body || ' ' || coalesce(q2.details, '')) @@ s.tq
    union
    select x.question_id from answers x join profiles xa on xa.id = x.author_id, s
    where s.tq is not null and to_tsvector('english', x.body) @@ s.tq
      and not x.hidden and xa.suspended_at is null and not is_blocked(auth.uid(), x.author_id)
  ), me as (
    select a.id, a.name, a.metro, a.lat, a.lng, m.near_km
    from profiles p join areas a on a.id = p.area_id join metros m on m.code = a.metro where p.id = auth.uid()
  ), metro_areas as (
    select a.id from areas a join me on a.metro = me.metro
  ), near_areas as (     -- at most a few dozen rows: areas within near_km of mine
    select a.id from areas a join me on a.metro = me.metro
    where 6371 * 2 * asin(sqrt(power(sin(radians(a.lat - me.lat) / 2), 2)
          + cos(radians(me.lat)) * cos(radians(a.lat)) * power(sin(radians(a.lng - me.lng) / 2), 2))) <= me.near_km
  )
  select q.id, q.body, q.details, q.topic, q.is_anonymous,
         case when q.is_anonymous then null else q.author_id end,
         case when q.is_anonymous then 'Anonymous' else au.first_name || coalesce(' ' || upper(left(au.last_name, 1)) || '.', '') end,
         qa.name || case when q.is_anonymous then ' area' else '' end,
         q.author_id = auth.uid(),
         (select count(*) from answers x join profiles xa on xa.id = x.author_id
          where x.question_id = q.id and not x.hidden and xa.suspended_at is null),
         q.created_at
  from questions q
  join profiles au on au.id = q.author_id
  left join areas qa on qa.id = q.area_id
  where not q.hidden and au.suspended_at is null
    and (p_before is null or q.created_at < p_before)
    and (q.author_id = auth.uid()
      or (q.scope = 'near'  and q.area_id in (select id from near_areas))
      or (q.scope = 'metro' and q.area_id in (select id from metro_areas))
      or (q.scope = 'other' and lower(q.target_city) = lower((select name from me))))
    and (p_topic is null or q.topic = p_topic)
    and (not p_unanswered or not exists (select 1 from answers x where x.question_id = q.id and not x.hidden))
    and not is_blocked(auth.uid(), q.author_id)
    and ((select tq from s) is null or q.id in (select id from hits))
  order by q.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function questions_for_me(text, boolean, timestamptz, int, text) from public, anon;
grant execute on function questions_for_me(text, boolean, timestamptz, int, text) to authenticated;
