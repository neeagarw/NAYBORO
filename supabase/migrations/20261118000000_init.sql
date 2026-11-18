-- Nayboro · initial schema
-- Source of truth for screens: design/mockups/*.html. Product rules: CLAUDE.md.
--
-- Privacy model in one paragraph:
--   Base tables are locked down by Row Level Security (RLS). Other people never read
--   profiles, profile_roots or questions directly. They read the views at the bottom
--   (public_profiles, question_feed), which show a hometown only at the level its owner
--   chose, hide the author of anonymous questions, and drop anyone in a block.

create extension if not exists pgcrypto;

-- ───────────────────────── enums ─────────────────────────
create type root_level     as enum ('city', 'state', 'country');
create type hello_status   as enum ('pending', 'accepted', 'not_now', 'withdrawn');
create type question_topic as enum ('Groceries','Schools','Food','Sports','Immigration','Housing','Travel','Life here','General');
create type question_scope as enum ('near', 'metro', 'other');
create type report_target  as enum ('profile', 'message', 'question', 'answer');
create type report_status  as enum ('open', 'actioned', 'dismissed');
create type contact_topic  as enum ('account', 'safety', 'event', 'broken', 'idea', 'other');

-- ───────────────────────── reference data ─────────────────────────
-- Hometowns people can pick ("Where are your roots?").
create table places (
  id       bigint generated always as identity primary key,
  city     text not null,
  region   text not null,          -- state / province, e.g. Rajasthan
  country  text not null,
  unique (city, region, country)
);

-- Where people live now. City level only, never an address.
create table areas (
  id     bigint generated always as identity primary key,
  name   text not null,            -- Garland
  state  text not null,            -- TX
  metro  text not null,            -- DFW
  zips   text[] not null default '{}',
  unique (name, state)
);

create table interests (
  id          bigint generated always as identity primary key,
  label       text not null unique,  -- Tennis
  group_name  text not null,         -- Sport and fitness
  sort        int  not null default 0
);

-- ───────────────────────── people ─────────────────────────
create table profiles (
  id                uuid primary key references auth.users on delete cascade,
  first_name        text not null check (char_length(first_name) between 1 and 30),
  last_name         text check (char_length(last_name) <= 30),
  photo_path        text,                                   -- Supabase Storage path
  intro             text check (char_length(intro) <= 160),
  area_id           bigint references areas,
  root_level        root_level not null default 'city',     -- how much of the hometown to show
  languages         text[] not null default '{}',
  is_adult          boolean not null default false,         -- "I'm 18 or older" box
  phone_verified    boolean not null default false,
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  constraint adult_before_onboarded check (onboarded_at is null or is_adult)
);

create table profile_roots (
  profile_id  uuid references profiles on delete cascade,
  place_id    bigint references places,
  position    smallint not null check (position between 1 and 3),  -- max 3 hometowns
  primary key (profile_id, place_id),
  unique (profile_id, position)
);

create table profile_interests (
  profile_id   uuid references profiles on delete cascade,
  interest_id  bigint references interests,
  primary key (profile_id, interest_id)
);

create table blocks (
  blocker_id  uuid references profiles on delete cascade,
  blocked_id  uuid references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- "Hide this suggestion" on the People rail.
create table hidden_suggestions (
  profile_id  uuid references profiles on delete cascade,
  hidden_id   uuid references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, hidden_id)
);

-- ───────────────────────── hellos & chats ─────────────────────────
-- A chat opens only when the receiver accepts a hello.
create table hellos (
  id            uuid primary key default gen_random_uuid(),
  from_id       uuid not null references profiles on delete cascade,
  to_id         uuid not null references profiles on delete cascade,
  message       text not null check (char_length(message) between 2 and 200),
  status        hello_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (from_id, to_id),
  check (from_id <> to_id)
);

create table conversations (
  id          uuid primary key default gen_random_uuid(),
  hello_id    uuid unique references hellos on delete set null,
  created_at  timestamptz not null default now()
);

create table conversation_members (
  conversation_id  uuid references conversations on delete cascade,
  profile_id       uuid references profiles on delete cascade,
  last_read_at     timestamptz not null default now(),
  muted            boolean not null default false,
  primary key (conversation_id, profile_id)
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations on delete cascade,
  sender_id        uuid not null references profiles on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index on messages (conversation_id, created_at);

-- ───────────────────────── explore ─────────────────────────
create table questions (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles on delete cascade,
  is_anonymous  boolean not null default false,
  body          text not null check (char_length(body) between 10 and 150),
  details       text check (char_length(details) <= 800),
  topic         question_topic not null default 'General',
  scope         question_scope not null default 'near',
  area_id       bigint references areas,     -- author's area when posted
  target_city   text,                        -- only when scope = 'other'
  hidden        boolean not null default false,   -- set by moderators
  created_at    timestamptz not null default now(),
  check ((scope = 'other') = (target_city is not null))
);
create index on questions (created_at desc);

-- Answers always carry the writer's name (no anonymous answers).
create table answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions on delete cascade,
  author_id    uuid not null references profiles on delete cascade,
  body         text not null check (char_length(body) between 3 and 600),
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);

create table answer_helpful (
  answer_id   uuid references answers on delete cascade,
  profile_id  uuid references profiles on delete cascade,
  primary key (answer_id, profile_id)
);

-- Events are added by the Nayboro team and link out to the organiser. We list, we don't host.
create table events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  place_name  text not null,          -- "Holford Park, Garland"
  area_id     bigint references areas,
  price_label text not null default 'Free',
  kind        text not null,          -- Sports, Food, Family, Festival
  host_name   text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

create table event_interest (
  event_id    uuid references events on delete cascade,
  profile_id  uuid references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- ───────────────────────── safety & support ─────────────────────────
create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references profiles on delete cascade,
  target_type  report_target not null,
  target_id    uuid not null,
  reason       text,
  status       report_status not null default 'open',
  created_at   timestamptz not null default now()
);

create table contact_messages (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles on delete set null,
  topic        contact_topic not null,
  body         text not null check (char_length(body) between 5 and 1000),
  reply_email  text not null,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── helper functions ─────────────────────────
-- True when either person has blocked the other.
create or replace function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function is_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_members
    where conversation_id = conv and profile_id = auth.uid()
  );
$$;

-- Never show a count below 5 ("3 from Rajasthan interested" must not appear).
create or replace function safe_count(n bigint) returns bigint
language sql immutable as $$
  select case when n >= 5 then n else null end;
$$;

-- Accepting a hello creates the conversation for both people in one step.
create or replace function accept_hello(h uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  row  hellos;
  conv uuid;
begin
  select * into row from hellos where id = h and to_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'hello not found'; end if;
  if is_blocked(row.from_id, row.to_id) then raise exception 'blocked'; end if;

  update hellos set status = 'accepted', responded_at = now() where id = h;
  insert into conversations (hello_id) values (h) returning id into conv;
  insert into conversation_members (conversation_id, profile_id)
    values (conv, row.from_id), (conv, row.to_id);
  return conv;
end;
$$;

-- ───────────────────────── row level security ─────────────────────────
alter table places               enable row level security;
alter table areas                enable row level security;
alter table interests            enable row level security;
alter table profiles             enable row level security;
alter table profile_roots        enable row level security;
alter table profile_interests    enable row level security;
alter table blocks               enable row level security;
alter table hidden_suggestions   enable row level security;
alter table hellos               enable row level security;
alter table conversations        enable row level security;
alter table conversation_members enable row level security;
alter table messages             enable row level security;
alter table questions            enable row level security;
alter table answers              enable row level security;
alter table answer_helpful       enable row level security;
alter table events               enable row level security;
alter table event_interest       enable row level security;
alter table reports              enable row level security;
alter table contact_messages     enable row level security;

-- Reference data: readable by signed-in users, written only by the service role.
create policy "read places"    on places    for select to authenticated using (true);
create policy "read areas"     on areas     for select to authenticated using (true);
create policy "read interests" on interests for select to authenticated using (true);
create policy "read events"    on events    for select to authenticated using (true);

-- Own profile only. Everyone else goes through public_profiles.
create policy "own profile read"   on profiles for select using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own roots" on profile_roots for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Interests are not sensitive: readable by signed-in users unless blocked.
create policy "read interests of others" on profile_interests for select to authenticated
  using (not is_blocked(auth.uid(), profile_id));
create policy "own interests write" on profile_interests for insert with check (profile_id = auth.uid());
create policy "own interests delete" on profile_interests for delete using (profile_id = auth.uid());

create policy "own blocks" on blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "own hidden" on hidden_suggestions for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Hellos: both sides can read; only the sender creates; only the receiver answers.
create policy "hello read" on hellos for select using (auth.uid() in (from_id, to_id));
create policy "hello send" on hellos for insert
  with check (from_id = auth.uid() and status = 'pending' and not is_blocked(from_id, to_id));
create policy "hello not now" on hellos for update
  using (to_id = auth.uid() and status = 'pending')
  with check (status = 'not_now');   -- accepting goes through accept_hello()
create policy "hello withdraw" on hellos for update
  using (from_id = auth.uid() and status = 'pending')
  with check (status = 'withdrawn');

-- Chats: members only. Conversations are created only by accept_hello().
create policy "conv read" on conversations for select using (is_member(id));
create policy "members read" on conversation_members for select using (is_member(conversation_id));
create policy "member update self" on conversation_members for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "messages read" on messages for select using (is_member(conversation_id));
create policy "messages send" on messages for insert
  with check (
    sender_id = auth.uid() and is_member(conversation_id)
    and not exists (
      select 1 from conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.profile_id <> auth.uid() and is_blocked(auth.uid(), m.profile_id)
    )
  );

-- Questions: only the author reads the base row (it holds author_id even when anonymous).
create policy "own questions read" on questions for select using (author_id = auth.uid());
create policy "ask" on questions for insert with check (author_id = auth.uid());
create policy "own questions delete" on questions for delete using (author_id = auth.uid());

create policy "answers read" on answers for select to authenticated
  using (not hidden and not is_blocked(auth.uid(), author_id));
create policy "answer" on answers for insert with check (author_id = auth.uid());
create policy "own answers delete" on answers for delete using (author_id = auth.uid());

create policy "helpful read" on answer_helpful for select to authenticated using (true);
create policy "helpful own" on answer_helpful for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "event interest own" on event_interest for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "report" on reports for insert with check (reporter_id = auth.uid());
create policy "contact" on contact_messages for insert with check (profile_id is null or profile_id = auth.uid());

-- ───────────────────────── public views ─────────────────────────
-- These run as the view owner (security_invoker off) so they can read base tables,
-- and they apply the privacy rules themselves. Every view filters out blocked people.

-- Other people's profiles: first name + last initial, area, hometown at the chosen level.
create view public_profiles with (security_barrier) as
select
  p.id,
  p.first_name || coalesce(' ' || upper(left(p.last_name, 1)) || '.', '') as display_name,
  p.photo_path,
  p.intro,
  p.languages,
  p.phone_verified,
  p.created_at > now() - interval '14 days' as is_new,
  a.name  as area_name,
  a.metro as metro,
  case p.root_level when 'city' then pl.city when 'state' then pl.region else pl.country end as shown_root,
  p.root_level,
  -- Exposed only for "in common" matching at the level the owner allows.
  case when p.root_level in ('city','state') then pl.region end as shown_region
from profiles p
left join areas a on a.id = p.area_id
left join profile_roots r on r.profile_id = p.id and r.position = 1
left join places pl on pl.id = r.place_id
where p.onboarded_at is not null
  and auth.uid() is not null
  and not is_blocked(auth.uid(), p.id);

-- Explore questions: anonymous authors are hidden from everyone except the author.
create view question_feed with (security_barrier) as
select
  q.id,
  q.body,
  q.details,
  q.topic,
  q.scope,
  q.target_city,
  q.created_at,
  q.is_anonymous,
  case when q.is_anonymous then null else q.author_id end as author_id,
  case when q.is_anonymous then 'Anonymous' else pp.display_name end as author_name,
  a.name || case when q.is_anonymous then ' area' else '' end as area_label,
  q.author_id = auth.uid() as is_mine,
  (select count(*) from answers x where x.question_id = q.id and not x.hidden) as answer_count
from questions q
join profiles p on p.id = q.author_id
left join public_profiles pp on pp.id = q.author_id
left join areas a on a.id = q.area_id
where not q.hidden
  and auth.uid() is not null
  and not is_blocked(auth.uid(), q.author_id);

-- Events with interest counts that respect the under-5 rule.
create view event_feed with (security_barrier) as
select
  e.*,
  safe_count((select count(*) from event_interest i where i.event_id = e.id)) as interested_count,
  exists (select 1 from event_interest i where i.event_id = e.id and i.profile_id = auth.uid()) as i_am_interested
from events e
where auth.uid() is not null;

grant select on public_profiles, question_feed, event_feed to authenticated;
grant execute on function accept_hello(uuid) to authenticated;

-- Realtime for chat and hellos.
alter publication supabase_realtime add table messages, hellos;
