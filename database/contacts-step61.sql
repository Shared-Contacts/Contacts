-- ============================================================
-- Contacts database - Step 61: Books
--
-- Favourite books, the ones being read and the ones still to read.
--
--   books         one row per book: title, author, series and its
--                 number, ISBN, format, read / reading / want to
--                 read and the day it was finished, your stars and
--                 notes, price, bought from, borrowed from, lent to
--                 and when, links to reviews elsewhere (links, as
--                 {url, quote}) and photos ({path}, the cover first).
--                 Bought from, borrowed from and lent to can each be a
--                 contact: the name is kept as well, for someone who
--                 cannot see that contact.
--   book_reviews  everyone else's stars and a few words: one each,
--                 from the people a book is shared with.
--
-- Yours only, unless you tick people under "Share with": they can
-- see it and add their own review, but only you can change the book.
--
-- Photos are stored as  bk/<owner's user id>/<random name>.jpg
--
-- Two new tables: books and book_reviews. Both backup scripts have
-- been updated to take them (same session, 11 Nov 2026).
-- Safe to run more than once.
-- ============================================================


-- ---------- The books ----------
create table if not exists books (
  id               bigint generated always as identity primary key,
  created_by       uuid not null default auth.uid() references profiles on delete cascade,
  title            text not null,
  author           text,
  series           text,
  series_no        text,                     -- 3, or 3.5 for one in between
  isbn             text,
  format           text check (format in ('hardback','paperback','ebook','audiobook','other')),
  status           text not null default 'read' check (status in ('read','reading','want')),
  finished_on      date,
  stars            smallint check (stars between 1 and 5),
  notes            text,
  price            numeric(12,2),
  bought_from      text,
  bought_from_id   bigint,                   -- a contact, when it is one
  borrowed_from    text,
  borrowed_from_id bigint,
  lent_to          text,
  lent_to_id       bigint,
  lent_on          date,
  links            jsonb not null default '[]',   -- [{url, quote}]
  photos           jsonb not null default '[]',   -- [{path}], the cover first
  shared_with      uuid[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists books_owner_idx on books (created_by);

comment on table books is
  'Books. Seen by the owner and anyone in shared_with; changed only by the owner.';

-- ---------- Everyone else's say ----------
create table if not exists book_reviews (
  id          bigint generated always as identity primary key,
  book_id     bigint not null references books on delete cascade,
  user_id     uuid not null default auth.uid() references profiles on delete cascade,
  stars       smallint check (stars between 1 and 5),
  words       text,
  updated_at  timestamptz not null default now(),
  unique (book_id, user_id)
);

comment on table book_reviews is
  'One review each a book, by the people it is shared with. Each changes only their own.';


-- ---------- Who may see and change them ----------
-- The rules for reviews ask this rather than reading books themselves.
create or replace function book_seen_by_me(bid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from books b where b.id = bid
                 and (b.created_by = auth.uid() or auth.uid() = any(b.shared_with)));
$$;

alter table books        enable row level security;
alter table book_reviews enable row level security;

drop policy if exists "see books"    on books;
drop policy if exists "add books"    on books;
drop policy if exists "change books" on books;
drop policy if exists "remove books" on books;

create policy "see books" on books for select to authenticated
  using (created_by = auth.uid() or auth.uid() = any(shared_with));
create policy "add books" on books for insert to authenticated
  with check (created_by = auth.uid());
create policy "change books" on books for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "remove books" on books for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "see book reviews"    on book_reviews;
drop policy if exists "add book reviews"    on book_reviews;
drop policy if exists "change book reviews" on book_reviews;
drop policy if exists "remove book reviews" on book_reviews;

create policy "see book reviews" on book_reviews for select to authenticated
  using (book_seen_by_me(book_id));
create policy "add book reviews" on book_reviews for insert to authenticated
  with check (user_id = auth.uid() and book_seen_by_me(book_id));
create policy "change book reviews" on book_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and book_seen_by_me(book_id));
create policy "remove book reviews" on book_reviews for delete to authenticated
  using (user_id = auth.uid());


-- ---------- Photos ----------
-- A photo can be seen by whoever can see the book it is on.
create or replace function book_file_seen_by_me(p text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from books b
    where b.photos @> jsonb_build_array(jsonb_build_object('path', p))
      and (b.created_by = auth.uid() or auth.uid() = any(b.shared_with)));
$$;

drop policy if exists "see book photos"    on storage.objects;
drop policy if exists "add book photos"    on storage.objects;
drop policy if exists "remove book photos" on storage.objects;

create policy "see book photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and name like 'bk/%'
         and (name like 'bk/' || auth.uid()::text || '/%'
              or book_file_seen_by_me(name)));

create policy "add book photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and name like 'bk/' || auth.uid()::text || '/%');

create policy "remove book photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and name like 'bk/' || auth.uid()::text || '/%');


-- ---------- Check it took ----------
-- You should see 13 lines: 4 rules on books, 4 on book_reviews,
-- 3 storage rules with "book photos", and the 2 new tables.
select 'rule on ' || tablename::text as "what", policyname::text as "name", cmd::text as "kind"
from pg_policies
where schemaname = 'public' and tablename in ('books','book_reviews')
union all
select 'storage rule', policyname::text, cmd::text
from pg_policies
where schemaname = 'storage' and policyname like '%book photos%'
union all
select 'table', table_name::text, ''
from information_schema.tables
where table_schema = 'public' and table_name in ('books','book_reviews')
order by 1, 2;
