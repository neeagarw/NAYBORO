-- Activity (the bell), Settings (the You tab) and the "Your roots, nearby" card on Explore.
--
--   activity_for_me()      the Activity list: answers, hellos, accepted hellos, "found your answer helpful",
--                          new people from your home region, and events you're interested in that are coming up
--   has_new_activity()     the dot on the bell
--   mark_activity_seen()   "Mark all read"
--   roots_nearby()         "42 people from Rajasthan live around DFW · 6 of them in Plano"
--   set_alert() / set_root_level()   the Settings switches and "Hometown shown as"
--   unblock()              Settings → Blocked people
--   claim_weekly_digest()  the weekly email: new people from home + events coming up (server only)
--
-- Privacy: group counts go through safe_count (never below 5, rule 4); no distances anywhere (rule 2: the card
-- says "in Plano", not "within 10 miles"); a hometown group only counts people who show at least their state
-- (rule 3); blocked and suspended people never appear.

-- ───────── settings ─────────
alter table profiles
  add column if not exists alert_answers    boolean not null default true,   -- answers to my questions
  add column if not exists alert_hellos     boolean not null default true,   -- hi requests and accepted hellos
  add column if not exists alert_new_people boolean not null default true,   -- weekly: new people from home
  add column if not exists alert_events     boolean not null default false,  -- weekly: events coming up near me
  add column if not exists activity_seen_at timestamptz not null default now(),
  add column if not exists digest_sent_at   timestamptz;

create or replace function set_alert(p_kind text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_kind not in ('answers', 'hellos', 'new_people', 'events') then raise exception 'Unknown alert %', p_kind; end if;
  -- Someone who used "turn off email alerts" in an email has every switch off; turning one back on turns on only that one.
  update profiles set
    alert_answers    = case when p_kind = 'answers'    then p_on when not email_alerts then false else alert_answers end,
    alert_hellos     = case when p_kind = 'hellos'     then p_on when not email_alerts then false else alert_hellos end,
    alert_new_people = case when p_kind = 'new_people' then p_on when not email_alerts then false else alert_new_people end,
    alert_events     = case when p_kind = 'events'     then p_on when not email_alerts then false else alert_events end,
    email_alerts     = email_alerts or p_on
  where id = auth.uid();
end $$;

create or replace function set_root_level(p_level root_level) returns void
language sql security definer set search_path = public as $$
  update profiles set root_level = p_level where id = auth.uid();
$$;

-- ───────── "found your answer helpful" goes into Activity (not emailed: sent_at is set) ─────────
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in ('hello', 'accepted', 'answer', 'helpful'));
create index if not exists notifications_recipient_recent on notifications (recipient_id, created_at desc);

create or replace function queue_helpful() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, kind, actor_id, ref_id, sent_at)
  select a.author_id, 'helpful', new.profile_id, a.id, now() from answers a
  where a.id = new.answer_id and a.author_id <> new.profile_id;
  return new;
end $$;
drop trigger if exists notify_helpful on answer_helpful;
create trigger notify_helpful after insert on answer_helpful for each row execute function queue_helpful();

