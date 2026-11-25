// 24 Nov 2026 (version 2026.11.24.1), Barry's four requests that day:
//   ML396  A Done button on a regular job's own screen (Not done yet when it
//          is done), doing what the tick on the list does, saving any changes.
//   ML397  A podcast's page shows its picture, the same as its tile.
//   ML398  Pounds: whoever just filled a box, their card stays on the others'
//          screens with that box lit up, and a line says what went where,
//          until the next player rolls. (twopounds.test.js checks the same
//          on two phones against the real step 60 SQL.)
//   ML399  Finished games: Loxx and Pounds apart, grouped into matches (best
//          of 3 or first to 5), worked out from the games played; a match
//          still going on is open, a finished one opens with a tap.
//          (25 Nov 2026, ML411: matches are now chosen when they start, best
//          of 3, 5 or 7, and First to 5 has gone. Games from before then,
//          like these, are still grouped as best of 3: see batch1125.)
// lkfake.js stands in for the games' functions; window.__who plays the others.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|Server unwell|^\[object Object\]$/i;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const FEED = `<?xml version="1.0"?><rss><channel><title>Pretend Pod</title>
  <item><title>One</title><guid>p-1</guid><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item>
  <item><title>Two</title><guid>p-2</guid><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.emulateMedia({ reducedMotion: 'reduce' });
  const cors = { 'access-control-allow-origin': '*' };
  await p.route(/gov\.uk|bsky\.app|bsky\.social|open\.spotify\.com\/oembed|apple\.com/, r => r.abort());
  await p.route(/pics\.example\/good/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await p.route(/pics\.example\/broken/, r => r.fulfill({ status: 404, body: '' }));
  await p.route(/feeds\.example\/pod\.rss/, r => r.fulfill({ status: 200, contentType: 'application/rss+xml', headers: cors, body: FEED }));
  await p.route(/feeds\.example\/gone\.rss/, r => r.fulfill({ status: 404, headers: cors, body: '' }));
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await answerLkAsks(p, () => true);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const last = (op, table) => ev(([o, t]) => window.__writes.filter(w => w.op === o && w.table === t).pop() || null, [op, table]);
  const help = re => ev(r => new RegExp(r).test(document.documentElement.innerHTML), re);
  const visible = id => ev(i => !document.getElementById(i).classList.contains('hidden'), id);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); window.__lkFake(); });

  // ---------------------------------------------------------------
  console.log('\nML396: Done on a regular job\'s own screen');
  await ev(async () => {
    window.__rows.routines = [
      { id: 1, created_by: 'me', title: 'Haircut', heading: 'ASAP', done: false, sort_order: 1, photos: [] },
      { id: 2, created_by: 'me', title: 'Oil change', heading: 'Boat', done: true, done_at: '2026-11-20T10:00:00Z', sort_order: 2, photos: [] },
      { id: 3, created_by: 'me', title: 'Paint the roof', heading: 'Boat', done: false, sort_order: 3, photos: [] }];
    await loadAll(); DIARY_VIEW = 'routine'; openDiary();
  });
  await settle();
  await p.click('[data-rtedit="1"]'); await settle();
  ok('a job still to do opens with a Done button', await visible('rtEd')
    && await ev(() => $('rtDone') && $('rtDone').textContent.trim() === 'Done'));
  ok('  above Remove from the list, which is still there', await ev(() => {
    const d = $('rtDone'), r = $('rtDelete'); return !!r && d.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING; }));
  ok('  and the screen no longer says to tick it on the list', await ev(() => !/Tick it on the list/.test($('rtBody').textContent)
    && /Still to do\./.test($('rtBody').textContent)));
  await p.fill('#rtForm input[name="title"]', 'Haircut - Ellesmere');
  await clear(); await clearToasts();
  await p.click('#rtDone'); await settle(500);
  let w = await last('update', 'routines');
  ok('Done ticks it, with the date, and saves the new wording in the same go', w && w.patch.done === true && !!w.patch.done_at
    && w.patch.title === 'Haircut - Ellesmere' && w.patch.heading === 'ASAP', JSON.stringify(w && w.patch));
  ok('  only that one changed', (await ev(() => window.__writes.filter(x => x.op === 'update' && x.table === 'routines').length)) === 1);
  ok('  the screen closes, back on the list, saying Done', !(await visible('rtEd')) && await visible('diary') && /Done/.test(await toasts()));
  ok('  and the list is drawn again', await ev(() => !!document.querySelector('#diaryBody [data-rtedit="3"]')));
  await ev(() => document.querySelectorAll('#diaryBody details.rtdone').forEach(d => { d.open = true; }));
  await p.click('[data-rtedit="2"]'); await settle();
  ok('a job already done opens with Not done yet, and says when it was done', await ev(() =>
    $('rtDone').textContent.trim() === 'Not done yet' && /Done 20 Nov 2026/.test($('rtBody').textContent)));
  await clear(); await clearToasts();
  await p.click('#rtDone'); await settle(500);
  w = await last('update', 'routines');
  ok('Not done yet unticks it and puts it back at the top, as unticking on the list does', w && w.patch.done === false
    && w.patch.done_at === null && w.patch.sort_order < Math.min(1, 3), JSON.stringify(w && w.patch));
  ok('  and says so', /Not done yet/.test(await toasts()));
  await p.click('[data-rtedit="3"]'); await settle();
  await clear(); await clearToasts();
  await p.click('#rtSave'); await settle(500);
  w = await last('update', 'routines');
  ok('Save still only saves: no tick or untick sent', w && !('done' in w.patch) && !('done_at' in w.patch) && /Saved/.test(await toasts()),
     JSON.stringify(w && w.patch));
  await p.click('[data-rtedit="3"]'); await settle();
  await p.fill('#rtForm input[name="title"]', '');
  await clear(); await clearToasts();
  await p.click('#rtDone'); await settle(300);
  ok('a job with no wording isn\'t ticked: it asks for a name first', !(await last('update', 'routines')) && /Give it a name/.test(await toasts())
    && await visible('rtEd'));
  await p.click('#rtCancel'); await settle();
  ok('the help says Done is there', await help('<strong>Done</strong> ticks it off from there'));

  // ---------------------------------------------------------------
  console.log('\nML397: the podcast\'s picture on its page');
  await ev(async () => {
    $('diary').classList.add('hidden'); lockBackground();
    const row = (id, url, title) => ({ id, created_by: 'me', url, title, description: null, level: 'everyday', subjects: ['Podcasts'],
      share_all: false, opens: 0, last_opened: null, created_at: '2026-11-01T10:00:00Z' });
    window.__rows.url_links = [row(501, 'https://feeds.example/pod.rss', 'Pretend Pod'),
      row(502, 'https://feeds.example/pod.rss?b=1', 'Broken Pic Pod'),
      row(503, 'https://feeds.example/gone.rss', 'Gone Pod'), row(504, 'https://feeds.example/pod.rss?n=1', 'No Pic Pod')];
    window.__rows.url_link_shares = [];
    LINK_PREFS.pics = { 501: { u: 'https://feeds.example/pod.rss', i: 'https://pics.example/good/501.png', t: '' },
      502: { u: 'https://feeds.example/pod.rss?b=1', i: 'https://pics.example/broken/502.png', t: '' },
      503: { u: 'https://feeds.example/gone.rss', i: 'https://pics.example/good/503.png', t: '' } };
    LINK_PREFS.tune = {}; LINK_PREFS.heard = {};
    await loadLinks();
  });
  await ev(() => openEps(501)); await settle(900);
  ok('the page shows the podcast\'s picture, the one on its tile', await ev(() => {
    const im = document.querySelector('#podEpsBody .epshead .eptop .eppic img');
    return !!im && im.getAttribute('src') === 'https://pics.example/good/501.png' && im.complete && im.naturalWidth > 0; }));
  ok('  beside how many episodes, with the rest as before', await ev(() => /2 episodes · 0 listened/.test(document.querySelector('.eptop p').textContent)
    && !!document.querySelector('[data-epopen]') && !!document.querySelector('#epList [data-epgo]')));
  await ev(() => openEps(502)); await settle(900);
  ok('a picture that won\'t load shows the podcast\'s letter instead', await ev(() => {
    const box = document.querySelector('#podEpsBody .eppic'); return !!box && !box.querySelector('img') && box.textContent.trim() === 'B'; }));
  await ev(() => openEps(504)); await settle(900);
  ok('no picture yet: its letter', await ev(() => document.querySelector('#podEpsBody .eppic').textContent.trim() === 'N'));
  await ev(() => openEps(503)); await settle(900);
  ok('when the list can\'t be read, the page still has the picture, by the message', await ev(() =>
    !!document.querySelector('#podEpsBody .eptop .eppic img') && /could not be read|No list/i.test(document.querySelector('#podEpsBody .eptop p').textContent)),
    await ev(() => document.querySelector('#podEpsBody').textContent.slice(0, 160)));
  ok('  nothing spills off the side at 320 wide', await (async () => {
    await p.setViewportSize({ width: 320, height: 700 }); await settle(200);
    const r = await ev(() => { const b = $('podEpsBody'); return b.scrollWidth <= b.clientWidth + 1; });
    await p.setViewportSize({ width: 390, height: 844 }); return r; })());
  await ev(() => { $('podEps').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nML398: Pounds, seeing what the last player put where');
  const as = async (who, name, args) => { const r = await ev(([w, n, a]) => { window.__who = w; const r = window.__rpc(n, a); window.__who = null; return r; }, [who, name, args]);
    await ev(async () => { await pdReload(PD_CUR); pdPaint(); }); await settle(150); return r; };
  const line = () => ev(() => { const e = document.querySelector('.pdjust'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const cardOf = () => ev(() => document.querySelector('.pdcardhd').textContent.trim());
  const lit = () => ev(() => [...document.querySelectorAll('.pdbox.just, .pdsum.just')].map(x => x.dataset.pdbox || 'extra').join(','));
  const g3 = await ev(() => { window.__who = 'sandra'; const r = window.__rpc('new_pounds', { players: ['sandra', 'other', 'me'], first_seat: 0 }); window.__who = null; return r.data; });
  await ev(async id => { await lkReload(); await pdOpen(id); }, g3); await settle(500);
  ok('three of us, Sandra first: nothing to say yet', await line() === '' && /Sandra’s card/.test(await cardOf()));
  await as('sandra', 'pounds_dice', { g: g3, at_turn: 1, d: { v: [3, 3, 3, 5, 5], held: [], rolls: 1 } });
  await as('sandra', 'pounds_score', { g: g3, at_turn: 1, s: { box: { fh: 25 }, extra: 0, last: { k: 'fh', v: 25, d: [3, 3, 3, 5, 5], at: 1, x: 0 } } });
  ok('Sandra puts 25 in Full house: her card stays on my screen, Full house lit up', /Sandra’s card/.test(await cardOf()) && await lit() === 'fh', await cardOf() + ' / ' + await lit());
  ok('  with a line saying what she put where, and the dice', await line() === 'Sandra put 25 in Full house (3 3 3 5 5)', await line());
  ok('  though it is Someone Else\'s turn now', /^Someone Else’s turn\. Waiting for them to roll\./.test(await ev(() => $('pdStatus').textContent.replace(/\s+/g, ' ').trim())));
  await as('other', 'pounds_dice', { g: g3, at_turn: 2, d: { v: [1, 2, 3, 4, 6], held: [], rolls: 1 } });
  ok('once they roll, their card shows instead', /Someone Else’s card/.test(await cardOf()) && await lit() === '', await cardOf());
  ok('  and the line about Sandra stays until the next box is filled', /^Sandra put 25 in Full house/.test(await line()));
  await as('other', 'pounds_score', { g: g3, at_turn: 2, s: { box: { ss: 30 }, extra: 0, last: { k: 'ss', v: 30, d: [1, 2, 3, 4, 6], at: 2, x: 0 } } });
  ok('Someone Else puts 30 in Short run: now it is my turn, and their card shows until I roll', /Someone Else’s card/.test(await cardOf())
    && await lit() === 'ss' && await line() === 'Someone Else put 30 in Short run (1 2 3 4 6)', await cardOf() + ' / ' + await line());
  await p.click('.pdwho button.me'); await settle(150);
  ok('tapping my own name shows my card at once', /Your card/.test(await cardOf()));
  await ev(() => { window.__dice = [6, 6, 6, 6, 6]; window.pdRand = () => window.__dice.length ? window.__dice.shift() : 1; });
  await p.click('#pdRoll'); await settle(500);
  ok('  and it stays mine when I roll', /Your card/.test(await cardOf()));
  await p.click('[data-pdbox="five"]'); await p.click('#pdGo'); await settle(500);
  ok('my own box gets no line on my screen', await line() === '' && /Sandra’s card/.test(await cardOf()), await line() + ' / ' + await cardOf());
  await as('sandra', 'pounds_dice', { g: g3, at_turn: 4, d: { v: [6, 6, 6, 6, 6], held: [], rolls: 1 } });
  await ev(id => { window.__who = 'sandra'; window.__rpc('pounds_dice', { g: id, at_turn: 4, d: { v: [6, 6, 6, 6, 6], held: [], rolls: 1 } }); window.__who = null; }, g3);
  await as('sandra', 'pounds_score', { g: g3, at_turn: 4, s: { box: { fh: 25, ch: 30 }, extra: 0 } });
  ok('a phone that hasn\'t updated says nothing about the box: no line, the card of whoever\'s turn it is', await line() === ''
    && /Someone Else’s card/.test(await cardOf()) && await lit() === '', await line() + ' / ' + await cardOf());
  await as('other', 'pounds_dice', { g: g3, at_turn: 5, d: { v: [5, 5, 5, 5, 5], held: [], rolls: 1 } });
  await as('other', 'pounds_score', { g: g3, at_turn: 5, s: { box: { ss: 30, five: 50 }, extra: 0, last: { k: 'five', v: 50, d: [5, 5, 5, 5, 5], at: 5, x: 0 } } });
  ok('Five of a kind: the line and the box', await line() === 'Someone Else put 50 in Five of a kind (5 5 5 5 5)' && await lit() === 'five', await line());
  ok('the help says so', await help('that box picked out, and a line at the') && await help('top says what they put where'));
  await ev(() => pdBackToList()); await settle(300);

  // ---------------------------------------------------------------
  console.log('\nML399: finished games as matches, Loxx and Pounds apart');
  await ev(async () => {
    const G = window.__rows.games, P = window.__rows.game_players;
    window.__rows.games = G.filter(g => g.status === 'playing');
    window.__rows.game_players = P.filter(x => window.__rows.games.some(g => g.id === x.game_id));
    const at = (d, h) => `2026-11-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`;
    const game = (id, kind, d, sheets) => {
      window.__rows.games.push({ id, kind, created_by: 'me', created_at: at(d, 10), ended_at: at(d, 11), status: 'ended',
        end_reason: 'Every box filled', turn: 0, turn_no: 27, closed: {}, dice: { real: false } });
      Object.keys(sheets).forEach((u, i) => window.__rows.game_players.push({ game_id: id, user_id: u, seat: i, sheet: sheets[u], done_turn: 26 }));
    };
    const pd = n => ({ box: { ch: n }, extra: 0 }), lx = pen => ({ pen, locked: [], marks: {} });
    game(701, 'pounds', 1, { me: pd(20), sandra: pd(10) });
    game(702, 'pounds', 2, { me: pd(10), sandra: pd(20) });
    game(703, 'pounds', 3, { me: pd(15), sandra: pd(15) });
    game(704, 'pounds', 4, { me: pd(25), sandra: pd(5) });
    game(705, 'pounds', 5, { me: pd(5), sandra: pd(25) });
    game(711, 'pounds', 6, { me: pd(5), sandra: pd(6), other: pd(30) });
    game(712, 'pounds', 7, { other: pd(30), me: pd(5), sandra: pd(6) });
    game(721, 'pounds', 8, { me: pd(120) });
    game(731, 'lockkeeper', 8, { me: lx(0), sandra: lx(1) });
    game(732, 'lockkeeper', 9, { me: lx(0), sandra: lx(2) });
    GM_OPEN.clear();
    await openGames();
  });
  await settle(600);
  const heads = () => ev(() => [...document.querySelectorAll('#gamesBody .dsec')].map(x => x.textContent.trim()));
  const matches = () => ev(() => [...document.querySelectorAll('#gamesBody [data-gmmatch]')].map(x => ({
    t: x.querySelector('b').textContent.replace(/\s+/g, ' ').trim(), s: x.querySelector('small').textContent.replace(/\s+/g, ' ').trim(),
    open: x.getAttribute('aria-expanded') === 'true' })));
  const rowsIn = k => ev(k => { const m = document.querySelector(`[data-gmmatch="${k}"]`); const n = m && m.nextElementSibling;
    return n && n.classList.contains('gmgames') ? [...n.querySelectorAll('[data-lkgame]')].map(x => Number(x.dataset.lkgame)) : []; }, k);
  ok('Going on, then Finished for Loxx, for Pounds, and for Pounds on your own', JSON.stringify(await heads())
    === JSON.stringify(['Going on', 'Finished: Loxx', 'Finished: Pounds', 'Finished: Pounds on your own']), JSON.stringify(await heads()));
  let m = await matches();
  ok('Loxx: one match, best of 3 with Sandra, won 2–0, folded away', m[0] && m[0].t === 'Best of 3 with Sandra'
    && m[0].s === 'You won 2–0 · 8 to 9 Nov · 2 games' && !m[0].open, JSON.stringify(m[0]));
  ok('Pounds, newest first: the three of us, then Sandra\'s match still going on, then the one I won', m.length === 4
    && /^Best of 3 with (Sandra and Someone Else|Someone Else and Sandra)$/.test(m[1].t) && m[1].s === 'Someone Else won: Someone Else 2, You 0, Sandra 0 · 6 to 7 Nov · 2 games'
    && m[2].t === 'Best of 3 with Sandra' && m[2].s === 'Not finished: Sandra 1, You 0 · 5 Nov · 1 game'
    && m[3].s === 'You won 2–1 · 1 to 4 Nov · 4 games', JSON.stringify(m));
  ok('  a draw counts for nobody: four games for 2–1', m[3] && /4 games/.test(m[3].s));
  ok('the match going on is open, its game showing; the finished ones are folded', m[2].open && !m[3].open && !m[1].open
    && JSON.stringify(await rowsIn('705')) === '[705]' && !(await ev(() => !!document.querySelector('[data-lkgame="701"]'))));
  ok('Pounds on your own is listed by itself, as before', await ev(() => {
    const s = [...document.querySelectorAll('#gamesBody .dsec')].pop(); const c = s.nextElementSibling;
    return !!c.querySelector('[data-lkgame="721"]') && /Pounds on your own/.test(c.textContent) && !c.querySelector('[data-gmmatch]'); }));
  ok('the game still going on is under Going on, not in a match', await ev(() => {
    const live = GAMES.find(g => g.status === 'playing'); const s = document.querySelector('#gamesBody .dsec');
    return !!live && !!s.nextElementSibling.querySelector(`[data-lkgame="${live.id}"]`)
      && [...document.querySelectorAll('.gmgames [data-lkgame]')].every(x => Number(x.dataset.lkgame) !== live.id); }));
  await p.click('[data-gmmatch="701"]'); await settle(200);
  ok('tapping the finished match opens it: its games, newest first, each with who won and the scores', JSON.stringify(await rowsIn('701')) === '[704,703,702,701]'
    && await ev(() => { const t = [...document.querySelectorAll('.gmgames [data-lkgame]')].map(x => x.textContent.replace(/\s+/g, ' '));
      return t.some(x => /You won, 25 to 5/.test(x)) && t.some(x => /A draw on 15/.test(x)) && t.some(x => /Sandra won, 20 to 10/.test(x)); }),
    JSON.stringify(await rowsIn('701')));
  ok('  marked open', (await matches())[3].open);
  await p.click('[data-lkgame="702"]'); await settle(500);
  ok('  tapping a game opens it, with the cards', await ev(() => PD_CUR === 702 && !$('pdPlay').classList.contains('hidden')));
  await ev(() => pdBackToList()); await settle(400);
  ok('  back on Games, the match is still open', (await matches())[3].open);
  await p.click('[data-gmmatch="701"]'); await settle(200);
  ok('  and tapping it again folds it', !(await matches())[3].open && JSON.stringify(await rowsIn('701')) === '[]');
  ok('no Best of 3 / First to 5 buttons any more: how long a match is, is chosen when it starts (ML411)',
    !(await ev(() => !!document.querySelector('[data-gmrule]'))));
  ok('  the match not finished has a gold dot and Next game; the finished ones have neither',
    await ev(() => { const r = [...document.querySelectorAll('[data-gmmatch]')];
      return r.filter(x => x.classList.contains('gmnot')).map(x => x.dataset.gmmatch).join() === '705'
        && !!r.find(x => x.dataset.gmmatch === '705').querySelector('.gmdot')
        && document.querySelectorAll('[data-gmnext]').length === 1 && document.querySelector('[data-gmnext]').dataset.gmnext === '705'; }));
  ok('nothing spills off the side at 320 wide', await (async () => {
    await p.setViewportSize({ width: 320, height: 700 }); await settle(200);
    const r = await ev(() => { const b = $('gamesBody'); return b.scrollWidth <= b.clientWidth + 1; });
    await p.setViewportSize({ width: 390, height: 844 }); return r; })());
  ok('dates: one day, days in one month, across months, across years', await ev(() => {
    const t = x => new Date(x).getTime();
    return gmSpan(t('2026-11-08T10:00:00Z'), t('2026-11-08T20:00:00Z')) === '8 Nov'
      && gmSpan(t('2026-11-08T10:00:00Z'), t('2026-11-09T10:00:00Z')) === '8 to 9 Nov'
      && gmSpan(t('2026-10-28T10:00:00Z'), t('2026-11-02T10:00:00Z')) === '28 Oct to 2 Nov'
      && gmSpan(t('2026-12-28T10:00:00Z'), t('2027-01-02T10:00:00Z')) === '28 Dec 2026 to 2 Jan 2027'; }));
  ok('the help explains matches', await help('<strong>Results:</strong> under Games, finished games are kept apart')
    && await help('as Loxx(&rsquo;|’)s are [(]see Matches and Results under Loxx[)]'));

  // ---------------------------------------------------------------
  console.log('\nThe version');
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.24.1');
  ok('2026.11.24.1 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  four lines for What\'s new, each short enough', V && V.changes.length === 4 && V.changes.every(x => x.length < 160));

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
