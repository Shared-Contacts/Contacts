-- ============================================================
-- Contacts database - Step 5: boat notes, pets as a list
-- Paste into the Supabase SQL Editor and Run.
-- ============================================================

-- ---------- Notes about the boat ----------
alter table contacts add column boat_notes text;


-- ---------- Kinds of pet, editable in Settings ----------
create table pet_types (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  sort_order int default 100
);

insert into pet_types (name, sort_order) values
  ('Dog', 10), ('Cat', 20), ('Bird', 30), ('Horse', 40),
  ('Fish', 50), ('Rabbit', 60), ('Other', 70);

alter table pet_types enable row level security;

create policy "read pet types" on pet_types
  for select to authenticated using (true);
create policy "manage pet types" on pet_types
  for all to authenticated using (true) with check (true);


-- ---------- Pets become a list, like phones and emails ----------
alter table contacts add column pets jsonb not null default '[]'::jsonb;

update contacts set pets =
  case when pet_names is not null and btrim(pet_names) <> ''
    then jsonb_build_array(jsonb_build_object('label','Dog','value',pet_names))
    else '[]'::jsonb end;

alter table contacts drop column pet_names;
