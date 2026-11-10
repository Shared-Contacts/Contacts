// Pounds on two phones at once (ML250, 10 Nov 2026): Barry's and Sandra's,
// two pages of the real app, playing against steps 57 and 60's real SQL in
// an in-memory Postgres (pglite), each asking the database as themselves.
// Every change one phone makes reaches the other as Supabase's live link
// would. Covers the dice being watched as they are rolled and kept, turns
// passing, the database refusing what it should, the end of a game, real
// dice typed in, and Stop game.
//
// Needs @electric-sql/pglite (npm install @electric-sql/pglite@0.2.17).
// Without it this suite says it was skipped, rather than failing.
const path = require('path'), fs = require('fs');
let PGlite;
try { ({ PGlite } = require('@electric-sql/pglite')); }
catch (e) { console.log('\nSkipped: needs @electric-sql/pglite for a real database.\n\n0 passed, 0 failed'); process.exit(0); }
const { chromium } = require('playwright');
const { answerLkAsks } = require('./lkask');
const DB = path.join(__dirname, '..', 'database');
const U = { me: '00000000-0000-0000-0000-00000000000a', sandra: '00000000-0000-0000-0000-00000000000b' };
const back = Object.fromEntries(Object.entries(U).map(([k, v]) => [v, k]));
let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); } else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

