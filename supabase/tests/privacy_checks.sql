\set ON_ERROR_STOP 0
-- Look cities up by name and state (never by id: ids depend on load order).
select id as garland    from areas where name = 'Garland'    and state = 'TX' \gset
select id as richardson from areas where name = 'Richardson' and state = 'TX' \gset
select id as frisco     from areas where name = 'Frisco'     and state = 'TX' \gset
-- users: N=Neeraj, R=Rohit, A=Aman
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333');
insert into profiles (id, first_name, last_name, area_id, root_level, is_adult, onboarded_at) values
 ('11111111-1111-1111-1111-111111111111','Neeraj','Agarwala',:garland,'city',true,now()),
 ('22222222-2222-2222-2222-222222222222','Rohit','Gupta',:richardson,'state',true,now()),
 ('33333333-3333-3333-3333-333333333333','Aman','Kumar',:garland,'city',true,now());
insert into profile_roots values ('11111111-1111-1111-1111-111111111111',1,1),('22222222-2222-2222-2222-222222222222',3,1),('33333333-3333-3333-3333-333333333333',10,1);
insert into questions (author_id,is_anonymous,body,topic,area_id) values ('22222222-2222-2222-2222-222222222222',true,'Laid off on H-1B last month. How long to find a sponsor?','Immigration',:richardson);
insert into events (title,starts_at,place_name,area_id,kind,host_name,url) values ('Cricket',now(),'Holford Park',:garland,'Sports','GWC','https://x'),('Mela',now(),'Frisco',:frisco,'Festival','FCA','https://y');
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
select author_id, author_name, area_label, is_mine from questions_for_me();
\echo '4. Event counts (3 -> hidden, 5 -> 5):'
select title, interested_count from event_feed order by title;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\echo '5. Rohit sees own anon question as is_mine:'
select author_name, is_mine from questions_for_me();
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
select save_profile('Kavya','Sharma',null,null,:frisco,'city',array[1]::bigint[],array[1,2]::bigint[],true);
\echo '15. save_profile without the 18+ box (expect error):'
select save_profile('Kavya','Sharma',null,null,:frisco,'city',array[1]::bigint[],array[1,2,3]::bigint[],false);
\echo '16. save_profile valid (Jaipur + Kolkata, 3 interests, Frisco):'
select save_profile('Kavya','Sharma','Chai and long walks','55555555-5555-5555-5555-555555555555/a.jpg',:frisco,'city',array[1,9]::bigint[],array[1,2,16]::bigint[],true);
select first_name, onboarded_at is not null as onboarded, (select count(*) from profile_roots) roots, (select count(*) from profile_interests where profile_id=auth.uid()) ints from profiles;
\echo '17. Re-save (edit profile) keeps onboarded and photo, replaces roots:'
select save_profile('Kavya','S',null,null,:frisco,'state',array[1]::bigint[],array[1,2,3,4]::bigint[],true);
select last_name, photo_path, root_level, (select count(*) from profile_roots) roots from profiles;
\echo '18. Photo path in someone else''s folder (expect error):'
select save_profile('Kavya','S',null,'11111111-1111-1111-1111-111111111111/x.jpg',:frisco,'city',array[1]::bigint[],array[1,2,3]::bigint[],true);
\echo '19. Upload into own avatar folder ok, other folder blocked:'
insert into storage.objects (bucket_id,name) values ('avatars','55555555-5555-5555-5555-555555555555/a.jpg');
insert into storage.objects (bucket_id,name) values ('avatars','11111111-1111-1111-1111-111111111111/evil.jpg');
\echo '20. Others see Kavya at state level (Rajasthan):'
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select display_name, area_name, shown_root from public_profiles where display_name like 'Kavya%';

