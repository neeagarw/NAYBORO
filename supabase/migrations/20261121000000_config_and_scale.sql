-- Config in tables (no place, time zone, topic or limit hard-coded in the app) and queries built to scale.
-- Load test (supabase/tests/load_test.sql, 20,000 people in one metro) drove every change here.

-- ═════════════════════════ 1. CONFIGURATION TABLES ═════════════════════════

-- Metros: launching a new city = insert a metro + its areas. Nothing in the app names a city.
create table metros (
  code      text primary key,                       -- 'DFW'
  name      text not null,                          -- 'Dallas–Fort Worth'
  timezone  text not null,                          -- IANA, e.g. 'America/Chicago'
  near_km   numeric not null default 25,            -- "Around <my city>" radius for questions
  match_km  numeric not null default 40,            -- phone location → nearest area cut-off
  active    boolean not null default true
);
alter table metros enable row level security;
create policy "read metros" on metros for select to authenticated using (true);
alter table areas add constraint areas_metro_fk foreign key (metro) references metros (code);
create index on areas (metro);

-- Interests: verb drives copy ("Plays tennis" vs "Into book club"); group order lives here too.
alter table interests add column verb text not null default 'into' check (verb in ('play', 'into'));
alter table interests add column group_sort int not null default 0;

-- Question topics: name, colour token and the keywords used to suggest a topic.
create table topics (
  name      text primary key,
  sort      int not null default 0,
  tone      text not null default 'grey' check (tone in ('green','blue','pink','purple','orange','yellow','grey')),
  keywords  text[] not null default '{}',
  active    boolean not null default true
);
alter table topics enable row level security;
create policy "read topics" on topics for select to authenticated using (true);
insert into topics (name, sort, tone, keywords) values
  ('Groceries',   1, 'green',  '{grocery,groceries,methi,curry leaves,vegetable,atta,store}'),
  ('Schools',     2, 'blue',   '{school,esl,teacher,daycare,tuition}'),
  ('Food',        3, 'pink',   '{tiffin,restaurant,food,dal,thali,sweets,catering,jalebi,chai}'),
  ('Sports',      4, 'green',  '{cricket,tennis,badminton,pickleball,run,gym,yoga}'),
  ('Immigration', 5, 'purple', '{visa,h1b,h-1b,green card,oci,passport,consulate}'),
  ('Housing',     6, 'yellow', '{rent,apartment,roommate,lease,house,hoa}'),
  ('Travel',      7, 'orange', '{flight,flying,travel,companion,airport}'),
  ('Life here',   8, 'grey',   '{friends,lonely,homesick,winter,meet people}'),
  ('General',    99, 'grey',   '{}');

-- Spam limits: change a number here, no deploy needed.
create table rate_limits (
  table_name    text primary key,
  actor_column  text not null,
  max_count     int not null,
  per_window    interval not null,
  message       text not null
);
alter table rate_limits enable row level security;   -- server-side only
insert into rate_limits values
  ('hellos',           'from_id',     20, '1 day',      'You have said hi to a lot of people today. Try again tomorrow.'),
  ('questions',        'author_id',    5, '1 day',      'You have asked 5 questions today. Try again tomorrow.'),
  ('answers',          'author_id',   30, '1 day',      'You have posted a lot of answers today. Try again tomorrow.'),
  ('messages',         'sender_id',   60, '10 minutes', 'You are sending messages very fast. Wait a few minutes.'),
  ('reports',          'reporter_id', 20, '1 day',      'You have sent a lot of reports today. Our team is on it.'),
  ('contact_messages', 'profile_id',   5, '1 day',      'You have sent 5 messages today. We will reply soon.');

-- Product rules that are numbers.
create table app_settings (key text primary key, value jsonb not null, note text);
alter table app_settings enable row level security;
create policy "read settings" on app_settings for select to authenticated using (true);
insert into app_settings values
  ('min_group_size',     '5',  'Counts below this are never shown (rule 4)'),
  ('new_member_days',    '14', 'How long someone shows a "New" badge'),
  ('hello_retry_days',   '30', 'After "Not now", the sender can say hi again after this many days'),
  ('min_interests',      '3',  'Interests needed to finish setup'),
  ('max_hometowns',      '3',  'Hometowns a person can add');

create or replace function setting_int(k text) returns int
language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::int from app_settings where key = k;
$$;

