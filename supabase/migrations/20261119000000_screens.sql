-- Read and write functions for People, Profile, Chats and Explore.
-- All run as the function owner (security definer) and apply the product rules themselves:
--   * hometown only at the level its owner chose (rule 3)
--   * counts under 5 hidden (rule 4)
--   * roots tag on answers only when the reader shares those roots (rule 5)
--   * blocked people never appear, in either direction (rule 9)

-- ───────── helpers ─────────
create or replace function me_area() returns areas
language sql stable security definer set search_path = public as $$
  select a.* from profiles p join areas a on a.id = p.area_id where p.id = auth.uid();
$$;

create or replace function area_km(a bigint, b bigint) returns double precision
language sql stable security definer set search_path = public as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(y.lat - x.lat) / 2), 2) +
    cos(radians(x.lat)) * cos(radians(y.lat)) * power(sin(radians(y.lng - x.lng) / 2), 2)))
  from areas x, areas y where x.id = a and y.id = b;
$$;

-- What a viewer may learn about a person's roots compared with their own.
-- Returns 'city:<name>', 'region:<name>' or null. Never finer than the person chose.
create or replace function shared_roots(viewer uuid, person uuid) returns text
language sql stable security definer set search_path = public as $$
  with theirs as (
    select pl.*, p.root_level from profiles p
    join profile_roots r on r.profile_id = p.id and r.position = 1
    join places pl on pl.id = r.place_id where p.id = person
  ), mine as (
    select pl.* from profile_roots r join places pl on pl.id = r.place_id where r.profile_id = viewer
  )
  select case
    when t.root_level = 'city' and exists (select 1 from mine m where m.id = t.id) then 'city:' || t.city
    when t.root_level in ('city','state') and exists (select 1 from mine m where m.region = t.region and m.country = t.country) then 'region:' || t.region
  end
  from theirs t;
$$;

create or replace function shared_interest_labels(a uuid, b uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(i.label order by i.sort), '{}')
  from profile_interests x join profile_interests y on y.interest_id = x.interest_id and y.profile_id = b
  join interests i on i.id = x.interest_id where x.profile_id = a;
$$;

create or replace function interest_labels(p uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(i.label order by i.sort), '{}')
  from profile_interests x join interests i on i.id = x.interest_id where x.profile_id = p;
$$;

-- ───────── People ─────────
-- Everyone in my metro I could meet, best matches first.
create or replace function people_for_me()
returns table (
  id uuid, display_name text, photo_path text, intro text, area_name text, shown_root text,
  is_new boolean, roots_match text, shared_interests text[], interests text[], score int
)
language sql stable security definer set search_path = public as $$
  select pp.id, pp.display_name, pp.photo_path, pp.intro, pp.area_name, pp.shown_root, pp.is_new,
         shared_roots(auth.uid(), pp.id) as roots_match,
         shared_interest_labels(auth.uid(), pp.id),
         interest_labels(pp.id),
         (case when shared_roots(auth.uid(), pp.id) like 'city:%' then 3
               when shared_roots(auth.uid(), pp.id) like 'region:%' then 2 else 0 end
          + coalesce(array_length(shared_interest_labels(auth.uid(), pp.id), 1), 0)
          + case when pp.area_name = (me_area()).name then 1 else 0 end)::int as score
  from public_profiles pp
  where pp.id <> auth.uid()
    and pp.metro = (me_area()).metro
    and not exists (select 1 from hidden_suggestions h where h.profile_id = auth.uid() and h.hidden_id = pp.id)
    and not exists (select 1 from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
                    where a.profile_id = auth.uid() and b.profile_id = pp.id)
  order by score desc, pp.is_new desc, pp.display_name;
$$;

-- "10 from Jaipur around DFW". Null when under 5.
create or replace function my_root_counts()
returns table (city text, city_count bigint, region text, region_count bigint)
language sql stable security definer set search_path = public as $$
  with mine as (
    select pl.city, pl.region from profile_roots r join places pl on pl.id = r.place_id
    where r.profile_id = auth.uid() and r.position = 1
  ), people as (select shared_roots(auth.uid(), pp.id) m from public_profiles pp
                where pp.id <> auth.uid() and pp.metro = (me_area()).metro)
  select mine.city, safe_count((select count(*) from people where m = 'city:' || mine.city)),
         mine.region, safe_count((select count(*) from people where m is not null))
  from mine;
