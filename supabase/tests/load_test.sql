-- LOAD TEST (local only). Fills a test database with one busy metro and times the main screens.
-- Size: psql -v n=20000 (default below)
\if :{?n} \else \set n 20000 \endif
-- 20,000 people, 60,000 interests, 5,000 questions, 20,000 answers, 2,000 chats, 40,000 messages.
-- Run on a database that already has the migrations + seed.sql:
--   psql -d loadtest -f supabase/tests/load_test.sql
\timing off
set session_replication_role = replica;   -- skip spam-limit and alert triggers while filling

insert into auth.users (id) select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, :n) g;
insert into profiles (id, first_name, last_name, area_id, root_level, is_adult, onboarded_at, created_at)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'User' || g, 'Test',
       (select id from areas where metro = '19100' order by weight desc, id offset (g % 40) limit 1),   -- spread across 40 DFW cities
       (array['city','state','country']::root_level[])[1 + g % 3], true, now(), now() - (g % 60) * interval '1 day'
from generate_series(1, :n) g;
insert into profile_roots (profile_id, place_id, position)
select p.id, (select id from places order by id offset (abs(hashtext(p.id::text)) % (select count(*) from places)) limit 1), 1 from profiles p where p.first_name like 'User%';
insert into profile_interests (profile_id, interest_id)
select p.id, i.id from profiles p
cross join lateral (select id from interests order by md5(p.id::text || id::text) limit 3) i where p.first_name like 'User%';

insert into questions (author_id, body, topic, scope, area_id, created_at)
select ('10000000-0000-0000-0000-' || lpad((1 + g % :n)::text, 12, '0'))::uuid, 'Load test question number ' || g,
       'Food', (array['near','metro']::question_scope[])[1 + g % 2], (select id from areas where metro = '19100' order by weight desc, id offset (g % 40) limit 1), now() - g * interval '1 minute'
from generate_series(1, 5000) g;
insert into answers (question_id, author_id, body)
select q.id, ('10000000-0000-0000-0000-' || lpad((1 + (row_number() over ()) % :n)::text, 12, '0'))::uuid, 'Load test answer'
from questions q cross join generate_series(1, 4);

insert into hellos (id, from_id, to_id, message, status)
select gen_random_uuid(), ('10000000-0000-0000-0000-' || lpad((1 + g)::text, 12, '0'))::uuid, '10000000-0000-0000-0000-000000000001', 'hi', 'accepted'
from generate_series(1, 2000) g;
insert into conversations (id, hello_id) select gen_random_uuid(), id from hellos where to_id = '10000000-0000-0000-0000-000000000001';
insert into conversation_members (conversation_id, profile_id)
select c.id, h.from_id from conversations c join hellos h on h.id = c.hello_id
union all select c.id, h.to_id from conversations c join hellos h on h.id = c.hello_id;
insert into messages (conversation_id, sender_id, body, created_at)
select c.id, h.from_id, 'message ' || g, now() - g * interval '1 minute'
from conversations c join hellos h on h.id = c.hello_id cross join generate_series(1, 20) g;

-- One in five people share user #1's hometown (so "your roots, nearby" and the weekly roundup have real work to do),
-- and user #1 has a busy Activity list (5,000 alerts, 1,000 "helpful" votes).
update profile_roots set place_id = (select place_id from profile_roots where profile_id = '10000000-0000-0000-0000-000000000001' and position = 1)
where position = 1 and abs(hashtext(profile_id::text)) % 5 = 0;
insert into notifications (recipient_id, kind, actor_id, ref_id, created_at, sent_at)
select '10000000-0000-0000-0000-000000000001', (array['hello','accepted','answer'])[1 + g % 3],
       ('10000000-0000-0000-0000-' || lpad((2 + g % (:n - 2))::text, 12, '0'))::uuid, null, now() - g * interval '5 minutes', now()
from generate_series(1, 5000) g;
insert into answers (id, question_id, author_id, body)
select gen_random_uuid(), (select id from questions limit 1), '10000000-0000-0000-0000-000000000001', 'Load test helpful answer';
insert into answer_helpful (answer_id, profile_id)
select (select id from answers where body = 'Load test helpful answer'), ('10000000-0000-0000-0000-' || lpad((2 + g)::text, 12, '0'))::uuid
from generate_series(1, 1000) g;

set session_replication_role = origin;
analyze;

-- Time each screen's main query as user #1 (in Garland, 2,000 chats).
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false) \g /dev/null
\timing on
\echo '== People (people_for_me)'
select count(*) from (select * from people_for_me() limit 60) x;
\echo '== Root counts (my_root_counts)'
select * from my_root_counts();
\echo '== Explore (questions_for_me)'
select count(*) from (select * from questions_for_me() limit 30) x;
\echo '== Explore search (questions_for_me with words)'
select count(*) from questions_for_me(null, false, null, 20, 'question number 42');
select count(*) from questions_for_me(null, false, null, 20, 'zzzz nothing');
\echo '== Answers for one page of questions'
select count(*) from answers_for(array(select id from questions_for_me() limit 30));
\echo '== Chats list (my_chats)'
select count(*) from my_chats();
\echo '== Chats badge'
select chats_badge();
\echo '== Activity (activity_for_me)'
select count(*) from activity_for_me();
\echo '== Bell dot (has_new_activity)'
select has_new_activity();
\echo '== Your roots, nearby (roots_nearby)'
select region, total, in_my_city from roots_nearby();
\echo '== Profile card'
select profile_card('10000000-0000-0000-0000-000000000002') is not null;
