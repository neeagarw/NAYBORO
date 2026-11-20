-- Pre-launch: "Join the community" waitlist, a launch switch, and beta testers.
--   site_mode = 'waitlist' : the home page is the coming-soon page; only admins and beta testers can use the app
--   site_mode = 'open'     : everyone can sign up and use the app
-- Flip it in Admin (or: update app_settings set value = '"open"' where key = 'site_mode').

insert into app_settings values ('site_mode', '"waitlist"', 'waitlist | open. Waitlist = coming-soon page; only admins and beta testers get in.')
on conflict (key) do nothing;

create or replace function site_mode() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from app_settings where key = 'site_mode'), 'open');
$$;

-- ───────── waitlist ─────────
create table waitlist (
  id           bigint generated always as identity primary key,
  email        text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254),
  hometown     text check (char_length(hometown) <= 120),
  place_id     bigint references places,
  area_id      bigint references areas,
  metro        text references metros,
  ref_code     text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  referred_by  text,
  ip_hash      text,                       -- salted hash, only for spam limits; never the address itself
  created_at   timestamptz not null default now(),
  invited_at   timestamptz
);
create unique index waitlist_email on waitlist (lower(email));
create index on waitlist (metro);
create index on waitlist (ip_hash, created_at);
create index on waitlist (referred_by);
alter table waitlist enable row level security;   -- no policies: only the server and admin functions touch it

-- Called only by the server (/api/waitlist), which adds the hashed IP for spam limits.
-- Joining twice with the same email is fine: it returns the same invite code.
create or replace function join_waitlist(p_email text, p_hometown text, p_place bigint, p_area bigint, p_ref text, p_ip_hash text)
returns table (ref_code text, city text, metro_name text, people_in_metro bigint, already boolean)
language plpgsql security definer set search_path = public as $$
declare
  w waitlist;
  m text := (select a.metro from areas a where a.id = p_area);
  was boolean := false;
begin
  if p_ip_hash is not null and (select count(*) from waitlist x where x.ip_hash = p_ip_hash and x.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many sign-ups from this network. Please try again in an hour.';
  end if;
  select * into w from waitlist x where lower(x.email) = lower(btrim(p_email));
  if found then
    was := true;
  else
    insert into waitlist (email, hometown, place_id, area_id, metro, referred_by, ip_hash)
    values (lower(btrim(p_email)), nullif(btrim(p_hometown), ''), p_place, p_area, m,
            (select x.ref_code from waitlist x where x.ref_code = lower(btrim(p_ref))), p_ip_hash)
    returning * into w;
  end if;
  return query
  select w.ref_code, a.name || ', ' || a.state, mt.name,
         safe_count((select count(*) from waitlist x where x.metro = w.metro)), was
  from (select 1) one left join areas a on a.id = w.area_id left join metros mt on mt.code = w.metro;
end;
$$;

-- "Leave the list" link in the confirmation email (the server checks the signed link first).
create or replace function leave_waitlist(p_email text) returns void
language sql security definer set search_path = public as $$
  delete from waitlist where lower(email) = lower(btrim(p_email));
$$;

-- Hometown search for the public page (reference data, no personal data).
create or replace function search_places(p_q text, p_limit int default 6)
returns table (id bigint, city text, region text, country text)
language sql stable security definer set search_path = public as $$
  select p.id, p.city, p.region, p.country from places p
  where length(btrim(p_q)) >= 1 and lower(p.city) like lower(replace(replace(btrim(p_q), '%', ''), '_', '')) || '%'
  order by p.city limit least(greatest(p_limit, 1), 20);
$$;

-- ───────── beta testers + the gate ─────────
create table beta_testers (
  email     text primary key check (email = lower(email)),
  added_at  timestamptz not null default now()
);
alter table beta_testers enable row level security;   -- admin functions only

-- Can the signed-in person use the app right now?
create or replace function can_enter() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select site_mode() = 'open'
      or is_admin()
      or exists (select 1 from beta_testers b join auth.users u on lower(u.email) = b.email where u.id = auth.uid());
$$;

-- ───────── admin ─────────
create or replace function admin_waitlist()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return jsonb_build_object(
    'mode', site_mode(),
    'total', (select count(*) from waitlist),
    'last_7_days', (select count(*) from waitlist where created_at > now() - interval '7 days'),
    'by_metro', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
        select coalesce(m.name, 'City not given') as metro, count(*) as n from waitlist w left join metros m on m.code = w.metro
        group by m.name order by count(*) desc limit 50) x),
    'recent', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select w.email, w.hometown, a.name || ', ' || a.state as city, m.name as metro, w.created_at,
               (select count(*) from waitlist r where r.referred_by = w.ref_code) as invited
        from waitlist w left join areas a on a.id = w.area_id left join metros m on m.code = w.metro
        order by w.created_at desc limit 500) x),
    'beta', (select coalesce(jsonb_agg(b.email order by b.added_at desc), '[]') from beta_testers b)
  );
end;
$$;

create or replace function admin_add_beta(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  if p_email !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'That email doesn''t look right.'; end if;
  insert into beta_testers (email) values (lower(btrim(p_email))) on conflict do nothing;
  update waitlist set invited_at = coalesce(invited_at, now()) where lower(email) = lower(btrim(p_email));
end;
$$;

create or replace function admin_remove_beta(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  delete from beta_testers where email = lower(btrim(p_email));
end;
$$;

create or replace function admin_set_site_mode(p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  if p_mode not in ('waitlist', 'open') then raise exception 'mode must be waitlist or open'; end if;
  update app_settings set value = to_jsonb(p_mode) where key = 'site_mode';
end;
$$;

-- ───────── permissions ─────────
revoke execute on function join_waitlist(text, text, bigint, bigint, text, text) from public, anon, authenticated;
revoke execute on function leave_waitlist(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function join_waitlist(text, text, bigint, bigint, text, text), leave_waitlist(text) to service_role;
  end if;
end $$;
-- Public reference lookups used by the coming-soon page.
grant execute on function site_mode(), search_places(text, int), search_areas(text, int), locate_area(double precision, double precision) to anon, authenticated;
