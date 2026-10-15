-- ============================================================
-- What happened to the Family group? Run this first.
-- ============================================================

-- 1. Which groups still exist, and who owns them
select id, name, owner_id, sort_order from groups order by sort_order, name;

-- 2. How many contacts are tagged under each
select g.name, count(*) as contacts
from contact_groups cg
join groups g on g.id = cg.group_id
group by g.name
order by 2 desc;

-- 3. Contacts with no tag at all — these are the ones that vanished
--    from the grouped view
select count(*) as untagged
from contacts c
where not exists (select 1 from contact_groups cg where cg.contact_id = c.id);

-- 4. And the contacts themselves are still there?
select count(*) as total_contacts from contacts;
