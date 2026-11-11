// MY Games and Loxx (ML202, with step 57; called Lock Keeper until ML207,
// when the roller's penalty became one for each number not taken; ML212 the
// 12 or 2 without five marks; ML213 Undo last move, step 58): an original dice game for
// 2 to 5, played with real dice, each player on their own phone. The phones
// are linked through step 57's functions; lkfake.js stands in for them here,
// with the same rules, and window.__who plays the other people.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|Server unwell|^\[object Object\]$|JSHandle@object/i;
const ROOT = path.join(__dirname, '..');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  let answer = true; const asked = [];
  p.on('dialog', d => { asked.push(d.message()); return answer ? d.accept() : d.dismiss(); });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  // Since ML219 the game's questions are on the sheet, not the phone's own box.
  await answerLkAsks(p, m => { asked.push(m); return answer; });
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const top = () => ev(() => SHEET_STACK[SHEET_STACK.length - 1]);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const rpcs = name => ev(n => window.__writes.filter(w => w.op === 'rpc' && w.name === n), name);
  const clear = () => ev(() => { window.__writes.length = 0; });
  const tap = async (c, n) => { await clearToasts(); await p.click(`[data-lk="${c}:${n}"]`); await settle(250); };
  const cell = (c, n) => ev(k => { const e = document.querySelector(`[data-lk="${k}"]`); return e ? e.className : 'missing'; }, c + ':' + n);
  const mine = () => ev(() => lkSheet(lkMe(LK_CUR).sheet));
  const status = () => ev(() => $('lkStatus') ? $('lkStatus').textContent.replace(/\s+/g, ' ').trim() : '');
  // Someone else does something, then this phone hears of it.
  const as = async (who, name, args) => { await ev(([w, n, a]) => { window.__who = w; const r = window.__rpc(n, a); window.__who = null; return r; }, [who, name, args]);
    await ev(async () => { await lkReload(LK_CUR); lkPaint(); }); await settle(150); };
  const game = () => ev(() => JSON.parse(JSON.stringify(lkGame(LK_CUR))));
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); window.__lkFake(); });

  // ---------------------------------------------------------------
  console.log('\nA MY Games tile, a place in the menu, and Help');
  ok('there is a Games tile, and it opens MY Games', await ev(() => TILE_DEST.games && TILE_DEST.games.label === 'Games' && TILE_DEST.games.go === openGames));
  ok('  new people get it after Jigsaws, with My Stuff still before Settings', await ev(() =>
    TILE_DEFAULTS.indexOf('games') === TILE_DEFAULTS.indexOf('jig') + 1 && TILE_DEFAULTS.indexOf('stuff') < TILE_DEFAULTS.indexOf('settings')));
  ok('  and it joins the end of an arrangement someone already has', await ev(() => {
    const was = MY_PROFILE, keep = TILES; MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }, { dest: 'diary' }], hidden: [] } };
    loadTiles(); const got = TILES.map(t => t.dest); MY_PROFILE = was; TILES = keep; return got.includes('games'); }));
  ok('  unless they took it off before', await ev(() => {
    const was = MY_PROFILE, keep = TILES; MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: ['games'] } };
    loadTiles(); const got = TILES.map(t => t.dest); MY_PROFILE = was; TILES = keep; return !got.includes('games'); }));
  ok('Games is a place in the menu, with New game', await ev(() => AREAS.games && AREAS.games.title === 'Games'
    && areaItems('games').some(x => x.label === 'New game of Loxx')));
  await ev(() => openHelp('games')); await settle(300);
  ok('Help has the rules, in a box of their own', await ev(() => { const h = document.getElementById('h-games');
    return !!h && h.parentElement.classList.contains('helpbox') && /Closing a lock/.test(h.parentElement.textContent)
      && /78 for 12/.test(h.parentElement.textContent); }));
  ok('  and the menu’s How it works goes there', await ev(() => HELP_AT.games === 'h-games'));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nThe scoring and the sheet');
  ok('a row scores 1, 3, 6, 10 … up to 78 for twelve marks', await ev(() =>
    [1, 2, 3, 4, 5, 11, 12].map(lkTri).join() === '1,3,6,10,15,66,78'));
  ok('a closed lock counts as one more mark', await ev(() => lkRowCount({ red: [2, 3, 4, 5, 6, 12], locked: ['red'] }, 'red') === 7));
  ok('the total: the rows added, less 5 a penalty', await ev(() => {
    const s = lkSheet({ red: [2, 4, 5], yellow: [3], green: [12, 11, 9, 8, 7], pen: 1 }); const r = lkScore(s);
    return r.rows.join() === '6,1,15,0' && r.pen === 5 && r.total === 17; }));
  ok('a saved sheet is tidied: real numbers only, once each, left to right', await ev(() => {
    const s = lkSheet({ red: [5, 2, 5, 13, 'x'], green: [2, 12], pen: 9, locked: ['red', 'purple'] });
    return s.red.join() === '2,5' && s.green.join() === '12,2' && s.pen === 4 && s.locked.join() === 'red' && s.blue.length === 0; }));

  // ---------------------------------------------------------------
  console.log('\nMY Games, and starting a game');
  await ev(() => openGames()); await settle(400);
  ok('MY Games opens', await top() === 'games' && await ev(() => /Loxx/.test($('gamesBody').textContent)));
  ok('  no games yet: it says so', await ev(() => /No games yet/.test($('gamesBody').textContent)));
  ok('  How to play opens the rules', await ev(() => { $('lkHow').click(); const ok = !$('help').classList.contains('hidden');
    $('help').classList.add('hidden'); lockBackground(); return ok; }));
  await clear();
  await p.click('#lkNew'); await settle(300);
  ok('New game asks who is playing, a row each with their details', await ev(() => !!$('lkWho')
    && $('lkWho').querySelectorAll('.checks.ppl label .pplwho b').length === 2));
  await clearToasts(); await p.click('#lkwGo'); await settle(200);
  ok('  nobody ticked: it says so', /Tick at least one/.test(await toasts()) && !!(await p.$('#lkWho')));
  await ev(() => document.querySelector('#lkWho input[value="sandra"]').click());
  await p.click('#lkwGo'); await settle(300);
  ok('then who rolls first: you and Sandra', await ev(() => !!$('lkFirst')
    && [...$('lkFirst').querySelectorAll('[data-lkfirst] b')].map(b => b.textContent).join() === 'Me,Sandra'));
  ok('  saying how to choose', await ev(() => /first to\s+roll a 6/.test($('lkFirst').textContent)));
  await p.click('[data-lkfirst="0"]'); await settle(500);
  let r = await rpcs('new_game');
  ok('the game is started for you both, you rolling first', r.length === 1 && r[0].args.players.join() === 'me,sandra' && r[0].args.first_seat === 0, JSON.stringify(r));
  ok('  and its sheet opens on top', await top() === 'lkPlay');
  const G1 = await ev(() => LK_CUR);

  // ---------------------------------------------------------------
  console.log('\nThe sheet, on a phone turned sideways');
  const lay = await ev(() => {
    const st = $('lkStage').getBoundingClientRect(), rows = [...document.querySelectorAll('.lkrow')];
    return { w: st.width, h: st.height, iw: innerWidth, ih: innerHeight, tf: getComputedStyle($('lkStage')).transform,
      rows: rows.map(x => x.dataset.lkrow).join(), red: [...rows[0].querySelectorAll('.lkn')].map(b => b.textContent).join(),
      green: [...rows[2].querySelectorAll('.lkn')].map(b => b.textContent).join(), cells: rows.map(x => x.querySelectorAll('.lkn').length),
      gates: document.querySelectorAll('.lkgate').length, cell: document.querySelector('.lkn').getBoundingClientRect().toJSON(),
      done: $('lkDone').getBoundingClientRect().toJSON(),
      spill: [...document.querySelectorAll('#lkStage *')].filter(e => { const r = e.getBoundingClientRect();
        return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1; }).length }; });
  ok('it fills the screen, the right way up', lay.tf === 'none' && Math.abs(lay.w - lay.iw) < 2 && Math.abs(lay.h - lay.ih) < 2, JSON.stringify(lay));
  ok('four rows: red, yellow, green, blue', lay.rows === 'red,yellow,green,blue');
  ok('  eleven numbers in each, and a lock at the end', lay.cells.every(n => n === 11) && lay.gates === 4);
  ok('  red goes 2 up to 12, green 12 down to 2', lay.red === '2,3,4,5,6,7,8,9,10,11,12' && lay.green === '12,11,10,9,8,7,6,5,4,3,2');
  ok('  every number big enough for a finger', lay.cell.width >= 44 && lay.cell.height >= 40, JSON.stringify(lay.cell));
  ok('  and nothing spills off the screen', lay.spill === 0, lay.spill);
  ok('the bottom tiles are out of the way while playing', await ev(() => getComputedStyle($('tray')).display === 'none'));
  ok('  and so is the new-version bar', await ev(() => [...document.styleSheets].some(s => { try { return [...s.cssRules]
    .some(r => /#lkPlay:not\(\.hidden\)\)?\s*#verBar/.test(r.cssText) && /display: none/.test(r.cssText)); } catch (e) { return false; } })));
  ok('it says it is your roll, and what you can mark', /Your roll/.test(await status()) && /white and a colour/.test(await status()), await status());
  ok('the players along the top, the roller marked', await ev(() => {
    const s = [...document.querySelectorAll('.lkwho span')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    return s.length === 2 && /^. You 0$/.test(s[0]) && /^Sandra 0$/.test(s[1]); }),
    JSON.stringify(await ev(() => [...document.querySelectorAll('.lkwho span')].map(x => x.textContent))));

  // ---------------------------------------------------------------
  console.log('\nMarking on your own roll');
  await clear();
  await tap('red', 5);
  ok('tap red 5: marked', /\bon\b/.test(await cell('red', 5)) && /\bnow\b/.test(await cell('red', 5)), await cell('red', 5));
  ok('  2, 3 and 4 are crossed out', (await Promise.all([2, 3, 4].map(n => cell('red', n)))).every(c => /gone/.test(c)));
  ok('  6 onwards still open', !/gone|on/.test(await cell('red', 6)));
  r = await rpcs('save_sheet');
  ok('  and it is saved for the others to see', r.length === 1 && r[0].args.g === G1 && r[0].args.s.red.join() === '5'
    && r[0].args.s.turn.no === 1 && JSON.stringify(r[0].args.s.turn.marks) === '[["red",5]]', JSON.stringify(r));
  ok('  the row now says 1 mark, and scores 1', await ev(() => document.querySelector('[data-lkrow="red"] .lkcount').textContent === '1'
    && document.querySelector('.lkfoot .lkbox').textContent === '1'));
  await tap('yellow', 3);
  ok('a second mark on your own roll: fine', /\bon\b/.test(await cell('yellow', 3)));
  await tap('green', 12);
  ok('  a third: no', !/\bon\b/.test(await cell('green', 12)) && /Two marks is the most/.test(await toasts()), await toasts());
  await tap('red', 3);
  ok('a number already passed: no, and it says why', /passed: marks go left to right/.test(await toasts()), await toasts());
  await tap('red', 5);
  ok('tap the newest mark again: it comes off', !/\bon\b/.test(await cell('red', 5)) && !/gone/.test(await cell('red', 2)));
  ok('  and the crossings out with it', (await mine()).red.length === 0 && (await mine()).turn.marks.length === 1);
  await tap('red', 5);
  await tap('red', 12);
  ok('a third mark, even the 12: no', !/\bon\b/.test(await cell('red', 12)) && /Two marks/.test(await toasts()), await toasts());

  // ---------------------------------------------------------------
  console.log('\nDone, and the dice passing on');
  await clear();
  await p.click('#lkDone'); await settle(400);
  r = await rpcs('finish_turn');
  ok('Done tells the game you have finished with roll 1', r.length === 1 && r[0].args.at_turn === 1 && r[0].args.move_on === false, JSON.stringify(r));
  ok('  no penalty asked: you marked something', asked.length === 0, asked.join(' | '));
  ok('  now it waits for Sandra', /Waiting for Sandra/.test(await status()), await status());
  ok('  you rolled, so you can carry on without her: beside Stop game, not where Done is (ML241)', await ev(() => !!$('lkOn')
    && !!$('lkOn').closest('.lkends') && !$('lkOn').closest('.lkbar') && $('lkOn').nextElementSibling === $('lkStop')));
  ok('  and Done stays put, greyed, until Sandra has tapped hers', await ev(() => !!$('lkDone') && $('lkDone').disabled
    && /Done ✓/.test($('lkDone').textContent)));
  const ends = await ev(() => { const w = document.querySelector('.lkwho').getBoundingClientRect(), o = $('lkOn').getBoundingClientRect(),
    s = $('lkStop').getBoundingClientRect(); return { w: w.right, o: [o.left, o.right, o.width], s: [s.left, s.right] }; });
  ok('  both fit on the line, side by side', ends.o[2] > 100 && ends.o[1] <= ends.s[0] + 1 && ends.s[1] <= ends.w + 1, JSON.stringify(ends));
  await tap('blue', 12);
  ok('  your marks for that roll are finished', /finished with this roll/.test(await toasts()), await toasts());
  await as('sandra', 'finish_turn', { g: G1, at_turn: 1 });
  ok('Sandra finishes: it is her roll', /Sandra is rolling/.test(await status()) && /white dice total is yours too/.test(await status()), await status());
  ok('  and the roller mark moves to her', await ev(() => /Sandra/.test(document.querySelector('.lkwho span.roll').textContent)));
  ok('  Done is there again', !!(await p.$('#lkDone')) && await ev(() => !$('lkDone').disabled));
  await tap('blue', 12);
  ok('on someone else’s roll, one mark (the white dice)', /\bon\b/.test(await cell('blue', 12)));
  await tap('blue', 10);
  ok('  a second: no, and it says why', !/\bon\b/.test(await cell('blue', 10)) && /One mark is the most/.test(await toasts()), await toasts());
  await p.click('#lkDone'); await settle(300);
  ok('  Done, waiting for Sandra, and no carrying on: it is not your roll', /Waiting for Sandra/.test(await status()) && !(await p.$('#lkOn')));
  await clearToasts();
  await as('sandra', 'finish_turn', { g: G1, at_turn: 2 });
  ok('Sandra finishes: your roll again, and it says so', /Your roll/.test(await status()) && /Your roll/.test(await toasts()), await toasts());

  // ---------------------------------------------------------------
  console.log('\nA penalty for each number not taken');
  answer = false; asked.length = 0; await clear();
  await p.click('#lkDone'); await settle(300);
  ok('neither number taken on your own roll: Done asks about two penalties', asked.length === 1
    && /took neither number/.test(asked[0]) && /two penalties: minus 10/.test(asked[0]) && /Take them, or go back and mark something\?/.test(asked[0]), asked.join(' | '));
  ok('  Cancel goes back to marking, nothing sent', (await rpcs('finish_turn')).length === 0 && (await mine()).pen === 0);
  answer = true; asked.length = 0;
  await p.click('#lkDone'); await settle(400);
  ok('  OK takes them: two penalty boxes crossed', (await mine()).pen === 2 && await ev(() => document.querySelectorAll('.lkpen.on').length === 2));
  ok('  minus 10 in the total', await ev(() => [...document.querySelectorAll('.lkfoot .lkbox')].map(b => b.textContent).join() === '1,1,0,1,10,-7'),
    await ev(() => [...document.querySelectorAll('.lkfoot .lkbox')].map(b => b.textContent).join()));
  ok('  and the roll is finished', (await rpcs('finish_turn')).length === 1);
  ok('  shown beside your name for the others, one cross each', await ev(() => /✕✕/.test(document.querySelector('.lkwho span.me').textContent)));
  await as('sandra', 'finish_turn', { g: G1, at_turn: 3 });

  // ---------------------------------------------------------------
  console.log('\nClosing a lock');
  // Your sheet as it stands on roll 4 (Sandra's): red 2 to 5.
  await ev(() => { const me = window.__rows.game_players.find(x => x.game_id === LK_CUR && x.user_id === 'me');
    me.sheet = { red: [2, 3, 4, 5], yellow: [3], blue: [12], pen: 1 }; });
  await as('sandra', 'finish_turn', { g: G1, at_turn: 4, move_on: true });   // she carries on without you: your roll 5
  ok('the roller (Sandra) carried on without you: your roll', /Your roll/.test(await status()) && (await game()).turn_no === 5, await status());
  answer = false; asked.length = 0;
  await tap('red', 12);
  ok('four marks in red: the 12 asks first, saying it would not close the lock', asked.length === 1 && /Mark the 12 in red\?/.test(asked[0])
    && /fewer than five red marks/.test(asked[0]) && /does not close the lock/.test(asked[0]) && /can’t mark red again/.test(asked[0]), asked.join(' | '));
  ok('  Cancel leaves it unmarked', !/\bon\b/.test(await cell('red', 12)) && (await rpcs('close_row')).length === 0);
  await tap('red', 6);
  answer = false; asked.length = 0;
  await tap('red', 12);
  ok('five marks: the 12 asks first, saying it closes red for everyone', asked.length === 1 && /close the red lock/.test(asked[0]) && /Nobody can mark red/.test(asked[0])
    && /Undo last move opens it again, until you tap Done/.test(asked[0]), asked.join(' | '));
  ok('  Cancel leaves it open', !/\bon\b/.test(await cell('red', 12)) && (await rpcs('close_row')).length === 0);
  answer = true; await clear();
  await tap('red', 12);
  r = await rpcs('close_row');
  ok('  OK: marked, and the lock closed for everyone', /\bon\b/.test(await cell('red', 12)) && r.length === 1 && r[0].args.colour === 'red', JSON.stringify(r));
  ok('  on this roll', (await game()).closed.red === 5, JSON.stringify((await game()).closed));
  ok('  the gate is shut, and yours', await ev(() => /shut/.test(document.querySelector('[data-lkgate="red"]').className)
    && /mine/.test(document.querySelector('[data-lkgate="red"]').className)));
  ok('  it counts as a seventh mark: 28 points', await ev(() => document.querySelector('[data-lkrow="red"] .lkcount').textContent === '7'
    && document.querySelector('.lkfoot .lkbox').textContent === '28'));
  ok('  and says to put the red die aside', /Put that die aside/.test(await toasts()), await toasts());
  answer = false; asked.length = 0; await clear();
  await tap('red', 12);
  ok('tap the 12 again on the same roll: it asks before opening the lock again for everyone', asked.length === 1
    && /Take back the 12 and open the red lock again, for everyone\?/.test(asked[0]), asked.join(' | '));
  ok('  Cancel keeps it closed', /\bon\b/.test(await cell('red', 12)) && (await rpcs('reopen_row')).length === 0 && (await game()).closed.red === 5);
  answer = true; asked.length = 0; await clearToasts();
  await p.click('#lkUndo'); await settle(400);
  r = await rpcs('reopen_row');
  ok('Undo last move: the 12 taken back and the lock open again, for everyone', asked.length === 1 && r.length === 1 && r[0].args.colour === 'red'
    && !/\bon\b/.test(await cell('red', 12)) && (await game()).closed.red === undefined && !(await mine()).locked.includes('red'), JSON.stringify(r));
  ok('  the gate is open again, and it says to put the die back', await ev(() => !/shut/.test(document.querySelector('[data-lkgate="red"]').className))
    && /open again: put that die back/.test(await toasts()), await toasts());
  ok('  red is back to five marks: 15 points', await ev(() => document.querySelector('[data-lkrow="red"] .lkcount').textContent === '5'
    && document.querySelector('.lkfoot .lkbox').textContent === '15'));
  await tap('red', 12);
  ok('  and the 12 closes it again', (await game()).closed.red === 5 && (await mine()).locked.includes('red') && /\bon\b/.test(await cell('red', 12)));
  await p.click('#lkDone'); await settle(300);
  await as('sandra', 'finish_turn', { g: G1, at_turn: 5 });
  await tap('red', 7);
  ok('the next roll, red is closed for good', !/\bon\b/.test(await cell('red', 7)), await toasts());
  await tap('red', 12);
  ok('  its 12 cannot be taken back now: a closed lock stays closed', /\bon\b/.test(await cell('red', 12)) && /stays closed/.test(await toasts()), await toasts());
  ok('  and Undo last move has nothing to take back', await ev(() => $('lkUndo').disabled));

  // A lock Sandra closed, on this roll
  await clearToasts();
  await as('sandra', 'close_row', { g: G1, colour: 'yellow' });
  ok('a lock closed by Sandra this roll: its gate is shut for you too', await ev(() => /shut/.test(document.querySelector('[data-lkgate="yellow"]').className)
    && !/mine/.test(document.querySelector('[data-lkgate="yellow"]').className)));
  ok('  your phone says you can still mark yellow on this roll', /yellow lock has been closed\. You can still mark yellow on this roll, until you tap Done/.test(await toasts()), await toasts());
  ok('  and so does the line at the top', /The yellow lock closes after this roll: you can still mark yellow now/.test(await status()), await status());
  await tap('yellow', 8);
  ok('  the white dice total in yellow: marked, though Sandra has closed it', /\bon\b/.test(await cell('yellow', 8)) && !/gone/.test(await cell('yellow', 8)));

  // ---------------------------------------------------------------
  console.log('\nThe end of the game');
  await p.click('#lkDone'); await settle(300);
  await as('sandra', 'finish_turn', { g: G1, at_turn: 6 });
  ok('two locks closed: when the roll is finished, the game is over', (await game()).status === 'ended' && /Game over/.test(await status()), await status());
  const over = await ev(() => $('lkStage').querySelector('.lkover') ? $('lkStage').querySelector('.lkover').textContent.replace(/\s+/g, ' ') : '');
  ok('  the final scores, the winner first', /You won, 27 to 0/.test(over) && /Two locks were closed/.test(over), over);
  ok('  with Play again and Back to games', !!(await p.$('#lkAgain')) && !!(await p.$('#lkOverBack')));
  ok('  and, as you started it, Clear it away', !!(await p.$('#lkClear')));
  ok('  no Done or Stop once it has ended', !(await p.$('#lkDone')) && !(await p.$('#lkStop')));
  await clearToasts(); await ev(() => lkTap('blue', 9)); await settle(200);
  ok('  and nothing more can be marked (the scores sit over the sheet anyway)', !/\bon\b/.test(await cell('blue', 9)) && /has ended/.test(await toasts()), await toasts());
  await p.click('#lkOverBack'); await settle(400);
  ok('Back to games: the list, with it under Finished', await top() === 'games' && await ev(() =>
    /Finished/.test($('gamesBody').textContent) && /You won/.test($('gamesBody').textContent)));

  // ---------------------------------------------------------------
  console.log('\nThe list, the number on the tile, and stopping');
  await ev(async () => { window.__who = 'sandra'; window.__rpc('new_game', { players: ['sandra', 'me'], first_seat: 0 }); window.__who = null;
    await lkReload(); renderGames(); });
  const G2 = await ev(() => Math.max(...GAMES.map(g => g.id)));
  ok('a game Sandra started shows up for you', await ev(() => /Going on/.test($('gamesBody').textContent) && /Sandra is rolling/.test($('gamesBody').textContent)));
  ok('  the Games tile shows 1: a mark for you to make', await ev(() => lkWaitingCount() === 1 && tilePip('games') === 1));
  await ev(id => document.querySelector(`[data-lkgame="${id}"]`).click(), G2); await settle(400);
  ok('tap it: its sheet opens, Sandra rolling', await top() === 'lkPlay' && /Sandra is rolling/.test(await status()));
  answer = true; asked.length = 0;
  await p.click('#lkStop'); await settle(300);
  ok('Stop game asks, then stops it for everyone, scores kept', asked.length === 1 && /Stop this game for everyone/.test(asked[0])
    && (await game()).status === 'ended' && (await game()).end_reason === 'Stopped');
  ok('  Sandra started this one, so you cannot clear it away', !(await p.$('#lkClear')));
  ok('  and the tile number goes', await ev(() => lkWaitingCount() === 0));
  await p.click('#lkOverBack'); await settle(300);
  await ev(id => document.querySelector(`[data-lkgame="${id}"]`).click(), G1); await settle(400);
  asked.length = 0;
  await p.click('#lkClear'); await settle(400);
  ok('Clear it away (yours): asks, then it is gone from the list', asked.length === 1 && await top() === 'games'
    && await ev(id => !document.querySelector(`[data-lkgame="${id}"]`) && !GAMES.some(g => g.id === id), G1));

  // ---------------------------------------------------------------
  console.log('\nHeld upright');
  await ev(async () => { window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }); await lkReload(); renderGames(); });
  const G3 = await ev(() => Math.max(...GAMES.map(g => g.id)));
  await p.setViewportSize({ width: 390, height: 844 }); await settle(300);
  await ev(id => lkOpen(id), G3); await settle(400);
  const up = await ev(() => { const st = $('lkStage'), r = st.getBoundingClientRect();
    return { tf: getComputedStyle(st).transform, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, x: r.left, y: r.top }; });
  ok('the sheet turns itself round to fill the screen', up.tf !== 'none' && Math.abs(up.w - up.iw) < 2 && Math.abs(up.h - up.ih) < 2 && Math.abs(up.x) < 2 && Math.abs(up.y) < 2, JSON.stringify(up));
  ok('  its top along the right-hand side, to read with the phone turned left', await ev(() => {
    const bar = document.querySelector('.lkbar').getBoundingClientRect(), foot = document.querySelector('.lkfoot').getBoundingClientRect();
    return bar.left > foot.left && bar.right > innerWidth - 80; }));
  await tap('red', 4);
  ok('  and the numbers still answer to a tap', /\bon\b/.test(await cell('red', 4)));
  await p.setViewportSize({ width: 844, height: 390 }); await settle(300);
  ok('turned sideways, it is the right way up again', await ev(() => getComputedStyle($('lkStage')).transform === 'none'));

  // ---------------------------------------------------------------
  console.log('\nOne number taken, one not');
  // Game 3, your roll: red 4 taken, the second number not.
  answer = false; asked.length = 0;
  await p.click('#lkDone'); await settle(300);
  ok('one number taken on your own roll: Done asks about one penalty', asked.length === 1 && /took one number/.test(asked[0])
    && /a penalty: minus 5/.test(asked[0]) && /mark another/.test(asked[0]), asked.join(' | '));
  // This time Done finds no signal: the penalty is kept, the roll not finished.
  await ev(() => { window.__lkReal = window.__rpc; window.__rpc = (n, a) => n === 'finish_turn'
    ? { data: null, error: { message: 'Failed to fetch' } } : window.__lkReal(n, a); });
  answer = true; asked.length = 0; await clearToasts();
  await p.click('#lkDone'); await settle(400);
  ok('  OK takes it: one box crossed, though there was no signal to finish the roll', (await mine()).pen === 1
    && /check your signal/.test(await toasts()) && !!(await p.$('#lkDone')), await toasts());
  await tap('red', 4);
  ok('  the roll’s marks then stay as they are: red 4 cannot be taken back to owe two', /\bon\b/.test(await cell('red', 4))
    && /taken the penalty/.test(await toasts()), await toasts());
  ok('  nor with Undo last move', await ev(() => $('lkUndo').disabled) && await (async () => { await clearToasts();
    await ev(() => lkUndo()); await settle(200); return /taken the penalty/.test(await toasts()) && /\bon\b/.test(await cell('red', 4)); })(), await toasts());
  await tap('yellow', 5);
  ok('  nor a second number added to owe none', !/\bon\b/.test(await cell('yellow', 5)) && /taken the penalty/.test(await toasts()), await toasts());
  await ev(() => { window.__rpc = window.__lkReal; }); asked.length = 0; await clear();
  await p.click('#lkDone'); await settle(400);
  ok('  Done again, with signal: the roll finishes, with no second penalty', asked.length === 0 && (await mine()).pen === 1
    && (await rpcs('finish_turn')).length === 1, asked.join(' | '));
  await as('sandra', 'finish_turn', { g: G3, at_turn: 1 });
  asked.length = 0; await clear();
  await p.click('#lkDone'); await settle(300);
  ok('Sandra’s roll, nothing taken: no penalty', asked.length === 0 && (await mine()).pen === 1 && (await rpcs('finish_turn')).length === 1, asked.join(' | '));
  await as('sandra', 'finish_turn', { g: G3, at_turn: 2 });
  await ev(async () => { const me = window.__rows.game_players.find(x => x.game_id === LK_CUR && x.user_id === 'me');
    me.sheet = { ...me.sheet, pen: 3 }; await lkReload(LK_CUR); lkPaint(); }); await settle(200);
  asked.length = 0;
  await p.click('#lkDone'); await settle(400);
  ok('three penalties already, neither number taken: four boxes is the most, so one more', asked.length === 1
    && /four is the most/.test(asked[0]) && /your fourth, so the game ends after this roll/.test(asked[0]) && (await mine()).pen === 4, asked.join(' | '));
  await as('sandra', 'finish_turn', { g: G3, at_turn: 3 });
  ok('  and when Sandra finishes, the game is over', (await game()).status === 'ended' && (await game()).end_reason === 'Four penalties', JSON.stringify(await game()));
  await ev(() => lkBackToList()); await settle(300);

  // ---------------------------------------------------------------
  console.log('\nUndo last move (ML213)');
  await ev(async () => { window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }); await lkReload(); renderGames(); });
  const G4 = await ev(() => Math.max(...GAMES.map(g => g.id)));
  await ev(id => lkOpen(id), G4); await settle(400);
  const undoOff = () => ev(() => !!$('lkUndo') && $('lkUndo').disabled);
  ok('an Undo last move button on the bar, with nothing to take back yet', await undoOff()
    && /Undo last move/.test(await ev(() => $('lkUndo').textContent)));
  ok('  it fits on the bar beside Done, big enough for a thumb', await ev(() => { const u = $('lkUndo').getBoundingClientRect(),
    d = $('lkDone').getBoundingClientRect(), s = $('lkStatus').getBoundingClientRect();
    return u.right <= d.left && u.left >= s.right - 1 && u.height >= 40 && d.right <= innerWidth && s.width > 150; }));
  await clear();
  await tap('red', 4); await tap('green', 10);
  ok('two marks on your own roll: Undo is ready', !(await undoOff()));
  await p.click('#lkUndo'); await settle(300);
  ok('Undo takes back the newest first: green 10', !/\bon\b/.test(await cell('green', 10)) && /\bon\b/.test(await cell('red', 4))
    && JSON.stringify((await mine()).turn.marks) === '[["red",4]]', JSON.stringify(await mine()));
  r = await rpcs('save_sheet');
  ok('  and saves that for the others', r.length === 3 && r[2].args.s.green.length === 0 && r[2].args.s.red.join() === '4', JSON.stringify(r.map(x => x.args.s)));
  await p.click('#lkUndo'); await settle(300);
  ok('  then red 4, and the crossings out with it', !/\bon\b/.test(await cell('red', 4)) && !/gone/.test(await cell('red', 2))
    && (await mine()).turn.marks.length === 0);
  ok('  nothing left to take back', await undoOff());
  await clearToasts(); await ev(() => lkUndo()); await settle(200);
  ok('  (asked anyway, it says why)', /Nothing to undo/.test(await toasts()), await toasts());
  await tap('yellow', 6); await tap('blue', 9);
  asked.length = 0;
  await p.click('#lkDone'); await settle(300);
  ok('Done: Undo has nothing it may take back now', asked.length === 0 && await undoOff() && await (async () => { await clearToasts();
    await ev(() => lkUndo()); await settle(200); return /finished with this roll/.test(await toasts()); })(), await toasts());
  await as('sandra', 'finish_turn', { g: G4, at_turn: 1 });

  console.log('\nThe 12, or the 2, without five marks (ML212)');
  // Roll 2, Sandra's: one mark, the white dice total.
  answer = false; asked.length = 0; await clear();
  await tap('blue', 2);
  ok('blue 2 with one blue mark: it asks first, saying it will not close the lock', asked.length === 1 && /Mark the 2 in blue\?/.test(asked[0])
    && /fewer than five blue marks/.test(asked[0]) && /does not close the lock/.test(asked[0]), asked.join(' | '));
  ok('  Cancel: not marked, nothing saved', !/\bon\b/.test(await cell('blue', 2)) && (await rpcs('save_sheet')).length === 0);
  answer = true; asked.length = 0;
  await tap('blue', 2);
  ok('  OK: marked, a mark like any other', /\bon\b/.test(await cell('blue', 2)) && (await mine()).blue.join() === '9,2', JSON.stringify(await mine()));
  ok('  the lock stays open, for you and everyone', (await rpcs('close_row')).length === 0 && !(await mine()).locked.includes('blue')
    && await ev(() => !/shut/.test(document.querySelector('[data-lkgate="blue"]').className)) && (await game()).closed.blue === undefined);
  ok('  the rest of blue is crossed out for you', (await Promise.all([8, 7, 3].map(n => cell('blue', n)))).every(c => /gone/.test(c)));
  ok('  blue has 2 marks: 3 points', await ev(() => document.querySelector('[data-lkrow="blue"] .lkcount').textContent === '2'
    && document.querySelectorAll('.lkfoot .lkbox')[3].textContent === '3'));
  await p.click('#lkUndo'); await settle(300);
  ok('Undo takes it back again, on someone else’s roll too', !/\bon\b/.test(await cell('blue', 2)) && !/gone/.test(await cell('blue', 8)));

  console.log('\nA lock Sandra closes, then opens again');
  await clearToasts();
  await ev(() => { const s = window.__rows.game_players.find(x => x.game_id === LK_CUR && x.user_id === 'sandra');
    s.sheet = { yellow: [2, 3, 4, 5, 6, 12], locked: ['yellow'] }; });
  await as('sandra', 'close_row', { g: G4, colour: 'yellow' });
  ok('Sandra closes yellow: you are told you can still mark yellow on this roll', /yellow lock has been closed\. You can still mark yellow/.test(await toasts()), await toasts());
  await tap('yellow', 8);
  ok('  your white dice total in yellow: marked', /\bon\b/.test(await cell('yellow', 8)));
  await clearToasts();
  await as('sandra', 'reopen_row', { g: G4, colour: 'yellow' });
  ok('Sandra takes hers back: your phone says the lock is open again', /yellow lock is open again/.test(await toasts())
    && (await game()).closed.yellow === undefined && await ev(() => !/shut/.test(document.querySelector('[data-lkgate="yellow"]').className)), await toasts());
  ok('  and your yellow 8 stays', /\bon\b/.test(await cell('yellow', 8)));
  await p.click('#lkDone'); await settle(300);
  await as('sandra', 'finish_turn', { g: G4, at_turn: 2 });

  console.log('\nTaking back a lock someone else closed on the same roll');
  await ev(async () => { const P = window.__rows.game_players.filter(x => x.game_id === LK_CUR);
    P.find(x => x.user_id === 'me').sheet = { red: [2, 3, 4, 5, 6], pen: 0 };
    P.find(x => x.user_id === 'sandra').sheet = { red: [2, 3, 4, 5, 6], pen: 0 }; await lkReload(LK_CUR); lkPaint(); }); await settle(200);
  answer = true; await clear();
  await tap('red', 12);
  ok('roll 3, yours: you close red', (await game()).closed.red === 3 && (await mine()).locked.includes('red'));
  await ev(() => { const s = window.__rows.game_players.find(x => x.game_id === LK_CUR && x.user_id === 'sandra');
    s.sheet = { red: [2, 3, 4, 5, 6, 12], locked: ['red'] }; });
  await clearToasts(); asked.length = 0;
  await p.click('#lkUndo'); await settle(400);
  ok('Sandra closed it too: Undo asks, saying the lock and its bonus go to her', asked.length === 1
    && /Take back the 12\? The red lock stays closed, and it and its bonus go to Sandra\./.test(asked[0]), asked.join(' | '));
  ok('  takes back your 12, and red stays closed: it is hers', !/\bon\b/.test(await cell('red', 12))
    && !(await mine()).locked.includes('red') && (await game()).closed.red === 3 && /stays closed: it is Sandra’s/.test(await toasts()), await toasts());
  asked.length = 0; await clearToasts();
  await tap('red', 12);
  ok('  taking the 12 again on your roll asks: it is your roll, so the lock will be yours', asked.length === 1
    && /Sandra has closed the red lock, but it is your roll, so the lock and its bonus will be yours, and Sandra’s 12 counts as a mark/.test(asked[0]), asked.join(' | '));
  ok('  marked, and the lock is yours again', /\bon\b/.test(await cell('red', 12)) && (await mine()).locked.includes('red')
    && await ev(() => /mine/.test(document.querySelector('[data-lkgate="red"]').className))
    && /closed and it is yours: Sandra’s 12 counts as a mark/.test(await toasts()), await toasts());

  console.log('\nBefore step 58 is run');
  await ev(() => { window.__lkReal = window.__rpc; window.__rpc = (n, a) => n === 'reopen_row'
    ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.reopen_row' } } : window.__lkReal(n, a); });
  await clearToasts();
  await p.click('#lkUndo'); await settle(300);
  ok('Undo of a lock says it needs step 58, and nothing changes', /needs step 58 run in Supabase first/.test(await toasts())
    && /\bon\b/.test(await cell('red', 12)) && (await mine()).locked.includes('red'), await toasts());
  await ev(() => { window.__rpc = window.__lkReal; });
  await p.click('#lkUndo'); await settle(300);
  ok('  with step 58 run, it works again', !/\bon\b/.test(await cell('red', 12)) && !(await mine()).locked.includes('red') && (await game()).closed.red === 3);
  await ev(() => lkBackToList()); await settle(300);

  // ---------------------------------------------------------------
  console.log('\nOne lock, one holder: the roller first, then round in turn (ML240)');
  // Seats: you 0, Sandra 1, Someone Else 2. Sandra rolls first, so on roll 1
  // she is first in line for a lock, Someone Else second and you third.
  await ev(async () => { window.__rpc('new_game', { players: ['me', 'sandra', 'other'], first_seat: 1 }); await lkReload(); });
  const G5 = await ev(() => Math.max(...GAMES.map(g => g.id)));
  await ev(async id => { window.__rows.game_players.filter(x => x.game_id === id).forEach(x => { x.sheet = { red: [2, 3, 4, 5, 6], pen: 0 }; });
    await lkReload(id); await lkOpen(id); }, G5); await settle(300);
  const claim = (who, c, n) => ev(([w, id, c, n]) => { const s = window.__rows.game_players.find(x => x.game_id === id && x.user_id === w);
    s.sheet = { ...s.sheet, [c]: [...(s.sheet[c] || []), n], locked: [...((s.sheet.locked) || []), c] }; }, [who, G5, c, n]);
  const unclaim = (who, c) => ev(([w, id, c]) => { const s = window.__rows.game_players.find(x => x.game_id === id && x.user_id === w);
    s.sheet = { ...s.sheet, [c]: s.sheet[c].slice(0, -1), locked: s.sheet.locked.filter(x => x !== c) }; }, [who, G5, c]);
  const holder = c => ev(c => { const h = lkHolder(lkGame(LK_CUR), c); return h ? h.user_id : null; }, c);
  const redCount = () => ev(() => document.querySelector('[data-lkrow="red"] .lkcount').textContent);
  const redMine = () => ev(() => /mine/.test(document.querySelector('[data-lkgate="red"]').className));
  answer = true; asked.length = 0; await clearToasts();
  await tap('red', 12);
  ok('you close red first, on Sandra’s roll: it warns the roller, or anyone before you, would take it', asked.length === 1
    && /close the red lock\?/.test(asked[0]) && /If the roller, or anyone before you in turn, closes it on this roll too, the lock and its bonus go to them/.test(asked[0]), asked.join(' | '));
  ok('  for now it is yours: 7 marks, the gate yours', await holder('red') === 'me' && await redCount() === '7' && await redMine());
  await clearToasts();
  await claim('other', 'red', 12); await as('other', 'close_row', { g: G5, colour: 'red' });
  ok('Someone Else closes it too: they come before you, so it goes to them, and you are told', await holder('red') === 'other'
    && /Someone Else comes before you in turn, so the red lock and its bonus go to Someone Else\. Your 12 still scores as a mark\./.test(await toasts()), await toasts());
  ok('  your 12 is a plain mark now: 6 marks, 21 points, the gate not yours', await redCount() === '6' && !(await redMine())
    && await ev(() => document.querySelector('.lkfoot .lkbox').textContent === '21'));
  await clearToasts();
  await claim('sandra', 'red', 12); await as('sandra', 'close_row', { g: G5, colour: 'red' });
  ok('Sandra, the roller, closes it as well, after both of you: it is hers', await holder('red') === 'sandra'
    && !/red lock/.test(await toasts()), await toasts());
  ok('  only she scores the lock: 28 for her, 21 each for you and Someone Else', await ev(id => {
    const g = lkGame(id); return lkPlayers(id).map(p => p.user_id + ':' + lkScore(lkSheet(p.sheet), lkLocksOf(g, p)).total).join(); }, G5)
    === 'me:21,sandra:28,other:21');
  ok('  and the scores along the top say so', await ev(() => [...document.querySelectorAll('.lkwho span b')].map(b => b.textContent).join() === '21,28,21'));
  await unclaim('sandra', 'red'); await as('sandra', 'reopen_row', { g: G5, colour: 'red' });
  ok('Sandra takes hers back: red stays closed, and it goes to Someone Else, next in turn', await holder('red') === 'other'
    && (await game()).closed.red === 1);
  await clearToasts();
  await unclaim('other', 'red'); await as('other', 'reopen_row', { g: G5, colour: 'red' });
  ok('  Someone Else takes theirs back: it comes back to you, and you are told', await holder('red') === 'me'
    && /The red lock and its bonus are yours now/.test(await toasts()) && await redCount() === '7', await toasts());
  await claim('other', 'red', 12); await as('other', 'close_row', { g: G5, colour: 'red' });
  answer = false; asked.length = 0;
  await p.click('#lkUndo'); await settle(300);
  ok('Undo on your 12 when someone nearer the roller has it: it stays with them', asked.length === 1
    && /Take back the 12\? The red lock stays closed, and it and its bonus stay with Someone Else\./.test(asked[0]), asked.join(' | '));
  answer = true; asked.length = 0; await clearToasts();
  await p.click('#lkUndo'); await settle(400);
  ok('  taken back: red closed, Someone Else’s', !/\bon\b/.test(await cell('red', 12)) && await holder('red') === 'other'
    && /stays closed: it is Someone Else’s/.test(await toasts()), await toasts());
  answer = false; asked.length = 0;
  await tap('red', 12);
  ok('your 12 again, with Someone Else holding it: it says the lock is theirs, the 12 a plain mark', asked.length === 1
    && /Someone Else has closed the red lock and comes before you in turn, so the lock and its bonus are theirs\. Your 12 scores as a mark/.test(asked[0]), asked.join(' | '));
  answer = true; asked.length = 0; await clearToasts();
  await tap('red', 12);
  ok('  Mark it: marked, Someone Else keeps the lock', /\bon\b/.test(await cell('red', 12)) && await holder('red') === 'other'
    && /Marked\. The red lock and its bonus are Someone Else’s, and your 12 counts as a mark/.test(await toasts()) && await redCount() === '6', await toasts());
  await clearToasts();
  await p.click('[data-lkgate="red"]'); await settle(150);
  ok('  tapping the red gate says whose lock it is', /The red lock is closed: it is Someone Else’s/.test(await toasts()), await toasts());
  await p.click('#lkDone'); await settle(300);
  await as('other', 'finish_turn', { g: G5, at_turn: 1 }); await as('sandra', 'finish_turn', { g: G5, at_turn: 1 });
  ok('after the roll, red is closed for good, still Someone Else’s', (await game()).turn_no === 2 && await holder('red') === 'other'
    && await ev(id => lkRollerSeatAt(lkGame(id), 1) === 1 && lkRollerSeatAt(lkGame(id), 2) === 2 && lkRollerSeatAt(lkGame(id), 4) === 1, G5));
  // Roll 2 is Someone Else's; roll 3 yours.
  await p.click('#lkDone'); await settle(200);
  await as('other', 'finish_turn', { g: G5, at_turn: 2 }); await as('sandra', 'finish_turn', { g: G5, at_turn: 2 });
  await ev(async id => { window.__rows.game_players.filter(x => x.game_id === id).forEach(x => { x.sheet = { ...x.sheet, yellow: [2, 3, 4, 5, 6] }; });
    await lkReload(id); lkPaint(); }, G5); await settle(200);
  await claim('sandra', 'yellow', 12); await as('sandra', 'close_row', { g: G5, colour: 'yellow' });
  ok('roll 3, yours: Sandra closes yellow first, and holds it for now', /Your roll/.test(await status()) && await holder('yellow') === 'sandra');
  answer = true; asked.length = 0; await clearToasts();
  await tap('yellow', 12);
  ok('  you take the 12 with five marks: it is your roll, so the lock and its bonus are yours', asked.length === 1
    && /Sandra has closed the yellow lock, but it is your roll, so the lock and its bonus will be yours/.test(asked[0])
    && await holder('yellow') === 'me' && /closed and it is yours: Sandra’s 12 counts as a mark/.test(await toasts()), asked.join(' | ') + ' / ' + await toasts());
  await ev(() => lkBackToList()); await settle(300);

  console.log('\nGames finished before the change keep the scores they had');
  const oldNew = await ev(() => {
    const mk = (ended) => { window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 });
      const g = window.__rows.games[window.__rows.games.length - 1];
      Object.assign(g, { status: 'ended', ended_at: ended, end_reason: 'Two rows closed', closed: { red: 1 } });
      window.__rows.game_players.filter(x => x.game_id === g.id).forEach(x => { x.sheet = { red: [2, 3, 4, 5, 6, 12], locked: ['red'] }; });
      return g.id; };
    return [mk('2026-11-08T20:00:00Z'), mk('2026-11-10T20:00:00Z')]; });
  await ev(async () => { await lkReload(); });
  ok('a game that ended on 8 Nov: both of you still score red’s lock (28 each)', await ev(id => lkResults(lkGame(id)).list.map(x => x.total).join(), oldNew[0]) === '28,28');
  ok('  one that ended from 10 Nov: only the roller does (28 to 21)', await ev(id => lkResults(lkGame(id)).list.map(x => x.total).join(), oldNew[1]) === '28,21');
  await ev(ids => { window.__rows.games = window.__rows.games.filter(g => !ids.includes(g.id));
    window.__rows.game_players = window.__rows.game_players.filter(p => !ids.includes(p.game_id)); }, oldNew);
  await ev(async () => { await lkReload(); });

  // ---------------------------------------------------------------
  console.log('\nOnly one of you starts a game (ML239)');
  await ev(async () => { if (!lkSameGame(['me', 'sandra'])) window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }); await lkReload(); });
  const dupId = await ev(() => Number(lkSameGame(['me', 'sandra']).id));
  await ev(() => openGames()); await settle(400);
  await clear(); await p.click('#lkNew'); await settle(300);
  ok('Who is playing says only one of you starts it, and where the others find it', await ev(() =>
    /Only one of you starts the game: it appears on the\s+others’ phones, under Games › Going on/.test($('lkWho').textContent)));
  await ev(() => document.querySelector('#lkWho input[value="sandra"]').click());
  await p.click('#lkwGo'); await settle(400);
  ok('a game already going with Sandra: it asks before starting another', await ev(() => !!$('lkAlready') && !$('lkFirst')
    && /You already have a game going with Sandra,\s+started by/.test($('lkAlready').textContent)
    && /Only one of you needs to start a game/.test($('lkAlready').textContent)));
  await p.click('#lkaCancel'); await settle(200);
  ok('  Cancel: nothing started', await ev(() => !$('lkAlready') && !$('lkFirst')) && (await rpcs('new_game')).length === 0);
  await p.click('#lkNew'); await settle(300);
  await ev(() => document.querySelector('#lkWho input[value="sandra"]').click());
  await p.click('#lkwGo'); await settle(400);
  await p.click('#lkaOpen'); await settle(500);
  ok('  Open that game: it opens the one already going, and starts nothing', await top() === 'lkPlay' && await ev(() => LK_CUR) === dupId
    && (await rpcs('new_game')).length === 0);
  await ev(() => lkBackToList()); await settle(300);
  await p.click('#lkNew'); await settle(300);
  await ev(() => document.querySelector('#lkWho input[value="sandra"]').click());
  await p.click('#lkwGo'); await settle(400);
  await p.click('#lkaNew'); await settle(300);
  ok('  Start another: on to who rolls first, as before', await ev(() => !!$('lkFirst')));
  await p.click('#lkfCancel'); await settle(200);
  await p.click('#lkNew'); await settle(300);
  await ev(() => { document.querySelector('#lkWho input[value="other"]').click(); });
  await p.click('#lkwGo'); await settle(400);
  ok('different people (just Someone Else): no question, straight to who rolls first', await ev(() => !$('lkAlready') && !!$('lkFirst')));
  await p.click('#lkfCancel'); await settle(200);
  ok('Help says the others don’t start one of their own', await ev(() => /They don’t start one of their own: that would make two\s+games, each waiting for the other/.test($('h-games').parentElement.textContent)
    && /stays greyed until all of you have/.test($('h-games').parentElement.textContent)
    && /Only one player gets the lock/.test($('h-games').parentElement.textContent)));
  // Someone starts a game with you while your phone is put away: picking it up catches up.
  const before = await ev(() => GAMES.length);
  await ev(() => { window.__who = 'sandra'; window.__rpc('new_game', { players: ['sandra', 'me', 'other'], first_seat: 0 }); window.__who = null; });
  await ev(() => { AWAY = Date.now(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange')); });
  await settle(400);
  ok('picking the phone up again fetches the games: the new one is there, and the tile counts it', await ev(n => GAMES.length === n + 1, before)
    && await ev(() => lkWaitingCount() >= 1));
  await ev(() => { delete document.hidden; });

  // ---------------------------------------------------------------
  console.log('\nWhen the games cannot be fetched');
  const n0 = await ev(() => GAMES.length);
  await ev(() => { window.__origFrom = window.__origFrom || sb.from;
    window.__failWith = e => ({ select: () => { const r = Promise.resolve({ data: null, error: e }); r.order = () => r; r.eq = () => r; return r; } });
    sb.from = t => (t === 'games' || t === 'game_players') ? window.__failWith({ message: 'Server unwell' }) : window.__origFrom(t); });
  await ev(() => openGames()); await settle(400);
  ok('a failed fetch keeps the games already there, never an empty list', await ev(n => GAMES.length === n && n > 0
    && document.querySelectorAll('[data-lkgame]').length === n, n0) && await ev(() => /Could not\s+fetch the games/.test($('gamesBody').textContent)));
  await ev(() => { sb.from = t => (t === 'games' || t === 'game_players')
    ? window.__failWith({ code: '42P01', message: 'relation "public.games" does not exist' }) : window.__origFrom(t); });
  await ev(() => { GAMES = []; GAME_PLAYERS = []; }); await ev(() => openGames()); await settle(400);
  ok('step 57 not run yet: it says so', await ev(() => /needs\s+step 57 run in Supabase first/.test($('gamesBody').textContent)));
  await clearToasts(); await p.click('#lkNew'); await settle(200);
  ok('  and New game says so too, rather than asking who', /step 57/.test(await toasts()) && !(await p.$('#lkWho')), await toasts());
  await ev(() => { sb.from = window.__origFrom; GAMES_READY = true; });
  ok('the app still started without step 57: the tile shows nothing', await ev(() => lkWaitingCount() === 0));

  // ---------------------------------------------------------------
  console.log('\nThe backup and step 57');
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  ok('the in-app backup copies both new tables', /select 'games',\s+count/.test(src) && /select 'game_players',\s+count/.test(src));
  const step = fs.readFileSync(path.join(ROOT, 'database', 'contacts-step57.sql'), 'utf8');
  ok('step 57 holds no emails, phone numbers, names or keys (the repo is public)', !/@/.test(step)
    && !/\b0\d{3,4}\s?\d{6}\b/.test(step) && !/eyJ|service_role|REMINDER_SECRET|sk_/i.test(step) && !/Barry|Sandra/.test(step));
  ok('  and nothing in it can be changed except through its functions', !/create policy[^;]*for (insert|update|delete|all)/i.test(step));
  const step58 = fs.readFileSync(path.join(ROOT, 'database', 'contacts-step58.sql'), 'utf8');
  ok('step 58 holds no emails, phone numbers, names or keys either', !/@/.test(step58)
    && !/\b0\d{3,4}\s?\d{6}\b/.test(step58) && !/eyJ|service_role|REMINDER_SECRET|sk_/i.test(step58) && !/Barry|Sandra/.test(step58));
  ok('  it only adds reopen_row, for signed-in people', /create or replace function reopen_row/.test(step58)
    && /revoke all on function reopen_row\(bigint, text\) from public, anon/.test(step58) && !/create table|drop table|alter table/i.test(step58));
  ok('the game is an original: no other game’s name in the page', !/qwixx/i.test(src));
  ok('it is called Loxx wherever it shows', !/['`"][^'`"\n]*Lock Keeper/.test(src) && await ev(() =>
    !/Lock Keeper/.test(document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ''))
    && $('h-games').textContent === 'MY Games: Loxx'));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
