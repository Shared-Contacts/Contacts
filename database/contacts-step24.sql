-- ============================================================
-- Contacts database - Step 24: favourites, and a group for
-- contacts other people have shared with you.
-- Safe to run more than once.
-- ============================================================

-- ---------- Your own favourites ----------
-- Each person picks their own, so a contact Sandra keeps at the top
-- does not jump to the top of yours.
create table if not exists contact_favourites (
  contact_id bigint not null references contacts on delete cascade,
  user_id    uuid   not null references profiles on delete cascade,
  created_at timestamptz default now(),
  primary key (contact_id, user_id)
);

alter table contact_favourites enable row level security;

drop policy if exists "my favourites" on contact_favourites;
create policy "my favourites" on contact_favourites
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ---------- A personal "Shared with me" group ----------
-- So a contact someone shares lands somewhere sensible instead of
-- sitting outside every group. You can refile it afterwards.
insert into groups (name, sort_order, owner_id)
select 'Shared with me', 90, p.id
from profiles p
where not exists (
  select 1 from groups g where g.name = 'Shared with me' and g.owner_id = p.id);


-- ---------- The wishlist stops straddling both apps ----------
update wishes set app = 'contacts' where app = 'either';

alter table wishes drop constraint if exists wishes_app_check;
alter table wishes add constraint wishes_app_check
  check (app in ('contacts','calendar club'));
