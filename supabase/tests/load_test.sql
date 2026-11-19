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
       (select id from areas order by id offset (g % (select count(*) from areas)) limit 1),
       (array['city','state','country']::root_level[])[1 + g % 3], true, now(), now() - (g % 60) * interval '1 day'
from generate_series(1, :n) g;
insert into profile_roots (profile_id, place_id, position)
select p.id, (select id from places order by id offset (abs(hashtext(p.id::text)) % (select count(*) from places)) limit 1), 1 from profiles p where p.first_name like 'User%';
insert into profile_interests (profile_id, interest_id)
select p.id, i.id from profiles p
cross join lateral (select id from interests order by md5(p.id::text || id::text) limit 3) i where p.first_name like 'User%';

insert into questions (author_id, body, topic, scope, area_id, created_at)
select ('10000000-0000-0000-0000-' || lpad((1 + g % :n)::text, 12, '0'))::uuid, 'Load test question number ' || g,
       'Food', (array['near','metro']::question_scope[])[1 + g % 2], (select id from areas order by id offset (g % 10) limit 1), now() - g * interval '1 minute'
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
\echo '== Answers for one page of questions'
select count(*) from answers_for(array(select id from questions_for_me() limit 30));
\echo '== Chats list (my_chats)'
select count(*) from my_chats();
\echo '== Chats badge'
select chats_badge();
\echo '== Profile card'
select profile_card('10000000-0000-0000-0000-000000000002') is not null;
