-- ============================================================
-- Contacts database - Step 27: any number of places a day,
-- each named whatever it is.
--
-- The two fixed "if not aboard" slots become a list you add to.
-- Safe to run more than once. Nothing is thrown away.
-- ============================================================

alter table log_days
  add column if not exists stay_label text,
  add column if not exists places     jsonb not null default '[]'::jsonb;

comment on column log_days.places is
  'Anywhere else that day: [{label, lat, lng, place}] — a person who was '
  'elsewhere, or somewhere visited. The main position stays in boat_* and '
  'is what carries forward to the next day.';


-- ---------- Move the two old slots into the list ----------
-- Only for rows that have not been moved already.
update log_days l set places =
  (case when l.barry_lat is not null then
     jsonb_build_array(jsonb_build_object(
       'label', coalesce((select first_name from contacts c
                          where c.id = (select my_contact_id from profiles p
                                        where p.id = l.created_by)), 'Me'),
       'lat', l.barry_lat, 'lng', l.barry_lng,
       'place', l.barry_place))
   else '[]'::jsonb end)
  ||
  (case when l.sandra_lat is not null then
     jsonb_build_array(jsonb_build_object(
       'label', coalesce((select first_name from contacts c
                          where c.id = (select partner_contact_id from profiles p
                                        where p.id = l.created_by)), 'Partner'),
       'lat', l.sandra_lat, 'lng', l.sandra_lng,
       'place', l.sandra_place))
   else '[]'::jsonb end)
where l.places = '[]'::jsonb
  and (l.barry_lat is not null or l.sandra_lat is not null);


-- ---------- What everyone is called by default ----------
update log_days set stay_label = 'Boat' where stay_label is null;


-- ---------- Check before tidying ----------
select count(*) filter (where places <> '[]'::jsonb) as days_with_extra_places,
       count(*) filter (where barry_lat  is not null) as old_first_slot,
       count(*) filter (where sandra_lat is not null) as old_second_slot
from log_days;


-- ============================================================
-- ONCE the numbers above look right and the app is working,
-- run these three lines on their own to clear out the old
-- columns. Not before — they are your fallback.
-- ============================================================
-- alter table log_days
--   drop column barry_lat,  drop column barry_lng,  drop column barry_place,
--   drop column sandra_lat, drop column sandra_lng, drop column sandra_place;
