// Books (ML257, step 61): favourite books, the one being read and the ones
// to read next. Barcode or ISBN looked up on Open Library, stars and notes,
// format, price, bought from, borrowed from, lent to, series, links to
// reviews online, photos, and sharing where others add their own stars.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED/i;
const CORS = { 'access-control-allow-origin': '*' };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());

  // Open Library, as far as these tests need it.
  let olMode = 'ok', olCalls = [], coverPng = null;
  await p.route('**/openlibrary.org/api/books*', r => {
    const u = new URL(r.request().url()); olCalls.push(u.searchParams.get('bibkeys'));
    if (olMode === 'down') return r.abort('internetdisconnected');
    const key = u.searchParams.get('bibkeys');
    const books = {
      'ISBN:9780141439600': { title: 'A Tale of Two Cities', authors: [{ name: 'Charles Dickens' }],
        cover: { small: 'http://covers.openlibrary.org/b/id/1-S.jpg', large: 'http://covers.openlibrary.org/b/id/1-L.jpg' } },
      'ISBN:9780140449266': { title: 'The Count of Monte Cristo', authors: [{ name: 'Alexandre Dumas' }, { name: 'Robin Buss' }] } };
    return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(books[key] ? { [key]: books[key] } : {}) });
  });
  let coverAsked = '';
  await p.route('**/covers.openlibrary.org/**', r => { coverAsked = r.request().url();
    return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: coverPng }); });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const shown = id => ev(id => !!document.getElementById(id) && !document.getElementById(id).classList.contains('hidden'), id);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && (!table || w.table === table)), [op, table]);
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick,.bkscan').forEach(d => d.remove()); DPH = null; });
  const text = sel => ev(sel => (document.querySelector(sel) || {}).innerText || '', sel).then(t => t.replace(/\s+/g, ' ').trim());
  const today = await ev(() => isoDay(new Date()));
  // A real picture for the cover, so it can be shrunk like any other photo.
  coverPng = Buffer.from(await ev(() => { const c = document.createElement('canvas'); c.width = 180; c.height = 270;
    const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 37 % 360},60%,${30 + i % 40}%)`; g.fillRect((i * 13) % 180, (i * 29) % 270, 14, 14); }
    return c.toDataURL('image/png').split(',')[1]; }), 'base64');

  console.log('\nThe tile');
  ok('Books can go on the home screen', await ev(() => TILE_DEST.books && TILE_DEST.books.label === 'Books' && TILE_DEST.books.go === openBooks));
  ok('a new person gets it after My Stuff, with Settings still last', await ev(() =>
    TILE_DEFAULTS.indexOf('books') === TILE_DEFAULTS.indexOf('stuff') + 1 && TILE_DEFAULTS[TILE_DEFAULTS.length - 1] === 'settings'));
  ok('someone with tiles already set out gets it at the end, unless they took it off', await ev(() => {
    const was = MY_PROFILE, keep = TILES;
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }, { dest: 'settings' }], hidden: [] } };
    loadTiles(); const got = TILES.map(t => t.dest);
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: ['books'] } };
    loadTiles(); const binned = TILES.map(t => t.dest);
    MY_PROFILE = was; TILES = keep;
    return got[got.length - 1] === 'books' && !binned.includes('books');
  }));
  ok('it has a colour of its own from the palette', await ev(() => TILE_COLOURS.includes(TILE_DEFAULT_COLOUR.books)));
  ok('it is a place in the menu', await ev(() => AREAS.books && AREAS.books.title === 'Books'
    && areaItems('books').some(x => x.label === 'Add a book') && areaItems('books').some(x => x.label === 'Type an ISBN')));
  ok('its three screens wear the tile colour', await ev(() => TILE_SKIN.books.join() === 'books,bookView,bookEd'));
  ok('and it has its own Help', await ev(() => { openHelp('books');
    const h = document.getElementById('h-books'); $('help').classList.add('hidden');
    return !!h && HELP_AT.books === 'h-books' && /Open Library/.test(h.parentElement.innerHTML)
      && /What you thought/.test(h.parentElement.innerHTML); }));
  ok('the backup in Settings takes both new tables', await ev(() =>
    /from books t\b/.test(BACKUP_SQL_1) && /from book_reviews t\b/.test(BACKUP_SQL_1)));

  console.log('\nBefore step 61, and when it will not load');
  const whyText = msg => ev(async msg => {
    const real = sb.from;
    sb.from = t => (t === 'books' || t === 'book_reviews')
      ? { select: () => { const r = { data: null, error: { message: msg } };
          return { order: () => Promise.resolve(r), then: (f, j) => Promise.resolve(r).then(f, j) }; } } : real(t);
    const e0 = console.error; console.error = () => {};
    await openBooks(); sb.from = real; console.error = e0;
    return $('bkBody').textContent.replace(/\s+/g, ' ');
  }, msg);
  let why = await whyText('relation "public.books" does not exist');
  ok('no table yet: it says to run step 61', /Run the step 61 file in Supabase/.test(why), why.slice(0, 120));
  ok('and does not pretend there are no books', !/No books yet/.test(why));
  why = await whyText('Failed to fetch');
  ok('a failed load says nothing has been lost', /Nothing has been lost/.test(why) && !/No books yet/.test(why), why.slice(0, 120));
  await closeAll();

  console.log('\nThe list');
  const setRows = () => ev(() => {
    window.__rows.books = [
      { id: 1, created_by: 'me', title: 'The Thursday Murder Club', author: 'Richard Osman',
        series: 'Thursday Murder Club', series_no: '1', isbn: '9780241988268', format: 'paperback',
        status: 'read', finished_on: '2026-10-01', stars: 4, notes: 'Read it on the boat',
        price: 9.99, bought_from: 'Waterstones', bought_from_id: null, borrowed_from: null, borrowed_from_id: null,
        lent_to: 'Dickie Deal', lent_to_id: 1, lent_on: '2026-10-20',
        links: [{ url: 'https://www.theguardian.com/books/thursday', quote: 'Warm and very funny' }],
        photos: [{ path: 'bk/me/c1.jpg' }, { path: 'bk/me/c2.jpg' }], shared_with: ['sandra'] },
      { id: 2, created_by: 'me', title: 'A Boat Called Hope', author: 'Jo Bloggs', status: 'read', stars: 5,
        links: [], photos: [], shared_with: [] },
      { id: 3, created_by: 'me', title: 'Wolf Hall', author: 'Hilary Mantel', status: 'read', stars: 4,
        format: 'hardback', links: [], photos: [], shared_with: [] },
      { id: 4, created_by: 'me', title: 'Narrow Dog to Carcassonne', author: 'Terry Darlington', status: 'reading',
        links: [], photos: [], shared_with: [] },
      { id: 5, created_by: 'sandra', title: 'The Man Who Died Twice', author: 'Richard Osman', status: 'want', stars: 3,
        notes: 'The second one', links: [], photos: [], shared_with: ['me'] },
      { id: 6, created_by: 'me', title: 'Bleak House', author: 'Charles Dickens', status: 'want',
        links: [], photos: [], shared_with: [] }];
    window.__rows.book_reviews = [
      { id: 21, book_id: 1, user_id: 'sandra', stars: 5, words: 'Loved it' },
      { id: 22, book_id: 5, user_id: 'sandra', stars: 3, words: 'Hers, so not shown as a review' }];
  });
  await setRows();
  await ev(() => { BK_LIST = 'read'; BK_Q = ''; return openBooks(); }); await settle(300);
  ok('it opens on the Read list', await shown('books') && await ev(() =>
    document.querySelector('[data-bklist="read"]').getAttribute('aria-pressed') === 'true'));
  ok('each list says how many are in it', await text('#bkChips') === 'Read 3 Reading 1 Want to read 2', await text('#bkChips'));
  ok('Read comes with the most stars first, then A to Z (The and A left out)', await ev(() =>
    [...document.querySelectorAll('#bkList [data-bk]')].map(x => x.dataset.bk).join()) === '2,1,3');
  const row1 = await text('[data-bk="1"]');
  ok('a row has the author and series', /Richard Osman · Thursday Murder Club, book 1/.test(row1), row1);
  ok('its stars', await ev(() => document.querySelector('[data-bk="1"] .bkstars').textContent === '★★★★☆'));
  ok('when it was finished and the format', /Finished 1 Oct 2026 · Paperback/.test(row1), row1);
  ok('and who has it, in red', await ev(() =>
    /Lent to Dickie Deal since 20 Oct 2026/.test(document.querySelector('[data-bk="1"] .late').textContent)));
  ok('the cover is the first photo', await ev(() =>
    document.querySelector('[data-bk="1"] img.bkcover').src === 'https://signed.test/bk/me/c1.jpg'));
  ok('one with no photo has a book in its place', await ev(() => !!document.querySelector('[data-bk="2"] .bkcover.none')));
  await p.click('[data-bklist="want"]'); await settle(200);
  const want = await text('#bkList');
  ok('Want to read, A to Z', await ev(() =>
    [...document.querySelectorAll('#bkList [data-bk]')].map(x => x.dataset.bk).join()) === '6,5', want);
  ok('one shared with you says who from', /The Man Who Died Twice .*from Sandra/.test(want), want);
  await p.fill('#bkQ', 'osman'); await settle(150);
  ok('the search looks through every list', await ev(() =>
    [...document.querySelectorAll('#bkList [data-bk]')].map(x => x.dataset.bk).sort().join()) === '1,5');
  ok('and says which list each is on', /Read/.test(await text('[data-bk="1"]')) && /Want to read/.test(await text('[data-bk="5"]')));
  ok('the list buttons step aside while it searches', await ev(() =>
    ![...document.querySelectorAll('[data-bklist]')].some(x => x.getAttribute('aria-pressed') === 'true')));
  ok('typing keeps your place in the box', await ev(() => document.activeElement && document.activeElement.id === 'bkQ'));
  await p.fill('#bkQ', 'darlington carcassonne'); await settle(150);
  ok('every word has to match', await ev(() =>
    [...document.querySelectorAll('#bkList [data-bk]')].map(x => x.dataset.bk).join()) === '4');
  await p.fill('#bkQ', 'zzzz'); await settle(150);
  ok('nothing found says so', /No book matches that/.test(await text('#bkList')));
  await p.click('[data-bklist="read"]'); await settle(150);
  ok('tapping a list clears the search', await ev(() => $('bkQ').value === '' && BK_LIST === 'read'));

  console.log('\nOne of yours');
  await p.click('[data-bk="1"]'); await settle(300);
  ok('it opens', await shown('bookView') && await ev(() => $('bkViewTitle').textContent) === 'The Thursday Murder Club');
  let view = await text('#bkView');
  ok('with your stars', await ev(() => /Your stars/.test($('bkView').innerText) && !!document.querySelector('#bkView .bkstars.big')));
  ok('read, and when', /Reading Read, finished 1 Oct 2026/.test(view), view.slice(0, 300));
  ok('format, price and where it came from', /Format Paperback/.test(view) && /Price £9\.99/.test(view) && /Bought from Waterstones/.test(view), view.slice(0, 300));
  ok('who has it, as a contact to tap', /Lent to Dickie Deal since 20 Oct 2026/.test(view)
    && await ev(() => !!document.querySelector('#bkView [data-stfcontact="1"]')));
  ok('the ISBN, your notes and who it is shared with', /ISBN 9780241988268/.test(view) && /Your notes Read it on the boat/.test(view)
    && /Shared with Sandra/.test(view));
  ok('the cover large at the top', await ev(() => document.querySelector('#bkView img.bkhero').src.endsWith('bk/me/c1.jpg')));
  ok('a review elsewhere is a link, with its line', await ev(() => {
    const a = document.querySelector('#bkView a.bklinkout');
    return a && a.href === 'https://www.theguardian.com/books/thursday' && a.target === '_blank'
      && /theguardian\.com/.test(a.textContent) && /“Warm and very funny”/.test(a.textContent); }));
  ok('what others thought', /What others thought Sandra ★★★★★ ?Loved it/i.test(view), view);
  ok('yours can be changed, and has no box for your own review', await ev(() => !!$('bkEditBtn') && !$('bkRevSave')));
  ok('a lent book can come back in one tap', await ev(() => !!document.querySelector('[data-bkdo="back"]')));
  await clearWrites();
  await p.click('[data-bkdo="back"]'); await settle(300);
  let up = (await writes('update', 'books')).pop();
  ok('it clears who has it', up && up.patch.lent_to === null && up.patch.lent_to_id === null && up.patch.lent_on === null
    && up.where.some(x => x[1] === 'id' && x[2] === 1), JSON.stringify(up));
  ok('and says so', /Back on the shelf/.test(await said()));
  await clearWrites();
  await p.click('.stfthumb [data-bkmain="1"]'); await settle(300);
  up = (await writes('update', 'books')).pop();
  ok('another photo can be made the cover', up && JSON.stringify(up.patch.photos) === '[{"path":"bk/me/c2.jpg"},{"path":"bk/me/c1.jpg"}]', JSON.stringify(up));
  await ev(() => openBook(4)); await settle(200);
  await clearWrites();
  ok('one you are reading can be finished in one tap', await ev(() => !!document.querySelector('[data-bkdo="finished"]')));
  await p.click('[data-bkdo="finished"]'); await settle(300);
  up = (await writes('update', 'books')).pop();
  ok('it goes on Read, finished today', up && up.patch.status === 'read' && up.patch.finished_on === today, JSON.stringify(up));
  await ev(() => openBook(6)); await settle(200);
  await clearWrites();
  await p.click('[data-bkdo="reading"]'); await settle(300);
  up = (await writes('update', 'books')).pop();
  ok('one you want to read can be started in one tap', up && up.patch.status === 'reading' && !('finished_on' in up.patch), JSON.stringify(up));
  await closeAll();

  console.log('\nOne shared with you');
  await setRows();
  await ev(() => openBooks()); await settle(200);
  await ev(() => openBook(5)); await settle(300);
  view = await text('#bkView');
  ok('it says whose stars and notes they are', /Sandra’s stars/.test(view) && /Sandra’s notes The second one/.test(view), view);
  ok('and who shared it', /Shared by Sandra/.test(view));
  ok('it cannot be changed or moved on', await ev(() => !$('bkEditBtn') && !document.querySelector('[data-bkdo]')));
  ok('her own say is not listed as somebody else’s review', !/What others thought/.test(view));
  ok('there is a box for what you thought', await ev(() => !!$('bkRevStars') && !!$('bkRevWords') && !!$('bkRevSave')));
  await clearWrites();
  await p.click('#bkRevSave'); await settle(200);
  ok('saving nothing asks for something first', /Tap some stars or write a few words first/.test(await said())
    && (await writes('upsert', 'book_reviews')).length === 0);
  await p.click('#bkRevStars [data-star="4"]');
  ok('tapping the fourth star lights four', await ev(() =>
    [...document.querySelectorAll('#bkRevStars [data-star]')].map(x => x.getAttribute('aria-pressed')).join() === 'true,true,true,true,false'));
  await p.click('#bkRevStars [data-star="4"]');
  ok('tapping it again takes them off', await ev(() =>
    ![...document.querySelectorAll('#bkRevStars [data-star]')].some(x => x.getAttribute('aria-pressed') === 'true')));
  await p.click('#bkRevStars [data-star="4"]');
  await p.fill('#bkRevWords', '  Even better than the first  ');
  await p.click('#bkRevSave'); await settle(300);
  const ups = (await writes('upsert', 'book_reviews')).pop();
  ok('it saves your review, one each', ups && ups.rows.book_id === 5 && ups.rows.user_id === 'me' && ups.rows.stars === 4
    && ups.rows.words === 'Even better than the first', JSON.stringify(ups));
  await ev(() => { window.__rows.book_reviews.push({ id: 30, book_id: 5, user_id: 'me', stars: 4, words: 'Even better' }); });
  await ev(() => bkAfterChange(5)); await settle(200);
  ok('and shows it back to you', await ev(() => $('bkRevWords').value === 'Even better'
    && document.querySelectorAll('#bkRevStars [aria-pressed="true"]').length === 4));
  await clearWrites();
  await p.click('#bkRevStars [data-star="4"]'); await p.fill('#bkRevWords', '');
  await p.click('#bkRevSave'); await settle(300);
  const rdel = (await writes('delete', 'book_reviews')).pop();
  ok('emptied, it is taken off', rdel && rdel.where.some(x => x[1] === 'id' && x[2] === 30), JSON.stringify(rdel));
  await closeAll();

  console.log('\nThe ISBN');
  ok('a 13-figure ISBN is checked', await ev(() => bkIsbnOk('9780241988268') && bkIsbnOk('978-0-241-98826-8') && !bkIsbnOk('9780241988269')));
  ok('and a 10-figure one', await ev(() => bkIsbnOk('0241988268') && !bkIsbnOk('0241988267') && bkIsbnOk('080442957X')));
  ok('the 10-figure one is the same book as its 13', await ev(() => bkIsbn13('0241988268') === '9780241988268'));
  ok('anything else is not an ISBN', await ev(() => !bkIsbnOk('12345') && !bkIsbnOk('5012345678900')));

  console.log('\nAdding one');
  await setRows();
  await ev(() => openBooks()); await settle(200);
  await ev(() => { window.__bd = window.BarcodeDetector; delete window.BarcodeDetector; });
  await p.click('#bkAdd'); await settle(200);
  ok('the + offers the ISBN or filling it in', await ev(() =>
    !!document.querySelector('[data-bkway="isbn"]') && !!document.querySelector('[data-bkway="hand"]')));
  ok('no scanning where the camera cannot read barcodes (the laptop)', await ev(() => !document.querySelector('[data-bkway="scan"]')));
  await p.click('#bkAddNo');
  await ev(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13']; } async detect() { return []; } };
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new Error('none'); } }, configurable: true }); });
  await p.click('#bkAdd'); await settle(200);
  ok('where it can (the phone), scanning comes first', await ev(() =>
    document.querySelector('#bkAddBox [data-bkway]').dataset.bkway === 'scan'));
  ok('the menu offers it too', await ev(() => areaItems('books').some(x => x.label === 'Scan a barcode')));
  await p.click('[data-bkway="isbn"]'); await settle(200);
  ok('Type the ISBN asks for the number', await ev(() => !!$('bkIsbnIn') && $('bkIsbnSay').hidden));
  await p.fill('#bkIsbnIn', '12345'); await p.click('#bkIsbnGo'); await settle(150);
  ok('a wrong number says so in the box, which stays open', await ev(() => !$('bkIsbnSay').hidden
    && /doesn’t look like an ISBN/.test($('bkIsbnSay').textContent) && !!$('bkIsbnIn')));
  await clearWrites(); olCalls = [];
  await p.fill('#bkIsbnIn', '978-0-14-143960-0'); await p.press('#bkIsbnIn', 'Enter'); await settle(1500);
  ok('it asks Open Library', olCalls.join() === 'ISBN:9780141439600', olCalls.join());
  ok('the new book screen opens', await shown('bookEd') && await ev(() => $('bkEdTitle').textContent) === 'New book');
  ok('with the title, the author and the ISBN filled in', await ev(() => {
    const f = $('bkForm').elements;
    return f.title.value === 'A Tale of Two Cities' && f.author.value === 'Charles Dickens' && f.isbn.value === '9780141439600'; }));
  ok('its cover is fetched safely (https)', /^https:\/\/covers\.openlibrary\.org\/b\/id\/1-L\.jpg/.test(coverAsked), coverAsked);
  const upl = (await writes('upload')).pop();
  ok('and goes in as the first photo, in your books folder', upl && /^bk\/me\/[0-9a-f-]+\.jpg$/.test(upl.path)
    && await ev(() => DPH && DPH.box === 'bkPics' && DPH.photos.length === 1), JSON.stringify(upl));
  ok('it says it found it, with its cover', /Found it, with its cover/.test(await said()), await said());
  ok('a new book starts as Read', await ev(() =>
    document.querySelector('[data-bkstat="read"]').getAttribute('aria-pressed') === 'true' && $('bkFin').style.display === ''));

  console.log('\nFilling it in');
  await p.click('[data-bkstat="reading"]');
  ok('Reading hides the day you finished', await ev(() => $('bkFin').style.display === 'none'));
  await p.click('[data-bkfmt="hardback"]');
  await p.click('#bkStarPick [data-star="5"]');
  await p.fill('#bkForm [name="series"]', 'Penguin Classics'); await p.fill('#bkForm [name="series_no"]', '12');
  await p.fill('#bkForm [name="notes"]', 'Best of times');
  await p.fill('#bkForm [name="price"]', '£1,012.50');
  await ev(() => { const f = $('bkForm').elements; f.lent_to.value = 'Dickie Deal'; f.lent_to_id.value = '1'; });
  await p.click('#bkLinkAdd');
  await p.fill('.bklink [name="link_url"]', 'www.goodreads.com/book/show/1953');
  await p.fill('.bklink [name="link_quote"]', 'A classic');
  await p.click('#bkLinkAdd');   // a second, left empty, is ignored
  await p.check('#bkForm [name="share"][value="sandra"]');
  await clearWrites();
  await p.click('#bkSave'); await settle(500);
  const ins = (await writes('insert', 'books')).pop();
  const r = ins && ins.rows;
  ok('it saves the book', !!r && r.title === 'A Tale of Two Cities' && r.author === 'Charles Dickens' && r.created_by === 'me', JSON.stringify(r));
  ok('as Reading, a hardback, five stars', r && r.status === 'reading' && r.format === 'hardback' && r.stars === 5);
  ok('with its series and number, and your notes', r && r.series === 'Penguin Classics' && r.series_no === '12' && r.notes === 'Best of times');
  ok('the price as a number', r && r.price === 1012.5, r && r.price);
  ok('lent to a contact, today if no day is given', r && r.lent_to === 'Dickie Deal' && r.lent_to_id === 1 && r.lent_on === today, JSON.stringify(r));
  ok('the link made a proper web address, with its line', r && JSON.stringify(r.links) === '[{"url":"https://www.goodreads.com/book/show/1953","quote":"A classic"}]', r && JSON.stringify(r.links));
  ok('its cover photo', r && r.photos.length === 1 && /^bk\/me\//.test(r.photos[0].path));
  ok('and who it is shared with', r && JSON.stringify(r.shared_with) === '["sandra"]');
  ok('no day finished for one still being read', r && r.finished_on === null && r.borrowed_from === null);
  ok('the list moves to where it went', await ev(() => BK_LIST === 'reading' && !$('bookEd').classList.contains('hidden') === false));
  await closeAll();

  console.log('\nWhat it will not save');
  const refuse = async (fill, want) => {
    await ev(() => openBookEd(null, { isbn: '' })); await settle(150);
    await ev(fill); await clearWrites();
    await p.click('#bkSave'); await settle(200);
    return /./.test(want) && new RegExp(want).test(await said()) && (await writes('insert', 'books')).length === 0;
  };
  ok('no title', await refuse(() => {}, 'Give it a title'));
  ok('a price that is not a number', await refuse(() => { const f = $('bkForm').elements; f.title.value = 'X'; f.price.value = 'ten pounds'; }, 'needs to be a number'));
  ok('an ISBN that is wrong', await refuse(() => { const f = $('bkForm').elements; f.title.value = 'X'; f.isbn.value = '9780241988269'; }, 'ISBN doesn’t look right'));
  ok('a link that is not a web address', await refuse(() => { const f = $('bkForm').elements; f.title.value = 'X';
    $('bkLinkAdd').click(); document.querySelector('.bklink [name="link_url"]').value = 'not a link'; }, 'isn’t a web address'));
  await ev(() => $('bkEdCancel').click()); await settle(200);
  ok('Cancel puts away a photo added but not saved', await ev(() => DPH === null));
  await closeAll();

  console.log('\nNot found, already there, and no signal');
  await setRows(); await ev(() => openBooks()); await settle(200);
  await clearWrites();
  await ev(() => bkFind('9780000000002')); await settle(600);
  ok('not on Open Library: the form opens with just the ISBN', await shown('bookEd') && await ev(() =>
    $('bkForm').elements.isbn.value === '9780000000002' && $('bkForm').elements.title.value === ''));
  ok('and says to fill it in', /Not found on Open Library: fill it in yourself/.test(await said()));
  await ev(() => $('bkEdCancel').click()); await settle(200);
  await clearWrites();
  await ev(() => bkFind('9780140449266')); await settle(600);
  ok('several authors are all kept', await ev(() => $('bkForm').elements.author.value === 'Alexandre Dumas, Robin Buss'));
  ok('no cover: it says to add a photo', /Found it: add a photo of the cover/.test(await said()) && (await writes('upload')).length === 0);
  await ev(() => $('bkEdCancel').click()); await settle(200);
  olCalls = [];
  await ev(() => bkFind('0241988268')); await settle(400);
  ok('one already in your books opens that one instead (even as a 10-figure ISBN)', olCalls.length === 0
    && await shown('bookView') && await ev(() => BK_VIEW === 1));
  await closeAll();
  olMode = 'down'; await clearWrites();
  await ev(() => { const e0 = console.warn; console.warn = () => {}; return bkFind('9780141439600').finally(() => { console.warn = e0; }); }); await settle(400);
  ok('no signal: it says so and lets you fill it in', /Couldn’t reach Open Library/.test(await said()) && await shown('bookEd'));
  olMode = 'ok';
  await ev(() => $('bkEdCancel').click()); await closeAll();

  console.log('\nThe barcode scanner');
  await setRows(); await ev(() => openBooks()); await settle(200);
  await ev(() => {
    window.__codes = [];
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13', 'qr_code']; }
      constructor(o) { window.__bdFormats = o && o.formats; } async detect() { return window.__codes; } };
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d'); setInterval(() => { g.fillStyle = '#' + Math.floor(Math.random() * 4096).toString(16).padStart(3, '0'); g.fillRect(0, 0, 64, 64); }, 50);
    window.__stream = null;
    const md = { getUserMedia: async (want) => { window.__camWant = want; window.__stream = c.captureStream(10); return window.__stream; } };
    Object.defineProperty(navigator, 'mediaDevices', { value: md, configurable: true });
  });
  await ev(() => { bkScan(); }); await settle(800);
  ok('it opens the back camera, over everything', await ev(() => !!$('bkScan') && window.__camWant.video.facingMode === 'environment'
    && getComputedStyle($('bkScan')).zIndex === '100'));
  ok('and looks only for book barcodes', await ev(() => JSON.stringify(window.__bdFormats) === '["ean_13"]'));
  await ev(() => { window.__codes = [{ rawValue: '5012345678900' }]; }); await settle(500);
  ok('a barcode that is not a book says so on the camera screen', await ev(() =>
    !!$('bkScan') && /isn’t a book’s barcode/.test(document.querySelector('.bkscansay').textContent)));
  await clearWrites(); olCalls = [];
  await ev(() => { window.__codes = [{ rawValue: '9780141439600' }]; }); await settle(1500);
  ok('a book barcode closes the camera', await ev(() => !$('bkScan')
    && window.__stream.getTracks().every(t => t.readyState === 'ended') && BK_SCAN_STOP === null));
  ok('and looks the book up', olCalls.join() === 'ISBN:9780141439600' && await ev(() =>
    $('bookEd') && !$('bookEd').classList.contains('hidden') && $('bkForm').elements.title.value === 'A Tale of Two Cities'));
  await ev(() => $('bkEdCancel').click()); await settle(200);
  await ev(() => { window.__codes = []; bkScan(); }); await settle(500);
  await p.click('#bkScanType'); await settle(200);
  ok('Type it instead stops the camera and asks for the number', await ev(() => !$('bkScan') && !!$('bkIsbnIn')
    && window.__stream.getTracks().every(t => t.readyState === 'ended')));
  await closeAll();
  await ev(() => { bkScan(); }); await settle(500);
  await ev(() => AREA_SHUT.books()); await settle(100);
  ok('leaving Books stops the camera', await ev(() => !$('bkScan') && window.__stream.getTracks().every(t => t.readyState === 'ended')));
  await ev(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['qr_code']; } }; return bkScan(); }); await settle(200);
  ok('a phone that cannot read book barcodes asks for the number, saying why', await ev(() =>
    !!$('bkIsbnIn') && !$('bkIsbnSay').hidden && /can’t read barcodes/.test($('bkIsbnSay').textContent)));
  await closeAll();
  await ev(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13']; } async detect() { return []; } };
    navigator.mediaDevices.getUserMedia = async () => { const e = new Error('no'); e.name = 'NotAllowedError'; throw e; };
    return bkScan(); }); await settle(200);
  ok('a camera not allowed asks for the number, saying why', await ev(() =>
    !!$('bkIsbnIn') && /camera wasn’t allowed/.test($('bkIsbnSay').textContent)));
  await closeAll();
  await ev(() => { if (window.__bd) window.BarcodeDetector = window.__bd; else delete window.BarcodeDetector; });

  console.log('\nChanging and deleting');
  await setRows(); await ev(() => openBooks()); await settle(200);
  await ev(() => openBook(1)); await settle(200);
  await p.click('#bkEditBtn'); await settle(300);
  ok('Edit opens it filled in', await shown('bookEd') && await ev(() => {
    const f = $('bkForm').elements;
    return $('bkEdTitle').textContent === 'Change book' && f.title.value === 'The Thursday Murder Club'
      && f.series_no.value === '1' && f.lent_to.value === 'Dickie Deal'
      && document.querySelectorAll('.bklink').length === 1 && DPH.photos.length === 2
      && document.querySelectorAll('#bkStarPick [aria-pressed="true"]').length === 4
      && document.querySelector('[data-bkfmt="paperback"]').getAttribute('aria-pressed') === 'true'
      && document.querySelector('#bkForm [name="share"][value="sandra"]').checked; }));
  await p.click('[data-bkfmt="paperback"]');
  ok('tapping the format again clears it', await ev(() => !document.querySelector('#bkFmt [aria-pressed="true"]')));
  await clearWrites();
  await p.click('#bkSave'); await settle(400);
  up = (await writes('update', 'books')).pop();
  ok('saving changes that book, keeping what it had', up && up.where.some(x => x[1] === 'id' && x[2] === 1)
    && up.patch.format === null && up.patch.stars === 4 && up.patch.lent_on === '2026-10-20'
    && up.patch.links.length === 1 && up.patch.photos.length === 2 && !('created_by' in up.patch), JSON.stringify(up && up.patch));
  ok('and goes back to it', await shown('bookView') && !(await shown('bookEd')));
  await ev(() => openBookEd(BOOKS.find(x => x.id === 1))); await settle(200);
  await clearWrites();
  await p.click('#bkDelete'); await settle(400);
  ok('Delete removes the book', (await writes('delete', 'books')).some(w => w.where.some(x => x[1] === 'id' && x[2] === 1)));
  const rm = (await writes('rmfile')).pop();
  ok('and your photos with it', rm && rm.paths.includes('bk/me/c1.jpg') && rm.paths.includes('bk/me/c2.jpg'), JSON.stringify(rm));
  ok('and closes its screens', !(await shown('bookEd')) && !(await shown('bookView')));
  await closeAll();

  console.log('\nAn empty list gives way');
  await ev(() => { window.__rows.books = window.__rows.books.filter(x => x.status === 'want'); BK_LIST = 'read'; });
  await ev(() => openBooks()); await settle(200);
  ok('opening with nothing Read shows Want to read', await ev(() => BK_LIST === 'want'));
  await p.click('[data-bklist="read"]'); await settle(150);
  ok('but an empty list can still be looked at', await ev(() => BK_LIST === 'read') && /None here yet/.test(await text('#bkList')));
  await ev(() => { window.__rows.books = []; }); await ev(() => openBooks()); await settle(200);
  ok('no books at all says how to add one', /No books yet. Press the red \+/.test(await text('#bkList')));
  await closeAll();

  console.log('\nFetching again, and the screen it is');
  await setRows(); await ev(() => openBooks()); await settle(200);
  ok('the app knows it is in Books', await ev(() => currentScreen() === 'books'));
  await ev(() => { window.__rows.books.push({ id: 9, created_by: 'me', title: 'Three Men in a Boat', status: 'read', stars: 5,
    links: [], photos: [], shared_with: [] }); });
  await ev(() => refreshAll()); await settle(600);
  ok('Refresh brings in a new one', /Three Men in a Boat/.test(await text('#bkList')));
  await ev(() => backHome('books')); await settle(200);
  ok('the home button puts all three screens away', !(await shown('books')) && !(await shown('bookView')) && !(await shown('bookEd')));

  console.log('\nNarrow phones');
  for (const w of [320, 360]) {
    await p.setViewportSize({ width: w, height: 760 });
    await setRows(); await ev(() => { BK_LIST = 'read'; return openBooks(); }); await settle(250);
    const over = async id => ev(id => { const e = $(id); return e.scrollWidth - e.clientWidth; }, id);
    ok(`the list fits at ${w}`, await over('bkBody') <= 0 && await ev(() => document.documentElement.scrollWidth <= innerWidth));
    await ev(() => openBook(1)); await settle(200);
    ok(`one book fits at ${w}`, await over('bkView') <= 0);
    await ev(() => openBookEd(BOOKS.find(x => x.id === 1))); await settle(200);
    await ev(() => $('bkLinkAdd').click());
    ok(`the form fits at ${w}`, await over('bkEdBody') <= 0, String(await over('bkEdBody')));
    ok(`the five stars sit on one line at ${w}`, await ev(() => {
      const s = [...document.querySelectorAll('#bkStarPick button')].map(x => x.getBoundingClientRect().top);
      return Math.max(...s) - Math.min(...s) < 2; }));
    await ev(() => $('bkEdCancel').click()); await settle(150);
    await ev(() => openBook(5)); await settle(200);
    ok(`your review box fits at ${w}`, await over('bkView') <= 0);
    await closeAll();
  }
  await p.setViewportSize({ width: 390, height: 844 });

  console.log('\nThe version');
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  ok('the app and version.json agree', await ev(() => APP_VERSION) === vj.version && vj.version === '2026.11.11.2', vj.version);
  ok('What’s new mentions Books', vj.history[0].version === vj.version && vj.history[0].changes.every(c => /^Books: /.test(c) && c.length < 160));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
