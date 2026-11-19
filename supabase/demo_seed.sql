-- DEMO DATA FOR LOCAL TESTING ONLY. NEVER RUN THIS ON THE REAL (PRODUCTION) DATABASE.
-- Recreates the people, questions, answers and events from design/mockups so screens can be
-- checked against the mockups. Fake people are inserted straight into auth.users, which only
-- works on the local test stub.

create or replace function demo_person(p_id text, p_first text, p_last text, p_city text, p_level root_level,
                                       p_area text, p_intro text, p_interests text[], p_langs text[], p_days_old int default 60)
returns uuid language plpgsql as $$
declare uid uuid := p_id::uuid;
begin
  insert into auth.users values (uid) on conflict do nothing;
  insert into profiles (id, first_name, last_name, intro, area_id, root_level, languages, is_adult, phone_verified, onboarded_at, created_at)
  values (uid, p_first, p_last, p_intro, (select id from areas where name = p_area and state = 'TX'), p_level, p_langs, true, true,
          now() - make_interval(days => p_days_old), now() - make_interval(days => p_days_old))
  on conflict (id) do nothing;
  insert into profile_roots (profile_id, place_id, position)
  values (uid, (select id from places where city = p_city), 1) on conflict do nothing;
  insert into profile_interests (profile_id, interest_id)
  select uid, id from interests where label = any(p_interests) on conflict do nothing;
  return uid;
end $$;

