-- ============================================================
-- Contacts database - Step 1: tables
-- Paste this whole file into the Supabase SQL Editor and Run.
-- Safe to run once. Running it twice will error (tables exist).
-- ============================================================

-- ---------- People who can log in ----------
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  email        text,
  created_at   timestamptz default now()
);

-- Automatically create a profile row when someone signs up
create function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ---------- Groups (your Association values) ----------
create table groups (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  sort_order int default 100
);

insert into groups (name, sort_order) values
  ('Family', 10),
  ('Friend', 20),
  ('Friend''s Family', 30),
  ('Boater', 40),
  ('D&K', 50),
  ('Professional', 60),
  ('Casual', 70);


-- ---------- Who can use which group ----------
create table group_members (
  group_id bigint not null references groups on delete cascade,
  user_id  uuid   not null references profiles on delete cascade,
  role     text   not null default 'editor' check (role in ('editor','viewer')),
  primary key (group_id, user_id)
);


-- ---------- The contacts themselves ----------
create table contacts (
  id            bigint generated always as identity primary key,
  created_by    uuid references profiles on delete set null,

  -- names
  first_name    text,
  last_name     text,
  given_names   text,
  nickname      text,

  -- dates
  birth_date    date,
  death_date    date,

  -- contact details
  mobile        text,
  phone         text,
  email         text,
  website       text,

  -- where they are
  address       text,
  town          text,
  postcode      text,
  country       text,
  latitude      numeric,
  longitude     numeric,

  -- work
  employer      text,
  job_title     text,

  -- social
  facebook      text,
  instagram     text,
  bluesky       text,
  other_social  text,

  -- boat
  boat_name     text,
  boat_number   text,

  -- personal
  partner_status text,
  pet_names     text,
  met_where     text,
  met_date      date,
  notes         text,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Fast free-text search across the fields you'd actually search on
create index contacts_search_idx on contacts using gin (
  to_tsvector('english',
    coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
    coalesce(nickname,'')   || ' ' || coalesce(boat_name,'') || ' ' ||
    coalesce(town,'')       || ' ' || coalesce(employer,'')  || ' ' ||
    coalesce(met_where,'')  || ' ' || coalesce(notes,'')
  )
);

create index contacts_last_name_idx on contacts (last_name);
create index contacts_birth_date_idx on contacts (birth_date);


-- ---------- A contact can be in several groups ----------
create table contact_groups (
  contact_id bigint not null references contacts on delete cascade,
  group_id   bigint not null references groups   on delete cascade,
  primary key (contact_id, group_id)
);


-- ---------- Links between contacts (no two-per-field limit) ----------
create table relationships (
  id            bigint generated always as identity primary key,
  from_contact  bigint not null references contacts on delete cascade,
  to_contact    bigint not null references contacts on delete cascade,
  kind          text   not null,
  notes         text,
  created_at    timestamptz default now(),
  check (from_contact <> to_contact),
  unique (from_contact, to_contact, kind)
);

create index relationships_from_idx on relationships (from_contact);
create index relationships_to_idx   on relationships (to_contact);

-- Suggested values for "kind" (not enforced, so you can add your own):
--   partner, spouse, ex-partner
--   parent of, child of, sibling of
--   works for, employs, colleague of
--   crew on, owns boat, moors near
--   friend of, met through


-- ---------- Keep updated_at current ----------
create function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_touch
  before update on contacts
  for each row execute function touch_updated_at();