$$;

-- Hellos waiting for my answer.
create or replace function inbox_hellos()
returns table (id uuid, from_id uuid, display_name text, photo_path text, shown_root text, message text, common text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.from_id, pp.display_name, pp.photo_path, pp.shown_root, h.message,
         coalesce(
           case when shared_roots(auth.uid(), h.from_id) like 'city:%' then 'Also from ' || split_part(shared_roots(auth.uid(), h.from_id), ':', 2)
                when shared_roots(auth.uid(), h.from_id) like 'region:%' then 'Both from ' || split_part(shared_roots(auth.uid(), h.from_id), ':', 2) end,
           'Plays ' || lower((shared_interest_labels(auth.uid(), h.from_id))[1]),
           'Lives in ' || pp.area_name),
         h.created_at
  from hellos h join public_profiles pp on pp.id = h.from_id
  where h.to_id = auth.uid() and h.status = 'pending'
  order by h.created_at desc;
$$;

-- Hellos I sent that are still waiting.
create or replace function sent_hellos()
returns table (id uuid, to_id uuid, display_name text, photo_path text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.to_id, pp.display_name, pp.photo_path, h.created_at
  from hellos h join public_profiles pp on pp.id = h.to_id
  where h.from_id = auth.uid() and h.status = 'pending'
  order by h.created_at desc;
$$;

-- Someone else's profile page, as one JSON object.
create or replace function profile_card(p uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pp public_profiles;
  r text;
  st text := 'none';
  conv uuid;
  hello_id uuid;
  ev jsonb;
begin
  select * into pp from public_profiles where id = p;
  if not found or p = auth.uid() then return null; end if;
  r := shared_roots(auth.uid(), p);

  select c.id into conv from conversation_members a join conversation_members b on b.conversation_id = a.conversation_id
    join conversations c on c.id = a.conversation_id where a.profile_id = auth.uid() and b.profile_id = p limit 1;
  if conv is not null then st := 'connected';
  elsif exists (select 1 from hellos where from_id = auth.uid() and to_id = p and status in ('pending','not_now')) then st := 'sent';
  else
    select id into hello_id from hellos where from_id = p and to_id = auth.uid() and status = 'pending';
    if hello_id is not null then st := 'received'; end if;
  end if;

  select jsonb_build_object('title', e.title, 'mon', upper(to_char(e.starts_at at time zone 'America/Chicago', 'Mon')),
                            'day', extract(day from e.starts_at at time zone 'America/Chicago')::int)
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
    'roots_match', r,
    'interests', to_jsonb(interest_labels(p)),
    'shared_interests', to_jsonb(shared_interest_labels(auth.uid(), p)),
    'languages', to_jsonb(pp.languages),
    'my_languages', to_jsonb((select languages from profiles where id = auth.uid())),
    'shared_event', ev,
    'hello_state', st, 'hello_id', hello_id, 'conversation_id', conv);
end;
$$;

-- ───────── Chats ─────────
create or replace function my_chats()
returns table (conversation_id uuid, other_id uuid, display_name text, photo_path text,
               last_body text, last_from_me boolean, last_at timestamptz, unread boolean, muted boolean)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, o.profile_id, pp.display_name, pp.photo_path,
         lm.body, lm.sender_id = auth.uid(), coalesce(lm.created_at, c.created_at),
         coalesce(lm.sender_id <> auth.uid() and lm.created_at > m.last_read_at, false), m.muted
  from conversation_members m
  join conversations c on c.id = m.conversation_id
  join conversation_members o on o.conversation_id = m.conversation_id and o.profile_id <> m.profile_id
  join public_profiles pp on pp.id = o.profile_id            -- drops blocked people
  left join lateral (select body, sender_id, created_at from messages x
                     where x.conversation_id = m.conversation_id order by created_at desc limit 1) lm on true
  where m.profile_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

-- Header for one chat: who, and a line on what you share.
create or replace function chat_header(conv uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_member(conv) then jsonb_build_object(
    'other_id', pp.id, 'display_name', pp.display_name, 'first_name', split_part(pp.display_name, ' ', 1),
    'photo_path', pp.photo_path, 'area_name', pp.area_name,
    'muted', (select muted from conversation_members where conversation_id = conv and profile_id = auth.uid()),
    'subtitle', 'Lives in ' || pp.area_name || coalesce(' · Plays ' || lower(si[1]), ''),
    'context', case
      when si[1] is not null and pp.area_name = (me_area()).name then 'You both play ' || lower(si[1]) || ' in ' || pp.area_name
      when si[1] is not null then 'You both like ' || lower(si[1])
      when shared_roots(auth.uid(), pp.id) is not null then 'You''re both from ' || split_part(shared_roots(auth.uid(), pp.id), ':', 2)
      else 'You said hi on Nayboro' end)
  end
  from conversation_members o
  join public_profiles pp on pp.id = o.profile_id
  cross join lateral (select shared_interest_labels(auth.uid(), pp.id) si) s
  where o.conversation_id = conv and o.profile_id <> auth.uid();
$$;

create or replace function mark_read(conv uuid) returns void
language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now() where conversation_id = conv and profile_id = auth.uid();
$$;

-- Badge on the Chats tab: hellos waiting + chats with unread messages.
create or replace function chats_badge() returns int
language sql stable security definer set search_path = public as $$
  select ((select count(*) from inbox_hellos()) + (select count(*) from my_chats() where unread and not muted))::int;
$$;

-- No more than 20 hellos a day per person (spam guard).
create or replace function hello_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from hellos where from_id = new.from_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You have said hi to a lot of people today. Try again tomorrow.';
  end if;
  return new;
end;
$$;
create trigger hello_rate_limit before insert on hellos for each row execute function hello_rate_limit();

-- ───────── Explore ─────────
-- Questions are stamped with the asker's area automatically.
create or replace function stamp_question_area() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.area_id := (select area_id from profiles where id = new.author_id);
  return new;
end;
$$;
create trigger stamp_question_area before insert on questions for each row execute function stamp_question_area();

-- Questions I should see:
--   'near'  : asked within 25 km of my area
--   'metro' : asked anywhere in my metro
--   'other' : asked by someone elsewhere, aimed at my city
-- plus my own. Anonymous authors stay masked (comes from question_feed).
create or replace function questions_for_me(p_topic text default null, p_unanswered boolean default false)
returns setof question_feed
language sql stable security definer set search_path = public as $$
  select f.* from question_feed f join questions q on q.id = f.id
  join areas qa on qa.id = q.area_id
  where (f.is_mine
     or (q.scope = 'near'  and area_km(q.area_id, (me_area()).id) <= 25)
     or (q.scope = 'metro' and qa.metro = (me_area()).metro)
     or (q.scope = 'other' and lower(q.target_city) = lower((me_area()).name)))
    and (p_topic is null or f.topic::text = p_topic)
    and (not p_unanswered or f.answer_count = 0)
  order by f.created_at desc
  limit 100;
$$;

create or replace function unanswered_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from questions_for_me(null, true);
$$;

-- Answers for a set of questions, with the reader-relative roots tag.
create or replace function answers_for(qids uuid[])
returns table (id uuid, question_id uuid, author_id uuid, display_name text, photo_path text, area_name text,
               roots_tag text, body text, helpful_count bigint, i_found_helpful boolean, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.question_id, a.author_id, pp.display_name, pp.photo_path, pp.area_name,
         case when a.author_id = auth.uid() then null
              else 'From ' || split_part(shared_roots(auth.uid(), a.author_id), ':', 2) end,
         a.body,
         (select count(*) from answer_helpful h where h.answer_id = a.id),
         exists (select 1 from answer_helpful h where h.answer_id = a.id and h.profile_id = auth.uid()),
         a.author_id = auth.uid(), a.created_at
  from answers a join public_profiles pp on pp.id = a.author_id
  where a.question_id = any(qids) and not a.hidden
  order by (select count(*) from answer_helpful h where h.answer_id = a.id) desc, a.created_at;
$$;

-- Events in my metro, soonest first.
create or replace function events_for_me()
returns setof event_feed
language sql stable security definer set search_path = public as $$
  select e.* from event_feed e left join areas a on a.id = e.area_id
  where e.starts_at > now() - interval '3 hours'
    and (a.metro is null or a.metro = (me_area()).metro)
  order by e.starts_at;
$$;

grant execute on all functions in schema public to authenticated;