select demo_person('d0000000-0000-0000-0000-000000000001','Rohit','Gupta','Jodhpur','city','Richardson','Weekend tennis at Breckinridge Park, always looking for a doubles partner. Moved from Jodhpur for work and still hunting for the best dal baati in DFW.', array['Tennis','Festivals','Cooking','Board games'], array['Hindi','Marwari','English'], 10);
select demo_person('d0000000-0000-0000-0000-000000000002','Kavya','Sharma','Jaipur','city','Frisco','Chai and long walks, new to Frisco.', array['Chai meetups','Morning walks','Book club'], array['Hindi','English'], 3);
select demo_person('d0000000-0000-0000-0000-000000000003','Aman','Kapoor','Delhi','city','Garland','Firewheel courts most Saturdays.', array['Tennis','Running','Movies'], array['Hindi','Punjabi','English']);
select demo_person('d0000000-0000-0000-0000-000000000004','Simran','Kaur','Amritsar','state','Plano','Up for potlucks and recipe swaps.', array['Cooking','Potlucks','Recipe swaps'], array['Punjabi','Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000005','Ananya','Rathore','Udaipur','state','Frisco','Badminton on weekday evenings.', array['Badminton','Festivals'], array['Hindi','English'], 2);
select demo_person('d0000000-0000-0000-0000-000000000006','Arjun','Mehta','Jaipur','city','Irving','New in Irving, looking for a cricket team.', array['Cricket','Career chats'], array['Hindi','English'], 4);
select demo_person('d0000000-0000-0000-0000-000000000007','Nisha','Tiwari','Jaipur','city','Allen','Tennis and travel.', array['Tennis','Travel'], array['Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000008','Vikram','Bishnoi','Bikaner','city','Garland','Sunday cricket at Holford Park.', array['Cricket','Investing'], array['Hindi','Marwari','English']);
select demo_person('d0000000-0000-0000-0000-000000000009','Priya','Sathe','Pune','city','Garland','We have a Saturday cricket group in Garland.', array['Cricket','Music'], array['Marathi','Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000010','Nidhi','Jain','Indore','city','Garland','Ask me about groceries in Garland.', array['Cooking','Gardening'], array['Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000011','Meera','Patil','Pune','city','Plano','Farmers markets and photography.', array['Photography','Eating out'], array['Marathi','English']);
select demo_person('d0000000-0000-0000-0000-000000000012','Sneha','Desai','Ahmedabad','city','Plano','Cooking for a family of four.', array['Cooking','Playdates'], array['Gujarati','English']);
select demo_person('d0000000-0000-0000-0000-000000000013','Ravi','Thakur','Lucknow','city','Garland','Moving apartments in January.', array['Running','Movies'], array['Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000014','Deepak','Saini','Jaipur','city','Plano','Weekend hikes.', array['Hiking','Cricket'], array['Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000015','Pooja','Agarwal','Jaipur','city','Richardson','Book club and chai.', array['Book club','Chai meetups'], array['Hindi','English']);
select demo_person('d0000000-0000-0000-0000-000000000016','Rahul','Khandelwal','Jaipur','city','Dallas','Startups and coffee.', array['Startups','Coffee'], array['Hindi','English']);

-- Questions (dates relative to now so the feed reads like the mockup)
create or replace function demo_q(p_author text, p_anon boolean, p_topic text, p_body text, p_hours int, p_scope question_scope default 'near')
returns uuid language plpgsql as $$
declare qid uuid;
begin
  insert into questions (author_id, is_anonymous, body, topic, scope, created_at)
  values (p_author::uuid, p_anon, p_body, p_topic, p_scope, now() - make_interval(hours => p_hours)) returning id into qid;
  return qid;
end $$;

create or replace function demo_a(p_q uuid, p_author text, p_body text, p_helpful int) returns void language plpgsql as $$
declare aid uuid;
begin
  insert into answers (question_id, author_id, body) values (p_q, p_author::uuid, p_body) returning id into aid;
  insert into answer_helpful (answer_id, profile_id)
  select aid, id from profiles where id <> p_author::uuid order by id limit p_helpful;
end $$;

do $$
declare q uuid;
begin
  q := demo_q('d0000000-0000-0000-0000-000000000012', false, 'Groceries', 'Where can I get fresh methi and curry leaves near Garland?', 2, 'metro');
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000010', 'The Indian grocery on Belt Line gets deliveries Tuesday and Friday. Go in the morning.', 6);
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000011', 'The farmers market on Saturdays sometimes has curry leaf plants too.', 2);
  q := demo_q('d0000000-0000-0000-0000-000000000006', false, 'Immigration', 'OCI renewal: did you go through the outsourcing centre or mail it in? Which was smoother?', 3, 'metro');
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000002', 'Mailed mine last spring. Check the photo size twice, that is what got my first try sent back.', 11);
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000013', 'Mail was fine for us too. Keep copies of everything you send.', 4);
  q := demo_q('d0000000-0000-0000-0000-000000000013', true, 'Immigration', 'Laid off on H-1B last month. How long did it take others to find a new sponsor?', 4);
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000008', 'Took me about seven weeks. Updating LinkedIn and asking former colleagues for referrals helped most.', 15);
  q := demo_q('d0000000-0000-0000-0000-000000000001', false, 'Schools', 'Which Richardson elementary schools have good ESL support?', 26, 'metro');
  q := demo_q('d0000000-0000-0000-0000-000000000004', false, 'Travel', 'Anyone flying DFW to Delhi around Dec 20? My parents are travelling alone and would love company.', 5, 'metro');
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000003', 'We are on the Dec 21 flight. Happy to help them at the airport if dates work.', 3);
  q := demo_q('d0000000-0000-0000-0000-000000000011', false, 'Food', 'Any good tiffin service in Plano?', 28, 'metro');
  q := demo_q('d0000000-0000-0000-0000-000000000008', false, 'Sports', 'Sunday cricket at Holford Park needs 2 more players. Any takers?', 30);
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000006', 'Count me in! What time do you start?', 2);
  q := demo_q('d0000000-0000-0000-0000-000000000016', true, 'Life here', 'First winter here and finding it hard to make friends. How did you meet people?', 32, 'metro');
  q := demo_q('d0000000-0000-0000-0000-000000000013', false, 'Housing', 'Family-friendly apartments near Firewheel? Moving in January.', 50);
  q := demo_q('d0000000-0000-0000-0000-000000000009', false, 'Food', 'Where do you get fresh jalebi on weekends?', 75);
  perform demo_a(q, 'd0000000-0000-0000-0000-000000000004', 'The sweet shop next to the Plano temple makes them fresh on Saturday mornings.', 8);
end $$;

-- Events: next Saturday onwards, Central time.
do $$
declare sat date := (current_date + ((6 - extract(dow from current_date)::int + 7) % 7))::date;
begin
  if sat = current_date then sat := sat + 7; end if;
  insert into events (title, starts_at, ends_at, place_name, area_id, price_label, kind, host_name, url) values
  ('Saturday morning cricket meetup', (sat + time '08:00') at time zone 'America/Chicago', (sat + time '11:00') at time zone 'America/Chicago', 'Holford Park, Garland', (select id from areas where name='Garland' and state='TX'), 'Free', 'Sports', 'Garland Weekend Cricket', 'https://example.com/cricket'),
  ('Rajasthani food pop-up', (sat + time '12:00') at time zone 'America/Chicago', (sat + time '16:00') at time zone 'America/Chicago', 'Richardson', (select id from areas where name='Richardson' and state='TX'), '$15', 'Food', 'DFW Desi Kitchens', 'https://example.com/popup'),
  ('Family craft afternoon', (sat + 1 + time '14:00') at time zone 'America/Chicago', (sat + 1 + time '16:00') at time zone 'America/Chicago', 'Plano', (select id from areas where name='Plano' and state='TX'), 'Free', 'Family', 'Plano Community Library', 'https://example.com/craft'),
  ('Newcomers potluck', (sat + 5 + time '13:00') at time zone 'America/Chicago', null, 'Irving', (select id from areas where name='Irving' and state='TX'), 'Free', 'Food', 'Irving Newcomers Circle', 'https://example.com/potluck'),
  ('Winter Mela', (sat + 14 + time '17:00') at time zone 'America/Chicago', (sat + 14 + time '22:00') at time zone 'America/Chicago', 'Frisco', (select id from areas where name='Frisco' and state='TX'), '$10', 'Festival', 'Frisco Cultural Association', 'https://example.com/mela'),
  ('Badminton doubles social', (sat + 15 + time '09:00') at time zone 'America/Chicago', null, 'Plano', (select id from areas where name='Plano' and state='TX'), 'Free', 'Sports', 'Plano Shuttle Club', 'https://example.com/badminton');
  -- 3 interested in cricket (shown as "Be one of the first"), 12 in the pop-up.
  insert into event_interest (event_id, profile_id)
  select e.id, p.id from events e, profiles p where e.title = 'Saturday morning cricket meetup' and p.first_name in ('Vikram','Arjun','Priya');
  insert into event_interest (event_id, profile_id)
  select e.id, p.id from events e, profiles p where e.title = 'Rajasthani food pop-up' and p.id::text like 'd0000000%' and p.first_name not in ('Rohit','Meera','Sneha','Ravi');
  insert into event_interest (event_id, profile_id)
  select e.id, p.id from events e, profiles p where e.title = 'Rajasthani food pop-up' and p.first_name = 'Rohit';
end $$;

-- Gives a newly set-up test user the mockup's starting state: 3 hellos waiting,
-- a chat with Aman, a past chat with Rohit, and a hello sent to Ananya.
create or replace function demo_welcome(me uuid) returns void language plpgsql as $$
declare conv uuid; h uuid;
begin
  insert into hellos (from_id, to_id, message, created_at) values
    ('d0000000-0000-0000-0000-000000000008', me, 'Need one more for Sunday cricket. You in?', now() - interval '5 minutes'),
    ('d0000000-0000-0000-0000-000000000002', me, 'Hi! Fellow Jaipur person in Frisco. Chai sometime?', now() - interval '1 hour'),
    ('d0000000-0000-0000-0000-000000000009', me, 'Saw your cricket interest. We have a Saturday group in Garland.', now() - interval '3 hours');
  insert into hellos (from_id, to_id, message) values (me, 'd0000000-0000-0000-0000-000000000005', 'Hi! Up for badminton sometime?');

  insert into hellos (from_id, to_id, message, status, responded_at) values ('d0000000-0000-0000-0000-000000000003', me, 'Hey! Another tennis player in Garland?', 'accepted', now()) returning id into h;
  insert into conversations (hello_id) values (h) returning id into conv;
  insert into conversation_members (conversation_id, profile_id, last_read_at) values (conv, me, now() - interval '2 hours'), (conv, 'd0000000-0000-0000-0000-000000000003', now());
  insert into messages (conversation_id, sender_id, body, created_at) values
    (conv, 'd0000000-0000-0000-0000-000000000003', 'Hey! Good to meet another tennis player in Garland.', now() - interval '3 hours'),
    (conv, me, 'Likewise! I usually play weekend mornings.', now() - interval '150 minutes'),
    (conv, 'd0000000-0000-0000-0000-000000000003', 'The Firewheel courts are usually free early. Tennis next Saturday at 8?', now() - interval '20 minutes');
end $$;
