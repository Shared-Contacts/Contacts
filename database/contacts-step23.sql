-- ============================================================
-- Contacts database - Step 23: shopping lists per person,
-- shared with whoever you choose. Plus a colour scheme setting.
-- Safe to run more than once.
-- ============================================================

alter table profiles add column if not exists theme text;


-- ---------- A list belongs to someone ----------
create table if not exists shopping_lists (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references profiles on delete cascade,
  name       text not null default 'Shopping',
  created_at timestamptz default now()
);

create table if not exists shopping_list_shares (
  list_id    bigint not null references shopping_lists on delete cascade,
  user_id    uuid   not null references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (list_id, user_id)
);

alter table shopping add column if not exists list_id
  bigint references shopping_lists on delete cascade;


-- ---------- Move anything already on the old shared list ----------
insert into shopping_lists (owner_id, name)
select distinct s.created_by, 'Shopping'
from shopping s
where s.list_id is null
  and not exists (select 1 from shopping_lists l where l.owner_id = s.created_by);

update shopping s
set list_id = l.id
from shopping_lists l
where s.list_id is null and l.owner_id = s.created_by;


-- ---------- Who may see a list ----------
create or replace function may_see_list(lid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from shopping_lists where id = lid and owner_id = auth.uid())
      or exists (select 1 from shopping_list_shares where list_id = lid and user_id = auth.uid());
$$;

alter table shopping_lists       enable row level security;
alter table shopping_list_shares enable row level security;

drop policy if exists "see lists"    on shopping_lists;
drop policy if exists "add lists"    on shopping_lists;
drop policy if exists "edit lists"   on shopping_lists;
drop policy if exists "remove lists" on shopping_lists;

create policy "see lists"    on shopping_lists for select to authenticated
  using (owner_id = auth.uid() or may_see_list(id));
create policy "add lists"    on shopping_lists for insert to authenticated
  with check (owner_id = auth.uid());
create policy "edit lists"   on shopping_lists for update to authenticated
  using (owner_id = auth.uid());
create policy "remove lists" on shopping_lists for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "see list shares"    on shopping_list_shares;
drop policy if exists "manage list shares" on shopping_list_shares;

create policy "see list shares" on shopping_list_shares for select to authenticated
  using (user_id = auth.uid()
      or exists (select 1 from shopping_lists l where l.id = list_id and l.owner_id = auth.uid()));
create policy "manage list shares" on shopping_list_shares for all to authenticated
  using (exists (select 1 from shopping_lists l where l.id = list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from shopping_lists l where l.id = list_id and l.owner_id = auth.uid()));


-- ---------- Items follow their list ----------
drop policy if exists "read shopping"   on shopping;
drop policy if exists "add shopping"    on shopping;
drop policy if exists "edit shopping"   on shopping;
drop policy if exists "remove shopping" on shopping;

create policy "read shopping"   on shopping for select to authenticated
  using (may_see_list(list_id));
create policy "add shopping"    on shopping for insert to authenticated
  with check (created_by = auth.uid() and may_see_list(list_id));
create policy "edit shopping"   on shopping for update to authenticated
  using (may_see_list(list_id));
create policy "remove shopping" on shopping for delete to authenticated
  using (may_see_list(list_id));
