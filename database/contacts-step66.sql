-- ============================================================
-- Contacts database - Step 66: Birthday messages
--
-- A Happy Birthday message to a contact on their birthday, by
-- WhatsApp, text or email, sent with one tap from your own phone
-- (ML306). Nothing is sent by itself: the app opens WhatsApp,
-- Messages or email with the words filled in, and you press Send.
--
--   bday_wordings  one row each: your wordings, in order. The first
--                  is your standard one. {name} in a wording becomes
--                  the person's first name.
--   bday_sends     one row for each contact you have made a choice
--                  about: whether to send them a message (with no row
--                  it is yes, wherever there is a mobile or an email),
--                  which wording, which way (WhatsApp, text or email),
--                  and the day you last sent them one.
--
-- Yours alone: nobody else can see or change your wordings or your
-- choices, even on a contact you share with them. A choice can only
-- be made about a contact you can see.
--
-- Two new tables: bday_wordings and bday_sends. Both backup scripts have
-- been updated to take them (same session, 19 Nov 2026).
-- Safe to run more than once.
-- ============================================================


-- ---------- Your wordings ----------
create table if not exists bday_wordings (
  created_by  uuid primary key default auth.uid() references profiles on delete cascade,
  wordings    jsonb not null default '[]' check (jsonb_typeof(wordings) = 'array'),  -- [{k, text}], the first is the standard one
  updated_at  timestamptz not null default now()
);

comment on table bday_wordings is
  'Birthday messages (step 66): one row each, your wordings in order, the first the standard one. Seen and changed only by the owner.';

-- ---------- Who you send to, and how ----------
create table if not exists bday_sends (
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  contact_id  bigint not null references contacts on delete cascade,
  send        boolean not null default true,
  wording     text,      -- the k of one of your wordings; none means the standard one
  way         text check (way in ('whatsapp','text','email')),  -- none means WhatsApp to a mobile, otherwise email
  sent_on     date,      -- the day you last sent them one
  updated_at  timestamptz not null default now(),
  primary key (created_by, contact_id)
);

create index if not exists bday_sends_contact_idx on bday_sends (contact_id);

comment on table bday_sends is
  'Birthday messages (step 66): your choice for each contact (send or not, wording, way, last sent). Seen and changed only by the owner.';


-- ---------- Who may see and change them: only you ----------
alter table bday_wordings enable row level security;
alter table bday_sends    enable row level security;

drop policy if exists "see own birthday wordings"    on bday_wordings;
drop policy if exists "add own birthday wordings"    on bday_wordings;
drop policy if exists "change own birthday wordings" on bday_wordings;
drop policy if exists "remove own birthday wordings" on bday_wordings;

create policy "see own birthday wordings" on bday_wordings for select to authenticated
  using (created_by = auth.uid());
create policy "add own birthday wordings" on bday_wordings for insert to authenticated
  with check (created_by = auth.uid());
create policy "change own birthday wordings" on bday_wordings for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "remove own birthday wordings" on bday_wordings for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "see own birthday choices"    on bday_sends;
drop policy if exists "add own birthday choices"    on bday_sends;
drop policy if exists "change own birthday choices" on bday_sends;
drop policy if exists "remove own birthday choices" on bday_sends;

-- Adding or changing one also needs the contact to be one you can see.
create policy "see own birthday choices" on bday_sends for select to authenticated
  using (created_by = auth.uid());
create policy "add own birthday choices" on bday_sends for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from contacts c where c.id = contact_id));
create policy "change own birthday choices" on bday_sends for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and exists (select 1 from contacts c where c.id = contact_id));
create policy "remove own birthday choices" on bday_sends for delete to authenticated
  using (created_by = auth.uid());



-- ---------- Check it took ----------
-- You should see 10 lines: 4 rules on bday_sends, 4 on bday_wordings,
-- and the 2 new tables.
select 'rule on ' || tablename::text as "what", policyname::text as "name", cmd::text as "kind"
from pg_policies
where schemaname = 'public' and tablename in ('bday_wordings','bday_sends')
union all
select 'table', table_name::text, ''
from information_schema.tables
where table_schema = 'public' and table_name in ('bday_wordings','bday_sends')
order by 1, 2;
