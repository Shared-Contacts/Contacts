-- ============================================================
-- Contacts database - Step 35: the cashbook
--
-- A proper set of books. A transaction is the whole event (a
-- shop visit, a direct debit, a payment in); the items beneath
-- it are what the money was actually for, so one trip to the
-- supermarket can split across four categories.
--
-- Everything here is shared between the people listed in
-- finance_members. Nobody else using the app can see a penny of
-- it, including through the sharing and messaging already built.
--
-- ONE RULE RUNS THROUGH ALL OF THIS: amounts are signed.
-- Money leaving the account is negative, money arriving is
-- positive. You never type a minus sign - the app works it out
-- from whether you chose Income, Expense, Refund or Transfer.
-- It means an account balance is nothing more than the opening
-- balance plus everything since.
--
-- Safe to run more than once.
-- ============================================================


-- ---------- Who the books belong to ----------
create table if not exists finance_members (
  user_id  uuid primary key references profiles on delete cascade,
  added_at timestamptz default now()
);

comment on table finance_members is
  'Who can see the finances. Everyone in here sees all of it. '
  'Other people using the app see none of it.';

-- Whoever set the app up starts as the only member.
insert into finance_members (user_id)
select id from profiles order by created_at limit 1
on conflict (user_id) do nothing;

-- Asked constantly by the rules below, so it runs with raised rights
-- to keep it quick and to stop the rules chasing their own tail.
create or replace function in_books()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from finance_members where user_id = auth.uid());
$$;


-- ---------- Currencies ----------
create table if not exists currencies (
  code   text primary key,          -- GBP, NZD ...
  name   text not null,
  symbol text,
  sort   int  default 0
);

insert into currencies (code, name, symbol, sort) values
  ('GBP', 'Pound sterling',    '£', 1),
  ('NZD', 'New Zealand dollar','$', 2),
  ('EUR', 'Euro',              '€', 3),
  ('USD', 'US dollar',         '$', 4)
on conflict (code) do nothing;


-- ---------- What the money was for ----------
create table if not exists categories (
  id         bigint generated always as identity primary key,
  code       text,                  -- your own shorthand, if you want one
  name       text not null,
  kind       text not null default 'expense'
             check (kind in ('income','expense','both')),
  business   boolean not null default false,   -- what new lines assume
  sort       int default 0,
  active     boolean not null default true,
  created_by uuid references profiles on delete set null,
  created_at timestamptz default now()
);

create unique index if not exists categories_name_idx on categories (lower(name));

-- A starting set. Rename, delete or add to them freely - nothing
-- depends on these particular words.
insert into categories (name, kind, business, sort) values
  ('Mooring',              'expense', false, 10),
  ('Boat licence',         'expense', false, 20),
  ('Boat insurance',       'expense', false, 30),
  ('Boat maintenance',     'expense', false, 40),
  ('Diesel',               'expense', false, 50),
  ('Gas',                  'expense', false, 60),
  ('Coal and wood',        'expense', false, 70),
  ('Pump out',             'expense', false, 80),
  ('Groceries',            'expense', false, 90),
  ('Eating out',           'expense', false, 100),
  ('Phone and internet',   'expense', false, 110),
  ('Subscriptions',        'expense', false, 120),
  ('Travel',               'expense', false, 130),
  ('Clothes',              'expense', false, 140),
  ('Gifts',                'expense', false, 150),
  ('Bank charges',         'expense', false, 160),
  ('Photography equipment','expense', true,  200),
  ('Photography expenses', 'expense', true,  210),
  ('Stock library sales',  'income',  true,  300),
  ('Photography sales',    'income',  true,  310),
  ('Pension',              'income',  false, 400),
  ('Interest',             'income',  false, 410),
  ('Other income',         'income',  false, 420)
on conflict do nothing;


-- ---------- Who you paid, or who paid you ----------
create table if not exists payees (
  id          bigint generated always as identity primary key,
  name        text not null,
  contact_id  bigint references contacts on delete set null,
  category_id bigint references categories on delete set null, -- what it usually is
  notes       text,
  created_by  uuid references profiles on delete set null,
  created_at  timestamptz default now()
);

create unique index if not exists payees_name_idx on payees (lower(name));

comment on column payees.contact_id is
  'Optional. For payees who are also in your contacts - a tradesman, '
  'a friend you split a bill with. Shops leave this blank.';