-- ═════════════════════════ 2. TOPIC: ENUM → CONFIG TABLE ═════════════════════════
drop function if exists unanswered_count();
drop function if exists questions_for_me(text, boolean);
drop view if exists question_feed;
alter table questions alter column topic drop default;
alter table questions alter column topic type text using topic::text;
alter table questions alter column topic set default 'General';
alter table questions add constraint questions_topic_fk foreign key (topic) references topics (name);
drop type question_topic;

-- ═════════════════════════ 3. INDEXES ═════════════════════════
create index on profiles (area_id) where onboarded_at is not null and suspended_at is null;
create index on profile_roots (place_id, profile_id);
create index on profile_interests (interest_id, profile_id);
create index on blocks (blocked_id);
create index on hidden_suggestions (profile_id);
create index on conversation_members (profile_id);
create index on hellos (to_id, status);
create index on hellos (from_id, created_at);
create index on messages (conversation_id, created_at desc);
create index on messages (sender_id, created_at);
create index on questions (created_at desc) where not hidden;
create index on questions (author_id, created_at);
create index on questions (lower(target_city)) where scope = 'other';
create index on answers (question_id) where not hidden;
create index on answers (author_id, created_at);
create index on answer_helpful (answer_id);
create index on event_interest (profile_id);
create index on events (starts_at);
create index on reports (target_type, target_id) where status = 'open';
create index on reports (reporter_id, created_at);
create index on contact_messages (profile_id, created_at);
create index on notifications (recipient_id);

-- ═════════════════════════ 4. SPAM GUARD READS rate_limits ═════════════════════════
create or replace function guard_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rl rate_limits;
  actor uuid;
  n bigint;
begin
  select * into rl from rate_limits where table_name = tg_table_name;
  if not found then return new; end if;
  actor := (to_jsonb(new) ->> rl.actor_column)::uuid;
  if exists (select 1 from profiles where id = actor and suspended_at is not null) then
    raise exception 'Your account is paused. Contact us if you think this is a mistake.';
  end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2',
                 tg_table_schema, tg_table_name, rl.actor_column)
    into n using actor, rl.per_window;
  if n >= rl.max_count then raise exception '%', rl.message; end if;
  return new;
end;
$$;
drop trigger if exists guard_hellos on hellos;
drop trigger if exists guard_questions on questions;
drop trigger if exists guard_answers on answers;
drop trigger if exists guard_messages on messages;
drop trigger if exists guard_reports on reports;
drop trigger if exists guard_contact on contact_messages;
create trigger guard_write before insert on hellos           for each row execute function guard_write();
create trigger guard_write before insert on questions        for each row execute function guard_write();
create trigger guard_write before insert on answers          for each row execute function guard_write();
create trigger guard_write before insert on messages         for each row execute function guard_write();
create trigger guard_write before insert on reports          for each row execute function guard_write();
create trigger guard_write before insert on contact_messages for each row execute function guard_write();

-- ═════════════════════════ 5. VIEWS & HELPERS USE SETTINGS ═════════════════════════
create or replace function safe_count(n bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select case when n >= setting_int('min_group_size') then n else null end;
$$;

create or replace view public_profiles with (security_barrier) as
select
  p.id,
  p.first_name || coalesce(' ' || upper(left(p.last_name, 1)) || '.', '') as display_name,
  p.photo_path, p.intro, p.languages, p.phone_verified,
  p.created_at > now() - make_interval(days => setting_int('new_member_days')) as is_new,
  a.name as area_name, a.metro as metro,
  case p.root_level when 'city' then pl.city when 'state' then pl.region else pl.country end as shown_root,
  p.root_level,
  case when p.root_level in ('city','state') then pl.region end as shown_region
from profiles p
left join areas a on a.id = p.area_id
left join profile_roots r on r.profile_id = p.id and r.position = 1
left join places pl on pl.id = r.place_id
where p.onboarded_at is not null
  and (p.suspended_at is null or p.id = auth.uid())
  and auth.uid() is not null
  and not is_blocked(auth.uid(), p.id);

-- Everything the app needs to render without hard-coded lists, in one call.
create or replace function app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'metro', (select to_jsonb(m) - 'active' from metros m join areas a on a.metro = m.code join profiles p on p.area_id = a.id where p.id = auth.uid()),
    'metro_areas', (select coalesce(jsonb_agg(a.name order by a.name), '[]') from areas a where a.metro = (me_area()).metro),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'tone', tone, 'keywords', keywords) order by sort), '[]') from topics where active),
    'verbs', (select coalesce(jsonb_object_agg(label, verb), '{}') from interests),
    'settings', (select jsonb_object_agg(key, value) from app_settings)
  );
