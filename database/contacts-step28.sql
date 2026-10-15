-- ============================================================
-- Contacts database - Step 28: the home screen
--
-- Remembers which tiles you put on the opening screen, what you
-- called them, their colour and the order they sit in.
-- Each person gets their own arrangement.
-- Safe to run more than once.
-- ============================================================

alter table profiles
  add column if not exists home_tiles jsonb;

comment on column profiles.home_tiles is
  'The opening screen, as [{dest, label, colour}] in the order shown. '
  'Null means the person has never arranged it, so the app shows its '
  'own set of tiles.';


-- ---------- Check ----------
select count(*) as people,
       count(home_tiles) as people_who_have_arranged_it
from profiles;
