-- ============================================================
-- Contacts database - Step 59: bank details on an account
--
-- Three new boxes on each account in Settings > Finances: the sort
-- code, the account number and the international number (IBAN).
-- The app tidies each one into the way it is usually written before
-- saving it, so they are plain text here with no rule on what they
-- may say (a New Zealand or foreign account then needs no step).
--
-- Anyone who can see an account already sees these too; only its
-- owner can change them, the same as its name. No new rules needed.
--
-- New columns, not a new table, so the backup scripts are unchanged:
-- they already take every column of accounts.
-- Safe to run more than once.
-- ============================================================

alter table accounts add column if not exists sort_code      text;
alter table accounts add column if not exists account_number text;
alter table accounts add column if not exists iban           text;

comment on column accounts.sort_code is
  'UK sort code, kept as 20-00-00.';
comment on column accounts.account_number is
  'The account number: 8 digits for a UK account, 12-3456-1234567-00 for a New Zealand one.';
comment on column accounts.iban is
  'The international number, in capitals in groups of four.';


-- ---------- Check it took ----------
-- You should see 3 lines: account_number, iban and sort_code, all text.
select column_name::text as "column", data_type::text as "kind"
from information_schema.columns
where table_schema = 'public' and table_name = 'accounts'
  and column_name in ('sort_code', 'account_number', 'iban')
order by column_name;
