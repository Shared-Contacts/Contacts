-- ============================================================
-- Contacts database - Step 37: accounts know which bank they belong to
--
-- Four Revolut accounts, two Barclays, a tin of cash and some
-- Premium Bonds all in one flat list is a lot to read past. This
-- adds a group to each account so the Finances screen can fold
-- them together, each group with a total of its own.
--
-- The group is just a word you choose. Barclays, Revolut, Cash,
-- Premium Bonds, American Express - whatever you would say out loud.
-- Accounts sharing a word are folded together; the rest sit under
-- "Other".
--
-- Run step 36 first. Safe to run more than once.
-- ============================================================


alter table accounts add column if not exists group_name text;

comment on column accounts.group_name is
  'The bank, or the kind of money it is. Accounts sharing one are shown '
  'folded together with a total. Empty means it sits under "Other".';

-- Step 36 makes this; here in case the files are run out of order.
create table if not exists finance_migrations (
  step   text primary key,
  ran_at timestamptz default now()
);


-- ---------- A first guess, once ----------
-- The first word of the account name is usually the bank: "Barclays Ovrdft"
-- is Barclays, "Revolut - Barry Eur" is Revolut. It is only a guess, and you
-- can type over any of it under Settings > Finances > Accounts.
--
-- It happens once and the fact is written down, so running this file again
-- never undoes the names you have corrected by hand.
do $$
begin
  if not exists (select 1 from finance_migrations where step = '37-groups') then

    -- The word as you wrote it, not tidied up: ASB should not come out "Asb".
    update accounts
    set group_name = split_part(btrim(name), ' ', 1)
    where coalesce(btrim(group_name), '') = '';

    -- The few the first word gets wrong, named properly while we are here.
    update accounts set group_name = 'American Express'
      where group_name in ('Amex', 'American') or name ilike 'amex%';
    update accounts set group_name = 'Premium Bonds'
      where group_name = 'Premium' or name ilike 'premium bond%';
    update accounts set group_name = 'Cash'
      where name ilike 'cash%' or name ilike 'petty cash%';

    insert into finance_migrations (step) values ('37-groups');
  end if;
end $$;


-- ============================================================
-- Check
-- ============================================================
-- Your accounts as the Finances screen will now show them. Type over
-- anything that reads wrong in Settings > Finances > Accounts.
select coalesce(nullif(btrim(group_name), ''), 'Other') as "group",
       string_agg(name, ', ' order by sort, name)       as "accounts",
       count(*)                                         as "how many"
from accounts
group by 1
order by 1;
