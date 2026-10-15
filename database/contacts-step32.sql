-- ============================================================
-- Contacts database - Step 32: where a contact came from
--
-- When you accept a copy somebody sent you, the new contact
-- quietly remembers who handed it over and when. Nothing is
-- restricted by it — it is there so you can always see where
-- something came from.
--
-- Safe to run more than once.
-- ============================================================

alter table contacts
  add column if not exists came_from uuid references profiles on delete set null,
  add column if not exists came_at   timestamptz;

comment on column contacts.came_from is
  'Who sent you the copy you accepted. Only set on contacts that arrived '
  'that way; blank for ones you entered yourself.';


-- ---------- Check ----------
select count(*) filter (where came_from is not null) as arrived_as_copies,
       count(*) filter (where came_from is null)     as entered_here
from contacts;
