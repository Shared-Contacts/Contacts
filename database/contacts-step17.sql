-- ============================================================
-- Contacts database - Step 17 (safe to run more than once)
-- Only the people you name may see your position.
-- ============================================================

create table if not exists location_shares (
  owner_id   uuid not null references profiles on delete cascade,
  viewer_id  uuid not null references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (owner_id, viewer_id)
);

alter table location_shares enable row level security;

drop policy if exists "manage my location shares" on location_shares;
create policy "manage my location shares" on location_shares
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "shares naming me" on location_shares;
create policy "shares naming me" on location_shares
  for select to authenticated
  using (viewer_id = auth.uid());


create or replace function may_see_location(owner uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from location_shares
    where owner_id = owner and viewer_id = auth.uid()
  );
$$;

drop policy if exists "locations shared with me" on live_locations;
create policy "locations shared with me" on live_locations
  for select to authenticated
  using (until > now() and may_see_location(user_id));

-- Nothing carries over from the old open arrangement.
delete from live_locations;


-- ---------- Check it took ----------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('live_locations','location_shares')
order by tablename, policyname;
