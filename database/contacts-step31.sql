-- ============================================================
-- Contacts database - Step 31: sending a contact to someone
--
-- Sharing used to mean "you may look at mine". This is different:
-- you send somebody a copy, and if they accept it they get their
-- own contact to do as they like with. Nothing is linked afterwards.
--
-- The old sharing still works. Anything already shared stays shared
-- until you decide otherwise.
--
-- Safe to run more than once.
-- ============================================================

create table if not exists contact_offers (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references profiles on delete cascade,
  to_user    uuid not null references profiles on delete cascade,
  name       text,                 -- so the inbox reads well at a glance
  payload    jsonb not null,       -- the contact as it stood when it was sent
  source_id  bigint,               -- the sender's own contact, for reference
  created_at timestamptz default now(),
  decided_at timestamptz,
  outcome    text check (outcome in ('accepted','merged','declined'))
);

create index if not exists contact_offers_waiting_idx
  on contact_offers (to_user) where decided_at is null;

comment on table contact_offers is
  'A copy of a contact offered to somebody. Accepting it creates a brand '
  'new contact owned by the person who accepted; the two are not linked.';


-- ---------- Who may do what ----------
alter table contact_offers enable row level security;

drop policy if exists "see my offers"      on contact_offers;
drop policy if exists "send offers"        on contact_offers;
drop policy if exists "decide my offers"   on contact_offers;
drop policy if exists "withdraw offers"    on contact_offers;

-- Both ends can see it: the sender to know it arrived, you to act on it.
create policy "see my offers" on contact_offers
  for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- You can only send as yourself.
create policy "send offers" on contact_offers
  for insert to authenticated
  with check (from_user = auth.uid());

-- Only the person it was sent to decides what happens to it.
create policy "decide my offers" on contact_offers
  for update to authenticated
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

-- Either end can clear it away afterwards.
create policy "withdraw offers" on contact_offers
  for delete to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());


-- ---------- Check ----------
select count(*) filter (where decided_at is null) as waiting,
       count(*) filter (where outcome = 'accepted') as accepted,
       count(*) filter (where outcome = 'merged')   as merged,
       count(*) filter (where outcome = 'declined') as declined
from contact_offers;
