-- ============================================================
-- Contacts database - Step 57: MY Games, starting with Lock Keeper
--
-- Lock Keeper is a dice game for 2 to 5 people, played with real
-- dice, each on their own phone. The phones are linked: whose roll
-- it is passes round, a row closed by one player closes for all,
-- and the game ends for everyone at once.
--
-- Two new tables: games (one row per game) and game_players (who
-- is in it, in the order they roll, and each one's score sheet).
-- Only the players in a game can see it. Nothing is changed in them
-- directly: the app asks the functions below, which check who is
-- asking and that it is their game, their sheet and their turn.
--
-- Both backup scripts include the two tables from 5 Nov 2026, so
-- run this before the next backup. Nothing existing is changed.
-- Safe to run more than once.
-- ============================================================


-- ---------- The games ----------
create table if not exists games (
  id          bigint generated always as identity primary key,
  kind        text not null default 'lockkeeper' check (kind in ('lockkeeper')),
  created_by  uuid not null default auth.uid() references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  status      text not null default 'playing' check (status in ('playing','ended')),
  turn        int  not null default 0,          -- the seat of whoever is rolling
  turn_no     int  not null default 1,          -- counts up with every roll
  closed      jsonb not null default '{}',      -- a closed row: colour -> the roll it closed on
  ended_at    timestamptz,
  end_reason  text,
  updated_at  timestamptz not null default now()
);

comment on table games is
  'MY Games. One row per game; the players and their sheets are in game_players.';

alter table games enable row level security;


-- ---------- Who is playing, and their score sheets ----------
create table if not exists game_players (
  game_id    bigint not null references games on delete cascade,
  user_id    uuid   not null references profiles on delete cascade,
  seat       int    not null,                   -- 0 rolls first, then 1, and so on
  sheet      jsonb  not null default '{}',      -- the numbers marked, the penalties
  done_turn  int    not null default 0,         -- the last roll they have finished with
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat)
);

comment on column game_players.sheet is
  'The numbers marked in each row, the rows this player closed, and penalties.';

alter table game_players enable row level security;


-- ---------- The one question the rules ask ----------
-- "Am I playing in this game?"
create or replace function in_game(g bigint)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from game_players where game_id = g and user_id = auth.uid());
$$;

drop policy if exists "see my games" on games;
create policy "see my games" on games
  for select to authenticated using (in_game(id));

drop policy if exists "see the players in my games" on game_players;
create policy "see the players in my games" on game_players
  for select to authenticated using (in_game(game_id));

-- There are no rules for adding, changing or removing rows: that is
-- done only through the functions below.


-- ---------- Starting a game ----------
-- players: everyone in it, you included, in the order they roll.
-- first_seat: which of them rolls first (0 is the first in the list).
create or replace function new_game(players uuid[], first_seat int default 0)
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
  if n < 2 or n > 5 then
    raise exception 'Lock Keeper is for 2 to 5 players';
  end if;
  if (select count(distinct x) from unnest(players) x) <> n then
    raise exception 'Someone is in the list twice';
  end if;
  if (select count(*) from profiles where id = any(players)) <> n then
    raise exception 'There is nobody with that sign-in';
  end if;
  insert into games (created_by, turn)
    values (auth.uid(), greatest(0, least(coalesce(first_seat, 0), n - 1)))
    returning id into g;
  insert into game_players (game_id, user_id, seat)
    select g, players[i], i - 1 from generate_subscripts(players, 1) i;
  return g;
end $$;


