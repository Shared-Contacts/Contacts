-- ============================================================
-- Contacts database - Step 22: wishlist and shopping list
-- Safe to run more than once.
-- ============================================================

-- ---------- Ideas for either app ----------
-- One table serves both Contacts and Calendar Club; the "app"
-- column says which it is about.
create table if not exists wishes (
  id         bigint generated always as identity primary key,
  created_by uuid not null references profiles on delete cascade,
  app        text not null default 'contacts'
             check (app in ('contacts','calendar club','either')),
  title      text not null,
  notes      text,
  status     text not null default 'idea'
             check (status in ('idea','maybe','doing','done','no')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists wishes_touch on wishes;
create trigger wishes_touch before update on wishes
  for each row execute function touch_updated_at();

alter table wishes enable row level security;

-- Everyone signed in can see and add. Only the person who wrote one
-- can reword or remove it, but anyone may move it along the statuses.
drop policy if exists "read wishes"   on wishes;
drop policy if exists "add wishes"    on wishes;
drop policy if exists "edit wishes"   on wishes;
drop policy if exists "remove wishes" on wishes;

create policy "read wishes"   on wishes for select to authenticated using (true);
create policy "add wishes"    on wishes for insert to authenticated
  with check (created_by = auth.uid());
create policy "edit wishes"   on wishes for update to authenticated using (true);
create policy "remove wishes" on wishes for delete to authenticated
  using (created_by = auth.uid());


-- ---------- The shopping list, shared by everyone ----------
create table if not exists shopping (
  id         bigint generated always as identity primary key,
  created_by uuid not null references profiles on delete cascade,
  name       text not null,
  qty        text,
  aisle      text,
  got        boolean not null default false,
  got_at     timestamptz,
  sort_order int not null default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists shopping_got_idx on shopping (got, sort_order);

drop trigger if exists shopping_touch on shopping;
create trigger shopping_touch before update on shopping
  for each row execute function touch_updated_at();

alter table shopping enable row level security;

-- A shared list only works if either of you can tick anything off.
drop policy if exists "read shopping"   on shopping;
drop policy if exists "add shopping"    on shopping;
drop policy if exists "edit shopping"   on shopping;
drop policy if exists "remove shopping" on shopping;

create policy "read shopping"   on shopping for select to authenticated using (true);
create policy "add shopping"    on shopping for insert to authenticated
  with check (created_by = auth.uid());
create policy "edit shopping"   on shopping for update to authenticated using (true);
create policy "remove shopping" on shopping for delete to authenticated using (true);
