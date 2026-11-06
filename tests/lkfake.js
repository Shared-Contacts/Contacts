// A stand-in for step 57's functions (and step 58's reopen_row), for the tests: the same rules, kept in
// window.__rows. window.__who says who is asking (the page itself is 'me').
window.__lkFake = function(){
  window.__rows.games = window.__rows.games || [];
  window.__rows.game_players = window.__rows.game_players || [];
  let next = 100;
  const G = () => window.__rows.games, P = () => window.__rows.game_players;
  const gm = id => G().find(x => x.id === id);
  const who = () => window.__who || 'me';
  const inG = id => P().some(p => p.game_id === id && p.user_id === who());
  const bad = m => ({ data: null, error: { message: m } });
  const fns = {
    new_game(a){
      const ps = a.players || [];
      if (!ps.includes(who())) return bad('You need to be one of the players');
      if (ps.length < 2 || ps.length > 5) return bad('Lock Keeper is for 2 to 5 players');
      const id = ++next;
      G().push({ id, kind: 'lockkeeper', created_by: who(), created_at: new Date().toISOString(), status: 'playing',
        turn: Math.max(0, Math.min(a.first_seat || 0, ps.length - 1)), turn_no: 1, closed: {}, ended_at: null, end_reason: null });
      ps.forEach((u, i) => P().push({ game_id: id, user_id: u, seat: i, sheet: {}, done_turn: 0 }));
      return { data: id, error: null };
    },
    save_sheet(a){
      const p = P().find(x => x.game_id === a.g && x.user_id === who()), g = gm(a.g);
      if (!p || !g || g.status !== 'playing') return bad('That game is not running, or you are not in it');
      p.sheet = JSON.parse(JSON.stringify(a.s || {})); return { data: null, error: null };
    },
    close_row(a){
      const g = gm(a.g); if (!g || !inG(a.g)) return bad('That game is not yours');
      if (g.status === 'playing' && g.closed[a.colour] == null) g.closed = { ...g.closed, [a.colour]: g.turn_no };
      return { data: null, error: null };
    },
    reopen_row(a){
      const g = gm(a.g); if (!g || !inG(a.g)) return bad('That game is not yours');
      if (!['red', 'yellow', 'green', 'blue'].includes(a.colour)) return bad('There is no ' + a.colour + ' row');
      if (g.status !== 'playing') return bad('That game is not running');
      if (g.closed[a.colour] == null) return { data: 'open', error: null };
      if (Number(g.closed[a.colour]) !== g.turn_no) return bad('That lock was closed on an earlier roll');
      const me = P().find(p => p.game_id === a.g && p.user_id === who());
      if (me.done_turn >= g.turn_no) return bad('You have finished with this roll');
      if (P().some(p => p.game_id === a.g && p.user_id !== who() && Array.isArray((p.sheet || {}).locked)
        && p.sheet.locked.includes(a.colour))) return { data: 'kept', error: null };
      const c = { ...g.closed }; delete c[a.colour]; g.closed = c;
      return { data: 'open', error: null };
    },
    finish_turn(a){
      const g = gm(a.g); if (!g || !inG(a.g)) return bad('That game is not yours');
      if (g.status !== 'playing') return { data: 'ended', error: null };
      if (a.at_turn !== g.turn_no) return { data: 'moved', error: null };
      const ps = P().filter(p => p.game_id === a.g), me = ps.find(p => p.user_id === who());
      me.done_turn = Math.max(me.done_turn, a.at_turn);
      const waiting = ps.filter(p => p.done_turn < a.at_turn).length;
      if (waiting && !(a.move_on && me.seat === g.turn)) return { data: 'waiting', error: null };
      let why = null;
      if (Object.keys(g.closed).length >= 2) why = 'Two rows closed';
      else if (ps.some(p => (parseInt((p.sheet || {}).pen, 10) || 0) >= 4)) why = 'Four penalties';
      if (why){ Object.assign(g, { status: 'ended', ended_at: new Date().toISOString(), end_reason: why }); return { data: 'ended', error: null }; }
      g.turn = (g.turn + 1) % ps.length; g.turn_no += 1;
      return { data: 'next', error: null };
    },
    stop_game(a){
      const g = gm(a.g); if (!g || !inG(a.g)) return bad('That game is not yours');
      if (g.status === 'playing') Object.assign(g, { status: 'ended', ended_at: new Date().toISOString(), end_reason: 'Stopped' });
      return { data: null, error: null };
    },
    delete_game(a){
      const g = gm(a.g);
      if (!g || g.created_by !== who() || g.status !== 'ended') return bad('Only whoever started a game can clear it away, once it has ended');
      window.__rows.games = G().filter(x => x.id !== a.g);
      window.__rows.game_players = P().filter(x => x.game_id !== a.g);
      return { data: null, error: null };
    }
  };
  const before = window.__rpc;
  window.__rpc = (name, a) => fns[name] ? fns[name](a || {})
    : (before ? before(name, a) : { data: null, error: { code: 'PGRST202', message: 'no ' + name } });
};