-- ---------- Saving your own sheet ----------
create or replace function save_sheet(g bigint, s jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update game_players p set sheet = coalesce(s, '{}'), updated_at = now()
   where p.game_id = g and p.user_id = auth.uid()
     and exists (select 1 from games where id = g and status = 'playing');
  if not found then
    raise exception 'That game is not running, or you are not in it';
  end if;
end $$;


-- ---------- Closing a row ----------
-- Closed from the roll it happened on: marks made on that same roll
-- still count, and nobody can mark that colour after it.
create or replace function close_row(g bigint, colour text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if colour not in ('red', 'yellow', 'green', 'blue') then
    raise exception 'There is no % row', colour;
  end if;
  update games
     set closed = closed || jsonb_build_object(colour, turn_no), updated_at = now()
   where id = g and status = 'playing' and not (closed ? colour);
end $$;


-- ---------- Finishing with a roll ----------
-- Everyone taps Done when they have marked what they want from the
-- roll. Once all of them have, the dice pass to the next player, or
-- the game ends: two rows closed, or someone with four penalties.
-- Whoever is rolling can move on without someone who has wandered
-- off (move_on). Answers 'waiting', 'next', 'ended' or 'moved' (the
-- roll had already finished).
create or replace function finish_turn(g bigint, at_turn int, move_on boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
  n int;
  waiting int;
  why text;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if gm.status <> 'playing' then
    return 'ended';
  end if;
  if at_turn <> gm.turn_no then
    return 'moved';
  end if;

  update game_players set done_turn = greatest(done_turn, at_turn), updated_at = now()
   where game_id = g and user_id = auth.uid();

  select count(*) into n from game_players where game_id = g;
  select count(*) into waiting from game_players where game_id = g and done_turn < at_turn;
  if waiting > 0 and not (move_on and exists (
       select 1 from game_players where game_id = g and user_id = auth.uid() and seat = gm.turn)) then
    return 'waiting';
  end if;

  if (select count(*) from jsonb_object_keys(gm.closed)) >= 2 then
    why := 'Two rows closed';
  elsif exists (select 1 from game_players where game_id = g
                 and case when sheet->>'pen' ~ '^[0-9]+$' then (sheet->>'pen')::int else 0 end >= 4) then
    why := 'Four penalties';
  end if;

  if why is not null then
    update games set status = 'ended', ended_at = now(), end_reason = why, updated_at = now()
     where id = g;
    return 'ended';
  end if;

  update games set turn = (turn + 1) % n, turn_no = turn_no + 1, updated_at = now()
   where id = g;
  return 'next';
end $$;


-- ---------- Stopping a game early, and clearing one away ----------
create or replace function stop_game(g bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  update games set status = 'ended', ended_at = now(), end_reason = 'Stopped', updated_at = now()
   where id = g and status = 'playing';
end $$;

-- Only whoever started it, and only once it is over.
create or replace function delete_game(g bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from games where id = g and created_by = auth.uid() and status = 'ended';
  if not found then
    raise exception 'Only whoever started a game can clear it away, once it has ended';
  end if;
end $$;


-- Signed-in people only.
revoke all on function in_game(bigint) from public, anon;
revoke all on function new_game(uuid[], int) from public, anon;
revoke all on function save_sheet(bigint, jsonb) from public, anon;
revoke all on function close_row(bigint, text) from public, anon;
revoke all on function finish_turn(bigint, int, boolean) from public, anon;
revoke all on function stop_game(bigint) from public, anon;
revoke all on function delete_game(bigint) from public, anon;
grant execute on function in_game(bigint) to authenticated;
grant execute on function new_game(uuid[], int) to authenticated;
grant execute on function save_sheet(bigint, jsonb) to authenticated;
grant execute on function close_row(bigint, text) to authenticated;
grant execute on function finish_turn(bigint, int, boolean) to authenticated;
grant execute on function stop_game(bigint) to authenticated;
grant execute on function delete_game(bigint) to authenticated;


-- ---------- Live updates, so every phone keeps up ----------
-- Harmless if they are already there.
do $$
begin
  alter publication supabase_realtime add table games;
exception
  when duplicate_object then null;
  when undefined_object then null;   -- realtime not set up on this project
end $$;

do $$
begin
  alter publication supabase_realtime add table game_players;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;


-- ---------- Check ----------
-- It should show 9 lines: the two tables, then the seven functions.
select 'table' as what, table_name as name
  from information_schema.tables
 where table_schema = 'public' and table_name in ('games', 'game_players')
union all
select 'function', routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('in_game', 'new_game', 'save_sheet', 'close_row',
                        'finish_turn', 'stop_game', 'delete_game')
order by 1 desc, 2;
