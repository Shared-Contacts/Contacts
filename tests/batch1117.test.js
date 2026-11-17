// 17 Nov 2026 (version 2026.11.17.1):
//   ML290  Daily Log: the calendar pop-up keeps still from month to month.
//   ML288  Books and TV/Movies: Entered by (step 64).
//   ML289  Books and TV/Movies: a link shared in from another app.
//   ML293  Loxx: the gold "waiting for you" line fits the bar, both ways up.
// Loxx's Save your turn? (ML292) and Done by mistake (ML291) are played on
// two phones against step 64's real SQL in twophone.test.js.
// Open Library, Wikipedia, Wikidata and TVmaze are faked: nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED|status of 500|status of 404|schema cache/i;
const CORS = { 'access-control-allow-origin': '*' };
const json = (r, body, status = 200) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const LOD = { id: 353, name: 'Line of Duty', premiered: '2012-06-26', runtime: 60, genres: ['Drama'],
  network: { name: 'BBC One' }, summary: '<p>AC-12.</p>', image: null };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());

  const calls = [];
  await p.route('**/openlibrary.org/api/books*', r => {
    const key = new URL(r.request().url()).searchParams.get('bibkeys'); calls.push('ol ' + key);
    const books = { 'ISBN:9780261103344': { title: 'The Hobbit', authors: [{ name: 'J. R. R. Tolkien' }] } };
    return json(r, books[key] ? { [key]: books[key] } : {});
  });
  await p.route(u => u.hostname === 'en.wikipedia.org', r => {
    const u = new URL(r.request().url()); calls.push('wiki ' + (u.searchParams.get('gsrsearch') || u.pathname));
    if (u.pathname === '/w/api.php') return json(r, (u.searchParams.get('gsrsearch') || '').toLowerCase() === 'paddington 2 film'
      ? { query: { pages: [{ index: 1, title: 'Paddington 2', description: '2017 film by Paul King' }] } } : { batchcomplete: true });
    return json(r, { title: 'Paddington 2', extract: 'A bear.' });
  });
  await p.route(u => u.hostname === 'www.wikidata.org', r => json(r, { entities: {} }));
  await p.route(u => u.hostname === 'api.tvmaze.com', r => {
    const u = new URL(r.request().url()); calls.push('tvmaze ' + u.pathname + u.search);
    if (u.pathname === '/search/shows') return json(r, (u.searchParams.get('q') || '').toLowerCase() === 'line of duty' ? [{ score: 1, show: LOD }] : []);
    if (u.pathname === '/shows/353') return json(r, { ...LOD, _embedded: { episodes: [], cast: [] } });
    return json(r, {}, 404);
  });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await answerLkAsks(p, () => true);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && (!table || w.table === table)), [op, table]);
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick,.bkscan').forEach(d => d.remove()); DPH = null; BK_EDIT = null; TV_EDIT = null;
    BK_VIEW = null; TV_VIEW = null; });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; });

  // ---------------------------------------------------------------
  console.log('\nDaily Log: the calendar keeps still (ML290)');
  await ev(async () => { $('diary').classList.add('hidden'); await openLog(); }); await settle(500);
  const measure = month => ev(m => { PICK_MONTH = m; drawDayPick();
    const box = document.querySelector('.daypick .inner'), nx = document.querySelector('[data-pm="1"]'),
      cl = $('pickClose'), cells = document.querySelectorAll('.daypick .mgrid .mcell');
    return { top: Math.round(box.getBoundingClientRect().top), h: Math.round(box.getBoundingClientRect().height),
      next: Math.round(nx.getBoundingClientRect().top), close: Math.round(cl.getBoundingClientRect().top), cells: cells.length,
      days: document.querySelectorAll('.daypick [data-pickday]').length }; }, month);
  const months = { '2027-02': await measure('2027-02'), '2026-10': await measure('2026-10'), '2026-11': await measure('2026-11') };
  ok('February 2027 (four weeks), October 2026 (five) and November 2026 (six): always six rows, 42 squares',
    Object.values(months).every(m => m.cells === 42) && months['2027-02'].days === 28 && months['2026-10'].days === 31
    && months['2026-11'].days === 30, JSON.stringify(months));
  ok('  the box, its arrows and Close stay exactly where they were', new Set(Object.values(months).map(m => [m.top, m.h, m.next, m.close].join())).size === 1,
    JSON.stringify(months));
  await ev(() => { PICK_MONTH = '2026-09'; drawDayPick(); });
  const steps = [];
  for (let i = 0; i < 6; i++) {
    steps.push(await ev(() => Math.round(document.querySelector('[data-pm="1"]').getBoundingClientRect().top)));
    await p.click('[data-pm="1"]'); await settle(80);
  }
  ok('  tapping the next-month arrow six times: it never moves from under your thumb', new Set(steps).size === 1, steps.join());
  ok('  and the padding squares are blank, not days', await ev(() => [...document.querySelectorAll('.daypick .mgrid .mcell.blank')]
    .every(x => !x.dataset.pickday && !x.textContent.trim())));
  await ev(() => document.querySelectorAll('.daypick').forEach(x => x.remove()));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nBooks: Entered by (ML288)');
  await ev(() => { window.__rows.books = [
    { id: 5, created_by: 'me', title: 'Old One', status: 'read', links: [], photos: [], shared_with: [] },
    { id: 6, created_by: 'me', entered_by: 'sandra', title: 'Sandra’s', status: 'read', links: [], photos: [], shared_with: [] }];
    window.__rows.book_reviews = []; window.__rows.shows = []; window.__rows.show_reviews = []; });
  await ev(() => openBooks()); await settle(300);
  await ev(() => openBookEd(null)); await settle(300);
  const opts = await ev(() => [...document.querySelectorAll('#bkForm [name="entered_by"] option')].map(o => [o.value, o.textContent, o.selected]));
  ok('a new book: Entered by starts as you', opts.length && opts[0][0] === 'me' && opts[0][2] === true && /^You \(Barry\)$/.test(opts[0][1]), JSON.stringify(opts));
  ok('  and offers everyone else who uses the app, by name', opts.map(o => o[1]).join() === 'You (Barry),Sandra,Someone Else', JSON.stringify(opts));
  for (const w of [320, 1000]) {
    await p.setViewportSize({ width: w, height: 800 }); await settle(150);
    const fit = await ev(() => { const s = document.querySelector('#bkForm [name="entered_by"]').getBoundingClientRect(),
      t = document.querySelector('#bkForm [name="title"]').getBoundingClientRect(); return { s: [s.left, s.width], t: [t.left, t.width] }; });
    ok(`  at ${w} wide its box is as wide as Title, not squeezed`, Math.abs(fit.s[1] - fit.t[1]) < 2 && Math.abs(fit.s[0] - fit.t[0]) < 2 && fit.s[1] > 200, JSON.stringify(fit));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(150);
  await clearWrites();
  await ev(() => { $('bkForm').elements.title.value = 'Mine'; }); await p.click('#bkSave'); await settle(400);
  let ins = (await writes('insert', 'books'))[0];
  ok('  saved as yourself: Entered by is left out, so it saves before step 64 too', !!ins && !('entered_by' in ins.rows) && ins.rows.title === 'Mine', JSON.stringify(ins && ins.rows));
  await closeAll(); await ev(() => openBookEd(null)); await settle(300);
  await clearWrites();
  await ev(() => { const f = $('bkForm'); f.elements.title.value = 'For Sandra'; f.elements.entered_by.value = 'sandra'; });
  await p.click('#bkSave'); await settle(400);
  ins = (await writes('insert', 'books'))[0];
  ok('  entered for Sandra: saved with her as Entered by', !!ins && ins.rows.entered_by === 'sandra' && ins.rows.created_by === 'me', JSON.stringify(ins && ins.rows));
  await closeAll();
  await ev(() => { openBooks(); }); await settle(300);
  await ev(() => openBook(5)); await settle(300);
  ok('a book from before step 64 says Entered by You', /Entered by\s*You/.test(await ev(() => $('bkView').innerText)), await ev(() => $('bkView').innerText));
  await ev(() => openBook(6)); await settle(300);
  ok('  one entered for Sandra says so', /Entered by\s*Sandra/.test(await ev(() => $('bkView').innerText)));
  await ev(() => openBookEd(BOOKS.find(x => x.id === 6))); await settle(300);
  ok('  changing it, Sandra is chosen', await ev(() => $('bkForm').elements.entered_by.value) === 'sandra');
  await clearWrites();
  await ev(() => { $('bkForm').elements.entered_by.value = 'me'; }); await p.click('#bkSave'); await settle(400);
  let up = (await writes('update', 'books'))[0];
  ok('  set back to you: that is saved too', !!up && up.patch.entered_by === 'me', JSON.stringify(up && up.patch));
  await closeAll();
  // Before step 64 is run, the database refuses the column.
  await ev(() => { const f0 = sb.from; window.__from0 = f0; sb.from = t => { const a = f0(t);
    if (t === 'books' || t === 'shows') { const i0 = a.insert;
      a.insert = rows => rows.entered_by ? { select: () => ({ single: () => Promise.resolve({ data: null,
        error: { message: `Could not find the 'entered_by' column of '${t}' in the schema cache` } }) }) } : i0(rows); }
    return a; }; });
  await ev(() => openBookEd(null)); await settle(300); await clearWrites();
  await ev(() => { const f = $('bkForm'); f.elements.title.value = 'Too soon'; f.elements.entered_by.value = 'sandra'; });
  await p.click('#bkSave'); await settle(400);
  ok('  before step 64: it says so, rather than blaming step 61', /Entered by needs step 64 run in Supabase first/.test(await said())
    && !(await ev(() => $('bookEd').classList.contains('hidden'))), await said());
  await closeAll();

  console.log('\nTV/Movies: Entered by (ML288)');
  await ev(() => openShows()); await settle(300);
  await ev(() => openShowEd(null)); await settle(300);
  ok('a new one: Entered by starts as you', await ev(() => $('tvForm').elements.entered_by.value) === 'me');
  await clearWrites();
  await ev(() => { const f = $('tvForm'); f.elements.title.value = 'Too soon'; f.elements.entered_by.value = 'sandra'; });
  await p.click('#tvSave'); await settle(400);
  ok('  before step 64, choosing Sandra says step 64 is needed', /Entered by needs step 64/.test(await said()), await said());
  await ev(() => { sb.from = window.__from0; });
  await clearWrites(); await p.click('#tvSave'); await settle(400);
  ins = (await writes('insert', 'shows'))[0];
  ok('  with step 64 run: saved with Sandra as Entered by', !!ins && ins.rows.entered_by === 'sandra', JSON.stringify(ins && ins.rows));
  await ev(() => { window.__rows.shows = [{ id: 7, created_by: 'me', entered_by: 'sandra', title: 'Hers', kind: 'film', status: 'watched',
    viewings: [], links: [], photos: [], shared_with: [] }]; });
  await closeAll(); await ev(() => openShows()); await settle(300); await ev(() => openShow(7)); await settle(300);
  ok('  its own screen says Entered by Sandra', /Entered by\s*Sandra/.test(await ev(() => $('tvShowBody').innerText)));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nShared in from another app: what the share says (ML289)');
  const guess = s => ev(s => shareGuess(s), s);
  let g = await guess({ title: 'Amazon.co.uk: The Hobbit: Tolkien, J. R. R.: 9780261103344: Books', url: 'https://www.amazon.co.uk/dp/0261103342' });
  ok('Amazon: the ISBN, the title and the author', g.isbn === '9780261103344' && g.name === 'The Hobbit' && g.author === 'Tolkien, J. R. R.', JSON.stringify(g));
  g = await guess({ title: '', url: 'https://www.amazon.co.uk/Hobbit-J-R-Tolkien/dp/0261103342/ref=sr_1_1?k=hobbit' });
  ok('  an Amazon address alone: its ISBN-10', g.isbn === '0261103342', JSON.stringify(g));
  g = await guess({ title: 'Kindle edition', url: 'https://www.amazon.co.uk/dp/B0CW1Z2X3Y' });
  ok('  a Kindle number is not an ISBN', g.isbn === '', JSON.stringify(g));
  g = await guess({ text: 'The Hobbit https://amzn.eu/d/abc', url: 'https://amzn.eu/d/abc' });
  ok('  a short Amazon link: just the name it came with', g.isbn === '' && g.name === 'The Hobbit', JSON.stringify(g));
  g = await guess({ title: 'The Hobbit by J.R.R. Tolkien | Goodreads', url: 'https://www.goodreads.com/book/show/5907' });
  ok('Goodreads: title and author, without the site name', g.name === 'The Hobbit' && g.author === 'J.R.R. Tolkien' && !g.isbn, JSON.stringify(g));
  g = await guess({ title: 'Paddington 2 (2017) ⭐ 7.8 | Adventure, Comedy, Family', url: 'https://www.imdb.com/title/tt4468740/' });
  ok('IMDb film: the name, without the year and stars', g.name === 'Paddington 2' && g.kind === 'film', JSON.stringify(g));
  g = await guess({ title: 'Line of Duty (TV Series 2012–2021) - IMDb', url: 'https://m.imdb.com/title/tt2303687/' });
  ok('IMDb series: the name, and it is a series', g.name === 'Line of Duty' && g.kind === 'series', JSON.stringify(g));
  g = await guess({ text: 'Watch “Paddington 2” on Netflix https://www.netflix.com/title/80165120', url: 'https://www.netflix.com/title/80165120' });
  ok('Netflix: the name in the quotes', g.name === 'Paddington 2', JSON.stringify(g));
  g = await guess({ title: 'BBC iPlayer - Line of Duty - Series 1: Episode 1', url: 'https://www.bbc.co.uk/iplayer/episode/b01k8w1v' });
  ok('iPlayer: the series’ name, without the episode', g.name === 'Line of Duty' && g.kind === 'series', JSON.stringify(g));
  g = await guess({ title: 'https://example.com/x', url: 'https://example.com/x' });
  ok('just an address: no name made up from it', g.name === '' && g.isbn === '', JSON.stringify(g));

  console.log('\nSave this as: a book or a film (ML289)');
  await ev(() => sharedIn({ url: 'https://www.goodreads.com/book/show/5907', title: 'The Hobbit by J.R.R. Tolkien | Goodreads', text: '' })); await settle(200);
  ok('a link shared in: recipe, URL Links, a book, a film or TV series', await ev(() => ['siRecipe', 'siLink', 'siBook', 'siShow'].every(id => !!$(id))));
  await ev(() => document.querySelectorAll('.daypick').forEach(x => x.remove()));
  await ev(() => sharedIn({ url: '', title: '', text: 'Line of Duty' })); await settle(200);
  ok('  just a name, no address: a book or a film only', await ev(() => !$('siRecipe') && !$('siLink') && !!$('siBook') && !!$('siShow')));
  await ev(() => document.querySelectorAll('.daypick').forEach(x => x.remove()));
  await ev(() => sharedIn({ url: '', title: '', text: '' })); await settle(200);
  ok('  nothing at all: it says there was no web address, as before', !(await ev(() => !!document.querySelector('.daypick'))));

  await clearWrites(); calls.length = 0;
  await ev(() => sharedIn({ url: 'https://www.amazon.co.uk/dp/0261103342', title: 'Amazon.co.uk: The Hobbit: Tolkien, J. R. R.: 9780261103344: Books', text: '' }));
  await settle(200); await p.click('#siBook');
  await p.waitForFunction(() => !$('bookEd').classList.contains('hidden'), null, { timeout: 15000 }); await settle(300);
  let f = await ev(() => { const f = $('bkForm'); return { t: f.elements.title.value, a: f.elements.author.value, i: f.elements.isbn.value,
    l: [...f.querySelectorAll('[name="link_url"]')].map(x => x.value) }; });
  ok('A book from Amazon: looked up on Open Library by its ISBN', calls.includes('ol ISBN:9780261103344') && f.t === 'The Hobbit'
    && f.a === 'J. R. R. Tolkien' && f.i === '9780261103344', JSON.stringify(f));
  ok('  with the Amazon link kept under Reviews elsewhere', f.l.join() === 'https://www.amazon.co.uk/dp/0261103342', JSON.stringify(f.l));
  await closeAll();
  await ev(() => sharedIn({ url: 'https://www.goodreads.com/book/show/5907', title: 'The Hobbit by J.R.R. Tolkien | Goodreads', text: '' }));
  await settle(200); await clearWrites(); await p.click('#siBook');
  await p.waitForFunction(() => !$('bookEd').classList.contains('hidden'), null, { timeout: 15000 }); await settle(300);
  f = await ev(() => { const f = $('bkForm'); return { t: f.elements.title.value, a: f.elements.author.value, i: f.elements.isbn.value }; });
  ok('  from Goodreads (no ISBN): title and author filled in, and it says to check', f.t === 'The Hobbit' && f.a === 'J.R.R. Tolkien' && !f.i
    && /No ISBN in that/.test(await said()), JSON.stringify(f) + ' ' + await said());
  await closeAll();

  calls.length = 0;
  await ev(() => sharedIn({ url: 'https://m.imdb.com/title/tt2303687/', title: 'Line of Duty (TV Series 2012–2021) - IMDb', text: '' }));
  await settle(200); await p.click('#siShow'); await settle(700);
  ok('A series from IMDb: Find it by name opens on TV series, already looked for', await ev(() => !!$('tvFindBox')
    && $('tvFindQ').value === 'Line of Duty' && document.querySelector('[data-tvfk="series"]').getAttribute('aria-pressed') === 'true')
    && calls.some(c => /search\/shows\?q=Line(%20|\+)of(%20|\+)Duty/.test(c)), calls.join(' | '));
  await p.click('[data-tvhit="0"]');
  await p.waitForFunction(() => !$('tvEd').classList.contains('hidden'), null, { timeout: 15000 }); await settle(300);
  f = await ev(() => { const f = $('tvForm'); return { t: f.elements.title.value, k: f.dataset.kind, c: f.elements.channel.value,
    l: [...f.querySelectorAll('[name="link_url"]')].map(x => x.value) }; });
  ok('  tapped: TVmaze’s details, with the IMDb link kept', f.t === 'Line of Duty' && f.c === 'BBC One'
    && f.l.join() === 'https://m.imdb.com/title/tt2303687/', JSON.stringify(f));
  await closeAll();
  await ev(() => sharedIn({ url: 'https://www.netflix.com/title/80165120', title: '', text: 'Watch “Paddington 2” on Netflix https://www.netflix.com/title/80165120' }));
  await settle(200); await p.click('#siShow'); await settle(700);
  ok('A film from Netflix: looked for as a film by the name in the quotes', await ev(() => $('tvFindQ').value === 'Paddington 2'
    && document.querySelector('[data-tvfk="film"]').getAttribute('aria-pressed') === 'true' && !!document.querySelector('[data-tvhit="0"]')));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nLoxx: the gold waiting line fits the bar (ML293)');
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  await ev(async () => { window.__lkFake(); window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 1 }); await lkReload(); });
  const G = await ev(() => Math.max(...GAMES.map(g => g.id)));
  for (const [w, h] of [[844, 390], [390, 844]]) {
    await p.setViewportSize({ width: w, height: h }); await settle(200);
    await ev(id => lkOpen(id), G); await settle(400);
    const before = await ev(() => ({ bar: document.querySelector('.lkbar').offsetHeight,
      gold: !!document.querySelector('.lkbar.lkwait') }));
    await ev(id => { const s = window.__rows.game_players.find(x => x.game_id === id && x.user_id === 'sandra'); s.done_turn = 1; }, G);
    await ev(async () => { await lkReload(LK_CUR); lkPaint(); }); await settle(300);
    const after = await ev(() => { const bar = document.querySelector('.lkbar'), st = $('lkStatus'), d = $('lkDone'), u = $('lkUndo');
      // Layout sizes: held upright, the sheet is turned round, which swaps on-screen width and height.
      return { gold: !!document.querySelector('.lkbar.lkwait'), bar: bar.offsetHeight, text: st.innerText.replace(/\s+/g, ' '),
        fits: st.scrollHeight <= st.clientHeight + 2 && st.scrollWidth <= st.clientWidth + 2,
        inside: [d, u].every(x => x.offsetWidth > 40 && x.offsetHeight >= 40), bg: getComputedStyle(st).backgroundColor }; });
    ok(`${w}×${h}: Sandra rolled and tapped Done: the line turns gold and says so`, !before.gold && after.gold
      && /^Sandra is waiting for you\. The white dice total is yours too\. Then Done\./.test(after.text) && after.bg === 'rgb(255, 231, 160)', JSON.stringify(after));
    ok(`  it fits: all its words show, Undo and Done still full size, the bar no taller than ${before.bar + 30}px`,
      after.fits && after.inside && after.bar <= before.bar + 30, JSON.stringify({ before, after }));
    await ev(id => { const s = window.__rows.game_players.find(x => x.game_id === id && x.user_id === 'sandra'); s.done_turn = 0; }, G);
    await ev(() => lkBackToList()); await settle(200);
  }
  await p.setViewportSize({ width: 390, height: 844 });

  console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