-- ───────── screens (People, Explore, Chats) ─────────
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '21. Neeraj''s People list: Kavya (state level) shows as Rajasthan; Aman (blocked) and Rohit (already chatting) absent:'
select display_name, shown_root, roots_match from people_for_me() order by 1;
\echo '22. Root counts under 5 are hidden (expect nulls):'
select city, city_count, region, region_count from my_root_counts();
\echo '23. Anonymous author stays hidden in questions_for_me:'
select author_id is null as hidden, author_name from questions_for_me() where is_anonymous;
\echo '24. Rohit cannot see Neeraj''s chats (expect 0) and cannot mark them read:'
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) from my_chats() where display_name = 'Aman K.';
\echo '25. Profile card of a blocked person is null (Aman looking at Neeraj):'
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select profile_card('11111111-1111-1111-1111-111111111111') is null as hidden;
\echo '26. Hello rate limit: 21st hello in a day is refused (expect error on the last insert):'
reset role;
insert into auth.users select ('aaaaaaaa-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1,21) g;
insert into profiles (id, first_name, is_adult) select ('aaaaaaaa-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'T', true from generate_series(1,21) g;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into hellos (from_id, to_id, message) select '22222222-2222-2222-2222-222222222222', ('aaaaaaaa-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'hi there' from generate_series(1,19) g;
insert into hellos (from_id, to_id, message) values ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000020','hi there');

-- ───────── before beta: admin, suspensions, limits, email queue ─────────
reset role;
update auth.users set email = 'neeraj@example.com' where id = '11111111-1111-1111-1111-111111111111';
update auth.users set email = 'rohit@example.com'  where id = '22222222-2222-2222-2222-222222222222';
update auth.users set email = 'kavya@example.com'  where id = '55555555-5555-5555-5555-555555555555';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
\echo '27. Non-admin cannot read reports (expect error: not allowed):'
select * from admin_reports();
\echo '28. Signed-in users cannot claim email alerts (expect permission denied):'
select * from claim_notifications(10);
\echo '29. Saying hi queues an email alert for the receiver (Rohit -> Kavya):'
reset role; update notifications set sent_at = now() where sent_at is null; set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
delete from hellos where from_id = '22222222-2222-2222-2222-222222222222' and to_id::text like 'aaaaaaaa%';
reset role;
delete from hellos where from_id = '22222222-2222-2222-2222-222222222222' and to_id::text like 'aaaaaaaa%';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into hellos (from_id, to_id, message) values ('22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','Hi Kavya!');
reset role;
select kind, recipient_id = '55555555-5555-5555-5555-555555555555' as to_kavya from notifications where sent_at is null;
\echo '30. Server claims it once: email, names and message (second claim returns nothing):'
set role service_role;
select email, first_name, kind, actor_name, detail, link_path from claim_notifications(10);
select count(*) as second_claim from claim_notifications(10);
\echo '31. Alerts off = no email:'
reset role;
update profiles set email_alerts = false where id = '55555555-5555-5555-5555-555555555555';
insert into notifications (recipient_id, kind, actor_id) values ('55555555-5555-5555-5555-555555555555','hello','22222222-2222-2222-2222-222222222222');
set role service_role;
select count(*) as emails from claim_notifications(10);
\echo '32. Admin suspends Kavya after a report: she disappears for others and cannot post:'
reset role;
insert into admins values ('11111111-1111-1111-1111-111111111111');
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into reports (reporter_id, target_type, target_id, reason) values ('22222222-2222-2222-2222-222222222222','profile','55555555-5555-5555-5555-555555555555','Fake profile');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select target_type, report_count, reasons, owner_name from admin_reports();
select admin_resolve('profile','55555555-5555-5555-5555-555555555555','suspend');
select count(*) as open_reports from admin_reports();
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) as kavya_visible from public_profiles where id = '55555555-5555-5555-5555-555555555555';
select set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',false);
insert into questions (author_id, body) values ('55555555-5555-5555-5555-555555555555','Is anyone around for chai?');
\echo '33. Question limit: 6th question in a day is refused (expect error on the last insert):'
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into questions (author_id, body) select '11111111-1111-1111-1111-111111111111', 'Question number ' || g || ' about life here' from generate_series(1,5) g;
insert into questions (author_id, body) values ('11111111-1111-1111-1111-111111111111','One more question about life here');
\echo '34. Admin cannot suspend another admin (expect error):'
select admin_resolve('profile','11111111-1111-1111-1111-111111111111','suspend');
\echo '35. Posting an answer works and alerts the asker (regression check for the alert trigger):'
reset role;
update notifications set sent_at = now() where sent_at is null;
select id as rohit_q from questions where author_id = '22222222-2222-2222-2222-222222222222' limit 1 \gset
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into answers (question_id, author_id, body) values (:'rohit_q', '11111111-1111-1111-1111-111111111111', 'Try the Saturday market.');
reset role;
select kind, recipient_id = '22222222-2222-2222-2222-222222222222' as to_rohit from notifications where sent_at is null;
\echo '36. Limits come from the rate_limits table (lower to 1, second answer refused):'
reset role;
update rate_limits set max_count = 1 where table_name = 'answers';
delete from answers where author_id = '22222222-2222-2222-2222-222222222222';
select id as any_q from questions limit 1 \gset
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into answers (question_id, author_id, body) values (:'any_q', '22222222-2222-2222-2222-222222222222', 'First answer ok');
insert into answers (question_id, author_id, body) values (:'any_q', '22222222-2222-2222-2222-222222222222', 'Second answer refused');
reset role; update rate_limits set max_count = 30 where table_name = 'answers';
\echo '37. Topics come from the topics table (unknown topic refused):'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
insert into questions (author_id, body, topic) values ('22222222-2222-2222-2222-222222222222', 'A question with a made-up topic', 'Crypto');
\echo '38. say_hi: second hello to the same person refused; after "Not now" + retry window it works again:'
reset role;
delete from hellos where to_id = '33333333-3333-3333-3333-333333333333' or from_id = '33333333-3333-3333-3333-333333333333';
delete from blocks;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select say_hi('33333333-3333-3333-3333-333333333333', 'Hi Aman!');
select say_hi('33333333-3333-3333-3333-333333333333', 'Hi again!');
reset role;
update hellos set status = 'not_now', responded_at = now() - interval '31 days' where to_id = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select say_hi('33333333-3333-3333-3333-333333333333', 'Trying again a month later');
reset role;
select status, message from hellos where to_id = '33333333-3333-3333-3333-333333333333';
\echo '39. app_config gives the app its metro, time zone, topics and verbs (no hard-coding):'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select app_config() -> 'metro' ->> 'timezone' as tz, jsonb_array_length(app_config() -> 'topics') as topics, app_config() -> 'verbs' ->> 'Tennis' as tennis;

\echo '40. Find my city: Fremont CA position -> Fremont, San Francisco Bay Area (nothing stored):'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select name, state, metro_name from locate_area(37.5485, -121.9886);
\echo '41. Other places: San Jose, Mesquite TX, Austin, Marfa (rural), and the middle of the ocean (no city):'
select name, state, metro_name from locate_area(37.3382, -121.8863)
union all select name, state, metro_name from locate_area(32.7668, -96.5992)
union all select name, state, metro_name from locate_area(30.2672, -97.7431)
union all select name, state, metro_name from locate_area(30.3094, -104.0206);
select count(*) as ocean_hits from locate_area(30.0, -140.0);
\echo '42. Typed search: "Frem" and ZIP "75040":'
select name, state, metro_name from search_areas('Frem', 3);
select name, state, metro_name, zip from search_areas('75040');

-- ───────── waitlist + launch switch ─────────
reset role;
\echo '43. Site starts in waitlist mode; a normal user cannot enter, an admin can:'
select site_mode();
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select can_enter() as rohit_can_enter;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select can_enter() as neeraj_admin_can_enter;
\echo '44. Visitors (anon) cannot join the list directly (error) or read it (0 rows):'
set role anon;
select * from join_waitlist('x@example.com', 'Jaipur', null, null, null, null);
select count(*) from waitlist;
\echo '45. Server joins: new sign-up, same email again (already = true, same code), referral recorded:'
reset role;
select id as fremont from areas where name = 'Fremont' and state = 'CA' \gset
set role service_role;
select ref_code as code1, city, metro_name, people_in_metro, already from join_waitlist('Maya@Example.com', 'Pune', null, :fremont, null, 'iphash1') \gset
select :'city' as city, :'metro_name' as metro, :'already' as already;
select ref_code = :'code1' as same_code, already from join_waitlist('maya@example.com', 'Pune', null, :fremont, null, 'iphash1');
select already from join_waitlist('ravi@example.com', 'Delhi', null, :fremont, :'code1', 'iphash1');
reset role;
select email, referred_by = :'code1' as referred from waitlist where email = 'ravi@example.com';
\echo '46. Spam limit: 5 sign-ups per network per hour (6th refused):'
set role service_role;
select already from join_waitlist('a3@example.com', null, null, null, null, 'iphash1');
select already from join_waitlist('a4@example.com', null, null, null, null, 'iphash1');
select already from join_waitlist('a5@example.com', null, null, null, null, 'iphash1');
select already from join_waitlist('a6@example.com', null, null, null, null, 'iphash1');
\echo '47. Admin adds Rohit as beta tester, then opens the site:'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select admin_add_beta('ROHIT@example.com');
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select can_enter() as rohit_beta_can_enter;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select (admin_waitlist() ->> 'total')::int as total, admin_waitlist() -> 'beta' as beta;
select admin_set_site_mode('open');
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select can_enter() as anyone_can_enter_when_open;
\echo '48. Setup prefill: Rohit sees only his own waitlist city and hometown; someone else sees nothing:'
reset role;
set role service_role;
select already from join_waitlist('rohit@example.com', 'Jaipur', null, :fremont, null, 'iphash9');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select area_name, area_state from my_waitlist_prefill();
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select count(*) as other_person_rows from my_waitlist_prefill();
reset role;
\echo '49. Beta sign-in tries are hidden from signed-in users (expect: permission denied):'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
\set ON_ERROR_STOP 0
select count(*) from beta_login_attempts;
\set ON_ERROR_STOP 1
reset role;
\echo '50. Interest sentences read naturally (expect: Plays tennis | Goes running | Does yoga | Into book club):'
select interest_phrase('Tennis') || ' | ' || interest_phrase('Running') || ' | ' || interest_phrase('Yoga') || ' | ' || interest_phrase('Book club');
\echo '51. Delete my account removes only the caller (expect: temp gone = t, others untouched = t; anon refused):'
reset role;
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'temp-delete@example.com');
insert into waitlist (email) values ('temp-delete@example.com');
select count(*) as people_before from auth.users \gset
set role authenticated;
select set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',false);
select delete_my_account();
reset role;
select not exists (select 1 from auth.users where email = 'temp-delete@example.com')
   and not exists (select 1 from waitlist where email = 'temp-delete@example.com') as temp_gone,
       (select count(*) from auth.users) = :people_before - 1 as others_untouched;
