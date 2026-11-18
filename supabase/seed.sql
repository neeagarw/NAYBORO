-- Nayboro seed data for local development and launch. Runs after migrations (supabase db reset).

-- lat/lng = approximate city centre, used on the device to match a location to the nearest area.
insert into areas (name, state, metro, zips, lat, lng) values
  ('Garland','TX','DFW','{75040,75041,75042,75043,75044}', 32.9126, -96.6389),
  ('Plano','TX','DFW','{75023,75024,75025,75074,75075,75093}', 33.0198, -96.6989),
  ('Richardson','TX','DFW','{75080,75081,75082}', 32.9483, -96.7299),
  ('Frisco','TX','DFW','{75033,75034,75035,75036}', 33.1507, -96.8236),
  ('Irving','TX','DFW','{75038,75039,75060,75061,75062,75063}', 32.8140, -96.9489),
  ('Dallas','TX','DFW','{75201,75204,75206,75214,75219,75225,75230,75240,75248,75252}', 32.7767, -96.7970),
  ('Allen','TX','DFW','{75002,75013}', 33.1032, -96.6706),
  ('McKinney','TX','DFW','{75069,75070,75071,75072}', 33.1972, -96.6398),
  ('Carrollton','TX','DFW','{75006,75007,75010}', 32.9756, -96.8900),
  ('Rowlett','TX','DFW','{75088,75089}', 32.9029, -96.5639);

insert into places (city, region, country) values
  ('Jaipur','Rajasthan','India'),('Jaisalmer','Rajasthan','India'),('Jodhpur','Rajasthan','India'),
  ('Udaipur','Rajasthan','India'),('Bikaner','Rajasthan','India'),('Ajmer','Rajasthan','India'),('Kota','Rajasthan','India'),
  ('Jaigaon','West Bengal','India'),('Kolkata','West Bengal','India'),
  ('Delhi','Delhi','India'),('Mumbai','Maharashtra','India'),('Pune','Maharashtra','India'),('Nagpur','Maharashtra','India'),
  ('Bengaluru','Karnataka','India'),('Mysuru','Karnataka','India'),('Hyderabad','Telangana','India'),('Chennai','Tamil Nadu','India'),
  ('Kochi','Kerala','India'),('Ahmedabad','Gujarat','India'),('Surat','Gujarat','India'),
  ('Lucknow','Uttar Pradesh','India'),('Kanpur','Uttar Pradesh','India'),('Amritsar','Punjab','India'),('Chandigarh','Chandigarh','India'),
  ('Indore','Madhya Pradesh','India'),('Bhopal','Madhya Pradesh','India'),('Patna','Bihar','India'),('Guwahati','Assam','India'),
  ('Bhubaneswar','Odisha','India'),('Kathmandu','Bagmati','Nepal'),('Dhaka','Dhaka','Bangladesh'),('Colombo','Western Province','Sri Lanka'),
  ('Manila','Metro Manila','Philippines'),('Lagos','Lagos','Nigeria'),('Nairobi','Nairobi','Kenya'),('Mexico City','CDMX','Mexico');

insert into interests (label, group_name, sort)
select label, grp, ord from (values
  ('Sport and fitness', array['Tennis','Cricket','Badminton','Pickleball','Running','Yoga','Gym buddies','Cycling','Volleyball','Hiking','Swimming','Table tennis','Football','Basketball']),
  ('Food and drink',    array['Chai meetups','Cooking','Potlucks','Eating out','Baking','Recipe swaps','Coffee']),
  ('Family and home',   array['Playdates','School carpool','Family outings','Parent meetups','Gardening','Pets']),
  ('Culture and hobbies', array['Festivals','Board games','Book club','Music','Photography','Dance','Movies','Travel','Volunteering']),
  ('Life and work',     array['Career chats','Immigration questions','Investing','Startups','Language exchange','Morning walks','Travel buddies'])
) g(grp, items), unnest(items) with ordinality as u(label, ord);
