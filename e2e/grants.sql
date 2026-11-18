-- Roles and grants that Supabase sets up for you, needed only for the local test.
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
grant authenticated, anon to authenticator;
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