$$;

-- ═════════════════════════ 6. PEOPLE: SET-BASED, PAGED ═════════════════════════
drop function if exists people_for_me();
-- p_filter: null = everyone, 'new', 'city', 'region', or an interest label.
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

create or replace function my_root_counts()
returns table (city text, city_count bigint, region text, region_count bigint)
language sql stable security definer set search_path = public as $$
  with me as (select a.metro from profiles p join areas a on a.id = p.area_id where p.id = auth.uid()),
  mine as (select pl.* from profile_roots r join places pl on pl.id = r.place_id where r.profile_id = auth.uid() and r.position = 1),
  others as (
    select p.root_level, pl.id as place_id, pl.region, pl.country
    from me join areas a on a.metro = me.metro join profiles p on p.area_id = a.id
    join profile_roots r on r.profile_id = p.id and r.position = 1 join places pl on pl.id = r.place_id
    where p.id <> auth.uid() and p.onboarded_at is not null and p.suspended_at is null
      and pl.region = (select region from mine) and pl.country = (select country from mine)
      and not is_blocked(auth.uid(), p.id)
  )
  select mine.city,
         safe_count((select count(*) from others o where o.root_level = 'city' and o.place_id = mine.id)),
         mine.region,
         safe_count((select count(*) from others o where o.root_level in ('city','state')))
  from mine;
$$;

-- ═════════════════════════ 7. EXPLORE: PAGED, NO PER-ROW DISTANCE MATH ═════════════════════════
create or replace function questions_for_me(p_topic text default null, p_unanswered boolean default false,
                                            p_before timestamptz default null, p_limit int default 20)
