-- Interest sentences read naturally: "Plays tennis", "Goes running", "Does yoga", "Into book club".
-- One verb per interest (data, not code) and one function that builds every phrase, so the chat header,
-- hello cards, profile tiles and People titles can never disagree again ("Plays running" with a tennis ball).

alter table interests drop constraint if exists interests_verb_check;
alter table interests add constraint interests_verb_check check (verb in ('play', 'go', 'do', 'into'));

update interests set verb = 'go' where label in ('Running', 'Cycling', 'Hiking', 'Swimming');
update interests set verb = 'do' where label in ('Yoga');
update interests set verb = 'into' where label in ('Gym buddies');

-- kind: 'one' = "Plays tennis", 'both' = "Both play tennis", 'you_both' = "You both play tennis"
create or replace function interest_phrase(p_label text, p_kind text default 'one') returns text
language sql stable set search_path = public as $$
  select case p_kind
    when 'one' then case i.verb when 'play' then 'Plays ' when 'go' then 'Goes ' when 'do' then 'Does ' else 'Into ' end
    when 'both' then case i.verb when 'play' then 'Both play ' when 'go' then 'Both go ' when 'do' then 'Both do ' else 'Both into ' end
    else case i.verb when 'play' then 'You both play ' when 'go' then 'You both go ' when 'do' then 'You both do ' else 'You''re both into ' end
  end || lower(i.label)
  from interests i where i.label = p_label
$$;
grant execute on function interest_phrase(text, text) to anon, authenticated, service_role;

create or replace function inbox_hellos()
returns table (id uuid, from_id uuid, display_name text, photo_path text, shown_root text, message text, common text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.from_id, pp.display_name, pp.photo_path, pp.shown_root, h.message,
         coalesce(
           case when shared_roots(auth.uid(), h.from_id) like 'city:%' then 'Also from ' || split_part(shared_roots(auth.uid(), h.from_id), ':', 2)
                when shared_roots(auth.uid(), h.from_id) like 'region:%' then 'Both from ' || split_part(shared_roots(auth.uid(), h.from_id), ':', 2) end,
           (select interest_phrase(i.label)
            from profile_interests x join profile_interests y on y.interest_id = x.interest_id and y.profile_id = h.from_id
            join interests i on i.id = x.interest_id where x.profile_id = auth.uid() order by i.sort limit 1),
           'Lives in ' || pp.area_name),
         h.created_at
  from hellos h join public_profiles pp on pp.id = h.from_id
  where h.to_id = auth.uid() and h.status = 'pending'
  order by h.created_at desc
  limit 100;
$$;

create or replace function chat_header(conv uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_member(conv) then jsonb_build_object(
    'other_id', pp.id, 'display_name', pp.display_name, 'first_name', split_part(pp.display_name, ' ', 1),
    'photo_path', pp.photo_path, 'area_name', pp.area_name,
    'muted', (select muted from conversation_members where conversation_id = conv and profile_id = auth.uid()),
    'subtitle', 'Lives in ' || pp.area_name || coalesce(' · ' || interest_phrase(si[1]), ''),
    'context', case
      when si[1] is not null and pp.area_name = (me_area()).name then interest_phrase(si[1], 'you_both') || ' in ' || pp.area_name
      when si[1] is not null then interest_phrase(si[1], 'you_both')
      when shared_roots(auth.uid(), pp.id) is not null then 'You''re both from ' || split_part(shared_roots(auth.uid(), pp.id), ':', 2)
      else 'You said hi on Nayboro' end)
  end
  from conversation_members o
  join public_profiles pp on pp.id = o.profile_id
  cross join lateral (select shared_interest_labels(auth.uid(), pp.id) si) s
  where o.conversation_id = conv and o.profile_id <> auth.uid();
$$;

-- Topic suggestions match whole words now (the app no longer lets "dal" match "Dallas"); add common words.
update topics set keywords = keywords || '{paneer,biryani,dosa,idli,samosa,mithai,restaurants,eat,eating,lunch,dinner,breakfast,snacks}'::text[] where name = 'Food';
update topics set keywords = keywords || '{grocer,indian store,patel brothers,masala,spices,rice,flour,vegetables,produce}'::text[] where name = 'Groceries';
update topics set keywords = keywords || '{park,parks,trail,playground,hiking,running,cycling,swim}'::text[] where name = 'Sports';
