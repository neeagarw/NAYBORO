-- Newer Supabase projects no longer grant table privileges to the API roles automatically, so on the
-- hosted database anon / authenticated / service_role could not read any table (the local test stub,
-- supabase/tests/00_supabase_stub.sql, has the classic defaults, which is what every test ran against).
-- Restore the classic defaults: privacy is enforced by row level security on every table, as before.

-- Safety first: refuse to grant anything if a public table is missing row level security.
do $$
declare bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if bad is not null then raise exception 'tables without row level security: %', bad; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Keep the deliberate table lock from earlier migrations.
revoke all on beta_login_attempts from anon, authenticated;
