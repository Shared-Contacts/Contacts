-- ============================================================
-- Contacts database - Step 67: Sharing slideshows
--
-- Your slideshows on every phone and computer you sign in on, and
-- shared with other people in the app if you choose (ML318).
--
-- The photos themselves never come here. They stay on each phone or
-- computer, as before. Only each slideshow's name, who it is shared
-- with, and the list of its photos (each one's file name, size, when
-- it was taken and which way round it is) are kept here, so another
-- phone or computer can pick out its own copies of the same photos.
--
--   slideshows        one row for each slideshow: its name, who made
--                     it, who it is shared with (some people, or
--                     everyone), and who else can change it.
--   slideshow_photos  one row for each photo in a slideshow.
--
-- Who can do what:
--   * You see your own slideshows, any shared with everyone, and any
--     shared with you.
--   * You can change one (add photos, take them out, rename it) if you
--     made it, or it is shared with you and you are one of those who
--     can change it (or everyone it is shared with can).
--   * Only the person who made it can delete it or change who it is
--     shared with and who can change it.
--
-- Two new tables: slideshows and slideshow_photos. Both backup scripts
-- have been updated to take them (same session, 20 Nov 2026).
-- Safe to run more than once.
-- ============================================================


-- ---------- The slideshows ----------
create table if not exists slideshows (
  id          text primary key check (id ~ '^t[a-z0-9]{6,30}$'),   -- the same on every phone and computer
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  shared_with uuid[] not null default '{}',     -- the people it is shared with
  share_all   boolean not null default false,   -- shared with everyone, including anyone who joins later
  editors     uuid[] not null default '{}',     -- of those, the ones who can change it
  edit_all    boolean not null default false,   -- everyone it is shared with can change it
  made_at     timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table slideshows is
  'Slideshows (step 67): one row each, its name and who it is shared with. The photos are not here; they stay on each phone or computer.';

-- ---------- The photos in each one (a list, not the photos) ----------
create table if not exists slideshow_photos (
  id           text primary key check (id ~ '^p[a-z0-9]{6,30}$'),  -- the same on every phone and computer
  slideshow_id text not null references slideshows on delete cascade,
  name         text not null default '',        -- the photo's file name
  size         bigint,                          -- the file's size, in bytes
  taken        bigint,                          -- when it was taken, in milliseconds since 1970
  taken_by     text not null default '' check (taken_by in ('', 'camera', 'file')),  -- camera: from the photo itself
  w            int,                             -- its width and height, to tell upright from sideways
  h            int,
  added_by     uuid default auth.uid() references profiles on delete set null,
  added_at     timestamptz not null default now()
);

create index if not exists slideshow_photos_show_idx on slideshow_photos (slideshow_id);

comment on table slideshow_photos is
  'Slideshows (step 67): the list of photos in each slideshow (name, size, when taken, shape). The photos themselves stay on each phone or computer.';


-- ---------- Only the maker changes who it is shared with ----------
-- Somebody who can change a slideshow may rename it, but the people it
-- is shared with, and who can change it, stay the maker's to decide.
create or replace function slideshows_guard() returns trigger
language plpgsql as $$
begin
  if old.created_by is distinct from auth.uid() and (
       new.id          is distinct from old.id
    or new.created_by  is distinct from old.created_by
    or new.shared_with is distinct from old.shared_with
    or new.share_all   is distinct from old.share_all
    or new.editors     is distinct from old.editors
    or new.edit_all    is distinct from old.edit_all) then
    raise exception 'Only the person who made a slideshow can change who it is shared with';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists slideshows_guard on slideshows;
create trigger slideshows_guard before update on slideshows
  for each row execute function slideshows_guard();


-- ---------- Who may see and change them ----------
alter table slideshows       enable row level security;
alter table slideshow_photos enable row level security;

drop policy if exists "see slideshows"    on slideshows;
drop policy if exists "add slideshows"    on slideshows;
drop policy if exists "change slideshows" on slideshows;
drop policy if exists "remove slideshows" on slideshows;

create policy "see slideshows" on slideshows for select to authenticated
  using (created_by = auth.uid() or share_all or auth.uid() = any(shared_with));
create policy "add slideshows" on slideshows for insert to authenticated
  with check (created_by = auth.uid());
create policy "change slideshows" on slideshows for update to authenticated
  using (created_by = auth.uid()
         or ((share_all or auth.uid() = any(shared_with)) and (edit_all or auth.uid() = any(editors))))
  with check (created_by = auth.uid()
         or ((share_all or auth.uid() = any(shared_with)) and (edit_all or auth.uid() = any(editors))));
create policy "remove slideshows" on slideshows for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "see slideshow photos"    on slideshow_photos;
drop policy if exists "add slideshow photos"    on slideshow_photos;
drop policy if exists "change slideshow photos" on slideshow_photos;
drop policy if exists "remove slideshow photos" on slideshow_photos;

-- A photo goes with its slideshow: seen by whoever sees the slideshow,
-- added, changed or taken out by whoever can change it.
create policy "see slideshow photos" on slideshow_photos for select to authenticated
  using (exists (select 1 from slideshows s where s.id = slideshow_id
    and (s.created_by = auth.uid() or s.share_all or auth.uid() = any(s.shared_with))));
create policy "add slideshow photos" on slideshow_photos for insert to authenticated
  with check (added_by = auth.uid() and exists (select 1 from slideshows s where s.id = slideshow_id
    and (s.created_by = auth.uid()
         or ((s.share_all or auth.uid() = any(s.shared_with)) and (s.edit_all or auth.uid() = any(s.editors))))));
create policy "change slideshow photos" on slideshow_photos for update to authenticated
  using (exists (select 1 from slideshows s where s.id = slideshow_id
    and (s.created_by = auth.uid()
         or ((s.share_all or auth.uid() = any(s.shared_with)) and (s.edit_all or auth.uid() = any(s.editors))))))
  with check (exists (select 1 from slideshows s where s.id = slideshow_id
    and (s.created_by = auth.uid()
         or ((s.share_all or auth.uid() = any(s.shared_with)) and (s.edit_all or auth.uid() = any(s.editors))))));
create policy "remove slideshow photos" on slideshow_photos for delete to authenticated
  using (exists (select 1 from slideshows s where s.id = slideshow_id
    and (s.created_by = auth.uid()
         or ((s.share_all or auth.uid() = any(s.shared_with)) and (s.edit_all or auth.uid() = any(s.editors))))));



-- ---------- Check it took ----------
-- You should see 11 lines: 4 rules on slideshow_photos, 4 on
-- slideshows, the 2 new tables, and the trigger.
select 'rule on ' || tablename::text as "what", policyname::text as "name", cmd::text as "kind"
from pg_policies
where schemaname = 'public' and tablename in ('slideshows','slideshow_photos')
union all
select 'table', table_name::text, ''
from information_schema.tables
where table_schema = 'public' and table_name in ('slideshows','slideshow_photos')
union all
select 'trigger', trigger_name::text, event_manipulation::text
from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'slideshows'
order by 1, 2;
