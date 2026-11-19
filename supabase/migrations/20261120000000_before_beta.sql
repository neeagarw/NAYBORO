-- Before beta: spam limits, suspensions, admin tools, email alert queue.

-- ───────── 1. Spam limits + suspended accounts can't post ─────────
alter table profiles add column suspended_at timestamptz;
alter table profiles add column email_alerts boolean not null default true;

-- Generic guard for inserts. Arguments: actor column, max rows, window, friendly message.
create or replace function guard_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  n bigint;
begin
  if exists (select 1 from profiles where id = actor and suspended_at is not null) then
    raise exception 'Your account is paused. Contact us if you think this is a mistake.';
  end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval',
                 tg_table_schema, tg_table_name, tg_argv[0])
    into n using actor, tg_argv[2];
  if n >= tg_argv[1]::int then raise exception '%', tg_argv[3]; end if;
  return new;
end;
$$;

drop trigger if exists hello_rate_limit on hellos;
create trigger guard_hellos    before insert on hellos           for each row execute function guard_write('from_id', '20', '1 day', 'You have said hi to a lot of people today. Try again tomorrow.');
create trigger guard_questions before insert on questions        for each row execute function guard_write('author_id', '5', '1 day', 'You have asked 5 questions today. Try again tomorrow.');
create trigger guard_answers   before insert on answers          for each row execute function guard_write('author_id', '30', '1 day', 'You have posted a lot of answers today. Try again tomorrow.');
create trigger guard_messages  before insert on messages         for each row execute function guard_write('sender_id', '60', '10 minutes', 'You are sending messages very fast. Wait a few minutes.');
create trigger guard_reports   before insert on reports          for each row execute function guard_write('reporter_id', '20', '1 day', 'You have sent a lot of reports today. Our team is on it.');
create trigger guard_contact   before insert on contact_messages for each row execute function guard_write('profile_id', '5', '1 day', 'You have sent 5 messages today. We will reply soon.');

-- Suspended people disappear from everyone's view (same columns, extra condition).
create or replace view public_profiles with (security_barrier) as
select
  p.id,
  p.first_name || coalesce(' ' || upper(left(p.last_name, 1)) || '.', '') as display_name,
  p.photo_path,
  p.intro,
  p.languages,
  p.phone_verified,
  p.created_at > now() - interval '14 days' as is_new,
  a.name  as area_name,
  a.metro as metro,
  case p.root_level when 'city' then pl.city when 'state' then pl.region else pl.country end as shown_root,
  p.root_level,
  case when p.root_level in ('city','state') then pl.region end as shown_region
from profiles p
left join areas a on a.id = p.area_id
left join profile_roots r on r.profile_id = p.id and r.position = 1
left join places pl on pl.id = r.place_id
where p.onboarded_at is not null
  and (p.suspended_at is null or p.id = auth.uid())
  and auth.uid() is not null
  and not is_blocked(auth.uid(), p.id);

-- ───────── 2. Admins ─────────
-- Add yourself after launch:  insert into admins values ('<your profile id>');
create table admins (profile_id uuid primary key references profiles on delete cascade);
alter table admins enable row level security;   -- no policies: only these functions read it

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where profile_id = auth.uid());
$$;

create or replace function assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
end;
$$;

alter table contact_messages add column handled_at timestamptz;