(async () => {
  const db = new PGlite();
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
    create role authenticated; create role anon;
    create table profiles (id uuid primary key);
    insert into profiles values ('${U.me}'), ('${U.sandra}');`);
  await db.exec(fs.readFileSync(path.join(DB, 'contacts-step57.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(DB, 'contacts-step58.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(DB, 'contacts-step60.sql'), 'utf8'));

  const pages = {};
  const out = r => { const o = { ...r };
    ['user_id', 'created_by'].forEach(k => { if (o[k]) o[k] = back[o[k]] || o[k]; });
    ['created_at', 'ended_at', 'updated_at'].forEach(k => { if (o[k] instanceof Date) o[k] = o[k].toISOString(); });
    ['id', 'game_id'].forEach(k => { if (o[k] != null) o[k] = Number(o[k]); }); return o; };
  const asUser = (who, sql, args) => db.transaction(async tx => {
    await tx.query(`select set_config('app.uid', $1, true)`, [U[who]]); return tx.query(sql, args); });
  async function call(who, kind, name, a) {
    try {
      if (kind === 'select') {     // what row-level security lets this player see
        const where = a.eq ? ` and ${a.eq[0] === 'game_id' ? 'game_id' : 'id'} = ${Number(a.eq[1])}` : '';
        const r = await asUser(who, name === 'games' ? `select * from games where in_game(id)${where} order by created_at desc`
          : `select * from game_players where in_game(game_id)${where}`);
        return { data: r.rows.map(out), error: null };
      }
      const sql = { new_game: ['select new_game($1::uuid[], $2) as v', a => [a.players.map(x => U[x] || x), a.first_seat]],
        new_pounds: ['select new_pounds($1::uuid[], $2, $3) as v', a => [a.players.map(x => U[x] || x), a.first_seat, !!a.real_dice]],
        pounds_dice: ['select pounds_dice($1, $2, $3::jsonb) as v', a => [a.g, a.at_turn, JSON.stringify(a.d)]],
        pounds_score: ['select pounds_score($1, $2, $3::jsonb) as v', a => [a.g, a.at_turn, JSON.stringify(a.s)]],
        stop_game: ['select stop_game($1) as v', a => [a.g]], delete_game: ['select delete_game($1) as v', a => [a.g]] }[name];
      if (!sql) return null;                   // not a game function: the page's own stand-in answers
      const r = await asUser(who, sql[0], sql[1](a));
      let v = r.rows[0].v; if (typeof v === 'bigint') v = Number(v);
      for (const [k, pg] of Object.entries(pages)) if (k !== who)
        pg.evaluate(() => (window.__live || []).forEach(f => f())).catch(() => {});
      return { data: v === '' ? null : v, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  }

  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const errors = [];
  const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|not your turn|One box a turn|^\[object Object\]$|JSHandle@object/i;
  async function phone(who) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    p.on('pageerror', e => errors.push(who + ' PAGE ERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push(who + ' CONSOLE: ' + m.text()); });
    await p.exposeFunction('__db', (kind, name, a) => call(who, kind, name, a));
    if (who !== 'me') await p.addInitScript(w => { let real;
      Object.defineProperty(window, 'supabase', { configurable: true, get: () => real, set: v => { real = { createClient: (...x) => {
        const c = v.createClient(...x); c.auth.getUser = () => Promise.resolve({ data: { user: { id: w, email: w + '@example.com' } } }); return c; } }; } }); }, who);
    await p.goto('file://' + path.join(__dirname, 'boot.html'));
    await p.waitForTimeout(900);
    const asked = [];
    await answerLkAsks(p, m => { asked.push(m); return true; });
    if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
    await p.evaluate(() => {
      WX_OFF = true; BSKY_OFF = true;
      const rpc0 = sb.rpc, from0 = sb.from;
      sb.rpc = async (name, a) => (await window.__db('rpc', name, a)) || rpc0(name, a);
      sb.from = t => {
        if (t !== 'games' && t !== 'game_players') return from0(t);
        const q = { eq: null }, api = {};
        ['select', 'order'].forEach(m => api[m] = () => api);
        api.eq = (c, v) => { q.eq = [c, v]; return api; };
        api.then = (f, r) => window.__db('select', t, q).then(f, r);
        return api;
      };
      window.__live = [];
      sb.channel = () => ({ on(_a, _b, cb) { window.__live.push(cb); return this; }, subscribe() { return this; } });
      sb.removeChannel = () => { window.__live = []; };
    });
    p.asked = asked;
    pages[who] = p;
    return p;
  }
  const B = await phone('me'), S = await phone('sandra');
  ok('Sandra’s phone is signed in as Sandra', await S.evaluate(() => ME.id) === 'sandra' && await B.evaluate(() => ME.id) === 'me');
  const wait = (p, ms = 400) => p.waitForTimeout(ms);
  const both = (ms = 800) => B.waitForTimeout(ms);
  const status = p => p.evaluate(() => $('pdStatus') ? $('pdStatus').textContent.replace(/\s+/g, ' ').trim() : '(no turn showing)');
  const shown = p => p.evaluate(() => [...document.querySelectorAll('#pdBody [data-pddie]')].map(d => d.getAttribute('aria-label')).join(' / '));
  const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = p => p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const cur = p => p.evaluate(() => PD_CUR);
  const nextDice = (p, l) => p.evaluate(l => { window.__dice = l.slice(); window.pdRand = () => window.__dice.length ? window.__dice.shift() : 1; }, l);
  const score = async (p, k) => { await p.click(`[data-pdbox="${k}"]`); await wait(p, 150); await p.click('#pdGo'); await both(); };
  const chips = p => p.evaluate(() => [...document.querySelectorAll('.pdwho button')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  async function openFromList(p, id) {
    await p.evaluate(() => openGames()); await wait(p, 500);
    await p.click(`[data-lkgame="${id}"]`); await wait(p, 800);
  }

  console.log('\nBarry starts a game of Pounds with Sandra, phone dice, Barry first');
  await B.evaluate(() => openGames()); await wait(B, 500);
  await B.click('#pdNew'); await wait(B, 300);
  await B.click('#pdWho input[type=checkbox]:not(#pdwReal)'); await B.click('#pdwGo'); await wait(B, 400);
  await B.click('[data-lkfirst="0"]'); await wait(B, 900);
  const G = await cur(B);
  ok('it opens on Barry’s phone: his turn', G != null && /^Your turn\. Roll the dice\. Round 1 of 13$/.test(await status(B)), await status(B));
  await S.evaluate(() => lkReload());
  ok('  it is on Sandra’s list, and her Games tile has nothing yet (not her turn)', await S.evaluate(id => lkGame(id) && lkGame(id).kind === 'pounds'
    && lkWaitingCount() === 0, G));
  await openFromList(S, G);
  ok('  she opens it: Barry’s turn, waiting for him to roll', /^Barry’s turn\. Waiting for them to roll\./.test(await status(S)), await status(S));

  await nextDice(B, [3, 3, 5, 2, 5]);
  await B.click('#pdRoll'); await both();
  ok('Barry rolls: Sandra sees the same dice', await shown(S) === await shown(B) && /Die 1: 3/.test(await shown(S)), await shown(S));
  ok('  and his roll count', /^Barry’s turn: roll 1 of 3\./.test(await status(S)), await status(S));
  await B.click('[data-pddie="0"]'); await B.click('[data-pddie="1"]'); await B.click('[data-pddie="2"]'); await B.click('[data-pddie="4"]'); await both(1000);
  ok('  he keeps four: Sandra sees which', await shown(S) === 'Die 1: 3, kept / Die 2: 3, kept / Die 3: 5, kept / Die 4: 2 / Die 5: 5, kept', await shown(S));
  ok('  with what his card would score, in green', await S.evaluate(() => {
    const fh = document.querySelector('[data-pdbox="fh"]'); return /Barry’s card/.test(document.querySelector('.pdcardhd').textContent)
      && fh.classList.contains('pot') && fh.querySelector('.pdv').textContent === '0'; }));
  const sneak = await S.evaluate(g => sb.rpc('pounds_dice', { g, at_turn: 1, d: { v: [6, 6, 6, 6, 6], held: [], rolls: 1 } }), G);
  ok('the database won’t let Sandra roll on Barry’s turn', !!sneak.error && /It is not your turn/.test(sneak.error.message), JSON.stringify(sneak));
  const cheat = await B.evaluate(g => sb.rpc('pounds_dice', { g, at_turn: 1, d: { v: [6, 6, 6, 6, 6], held: [], rolls: 4 } }), G);
  ok('  nor a fourth roll', !!cheat.error && /Three rolls is the most/.test(cheat.error.message));
  await nextDice(B, [5]);
  await B.click('#pdRoll'); await both();
  ok('his second roll: a full house, on both phones', await shown(S) === 'Die 1: 3, kept / Die 2: 3, kept / Die 3: 5, kept / Die 4: 5 / Die 5: 5, kept'
    && await S.evaluate(() => document.querySelector('[data-pdbox="fh"] .pdv').textContent === '25'));
  await clearToasts(S);
  await score(B, 'fh');
  ok('Barry puts 25 in Full house: Sandra is told it is her turn', /Your turn/.test(await toasts(S))
    && /^Your turn\. Roll the dice\. Round 1 of 13$/.test(await status(S)), await toasts(S) + ' / ' + await status(S));
  ok('  his 25 is by his name on her phone', /Barry 25/.test(await chips(S)), await chips(S));
  ok('  his phone says it is Sandra’s turn, round 1, with her card showing', /^Sandra’s turn\. Waiting for them to roll\. Round 1 of 13$/.test(await status(B))
    && await B.evaluate(() => /Sandra’s card/.test(document.querySelector('.pdcardhd').textContent)));
  ok('  the dice are cleared for her', await shown(S) === 'Die 1: not rolled / Die 2: not rolled / Die 3: not rolled / Die 4: not rolled / Die 5: not rolled');
  ok('  and her Games tile counts it now', await S.evaluate(() => lkWaitingCount() === 1) && await B.evaluate(() => lkWaitingCount() === 0));

  await nextDice(S, [2, 3, 4, 5, 6]);
  await S.click('#pdRoll'); await both();
  ok('Sandra rolls a long run; Barry sees it', await shown(B) === 'Die 1: 2 / Die 2: 3 / Die 3: 4 / Die 4: 5 / Die 5: 6');
  const change = await B.evaluate(g => sb.rpc('pounds_score', { g, at_turn: 2, s: { box: { fh: 30 }, extra: 0 } }), G);
  ok('the database won’t let Barry change his Full house on her turn', !!change.error && /not your turn/i.test(change.error.message));
  await clearToasts(B);
  await score(S, 'ls');
  ok('she puts 40 in Long run: back to Barry, round 2', /Your turn/.test(await toasts(B)) && /Round 2 of 13/.test(await status(B))
    && /Sandra 40/.test(await chips(B)), await status(B) + ' / ' + await chips(B));
  const twice = await B.evaluate(g => sb.rpc('pounds_score', { g, at_turn: 3, s: { box: { fh: 25, ch: 20, k3: 20 }, extra: 0 } }), G);
  ok('the database holds a turn to one box', !!twice.error && /One box a turn/.test(twice.error.message));
  const redo = await B.evaluate(g => sb.rpc('pounds_score', { g, at_turn: 3, s: { box: { fh: 0, ch: 20 }, extra: 0 } }), G);
  ok('  and the boxes filled stay as they are', !!redo.error && /One box a turn/.test(redo.error.message));

  console.log('\nTo the end of the game');
  // Twelve boxes each, as if played; Barry and Sandra fill their last.
  await db.exec(`update game_players set sheet = '{"box":{"u1":3,"u2":6,"u3":9,"u4":12,"u5":15,"u6":18,"k3":20,"k4":0,"fh":25,"ss":30,"five":50,"ch":20},"extra":0}'
    where game_id = ${G} and user_id = '${U.me}';
    update game_players set sheet = '{"box":{"u1":2,"u2":4,"u3":6,"u4":8,"u5":10,"u6":12,"k3":18,"k4":22,"ls":40,"ss":30,"five":0,"ch":22},"extra":0}'
    where game_id = ${G} and user_id = '${U.sandra}';`);
  await B.evaluate(async () => { await pdReload(PD_CUR); pdPaint(); }); await S.evaluate(async () => { await pdReload(PD_CUR); pdPaint(); });
  ok('round 13 of 13', /Round 13 of 13/.test(await status(B)) && /Round 13 of 13/.test(await status(S)));
  await nextDice(B, [1, 2, 3, 4, 5]);
  await B.click('#pdRoll'); await both();
  await score(B, 'ls');
  await nextDice(S, [4, 4, 1, 1, 1]);
  await S.click('#pdRoll'); await both();
  await clearToasts(B);
  await score(S, 'fh');
  const bTotal = 63 + 35 + 20 + 0 + 25 + 30 + 50 + 20 + 40, sTotal = 42 + 18 + 22 + 40 + 30 + 0 + 22 + 25;
  const row = (await db.query(`select status, end_reason from games where id = ${G}`)).rows[0];
  ok('Sandra’s last box ends it: every box filled', row.status === 'ended' && row.end_reason === 'Every box filled', JSON.stringify(row));
  ok('  Barry’s phone: You won, with both scores', await B.evaluate(t => {
    const o = document.querySelector('.pdover'); return !!o && o.querySelector('h3').textContent === t
      && document.querySelectorAll('.pdover .lkres li').length === 2; }, `You won, ${bTotal} to ${sTotal}`),
    await B.evaluate(() => (document.querySelector('.pdover h3') || {}).textContent));
  ok('  Sandra’s phone: Barry won', await S.evaluate(t => (document.querySelector('.pdover h3') || {}).textContent === t, `Barry won, ${bTotal} to ${sTotal}`));
  ok('  only Barry, who started it, can clear it away', await B.evaluate(() => !!$('pdClear')) && await S.evaluate(() => !$('pdClear')));

  console.log('\nReal dice: Sandra starts one, typing in what the dice show');
  await S.evaluate(() => pdBackToList()); await wait(S, 400);
  await S.click('#pdNew'); await wait(S, 300);
  await S.click('#pdWho input[type=checkbox]:not(#pdwReal)'); await S.click('#pdwReal'); await S.click('#pdwGo'); await wait(S, 400);
  await S.click('[data-lkfirst="0"]'); await wait(S, 900);
  const R = await cur(S);
  ok('a game with real dice, Sandra first', R !== G && (await db.query(`select dice->>'real' as r from games where id = ${R}`)).rows[0].r === 'true');
  await B.evaluate(() => pdBackToList()); await wait(B, 300);
  await openFromList(B, R);
  for (const n of [6, 6, 6]) await S.click(`[data-pdn="${n}"]`);
  await both(1000);
  ok('Barry sees her numbers as she types them', await shown(B) === 'Die 1: 6 / Die 2: 6 / Die 3: 6 / Die 4: not rolled / Die 5: not rolled'
    && /Typing in the dice/.test(await status(B)), await shown(B) + ' / ' + await status(B));
  ok('  his phone shows no number buttons: they are her dice', await B.evaluate(() => !document.querySelector('[data-pdn]') && /Real dice: Sandra’s dice/.test(document.querySelector('.pdwatch').textContent)));
  for (const n of [1, 2]) await S.click(`[data-pdn="${n}"]`);
  await both(1000);
  ok('  all five in, on both phones', await shown(B) === await shown(S) && /Die 5: 2/.test(await shown(B)));

  console.log('\nStop game');
  await B.click('#pdStop'); await both();
  ok('Barry stops it, after being asked: Sandra’s phone shows it stopped', /Stop this game for everyone/.test(B.asked[B.asked.length - 1] || '')
    && await S.evaluate(() => !!document.querySelector('.pdover') && /The game was stopped/.test(document.querySelector('.pdover').textContent)));
  ok('  and nobody can roll in it now', (await S.evaluate(g => sb.rpc('pounds_dice', { g, at_turn: 1, d: { v: [1, 1, 1, 1, 1], held: [], rolls: 1 } }), R)).data === 'ended');
  const kinds = (await db.query(`select kind, count(*)::int as n from games group by kind order by kind`)).rows;
  ok('the database holds two games of Pounds, nothing else changed', JSON.stringify(kinds) === JSON.stringify([{ kind: 'pounds', n: 2 }]), JSON.stringify(kinds));

  console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'none'));
  ok('no page errors on either phone', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
