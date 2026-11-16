-- ============================================================
-- Contacts database - Step 62: SWIFT codes, phone dice for Loxx,
-- and the four parts of the UK on a contact
--
-- 1. A SWIFT code on each account (Settings > Finances), beside the
--    sort code, account number and IBAN from step 59. Plain text: the
--    app writes it in capitals and checks it before saving.
-- 2. Loxx with the phone's dice (ML203). A game can now be started
--    with the phone rolling the six dice: whoever is rolling taps
--    Roll, and everyone sees the same dice. Real dice on the table
--    work as before, and every game started before this step stays
--    a real-dice game. Two new functions; nothing step 57 or 58 made
--    is changed. It uses the dice column step 60 added for Pounds.
-- 3. Part of the UK on a contact: England, Scotland, Wales or
--    Northern Ireland, with the country itself kept as United
--    Kingdom. Then, once, the contacts already saved are tidied:
--    UK, GB and Great Britain become United Kingdom, Wales (and
--    England, Scotland, Northern Ireland) become United Kingdom with
--    that as the part, NZ becomes New Zealand, Aus becomes Australia
--    and USA becomes United States. Nothing else is touched.
--
-- New columns, not new tables, so the backup scripts are unchanged:
-- they already take every column of accounts, games and contacts.
-- Safe to run more than once: the tidy only changes the short names,
-- and once they are gone it finds nothing more to do.
-- ============================================================



-- ---------- 1. SWIFT codes ----------
alter table accounts add column if not exists swift text;

comment on column accounts.swift is
  'The bank''s SWIFT (BIC) code, 8 or 11 letters and numbers, in capitals.';



-- ---------- 2. Loxx with the phone's dice ----------
comment on column games.dice is
  'The dice. Pounds: whoever''s turn it is (v, held, rolls). Loxx: the six dice of this roll '
  '(v: white, white, red, yellow, green, blue; 0 for a colour whose lock has closed) and the '
  'roll they are for (at). real: true for dice rolled on the table and typed in or marked.';

-- Starting a game of Loxx with the phone's dice (real_dice false). It
-- is step 57's new_game, with the dice noted on the game afterwards.
create or replace function new_loxx(players uuid[], first_seat int default 0,
                                    real_dice boolean default true)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  g bigint;
begin
  g := new_game(players, first_seat);
  update games set dice = jsonb_build_object('real', coalesce(real_dice, true))
   where id = g;
  return g;
end $$;

-- Rolling: only whoever is rolling, once a roll, in a game with the
-- phone's dice. d: {v: six numbers}, the two white dice 1 to 6, then
-- red, yellow, green and blue, each 1 to 6, or 0 once its lock has
-- closed. Answers 'ok', 'rolled' if the dice for this roll are already
-- out, 'moved' if the roll has passed on, or 'ended'.
create or replace function loxx_dice(g bigint, at_turn int, d jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
  v jsonb := d->'v';
  i int;
  c text;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if gm.kind <> 'lockkeeper' then
    raise exception 'That is not a game of Loxx';
  end if;
  if coalesce((gm.dice->>'real')::boolean, true) then
    raise exception 'This game is played with real dice';
  end if;
  if gm.status <> 'playing' then
    return 'ended';
  end if;
  if at_turn <> gm.turn_no then
    return 'moved';
  end if;
  if not exists (select 1 from game_players
                  where game_id = g and user_id = auth.uid() and seat = gm.turn) then
    raise exception 'It is not your roll';
  end if;
  if (gm.dice->>'at') is not null and (gm.dice->>'at')::int = at_turn then
    return 'rolled';
  end if;
  if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v) <> 6
     or exists (select 1 from jsonb_array_elements(v) x where x::text !~ '^[0-6]$') then
    raise exception 'Six dice, each 1 to 6';
  end if;
  if (v->>0)::int = 0 or (v->>1)::int = 0 then
    raise exception 'Both white dice are always rolled';
  end if;
  for i in 2..5 loop
    c := (array['red','yellow','green','blue'])[i - 1];
    if (gm.closed ? c) <> ((v->>i)::int = 0) then
      raise exception 'Only a colour whose lock has closed is left out';
    end if;
  end loop;
  update games
     set dice = jsonb_build_object('real', false, 'v', v, 'at', at_turn),
         updated_at = now()
   where id = g;
  return 'ok';
end $$;

revoke all on function new_loxx(uuid[], int, boolean) from public, anon;
revoke all on function loxx_dice(bigint, int, jsonb) from public, anon;
grant execute on function new_loxx(uuid[], int, boolean) to authenticated;
grant execute on function loxx_dice(bigint, int, jsonb) to authenticated;



-- ---------- 3. The four parts of the UK on a contact ----------
alter table contacts add column if not exists uk_part text;

comment on column contacts.uk_part is
  'For a contact in the United Kingdom: England, Scotland, Wales or Northern Ireland, or nothing.';

-- The contacts already saved, once. Spaces and full stops are ignored,
-- so U.K. and u k count as UK.
update contacts
   set uk_part = case lower(regexp_replace(country, '[.[:space:]]', '', 'g'))
                   when 'england' then 'England' when 'scotland' then 'Scotland'
                   when 'wales' then 'Wales' when 'northernireland' then 'Northern Ireland' end,
       country = 'United Kingdom'
 where lower(regexp_replace(country, '[.[:space:]]', '', 'g'))
       in ('england', 'scotland', 'wales', 'northernireland');

update contacts set country = 'United Kingdom'
 where lower(regexp_replace(country, '[.[:space:]]', '', 'g'))
       in ('uk', 'gb', 'greatbritain', 'britain', 'unitedkingdom')
   and country <> 'United Kingdom';

update contacts set country = 'New Zealand'
 where lower(regexp_replace(country, '[.[:space:]]', '', 'g')) in ('nz', 'newzealand', 'aotearoa')
   and country <> 'New Zealand';

update contacts set country = 'Australia'
 where lower(regexp_replace(country, '[.[:space:]]', '', 'g')) in ('aus', 'au', 'australia')
   and country <> 'Australia';

update contacts set country = 'United States'
 where lower(regexp_replace(country, '[.[:space:]]', '', 'g'))
       in ('usa', 'us', 'america', 'unitedstates', 'unitedstatesofamerica')
   and country <> 'United States';



-- ---------- Check it took ----------
-- You should see 5 lines, each with a tick in "ok": accounts swift,
-- contacts uk_part, function loxx_dice, function new_loxx, and
-- "short country names left: 0".
select 'accounts swift' as "what", '✓' as "ok" from information_schema.columns
 where table_schema = 'public' and table_name = 'accounts' and column_name = 'swift'
union all
select 'contacts uk_part', '✓' from information_schema.columns
 where table_schema = 'public' and table_name = 'contacts' and column_name = 'uk_part'
union all
select 'function ' || routine_name, '✓' from information_schema.routines
 where routine_schema = 'public' and routine_name in ('new_loxx', 'loxx_dice')
union all
select 'short country names left: ' || count(*), case when count(*) = 0 then '✓' else '✗' end from contacts
 where lower(regexp_replace(country, '[.[:space:]]', '', 'g'))
       in ('uk', 'gb', 'greatbritain', 'britain', 'nz', 'aus', 'au', 'usa', 'us',
           'england', 'scotland', 'wales', 'northernireland');
