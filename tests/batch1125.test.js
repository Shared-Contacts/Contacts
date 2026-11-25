// 25 Nov 2026 (version 2026.11.25.2), Barry's two Games requests that day:
//   ML411  Matches chosen at the start: New game asks how many games (Best
//          of 3, 5 or 7), or offers Continue with unfinished game when a
//          match with the same players isn't finished. The end of each game
//          says how the match stands, with Next game; the end of a match
//          says who won it and asks to play again. Under Games, a match not
//          finished has a gold dot, a pale gold row and Next game. Games
//          from before step 69 are still grouped as best of 3, and can be
//          carried on. (games69.test.js runs step 69's own SQL.)
//   ML412  Loxx: the white dice first. With both your marks on your own roll
//          in one row, the second must be the white and a colour: the
//          phone's dice show it; with real dice it asks.
// lkfake.js stands in for the games' functions, with window.__step69 set.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|Server unwell|^\[object Object\]$/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.route(/gov\.uk|bsky\.app|bsky\.social|open\.spotify\.com\/oembed|apple\.com/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const asked = [];
  await answerLkAsks(p, m => { asked.push(m); return true; });
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const rpcs = name => ev(n => window.__writes.filter(w => w.op === 'rpc' && w.name === n).map(w => w.args), name);
  const help = re => ev(r => new RegExp(r).test(document.documentElement.innerHTML), re);
  const there = sel => ev(s => !!document.querySelector(s), sel);
  const text = sel => ev(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply();
    window.__step69 = true; window.__lkFake(); window.__rows.games = []; window.__rows.game_players = []; });
  const newest = () => ev(() => Math.max(...window.__rows.games.map(g => g.id)));
  const row = id => ev(i => JSON.parse(JSON.stringify(window.__rows.games.find(g => g.id === i) || null)), id);
  // Ends a game, with these sheets (Loxx: red marks; Pounds: Chance), each a minute after the last.
  let tick = 0;
  const endGame = (id, pts) => ev(([i, pts, t]) => {
    const g = window.__rows.games.find(x => x.id === i);
    Object.assign(g, { status: 'ended', ended_at: new Date(Date.now() + t * 60000).toISOString(), end_reason: g.kind === 'pounds' ? 'Every box filled' : 'Two rows closed' });
    window.__rows.game_players.filter(x => x.game_id === i).forEach(x => {
      const n = pts[x.user_id] || 0;
      x.sheet = g.kind === 'pounds' ? { box: { ch: n }, extra: 0 } : { red: [2, 3, 4, 5, 6, 7].slice(0, n), pen: 0, locked: [] };
    });
  }, [id, pts, ++tick]);
  const show = async id => { await ev(async i => { if (LK_CUR != null) lkShut(); if (PD_CUR != null) pdShut();
    await lkReload(); if (pdIs(lkGame(i))) await pdOpen(i); else await lkOpen(i); }, id); await settle(400); };
  const games = async () => { await ev(async () => { if (LK_CUR != null) lkShut(); if (PD_CUR != null) pdShut();
    document.querySelectorAll('#lkPlay,#pdPlay').forEach(x => x.classList.add('hidden')); await openGames(); }); await settle(500); };
  const matches = () => ev(() => [...document.querySelectorAll('#gamesBody [data-gmmatch]')].map(x => ({ id: x.dataset.gmmatch,
    t: x.querySelector('b').textContent.replace(/\s+/g, ' ').trim(), s: x.querySelector('small').textContent.replace(/\s+/g, ' ').trim(),
    open: x.getAttribute('aria-expanded') === 'true', not: x.classList.contains('gmnot'), dot: !!x.querySelector('.gmdot'),
    next: (() => { const n = x.nextElementSibling; const b = n && n.classList.contains('gmgames') && n.querySelector('[data-gmnext]'); return b ? b.textContent.trim() : null; })() })));
  const picker = () => ev(() => { const b = $('gmPick'); if (!b) return null;
    return { heads: [...b.querySelectorAll('.dsec')].map(x => x.textContent.trim()), rows: [...b.querySelectorAll('.pplrow b')].map(x => x.textContent.trim()),
      cont: b.querySelector('#gmCont small') ? b.querySelector('#gmCont small').textContent.replace(/\s+/g, ' ').trim() : null }; });
  const tickPlayers = async (box, ids) => { for (const id of ids) await p.check(`#${box} .ppl input[value="${id}"]`); };

  // ---------------------------------------------------------------
  console.log('\nML411: a new match, chosen at New game');
  await games();
  await p.click('#lkNew'); await settle();
  await tickPlayers('lkWho', ['sandra']); await clear();
  await p.click('#lkwGo'); await p.waitForSelector('#gmPick', { timeout: 3000 }).catch(() => {});
  let pk = await picker();
  ok('after who is playing, it asks how many games: Best of 3, 5 or 7', pk && pk.heads.join() === 'How many games?'
    && pk.rows.join() === 'Best of 3,Best of 5,Best of 7' && !pk.cont, JSON.stringify(pk));
  ok('  each says how many wins it takes', await ev(() => [...$('gmPick').querySelectorAll('.pplrow small')].map(x => x.textContent.trim()).join('|'))
    === 'The first to win 2 games|The first to win 3 games|The first to win 4 games');
  ok('  nothing spills off the side at 320 wide', await (async () => {
    await p.setViewportSize({ width: 320, height: 700 }); await settle(200);
    const r = await ev(() => { const b = $('gmPick').querySelector('.inner'); return b.scrollWidth <= b.clientWidth + 1; });
    await p.setViewportSize({ width: 390, height: 844 }); return r; })());
  await p.click('[data-gmof="5"]'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  ok('Best of 5, then who rolls first, as before', await there('#lkFirst') && !(await there('#gmPick')));
  await p.click('[data-lkfirst="0"]'); await settle(600);
  const g1 = await newest();
  let sm = await rpcs('set_match');
  ok('the game starts and is noted as the first of a best of 5', sm.length && JSON.stringify(sm[sm.length - 1]) === JSON.stringify({ g: g1, m: { of: 5, first: g1 } })
    && JSON.stringify((await row(g1)).match) === JSON.stringify({ of: 5, first: g1 }) && await ev(() => LK_CUR) === g1, JSON.stringify(sm));
  await games();
  ok('under Going on, it says which game of the match it is', /best of 5, game 1/.test(await text('#gamesBody [data-lkgame="' + g1 + '"]')),
    await text('#gamesBody [data-lkgame="' + g1 + '"]'));
  ok('  and with no game finished yet, the match isn\'t under Finished', (await matches()).length === 0);

  console.log('\nML411: the end of a game, and Next game');
  await endGame(g1, { me: 2, sandra: 0 });
  await show(g1);
  ok('the end box says how the match stands', await text('.lkover .gmline') === 'Best of 5, the first to 3 wins: You 1, Sandra 0.', await text('.lkover .gmline'));
  ok('  with Next game in place of Play again, and no winner yet', await there('#lkNext') && !(await there('#lkAgain')) && !(await there('.lkover .gmwin')));
  await clear();
  await p.click('#lkNext'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  ok('Next game goes straight to who rolls first: no asking who is playing, or how many games', await there('#lkFirst')
    && !(await there('#lkWho')) && !(await there('#gmPick')));
  await p.click('[data-lkfirst="1"]'); await settle(600);
  const g2 = await newest();
  ok('  the next game is in the same match, with the same players and dice', g2 > g1 && JSON.stringify((await row(g2)).match) === JSON.stringify({ of: 5, first: g1 })
    && await ev(i => lkPlayers(i).map(p => p.user_id).sort().join(), g2) === 'me,sandra' && await ev(i => lkReal(lkGame(i)), g2) && await ev(() => LK_CUR) === g2);
  await games();
  let m = await matches();
  ok('under Finished: Loxx, the match not finished: gold dot, pale gold row, open', m.length === 1 && m[0].t === 'Best of 5 with Sandra'
    && m[0].not && m[0].dot && m[0].open, JSON.stringify(m));
  ok('  saying its game is going on, the wins so far, and Back to the game', /^Game going on: You 1, Sandra 0 · .* · 1 game$/.test(m[0].s) && m[0].next === 'Back to the game', JSON.stringify(m[0]));
  ok('  and under Going on, game 2', /best of 5, game 2/.test(await text('#gamesBody [data-lkgame="' + g2 + '"]')));
  ok('  the pale gold row is the colour Barry asked for', await ev(() => getComputedStyle(document.querySelector('.gmmatch.gmnot')).backgroundColor) === 'rgb(255, 246, 214)'
    && await ev(() => getComputedStyle(document.querySelector('.gmmatch .gmdot')).backgroundColor) === 'rgb(224, 178, 27)');
  await p.click('[data-gmnext]'); await settle(500);
  ok('Back to the game opens it', await ev(() => LK_CUR) === g2 && !(await ev(() => $('lkPlay').classList.contains('hidden'))));
  await endGame(g2, { me: 0, sandra: 3 });
  await show(g2);
  ok('Sandra wins game 2: 1 each', await text('.lkover .gmline') === 'Best of 5, the first to 3 wins: You 1, Sandra 1.', await text('.lkover .gmline'));
  await games();
  m = await matches();
  ok('the match: Not finished, 1 each, two games, with Next game', m[0] && /^Not finished: You 1, Sandra 1 · .* · 2 games$/.test(m[0].s) && m[0].next === 'Next game', JSON.stringify(m));

  console.log('\nML411: Continue with unfinished game');
  await p.click('#lkNew'); await settle();
  await tickPlayers('lkWho', ['sandra']);
  await p.click('#lkwGo'); await p.waitForSelector('#gmPick', { timeout: 3000 }).catch(() => {});
  pk = await picker();
  ok('New game with Sandra offers Continue with unfinished game, at the top', pk && pk.heads.join() === 'Not finished yet,Or a new match'
    && pk.rows[0] === 'Continue with unfinished game' && pk.rows.slice(1).join() === 'Best of 3,Best of 5,Best of 7', JSON.stringify(pk));
  ok('  saying which match and how it stands', pk && pk.cont === 'Best of 5 with Sandra: You 1, Sandra 1', pk && pk.cont);
  await clear();
  await p.click('#gmCont'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  await p.click('[data-lkfirst="0"]'); await settle(600);
  const g3 = await newest();
  ok('  Continue puts the new game in that match', JSON.stringify((await row(g3)).match) === JSON.stringify({ of: 5, first: g1 }));
  await endGame(g3, { me: 3, sandra: 1 });
  await games();
  await p.click('[data-gmnext]'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  ok('Next game under Games goes straight to who rolls first too', await there('#lkFirst') && !(await there('#lkWho')));
  await p.click('[data-lkfirst="0"]'); await settle(600);
  const g4 = await newest();
  ok('  game 4 of the match', JSON.stringify((await row(g4)).match) === JSON.stringify({ of: 5, first: g1 }));

  console.log('\nML411: the end of the match');
  await endGame(g4, { me: 4, sandra: 2 });
  await show(g4);
  ok('the end box says who won the match, and the score in games', await text('.lkover .gmwin') === '🏆 You win the match! Best of 5, 3 games to 1.', await text('.lkover .gmwin'));
  ok('  then asks to play again, with Play again', await text('.lkover .gmline') === 'Play again?' && await there('#lkAgain') && !(await there('#lkNext')));
  ok('  above the game\'s own result, as before', await ev(() => { const w = document.querySelector('.lkover .gmwin'), h = document.querySelector('.lkover h3');
    return !!(w.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING) && /You won/.test(h.textContent); }));
  await show(g2);
  ok('an earlier game of it says which game it was', await text('.lkover .gmline') === 'Game 2 of a best of 5.' && await there('#lkAgain'), await text('.lkover .gmline'));
  await games();
  m = await matches();
  ok('under Games: won 3–1, four games, no dot, folded away, no Next game', m[0] && /^You won 3–1 · .* · 4 games$/.test(m[0].s)
    && !m[0].not && !m[0].dot && !m[0].open && m[0].next === null, JSON.stringify(m));
  await p.click('[data-gmmatch="' + g1 + '"]'); await settle(200);
  ok('  tapping it shows its four games, newest first', await ev(() => [...document.querySelectorAll('.gmgames [data-lkgame]')].map(x => Number(x.dataset.lkgame)).join())
    === [g4, g3, g2, g1].join());
  await show(g4); await clear();
  await p.click('#lkAgain'); await settle();
  ok('Play again: who is playing, ticked as before', await there('#lkWho') && /Play again/.test(await text('#lkWho')));
  await p.click('#lkwGo'); await p.waitForSelector('#gmPick', { timeout: 3000 }).catch(() => {});
  pk = await picker();
  ok('  then how many games, with nothing to carry on: that match is won', pk && pk.heads.join() === 'How many games?' && !pk.cont, JSON.stringify(pk));
  await p.click('#gmpCancel'); await settle(300);
  ok('  Cancel starts nothing', await newest() === g4 && !(await there('#gmPick')) && !(await rpcs('new_game')).length);

  console.log('\nML411: someone else winning, three players, and Pounds');
  const mk = (kind, players, of, first) => ev(([k, ps, of, f]) => {
    const r = window.__rpc(k === 'pounds' ? 'new_pounds' : 'new_game', { players: ps, first_seat: 0 });
    window.__rpc('set_match', { g: r.data, m: { of, first: f || r.data } }); return r.data; }, [kind, players, of, first]);
  const s1 = await mk('lockkeeper', ['me', 'sandra'], 3); await endGame(s1, { sandra: 2 });
  const s2 = await mk('lockkeeper', ['me', 'sandra'], 3, s1); await endGame(s2, { sandra: 2, me: 1 });
  await show(s2);
  ok('Sandra wins a best of 3: the end box says so', await text('.lkover .gmwin') === '🏆 Sandra wins the match! Best of 3, 2 games to 0.', await text('.lkover .gmwin'));
  await games();
  await p.click('#pdNew'); await settle();
  await tickPlayers('pdWho', ['sandra', 'other']); await clear();
  await p.click('#pdwGo'); await p.waitForSelector('#gmPick', { timeout: 3000 }).catch(() => {});
  ok('Pounds with others asks how many games too', (await picker() || {}).rows && (await picker()).rows.join() === 'Best of 3,Best of 5,Best of 7');
  await p.click('[data-gmof="3"]'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  await p.click('[data-lkfirst="0"]'); await settle(700);
  const p1 = await newest();
  ok('  and the game is noted as a best of 3', JSON.stringify((await row(p1)).match) === JSON.stringify({ of: 3, first: p1 }) && await ev(() => PD_CUR) === p1);
  await endGame(p1, { other: 50, me: 20, sandra: 10 });
  await show(p1);
  ok('the Pounds end box: how it stands with three of you, and Next game', await text('.pdover .gmline') === 'Best of 3, the first to 2 wins: Someone Else 1, You 0, Sandra 0.'
    && await there('#pdNext') && !(await there('#pdPlayAgain')), await text('.pdover .gmline'));
  await clear();
  await p.click('#pdNext'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  ok('  Next game: straight to who goes first', await there('#lkFirst') && !(await there('#pdWho')) && !(await there('#gmPick')));
  await p.click('[data-lkfirst="2"]'); await settle(700);
  const p2 = await newest();
  ok('  in the same match, three players, the phone\'s dice as before', JSON.stringify((await row(p2)).match) === JSON.stringify({ of: 3, first: p1 })
    && await ev(i => lkPlayers(i).length, p2) === 3 && !(await ev(i => pdReal(lkGame(i)), p2)) && await ev(() => PD_CUR) === p2);
  await endGame(p2, { other: 50, me: 20 });
  await show(p2);
  ok('Someone Else wins it: everyone\'s wins, with three of you', await text('.pdover .gmwin') === '🏆 Someone Else wins the match! Best of 3, Someone Else 2, You 0, Sandra 0.', await text('.pdover .gmwin'));
  await games();
  ok('Loxx and Pounds matches are kept apart', JSON.stringify(await ev(() => [...document.querySelectorAll('#gamesBody .dsec')].map(x => x.textContent.trim())))
    === JSON.stringify(['Finished: Loxx', 'Finished: Pounds']));
  await p.click('#pdNew'); await settle(); await clear();
  await p.click('#pdwGo'); await settle(500);
  ok('Pounds on your own: no match to choose', !(await there('#gmPick')) && await ev(() => PD_CUR) === await newest() && !(await rpcs('set_match')).length);
  await endGame(await newest(), { me: 100 });

  console.log('\nML411: games from before matches');
  const old = await ev(() => { const at = d => `2026-11-${String(d).padStart(2, '0')}T11:00:00Z`;
    const add = (id, d, sheets) => { window.__rows.games.push({ id, kind: 'lockkeeper', created_by: 'me', created_at: at(d), ended_at: at(d),
      status: 'ended', end_reason: 'Two rows closed', turn: 0, turn_no: 20, closed: {}, match: {} });
      Object.keys(sheets).forEach((u, i) => window.__rows.game_players.push({ game_id: id, user_id: u, seat: i, sheet: sheets[u], done_turn: 19 })); };
    add(51, 1, { me: { red: [2, 3] }, other: {} }); add(52, 2, { me: {}, other: { red: [2, 3] } }); return [51, 52]; });
  await games();
  m = (await matches()).filter(x => x.id === '51');
  ok('two older games with Someone Else are a best of 3, not finished: dot and Next game', m.length === 1 && m[0].t === 'Best of 3 with Someone Else'
    && /^Not finished: You 1, Someone Else 1 · 1 to 2 Nov · 2 games$/.test(m[0].s) && m[0].dot && m[0].next === 'Next game', JSON.stringify(m));
  await clear();
  await p.click('[data-gmnext="51"]'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  await p.click('[data-lkfirst="0"]'); await settle(600);
  const o3 = await newest();
  ok('  Next game carries it on', JSON.stringify((await row(o3)).match) === JSON.stringify({ of: 3, first: old[0] }));
  await endGame(o3, { me: 3 });
  await games();
  m = (await matches()).filter(x => x.id === '51');
  ok('  and winning it finishes that match: 2–1, three games', m[0] && /^You won 2–1 · .* · 3 games$/.test(m[0].s) && !m[0].dot, JSON.stringify(m));

  console.log('\nML411: before step 69 is run');
  // As a phone that has never seen step 69: once seen, the page keeps knowing it has been run.
  await ev(() => { window.__step69 = false; GM_69 = false; window.__rows.games.forEach(g => { delete g.match; }); });
  await games();
  await p.click('#lkNew'); await settle();
  await tickPlayers('lkWho', ['sandra']);
  await p.click('#lkwGo'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  ok('games without a match: New game goes straight to who rolls first, as before', await there('#lkFirst') && !(await there('#gmPick')));
  await p.click('#lkfCancel'); await settle(200);
  await ev(() => { window.__rows.games = []; window.__rows.game_players = []; });
  await games();
  await p.click('#lkNew'); await settle();
  await tickPlayers('lkWho', ['sandra']);
  await p.click('#lkwGo'); await p.waitForSelector('#lkFirst', { timeout: 3000 }).catch(() => {});
  ok('  and with no games yet, it asks the database, and still goes straight on', await there('#lkFirst') && !(await there('#gmPick')));
  await p.click('#lkfCancel'); await settle(200);
  await ev(() => { window.__step69 = true; });

  // ---------------------------------------------------------------
  console.log('\nML412: Loxx, the white dice first');
  const sheet = id => ev(i => { const s = lkSheet(lkMe(i).sheet); return { red: s.red, yellow: s.yellow }; }, id);
  const tap = (c, n) => ev(([c, n]) => lkTap(c, n), [c, n]);
  const r1 = await ev(() => window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }).data);
  await show(r1); await clearToasts();
  await tap('red', 5);
  let before = asked.length;
  await ev(() => { window.__lkNext = [false]; });
  await tap('red', 6); await settle(200);
  ok('real dice, my roll, red 5 then red 6: it asks whether the 5 was the white dice', asked.length === before + 1
    && asked[asked.length - 1] === 'Was the red 5 the white dice total? The white dice come first, then a white and a colour.', asked[asked.length - 1]);
  ok('  No: the 6 isn\'t marked, and it says why', JSON.stringify((await sheet(r1)).red) === '[5]'
    && /Then no more red on this roll: a white and a colour comes after the white dice/.test(await toasts()), await toasts());
  await ev(() => { window.__lkNext = [true]; });
  await tap('red', 6); await settle(200);
  ok('  Yes: the 6 is marked', JSON.stringify((await sheet(r1)).red) === '[5,6]');
  const r2 = await ev(() => window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }).data);
  await show(r2); before = asked.length;
  await tap('red', 5); await tap('yellow', 6); await settle(200);
  ok('two different rows: no question, both marked', asked.length === before && JSON.stringify(await sheet(r2)) === JSON.stringify({ red: [5], yellow: [6] }));
  const r3 = await ev(() => window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 1 }).data);
  await show(r3); before = asked.length; await clearToasts();
  await tap('red', 5); await tap('red', 6); await settle(200);
  ok('someone else\'s roll: one mark, as before, and no question', asked.length === before && JSON.stringify((await sheet(r3)).red) === '[5]'
    && /One mark is the most on someone else/.test(await toasts()));
  const r4 = await ev(() => window.__rpc('new_loxx', { players: ['me', 'sandra'], first_seat: 0, real_dice: false }).data);
  await show(r4);
  await ev(async () => { window.__dice = [2, 3, 4, 1, 1, 1]; window.pdRand = () => window.__dice.length ? window.__dice.shift() : 1; await lkRollDice(); });
  await settle(300); before = asked.length; await clearToasts();
  await tap('red', 6); await tap('red', 7); await settle(200);
  ok('the phone\'s dice, whites 2 and 3, red 4: red 6 (a white and red) then red 7 is refused, without asking', asked.length === before
    && JSON.stringify((await sheet(r4)).red) === '[6]' && /The white dice come first: the red 6 was a white and red, so no more red on this roll/.test(await toasts()), await toasts());
  await ev(() => lkUndo()); await settle(300);
  await tap('red', 5); await tap('red', 7); await settle(200);
  ok('  red 5 (the white dice) then red 7 (a white and red) is fine', asked.length === before && JSON.stringify((await sheet(r4)).red) === '[5,7]',
    JSON.stringify(await sheet(r4)));
  ok('the help says so', await help('The white dice come first, then the white and a colour')
    && await help('Continue with unfinished game</strong>') && await help('has a gold dot'));
  await games();

  // ---------------------------------------------------------------
  console.log('\nThe version');
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.25.2');
  ok('2026.11.25.2 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  three lines for What\'s new, each short enough', V && V.changes.length === 3 && V.changes.every(x => x.length < 160));

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
