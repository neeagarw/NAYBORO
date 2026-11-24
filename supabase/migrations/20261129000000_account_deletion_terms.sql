-- Delete my account, and a record of which Terms / Privacy version each person agreed to.

-- When someone agreed, and to which version (shown at the 18+ box in Setup).
alter table profiles add column if not exists terms_version text,
                     add column if not exists terms_agreed_at timestamptz;

create or replace function record_terms(p_version text) returns void
language sql security invoker set search_path = public as $$
  update profiles set terms_version = left(p_version, 20), terms_agreed_at = now() where id = auth.uid();
$$;
revoke all on function record_terms(text) from public, anon;
grant execute on function record_terms(text) to authenticated;

-- Deletes the caller's account and everything tied to it. Removing the auth user cascades to the profile and
-- from there to roots, interests, hellos, chats, messages, questions, answers, reports, blocks and notifications.
-- Their waitlist sign-up and contact messages go too. Photos are removed from storage by the app first
-- (storage rows can only be deleted through the Storage API).
create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); my_email text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select email into my_email from auth.users where id = me;
  delete from contact_messages where profile_id = me;
  if my_email is not null then delete from waitlist where lower(email) = lower(my_email); end if;
  delete from beta_testers where my_email is not null and lower(email) = lower(my_email);
  delete from auth.users where id = me;
end $$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
