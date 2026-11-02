-- ============================================================
-- Contacts database - Step 51: My Stuff, where a service was done
--
-- Where a service was done can now be one of your contacts (the
-- garage, the boatyard), so its phone and address live in Contacts.
-- The name is still kept in where_done as well, for someone the
-- thing is shared with who cannot see that contact.
--
-- Bought from and the insurer link the same way, but they are kept
-- in the thing's own boxes (stuff.details), so they need nothing here.
--
-- If the contact is deleted, the link is cleared and the name stays.
--
-- No new tables, so the backup scripts are unchanged: they already
-- take every column of stuff_service.
-- Safe to run more than once.
-- ============================================================

alter table stuff_service
  add column if not exists where_contact bigint references contacts on delete set null;


-- ---------- Check it took ----------
-- You should see 1 line: where_contact, bigint.
select column_name::text as "column", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public' and table_name = 'stuff_service'
  and column_name = 'where_contact';
