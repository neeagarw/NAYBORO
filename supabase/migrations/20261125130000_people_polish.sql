-- People: don't suggest someone you've already said hi to (pending). More food words for topic matching.
-- (people_for_me is the same as in 20261121000000_config_and_scale.sql plus the pending-hello line.)

create or replace function people_for_me(p_filter text default null, p_limit int default 40, p_offset int default 0)
returns table (
  id uuid, display_name text, photo_path text, intro text, area_name text, shown_root text,
  is_new boolean, roots_match text, shared_interests text[], interests text[], score int
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, a.id as area_id, a.metro from profiles p join areas a on a.id = p.area_id where p.id = auth.uid()
  ), my_places as (
    select pl.id, pl.region, pl.country from profile_roots r join places pl on pl.id = r.place_id where r.profile_id = auth.uid()
  ), my_ints as (
    select interest_id from profile_interests where profile_id = auth.uid()
  ), int_match as (
    select x.profile_id, count(*)::int as n from profile_interests x join my_ints using (interest_id) group by x.profile_id
  ), cand as (
    select p.id, p.created_at, p.root_level, p.area_id, pl.id as place_id, pl.city, pl.region, pl.country,
           coalesce(im.n, 0) as n_ints,
           case when p.root_level = 'city' and pl.id in (select id from my_places) then 'city:' || pl.city
                when p.root_level in ('city','state') and exists (select 1 from my_places m where m.region = pl.region and m.country = pl.country)
                     then 'region:' || pl.region end as roots_match
    from me
    join areas a on a.metro = me.metro
    join profiles p on p.area_id = a.id
    left join profile_roots r on r.profile_id = p.id and r.position = 1
    left join places pl on pl.id = r.place_id
    left join int_match im on im.profile_id = p.id
    where p.id <> me.id and p.onboarded_at is not null and p.suspended_at is null
      and not exists (select 1 from blocks b where (b.blocker_id = me.id and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = me.id))
      and not exists (select 1 from hidden_suggestions h where h.profile_id = me.id and h.hidden_id = p.id)
      and not exists (select 1 from conversation_members x join conversation_members y on y.conversation_id = x.conversation_id
                      where x.profile_id = me.id and y.profile_id = p.id)
      -- Already said hi and waiting for a reply: they're in Chats → "Waiting for a reply", not suggested again.
      and not exists (select 1 from hellos h where h.from_id = me.id and h.to_id = p.id and h.status = 'pending')
  ), ranked as (
    select c.*, (case when c.roots_match like 'city:%' then 3 when c.roots_match is not null then 2 else 0 end
                 + c.n_ints + case when c.area_id = (select area_id from me) then 1 else 0 end)::int as score,
           c.created_at > now() - make_interval(days => setting_int('new_member_days')) as is_new
    from cand c
    where p_filter is null
       or (p_filter = 'new'    and c.created_at > now() - make_interval(days => setting_int('new_member_days')))
       or (p_filter = 'city'   and c.roots_match like 'city:%')
       or (p_filter = 'region' and c.roots_match is not null)
       or (p_filter not in ('new','city','region') and exists (
            select 1 from profile_interests x join interests i on i.id = x.interest_id where x.profile_id = c.id and i.label = p_filter))
    order by score desc, c.created_at desc, c.id
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
  )
  -- Names and interest lists only for the page being returned.
  select r.id,
         pr.first_name || coalesce(' ' || upper(left(pr.last_name, 1)) || '.', ''),
         pr.photo_path, pr.intro, ar.name,
         case r.root_level when 'city' then r.city when 'state' then r.region else r.country end,
         r.is_new, r.roots_match,
         array(select i.label from profile_interests x join interests i on i.id = x.interest_id
               where x.profile_id = r.id and x.interest_id in (select interest_id from my_ints) order by i.sort),
         array(select i.label from profile_interests x join interests i on i.id = x.interest_id where x.profile_id = r.id order by i.sort),
         r.score
  from ranked r join profiles pr on pr.id = r.id join areas ar on ar.id = r.area_id
  order by r.score desc, r.created_at desc, r.id;
$$;


update topics set keywords = (select array_agg(distinct k) from unnest(keywords || '{mishti,doi,sweets,sweet shop,mithai,chaat,pani puri,golgappa,jalebi,rasgulla,rasmalai,sandesh,thali,paratha,chole,bhature,vada pav,pav bhaji,momos,kebab,kabab,tandoori,curry,naan,roti,chai,tea,coffee,bakery,cake,catering,tiffin,home food,dabba,street food,fish,mutton,halal}'::text[]) k)
where name = 'Food';
