-- ============================================================
-- Contacts database - Step 58: Loxx, Undo last move
--
-- Undo last move takes back your newest mark on a roll. When that
-- mark closed a lock, the lock opens again for everyone, which
-- needs this one new function, reopen_row. It only works:
--   - for a player in that game, while it is running,
--   - on the same roll the lock was closed on,
--   - before that player has tapped Done on the roll,
-- and it leaves the lock closed when someone else closed it on
-- the same roll too.
--
-- No new tables, so the backup scripts are unchanged. Nothing
-- existing is changed. Safe to run more than once.
-- ============================================================


-- ---------- Opening a lock again ----------
-- Answers 'open' (it is open now, or already was) or 'kept' (someone
-- else closed it on this roll too, so it stays closed).
create or replace function reopen_row(g bigint, colour text)
returns text language plpgsql security definer set search_path = public as $$
declare
  gm games%rowtype;
begin
  select * into gm from games where id = g for update;
  if not found or not in_game(g) then
    raise exception 'That game is not yours';
  end if;
  if colour not in ('red', 'yellow', 'green', 'blue') then
    raise exception 'There is no % row', colour;
  end if;
  if gm.status <> 'playing' then
    raise exception 'That game is not running';
  end if;
  if not (gm.closed ? colour) then
    return 'open';
  end if;
  if (gm.closed ->> colour) is distinct from gm.turn_no::text then
    raise exception 'That lock was closed on an earlier roll';
  end if;
  if exists (select 1 from game_players
              where game_id = g and user_id = auth.uid() and done_turn >= gm.turn_no) then
    raise exception 'You have finished with this roll';
  end if;
  if exists (select 1 from game_players
              where game_id = g and user_id <> auth.uid()
                and jsonb_typeof(sheet -> 'locked') = 'array'
                and (sheet -> 'locked') ? colour) then
    return 'kept';
  end if;
  update games set closed = closed - colour, updated_at = now() where id = g;
  return 'open';
end $$;

-- Signed-in people only.
revoke all on function reopen_row(bigint, text) from public, anon;
grant execute on function reopen_row(bigint, text) to authenticated;


-- ---------- Check ----------
-- It should show 1 line: reopen_row.
select 'function' as what, routine_name as name
  from information_schema.routines
 where routine_schema = 'public' and routine_name = 'reopen_row';
