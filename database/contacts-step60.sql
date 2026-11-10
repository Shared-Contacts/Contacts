-- ============================================================
-- Contacts database - Step 60: Pounds, a five-dice game in MY Games
--
-- Pounds is for 1 to 6 people, each on their own phone. Whoever's
-- turn it is rolls five dice up to three times, keeping any they
-- like, then fills one of the 13 boxes on their score sheet, and the
-- dice pass on. The phone can roll the dice, or real dice can be
-- rolled on the table and typed in (chosen when a game starts).
--
-- It uses the same two tables as Loxx (step 57): one more kind of
-- game is allowed, and each game gets a dice column, so everyone
-- can watch the dice as they are rolled. Three new functions, which
-- check it is your game and your turn; Stop game and Clear it away
-- are Loxx's own, which work for any game.
--
-- No new table, so the backup scripts need no change: they already
-- take every column of games. Nothing Loxx uses is changed.
-- Safe to run more than once.
-- ============================================================


-- ---------- Pounds is a kind of game ----------
-- Step 57 allowed only Loxx ('lockkeeper'). The old rule is found by
-- what it says rather than by its name, taken off, and put back with
-- Pounds in it.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.games'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.games drop constraint %I', c);
  end loop;
end $$;

alter table games add constraint games_kind_check
  check (kind in ('lockkeeper', 'pounds'));


-- ---------- The dice on the table ----------
-- What they show (v: five numbers, 0 for one not typed in yet), which
-- are held, how many rolls so far, and whether they are real dice.
alter table games add column if not exists dice jsonb not null default '{}';

comment on column games.dice is
  'Pounds: the dice of whoever''s turn it is (v, held, rolls) and whether they are real dice (real).';


-- ---------- Starting a game ----------
-- players: everyone in it, you included, in the order they play
-- (just you is a game on your own). first_seat: who goes first.
-- real_dice: rolled on the table and typed in, rather than by the phone.
create or replace function new_pounds(players uuid[], first_seat int default 0,
                                      real_dice boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  g bigint;
  n int := coalesce(array_length(players, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if not (auth.uid() = any(players)) then
    raise exception 'You need to be one of the players';
  end if;
  if n < 1 or n > 6 then
    raise exception 'Pounds is for 1 to 6 players';
  end if;
  if (select count(distinct x) from unnest(players) x) <> n then
    raise exception 'Someone is in the list twice';
  end if;
  if (select count(*) from profiles where id = any(players)) <> n then
    raise exception 'There is nobody with that sign-in';
  end if;
  insert into games (kind, created_by, turn, dice)
    values ('pounds', auth.uid(), greatest(0, least(coalesce(first_seat, 0), n - 1)),
            jsonb_build_object('real', coalesce(real_dice, false)))
    returning id into g;
  insert into game_players (game_id, user_id, seat)
    select g, players[i], i - 1 from generate_subscripts(players, 1) i;
  return g;
end $$;


-- ---------- Rolling ----------
-- Only whoever's turn it is. d: {v: five numbers 0 to 6, held: five
-- true or false, rolls: 0 to 3}. Answers 'ok', or 'moved' if the turn
-- has already passed on, or 'ended'.
create or replace function pounds_dice(g bigint, at_turn int, d jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if gm.kind <> 'pounds' then
    raise exception 'That is not a game of Pounds';
  end if;
  if gm.status <> 'playing' then
    return 'ended';
  end if;
  if at_turn <> gm.turn_no then
    return 'moved';
  end if;
  if not exists (select 1 from game_players
                  where game_id = g and user_id = auth.uid() and seat = gm.turn) then
    raise exception 'It is not your turn';
  end if;
  if jsonb_typeof(d->'v') is distinct from 'array' or jsonb_array_length(d->'v') <> 5
     or exists (select 1 from jsonb_array_elements(d->'v') x where x::text !~ '^[0-6]$') then
    raise exception 'Five dice, each 1 to 6';
  end if;
  if coalesce(d->>'rolls', '') !~ '^[0-3]$' then
    raise exception 'Three rolls is the most';
  end if;
  update games
     set dice = jsonb_build_object(
           'real',  coalesce((gm.dice->>'real')::boolean, false),
           'v',     d->'v',
           'held',  case when jsonb_typeof(d->'held') = 'array' then d->'held' else '[]'::jsonb end,
           'rolls', (d->>'rolls')::int,
           'at',    at_turn),
         updated_at = now()
   where id = g;
  return 'ok';
end $$;


-- ---------- Filling a box ----------
-- Only whoever's turn it is, one box a turn: the sheet must have every
-- box it had before, unchanged, and exactly one more. Then the dice pass
-- on, or, once everybody's 13 boxes are filled, the game ends.
-- Answers 'next', 'ended' or 'moved'.
create or replace function pounds_score(g bigint, at_turn int, s jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
  old jsonb;
  n int;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if gm.kind <> 'pounds' then
    raise exception 'That is not a game of Pounds';
  end if;
  if gm.status <> 'playing' then
    return 'ended';
  end if;
  if at_turn <> gm.turn_no then
    return 'moved';
  end if;
  select case when jsonb_typeof(sheet->'box') = 'object' then sheet->'box' else '{}'::jsonb end
    into old
    from game_players where game_id = g and user_id = auth.uid() and seat = gm.turn;
  if not found then
    raise exception 'It is not your turn';
  end if;
  if jsonb_typeof(s->'box') is distinct from 'object'
     or not (old <@ (s->'box'))
     or (select count(*) from jsonb_object_keys(s->'box'))
        <> (select count(*) from jsonb_object_keys(old)) + 1 then
    raise exception 'One box a turn, and the ones filled stay as they are';
  end if;

  update game_players set sheet = s, done_turn = greatest(done_turn, at_turn), updated_at = now()
   where game_id = g and user_id = auth.uid();

  if not exists (select 1 from game_players p
                  where p.game_id = g
                    and (select count(*) from jsonb_object_keys(
                          case when jsonb_typeof(p.sheet->'box') = 'object'
                               then p.sheet->'box' else '{}'::jsonb end)) < 13) then
    update games set status = 'ended', ended_at = now(), end_reason = 'Every box filled',
                     dice = jsonb_build_object('real', coalesce((gm.dice->>'real')::boolean, false)),
                     updated_at = now()
     where id = g;
    return 'ended';
  end if;

  select count(*) into n from game_players where game_id = g;
  update games set turn = (turn + 1) % n, turn_no = turn_no + 1,
                   dice = jsonb_build_object('real', coalesce((gm.dice->>'real')::boolean, false)),
                   updated_at = now()
   where id = g;
  return 'next';
end $$;


-- Signed-in people only.
revoke all on function new_pounds(uuid[], int, boolean) from public, anon;
revoke all on function pounds_dice(bigint, int, jsonb) from public, anon;
revoke all on function pounds_score(bigint, int, jsonb) from public, anon;
grant execute on function new_pounds(uuid[], int, boolean) to authenticated;
grant execute on function pounds_dice(bigint, int, jsonb) to authenticated;
grant execute on function pounds_score(bigint, int, jsonb) to authenticated;


-- ---------- Check ----------
-- It should show 5 lines: the rule on kind (with pounds in it), the
-- three functions, then the dice column.
select 'rule' as what, pg_get_constraintdef(oid) as name
  from pg_constraint
 where conrelid = 'public.games'::regclass and conname = 'games_kind_check'
union all
select 'column', column_name || ' ' || data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'games' and column_name = 'dice'
union all
select 'function', routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('new_pounds', 'pounds_dice', 'pounds_score')
order by 1 desc, 2;
