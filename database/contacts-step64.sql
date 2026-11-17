-- ============================================================
-- Contacts database - Step 64: Entered by, and undoing a Done in Loxx
--
-- 1. Entered by, on books and on TV/Movies (ML288): who put each one
--    in. The app starts it as whoever is signed in, and it can be any
--    of the people who use the app. Empty, as every one from before
--    this step is, it means whoever added it (created_by), so nothing
--    already saved needs changing.
-- 2. Loxx, a Done tapped by mistake (ML291). Two new functions:
--      not_done      takes back your own Done, while the others are
--                    still marking that roll;
--      back_a_roll   once the dice have passed on, and before anyone
--                    has done anything on the new roll, puts everyone
--                    back on the roll before: every Done on it taken
--                    back, the marks as they were, and a penalty taken
--                    on it taken off again (Done asks about it afresh).
--    Both take off a penalty taken on that roll, through lk_unpen.
--    Nothing step 57, 58 or 62 made is changed.
--
-- New columns and functions, no new tables, so both backup scripts
-- are unchanged: they already take every column of books and shows.
-- Safe to run more than once.
-- ============================================================



-- ---------- 1. Entered by ----------
alter table if exists books add column if not exists entered_by uuid references profiles on delete set null;
alter table if exists shows add column if not exists entered_by uuid references profiles on delete set null;

do $$ begin
  if to_regclass('public.books') is not null then
    comment on column books.entered_by is
      'Who entered this book: any of the people who use the app. Empty means created_by.';
  end if;
  if to_regclass('public.shows') is not null then
    comment on column shows.entered_by is
      'Who entered this film or series: any of the people who use the app. Empty means created_by.';
  end if;
end $$;



-- ---------- 2. Loxx: taking a Done back ----------

-- A sheet with the penalty taken on roll at_turn taken off again. The
-- app notes how many it took (turn.pn); a sheet from before this step
-- has only turn.pen, and then it was one for each of the two numbers
-- not taken. Any other sheet comes back as it was.
create or replace function lk_unpen(s jsonb, at_turn int)
returns jsonb language plpgsql immutable as $$
declare
  t jsonb := coalesce(s -> 'turn', '{}'::jsonb);
  took int;
  had int;
begin
  if coalesce(t ->> 'no', '') <> at_turn::text or coalesce(t ->> 'pen', '') <> 'true' then
    return s;
  end if;
  if coalesce(t ->> 'pn', '') ~ '^[0-9]+$' then
    took := (t ->> 'pn')::int;
  else
    took := 2 - least(2, case when jsonb_typeof(t -> 'marks') = 'array'
                              then jsonb_array_length(t -> 'marks') else 0 end);
  end if;
  had := case when coalesce(s ->> 'pen', '') ~ '^[0-9]+$' then (s ->> 'pen')::int else 0 end;
  return jsonb_set(s, '{pen}', to_jsonb(greatest(0, had - took)))
         || jsonb_build_object('turn', t || jsonb_build_object('pen', false, 'pn', 0));
end $$;


-- Taking back your own Done, while the roll is still going (someone has
-- not tapped theirs yet). Answers 'ok', 'moved' if the dice have already
-- passed on (back_a_roll is for that), or 'ended'.
create or replace function not_done(g bigint, at_turn int)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if gm.kind <> 'lockkeeper' then
    raise exception 'That is not a game of Loxx';
  end if;
  if gm.status <> 'playing' then
    return 'ended';
  end if;
  if at_turn <> gm.turn_no then
    return 'moved';
  end if;
  update game_players
     set done_turn = least(done_turn, at_turn - 1),
         sheet = lk_unpen(sheet, at_turn),
         updated_at = now()
   where game_id = g and user_id = auth.uid();
  return 'ok';
end $$;


-- Everyone back on the roll before. Only while the new roll has not
-- started: nobody has marked anything on it or tapped Done, and with the
-- phone's dice, they have not been rolled. Answers 'ok', 'moved' if the
-- game is no longer on at_turn, 'started' if the new roll has begun,
-- 'first' on the first roll, or 'ended'.
create or replace function back_a_roll(g bigint, at_turn int)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
  n int;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if gm.kind <> 'lockkeeper' then
    raise exception 'That is not a game of Loxx';
  end if;
  if gm.status <> 'playing' then
    return 'ended';
  end if;
  if at_turn <> gm.turn_no then
    return 'moved';
  end if;
  if gm.turn_no <= 1 then
    return 'first';
  end if;
  if exists (select 1 from game_players where game_id = g and done_turn >= gm.turn_no)
     or exists (select 1 from game_players where game_id = g
                 and coalesce(sheet -> 'turn' ->> 'no', '') = gm.turn_no::text
                 and (coalesce(sheet -> 'turn' ->> 'pen', '') = 'true'
                      or (jsonb_typeof(sheet -> 'turn' -> 'marks') = 'array'
                          and jsonb_array_length(sheet -> 'turn' -> 'marks') > 0)))
     or exists (select 1 from jsonb_each_text(gm.closed) c where c.value = gm.turn_no::text)
     or (coalesce(gm.dice ->> 'real', 'true') = 'false'
         and coalesce(gm.dice ->> 'at', '') = gm.turn_no::text) then
    return 'started';
  end if;
  select count(*) into n from game_players where game_id = g;
  update games set turn = (turn - 1 + n) % n, turn_no = turn_no - 1, updated_at = now()
   where id = g;
  update game_players
     set done_turn = least(done_turn, at_turn - 2),
         sheet = lk_unpen(sheet, at_turn - 1),
         updated_at = now()
   where game_id = g;
  return 'ok';
end $$;

-- Signed-in people only.
revoke all on function not_done(bigint, int) from public, anon;
grant execute on function not_done(bigint, int) to authenticated;
revoke all on function back_a_roll(bigint, int) from public, anon;
grant execute on function back_a_roll(bigint, int) to authenticated;



-- ---------- Check ----------
-- It should show 5 lines, each with a tick.
select '✓ books entered_by' as "Step 64"
 where exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'books' and column_name = 'entered_by')
union all
select '✓ shows entered_by'
 where exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'shows' and column_name = 'entered_by')
union all
select '✓ function lk_unpen'  where to_regprocedure('public.lk_unpen(jsonb, integer)') is not null
union all
select '✓ function not_done' where to_regprocedure('public.not_done(bigint, integer)') is not null
union all
select '✓ function back_a_roll' where to_regprocedure('public.back_a_roll(bigint, integer)') is not null;
