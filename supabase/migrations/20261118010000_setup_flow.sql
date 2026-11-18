-- Setup flow: area centre points, profile photos, and one atomic "save my profile" call.

-- Area centre points. The phone matches its location to the nearest area ON THE DEVICE,
-- so coordinates are never sent to the server (product rule 2).
alter table areas add column lat double precision, add column lng double precision;

-- ───────── profile photos (private bucket, signed-in users can view) ─────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "avatars read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── save the whole setup in one transaction ─────────
-- Runs as the caller (security invoker), so every RLS policy still applies.
create or replace function save_profile(
  p_first      text,
  p_last       text,
  p_intro      text,
  p_photo      text,
  p_area       bigint,
  p_level      root_level,
  p_roots      bigint[],
  p_interests  bigint[],
  p_adult      boolean
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not coalesce(p_adult, false) then raise exception 'must be 18 or older'; end if;
  if coalesce(array_length(p_roots, 1), 0) not between 1 and 3 then raise exception 'pick 1 to 3 hometowns'; end if;
  if coalesce(array_length(p_interests, 1), 0) < 3 then raise exception 'pick at least 3 interests'; end if;
  if p_area is null then raise exception 'pick your city'; end if;
  if p_photo is not null and split_part(p_photo, '/', 1) <> me::text then raise exception 'bad photo path'; end if;

  insert into profiles (id, first_name, last_name, intro, photo_path, area_id, root_level, is_adult, onboarded_at)
  values (me, btrim(p_first), nullif(btrim(p_last), ''), nullif(btrim(p_intro), ''), p_photo, p_area, p_level, true, now())
  on conflict (id) do update set
    first_name   = excluded.first_name,
    last_name    = excluded.last_name,
    intro        = excluded.intro,
    photo_path   = coalesce(excluded.photo_path, profiles.photo_path),
    area_id      = excluded.area_id,
    root_level   = excluded.root_level,
    is_adult     = true,
    onboarded_at = coalesce(profiles.onboarded_at, now());

  delete from profile_roots where profile_id = me;
  insert into profile_roots (profile_id, place_id, position)
  select me, r.place_id, r.pos from unnest(p_roots) with ordinality as r(place_id, pos);

  delete from profile_interests where profile_id = me;
  insert into profile_interests (profile_id, interest_id)
  select distinct me, i from unnest(p_interests) as i;
end;
$$;

grant execute on function save_profile(text, text, text, text, bigint, root_level, bigint[], bigint[], boolean) to authenticated;
