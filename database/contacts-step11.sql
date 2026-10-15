-- ============================================================
-- Contacts database - Step 11: appointments and to-dos
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

create table items (
  id           bigint generated always as identity primary key,
  created_by   uuid not null references profiles on delete cascade,
  kind         text not null check (kind in ('appointment','todo')),
  title        text not null,
  notes        text,
  contact_id   bigint references contacts on delete set null,

  -- an appointment happens at a time
  starts_at    timestamptz,
  ends_at      timestamptz,
  all_day      boolean not null default false,

  -- a to-do is due by a time, optionally not before another
  due_at       timestamptz,
  due_from     timestamptz,

  remind_at    timestamptz,
  remind_mins  int,                 -- how long before, for rebuilding remind_at
  repeat_every text default 'none'
               check (repeat_every in ('none','daily','weekly','fortnightly','monthly','yearly')),

  done_at      timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index items_when_idx    on items (coalesce(starts_at, due_at));
create index items_remind_idx  on items (remind_at) where done_at is null;
create index items_contact_idx on items (contact_id);

create trigger items_touch
  before update on items
  for each row execute function touch_updated_at();


-- ---------- Shared the same way contacts are ----------
create table item_shares (
  item_id  bigint not null references items    on delete cascade,
  user_id  uuid   not null references profiles on delete cascade,
  can_edit boolean not null default true,
  primary key (item_id, user_id)
);

alter table items       enable row level security;
alter table item_shares enable row level security;

create or replace function my_item(iid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from items where id = iid and created_by = auth.uid());
$$;

create or replace function item_shared_to_me(iid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from item_shares where item_id = iid and user_id = auth.uid());
$$;

create or replace function item_shared_editable(iid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from item_shares
                 where item_id = iid and user_id = auth.uid() and can_edit);
$$;

create policy "see my items" on items
  for select to authenticated
  using (created_by = auth.uid() or item_shared_to_me(id));

create policy "add my items" on items
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "edit my items" on items
  for update to authenticated
  using (created_by = auth.uid() or item_shared_editable(id));

create policy "delete my items" on items
  for delete to authenticated
  using (created_by = auth.uid());

create policy "see item shares" on item_shares
  for select to authenticated
  using (user_id = auth.uid() or my_item(item_id));

create policy "make item shares" on item_shares
  for insert to authenticated with check (my_item(item_id));

create policy "drop item shares" on item_shares
  for delete to authenticated using (my_item(item_id));