-- Open reports grouped by what was reported, most-reported first.
create or replace function admin_reports()
returns table (target_type report_target, target_id uuid, report_count bigint, reasons text[], first_reported timestamptz,
               owner_id uuid, owner_name text, owner_suspended boolean, content text, hidden boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query
  select r.target_type, r.target_id, count(*), array_agg(distinct r.reason), min(r.created_at),
         o.id, o.first_name || coalesce(' ' || o.last_name, ''), o.suspended_at is not null,
         case r.target_type
           when 'profile'  then coalesce(o.intro, '(no intro)')
           when 'question' then (select q.body from questions q where q.id = r.target_id)
           when 'answer'   then (select a.body from answers a where a.id = r.target_id)
           when 'message'  then (select m.body from messages m where m.id = r.target_id) end,
         case r.target_type
           when 'question' then (select q.hidden from questions q where q.id = r.target_id)
           when 'answer'   then (select a.hidden from answers a where a.id = r.target_id) end
  from reports r
  left join lateral (
    select p.* from profiles p where p.id = case r.target_type
      when 'profile'  then r.target_id
      when 'question' then (select q.author_id from questions q where q.id = r.target_id)
      when 'answer'   then (select a.author_id from answers a where a.id = r.target_id)
      when 'message'  then (select m.sender_id from messages m where m.id = r.target_id) end
  ) o on true
  where r.status = 'open'
  group by r.target_type, r.target_id, o.id, o.first_name, o.last_name, o.suspended_at, o.intro
  order by count(*) desc, min(r.created_at);
end;
$$;

-- action: 'dismiss' | 'hide' (question/answer) | 'suspend' (the owner)
create or replace function admin_resolve(p_type report_target, p_target uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  perform assert_admin();
  if p_action = 'hide' then
    if p_type = 'question' then update questions set hidden = true where id = p_target;
    elsif p_type = 'answer' then update answers set hidden = true where id = p_target;
    else raise exception 'only questions and answers can be hidden'; end if;
  elsif p_action = 'suspend' then
    owner := case p_type
      when 'profile'  then p_target
      when 'question' then (select author_id from questions where id = p_target)
      when 'answer'   then (select author_id from answers where id = p_target)
      when 'message'  then (select sender_id from messages where id = p_target) end;
    if owner in (select profile_id from admins) then raise exception 'cannot suspend an admin'; end if;
    update profiles set suspended_at = now() where id = owner;
  elsif p_action <> 'dismiss' then raise exception 'unknown action';
  end if;
  update reports set status = case when p_action = 'dismiss' then 'dismissed'::report_status else 'actioned'::report_status end
  where target_type = p_type and target_id = p_target and status = 'open';
end;
$$;

create or replace function admin_suspended()
returns table (id uuid, name text, suspended_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query select p.id, p.first_name || coalesce(' ' || p.last_name, ''), p.suspended_at
  from profiles p where p.suspended_at is not null order by p.suspended_at desc;
end;
$$;

create or replace function admin_unsuspend(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update profiles set suspended_at = null where id = p;
end;
$$;

create or replace function admin_contact_messages()
returns table (id uuid, topic contact_topic, body text, reply_email text, name text, created_at timestamptz, handled_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query select c.id, c.topic, c.body, c.reply_email, p.first_name || coalesce(' ' || p.last_name, ''), c.created_at, c.handled_at
  from contact_messages c left join profiles p on p.id = c.profile_id
  order by c.handled_at is not null, c.created_at desc limit 200;
end;
$$;

create or replace function admin_mark_handled(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update contact_messages set handled_at = now() where id = p;
end;
$$;

create or replace function admin_add_event(p_title text, p_starts timestamptz, p_ends timestamptz, p_place text, p_area bigint,
                                           p_price text, p_kind text, p_host text, p_url text) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  perform assert_admin();
  if p_url !~* '^https?://' then raise exception 'link must start with http:// or https://'; end if;
  insert into events (title, starts_at, ends_at, place_name, area_id, price_label, kind, host_name, url)
  values (btrim(p_title), p_starts, p_ends, btrim(p_place), p_area, coalesce(nullif(btrim(p_price), ''), 'Free'), p_kind, btrim(p_host), btrim(p_url))
  returning id into eid;
  return eid;
end;
$$;

create or replace function admin_delete_event(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  delete from events where id = p;
end;
$$;

-- ───────── 3. Email alert queue ─────────
-- Triggers add a row; /api/notifications/dispatch (called by a Supabase webhook) sends the emails.
create table notifications (
  id            bigint generated always as identity primary key,
  recipient_id  uuid not null references profiles on delete cascade,
  kind          text not null check (kind in ('hello', 'accepted', 'answer')),
  actor_id      uuid references profiles on delete cascade,
  ref_id        uuid,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index on notifications (sent_at) where sent_at is null;
alter table notifications enable row level security;   -- no policies: only the server reads it

create or replace function queue_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Nested IFs on purpose: PL/pgSQL may evaluate new.status even on the answers table
  -- (which has no status column) if it sits in one AND chain.
  if tg_table_name = 'hellos' then
    if tg_op = 'INSERT' then
      insert into notifications (recipient_id, kind, actor_id, ref_id) values (new.to_id, 'hello', new.from_id, new.id);
    elsif new.status = 'accepted' and old.status <> 'accepted' then
      insert into notifications (recipient_id, kind, actor_id, ref_id) values (new.from_id, 'accepted', new.to_id, new.id);
    end if;
  elsif tg_table_name = 'answers' then
    insert into notifications (recipient_id, kind, actor_id, ref_id)
    select q.author_id, 'answer', new.author_id, q.id from questions q
    where q.id = new.question_id and q.author_id <> new.author_id;
  end if;
  return new;
end;
$$;
create trigger notify_hello_insert after insert on hellos for each row execute function queue_notification();
create trigger notify_hello_accept after update of status on hellos for each row execute function queue_notification();
create trigger notify_answer       after insert on answers for each row execute function queue_notification();

-- Takes the unsent alerts (marks them sent) and returns what the email needs.
-- Skips people who turned alerts off, suspended senders, and blocked pairs.
-- Only the server (service role) may call it.
create or replace function claim_notifications(p_limit int default 100)
returns table (id bigint, recipient_id uuid, email text, first_name text, kind text,
               actor_name text, detail text, link_path text)
language plpgsql security definer set search_path = public, auth as $$
begin
  return query
  with picked as (
    update notifications n set sent_at = now()
    where n.id in (select x.id from notifications x where x.sent_at is null
                   and x.created_at > now() - interval '2 days' order by x.id limit p_limit for update skip locked)
    returning n.*
  )
  select p.id, p.recipient_id, u.email::text, r.first_name, p.kind,
         a.first_name || coalesce(' ' || upper(left(a.last_name, 1)) || '.', ''),
         case p.kind
           when 'hello'    then (select h.message from hellos h where h.id = p.ref_id)
           when 'accepted' then null
           when 'answer'   then (select q.body from questions q where q.id = p.ref_id) end,
         case p.kind
           when 'hello'    then '/chats'
           when 'accepted' then coalesce('/chats/' || (select c.id::text from conversations c where c.hello_id = p.ref_id), '/chats')
           when 'answer'   then '/explore' end
  from picked p
  join profiles r on r.id = p.recipient_id
  join auth.users u on u.id = p.recipient_id
  left join profiles a on a.id = p.actor_id
  where r.email_alerts and r.suspended_at is null and u.email is not null
    and (a.id is null or a.suspended_at is null)
    and not is_blocked(p.recipient_id, p.actor_id);
end;
$$;

-- One-click unsubscribe from the email footer (the server checks the signed link first).
create or replace function set_email_alerts(p uuid, p_on boolean) returns void
language sql security definer set search_path = public as $$
  update profiles set email_alerts = p_on where id = p;
$$;

revoke execute on function claim_notifications(int) from public, anon, authenticated;
revoke execute on function set_email_alerts(uuid, boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function claim_notifications(int) to service_role;
    grant execute on function set_email_alerts(uuid, boolean) to service_role;
  end if;
end $$;

grant execute on function is_admin(), admin_reports(), admin_resolve(report_target, uuid, text), admin_suspended(),
  admin_unsuspend(uuid), admin_contact_messages(), admin_mark_handled(uuid),
  admin_add_event(text, timestamptz, timestamptz, text, bigint, text, text, text, text), admin_delete_event(uuid) to authenticated;
