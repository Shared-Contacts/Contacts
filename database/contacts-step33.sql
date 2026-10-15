-- ============================================================
-- Contacts database - Step 33: messages
--
-- Conversations inside the app. One to one, a group of your
-- choosing, or everybody at once. Only the people in a
-- conversation can read a word of it.
--
-- Safe to run more than once.
-- ============================================================

-- ---------- A conversation ----------
create table if not exists chats (
  id          bigint generated always as identity primary key,
  created_by  uuid not null references profiles on delete set null,
  title       text,                     -- a name, for groups
  is_everyone boolean not null default false,
  created_at  timestamptz default now()
);

-- ---------- Who is in it ----------
create table if not exists chat_members (
  chat_id   bigint not null references chats on delete cascade,
  user_id   uuid   not null references profiles on delete cascade,
  joined_at timestamptz default now(),
  last_read timestamptz,                -- how the unread count is worked out
  primary key (chat_id, user_id)
);

-- ---------- What was said ----------
create table if not exists messages (
  id         bigint generated always as identity primary key,
  chat_id    bigint not null references chats on delete cascade,
  from_user  uuid   not null references profiles on delete set null,
  body       text   not null,
  created_at timestamptz default now()
);

create index if not exists messages_chat_idx on messages (chat_id, created_at desc);
create index if not exists chat_members_user_idx on chat_members (user_id);


-- ---------- Am I in this conversation? ----------
-- Runs with raised rights so the rules below do not chase their own tail.
create or replace function in_chat(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from chat_members where chat_id = cid and user_id = auth.uid()
  );
$$;


-- ---------- Only members can read a word of it ----------
alter table chats        enable row level security;
alter table chat_members enable row level security;
alter table messages     enable row level security;

drop policy if exists "see my chats"       on chats;
drop policy if exists "start a chat"       on chats;
drop policy if exists "rename my chat"     on chats;
drop policy if exists "see chat members"   on chat_members;
drop policy if exists "add chat members"   on chat_members;
drop policy if exists "mark my place"      on chat_members;
drop policy if exists "leave a chat"       on chat_members;
drop policy if exists "read messages"      on messages;
drop policy if exists "say something"      on messages;
drop policy if exists "unsay something"    on messages;

create policy "see my chats" on chats
  for select to authenticated
  using (in_chat(id) or created_by = auth.uid());

create policy "start a chat" on chats
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "rename my chat" on chats
  for update to authenticated
  using (created_by = auth.uid());

create policy "see chat members" on chat_members
  for select to authenticated
  using (in_chat(chat_id) or user_id = auth.uid());

-- A member may bring somebody in; the person who started it always may; and
-- anybody may add themselves to the everyone channel.
create policy "add chat members" on chat_members
  for insert to authenticated
  with check (
    in_chat(chat_id)
    or exists (select 1 from chats c where c.id = chat_id and c.created_by = auth.uid())
    or (user_id = auth.uid()
        and exists (select 1 from chats c where c.id = chat_id and c.is_everyone))
  );

create policy "mark my place" on chat_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "leave a chat" on chat_members
  for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from chats c where c.id = chat_id and c.created_by = auth.uid()));

create policy "read messages" on messages
  for select to authenticated
  using (in_chat(chat_id));

create policy "say something" on messages
  for insert to authenticated
  with check (from_user = auth.uid() and in_chat(chat_id));

create policy "unsay something" on messages
  for delete to authenticated
  using (from_user = auth.uid());


-- ---------- The Everyone channel ----------
-- One conversation that holds everybody, for anything that concerns the lot of
-- you. Made once; anybody added to the app later joins it themselves.
-- Only ever one of them, however many times this is run.
create unique index if not exists chats_one_everyone
  on chats ((is_everyone)) where is_everyone;

insert into chats (created_by, title, is_everyone)
select p.id, 'Everyone', true
from profiles p
where not exists (select 1 from chats where is_everyone)
order by p.created_at
limit 1;

insert into chat_members (chat_id, user_id)
select c.id, p.id
from chats c cross join profiles p
where c.is_everyone
on conflict (chat_id, user_id) do nothing;


-- ---------- Live updates, so a reply appears as it is sent ----------
-- Harmless if it is already there.
do $$
begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
  when undefined_object then null;   -- realtime not set up on this project
end $$;


-- ---------- Check ----------
select (select count(*) from chats)        as conversations,
       (select count(*) from chat_members) as memberships,
       (select count(*) from messages)     as messages_so_far;
