\set ON_ERROR_STOP 0
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- users: N=Neeraj, R=Rohit, A=Aman
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333');
insert into profiles (id, first_name, last_name, area_id, root_level, is_adult, onboarded_at) values
 ('11111111-1111-1111-1111-111111111111','Neeraj','Agarwala',1,'city',true,now()),
 ('22222222-2222-2222-2222-222222222222','Rohit','Gupta',3,'state',true,now()),
 ('33333333-3333-3333-3333-333333333333','Aman','Kumar',1,'city',true,now());
insert into profile_roots values ('11111111-1111-1111-1111-111111111111',1,1),('22222222-2222-2222-2222-222222222222',3,1),('33333333-3333-3333-3333-333333333333',10,1);
insert into questions (author_id,is_anonymous,body,topic,area_id) values ('22222222-2222-2222-2222-222222222222',true,'Laid off on H-1B last month. How long to find a sponsor?','Immigration',3);
insert into events (title,starts_at,place_name,area_id,kind,host_name,url) values ('Cricket',now(),'Holford Park',1,'Sports','GWC','https://x'),('Mela',now(),'Frisco',4,'Festival','FCA','https://y');
insert into auth.users select gen_random_uuid() from generate_series(1,5);
insert into profiles (id, first_name, is_adult) select id,'X',true from auth.users where id::text not like '1111%' and id::text not like '2222%' and id::text not like '3333%';
insert into event_interest select (select id from events where title='Cricket'), id from profiles where first_name='X' limit 3;
insert into event_interest select (select id from events where title='Mela'), id from profiles where first_name='X' limit 5;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '1. Neeraj sees others (Rohit chose state level -> Rajasthan, not Jodhpur):'
select display_name, area_name, shown_root from public_profiles order by 1;
\echo '2. Neeraj reads Rohit base profile row (expect 0 rows):'
select count(*) from profiles where id='22222222-2222-2222-2222-222222222222';
\echo '3. Anonymous question as Neeraj (author hidden):'
select author_id, author_name, area_label, is_mine from question_feed;
\echo '4. Event counts (3 -> hidden, 5 -> 5):'
select title, interested_count from event_feed order by title;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '5. Rohit sees own anon question as is_mine:'
select author_name, is_mine from question_feed;
\echo '6. Rohit says hi to Neeraj:'
insert into hellos (from_id,to_id,message) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Up for doubles?');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '7. Neeraj tries to flip hello to accepted directly (expect error / 0 rows):'
update hellos set status='accepted';
\echo '8. Neeraj accepts via accept_hello and sends a message:'
select accept_hello((select id from hellos limit 1)) is not null as conv_created;
insert into messages (conversation_id,sender_id,body) select id,'11111111-1111-1111-1111-111111111111','Saturday 8?' from conversations;
select count(*) as my_msgs from messages;

select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '9. Aman cannot see that chat (expect 0):'
select count(*) from messages;
\echo '10. Aman tries to post into it (expect RLS error):'
insert into messages (conversation_id,sender_id,body) select '00000000-0000-0000-0000-000000000000'::uuid,'33333333-3333-3333-3333-333333333333','hi';

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into blocks values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
\echo '11. After Neeraj blocks Aman: Aman no longer sees Neeraj:'
select display_name from public_profiles order by 1;
\echo '12. Aman tries to say hi to Neeraj (expect RLS error):'
insert into hellos (from_id,to_id,message) values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','hey');
\echo '13. Under-18 cannot finish onboarding (expect check error):'
reset role;
insert into auth.users values ('44444444-4444-4444-4444-444444444444');
insert into profiles (id,first_name,is_adult,onboarded_at) values ('44444444-4444-4444-4444-444444444444','K',false,now());

-- ───────── setup flow (save_profile + photos) ─────────
reset role;
insert into auth.users values ('55555555-5555-5555-5555-555555555555');
set role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
\echo '14. save_profile with only 2 interests (expect error):'
select save_profile('Kavya','Sharma',null,null,4,'city',array[1]::bigint[],array[1,2]::bigint[],true);
\echo '15. save_profile without the 18+ box (expect error):'
select save_profile('Kavya','Sharma',null,null,4,'city',array[1]::bigint[],array[1,2,3]::bigint[],false);
\echo '16. save_profile valid (Jaipur + Kolkata, 3 interests, Frisco):'
select save_profile('Kavya','Sharma','Chai and long walks','55555555-5555-5555-5555-555555555555/a.jpg',4,'city',array[1,9]::bigint[],array[1,2,16]::bigint[],true);
select first_name, onboarded_at is not null as onboarded, (select count(*) from profile_roots) roots, (select count(*) from profile_interests where profile_id=auth.uid()) ints from profiles;
\echo '17. Re-save (edit profile) keeps onboarded and photo, replaces roots:'
select save_profile('Kavya','S',null,null,4,'state',array[1]::bigint[],array[1,2,3,4]::bigint[],true);
select last_name, photo_path, root_level, (select count(*) from profile_roots) roots from profiles;
\echo '18. Photo path in someone else''s folder (expect error):'
select save_profile('Kavya','S',null,'11111111-1111-1111-1111-111111111111/x.jpg',4,'city',array[1]::bigint[],array[1,2,3]::bigint[],true);
\echo '19. Upload into own avatar folder ok, other folder blocked:'
insert into storage.objects (bucket_id,name) values ('avatars','55555555-5555-5555-5555-555555555555/a.jpg');
insert into storage.objects (bucket_id,name) values ('avatars','11111111-1111-1111-1111-111111111111/evil.jpg');
\echo '20. Others see Kavya at state level (Rajasthan):'
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select display_name, area_name, shown_root from public_profiles where display_name like 'Kavya%';
