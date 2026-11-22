-- Setup starts with the city, hometown and first name someone gave when they joined the waitlist.
-- Matches only the signed-in person's own (verified) email, and returns only their own row.
create or replace function my_waitlist_prefill()
returns table (area_id bigint, area_name text, area_state text, metro_name text,
               place_id bigint, place_city text, place_region text, place_country text, first_name text)
language sql stable security definer set search_path = public, auth as $$
  select a.id, a.name, a.state, m.name,
         p.id, p.city, p.region, p.country, w.first_name
  from waitlist w
  join auth.users u on u.id = auth.uid() and lower(u.email) = lower(w.email)
  left join areas a on a.id = w.area_id
  left join metros m on m.code = a.metro
  left join places p on p.id = w.place_id
  limit 1
$$;
revoke all on function my_waitlist_prefill() from public, anon;
grant execute on function my_waitlist_prefill() to authenticated;