comment on column payees.category_id is
  'What this payee is usually for, so the category fills itself in.';


-- ---------- The accounts ----------
create table if not exists accounts (
  id              bigint generated always as identity primary key,
  name            text not null,
  kind            text not null default 'current'
                  check (kind in ('current','savings','credit card','cash','processor')),
  currency        text not null default 'GBP' references currencies,
  opening_balance numeric(14,2) not null default 0,
  opening_date    date not null default current_date,
  active          boolean not null default true,
  sort            int default 0,
  notes           text,
  created_by      uuid references profiles on delete set null,
  created_at      timestamptz default now()
);

comment on column accounts.opening_balance is
  'What was in it on the opening date. Every balance the app shows is '
  'this plus everything recorded since, so get it right and the rest follows.';

comment on column accounts.kind is
  'A credit card normally sits negative - that is money you owe, not money you have.';


-- ---------- Bank statements ----------
-- Ticking things off proves nothing on its own. What catches a missing
-- transaction is the closing balance: tick until the difference is zero.
create table if not exists statements (
  id              bigint generated always as identity primary key,
  account_id      bigint not null references accounts on delete cascade,
  ends_on         date not null,
  closing_balance numeric(14,2) not null,
  locked          boolean not null default false,
  created_by      uuid references profiles on delete set null,
  created_at      timestamptz default now()
);

create unique index if not exists statements_one_per_date
  on statements (account_id, ends_on);

comment on column statements.locked is
  'Once this is on, nothing reconciled against it can be altered. '
  'Turn it off again if you need to put something right.';


