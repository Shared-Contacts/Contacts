-- ============================================================
-- Make D&K private to you again.
-- Replace YOUR-EMAIL-HERE, then run.
-- Safe to run more than once.
-- ============================================================

create temp table _me as select id from profiles where email = 'YOUR-EMAIL-HERE';

-- ---------- Who currently has tags under the shared D&K ----------
select coalesce(p.display_name, p.email) as whose, count(*) as tags
from contact_groups cg
join groups g   on g.id = cg.group_id
join profiles p on p.id = cg.user_id
where g.name = 'D&K' and g.owner_id is null
group by whose;


-- ---------- Your own D&K ----------
insert into groups (name, sort_order, owner_id)
select 'D&K', 50, (select id from _me)
where not exists (
  select 1 from groups where name = 'D&K' and owner_id = (select id from _me));


-- ---------- Move your tags onto it ----------
update contact_groups cg
set group_id = (select id from groups where name = 'D&K' and owner_id = (select id from _me))
where cg.user_id = (select id from _me)
  and cg.group_id = (select id from groups where name = 'D&K' and owner_id is null)
  and not exists (
    select 1 from contact_groups x
    where x.contact_id = cg.contact_id
      and x.user_id    = cg.user_id
      and x.group_id   = (select id from groups where name = 'D&K'
                          and owner_id = (select id from _me)));


-- ---------- Remove the shared one, if nobody else is using it ----------
-- If someone else still has tags there, this stops with a message
-- naming the group rather than taking their filing away.
delete from groups
where name = 'D&K' and owner_id is null;


select g.name,
       case when g.owner_id is null then 'shared' else 'personal' end as kind,
       (select count(*) from contact_groups cg where cg.group_id = g.id) as contacts
from groups g
order by contacts desc, g.name;
