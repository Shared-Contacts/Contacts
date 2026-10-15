-- ============================================================
-- Tidy up the duplicated groups.
--
-- Boater, D&K and Friend's Family exist twice: a personal one of
-- yours holding all the tags, and an empty shared one. This moves
-- your tags onto the shared copies, so Sandra can use them too,
-- then removes the personal duplicates.
--
-- "Boaters" is folded into "Boater" at the same time.
-- Safe to run more than once.
-- ============================================================

-- ---------- 1. Fold Boaters into Boater ----------
update contact_groups cg
set group_id = (select id from groups where name = 'Boater' and owner_id is null)
where cg.group_id = (select id from groups where name = 'Boaters')
  and not exists (
    select 1 from contact_groups x
    where x.contact_id = cg.contact_id
      and x.user_id    = cg.user_id
      and x.group_id   = (select id from groups where name = 'Boater' and owner_id is null));

delete from contact_groups
where group_id = (select id from groups where name = 'Boaters');

delete from groups where name = 'Boaters';


-- ---------- 2. Move personal tags onto the shared namesake ----------
update contact_groups cg
set group_id = s.id
from groups p
join groups s on s.name = p.name and s.owner_id is null
where cg.group_id = p.id
  and p.owner_id is not null
  and not exists (
    select 1 from contact_groups x
    where x.contact_id = cg.contact_id
      and x.user_id    = cg.user_id
      and x.group_id   = s.id);

-- Anything that was already tagged both ways
delete from contact_groups cg
using groups p
where cg.group_id = p.id
  and p.owner_id is not null
  and exists (select 1 from groups s where s.name = p.name and s.owner_id is null);


-- ---------- 3. Remove the now-empty personal duplicates ----------
delete from groups p
where p.owner_id is not null
  and exists (select 1 from groups s where s.name = p.name and s.owner_id is null)
  and not exists (select 1 from contact_groups cg where cg.group_id = p.id);


-- ---------- What you should be left with ----------
select g.id, g.name,
       case when g.owner_id is null then 'shared' else 'personal' end as kind,
       (select count(*) from contact_groups cg where cg.group_id = g.id) as contacts
from groups g
order by contacts desc, g.name;
