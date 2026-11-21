-- Waitlist v2 (new coming-soon design): optional first name after joining.
alter table waitlist add column if not exists first_name text check (char_length(first_name) <= 40);

-- Set the name for a sign-up. The caller must know both the email and its invite code,
-- which only the person who just joined has. Service role only (called from /api/waitlist).
create or replace function waitlist_set_name(p_email text, p_ref text, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update waitlist set first_name = nullif(left(btrim(p_name), 40), '')
   where email = lower(btrim(p_email)) and ref_code = p_ref;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke execute on function waitlist_set_name(text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function waitlist_set_name(text, text, text) to service_role;
  end if;
end $$;

-- Admin list now includes the first name.
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
        select w.email, w.first_name, w.hometown, a.name || ', ' || a.state as city, m.name as metro, w.created_at,
               (select count(*) from waitlist r where r.referred_by = w.ref_code) as invited
        from waitlist w left join areas a on a.id = w.area_id left join metros m on m.code = w.metro
        order by w.created_at desc limit 500) x),
    'beta', (select coalesce(jsonb_agg(b.email order by b.added_at desc), '[]') from beta_testers b)
  );
end;
$$;
