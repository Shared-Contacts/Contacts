// MY Games: Pounds (ML250, step 60, 10 Nov 2026): a five-dice game for 1 to
// 6 players, on your own or a phone each. Up to three rolls a turn, 13 boxes,
// 35 more for 63 in the top six, and Barry's extra: once Five of a kind holds
// 50, every other five of a kind is 100 more and can go in any box. The
// phone rolls the dice, or real dice are typed in. lkfake.js stands in for
// step 60's functions here, with the same rules; window.__who plays Sandra.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|Server unwell|^\[object Object\]$|JSHandle@object/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  let answer = true; const asked = [];
  p.on('dialog', d => { asked.push('DIALOG ' + d.message()); return answer ? d.accept() : d.dismiss(); });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await answerLkAsks(p, m => { asked.push(m); return answer; });
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const rpcs = name => ev(n => window.__writes.filter(w => w.op === 'rpc' && w.name === n).map(w => w.args), name);
  const clear = () => ev(() => { window.__writes.length = 0; });
  const status = () => ev(() => $('pdStatus') ? $('pdStatus').textContent.replace(/\s+/g, ' ').trim() : '');
  const game = () => ev(() => JSON.parse(JSON.stringify(lkGame(PD_CUR))));
  const mine = () => ev(() => pdSheet(lkMe(PD_CUR).sheet));
  const shown = () => ev(() => [...document.querySelectorAll('#pdBody [data-pddie]')].map(d => d.getAttribute('aria-label')).join(' / '));
  // The next dice the phone rolls.
  const nextDice = list => ev(l => { window.__dice = l.slice(); window.pdRand = () => window.__dice.length ? window.__dice.shift() : 1; }, list);
  // Sandra does something on her phone; then this phone hears of it.
  const as = async (who, name, args) => { const r = await ev(([w, n, a]) => { window.__who = w; const r = window.__rpc(n, a); window.__who = null; return r; }, [who, name, args]);
    await ev(async () => { await pdReload(PD_CUR); pdPaint(); }); await settle(150); return r; };
  const box = k => ev(k => { const e = document.querySelector(`[data-pdbox="${k}"]`); return e ? { cls: e.className, v: e.querySelector('.pdv').textContent } : null; }, k);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); window.__lkFake(); });

  // ---------------------------------------------------------------
  console.log('\nThe scoring');
  ok('Ones to Sixes add up the dice showing that number', await ev(() =>
    pdPoints('u3', [3, 3, 1, 3, 6], { box: {} }) === 9 && pdPoints('u6', [6, 6, 6, 6, 1], { box: {} }) === 24 && pdPoints('u2', [1, 3, 4, 5, 6], { box: {} }) === 0));
  ok('Three and Four of a kind add up all five dice, with three or four the same', await ev(() =>
    pdPoints('k3', [4, 4, 4, 2, 1], { box: {} }) === 15 && pdPoints('k3', [4, 4, 2, 2, 1], { box: {} }) === 0
    && pdPoints('k4', [5, 5, 5, 5, 2], { box: {} }) === 22 && pdPoints('k4', [5, 5, 5, 2, 2], { box: {} }) === 0
    && pdPoints('k3', [6, 6, 6, 6, 6], { box: {} }) === 30));
  ok('Full house is 25 for three of one and two of another, and nothing else', await ev(() =>
    pdPoints('fh', [2, 2, 5, 5, 5], { box: {} }) === 25 && pdPoints('fh', [2, 2, 5, 5, 1], { box: {} }) === 0
    && pdPoints('fh', [3, 3, 3, 3, 3], { box: {} }) === 0));
  ok('Short run is 30 for four in a row, Long run 40 for five', await ev(() =>
    pdPoints('ss', [1, 2, 3, 4, 6], { box: {} }) === 30 && pdPoints('ss', [3, 4, 5, 6, 3], { box: {} }) === 30
    && pdPoints('ss', [1, 2, 3, 5, 6], { box: {} }) === 0 && pdPoints('ls', [2, 3, 4, 5, 6], { box: {} }) === 40
    && pdPoints('ls', [1, 2, 3, 4, 6], { box: {} }) === 0 && pdPoints('ss', [5, 4, 3, 2, 1], { box: {} }) === 30));
  ok('Five of a kind is 50, Chance adds up anything', await ev(() =>
    pdPoints('five', [2, 2, 2, 2, 2], { box: {} }) === 50 && pdPoints('five', [2, 2, 2, 2, 3], { box: {} }) === 0
    && pdPoints('ch', [1, 2, 3, 4, 6], { box: {} }) === 16));
  ok('with Five of a kind filled, another five of a kind can go anywhere, in full', await ev(() => {
    const s = { box: { five: 50 } }, z = { box: { five: 0 } }, v = [4, 4, 4, 4, 4];
    return pdPoints('fh', v, s) === 25 && pdPoints('ss', v, s) === 30 && pdPoints('ls', v, s) === 40
      && pdPoints('fh', v, z) === 25 && pdPoints('u4', v, s) === 20; }));
  ok('  and it is 100 more only when that box holds 50', await ev(() =>
    pdExtraDue([4, 4, 4, 4, 4], { box: { five: 50 } }) && !pdExtraDue([4, 4, 4, 4, 4], { box: { five: 0 } })
    && !pdExtraDue([4, 4, 4, 4, 4], { box: {} }) && !pdExtraDue([4, 4, 4, 4, 3], { box: { five: 50 } })));
  ok('the top six earn 35 more at 63, not at 62', await ev(() => {
    const at = n => pdTotals({ box: { u6: n, u5: 15, u4: 12, u3: 9, u2: 6, u1: 3 }, extra: 0 });
    return at(18).bonus === 35 && at(18).total === 63 + 35 && at(17).bonus === 0 && at(17).total === 62; }));
  ok('the total adds the top, the bonus, the rest and 100 for each extra five', await ev(() =>
    pdTotals({ box: { u6: 30, u5: 25, u4: 20, fh: 25, five: 50 }, extra: 2 }).total === 75 + 35 + 75 + 200));
  ok('a card tidies itself: only real boxes, whole numbers', await ev(() => {
    const s = pdSheet({ box: { u1: '3', fh: 25, bogus: 9, ss: null }, extra: '2' });
    return JSON.stringify(s) === JSON.stringify({ box: { u1: 3, fh: 25 }, extra: 2 }); }));
  ok('the phone’s dice are fair: 1 to 6, each about a sixth of the time', await ev(() => {
    const c = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 6000; i++) c[pdRand()]++;
    return c[0] === 0 && c.slice(1).every(n => n > 850 && n < 1150); }));

  // ---------------------------------------------------------------
  console.log('\nIn MY Games, the menu and Help');
  await ev(() => openGames()); await settle(500);
  ok('MY Games has a Pounds card with New game and How to play', await ev(() =>
    /Pounds/.test($('gamesBody').textContent) && !!$('pdNew') && !!$('pdHow')));
  ok('  Loxx’s card is still there, first', await ev(() => !!$('lkNew') && $('gamesBody').textContent.indexOf('Loxx') < $('gamesBody').textContent.indexOf('Pounds')));
  ok('the Games menu has New game of Pounds, beside Loxx’s', await ev(() =>
    areaItems('games').map(x => x.label).join('|') === 'New game of Loxx|New game of Pounds'));
  await p.click('#pdHow'); await settle(400);
  ok('How to play opens Help at the Pounds rules, in a box of their own', await ev(() => {
    const h = document.getElementById('h-pounds'); if (!h) return false;
    const t = h.parentElement.textContent;
    return HELP_AT.pounds === 'h-pounds' && h.parentElement.classList.contains('helpbox')
      && /bonus of 35/.test(t) && /100 more/.test(t) && /Real dice/.test(t) && !$('help').classList.contains('hidden'); }));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nA game on your own');
  await clear();
  await p.click('#pdNew'); await settle(300);
  ok('New game asks who is playing, with Real dice to tick', await ev(() =>
    !!$('pdWho') && /nobody for a game on your own/.test($('pdWho').textContent) && !!$('pdwReal') && !$('pdwReal').checked));
  await p.click('#pdwGo'); await settle(600);
  const solo = await rpcs('new_pounds');
  ok('  nobody ticked starts a game on your own, with no question about who goes first', solo.length === 1
    && JSON.stringify(solo[0]) === JSON.stringify({ players: ['me'], first_seat: 0, real_dice: false }) && !(await p.$('#lkFirst')));
  ok('  and it opens', await ev(() => !$('pdPlay').classList.contains('hidden') && PD_CUR != null && SHEET_STACK[SHEET_STACK.length - 1] === 'pdPlay'));
  ok('  the bottom strip steps out of the way', await ev(() => $('tray').style.display === 'none'));
  ok('  it says to roll, round 1 of 13, with no names at the top on your own', /^Roll the dice\. Round 1 of 13$/.test(await status())
    && await ev(() => !document.querySelector('.pdwho')));
  ok('  five blank dice and a Roll button, three rolls left', await ev(() =>
    document.querySelectorAll('.pddie.blank').length === 5 && /Roll the dice/.test($('pdRoll').textContent)
    && /3 rolls left/.test(document.querySelector('.pdleft').textContent)));
  await clearToasts();
  await p.click('[data-pdbox="ch"]'); await settle(200);
  ok('a box before rolling says to roll first', /Roll the dice first/.test(await toasts()) && !(await p.$('#pdGo')));
  await p.click('[data-pddie="0"]'); await settle(200);
  ok('  and so does a die', /Roll the dice first/.test(await toasts()));

  await nextDice([6, 6, 2, 1, 6]); await clear();
  await p.click('#pdRoll'); await settle(300);
  ok('Roll rolls all five', await shown() === 'Die 1: 6 / Die 2: 6 / Die 3: 2 / Die 4: 1 / Die 5: 6');
  const d1 = await rpcs('pounds_dice');
  ok('  and the dice go to the game for everyone to see', d1.length === 1 && JSON.stringify(d1[0].d) ===
    JSON.stringify({ v: [6, 6, 2, 1, 6], held: [false, false, false, false, false], rolls: 1 }) && d1[0].at_turn === 1);
  ok('  the card shows what each box would score, in green', JSON.stringify(await box('u6')) === JSON.stringify({ cls: 'pdbox pot', v: '18' })
    && (await box('k3')).v === '21' && (await box('fh')).cls === 'pdbox pot zero' && (await box('fh')).v === '0');
  ok('  roll 1 of 3', /^Roll 1 of 3\. Tap any dice to keep them/.test(await status()) && /Roll again/.test(await ev(() => $('pdRoll').textContent)));
  await clear();
  await p.click('[data-pddie="0"]'); await p.click('[data-pddie="1"]'); await p.click('[data-pddie="4"]'); await settle(600);
  ok('tapping dice keeps them: they lift and say Kept', await ev(() =>
    [...document.querySelectorAll('.pddie')].map(d => d.classList.contains('held') ? 1 : 0).join('') === '11001'));
  const d2 = await rpcs('pounds_dice');
  ok('  and the others see which are kept, in one save', d2.length >= 1 && JSON.stringify(d2[d2.length - 1].d.held) === '[true,true,false,false,true]');
  await nextDice([6, 3]);
  await p.click('#pdRoll'); await settle(300);
  ok('Roll again rolls only the others', await shown() === 'Die 1: 6, kept / Die 2: 6, kept / Die 3: 6 / Die 4: 3 / Die 5: 6, kept');
  await p.click('[data-pddie="1"]'); await settle(100);
  ok('  a kept die tapped again is rolled after all', await ev(() => !document.querySelectorAll('.pddie')[1].classList.contains('held')));
  await p.click('[data-pddie="1"]'); await p.click('[data-pddie="2"]'); await settle(100);
  await nextDice([6]);
  await p.click('#pdRoll'); await settle(300);
  ok('the third roll is the last: five sixes', await shown() === 'Die 1: 6, kept / Die 2: 6, kept / Die 3: 6, kept / Die 4: 6 / Die 5: 6, kept'
    && await ev(() => $('pdRoll').disabled && /No rolls left/.test($('pdRoll').textContent)));
  ok('  it says to choose a box', /That was your last roll: tap a box to score/.test(await status()));
  await clearToasts(); await p.click('[data-pddie="0"]'); await settle(150);
  ok('  and the dice can’t be kept any more', /last roll/.test(await toasts()));
  await ev(() => pdRoll()); await settle(150);
  ok('  nor rolled a fourth time', /Three rolls is the most/.test(await toasts()));
  await p.click('[data-pdbox="five"]'); await settle(200);
  ok('tapping a box picks it, and the button says what it puts where', await ev(() =>
    document.querySelector('[data-pdbox="five"]').classList.contains('pick') && $('pdGo').textContent.trim() === 'Put 50 in Five of a kind'));
  await p.click('[data-pdbox="five"]'); await settle(150);
  ok('  tapping it again unpicks it', !(await p.$('#pdGo')));
  await p.click('[data-pdbox="five"]'); await settle(150);
  await clear();
  await p.click('#pdGo'); await settle(400);
  const sc1 = await rpcs('pounds_score');
  ok('Put scores it: one box, sent with the turn it was for', sc1.length === 1 && sc1[0].at_turn === 1
    && JSON.stringify(sc1[0].s) === JSON.stringify({ box: { five: 50 }, extra: 0 }));
  ok('  on your own the next turn is yours: round 2, the dice clear', /^Roll the dice\. Round 2 of 13$/.test(await status())
    && await ev(() => document.querySelectorAll('.pddie.blank').length === 5 && !document.querySelector('.pddie.held')));
  ok('  the card has its 50 and the total says so', JSON.stringify(await box('five')) === JSON.stringify({ cls: 'pdbox done', v: '50' })
    && await ev(() => /Your total\s*50/.test(document.querySelector('.pdtotal').textContent)));
  await clearToasts(); await p.click('[data-pdbox="five"]'); await settle(150);
  ok('  a filled box says what it holds', /Five of a kind is filled: 50/.test(await toasts()));

  // Barry's extra five
  await nextDice([3, 3, 3, 3, 3]);
  await p.click('#pdRoll'); await settle(300);
  ok('another five of a kind: Full house and the runs show in full', (await box('fh')).v === '25' && (await box('ss')).v === '30'
    && (await box('ls')).v === '40' && (await box('u3')).v === '15');
  ok('  and Extra fives shows +100 to come', await ev(() => /Extra fives\s*\+100/.test(document.querySelectorAll('.pdcol')[1].textContent)));
  await p.click('[data-pdbox="ls"]'); await settle(150);
  ok('  the button says so too', await ev(() => $('pdGo').textContent.trim() === 'Put 40 in Long run, and 100 more'));
  await clearToasts(); await clear();
  await p.click('#pdGo'); await settle(400);
  ok('  it scores 40 and 100 more', JSON.stringify((await rpcs('pounds_score'))[0].s) === JSON.stringify({ box: { five: 50, ls: 40 }, extra: 1 })
    && /Another five of a kind: 100 more/.test(await toasts()));
  ok('  the total is 190', await ev(() => pdTotals(pdSheet(lkMe(PD_CUR).sheet)).total === 190
    && /Extra fives ×1\s*100/.test(document.querySelectorAll('.pdcol')[1].textContent)));

  // To the end: eleven boxes are filled as if played, then the last two.
  const SOLO = (await game()).id;
  await ev(id => { const me = window.__rows.game_players.find(x => x.game_id === id && x.user_id === 'me');
    me.sheet = { box: { five: 50, ls: 40, u1: 3, u2: 6, u3: 9, u4: 12, u5: 15, u6: 18, k3: 20, k4: 0, fh: 25 }, extra: 1 };
    window.__rows.games.find(g => g.id === id).turn_no = 12; }, SOLO);
  await ev(async () => { await pdReload(PD_CUR); pdPaint(); }); await settle(150);
  ok('the top six at 63 earn the 35', await ev(() => /Top six\s*63/.test(document.querySelector('.pdcol').textContent)
    && /Bonus\s*35/.test(document.querySelector('.pdcol').textContent)));
  ok('  round 12 of 13', /Round 12 of 13/.test(await status()));
  await nextDice([1, 2, 3, 4, 6]);
  await p.click('#pdRoll'); await settle(300);
  await p.click('[data-pdbox="ss"]'); await p.click('#pdGo'); await settle(400);
  await nextDice([2, 2, 2, 5, 5]);
  await p.click('#pdRoll'); await settle(300);
  await p.click('[data-pdbox="ch"]'); await clearToasts(); await p.click('#pdGo'); await settle(500);
  const total = 63 + 35 + 50 + 40 + 20 + 0 + 25 + 30 + 16 + 100;
  ok('the thirteenth box ends it: every box filled', (await game()).status === 'ended' && (await game()).end_reason === 'Every box filled'
    && /That is the end of the game/.test(await toasts()));
  ok('  it shows your score, with no dice and no Stop game', await ev(t => {
    const o = document.querySelector('.pdover'); return !!o && o.querySelector('h3').textContent === 'You scored ' + t
      && /Your first full game on your own/.test(o.textContent) && !document.querySelector('.pdtable') && !$('pdStop'); }, total));
  ok('  with Play again, Back to games and Clear it away', await ev(() => !!$('pdPlayAgain') && !!$('pdOverBack') && !!$('pdClear')));
  ok('  your best on your own is that game, next time', await ev(t => pdBestSolo(-1) === t, total));
  await p.click('#pdOverBack'); await settle(500);
  ok('Back to games: the list has it under Finished', await ev(id => {
    const r = document.querySelector(`[data-lkgame="${id}"]`);
    return $('pdPlay').classList.contains('hidden') && !!r && /Pounds on your own/.test(r.textContent)
      && /You scored/.test(r.textContent); }, SOLO));

  // ---------------------------------------------------------------
  console.log('\nWith Sandra, on two phones');
  await clear();
  await p.click('#pdNew'); await settle(300);
  await p.click('#pdWho input[value="sandra"]'); await p.click('#pdwGo'); await settle(300);
  ok('ticking Sandra asks who goes first', await ev(() => !!$('lkFirst') && /Who goes first\?/.test($('lkFirst').textContent)
    && /The dice then go round in this order/.test($('lkFirst').textContent) && !/first to roll a 6/.test($('lkFirst').textContent)));
  await p.click('[data-lkfirst="1"]'); await settle(600);
  const two = await rpcs('new_pounds');
  ok('  Sandra first', two.length === 1 && JSON.stringify(two[0]) === JSON.stringify({ players: ['me', 'sandra'], first_seat: 1, real_dice: false }));
  const G2 = (await game()).id;
  ok('  her turn: she is waiting to roll, and her card is the one shown', /^Sandra’s turn\. Waiting for them to roll\. Round 1 of 13$/.test(await status())
    && await ev(() => /Sandra’s card/.test(document.querySelector('.pdcardhd').textContent)
      && document.querySelector('.pdwho .roll').textContent.includes('Sandra')));
  ok('  no Roll button, just her dice', await ev(() => !$('pdRoll') && /Sandra’s dice, not rolled yet/.test(document.querySelector('.pdwatch').textContent)));
  ok('  the Games tile has nothing for you yet', await ev(() => lkWaitingCount() === 0));
  await as('sandra', 'pounds_dice', { g: G2, at_turn: 1, d: { v: [5, 5, 5, 2, 2], held: [false, false, false, false, false], rolls: 1 } });
  ok('her roll shows here as she rolls it', await shown() === 'Die 1: 5 / Die 2: 5 / Die 3: 5 / Die 4: 2 / Die 5: 2'
    && /^Sandra’s turn: roll 1 of 3\./.test(await status()));
  ok('  with what each box would score on her card', (await box('fh')).v === '25' && (await box('k3')).v === '19');
  await as('sandra', 'pounds_dice', { g: G2, at_turn: 1, d: { v: [5, 5, 5, 2, 2], held: [true, true, true, false, false], rolls: 1 } });
  ok('  and the dice she keeps', await shown() === 'Die 1: 5, kept / Die 2: 5, kept / Die 3: 5, kept / Die 4: 2 / Die 5: 2');
  await clearToasts(); await p.click('[data-pddie="3"]'); await settle(150);
  ok('  her dice are hers: tapping one here does nothing but say so', /These are Sandra’s dice/.test(await toasts())
    && !(await rpcs('pounds_dice')).length);
  await p.click('.pdwho .me'); await settle(150);
  ok('tapping your name shows your card, without the green', await ev(() => /Your card/.test(document.querySelector('.pdcardhd').textContent)
    && !document.querySelector('.pdbox.pot')));
  await clearToasts(); await p.click('[data-pdbox="fh"]'); await settle(150);
  ok('  a box on it says to wait for your turn', /Wait for your turn/.test(await toasts()) && !(await p.$('#pdGo')));
  await ev(() => { window.__who = 'sandra'; });
  const sp = await ev(g => window.__rpc('pounds_score', { g, at_turn: 1, s: { box: { fh: 25 }, extra: 0 } }), G2);
  await ev(() => { window.__who = null; });
  await clearToasts();
  await ev(async () => { await pdReload(PD_CUR); pdPaint(); }); await settle(200);
  ok('when she scores, it says it is your turn', sp.data === 'next' && /Your turn/.test(await toasts())
    && /^Your turn\. Roll the dice\. Round 1 of 13$/.test(await status()));
  ok('  your card comes back, with her 25 by her name', await ev(() => /Your card/.test(document.querySelector('.pdcardhd').textContent)
    && /Sandra\s*25/.test(document.querySelector('.pdwho').textContent)));
  ok('  the Games tile shows 1', await ev(() => lkWaitingCount() === 1 && tilePip('games') === 1));
  await nextDice([1, 1, 4, 4, 4]);
  await p.click('#pdRoll'); await settle(300);
  await p.click('.pdwho button:not(.me)'); await settle(150);
  ok('her card, while it is your turn, has no green and can’t be scored on', await ev(() =>
    /Sandra’s card/.test(document.querySelector('.pdcardhd').textContent) && !document.querySelector('.pdbox.pot')));
  await clearToasts(); await p.click('[data-pdbox="fh"]'); await settle(150);
  ok('  her boxes say what she has', /Sandra has 25 in Full house/.test(await toasts()));
  await p.click('.pdwho .me'); await settle(150);
  await p.click('[data-pdbox="fh"]'); await p.click('#pdGo'); await settle(400);
  ok('your score passes the dice back to her', /^Sandra’s turn\./.test(await status()) && (await game()).turn === 1 && (await game()).turn_no === 3
    && await ev(() => lkWaitingCount() === 0));
  await ev(() => { $('pdBack').click(); }); await settle(500);
  ok('Back goes to the list: Pounds with Sandra, her turn, round 2', await ev(id => {
    const r = document.querySelector(`[data-lkgame="${id}"]`);
    return $('pdPlay').classList.contains('hidden') && !$('games').classList.contains('hidden') && !!r
      && /Pounds with Sandra/.test(r.textContent) && /Sandra’s turn · round 2 of 13/.test(r.textContent)
      && /25/.test(r.querySelector('.lkpts').textContent); }, G2));
  ok('  and the tray is back', await ev(() => $('tray').style.display === ''));

  // Starting it twice
  await clear();
  await p.click('#pdNew'); await settle(300);
  await p.click('#pdWho input[value="sandra"]'); await p.click('#pdwGo'); await settle(500);
  ok('a second game with Sandra asks first: you already have a game of Pounds going', await ev(() =>
    !!$('lkAlready') && /a game of Pounds going with Sandra/.test($('lkAlready').textContent)));
  await p.click('#lkaOpen'); await settle(500);
  ok('  Open that game opens it, and starts nothing', await ev(id => PD_CUR === id, G2) && !(await rpcs('new_pounds')).length);
  await ev(() => pdBackToList()); await settle(400);

  // Loxx is untouched
  await ev(() => { window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }); }); await ev(async () => { await lkReload(); renderGames(); }); await settle(300);
  const LX = await ev(() => GAMES.find(g => g.kind === 'lockkeeper' && g.status === 'playing').id);
  ok('a Loxx game is told apart from a Pounds one: Loxx with Sandra', await ev(id =>
    /Loxx with Sandra/.test(document.querySelector(`[data-lkgame="${id}"]`).textContent), LX));
  ok('  Loxx’s “already playing” is about Loxx games only, and Pounds’s about Pounds', await ev(([lx, pd]) =>
    lkSameGame(['me', 'sandra']).id === lx && lkSameGame(['me', 'sandra'], 'pounds').id === pd
    && lkSameGame(['me'], 'pounds') === null, [LX, G2]));
  ok('  the tile counts the Loxx game (a mark to make), not the Pounds one (Sandra’s turn)', await ev(() => lkWaitingCount() === 1));
  await p.click(`[data-lkgame="${LX}"]`); await settle(500);
  ok('  tapping it opens Loxx’s sheet, not Pounds', await ev(() => !$('lkPlay').classList.contains('hidden') && $('pdPlay').classList.contains('hidden')));
  await ev(() => lkBackToList()); await settle(400);
  await p.click(`[data-lkgame="${G2}"]`); await settle(500);
  ok('  and the Pounds one opens Pounds', await ev(() => $('lkPlay').classList.contains('hidden') && !$('pdPlay').classList.contains('hidden')));
  ok('  Loxx’s first-roller question is as it was', await ev(() => { lkPickFirst(['me', 'sandra']);
    const t = $('lkFirst').textContent; $('lkFirst').remove(); return /Who rolls first\?/.test(t) && /first to\s+roll a 6/.test(t.replace(/\s+/g, ' ')); }));

  // Stopping
  answer = false;
  await p.click('#pdStop'); await settle(300);
  ok('Stop game asks first, on the game’s own screen', /Stop this game for everyone\? The scores so far are kept\./.test(asked[asked.length - 1])
    && (await game()).status === 'playing');
  answer = true;
  await p.click('#pdStop'); await settle(400);
  ok('  yes stops it, and the scores stay', (await game()).status === 'ended' && (await game()).end_reason === 'Stopped'
    && await ev(() => /You won, 25 to 25|A draw on 25/.test(document.querySelector('.pdover h3').textContent)
      && /The game was stopped/.test(document.querySelector('.pdover').textContent)));
  ok('  the results list both of you', await ev(() => document.querySelectorAll('.pdover .lkres li').length === 2));
  await clear();
  await p.click('#pdClear'); await settle(500);
  ok('Clear it away asks, then clears it for both', /Clear this game away, for everyone who played it\?/.test(asked[asked.length - 1])
    && (await rpcs('delete_game')).length === 1 && await ev(id => !GAMES.some(g => g.id === id) && $('pdPlay').classList.contains('hidden'), G2));

  // ---------------------------------------------------------------
  console.log('\nReal dice, typed in');
  await clear();
  await p.click('#pdNew'); await settle(300);
  await p.click('#pdwReal'); await p.click('#pdwGo'); await settle(600);
  ok('Real dice ticked: the game is started with real dice', (await rpcs('new_pounds'))[0].real_dice === true
    && await ev(() => pdReal(lkGame(PD_CUR))));
  ok('  no Roll button: a row of 1 to 6 and ⌫ instead', await ev(() => !$('pdRoll') && document.querySelectorAll('[data-pdn]').length === 7)
    && /Roll the five dice on the table, then tap the numbers they show/.test(await status()));
  const R = (await game()).id;
  const type = async list => { for (const n of list) await p.click(`[data-pdn="${n}"]`); await settle(150); };
  await type([4, 4]);
  ok('the numbers fill the dice, left to right', await shown() === 'Die 1: 4 / Die 2: 4 / Die 3: not rolled / Die 4: not rolled / Die 5: not rolled'
    && /Roll 1 of 3: tap what the dice show \(2 of 5 in\)/.test(await status()));
  ok('  Roll again waits until all five are in', await ev(() => $('pdAgain').disabled));
  await type([1, 0]);
  ok('⌫ takes the last one back', await shown() === 'Die 1: 4 / Die 2: 4 / Die 3: not rolled / Die 4: not rolled / Die 5: not rolled');
  await type([4, 2, 6]);
  ok('  all five in: the card shows the scores, and the numbers grey out', await shown() === 'Die 1: 4 / Die 2: 4 / Die 3: 4 / Die 4: 2 / Die 5: 6'
    && (await box('k3')).v === '20' && await ev(() => document.querySelector('[data-pdn="3"]').disabled && !$('pdAgain').disabled));
  await settle(400);
  const rd = await rpcs('pounds_dice');
  ok('  the others see them typed in', rd.length >= 1 && JSON.stringify(rd[rd.length - 1].d.v) === '[4,4,4,2,6]' && rd[rd.length - 1].d.rolls === 1);
  await p.click('[data-pddie="0"]'); await p.click('[data-pddie="1"]'); await p.click('[data-pddie="2"]'); await settle(150);
  await p.click('#pdAgain'); await settle(200);
  ok('keep three, Roll again: the other two are empty, ready to type', await shown() === 'Die 1: 4, kept / Die 2: 4, kept / Die 3: 4, kept / Die 4: not rolled / Die 5: not rolled'
    && /Roll 2 of 3/.test(await status()));
  ok('  ⌫ leaves the kept ones alone: with none typed since, it is greyed', await ev(() => document.querySelector('[data-pdn="0"]').disabled));
  await type([4, 4]);
  ok('  five fours', (await box('five')).v === '50');
  await p.click('[data-pdbox="five"]'); await p.click('#pdGo'); await settle(400);
  ok('it scores like the phone’s dice, and the next turn starts empty', JSON.stringify(await mine()) === JSON.stringify({ box: { five: 50 }, extra: 0 })
    && await ev(() => document.querySelectorAll('.pddie.blank').length === 5) && /Round 2 of 13/.test(await status()));
  await ev(id => { window.__rows.games.find(g => g.id === id).status = 'ended'; window.__rows.games.find(g => g.id === id).end_reason = 'Stopped'; }, R);
  await ev(async () => { await pdReload(PD_CUR); pdPaint(); }); await settle(150);
  await clear();
  await p.click('#pdPlayAgain'); await settle(600);
  ok('Play again starts another the same way: on your own, real dice, no questions', await ev(() => !$('pdWho'))
    && JSON.stringify((await rpcs('new_pounds'))[0]) === JSON.stringify({ players: ['me'], first_seat: 0, real_dice: true })
    && await ev(r => PD_CUR !== r && pdReal(lkGame(PD_CUR)), R));
  await ev(() => pdBackToList()); await settle(300);

  // ---------------------------------------------------------------
  console.log('\nThe dice tumble, here and on the others’ phones');
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await ev(() => { window.__rpc('new_pounds', { players: ['me', 'sandra'], first_seat: 1 }); });
  await ev(async () => { await lkReload(); });
  const T = await ev(() => GAMES.filter(g => g.kind === 'pounds' && g.status === 'playing' && lkPlayers(g.id).length === 2)[0].id);
  await ev(id => pdOpen(id), T); await settle(400);
  await as('sandra', 'pounds_dice', { g: T, at_turn: 1, d: { v: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 1 } });
  ok('Sandra’s roll tumbles here', await ev(() => document.querySelectorAll('.pddie.tumble').length === 5));
  await settle(700);
  ok('  and lands on what she rolled, with the green', await shown() === 'Die 1: 1 / Die 2: 2 / Die 3: 3 / Die 4: 4 / Die 5: 5'
    && await ev(() => !document.querySelector('.pddie.tumble')) && (await box('ls')).v === '40');
  await as('sandra', 'pounds_dice', { g: T, at_turn: 1, d: { v: [1, 2, 3, 4, 5], held: [true, true, false, false, false], rolls: 1 } });
  ok('  keeping dice is not a roll: nothing tumbles', await ev(() => !document.querySelector('.pddie.tumble')));
  await as('sandra', 'pounds_dice', { g: T, at_turn: 1, d: { v: [1, 2, 6, 6, 6], held: [true, true, false, false, false], rolls: 2 } });
  ok('  her second roll tumbles only the three she rolled', await ev(() =>
    [...document.querySelectorAll('.pddie')].map(d => d.classList.contains('tumble') ? 1 : 0).join('') === '00111'));
  await settle(700);
  await ev(() => pdBackToList()); await settle(300);
  await p.emulateMedia({ reducedMotion: 'reduce' });

  // ---------------------------------------------------------------
  console.log('\nOn a small phone, and with six players');
  await p.setViewportSize({ width: 360, height: 740 });
  await ev(() => { const more = [{ id: 'p4', display_name: 'Margaret' }, { id: 'p5', display_name: 'Christopher' }, { id: 'p6', display_name: 'Jo' }];
    window.__rows.profiles.push(...more); USERS.push(...more.map(x => ({ ...x }))); });
  await ev(() => { window.__rpc('new_pounds', { players: ['me', 'sandra', 'other', 'p4', 'p5', 'p6'], first_seat: 0 }); });
  await ev(async () => { await lkReload(); });
  const SIX = await ev(() => GAMES.find(g => g.kind === 'pounds' && lkPlayers(g.id).length === 6).id);
  await ev(id => pdOpen(id), SIX); await settle(400);
  await nextDice([2, 3, 4, 5, 6]); await p.click('#pdRoll'); await settle(300);
  await p.click('[data-pdbox="k3"]'); await settle(200);
  ok('six names fit across the top, wrapping', await ev(() => document.querySelectorAll('.pdwho button').length === 6
    && [...document.querySelectorAll('.pdwho button')].every(x => x.getBoundingClientRect().right <= innerWidth)));
  ok('nothing runs off the side of a 360-wide phone', await ev(() => $('pdBody').scrollWidth <= $('pdBody').clientWidth
    && [...document.querySelectorAll('.pddie,.pdbox,.pdroll,#pdGo')].every(x => x.getBoundingClientRect().right <= innerWidth + 0.5)));
  ok('  the box names are whole, not cut short', await ev(() => [...document.querySelectorAll('.pdlab')].every(x => x.scrollWidth <= x.clientWidth)));
  ok('  six names, each by name', await ev(() => /Margaret/.test(document.querySelector('.pdwho').textContent)
    && /Christopher/.test(document.querySelector('.pdwho').textContent)));
  ok('  the card scrolls a little there, but Put stays in sight at the bottom', await ev(() =>
    $('pdGo').getBoundingClientRect().bottom <= innerHeight && $('pdGo').getBoundingClientRect().top > innerHeight / 2));
  await p.screenshot({ path: path.join(__dirname, 'pounds.png') });
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);
  ok('on a usual phone the dice, Roll and the whole card fit without scrolling, Put too', await ev(() =>
    document.querySelector('.pdtotal').getBoundingClientRect().bottom <= $('pdGo').getBoundingClientRect().top + 30
    && $('pdGo').getBoundingClientRect().bottom <= innerHeight && $('pdBody').scrollTop === 0));
  await ev(() => pdBackToList()); await settle(300);

  // ---------------------------------------------------------------
  console.log('\nWithout step 60');
  await ev(() => { const f = window.__rpc; window.__rpc = (n, a) => /pounds/.test(n) ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + n } } : f(n, a); });
  await clearToasts();
  await p.click('#pdNew'); await settle(300); await p.click('#pdwGo'); await settle(500);
  if (await p.$('#lkAlready')) { await p.click('#lkaNew'); await settle(500); }
  ok('New game says step 60 is needed, and nothing opens', /Pounds needs step 60 run in Supabase first/.test(await toasts())
    && await ev(() => $('pdPlay').classList.contains('hidden')));

  ok('no errors on the page', !errors.length, errors.slice(0, 5).join(' || '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
