-- Optional tidy-up for the Personal Contact Database project.
-- Only needed before you give a Calendar Club login to anyone who should NOT
-- be able to alter the contacts app's shared dropdown lists.
--
-- Change the email below if you sign in with a different one.
-- Reading these lists is untouched, so the contacts app carries on working
-- for everyone. Only the ability to add, rename and delete entries changes.

drop policy if exists "manage link kinds" on link_kinds;
drop policy if exists "manage pet types"  on pet_types;
drop policy if exists "manage statuses"   on statuses;

create policy "owner manages link kinds" on link_kinds for all to authenticated
  using      (auth.jwt() ->> 'email' = 'YOUR-EMAIL-HERE')
  with check (auth.jwt() ->> 'email' = 'YOUR-EMAIL-HERE');

create policy "owner manages pet types" on pet_types for all to authenticated
  using      (auth.jwt() ->> 'email' = 'YOUR-EMAIL-HERE')
  with check (auth.jwt() ->> 'email' = 'YOUR-EMAIL-HERE');

create policy "owner manages statuses" on statuses for all to authenticated
  using      (auth.jwt() ->> 'email' = 'YOUR-EMAIL-HERE')
  with check (auth.jwt() ->> 'email' = 'YOUR-EMAIL-HERE');
