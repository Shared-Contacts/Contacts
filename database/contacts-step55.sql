-- ============================================================
-- Contacts database - Step 55: the week's menu
--
-- Plan breakfast, lunch and dinner for the days ahead, under
-- Recipes > Week's menu. Each meal is a recipe from the cookbook
-- or a few words of your own ("Out", "Leftovers"). Leave a meal
-- out and nothing is kept for it.
--
-- Your menu is yours. Share it with the people you choose and they
-- see the same menu, on their Today screen as well, and can change
-- it too. Nobody else sees it.
--
-- Two new tables: meal_plan and meal_shares. Both backup scripts
-- include them from 4 Nov 2026, so run this before the next backup.
-- Nothing existing is changed. Safe to run more than once.
-- ============================================================


-- ---------- The meals ----------
create table if not exists meal_plan (
  owner_id   uuid not null default auth.uid() references profiles on delete cascade,
  on_date    date not null,
  meal       text not null check (meal in ('breakfast','lunch','dinner')),
  recipe_id  bigint references recipes on delete set null,
  title      text not null check (length(trim(title)) > 0),
  updated_by uuid default auth.uid() references profiles on delete set null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, on_date, meal)
);

comment on table meal_plan is
  'The week''s menu. One row per meal planned; a meal left empty has no row.';
comment on column meal_plan.title is
  'What shows: the recipe''s name when it was picked, or the words typed. '
  'Kept so the menu still reads right if the recipe is private or deleted.';

alter table meal_plan enable row level security;


-- ---------- Who you have shared your menu with ----------
create table if not exists meal_shares (
  owner_id   uuid not null references profiles on delete cascade,
  viewer_id  uuid not null references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

alter table meal_shares enable row level security;

drop policy if exists "manage my menu shares" on meal_shares;
create policy "manage my menu shares" on meal_shares
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "menu shares naming me" on meal_shares;
create policy "menu shares naming me" on meal_shares
  for select to authenticated
  using (viewer_id = auth.uid());


-- ---------- The one question the rules ask ----------
-- "Has the owner of this menu shared it with me?"
create or replace function menu_shared_with_me(owner uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from meal_shares
    where owner_id = owner and viewer_id = auth.uid()
  );
$$;


-- ---------- Rules on the meals ----------
drop policy if exists "manage my menu"         on meal_plan;
drop policy if exists "use menus shared with me" on meal_plan;

create policy "manage my menu" on meal_plan
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "use menus shared with me" on meal_plan
  for all to authenticated
  using (menu_shared_with_me(owner_id)) with check (menu_shared_with_me(owner_id));

-- A meal stays on the menu it was planned on. Without this, someone a menu
-- is shared with could move one of its meals onto their own menu.
create or replace function meal_plan_keep_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'A meal cannot be moved to someone else''s menu';
  end if;
  return new;
end;
$$;

drop trigger if exists meal_plan_keep_owner on meal_plan;
create trigger meal_plan_keep_owner before update on meal_plan
  for each row execute function meal_plan_keep_owner();


-- ---------- Check it took ----------
-- You should see 2 rules on meal_plan and 2 on meal_shares.
select tablename as "table", policyname as "rule", cmd as "applies to"
from pg_policies
where schemaname = 'public' and tablename in ('meal_plan','meal_shares')
order by tablename, policyname;