returns table (id uuid, body text, details text, topic text, is_anonymous boolean, author_id uuid, author_name text,
               area_label text, is_mine boolean, answer_count bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (
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
  order by q.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function unanswered_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from questions_for_me(null, true, null, 50);
$$;

create or replace function answers_for(qids uuid[])
returns table (id uuid, question_id uuid, author_id uuid, display_name text, photo_path text, area_name text,
               roots_tag text, body text, helpful_count bigint, i_found_helpful boolean, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with a as (
    select x.* from answers x join profiles p on p.id = x.author_id
    where x.question_id = any(qids[1:50]) and not x.hidden and p.suspended_at is null
      and not is_blocked(auth.uid(), x.author_id)
  ), h as (
    select answer_id, count(*) as n, bool_or(profile_id = auth.uid()) as mine from answer_helpful
    where answer_id in (select id from a) group by answer_id
  )
  select a.id, a.question_id, a.author_id,
         p.first_name || coalesce(' ' || upper(left(p.last_name, 1)) || '.', ''), p.photo_path, ar.name,
         case when a.author_id = auth.uid() then null
              else 'From ' || split_part(shared_roots(auth.uid(), a.author_id), ':', 2) end,
         a.body, coalesce(h.n, 0), coalesce(h.mine, false), a.author_id = auth.uid(), a.created_at
  from a join profiles p on p.id = a.author_id left join areas ar on ar.id = p.area_id left join h on h.answer_id = a.id
  order by coalesce(h.n, 0) desc, a.created_at;
$$;

-- ═════════════════════════ 8. CHATS: DIRECT, PAGED, CHEAP BADGE ═════════════════════════
drop function if exists my_chats();
create or replace function my_chats(p_limit int default 50, p_offset int default 0)
returns table (conversation_id uuid, other_id uuid, display_name text, photo_path text,
               last_body text, last_from_me boolean, last_at timestamptz, unread boolean, muted boolean)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, o.profile_id,
         op.first_name || coalesce(' ' || upper(left(op.last_name, 1)) || '.', ''), op.photo_path,
         lm.body, lm.sender_id = auth.uid(), coalesce(lm.created_at, c.created_at),
         coalesce(lm.sender_id <> auth.uid() and lm.created_at > m.last_read_at, false), m.muted
  from conversation_members m
  join conversations c on c.id = m.conversation_id
  join conversation_members o on o.conversation_id = m.conversation_id and o.profile_id <> m.profile_id
  join profiles op on op.id = o.profile_id and op.suspended_at is null
  left join lateral (select x.body, x.sender_id, x.created_at from messages x
                     where x.conversation_id = m.conversation_id order by x.created_at desc limit 1) lm on true
  where m.profile_id = auth.uid() and not is_blocked(auth.uid(), o.profile_id)
  order by coalesce(lm.created_at, c.created_at) desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function chats_badge() returns int
language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from hellos h join profiles f on f.id = h.from_id
     where h.to_id = auth.uid() and h.status = 'pending' and f.suspended_at is null and not is_blocked(auth.uid(), h.from_id))
  + (select count(*) from conversation_members m
     where m.profile_id = auth.uid() and not m.muted
       and exists (select 1 from messages x where x.conversation_id = m.conversation_id
                   and x.sender_id <> auth.uid() and x.created_at > m.last_read_at))
  )::int;
$$;

create or replace function inbox_hellos()
returns table (id uuid, from_id uuid, display_name text, photo_path text, shown_root text, message text, common text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.from_id, pp.display_name, pp.photo_path, pp.shown_root, h.message,
         coalesce(
           case when shared_roots(auth.uid(), h.from_id) like 'city:%' then 'Also from ' || split_part(shared_roots(auth.uid(), h.from_id), ':', 2)
                when shared_roots(auth.uid(), h.from_id) like 'region:%' then 'Both from ' || split_part(shared_roots(auth.uid(), h.from_id), ':', 2) end,
           (select case i.verb when 'play' then 'Plays ' else 'Into ' end || lower(i.label)
            from profile_interests x join profile_interests y on y.interest_id = x.interest_id and y.profile_id = h.from_id
            join interests i on i.id = x.interest_id where x.profile_id = auth.uid() order by i.sort limit 1),
           'Lives in ' || pp.area_name),
         h.created_at
  from hellos h join public_profiles pp on pp.id = h.from_id
  where h.to_id = auth.uid() and h.status = 'pending'
  order by h.created_at desc
  limit 100;
$$;

-- ═════════════════════════ 9. SAY HI (with "Not now" expiry) ═════════════════════════
-- Returns 'sent'. A "Not now" lets the sender try again after hello_retry_days.
create or replace function say_hi(p_to uuid, p_message text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  prev hellos;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_to = me then raise exception 'You can''t say hi to yourself.'; end if;
  if is_blocked(me, p_to) or not exists (select 1 from public_profiles where id = p_to) then raise exception 'not found'; end if;
  select * into prev from hellos where from_id = me and to_id = p_to;
  if found then
    if prev.status = 'not_now' and prev.responded_at < now() - make_interval(days => setting_int('hello_retry_days')) then
      perform guard_check('hellos', me);
      update hellos set status = 'pending', message = btrim(p_message), created_at = now(), responded_at = null where id = prev.id;
      return 'sent';
    end if;
    raise exception 'You already said hi to this person.';
  end if;
  insert into hellos (from_id, to_id, message) values (me, p_to, btrim(p_message));
  return 'sent';
end;
$$;

-- The same limit check guard_write does, for updates that act like a new row.
create or replace function guard_check(p_table text, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare rl rate_limits; n bigint;
begin
  select * into rl from rate_limits where table_name = p_table;
  if not found then return; end if;
  execute format('select count(*) from %I where %I = $1 and created_at > now() - $2', p_table, rl.actor_column)
    into n using p_actor, rl.per_window;
  if n >= rl.max_count then raise exception '%', rl.message; end if;
end;
$$;

-- Re-sent hellos alert the receiver again.
create or replace function queue_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'hellos' then
    if tg_op = 'INSERT' then
      insert into notifications (recipient_id, kind, actor_id, ref_id) values (new.to_id, 'hello', new.from_id, new.id);
    elsif new.status = 'accepted' and old.status <> 'accepted' then
      insert into notifications (recipient_id, kind, actor_id, ref_id) values (new.from_id, 'accepted', new.to_id, new.id);
    elsif new.status = 'pending' and old.status <> 'pending' then
      insert into notifications (recipient_id, kind, actor_id, ref_id) values (new.to_id, 'hello', new.from_id, new.id);
    end if;
  elsif tg_table_name = 'answers' then
    insert into notifications (recipient_id, kind, actor_id, ref_id)
    select q.author_id, 'answer', new.author_id, q.id from questions q
    where q.id = new.question_id and q.author_id <> new.author_id;
  end if;
  return new;
end;
$$;

-- Profile page: hello state respects the retry window; shared event dates use the metro's time zone.
create or replace function profile_card(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pp public_profiles;
  st text := 'none';
  conv uuid;
  hello_id uuid;
  ev jsonb;
  tz text := coalesce((select m.timezone from metros m where m.code = (me_area()).metro), 'UTC');
begin
  select * into pp from public_profiles where id = p;
  if not found or p = auth.uid() then return null; end if;

  select a.conversation_id into conv from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
  where a.profile_id = auth.uid() and b.profile_id = p limit 1;
  if conv is not null then st := 'connected';
  elsif exists (select 1 from hellos where from_id = auth.uid() and to_id = p
                and (status = 'pending' or (status = 'not_now' and responded_at >= now() - make_interval(days => setting_int('hello_retry_days'))))) then st := 'sent';
  else
    select h.id into hello_id from hellos h where h.from_id = p and h.to_id = auth.uid() and h.status = 'pending';
    if hello_id is not null then st := 'received'; end if;
  end if;

  select jsonb_build_object('title', e.title, 'mon', upper(to_char(e.starts_at at time zone tz, 'Mon')),
                            'day', extract(day from e.starts_at at time zone tz)::int)
    into ev
  from events e
  where e.starts_at > now()
    and exists (select 1 from event_interest i where i.event_id = e.id and i.profile_id = auth.uid())
    and exists (select 1 from event_interest i where i.event_id = e.id and i.profile_id = p)
  order by e.starts_at limit 1;

  return jsonb_build_object(
    'id', pp.id, 'display_name', pp.display_name, 'first_name', split_part(pp.display_name, ' ', 1),
    'photo_path', pp.photo_path, 'intro', pp.intro, 'area_name', pp.area_name, 'shown_root', pp.shown_root,
    'phone_verified', pp.phone_verified, 'is_new', pp.is_new,
    'roots_match', shared_roots(auth.uid(), p),
    'interests', to_jsonb(interest_labels(p)),
    'shared_interests', to_jsonb(shared_interest_labels(auth.uid(), p)),
    'languages', to_jsonb(pp.languages),
    'my_languages', to_jsonb((select languages from profiles where id = auth.uid())),
    'shared_event', ev,
    'hello_state', st, 'hello_id', hello_id, 'conversation_id', conv);
end;
$$;

-- Events: only my metro, paged.
drop function if exists events_for_me();
create or replace function events_for_me(p_limit int default 50)
returns setof event_feed
language sql stable security definer set search_path = public as $$
  select e.* from event_feed e left join areas a on a.id = e.area_id
  where e.starts_at > now() - interval '3 hours'
    and (a.metro is null or a.metro = (me_area()).metro)
  order by e.starts_at
  limit least(greatest(p_limit, 1), 100);
$$;

-- Setup rules read app_settings (min interests, max hometowns) instead of fixed numbers.
create or replace function save_profile(
  p_first text, p_last text, p_intro text, p_photo text, p_area bigint, p_level root_level,
  p_roots bigint[], p_interests bigint[], p_adult boolean
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not coalesce(p_adult, false) then raise exception 'must be 18 or older'; end if;
  if coalesce(array_length(p_roots, 1), 0) not between 1 and setting_int('max_hometowns') then
    raise exception 'pick 1 to % hometowns', setting_int('max_hometowns'); end if;
  if coalesce(array_length(p_interests, 1), 0) < setting_int('min_interests') then
    raise exception 'pick at least % interests', setting_int('min_interests'); end if;
  if p_area is null then raise exception 'pick your city'; end if;
  if p_photo is not null and split_part(p_photo, '/', 1) <> me::text then raise exception 'bad photo path'; end if;

  insert into profiles (id, first_name, last_name, intro, photo_path, area_id, root_level, is_adult, onboarded_at)
  values (me, btrim(p_first), nullif(btrim(p_last), ''), nullif(btrim(p_intro), ''), p_photo, p_area, p_level, true, now())
  on conflict (id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name, intro = excluded.intro,
    photo_path = coalesce(excluded.photo_path, profiles.photo_path), area_id = excluded.area_id,
    root_level = excluded.root_level, is_adult = true, onboarded_at = coalesce(profiles.onboarded_at, now());

  delete from profile_roots where profile_id = me;
  insert into profile_roots (profile_id, place_id, position)
  select me, r.place_id, r.pos from unnest(p_roots) with ordinality as r(place_id, pos);

  delete from profile_interests where profile_id = me;
  insert into profile_interests (profile_id, interest_id)
  select distinct me, i from unnest(p_interests) as i;
end;
$$;

-- ═════════════════════════ 10. PERMISSIONS ═════════════════════════
revoke execute on function guard_check(text, uuid) from public, anon, authenticated;
revoke execute on function claim_notifications(int) from public, anon, authenticated;
revoke execute on function set_email_alerts(uuid, boolean) from public, anon, authenticated;