-- ───────── the Activity list ─────────
-- kind: answer | hello | accepted | helpful | new_people | event
-- n: how many (helpful: people who found it helpful; new_people: safe count, null = "a few")
create or replace function activity_for_me(p_before timestamptz default null, p_limit int default 30)
returns table (kind text, actor_id uuid, actor_name text, actor_photo text, detail text, place text,
               n bigint, starts_at timestamptz, link text, at timestamptz, unread boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.activity_seen_at, p.area_id, a.metro from profiles p left join areas a on a.id = p.area_id
    where p.id = auth.uid()
  ),
  my_region as (
    select pl.region, pl.country from profile_roots r join places pl on pl.id = r.place_id
    where r.profile_id = auth.uid() and r.position = 1
  ),
  alerts as (
    select x.kind, x.actor_id, x.ref_id, x.created_at from notifications x, me
    where x.recipient_id = me.id and x.kind in ('answer', 'hello', 'accepted') and x.created_at > now() - interval '60 days'
  ),
  helpful as (
    select x.ref_id, max(x.created_at) as at from notifications x, me
    where x.recipient_id = me.id and x.kind = 'helpful' and x.created_at > now() - interval '60 days'
    group by x.ref_id
  ),
  rows as (
    select al.kind, al.actor_id,
           ap.first_name || coalesce(' ' || upper(left(ap.last_name, 1)) || '.', '') as actor_name, ap.photo_path as actor_photo,
           case al.kind when 'answer' then (select q.body from questions q where q.id = al.ref_id)
                        when 'hello'  then (select h.message from hellos h where h.id = al.ref_id) end as detail,
           null::text as place, null::bigint as n, null::timestamptz as starts_at,
           case al.kind when 'answer' then '/explore'
                        when 'hello'  then '/chats'
                        else coalesce('/chats/' || (select c.id::text from conversations c where c.hello_id = al.ref_id), '/chats') end as link,
           al.created_at as at
    from alerts al join profiles ap on ap.id = al.actor_id
    where ap.suspended_at is null and not is_blocked(auth.uid(), al.actor_id)
      -- a hello that was already answered is no longer news
      and (al.kind <> 'hello' or exists (select 1 from hellos h where h.id = al.ref_id and h.status = 'pending'))
    union all
    select 'helpful', null, null, null,
           (select q.body from answers an join questions q on q.id = an.question_id where an.id = h.ref_id),
           null, (select count(*) from answer_helpful ah where ah.answer_id = h.ref_id), null, '/explore', h.at
    from helpful h where exists (select 1 from answer_helpful ah where ah.answer_id = h.ref_id)
    union all
    -- New people from your home region in your metro this week. Counted only if they show at least their state.
    select 'new_people', null, null, null, r.region, null, safe_count(count(*)), null, '/people?chip=region', max(p.onboarded_at)
    from me, my_region r
    join places pl on pl.region = r.region and pl.country = r.country
    join profile_roots pr on pr.place_id = pl.id and pr.position = 1
    join profiles p on p.id = pr.profile_id
    join areas a on a.id = p.area_id
    where a.metro = me.metro and p.id <> me.id and p.root_level in ('city', 'state')
      and p.onboarded_at > now() - interval '7 days' and p.suspended_at is null and not is_blocked(auth.uid(), p.id)
    group by r.region
    union all
    -- Events you're interested in, from three days before they start.
    select 'event', null, null, null, e.title, coalesce(ea.name, e.place_name), null, e.starts_at, '/explore?tab=events',
           greatest(ei.created_at, e.starts_at - interval '3 days')
    from me join event_interest ei on ei.profile_id = me.id join events e on e.id = ei.event_id
    left join areas ea on ea.id = e.area_id
    where e.starts_at > now() and e.starts_at < now() + interval '3 days'
  )
  select r.kind, r.actor_id, r.actor_name, r.actor_photo, r.detail, r.place, r.n, r.starts_at, r.link, r.at, r.at > me.activity_seen_at
  from rows r, me
  where p_before is null or r.at < p_before
  order by r.at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

-- The bell dot runs on every screen, so it asks the cheap questions directly instead of building the whole list:
-- any alert since you last looked, an event you're interested in starting soon, or someone from your home state
-- who joined your metro since you last looked (only recent joiners are scanned).
create index if not exists profiles_onboarded_recent on profiles (onboarded_at);
create or replace function has_new_activity() returns boolean
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.activity_seen_at as seen, a.metro from profiles p left join areas a on a.id = p.area_id where p.id = auth.uid()
  )
  select exists (
      select 1 from notifications x, me
      where x.recipient_id = me.id and x.created_at > me.seen and x.kind in ('answer', 'hello', 'accepted', 'helpful')
        and (x.kind <> 'hello' or exists (select 1 from hellos h where h.id = x.ref_id and h.status = 'pending'))
        and (x.actor_id is null or not is_blocked(me.id, x.actor_id)))
    or exists (
      select 1 from me join event_interest ei on ei.profile_id = me.id join events e on e.id = ei.event_id
      where e.starts_at > now() and e.starts_at < now() + interval '3 days'
        and greatest(ei.created_at, e.starts_at - interval '3 days') > me.seen)
    or exists (
      select 1 from me, profile_roots r join places mine on mine.id = r.place_id,
        profiles p join areas a on a.id = p.area_id
        join profile_roots pr on pr.profile_id = p.id and pr.position = 1 join places pl on pl.id = pr.place_id
      where r.profile_id = me.id and r.position = 1
        and p.onboarded_at > greatest(me.seen, now() - interval '7 days') and p.id <> me.id
        and a.metro = me.metro and pl.region = mine.region and pl.country = mine.country
        and p.root_level in ('city', 'state') and p.suspended_at is null and not is_blocked(me.id, p.id));
