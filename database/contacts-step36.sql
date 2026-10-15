-- ============================================================
-- Contacts database - Step 36: accounts belong to somebody
--
-- Until now the finances were all or nothing: whoever was in the
-- books saw every penny of them. This makes an account belong to
-- the person who made it, private unless they share it.
--
-- Finances is open to everyone signed in from now on. Open it and
-- you see your own accounts and nobody else's, until somebody
-- shares one with you.
--
-- NOTHING YOU CAN SEE TODAY DISAPPEARS. Every account that exists
-- now is shared with everybody who is in the books now, so the
-- morning after this runs looks exactly like the evening before.
-- It is only new accounts that start private.
--
-- Run step 35 first. Safe to run more than once.
-- ============================================================


-- ---------- Who an account is shared with ----------
create table if not exists account_shares (
  account_id bigint not null references accounts on delete cascade,
  viewer_id  uuid   not null references profiles on delete cascade,
  can_edit   boolean not null default true,
  created_at timestamptz default now(),
  primary key (account_id, viewer_id)
);

create index if not exists account_shares_viewer_idx on account_shares (viewer_id);

comment on table account_shares is
  'Who else may see an account. can_edit false means they can look but '
  'not touch - useful for an accountant, or for showing somebody where '
  'the money went without letting them change it.';


-- ---------- Every account needs an owner ----------
-- A few may have none, if whoever made them was removed. Give those to
-- the longest-standing member rather than leaving them orphaned and
-- invisible to everybody.
update accounts set created_by = (
  select user_id from finance_members order by added_at limit 1)
where created_by is null;


-- ---------- Nothing vanishes overnight ----------
-- Everyone who can see the books today keeps seeing everything today.
--
-- This must happen exactly once, and it is written down when it does.
-- Run it a second time a month from now and it would cheerfully share
-- every account made since with everybody who used to be in the books —
-- including private ones, and including shares somebody had deliberately
-- walked away from. Once is a migration; twice is a leak.
create table if not exists finance_migrations (
  step   text primary key,
  ran_at timestamptz default now()
);

insert into account_shares (account_id, viewer_id, can_edit)
select a.id, m.user_id, true
from accounts a
cross join finance_members m
where m.user_id is distinct from a.created_by
  and not exists (select 1 from finance_migrations where step = '36-backfill')
on conflict (account_id, viewer_id) do nothing;

insert into finance_migrations (step) values ('36-backfill')
on conflict (step) do nothing;


-- ---------- The two questions every rule below asks ----------
-- Raised rights, so the rules do not chase their own tail.
create or replace function can_see_account(aid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from accounts a where a.id = aid and a.created_by = auth.uid()
  ) or exists (
    select 1 from account_shares s
    where s.account_id = aid and s.viewer_id = auth.uid()
  );
$$;

create or replace function can_edit_account(aid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from accounts a where a.id = aid and a.created_by = auth.uid()
  ) or exists (
    select 1 from account_shares s
    where s.account_id = aid and s.viewer_id = auth.uid() and s.can_edit
  );
$$;

-- Line items and files hang off a transaction, which hangs off an account.
create or replace function can_see_txn(tid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from transactions t
                 where t.id = tid and can_see_account(t.account_id));
$$;

create or replace function can_edit_txn(tid bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from transactions t
                 where t.id = tid and can_edit_account(t.account_id));
$$;


-- ---------- Where the bank files are kept ----------
create table if not exists bank_files (
  id          bigint generated always as identity primary key,
  account_id  bigint not null references accounts on delete cascade,
  name        text not null,              -- what the bank called it
  path        text not null,              -- where it sits in storage
  bytes       bigint,
  covers_from date,
  covers_to   date,
  rows_seen   int,
  rows_taken  int,
  note        text,
  created_by  uuid references profiles on delete set null,
  created_at  timestamptz default now()
);

create index if not exists bank_files_account_idx
  on bank_files (account_id, created_at desc);

comment on table bank_files is
  'The statement files as they came off the bank, kept beside the account '
  'they were imported into. The figures are in the transactions; this is the '
  'paperwork behind them.';


-- ---------- The rules ----------
alter table account_shares enable row level security;
alter table bank_files     enable row level security;

-- Accounts. Yours, or shared with you. Only the owner may rename, re-open
-- or remove one — a guest must not be able to move the goalposts.
drop policy if exists "the books"        on accounts;
drop policy if exists "see my accounts"  on accounts;
drop policy if exists "make an account"  on accounts;
drop policy if exists "change my account" on accounts;
drop policy if exists "remove my account" on accounts;

create policy "see my accounts" on accounts
  for select to authenticated
  using (created_by = auth.uid()
         or exists (select 1 from account_shares s
                    where s.account_id = accounts.id and s.viewer_id = auth.uid()));

create policy "make an account" on accounts
  for insert to authenticated with check (created_by = auth.uid());

create policy "change my account" on accounts
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "remove my account" on accounts
  for delete to authenticated using (created_by = auth.uid());

-- Who an account is shared with: the owner decides, and anybody who can see
-- the account can see who else can.
drop policy if exists "see who shares"    on account_shares;
drop policy if exists "share my account"  on account_shares;
drop policy if exists "unshare my account" on account_shares;
drop policy if exists "change a share"    on account_shares;