-- ---------- The transactions ----------
create table if not exists transactions (
  id            bigint generated always as identity primary key,
  account_id    bigint not null references accounts on delete restrict,
  tdate         date   not null default current_date,
  kind          text   not null
                check (kind in ('income','expense','refund','transfer')),
  pay_method    text   check (pay_method in ('cash','debit card','credit card','auto','cheque','transfer','other')),
  payee_id      bigint references payees on delete set null,
  reference     text,                       -- cheque number, the bank's wording
  notes         text,
  business      boolean not null default false,
  total         numeric(14,2) not null default 0,  -- kept in step with the items

  -- A purchase abroad: the receipt said one thing, the statement another.
  orig_amount   numeric(14,2),
  orig_currency text references currencies,

  -- The two halves of a transfer share this, so they stay together.
  transfer_id   uuid,

  -- Reconciliation
  statement_id  bigint references statements on delete set null,
  reconciled    boolean not null default false,
  reconciled_on date,

  -- Receipts
  photos        jsonb not null default '[]'::jsonb,

  -- Imported from a bank file
  bank_ref      text,
  imported_at   timestamptz,

  created_by    uuid references profiles on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists transactions_account_idx on transactions (account_id, tdate desc);
create index if not exists transactions_date_idx    on transactions (tdate desc);
create index if not exists transactions_transfer_idx on transactions (transfer_id)
  where transfer_id is not null;
create index if not exists transactions_unreconciled_idx
  on transactions (account_id, tdate) where not reconciled;

-- The same line of a bank file can never come in twice.
create unique index if not exists transactions_bank_ref_idx
  on transactions (account_id, bank_ref) where bank_ref is not null;

comment on column transactions.total is
  'Signed, and worked out from the items - never typed in. Negative '
  'means the money left the account.';

comment on column transactions.transfer_id is
  'A transfer is two transactions, one leaving and one arriving, sharing '
  'this reference. They can land on different dates and reconcile against '
  'different statements, which is what really happens.';


-- ---------- What the money was actually for ----------
create table if not exists transaction_items (
  id             bigint generated always as identity primary key,
  transaction_id bigint not null references transactions on delete cascade,
  category_id    bigint references categories on delete set null,
  description    text,
  qty            numeric(12,3) not null default 1,
  amount         numeric(14,2) not null default 0,   -- one of them, signed
  business       boolean not null default false,
  sort           int default 0,
  line_total     numeric(14,2)
                 generated always as (round(qty * amount, 2)) stored
);

create index if not exists transaction_items_parent_idx
  on transaction_items (transaction_id);
create index if not exists transaction_items_category_idx
  on transaction_items (category_id);


-- ---------- Remembering the shape of each bank's file ----------
create table if not exists import_maps (
  id         bigint generated always as identity primary key,
  account_id bigint references accounts on delete cascade,
  name       text not null,
  map        jsonb not null,       -- which column is the date, the amount ...
  created_by uuid references profiles on delete set null,
  created_at timestamptz default now()
);


-- ---------- Keeping the total honest ----------
-- The transaction total is the sum of its items, always. It is worked out
-- here rather than in the app so the two can never drift apart.
create or replace function sync_transaction_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tid bigint := coalesce(new.transaction_id, old.transaction_id);
begin
  update transactions t
     set total = coalesce((select sum(i.line_total)
                             from transaction_items i
                            where i.transaction_id = tid), 0),
         updated_at = now()
   where t.id = tid;
  return null;
end $$;

drop trigger if exists transaction_items_total on transaction_items;
create trigger transaction_items_total
  after insert or update or delete on transaction_items
  for each row execute function sync_transaction_total();


-- ---------- Protecting a finished statement ----------
-- Once a statement is locked, what was reconciled against it stops moving.
create or replace function guard_locked_statement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sid bigint := coalesce(new.statement_id, old.statement_id);
begin
  if sid is not null
     and exists (select 1 from statements s where s.id = sid and s.locked) then
    raise exception
      'That statement is locked. Unlock it on the reconcile screen first.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists transactions_locked on transactions;
create trigger transactions_locked
  before update or delete on transactions
  for each row execute function guard_locked_statement();


-- ---------- Nobody else sees any of this ----------
alter table finance_members   enable row level security;
alter table currencies        enable row level security;
alter table categories        enable row level security;
alter table payees            enable row level security;
alter table accounts          enable row level security;
alter table statements        enable row level security;
alter table transactions      enable row level security;
alter table transaction_items enable row level security;
alter table import_maps       enable row level security;

-- Everything in the books works the same way: if you are in
-- finance_members you may read and write it, and if you are not, it does
-- not exist as far as you are concerned.
do $$
declare t text;
begin
  foreach t in array array['currencies','categories','payees','accounts',
                           'statements','transactions','transaction_items',
                           'import_maps']
  loop
    execute format('drop policy if exists "the books" on %I', t);
    execute format(
      'create policy "the books" on %I for all to authenticated '
      'using (in_books()) with check (in_books())', t);
  end loop;
end $$;

-- The member list itself: you can see who else is in the books, and the
-- people already in them decide who joins.
drop policy if exists "see the members"   on finance_members;
drop policy if exists "add a member"      on finance_members;
drop policy if exists "remove a member"   on finance_members;

create policy "see the members" on finance_members
  for select to authenticated using (in_books());

create policy "add a member" on finance_members
  for insert to authenticated with check (in_books());

create policy "remove a member" on finance_members
  for delete to authenticated using (in_books());


-- ---------- Balances, worked out here rather than on the phone ----------
-- A balance is the opening balance plus everything since. Asking the database
-- for the answer means the app never has to drag years of transactions down a
-- canal-side signal just to show you a number.
create or replace view account_balances
with (security_invoker = true) as
select a.id   as account_id,
       a.opening_balance
         + coalesce(sum(t.total), 0)                                as balance,
       a.opening_balance
         + coalesce(sum(t.total) filter (where t.reconciled), 0)    as cleared,
       coalesce(sum(t.total) filter (where not t.reconciled), 0)    as not_yet_reconciled,
       count(t.id)                                                  as transactions,
       max(t.tdate)                                                 as last_entry
from accounts a
left join transactions t on t.account_id = a.id
group by a.id, a.opening_balance;

comment on view account_balances is
  'security_invoker means this view obeys the same rules as the tables beneath '
  'it - someone outside the books gets nothing from it.';


-- ---------- Live updates ----------
do $$
begin
  alter publication supabase_realtime add table transactions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;


-- ============================================================
-- Check
-- ============================================================
select (select count(*) from finance_members) as people_in_the_books,
       (select count(*) from accounts)        as accounts,
       (select count(*) from categories)      as categories,
       (select count(*) from payees)          as payees,
       (select count(*) from transactions)    as transactions;

-- Who can see the finances at the moment:
select p.display_name, p.email
from finance_members m join profiles p on p.id = m.user_id
order by m.added_at;

-- ---------- Letting Sandra in ----------
-- Put her name exactly as it appears above in your contacts app, then
-- run just these two lines. You can also do this from the app later.
--
-- insert into finance_members (user_id)
-- select id from profiles where display_name = 'Sandra'
-- on conflict (user_id) do nothing;
