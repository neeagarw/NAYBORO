-- Private beta: testers sign in with a shared beta code instead of an emailed code (POST /api/beta-login,
-- only when BETA_SITE=1 and BETA_LOGIN_CODE is set). Wrong tries are counted per hashed network
-- so the code can't be guessed. Only the service role touches this table.
create table beta_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  at timestamptz not null default now()
);
create index beta_login_attempts_ip_at on beta_login_attempts (ip_hash, at desc);
alter table beta_login_attempts enable row level security;   -- no policies: service role only
revoke all on beta_login_attempts from anon, authenticated;
