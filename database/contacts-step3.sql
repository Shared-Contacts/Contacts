-- ============================================================
-- Contacts database - Step 3: more fields and editable lists
-- Paste into the Supabase SQL Editor and Run.
-- Existing contacts are carried across automatically.
-- ============================================================

-- ---------- Relationship status (Married, Single, ...) ----------
create table statuses (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  sort_order int default 100
);

insert into statuses (name, sort_order) values
  ('Married', 10), ('Partner', 20), ('Engaged', 30), ('Single', 40),
  ('Separated', 50), ('Divorced', 60), ('Widowed', 70),
  ('Child (under 18)', 80), ('Died', 90);


-- ---------- Relationship types, each knowing its opposite ----------
create table link_kinds (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  inverse_name text not null,
  sort_order   int default 100
);

insert into link_kinds (name, inverse_name, sort_order) values
  ('Partner of',   'Partner of',   10),
  ('Married to',   'Married to',   20),
  ('Parent of',    'Child of',     30),
  ('Child of',     'Parent of',    40),
  ('Sibling of',   'Sibling of',   50),
  ('Grandparent of','Grandchild of',60),
  ('Works for',    'Employs',      70),
  ('Employs',      'Works for',    80),
  ('Colleague of', 'Colleague of', 90),
  ('Crew on',      'Crewed by',   100),
  ('Moors near',   'Moors near',  110),
  ('Friend of',    'Friend of',   120),
  ('Met through',  'Introduced',  130);


-- ---------- New columns on contacts ----------
alter table contacts
  add column status_id       bigint references statuses on delete set null,
  add column company         text,
  add column department      text,
  add column emails          jsonb not null default '[]'::jsonb,
  add column phones          jsonb not null default '[]'::jsonb,
  add column websites        jsonb not null default '[]'::jsonb,
  add column socials         jsonb not null default '[]'::jsonb,
  add column what3words      text,
  add column met_latitude    numeric,
  add column met_longitude   numeric,
  add column met_what3words  text;


-- ---------- Carry existing values into the new lists ----------
update contacts set
  phones =
    (case when mobile is not null
      then jsonb_build_array(jsonb_build_object('label','Mobile','value',mobile))
      else '[]'::jsonb end)
    ||
    (case when phone is not null
      then jsonb_build_array(jsonb_build_object('label','Phone','value',phone))
      else '[]'::jsonb end),
  emails =
    (case when email is not null
      then jsonb_build_array(jsonb_build_object('label','Personal','value',email))
      else '[]'::jsonb end),
  websites =
    (case when website is not null
      then jsonb_build_array(jsonb_build_object('label','Website','value',website))
      else '[]'::jsonb end),
  socials =
    (case when facebook is not null
      then jsonb_build_array(jsonb_build_object('label','Facebook','value',facebook))
      else '[]'::jsonb end)
    ||
    (case when instagram is not null
      then jsonb_build_array(jsonb_build_object('label','Instagram','value',instagram))
      else '[]'::jsonb end)
    ||
    (case when bluesky is not null
      then jsonb_build_array(jsonb_build_object('label','Bluesky','value',bluesky))
      else '[]'::jsonb end)
    ||
    (case when other_social is not null
      then jsonb_build_array(jsonb_build_object('label','Other','value',other_social))
      else '[]'::jsonb end),
  company = employer;

-- Match any free-text status you had already typed to the new list
update contacts c set status_id = s.id
from statuses s
where lower(s.name) = lower(c.partner_status);


-- ---------- Remove the columns those replaced ----------
drop index if exists contacts_search_idx;

alter table contacts
  drop column mobile,
  drop column phone,
  drop column email,
  drop column website,
  drop column facebook,
  drop column instagram,
  drop column bluesky,
  drop column other_social,
  drop column employer,
  drop column partner_status;


-- ---------- Security for the new tables ----------
alter table statuses   enable row level security;
alter table link_kinds enable row level security;

-- Anyone signed in can read these lists...
create policy "read statuses" on statuses
  for select to authenticated using (true);
create policy "read link kinds" on link_kinds
  for select to authenticated using (true);

-- ...and anyone signed in can manage them from the Settings screen.
-- Both of you are trusted editors, so this is deliberately simple.
create policy "manage statuses" on statuses
  for all to authenticated using (true) with check (true);
create policy "manage link kinds" on link_kinds
  for all to authenticated using (true) with check (true);
create policy "manage groups" on groups
  for all to authenticated using (true) with check (true);