set role anon;
\set ON_ERROR_STOP 0
select delete_my_account();
\set ON_ERROR_STOP 1
reset role;
\echo '52. A neighbourhood or PIN finds only its city, never a finer place (expect: Salt Lake|Kolkata, 700091|Kolkata; then permission denied):'
set role anon;
select via || '|' || city from search_places('Salt Lake', 1);
select via || '|' || city from search_places('700091', 1);
\set ON_ERROR_STOP 0
select count(*) from search_places_core('salt', null, 5);
\set ON_ERROR_STOP 1
reset role;
\echo '53. "Your roots, nearby" stays hidden below 5 people (Neeraj, expect 0 rows):'
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select count(*) from roots_nearby();
\echo '54. Activity says "new people from home" without a number below 5 (Rohit moved into Neeraj''s home state; expect: new_people | t | null):'
reset role;
update profile_roots set place_id = (select p2.id from places p1 join places p2 on p2.region = p1.region and p2.country = p1.country and p2.id <> p1.id
  where p1.id = (select place_id from profile_roots where profile_id = '11111111-1111-1111-1111-111111111111' and position = 1) limit 1)
where profile_id = '22222222-2222-2222-2222-222222222222' and position = 1;
set role authenticated;
select kind, detail = (select pl.region from profile_roots r join places pl on pl.id = r.place_id where r.profile_id = auth.uid() and r.position = 1) as my_state, n
from activity_for_me() where kind = 'new_people';
\echo '55. A blocked person never shows in Activity (Aman, expect 0):'
select count(*) from activity_for_me() where actor_id = '33333333-3333-3333-3333-333333333333';
\echo '56. The weekly email list is server-only (expect permission denied):'
\set ON_ERROR_STOP 0
select count(*) from claim_weekly_digest(10);
\set ON_ERROR_STOP 1
reset role;
\echo '57. Switching off "Answers to my questions" stops those emails (expect 0):'
update profiles set alert_answers = false where id = '11111111-1111-1111-1111-111111111111';
insert into notifications (recipient_id, kind, actor_id, ref_id) values ('11111111-1111-1111-1111-111111111111', 'answer', '22222222-2222-2222-2222-222222222222', null);
select count(*) from claim_notifications(100) where recipient_id = '11111111-1111-1111-1111-111111111111' and kind = 'answer';
update profiles set alert_answers = true where id = '11111111-1111-1111-1111-111111111111';
