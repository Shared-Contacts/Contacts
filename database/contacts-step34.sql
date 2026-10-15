-- ============================================================
-- Contacts database - Step 34: a Notices channel
--
-- Everyone stays an open group that anybody can talk in. This
-- adds a second standing channel, Notices, that everybody reads
-- but only its owner can post to — for things that need to be
-- read rather than chatted about.
--
-- Run step 33 first. Safe to run more than once.
-- ============================================================

alter table chats
  add column if not exists announce boolean not null default false;

comment on column chats.announce is
  'A read-only channel: everybody sees it, only created_by may post.';

-- Only ever one of them, however many times this is run.
create unique index if not exists chats_one_announce
  on chats ((announce)) where announce;

-- Owned by whoever owns the Everyone channel, so the two agree.
insert into chats (created_by, title, announce)
select coalesce(
         (select created_by from chats where is_everyone),
         (select id from profiles order by created_at limit 1)),
       'Notices', true
where not exists (select 1 from chats where announce);

insert into chat_members (chat_id, user_id)
select c.id, p.id
from chats c cross join profiles p
where c.announce
on conflict (chat_id, user_id) do nothing;


-- ---------- Who may say something ----------
-- A member, as before — except in a notices channel, where it has to be
-- the person who owns it.
create or replace function can_post(cid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from chats c
    where c.id = cid
      and exists (select 1 from chat_members m
                  where m.chat_id = c.id and m.user_id = auth.uid())
      and (not c.announce or c.created_by = auth.uid())
  );
$$;

drop policy if exists "say something" on messages;
create policy "say something" on messages
  for insert to authenticated
  with check (from_user = auth.uid() and can_post(chat_id));


-- ---------- Check ----------
-- Confirms who owns each standing channel. If Notices is owned by the
-- wrong person, the line underneath fixes it.
select c.title,
       c.is_everyone as "open to all",
       c.announce    as "notices only",
       p.display_name as "owned by",
       (select count(*) from chat_members m where m.chat_id = c.id) as members
from chats c
left join profiles p on p.id = c.created_by
where c.is_everyone or c.announce
order by c.announce;

-- If Notices ended up owned by somebody else, put the right name in here
-- and run just this line:
--
-- update chats set created_by = (select id from profiles where display_name = 'Barry')
--   where announce;