create policy "see who shares" on account_shares
  for select to authenticated
  using (viewer_id = auth.uid() or can_see_account(account_id));

create policy "share my account" on account_shares
  for insert to authenticated
  with check (exists (select 1 from accounts a
                      where a.id = account_id and a.created_by = auth.uid()));

create policy "change a share" on account_shares
  for update to authenticated
  using (exists (select 1 from accounts a
                 where a.id = account_id and a.created_by = auth.uid()));

-- The owner can withdraw it; you can always walk away from one yourself.
create policy "unshare my account" on account_shares
  for delete to authenticated
  using (viewer_id = auth.uid()
         or exists (select 1 from accounts a
                    where a.id = account_id and a.created_by = auth.uid()));

-- Transactions and everything hanging off them follow their account.
drop policy if exists "the books" on transactions;
drop policy if exists "the books" on transaction_items;
drop policy if exists "the books" on statements;
drop policy if exists "the books" on import_maps;

drop policy if exists "see transactions"    on transactions;
drop policy if exists "change transactions" on transactions;
create policy "see transactions" on transactions
  for select to authenticated using (can_see_account(account_id));
create policy "change transactions" on transactions
  for all to authenticated
  using (can_edit_account(account_id)) with check (can_edit_account(account_id));

drop policy if exists "see items"    on transaction_items;
drop policy if exists "change items" on transaction_items;
create policy "see items" on transaction_items
  for select to authenticated using (can_see_txn(transaction_id));
create policy "change items" on transaction_items
  for all to authenticated
  using (can_edit_txn(transaction_id)) with check (can_edit_txn(transaction_id));

drop policy if exists "see statements"    on statements;
drop policy if exists "change statements" on statements;
create policy "see statements" on statements
  for select to authenticated using (can_see_account(account_id));
create policy "change statements" on statements
  for all to authenticated
  using (can_edit_account(account_id)) with check (can_edit_account(account_id));

drop policy if exists "see import maps"    on import_maps;
drop policy if exists "change import maps" on import_maps;
create policy "see import maps" on import_maps
  for select to authenticated
  using (account_id is null or can_see_account(account_id));
create policy "change import maps" on import_maps
  for all to authenticated
  using (account_id is null or can_edit_account(account_id))
  with check (account_id is null or can_edit_account(account_id));

drop policy if exists "see bank files"    on bank_files;
drop policy if exists "change bank files" on bank_files;
create policy "see bank files" on bank_files
  for select to authenticated using (can_see_account(account_id));
create policy "change bank files" on bank_files
  for all to authenticated
  using (can_edit_account(account_id)) with check (can_edit_account(account_id));


-- ---------- The lists everybody draws on ----------
-- Currencies, categories and payees stay common to everyone. They have to
-- be: share an account and the other person must be able to read the
-- category and the payee on its transactions, or they would be looking at
-- rows of blanks. Worth knowing that these lists are not private - the
-- amounts and the accounts are.
drop policy if exists "the books" on currencies;
drop policy if exists "the books" on categories;
drop policy if exists "the books" on payees;

drop policy if exists "the common lists" on currencies;
drop policy if exists "the common lists" on categories;
drop policy if exists "the common lists" on payees;

create policy "the common lists" on currencies
  for all to authenticated using (true) with check (true);
create policy "the common lists" on categories
  for all to authenticated using (true) with check (true);
create policy "the common lists" on payees
  for all to authenticated using (true) with check (true);


-- ---------- Finances is open to everyone now ----------
-- finance_members is kept only so this file can be run twice without
-- losing the record of who was in the books. Nothing reads it any more.
comment on table finance_members is
  'No longer decides anything. Accounts belong to people now, and are '
  'shared one at a time. Kept so this migration can be run again safely.';


-- ---------- Receipts and bank files in storage ----------
-- Both live under  fin/<account id>/...  so one rule covers them, and the
-- rule is the same question the rest of this file asks: is that account
-- yours, or shared with you?
drop policy if exists "see finance files"    on storage.objects;
drop policy if exists "add finance files"    on storage.objects;
drop policy if exists "remove finance files" on storage.objects;

create policy "see finance files" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos'
         and (storage.foldername(name))[1] = 'fin'
         and can_see_account(((storage.foldername(name))[2])::bigint));

create policy "add finance files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos'
              and (storage.foldername(name))[1] = 'fin'
              and can_edit_account(((storage.foldername(name))[2])::bigint));

create policy "remove finance files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos'
         and (storage.foldername(name))[1] = 'fin'
         and can_edit_account(((storage.foldername(name))[2])::bigint));


-- ============================================================
-- Check
-- ============================================================
-- Who owns what, and who else can see it. Run this after and the
-- picture should be the same as it was before.
select a.name as account,
       p.display_name as "belongs to",
       coalesce(string_agg(v.display_name, ', ' order by v.display_name),
                '— nobody else') as "shared with"
from accounts a
left join profiles p on p.id = a.created_by
left join account_shares s on s.account_id = a.id
left join profiles v on v.id = s.viewer_id
group by a.id, a.name, p.display_name, a.sort
order by a.sort, a.name;

-- And the rules that are now in force on the money tables.
select tablename as "table", policyname as "rule", cmd as "applies to"
from pg_policies
where schemaname = 'public'
  and tablename in ('accounts','account_shares','transactions',
                    'transaction_items','statements','bank_files')
order by tablename, policyname;
