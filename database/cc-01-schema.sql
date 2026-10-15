-- Calendar Club database - table setup
-- Paste this into the Supabase SQL editor of your NEW project and press Run.
-- It creates seven empty tables. Run cc-02-data.sql afterwards to fill them.

-- Who is allowed in, and what they may do.
--   admin  - full access, and can manage this list
--   editor - can change stores, people and places
--   viewer - can look, but not change anything
create table cc_members (
  id         bigserial primary key,
  email      text not null unique,
  name       text,
  role       text not null default 'viewer' check (role in ('admin','editor','viewer')),
  created_at timestamptz default now()
);

create table cc_cities (
  id         bigserial primary key,
  name       text not null unique,
  created_at timestamptz default now()
);

create table cc_store_types (
  id                bigserial primary key,
  name              text not null unique,
  builders_required integer,
  grid_pallet       boolean default false,
  specialised_tools text,
  notes             text,
  created_at        timestamptz default now()
);

create table cc_people (
  id          bigserial primary key,
  name        text not null,
  role        text,
  other_roles text,
  email       text,
  phone1      text,
  phone2      text,
  details     text,
  address     text,
  city_id     bigint references cc_cities on delete set null,
  postcode    text,
  created_at  timestamptz default now()
);

create table cc_locations (
  id                 bigserial primary key,
  name               text not null unique,
  street_address     text,
  city_id            bigint references cc_cities on delete set null,
  postcode           text,
  store_location     text,
  delivery_location  text,
  parking_building   text,
  parking_location   text,
  parking_what3words text,
  parking_charges    text,
  notes              text,
  contact_person_id  bigint references cc_people on delete set null,
  created_at         timestamptz default now()
);

create table cc_shops (
  id                   bigserial primary key,
  name                 text not null,
  operating_year       text not null,
  city_id              bigint references cc_cities on delete set null,
  location_id          bigint references cc_locations on delete set null,
  type_id              bigint references cc_store_types on delete set null,
  store_status         text,
  operator_status      text,
  contract_signed      text,
  tm_id                bigint references cc_people on delete set null,
  lock_in_year         boolean,
  build_date           date,
  opening_date         date,
  closedown_date       date,
  tm_visit_1           timestamp,
  tm_visit_2           timestamp,
  delivery_booked      text,
  build_start_time     time,
  pallet_delivery_time time,
  tm_attending         boolean,
  permit_required      boolean,
  rams_sips_sent       boolean,
  build_signoff        boolean,          -- Gemma's head office sign-off
  budget               numeric,
  actual               numeric,
  dated_budget         numeric,
  dated_actual         numeric,
  gift_budget          numeric,
  gift_actual          numeric,
  pct_two_plus         numeric,
  commission_pct       numeric,
  notes                text,
  build_plan_url       text,
  layout_url           text,
  created_at           timestamptz default now()
);

-- Any number of people can be attached to a store, each with their own role.
create table cc_shop_people (
  id         bigserial primary key,
  shop_id    bigint not null references cc_shops on delete cascade,
  person_id  bigint not null references cc_people on delete cascade,
  role       text not null,
  created_at timestamptz default now(),
  unique (shop_id, person_id, role)
);

create index on cc_shops (operating_year);
create index on cc_shops (city_id);
create index on cc_shops (location_id);
create index on cc_shops (type_id);
create index on cc_shops (tm_id);
create index on cc_shop_people (shop_id);
create index on cc_shop_people (person_id);
create index on cc_people (name);
create index on cc_locations (city_id);
create index on cc_members (lower(email));

-- ------------------------------------------------------------------ security
-- Looks up the signed-in person's role. Runs as the owner so that the
-- policies below can read cc_members without checking cc_members again.
create or replace function cc_role() returns text
language sql stable security definer set search_path = public as $$
  select role from cc_members
   where lower(email) = lower(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'email')
   limit 1;
$$;

revoke all on function cc_role() from public, anon;
grant execute on function cc_role() to authenticated;

alter table cc_members     enable row level security;
alter table cc_cities      enable row level security;
alter table cc_store_types enable row level security;
alter table cc_people      enable row level security;
alter table cc_locations   enable row level security;
alter table cc_shops       enable row level security;
alter table cc_shop_people enable row level security;

-- Everyone on the list can read. Only editors and admins can change anything.
do $$
declare t text;
begin
  foreach t in array array['cc_cities','cc_store_types','cc_people','cc_locations',
                           'cc_shops','cc_shop_people']
  loop
    execute format(
      'create policy "members read" on %I for select to authenticated
         using (cc_role() is not null)', t);
    execute format(
      'create policy "editors add" on %I for insert to authenticated
         with check (cc_role() in (''admin'',''editor''))', t);
    execute format(
      'create policy "editors change" on %I for update to authenticated
         using (cc_role() in (''admin'',''editor''))
         with check (cc_role() in (''admin'',''editor''))', t);
    execute format(
      'create policy "editors remove" on %I for delete to authenticated
         using (cc_role() in (''admin'',''editor''))', t);
  end loop;
end $$;

-- The access list itself: everyone on it can see it, only admins can change it.
create policy "members read list" on cc_members for select to authenticated
  using (cc_role() is not null);
create policy "admins manage list" on cc_members for all to authenticated
  using (cc_role() = 'admin') with check (cc_role() = 'admin');

-- ---------------------------------------------------------- your own account
-- CHANGE THE EMAIL BELOW to the address you will sign in with, or you will
-- lock yourself out. Add Sandra and anyone else from inside the app afterwards.
insert into cc_members (email, name, role)
values ('YOUR-EMAIL-HERE', 'Barry Teutenberg', 'admin');