$$;

create or replace function mark_activity_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set activity_seen_at = now() where id = auth.uid();
$$;

-- ───────── "Your roots, nearby" (Explore) ─────────
-- Only when at least 5 people from your home region live in your metro. "in_my_city" is also a safe count.
create or replace function roots_nearby()
returns table (region text, metro_name text, area_name text, total bigint, in_my_city bigint, faces jsonb)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.area_id, a.name as area_name, a.metro, m.name as metro_name
    from profiles p join areas a on a.id = p.area_id join metros m on m.code = a.metro where p.id = auth.uid()
  ),
  mine as (
    select pl.region, pl.country from profile_roots r join places pl on pl.id = r.place_id
    where r.profile_id = auth.uid() and r.position = 1
  ),
  them as (
    select p.id, p.area_id, p.onboarded_at from me, mine
    join places pl on pl.region = mine.region and pl.country = mine.country
    join profile_roots pr on pr.place_id = pl.id and pr.position = 1
    join profiles p on p.id = pr.profile_id
    join areas a on a.id = p.area_id
    where a.metro = me.metro and p.id <> auth.uid() and p.root_level in ('city', 'state')
      and p.onboarded_at is not null and p.suspended_at is null and not is_blocked(auth.uid(), p.id)
  )
  select mine.region, me.metro_name, me.area_name,
         safe_count((select count(*) from them)),
         safe_count((select count(*) from them where them.area_id = me.area_id)),
         (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.display_name, 'photo', f.photo_path)), '[]')
          from (select pp.id, pp.display_name, pp.photo_path from them join public_profiles pp on pp.id = them.id
                order by them.onboarded_at desc limit 3) f)
  from me, mine
  where safe_count((select count(*) from them)) is not null;
$$;

