-- ============================================================
-- Contacts database - Step 69: matches in MY Games (ML411)
--
-- A match is a run of games of Loxx, or of Pounds, between the same
-- players: best of 3, 5 or 7, chosen when its first game starts. The
-- first to win 2, 3 or 4 of the games wins the match. Each game now
-- says which match it is part of, in a new column: of (3, 5 or 7) and
-- first (the id of the match's first game). Whoever starts a game says
-- so once, straight after starting it, with the new function
-- set_match. Nothing step 57, 58, 60, 62 or 64 made is changed, and
-- games from before this step have no match: the app groups them as
-- best of 3, worked out from the games, as before.
--
-- A new column, not a new table, so the backup scripts are unchanged:
-- they already take every column of games.
-- Safe to run more than once.
-- ============================================================



-- ---------- The match a game is part of ----------
alter table games add column if not exists match jsonb not null default '{}';

comment on column games.match is
  'The match this game is part of: of (best of 3, 5 or 7) and first (the id of the match''s first game). Empty for a game on its own.';


-- ---------- Saying which match a game is in ----------
-- Only whoever started the game, once. m: {of: 3, 5 or 7, first: the
-- match's first game, this one for a new match}. A match carried on is
-- the same game (Loxx or Pounds) with exactly the same players, its
-- first game started before this one, and the same number of games.
-- Saying the same again (a second try after a lost signal) is fine.
create or replace function set_match(g bigint, m jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  gm   games;
  f    games;
  n    int;
  fid  bigint;
  want jsonb;
begin
  select * into gm from games where id = g;
  if not found or gm.created_by is distinct from auth.uid() then
    raise exception 'Only whoever started a game can say which match it is in';
  end if;
  if jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(m->'of') is distinct from 'number'
     or (m->>'of') not in ('3', '5', '7') then
    raise exception 'A match is best of 3, 5 or 7';
  end if;
  n := (m->>'of')::int;
  if m ? 'first' and jsonb_typeof(m->'first') is distinct from 'null' then
    if jsonb_typeof(m->'first') is distinct from 'number' then
      raise exception 'That is not a game';
    end if;
    fid := (m->>'first')::bigint;
  else
    fid := g;
  end if;
  want := jsonb_build_object('of', n, 'first', fid);
  if gm.match = want then
    return;
  end if;
  if gm.match <> '{}'::jsonb then
    raise exception 'This game is already part of a match';
  end if;
  if fid <> g then
    select * into f from games where id = fid;
    if not found or fid > g or f.kind <> gm.kind
       or (select array_agg(user_id order by user_id) from game_players where game_id = fid)
          is distinct from
          (select array_agg(user_id order by user_id) from game_players where game_id = g) then
      raise exception 'That match is not between the same players';
    end if;
    if f.match <> '{}'::jsonb and (f.match->>'first' is distinct from fid::text
                                   or f.match->>'of' is distinct from n::text) then
      raise exception 'That is not the start of a best of %', n;
    end if;
  end if;
  update games set match = want, updated_at = now() where id = g;
end $$;

revoke all on function set_match(bigint, jsonb) from public, anon;
grant execute on function set_match(bigint, jsonb) to authenticated;



-- ---------- Check it took ----------
-- You should see 2 lines, each with a tick in "ok": games match, and
-- function set_match.
select 'games match' as "what", '✓' as "ok" from information_schema.columns
 where table_schema = 'public' and table_name = 'games' and column_name = 'match'
union all
select 'function ' || routine_name, '✓' from information_schema.routines
 where routine_schema = 'public' and routine_name = 'set_match';
