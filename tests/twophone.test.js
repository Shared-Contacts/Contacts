// Loxx on two phones at once (10 Nov 2026): Barry's and Sandra's, two pages
// of the real app, playing against step 57 and 58's real SQL in an in-memory
// Postgres (pglite), each asking the database as themselves. Every change
// one phone makes reaches the other as Supabase's live link would.
//
// Written after the game seemed to stop after the second player's Done
// (ML239): one shared game passes the dice correctly; each player starting a
// game of their own left both phones waiting, each for the other, in two
// different games. Also covers one holder per lock (ML240) and Done staying
// greyed until everyone has tapped it (ML241), and, from 16 Nov 2026, Loxx
// with the phone's dice against step 62's real SQL (ML203).
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
    insert into profiles values ('${U.me}'), ('${U.sandra}');
    create table accounts (id bigserial primary key); create table contacts (id bigserial primary key, country text);`);
  for (const n of [57, 58, 60, 62]) await db.exec(fs.readFileSync(path.join(DB, `contacts-step${n}.sql`), 'utf8'));

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
        new_loxx: ['select new_loxx($1::uuid[], $2, $3) as v', a => [a.players.map(x => U[x] || x), a.first_seat, a.real_dice !== false]],
        loxx_dice: ['select loxx_dice($1, $2, $3::jsonb) as v', a => [a.g, a.at_turn, JSON.stringify(a.d)]],
        save_sheet: ['select save_sheet($1, $2::jsonb) as v', a => [a.g, JSON.stringify(a.s)]],
        close_row: ['select close_row($1, $2) as v', a => [a.g, a.colour]],
        reopen_row: ['select reopen_row($1, $2) as v', a => [a.g, a.colour]],
        finish_turn: ['select finish_turn($1, $2, $3) as v', a => [a.g, a.at_turn, !!a.move_on]],
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
  const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|^\[object Object\]$|JSHandle@object/i;
  async function phone(who) {
    const p = await b.newPage({ viewport: { width: 844, height: 390 } });
    p.on('pageerror', e => errors.push(who + ' PAGE ERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push(who + ' CONSOLE: ' + m.text()); });
    await p.exposeFunction('__db', (kind, name, a) => call(who, kind, name, a));
    // Sandra's phone is the same page, signed in as her.
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
  const both = (ms = 700) => B.waitForTimeout(ms);
  const status = p => p.evaluate(() => $('lkStatus') ? $('lkStatus').textContent.replace(/\s+/g, ' ').trim() : '(no game open)');
  const doneBtn = p => p.evaluate(() => { const d = $('lkDone'); return d ? (d.disabled ? 'greyed' : 'ready') : 'none'; });
  const carry = p => p.evaluate(() => !!$('lkOn'));
  const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = p => p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const tap = async (p, c, n) => { await clearToasts(p); await p.click(`[data-lk="${c}:${n}"]`); await wait(p, 400); };
  const cur = p => p.evaluate(() => LK_CUR);
  const scores = p => p.evaluate(() => [...document.querySelectorAll('.lkwho span b')].map(x => x.textContent).join());
  const holder = (p, c) => p.evaluate(c => { const h = lkHolder(lkGame(LK_CUR), c); return h ? h.user_id : null; }, c);

  async function newGame(p, phoneDice = false) {
    await p.evaluate(() => openGames()); await wait(p, 500);
    await p.click('#lkNew'); await wait(p, 300);
    await p.evaluate(phoneDice => { $('lkWho').querySelector('.ppl input[type=checkbox]').click();
      if (phoneDice) $('lkwReal').click(); }, phoneDice);
    await p.click('#lkwGo'); await wait(p, 600);
  }
  async function openFromList(p, id) {
    await p.evaluate(() => openGames()); await wait(p, 500);
    await p.click(`[data-lkgame="${id}"]`); await wait(p, 800);
  }

  console.log('\nOne game, started by Barry; Sandra opens it from her Games');
  await newGame(B);
  ok('Barry is asked who rolls first: no game going with Sandra yet', await B.evaluate(() => !!$('lkFirst') && !$('lkAlready')));
  await B.click('[data-lkfirst="0"]'); await wait(B, 800);
  const G = await cur(B);
  await S.evaluate(() => lkReload());
  ok('  Sandra’s Games tile counts it before she opens anything', await S.evaluate(() => lkWaitingCount()) === 1);
  await openFromList(S, G);
  ok('  she opens the same game: Barry is rolling', await cur(S) === G && /Barry is rolling/.test(await status(S)), await status(S));
  await tap(B, 'red', 4); await tap(B, 'red', 6);
  await B.click('#lkDone'); await both();
  ok('Barry taps Done: waiting for Sandra, his Done greyed, Carry on beside Stop game', /Waiting for Sandra/.test(await status(B))
    && await doneBtn(B) === 'greyed' && await carry(B) && await B.evaluate(() => !!$('lkOn').closest('.lkends')), await status(B));
  ok('  Sandra’s Done is still ready, and she has no Carry on: it isn’t her roll', await doneBtn(S) === 'ready' && !(await carry(S)));
  await tap(S, 'yellow', 4);
  await S.click('#lkDone'); await both();
  ok('Sandra taps Done: the dice pass to her', /Your roll/.test(await status(S)) && await doneBtn(S) === 'ready', await status(S));
  ok('  and Barry’s phone says Sandra is rolling, Done ready again', /Sandra is rolling/.test(await status(B)) && await doneBtn(B) === 'ready', await status(B));
  await tap(S, 'green', 10); await tap(S, 'blue', 9);
  await S.click('#lkDone'); await both();
  ok('Sandra’s own roll, Done tapped first: hers greyed, waiting for Barry', await doneBtn(S) === 'greyed' && /Waiting for Barry/.test(await status(S))
    && await carry(S) && !(await carry(B)), await status(S));
  await tap(B, 'yellow', 7);
  await B.click('#lkDone'); await both();
  ok('Barry taps Done: back to Barry', /Your roll/.test(await status(B)) && /Barry is rolling/.test(await status(S)), await status(B) + ' / ' + await status(S));
  ok('  both phones show the same scores', await scores(B) === await scores(S) && await scores(B) === '4,3', await scores(B) + ' / ' + await scores(S));

  console.log('\nSandra tries to start one of her own as well (what stopped the game, ML239)');
  await S.evaluate(() => lkBackToList()); await wait(S, 300);
  await newGame(S);
  ok('she is asked first: a game is already going with Barry, started by him', await S.evaluate(() => !!$('lkAlready')
    && /You already have a game going with Barry,\s+started by Barry/.test($('lkAlready').textContent)));
  await S.click('#lkaOpen'); await wait(S, 800);
  ok('  Open that game: she is back in Barry’s game, and no second game was made', await cur(S) === G
    && await S.evaluate(() => GAMES.filter(g => g.status === 'playing').length) === 1, String(await cur(S)));

  console.log('\nOne lock, one holder (ML240): Barry rolling, both of them take the red 12 with five marks');
  // Barry's roll 3. Both have red 2 to 6 (Barry's 4 and 6 already there).
  for (const [p, nums] of [[B, [2, 3, 5]], [S, [2, 3, 4, 5, 6]]]) {
    await p.evaluate(nums => { const me = lkMe(LK_CUR), s = lkSheet(me.sheet);
      s.red = [...new Set([...s.red, ...nums])].sort((a, b) => a - b); return lkSave(lkGame(LK_CUR), s); }, nums);
  }
  await both();
  await tap(S, 'red', 12); await both();
  ok('Sandra closes red first: it is hers for now, on both phones', await holder(S, 'red') === 'sandra' && await holder(B, 'red') === 'sandra');
  ok('  Barry is told he can still mark red on this roll', /red lock has been closed\. You can still mark red/.test(await toasts(B)), await toasts(B));
  await clearToasts(S);
  await tap(B, 'red', 12); await both();
  ok('Barry, the roller, takes his 12 after her: it asked first, saying the lock will be his', B.asked.some(m =>
    /Sandra has closed the red lock, but it is your roll, so the lock and its bonus will be yours/.test(m)), B.asked.join(' | '));
  ok('  the lock is his, on both phones', await holder(B, 'red') === 'me' && await holder(S, 'red') === 'me');
  ok('  Sandra is told, and her 12 is a plain mark', /It is Barry’s roll, so the red lock and its bonus go to Barry\. Your 12 still scores as a mark/.test(await toasts(S)), await toasts(S));
  ok('  red scores 28 for Barry (6 marks and the lock), 21 for Sandra (6 marks), the same on both phones', await B.evaluate(() =>
    document.querySelector('[data-lkrow="red"] .lkcount').textContent) === '7' && await S.evaluate(() =>
    document.querySelector('[data-lkrow="red"] .lkcount').textContent) === '6' && await scores(B) === await scores(S), await scores(B) + ' / ' + await scores(S));
  await S.click('#lkDone'); await B.click('#lkDone'); await both();
  ok('after the roll, red stays Barry’s', await holder(B, 'red') === 'me' && await holder(S, 'red') === 'me'
    && /Sandra is rolling/.test(await status(B)));

  console.log('\nTwo games, one each (the old way into the stuck state), still explained');
  await S.evaluate(() => lkBackToList()); await wait(S, 300);
  await newGame(S);
  await S.click('#lkaNew'); await wait(S, 300);
  await S.click('[data-lkfirst="0"]'); await wait(S, 800);
  const G2 = await cur(S);
  await tap(S, 'yellow', 3); await tap(S, 'yellow', 5);
  await S.click('#lkDone'); await both();
  ok('Start another anyway: a second game, waiting for Barry in it', G2 !== G && /Waiting for Barry/.test(await status(S)), await status(S));
  await B.evaluate(() => lkBackToList()); await wait(B, 300);
  await B.evaluate(() => openGames()); await wait(B, 500);
  ok('  Barry’s Games list shows both games going on with Sandra', await B.evaluate(() =>
    document.querySelectorAll('#gamesBody [data-lkgame]').length) === 2);

  // ML268 (16 Nov 2026).
  console.log('\nPlay again: Barry’s phone follows Sandra to the new game');
  await openFromList(B, G2);
  ok('Barry opens the second game', await cur(B) === G2, String(await cur(B)));
  await S.click('#lkStop'); await both(1000);
  ok('  Sandra stops it: both phones show the scores', await B.evaluate(() => !!document.querySelector('.lkover'))
    && await S.evaluate(() => !!document.querySelector('.lkover')));
  await clearToasts(B);
  await S.click('#lkAgain'); await wait(S, 500);
  ok('  Play again asks first, with Barry and Real dice ticked as last game (ML203)', await S.evaluate(() => !!$('lkWho')
    && $('lkwReal').checked && [...$('lkWho').querySelectorAll('.ppl input:checked')].map(i => i.value).join() === 'me'));
  await S.click('#lkwGo'); await wait(S, 500);
  if (await S.evaluate(() => !!$('lkAlready'))) { await S.click('#lkaNew'); await wait(S, 300); }
  ok('  while Sandra is choosing, Barry’s phone stays on the scores', await cur(B) === G2);
  await S.click('[data-lkfirst="0"]'); await wait(S, 800);
  const G3 = await cur(S);
  await both(1200);
  ok('Sandra taps Play again: a new game, and Barry’s phone moves to it by itself', G3 !== G2 && G3 !== G && await cur(B) === G3,
    `${G3} / ${await cur(B)}`);
  ok('  telling him who started it', /Sandra has started a new game/.test(await toasts(B)), await toasts(B));
  ok('  Sandra is rolling, on both phones', /Sandra is rolling/.test(await status(B)) && await cur(S) === G3, await status(B));

  // ML203 (16 Nov 2026).
  console.log('\nThe phone’s dice: Barry starts a game with Real dice unticked');
  const dbDice = async g => (await db.query(`select dice from games where id = ${Number(g)}`)).rows[0].dice;
  const shown = p => p.evaluate(() => { const g = lkGame(LK_CUR); return lkDice(g); });
  const hints = p => p.evaluate(() => [...document.querySelectorAll('.lkn.hint')].map(b => b.dataset.lk).sort().join());
  await B.evaluate(() => lkBackToList()); await wait(B, 300);
  await newGame(B, true);
  if (await B.evaluate(() => !!$('lkAlready'))) { await B.click('#lkaNew'); await wait(B, 300); }
  ok('who rolls first says the phone rolls the dice', await B.evaluate(() => /The phone rolls the dice/.test($('lkFirst').textContent)));
  await B.click('[data-lkfirst="0"]'); await wait(B, 800);
  const G4 = await cur(B);
  ok('  a new game, saved as the phone’s dice', G4 !== G3 && (await dbDice(G4)).real === false, JSON.stringify(await dbDice(G4)));
  ok('  Barry: Your roll. Tap Roll, with a Roll button, and Done greyed', /Your roll\. Tap Roll/.test(await status(B))
    && await B.evaluate(() => !!$('lkRoll')) && await doneBtn(B) === 'greyed', await status(B));
  await openFromList(S, G4);
  ok('Sandra opens it: waiting for Barry’s dice, six empty dice, no Roll button, Done greyed', await cur(S) === G4
    && /Barry is rolling\. Waiting for the dice/.test(await status(S)) && await S.evaluate(() => !$('lkRoll')
    && document.querySelectorAll('.lkdie.blank').length === 6) && await doneBtn(S) === 'greyed', await status(S));
  await tap(S, 'red', 7);
  ok('  her tap on a number before the roll says to wait', /Wait for Barry to roll/.test(await toasts(S))
    && await S.evaluate(() => lkSheet(lkMe(LK_CUR).sheet).red.length) === 0, await toasts(S));
  await tap(B, 'red', 7);
  ok('  and Barry’s says Tap Roll first', /Tap Roll first/.test(await toasts(B)), await toasts(B));
  const sneak = await S.evaluate(g => sb.rpc('loxx_dice', { g, at_turn: 1, d: { v: [6, 6, 6, 6, 6, 6] } }), G4);
  ok('  Sandra cannot roll Barry’s dice for him', !!sneak.error && /not your roll/.test(sneak.error.message), JSON.stringify(sneak));

  await B.click('#lkRoll'); await both(900);
  const v = await shown(B), W = v ? v[0] + v[1] : 0;
  ok('Barry taps Roll: six dice, each 1 to 6, on his phone and saved', !!v && v.length === 6 && v.every(n => n >= 1 && n <= 6)
    && JSON.stringify((await dbDice(G4)).v) === JSON.stringify(v), JSON.stringify(v));
  ok('  Sandra sees the very same dice, without doing anything', JSON.stringify(await shown(S)) === JSON.stringify(v)
    && await S.evaluate(() => document.querySelectorAll('#lkDice .lkdie:not(.off)').length) === 6, JSON.stringify(await shown(S)));
  ok('  her words give the white dice total, as hers too', new RegExp('White dice ' + W + ': yours too').test(await status(S)), await status(S));
  ok('  her ringed numbers: the white total in each row, and nothing else', await hints(S)
    === ['red', 'yellow', 'green', 'blue'].map(c => c + ':' + W).sort().join(), await hints(S));
  const mine = ['red', 'yellow', 'green', 'blue'].flatMap((c, i) => [W, v[0] + v[2 + i], v[1] + v[2 + i]].map(n => c + ':' + n));
  ok('  Barry’s: the white total, and each white with each colour in its own row', await hints(B)
    === [...new Set(mine)].sort().join(), await hints(B) + ' / ' + [...new Set(mine)].sort().join());
  ok('  both phones’ Done ready now, and no Roll button left', await doneBtn(B) === 'ready' && await doneBtn(S) === 'ready'
    && await B.evaluate(() => !$('lkRoll')));
  await clearToasts(B);
  await B.evaluate(() => lkRollDice()); await wait(B, 400);
  ok('  rolling again is refused: the dice are out for this roll', /dice are out/.test(await toasts(B))
    && JSON.stringify((await dbDice(G4)).v) === JSON.stringify(v), await toasts(B));
  await tap(S, 'red', W); await tap(B, 'yellow', W);
  ok('Both mark the white total (nothing stops another number, as with real dice)', await S.evaluate(W =>
    lkSheet(lkMe(LK_CUR).sheet).red.includes(W), W) && await B.evaluate(W => lkSheet(lkMe(LK_CUR).sheet).yellow.includes(W), W));
  await S.click('#lkDone'); await wait(S, 300);
  B.asked.length = 0;
  await B.click('#lkDone'); await both(900);
  ok('  Done on both: Sandra’s roll, her Roll button, and Barry waiting for her dice', /Your roll\. Tap Roll/.test(await status(S))
    && await S.evaluate(() => !!$('lkRoll')) && /Sandra is rolling\. Waiting for the dice/.test(await status(B))
    && !(await shown(B)), await status(S) + ' / ' + await status(B));
  await S.click('#lkRoll'); await both(900);
  ok('  she rolls, and Barry sees her dice', !!(await shown(S)) && JSON.stringify(await shown(B)) === JSON.stringify(await shown(S))
    && (await dbDice(G4)).at === 2, JSON.stringify(await dbDice(G4)));
  await S.click('#lkStop'); await both(1000);
  await S.click('#lkAgain'); await wait(S, 500);
  ok('Play again after it: Real dice left unticked, as last game', await S.evaluate(() => !!$('lkWho') && !$('lkwReal').checked
    && [...$('lkWho').querySelectorAll('.ppl input:checked')].map(i => i.value).join() === 'me'));
  await S.click('#lkwCancel'); await wait(S, 200);

  console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'none'));
  ok('no page errors on either phone', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
