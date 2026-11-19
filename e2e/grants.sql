-- Only the login role PostgREST uses; Supabase creates this for you. Table and function
-- privileges come from the default privileges in supabase/tests/00_supabase_stub.sql.
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
grant authenticated, anon, service_role to authenticator;
grant usage on schema auth to service_role;
grant select on auth.users to service_role;