-- ───────── Settings → Blocked people ─────────
create or replace function my_blocks()
returns table (id uuid, display_name text, photo_path text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, p.first_name || coalesce(' ' || upper(left(p.last_name, 1)) || '.', ''), p.photo_path, b.created_at
  from blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
  limit 200;
$$;

create or replace function unblock(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_id;
$$;

-- ───────── emails honour the Settings switches ─────────
create or replace function claim_notifications(p_limit int default 100)
returns table (id bigint, recipient_id uuid, email text, first_name text, kind text,
               actor_name text, detail text, link_path text)
language plpgsql security definer set search_path = public, auth as $$
begin
  return query
  with picked as (
    update notifications n set sent_at = now()
    where n.id in (select x.id from notifications x where x.sent_at is null
                   and x.created_at > now() - interval '2 days' order by x.id limit p_limit for update skip locked)
    returning n.*
  )
  select p.id, p.recipient_id, u.email::text, r.first_name, p.kind,
         a.first_name || coalesce(' ' || upper(left(a.last_name, 1)) || '.', ''),
         case p.kind
           when 'hello'    then (select h.message from hellos h where h.id = p.ref_id)
           when 'accepted' then null
           when 'answer'   then (select q.body from questions q where q.id = p.ref_id) end,
         case p.kind
           when 'hello'    then '/chats'
           when 'accepted' then coalesce('/chats/' || (select c.id::text from conversations c where c.hello_id = p.ref_id), '/chats')
           when 'answer'   then '/explore' end
  from picked p
  join profiles r on r.id = p.recipient_id
  join auth.users u on u.id = p.recipient_id
  left join profiles a on a.id = p.actor_id
  where r.email_alerts and r.suspended_at is null and u.email is not null
    and p.kind in ('hello', 'accepted', 'answer')
    and ((p.kind = 'answer' and r.alert_answers) or (p.kind in ('hello', 'accepted') and r.alert_hellos))
    and (a.id is null or a.suspended_at is null)
    and not is_blocked(p.recipient_id, p.actor_id);
end;
$$;

-- ───────── the weekly email (new people from home + events coming up) ─────────
-- Called once a day by the cron; each person gets it at most once a week, and only when there's something in it.
create or replace function claim_weekly_digest(p_limit int default 200)
returns table (recipient_id uuid, email text, first_name text, region text, metro_name text, new_people bigint,
               has_new_people boolean, events jsonb, timezone text)
language plpgsql security definer set search_path = public, auth as $$
begin
  return query
  with due as (
    update profiles pf set digest_sent_at = now()
    where pf.id in (
      select x.id from profiles x
      where x.email_alerts and (x.alert_new_people or x.alert_events) and x.suspended_at is null
        and x.onboarded_at < now() - interval '1 day'
        and (x.digest_sent_at is null or x.digest_sent_at < now() - interval '6 days 12 hours')
      order by x.digest_sent_at nulls first limit p_limit for update skip locked)
    returning pf.*
  ),
  info as (
    select d.id, d.first_name, d.alert_new_people, d.alert_events, a.metro, m.name as metro_name, m.timezone,
           (select pl.region from profile_roots r join places pl on pl.id = r.place_id where r.profile_id = d.id and r.position = 1) as region,
           (select pl.country from profile_roots r join places pl on pl.id = r.place_id where r.profile_id = d.id and r.position = 1) as country
    from due d join areas a on a.id = d.area_id join metros m on m.code = a.metro
  ),
  counted as (
    select i.*,
      (select count(*) from places pl
        join profile_roots pr on pr.place_id = pl.id and pr.position = 1
        join profiles p on p.id = pr.profile_id join areas a on a.id = p.area_id
        where pl.region = i.region and pl.country = i.country and a.metro = i.metro and p.id <> i.id
          and p.root_level in ('city', 'state') and p.onboarded_at > now() - interval '7 days'
          and p.suspended_at is null and not is_blocked(i.id, p.id)) as joined,
      (select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'place', coalesce(ea.name, e.place_name), 'url', e.url) order by e.starts_at), '[]')
        from (select * from events e2 where e2.starts_at > now() and e2.starts_at < now() + interval '8 days'
                and exists (select 1 from areas a2 where a2.id = e2.area_id and a2.metro = i.metro)
              order by e2.starts_at limit 3) e left join areas ea on ea.id = e.area_id) as evs
    from info i
  )
  select c.id, u.email::text, c.first_name, c.region, c.metro_name,
         case when c.alert_new_people then safe_count(c.joined) end,
         c.alert_new_people and c.joined > 0,
         case when c.alert_events then c.evs else '[]'::jsonb end,
         c.timezone
  from counted c join auth.users u on u.id = c.id
  where u.email is not null
    and ((c.alert_new_people and c.joined > 0) or (c.alert_events and jsonb_array_length(c.evs) > 0));
end;
$$;

-- ───────── permissions ─────────
revoke execute on function claim_weekly_digest(int) from public, anon, authenticated;
revoke execute on function queue_helpful() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function claim_weekly_digest(int) to service_role;
    grant execute on function claim_notifications(int) to service_role;
  end if;
end $$;
revoke execute on function set_alert(text, boolean), set_root_level(root_level), activity_for_me(timestamptz, int),
  has_new_activity(), mark_activity_seen(), roots_nearby(), my_blocks(), unblock(uuid) from public, anon;
grant execute on function set_alert(text, boolean), set_root_level(root_level), activity_for_me(timestamptz, int),
  has_new_activity(), mark_activity_seen(), roots_nearby(), my_blocks(), unblock(uuid) to authenticated;
