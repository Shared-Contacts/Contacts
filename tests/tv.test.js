// TV/Movies (ML276, step 63): films and TV series watched, being watched and
// still to watch. Found by name: a film from Wikipedia and Wikidata, a series
// from TVmaze with its episodes. Stars and notes, recommended by, each time
// watched (when, where, how, who with, cost), how far into a series, your own
// copy with its barcode, price, bought from and lent to, links to reviews,
// photos, and sharing where others add their own stars.
// Wikipedia, Wikidata and TVmaze are faked here, so this never goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED|status of 500|status of 404/i;
const CORS = { 'access-control-allow-origin': '*' };
const json = (r, body, status = 200) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

// ---- what the fake services know ----
const WIKI_PAGES = {
  'paddington 2 film': [
    { index: 1, title: 'Paddington 2', description: '2017 film by Paul King',
      thumbnail: { source: 'https://upload.wikimedia.org/thumb/p2.jpg' }, pageprops: { wikibase_item: 'Q1' } },
    { index: 2, title: 'Paddington 2 (soundtrack)', description: 'Soundtrack album for the 2017 film' },
    { index: 3, title: 'Hugh Grant', description: 'English actor (born 1960)' },
    { index: 4, title: 'Paddington (2014 film)', description: '2014 film by Paul King', pageprops: { wikibase_item: 'Q3' } }],
  'nothing at all film': [] };
const SUMMARIES = {
  'Paddington_2': { title: 'Paddington 2', extract: 'Paddington the bear goes looking for a pop-up book.',
    originalimage: { source: 'http://upload.wikimedia.org/posters/p2.jpg' }, wikibase_item: 'Q1' },
  'Paddington_(2014_film)': { title: 'Paddington (2014 film)', extract: 'A bear from Peru comes to London.', wikibase_item: 'Q3' } };
const snak = id => ({ rank: 'normal', mainsnak: { datavalue: { value: { id } } } });
const CLAIMS = {
  Q1: { P57: [snak('Q10')], P161: [snak('Q11'), snak('Q12'), { ...snak('Q14'), rank: 'deprecated' }, snak('Q13')],
        P136: [snak('Q20'), snak('Q21')],
        P2047: [{ rank: 'normal', mainsnak: { datavalue: { value: { amount: '+103', unit: 'http://www.wikidata.org/entity/Q7727' } } } }],
        P577: [{ rank: 'normal', mainsnak: { datavalue: { value: { time: '+2018-01-12T00:00:00Z' } } } },
               { rank: 'normal', mainsnak: { datavalue: { value: { time: '+2017-11-10T00:00:00Z' } } } }] },
  Q2: { P2047: [{ rank: 'normal', mainsnak: { datavalue: { value: { amount: '+1.5', unit: 'http://www.wikidata.org/entity/Q25235' } } } }] },
  Q3: {} };
const LABELS = { Q10: 'Paul King', Q11: 'Hugh Grant', Q12: 'Brendan Gleeson', Q13: 'Sally Hawkins', Q14: 'Wrong Person',
  Q20: 'comedy film', Q21: 'family film' };
const EPS = [
  { season: 1, number: 1, name: 'Pilot', airdate: '2012-06-26' },
  { season: 1, number: 2, name: 'Two', airdate: '2012-07-03' },
  { season: 1, number: 3, name: 'Three', airdate: '2012-07-10' },
  { season: 2, number: 1, name: 'Four', airdate: '2014-02-12' },
  { season: 2, number: 2, name: 'Five', airdate: '2014-02-19' }];
const LOD = { id: 353, name: 'Line of Duty', premiered: '2012-06-26', runtime: 60, genres: ['Drama', 'Crime'],
  network: { name: 'BBC One' }, summary: '<p><b>Line of Duty</b> follows AC-12 &amp; the bent coppers.</p>',
  image: { medium: 'https://static.tvmaze.com/m353.jpg', original: 'https://static.tvmaze.com/o353.jpg' } };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());

  let wikiMode = 'ok', tvmMode = 'ok', wdMode = 'ok', picMode = 'ok';
  let calls = [], picsAsked = [], posterPng = null;
  await p.route(u => u.hostname === 'en.wikipedia.org', r => {
    const u = new URL(r.request().url()); calls.push('wiki ' + u.pathname + ' ' + (u.searchParams.get('gsrsearch') || ''));
    if (wikiMode === 'down') return r.abort('internetdisconnected');
    if (u.pathname === '/w/api.php') {
      const pages = WIKI_PAGES[(u.searchParams.get('gsrsearch') || '').toLowerCase()] || [];
      return json(r, pages.length ? { query: { pages } } : { batchcomplete: true });
    }
    const t = decodeURIComponent(u.pathname.split('/page/summary/')[1] || '');
    if (wikiMode === 'nosummary' || !SUMMARIES[t]) return json(r, { title: 'Not found' }, 500);
    return json(r, SUMMARIES[t]);
  });
  await p.route(u => u.hostname === 'www.wikidata.org', r => {
    const u = new URL(r.request().url()); const ids = (u.searchParams.get('ids') || '').split('|');
    calls.push('wikidata ' + u.searchParams.get('props') + ' ' + ids.join('|'));
    if (wdMode === 'down') return r.abort('internetdisconnected');
    const entities = {};
    ids.forEach(id => { entities[id] = u.searchParams.get('props') === 'claims'
      ? { claims: CLAIMS[id] || {} } : { labels: LABELS[id] ? { en: { value: LABELS[id] } } : {} }; });
    return json(r, { entities });
  });
  await p.route(u => u.hostname === 'api.tvmaze.com', r => {
    const u = new URL(r.request().url()); calls.push('tvmaze ' + u.pathname + u.search);
    if (tvmMode === 'down') return r.abort('internetdisconnected');
    if (u.pathname === '/search/shows') {
      const q = (u.searchParams.get('q') || '').toLowerCase();
      return json(r, q === 'line of duty' ? [{ score: 1, show: LOD },
        { score: 0.5, show: { id: 999, name: 'Line of Duty (NZ)', premiered: '2020-01-01', webChannel: { name: 'Netflix' }, image: null } }] : []);
    }
    if (u.pathname === '/shows/353') return json(r, { ...LOD, _embedded: { episodes: EPS,
      cast: [{ person: { name: 'Adrian Dunbar' } }, { person: { name: 'Vicky McClure' } }, { person: { name: 'Adrian Dunbar' } }] } });
    if (u.pathname === '/shows/353/episodes') return json(r, EPS);
    return json(r, {}, 404);
  });
  await p.route(u => u.hostname === 'upload.wikimedia.org' || u.hostname === 'static.tvmaze.com', r => {
    picsAsked.push(r.request().url());
    if (picMode === 'none') return r.fulfill({ status: 404, headers: CORS, body: '' });
    return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: posterPng });
  });

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
    document.querySelectorAll('.daypick,.bkscan').forEach(d => d.remove()); DPH = null; TV_VIEW = null; TV_EDIT = null; });
  const text = sel => ev(sel => (document.querySelector(sel) || {}).innerText || '', sel).then(t => t.replace(/\s+/g, ' ').trim());
  const ids = sel => ev(sel => [...document.querySelectorAll(sel)].map(x => x.dataset.tv).join(), sel);
  const edShown = () => p.waitForFunction(() => !document.getElementById('tvEd').classList.contains('hidden'), null, { timeout: 15000 });
  const where = (w, id) => !!w && w.where.some(x => x[1] === 'id' && x[2] === id);
  const today = await ev(() => isoDay(new Date()));
  await ev(() => { WX_OFF = true; BSKY_OFF = true; });
  // A real picture for the poster, so it can be shrunk like any other photo.
  posterPng = Buffer.from(await ev(() => { const c = document.createElement('canvas'); c.width = 180; c.height = 270;
    const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 37 % 360},60%,${30 + i % 40}%)`; g.fillRect((i * 13) % 180, (i * 29) % 270, 14, 14); }
    return c.toDataURL('image/png').split(',')[1]; }), 'base64');

  console.log('\nThe tile');
  ok('TV/Movies can go on the home screen, by that name', await ev(() => TILE_DEST.tv && TILE_DEST.tv.label === 'TV/Movies' && TILE_DEST.tv.go === openShows));
  ok('a new person gets it after Books, with Settings still last', await ev(() =>
    TILE_DEFAULTS.indexOf('tv') === TILE_DEFAULTS.indexOf('books') + 1 && TILE_DEFAULTS[TILE_DEFAULTS.length - 1] === 'settings'));
  ok('someone with tiles already set out gets it at the end, unless they took it off', await ev(() => {
    const was = MY_PROFILE, keep = TILES, kh = TILES_HIDDEN.slice();
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }, { dest: 'settings' }], hidden: [] } };
    loadTiles(); const got = TILES.map(t => t.dest);
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: ['tv'] } };
    loadTiles(); const binned = TILES.map(t => t.dest);
    MY_PROFILE = was; TILES = keep; TILES_HIDDEN = kh; WX_OFF = true; BSKY_OFF = true;
    return got[got.length - 1] === 'tv' && !binned.includes('tv');
  }));
  ok('it has a colour from the palette, not the same as Books beside it', await ev(() => TILE_COLOURS.includes(TILE_DEFAULT_COLOUR.tv)
    && TILE_DEFAULT_COLOUR.tv !== TILE_DEFAULT_COLOUR.books));
  ok('it is a place in the menu', await ev(() => AREAS.tv && AREAS.tv.title === 'TV/Movies'
    && ['Find a film', 'Find a TV series', 'Fill one in yourself'].every(l => areaItems('tv').some(x => x.label === l))));
  ok('its three screens wear the tile colour', await ev(() => TILE_SKIN.tv.join() === 'tv,tvShow,tvEd'));
  ok('and it has its own Help', await ev(() => { openHelp('tv');
    const h = document.getElementById('h-tv'); $('help').classList.add('hidden');
    const all = h && h.parentElement.innerHTML;
    return !!h && HELP_AT.tv === 'h-tv' && /TVmaze/.test(all) && /Wikipedia/.test(all) && /On the shelf/.test(all); }));
  ok('the backup in Settings takes both new tables', await ev(() =>
    /from shows t\b/.test(BACKUP_SQL_1) && /from show_reviews t\b/.test(BACKUP_SQL_1)));

  console.log('\nBefore step 63, and when it will not load');
  const whyText = msg => ev(async msg => {
    const real = sb.from;
    sb.from = t => (t === 'shows' || t === 'show_reviews')
      ? { select: () => { const r = { data: null, error: { message: msg } };
          return { order: () => Promise.resolve(r), then: (f, j) => Promise.resolve(r).then(f, j) }; } } : real(t);
    const e0 = console.error; console.error = () => {};
    await openShows(); sb.from = real; console.error = e0;
    return $('tvBody').textContent.replace(/\s+/g, ' ');
  }, msg);
  let why = await whyText('relation "public.shows" does not exist');
  ok('no table yet: it says to run step 63', /Run the step 63 file in Supabase/.test(why), why.slice(0, 120));
  ok('and does not pretend there is nothing', !/Nothing here yet/.test(why));
  why = await whyText('Failed to fetch');
  ok('a failed load says nothing has been lost', /Nothing has been lost/.test(why) && !/Nothing here yet/.test(why), why.slice(0, 120));
  await closeAll();

  console.log('\nThe lists');
  const setRows = () => ev(() => {
    const base = { links: [], photos: [], viewings: [], shared_with: [] };
    window.__rows.shows = [
      { ...base, id: 901, created_by: 'me', title: 'Paddington 2', kind: 'film', year: 2017, director: 'Paul King', running_mins: 103,
        genre: 'Comedy, Family', actors: 'Hugh Grant, Brendan Gleeson', synopsis: 'A bear and a pop-up book.', status: 'watched',
        stars: 5, notes: 'Lovely', recommended_by: 'Dickie Deal', recommended_by_id: 1,
        viewings: [{ on: '2017-11-12', where: 'Odeon', how: 'Cinema', with: 'Sandra', cost: 21.5 }, { on: '2026-11-01', where: 'Home', how: 'DVD' }],
        copy: 'dvd', barcode: '5051892212345', price: 5, bought_from: 'HMV', lent_to: 'Dickie Deal', lent_to_id: 1, lent_on: '2026-11-10',
        links: [{ url: 'https://www.empireonline.com/p2', quote: 'Pure joy' }],
        photos: [{ path: 'tv/me/p1.jpg' }, { path: 'tv/me/p2.jpg' }], shared_with: ['sandra'] },
      { ...base, id: 902, created_by: 'me', title: 'Line of Duty', kind: 'series', year: 2012, running_mins: 60, seasons: 6,
        channel: 'BBC One', tvmaze_id: 353, status: 'watching', at_season: 1, at_episode: 3 },
      { ...base, id: 903, created_by: 'sandra', title: 'The Repair Shop', kind: 'series', status: 'want', stars: 4,
        notes: 'Lovely mending', shared_with: ['me'] },
      { ...base, id: 904, created_by: 'me', title: 'Wicked', kind: 'film', status: 'want' },
      { ...base, id: 905, created_by: 'me', title: 'Slow Horses', kind: 'series', status: 'want', channel: 'Apple TV+' },
      { ...base, id: 906, created_by: 'me', title: 'Detectorists', kind: 'series', status: 'watching', at_season: 3, at_episode: 4,
        copy: 'digital' },
      { ...base, id: 907, created_by: 'me', title: 'The Shawshank Redemption', kind: 'film', status: 'watched', stars: 4, copy: 'bluray' },
      { ...base, id: 908, created_by: 'me', title: 'A Bridge Too Far', kind: 'film', status: 'watched', stars: 5 }];
    window.__rows.show_reviews = [
      { id: 21, show_id: 901, user_id: 'sandra', stars: 4, words: 'Made me laugh' },
      { id: 22, show_id: 903, user_id: 'sandra', stars: 4, words: 'Hers, so not shown as a review' }];
  });
  await setRows();
  await ev(() => { TV_LIST = 'watched'; TV_Q = ''; return openShows(); }); await settle(300);
  ok('it opens on the Watched list', await shown('tv') && await ev(() =>
    document.querySelector('[data-tvlist="watched"]').getAttribute('aria-pressed') === 'true'));
  ok('each list says how many are in it', await text('#tvChips') === 'Watched 3 Watching 2 Want to watch 3 On the shelf 2', await text('#tvChips'));
  ok('Watched comes with the most stars first, then A to Z (The and A left out)', await ids('#tvList [data-tv]') === '908,901,907', await ids('#tvList [data-tv]'));
  const row1 = await text('[data-tv="901"]');
  ok('a film’s row has its year and director', /Film · 2017 · Paul King/.test(row1), row1);
  ok('its stars', await ev(() => document.querySelector('[data-tv="901"] .bkstars').textContent === '★★★★★'));
  ok('its copy and how many times it was watched', /DVD · Watched 2 times/.test(row1), row1);
  ok('and who has it, in red', await ev(() =>
    /Lent to Dickie Deal since 10 Nov 2026/.test(document.querySelector('[data-tv="901"] .late').textContent)));
  ok('the poster is the first photo', await ev(() =>
    document.querySelector('[data-tv="901"] img.bkcover').src === 'https://signed.test/tv/me/p1.jpg'));
  ok('one with no photo has a clapperboard in its place', await ev(() => !!document.querySelector('[data-tv="908"] .bkcover.none')));
  await p.click('[data-tvlist="watching"]'); await settle(150);
  ok('Watching, A to Z', await ids('#tvList [data-tv]') === '906,902');
  const row2 = await text('[data-tv="902"]');
  ok('a series’ row has its channel and how far you are', /TV series · 2012 · BBC One/.test(row2) && /Up to S1 E3/.test(row2), row2);
  await p.click('[data-tvlist="want"]'); await settle(150);
  ok('Want to watch, A to Z', await ids('#tvList [data-tv]') === '903,905,904');
  ok('one shared with you says who from', /The Repair Shop .*from Sandra/.test(await text('[data-tv="903"]')));
  await p.click('[data-tvlist="shelf"]'); await settle(150);
  ok('On the shelf is your DVDs and Blu-rays, not a digital copy', await ids('#tvList [data-tv]') === '901,907');
  ok('and says which list each is on', /Watched · DVD/.test(await text('[data-tv="901"]')) && /Watched · Blu-ray/.test(await text('[data-tv="907"]')));
  await p.fill('#tvQ', 'paul king'); await settle(150);
  ok('the search looks through the director', await ids('#tvList [data-tv]') === '901');
  ok('the list buttons step aside while it searches', await ev(() =>
    ![...document.querySelectorAll('[data-tvlist]')].some(x => x.getAttribute('aria-pressed') === 'true')));
  ok('typing keeps your place in the box', await ev(() => document.activeElement && document.activeElement.id === 'tvQ'));
  await p.fill('#tvQ', 'bbc'); await settle(150);
  ok('the channel', await ids('#tvList [data-tv]') === '902');
  await p.fill('#tvQ', 'brendan'); await settle(150);
  ok('the actors', await ids('#tvList [data-tv]') === '901');
  await p.fill('#tvQ', '5051892212345'); await settle(150);
  ok('and the barcode', await ids('#tvList [data-tv]') === '901');
  await p.fill('#tvQ', 'zzzz'); await settle(150);
  ok('nothing found says so', /Nothing matches that/.test(await text('#tvList')));
  await p.click('[data-tvlist="watched"]'); await settle(150);
  ok('tapping a list clears the search', await ev(() => $('tvQ').value === '' && TV_LIST === 'watched'));

  console.log('\nA film of yours');
  await p.click('[data-tv="901"]'); await settle(300);
  ok('it opens', await shown('tvShow') && await ev(() => $('tvShowTitle').textContent) === 'Paddington 2');
  let view = await text('#tvShow');
  ok('film, the year and your stars', /Film or series Film, 2017/.test(view) && await ev(() => !!document.querySelector('#tvShow .bkstars.big')), view.slice(0, 200));
  ok('recommended by, as a contact to tap', /Recommended by Dickie Deal/.test(view) && await ev(() =>
    !!document.querySelector('#tvShowBody .card [data-stfcontact="1"]')));
  ok('the director, running time in hours and minutes, genre and actors', /Director Paul King/.test(view)
    && /Running time 1 hr 43 min/.test(view) && /Genre Comedy, Family/.test(view) && /Actors Hugh Grant, Brendan Gleeson/.test(view), view.slice(0, 400));
  ok('your notes and who it is shared with', /Your notes Lovely/.test(view) && /Shared with Sandra/.test(view));
  ok('what it is about', /What it’s about A bear and a pop-up book/i.test(view));
  ok('each time watched, newest first, with the cost and the total', /Times watched ?2 1 Nov 2026 · Home · DVD 12 Nov 2017 · Odeon · Cinema · with Sandra · £21\.50 £21\.50 in all/i.test(view), view);
  ok('your copy: DVD, price, bought from, lent to and the barcode', /Your copy Copy DVD Price £5\.00 Bought from HMV Lent to Dickie Deal since 10 Nov 2026 Barcode 5051892212345/i.test(view), view);
  ok('the poster large at the top', await ev(() => document.querySelector('#tvShow img.bkhero').src.endsWith('tv/me/p1.jpg')));
  ok('a review elsewhere is a link, with its line', await ev(() => {
    const a = document.querySelector('#tvShow a.bklinkout');
    return a && a.href === 'https://www.empireonline.com/p2' && a.target === '_blank' && /“Pure joy”/.test(a.textContent); }));
  ok('what others thought', /What others thought Sandra ★★★★☆ ?Made me laugh/i.test(view), view);
  ok('yours can be changed, and has no box for your own review', await ev(() => !!$('tvEditBtn') && !$('tvRevSave')));
  ok('a film has no How far you are', await ev(() => !$('tvProg')));
  ok('watched and lent: Add a time and It’s come back, nothing else', await ev(() =>
    [...document.querySelectorAll('[data-tvdo]')].map(x => x.dataset.tvdo).join()) === 'view,back');
  await clearWrites();
  await p.click('[data-tvdo="back"]'); await settle(300);
  let up = (await writes('update', 'shows')).pop();
  ok('It’s come back clears who has it', up && up.patch.lent_to === null && up.patch.lent_to_id === null && up.patch.lent_on === null
    && where(up, 901), JSON.stringify(up));
  ok('and says so', /Back on the shelf/.test(await said()));
  await clearWrites();
  await p.click('.stfthumb [data-tvmain="1"]'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('another photo can be made the poster', up && JSON.stringify(up.patch.photos) === '[{"path":"tv/me/p2.jpg"},{"path":"tv/me/p1.jpg"}]', JSON.stringify(up));

  console.log('\nA time you watched it');
  await clearWrites();
  await p.click('[data-tvdo="view"]'); await settle(200);
  ok('Add a time asks when, where, how, who with and what it cost', await ev(() => {
    const f = $('tvViewForm'); return !!f && ['on', 'where', 'how', 'with', 'cost'].every(n => !!f.elements[n]); }));
  ok('starting at today, how being your copy', await ev(([today]) => {
    const f = $('tvViewForm').elements; return f.on.value === today && f.how.value === 'DVD'; }, [today]));
  ok('the day is chosen with the date picker', await ev(() => !!document.querySelector('#tvViewForm .whenbtn')));
  await p.fill('#tvViewForm [name="where"]', 'On the boat');
  await p.fill('#tvViewForm [name="with"]', 'Sandra');
  await p.fill('#tvViewForm [name="cost"]', 'ten');
  await p.click('#tvViewGo'); await settle(150);
  ok('a cost that is not a number is refused, and the box stays', /What it cost needs to be a number/.test(await said()) && await ev(() => !!$('tvViewBox')));
  await p.fill('#tvViewForm [name="cost"]', '£3.49');
  await p.click('#tvViewGo'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('it is added to the times watched', up && where(up, 901) && up.patch.viewings.length === 3
    && JSON.stringify(up.patch.viewings[2]) === JSON.stringify({ on: today, where: 'On the boat', how: 'DVD', with: 'Sandra', cost: 3.49 })
    && !('status' in up.patch), JSON.stringify(up && up.patch));
  ok('and says so', /Kept/.test(await said()));
  await clearWrites();
  await p.click('[data-tvdo="view"]'); await settle(200);
  await p.click('#tvViewNo'); await settle(200);
  ok('Cancel keeps nothing', (await writes('update', 'shows')).length === 0 && await ev(() => !$('tvViewBox')));

  console.log('\nOne tap');
  await ev(() => openShow(904)); await settle(200);
  ok('a film you want to watch: I’ve watched it', await ev(() =>
    [...document.querySelectorAll('[data-tvdo]')].map(x => x.dataset.tvdo).join()) === 'seen');
  await clearWrites();
  await p.click('[data-tvdo="seen"]'); await settle(200);
  await p.click('#tvViewGo'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('it goes on Watched, with today as the first time', up && where(up, 904) && up.patch.status === 'watched'
    && up.patch.viewings.length === 1 && up.patch.viewings[0].on === today, JSON.stringify(up && up.patch));
  ok('and says so', /On your Watched list/.test(await said()));
  await ev(() => openShow(905)); await settle(200);
  ok('a series you want to watch: I’ve started watching it', await ev(() =>
    [...document.querySelectorAll('[data-tvdo]')].map(x => x.dataset.tvdo).join()) === 'start');
  await clearWrites();
  await p.click('[data-tvdo="start"]'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('it moves to Watching', up && where(up, 905) && up.patch.status === 'watching' && /Moved to Watching/.test(await said()));
  await ev(() => openShow(906)); await settle(200);
  await clearWrites();
  await p.click('[data-tvdo="done"]'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('one being watched can be finished in one tap', up && where(up, 906) && up.patch.status === 'watched'
    && /it’s on your Watched list/.test(await said()));
  await closeAll();

  console.log('\nHow far into a series');
  await setRows(); await ev(() => { TV_EPS = {}; return openShows(); }); await settle(200);
  calls = [];
  await ev(() => openShow(902)); await settle(600);
  ok('it fetches the episodes from TVmaze', calls.filter(c => c === 'tvmaze /shows/353/episodes').length === 1, calls.join(' ; '));
  let prog = await text('#tvProg');
  ok('where you are up to, with its name', /Watched up to Season 1, episode 3 “Three”/.test(prog), prog);
  ok('what comes next goes over into the next season, with when it was first shown', /Next Season 2, episode 1 “Four” First shown 12 Feb 2014/.test(prog), prog);
  ok('Watching says how far too', /Watching Watching, up to season 1, episode 3/.test(await text('#tvShow')));
  await clearWrites();
  await p.click('#tvNext'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('I’ve watched the next episode moves you on one', up && where(up, 902) && up.patch.at_season === 2 && up.patch.at_episode === 1, JSON.stringify(up && up.patch));
  ok('and says where you are', /Up to season 2, episode 1/.test(await said()));
  calls = [];
  await ev(() => { $('tvBack').click(); openShow(902); }); await settle(300);
  ok('the episodes are only fetched once', calls.length === 0, calls.join(' ; '));
  await p.click('#tvPickEp'); await settle(300);
  ok('Choose from the episodes lists them by season', await ev(() => !!$('tvEpBox')
    && [...document.querySelectorAll('#tvEpBox .tvseason')].map(x => x.textContent).join() === 'Season 1,Season 2'
    && document.querySelectorAll('#tvEpBox [data-tvep]').length === 5));
  ok('with where you are picked out', await ev(() => document.querySelector('#tvEpBox [aria-pressed="true"]').dataset.tvep === '1:3'));
  await clearWrites();
  await p.click('[data-tvep="2:2"]'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('tapping one makes it the last one watched', up && up.patch.at_season === 2 && up.patch.at_episode === 2 && await ev(() => !$('tvEpBox')));
  await p.click('#tvPickEp'); await settle(300);
  await clearWrites();
  await p.click('#tvEpNone'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('Not started clears it', up && up.patch.at_season === null && up.patch.at_episode === null && /Not started yet/.test(await said()));
  // The last episode there is.
  await ev(() => { const s = window.__rows.shows.find(x => x.id === 902); s.at_season = 2; s.at_episode = 1; });
  await ev(() => tvAfterChange(902)); await settle(200);
  await clearWrites();
  await p.click('#tvNext'); await settle(500);
  const ups = await writes('update', 'shows');
  ok('watching the last episode there is offers to move it to Watched', ups.length === 2
    && ups[0].patch.at_episode === 2 && ups[1].patch.status === 'watched', JSON.stringify(ups.map(u => u.patch)));
  await ev(() => { const s = window.__rows.shows.find(x => x.id === 902); s.at_episode = 2; });
  await ev(() => tvAfterChange(902)); await settle(200);
  ok('after the last one it says there are no more', /That was the last episode there is/.test(await text('#tvProg')) && await ev(() => !$('tvNext')));
  await ev(() => { const s = window.__rows.shows.find(x => x.id === 902); s.at_season = null; s.at_episode = null; });
  await ev(() => tvAfterChange(902)); await settle(200);
  prog = await text('#tvProg');
  ok('not started: the first episode is next', /Not started yet/.test(prog) && /Next Season 1, episode 1 “Pilot”/.test(prog)
    && /I’ve watched the first episode/.test(prog), prog);
  // One TVmaze does not know.
  await ev(() => openShow(906)); await settle(200);
  prog = await text('#tvProg');
  ok('one with no episode list still goes on one at a time', /Watched up to Season 3, episode 4/.test(prog) && /Next Season 3, episode 5/.test(prog)
    && /Change where I’m up to/.test(prog), prog);
  await clearWrites();
  await p.click('#tvNext'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('to the next episode in the same season', up && up.patch.at_season === 3 && up.patch.at_episode === 5);
  await p.click('#tvPickEp'); await settle(200);
  ok('and you type where you are up to', await ev(() => !!$('tvEpS') && !!$('tvEpE') && $('tvEpS').value === '3'));
  await clearWrites();
  await p.fill('#tvEpS', 'four'); await p.click('#tvEpGo'); await settle(150);
  ok('as numbers', /A season and an episode, as numbers/.test(await said()) && await ev(() => !!$('tvEpBox')));
  await p.fill('#tvEpS', '4'); await p.fill('#tvEpE', '1'); await p.click('#tvEpGo'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('which it keeps', up && where(up, 906) && up.patch.at_season === 4 && up.patch.at_episode === 1);
  await ev(() => openShow(905)); await settle(200);
  await p.click('#tvPickEp'); await settle(200);
  await clearWrites();
  await p.fill('#tvEpS', '1'); await p.fill('#tvEpE', '2'); await p.click('#tvEpGo'); await settle(300);
  up = (await writes('update', 'shows')).pop();
  ok('saying how far you are into one you wanted to watch moves it to Watching', up && up.patch.status === 'watching' && up.patch.at_episode === 2);
  tvmMode = 'down';
  await ev(() => { TV_EPS = {}; window.__rows.shows.find(x => x.id === 902).at_season = 1; window.__rows.shows.find(x => x.id === 902).at_episode = 3; return tvAfterChange(902); });
  await ev(() => { const w0 = console.warn; console.warn = () => {}; openShow(902); setTimeout(() => { console.warn = w0; }, 1500); }); await settle(500);
  prog = await text('#tvProg');
  ok('no signal: where you are still shows, going on one at a time', /Watched up to Season 1, episode 3/.test(prog) && /Next Season 1, episode 4/.test(prog), prog);
  await clearWrites();
  await ev(() => { const w0 = console.warn; console.warn = () => {}; window.__w0 = w0; });
  await p.click('#tvPickEp'); await settle(500);
  ok('and Choose says it could not reach TVmaze, and lets you type it', /Couldn’t reach TVmaze/.test(await said()) && await ev(() => !!$('tvEpS')));
  await ev(() => { console.warn = window.__w0; });
  tvmMode = 'ok';
  await closeAll();

  console.log('\nOne shared with you');
  await setRows();
  await ev(() => openShows()); await settle(200);
  await ev(() => openShow(903)); await settle(300);
  view = await text('#tvShow');
  ok('it says whose stars and notes they are', /Sandra’s stars/.test(view) && /Sandra’s notes Lovely mending/.test(view), view);
  ok('and who shared it', /Shared by Sandra/.test(view));
  ok('it cannot be changed or moved on, and has no How far you are', await ev(() => !$('tvEditBtn') && !document.querySelector('[data-tvdo]') && !$('tvProg')));
  ok('her own say is not listed as somebody else’s review', !/What others thought/i.test(view));
  ok('there is a box for what you thought', await ev(() => !!$('tvRevStars') && !!$('tvRevWords') && !!$('tvRevSave')));
  await clearWrites();
  await p.click('#tvRevSave'); await settle(200);
  ok('saving nothing asks for something first', /Tap some stars or write a few words first/.test(await said())
    && (await writes('upsert', 'show_reviews')).length === 0);
  await p.click('#tvRevStars [data-star="4"]');
  await p.fill('#tvRevWords', '  Better than the telly  ');
  await p.click('#tvRevSave'); await settle(300);
  const rv = (await writes('upsert', 'show_reviews')).pop();
  ok('it saves your review, one each', rv && rv.rows.show_id === 903 && rv.rows.user_id === 'me' && rv.rows.stars === 4
    && rv.rows.words === 'Better than the telly', JSON.stringify(rv));
  await ev(() => { window.__rows.show_reviews.push({ id: 30, show_id: 903, user_id: 'me', stars: 4, words: 'Better' }); });
  await ev(() => tvAfterChange(903)); await settle(200);
  ok('and shows it back to you', await ev(() => $('tvRevWords').value === 'Better'
    && document.querySelectorAll('#tvRevStars [aria-pressed="true"]').length === 4));
  await clearWrites();
  await p.click('#tvRevStars [data-star="4"]'); await p.fill('#tvRevWords', '');
  await p.click('#tvRevSave'); await settle(300);
  const rdel = (await writes('delete', 'show_reviews')).pop();
  ok('emptied, it is taken off', rdel && where(rdel, 30), JSON.stringify(rdel));
  await closeAll();

  console.log('\nThe little helpers');
  ok('running times read as hours and minutes', await ev(() => tvMins(103) === '1 hr 43 min' && tvMins(60) === '1 hr' && tvMins(45) === '45 min' && tvMins('') === ''));
  ok('a Wikipedia title loses its (film)', await ev(() => tvFilmTitle('Paddington (2014 film)') === 'Paddington'
    && tvFilmTitle('Up (2009 American film)') === 'Up' && tvFilmTitle('Paddington 2') === 'Paddington 2'));
  ok('a running time in hours is turned into minutes', await ev(async () => (await tvWikidata('Q2')).running_mins === 90));
  ok('a page’s HTML comes back as plain words, running nothing', await ev(() =>
    tvText('<p><b>Hi</b> &amp; <img src=x onerror="window.__bad=1">bye</p>') === 'Hi & bye' && !window.__bad));

  console.log('\nFinding a film');
  await setRows();
  await ev(() => openShows()); await settle(200);
  await ev(() => { window.__bd = window.BarcodeDetector; delete window.BarcodeDetector; });
  await p.click('#tvAdd'); await settle(200);
  ok('the + offers a film, a series or filling it in', await ev(() =>
    [...document.querySelectorAll('#tvAddBox [data-tvway]')].map(x => x.dataset.tvway).join() === 'film,series,hand'));
  await p.click('#tvAddNo');
  await ev(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13']; } async detect() { return []; } };
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { throw new Error('none'); } }, configurable: true }); });
  await p.click('#tvAdd'); await settle(200);
  ok('where the phone can read barcodes, scanning a DVD too', await ev(() => !!document.querySelector('#tvAddBox [data-tvway="scan"]')));
  ok('the menu offers it as well', await ev(() => areaItems('tv').some(x => x.label === 'Scan a DVD or Blu-ray')));
  await p.click('[data-tvway="film"]'); await settle(200);
  ok('Find a film asks for its name, with Film picked', await ev(() => !!$('tvFindQ')
    && document.querySelector('[data-tvfk="film"]').getAttribute('aria-pressed') === 'true'));
  await clearWrites();
  await p.click('#tvFindGo'); await settle(150);
  ok('an empty name asks for one', /Type its name first/.test(await said()));
  calls = [];
  await p.fill('#tvFindQ', 'Paddington 2'); await p.press('#tvFindQ', 'Enter');
  await p.waitForSelector('[data-tvhit]', { timeout: 10000 }).catch(() => {}); await settle(300);
  ok('it asks Wikipedia for films by that name', calls.some(c => /^wiki \/w\/api\.php Paddington 2 film$/.test(c)), calls.join(' ; '));
  const hits = await ev(() => [...document.querySelectorAll('[data-tvhit] .mid')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  ok('only films come back, not the soundtrack or an actor', hits.length === 2, JSON.stringify(hits));
  ok('each with its year and director, and (film) taken off the name', hits[0] === 'Paddington 2 2017 film by Paul King'
    && hits[1] === 'Paddington 2014 film by Paul King', JSON.stringify(hits));
  ok('with its little poster, or a clapperboard', await ev(() =>
    /upload\.wikimedia\.org\/thumb\/p2\.jpg$/.test(document.querySelector('[data-tvhit="0"] img').src)
    && !!document.querySelector('[data-tvhit="1"] .tvnopic')));
  calls = []; picsAsked = [];
  await clearWrites();
  await p.click('[data-tvhit="0"]');
  await edShown(); await settle(1500);
  ok('it fetches what Wikipedia says, then Wikidata', calls.includes('wiki /api/rest_v1/page/summary/Paddington_2 ')
    && calls.includes('wikidata claims Q1') && calls.some(c => /^wikidata labels /.test(c)), calls.join(' ; '));
  ok('the new film screen opens', await ev(() => $('tvEdTitle').textContent === 'New' && $('tvForm').dataset.kind === 'film'
    && document.querySelector('[data-tvkind="film"]').getAttribute('aria-pressed') === 'true'));
  const form = () => ev(() => { const f = $('tvForm').elements; const o = {};
    ['title', 'year', 'running_mins', 'seasons', 'director', 'genre', 'channel', 'actors', 'synopsis', 'barcode'].forEach(n => o[n] = f[n].value); return o; });
  let fm = await form();
  ok('with the title and what it is about', fm.title === 'Paddington 2' && fm.synopsis === 'Paddington the bear goes looking for a pop-up book.', JSON.stringify(fm));
  ok('the earliest year it came out, and its running time', fm.year === '2017' && fm.running_mins === '103', JSON.stringify(fm));
  ok('the director, and the actors in billing order (a withdrawn one left out)', fm.director === 'Paul King'
    && fm.actors === 'Hugh Grant, Brendan Gleeson, Sally Hawkins', JSON.stringify(fm));
  ok('the genre, without “film” after each', fm.genre === 'Comedy, Family', fm.genre);
  ok('where it was found is kept', await ev(() => TV_REF.wikidata_id === 'Q1' && TV_REF.tvmaze_id === null));
  ok('the poster is fetched safely (https)', picsAsked.includes('https://upload.wikimedia.org/posters/p2.jpg'), picsAsked.join(' ; '));
  let upl = (await writes('upload')).pop();
  ok('and goes in as the first photo, in your TV/Movies folder', upl && /^tv\/me\/[0-9a-f-]+\.jpg$/.test(upl.path)
    && await ev(() => DPH && DPH.box === 'tvPics' && DPH.photos.length === 1), JSON.stringify(upl));
  ok('it says it found it, with its poster', /Found it, with its poster/.test(await said()), await said());
  ok('a film has no seasons or how far you are', await ev(() =>
    getComputedStyle($('tvForm').elements.seasons.closest('label')).display === 'none'
    && getComputedStyle($('tvForm').elements.at_season.closest('.rcpnums')).display === 'none'));
  ok('a new one starts as Watched', await ev(() => document.querySelector('[data-tvstat="watched"]').getAttribute('aria-pressed') === 'true'));

  console.log('\nFilling it in');
  await p.click('#tvStarPick [data-star="5"]');
  await p.fill('#tvForm [name="notes"]', 'Best film ever');
  await ev(() => { const f = $('tvForm').elements; f.recommended_by.value = 'Dickie Deal'; f.recommended_by_id.value = '1'; });
  await p.click('[data-tvcopy="bluray"]');
  ok('tapping a kind of copy picks it', await ev(() => TV_COPY === 'bluray'));
  await p.click('#tvViewAdd'); await settle(200);
  ok('a new time watched starts with your copy as how', await ev(() => $('tvViewForm').elements.how.value === 'Blu-ray'));
  await p.fill('#tvViewForm [name="where"]', 'Home'); await p.fill('#tvViewForm [name="with"]', 'Sandra');
  await p.fill('#tvViewForm [name="cost"]', '3.49');
  await p.click('#tvViewGo'); await settle(200);
  ok('it is listed in the form', /Home · Blu-ray · with Sandra · £3\.49/.test(await text('#tvViews')), await text('#tvViews'));
  await p.click('[data-tvvch="0"]'); await settle(200);
  ok('Change opens it filled in', await ev(() => $('tvViewForm').elements.where.value === 'Home'));
  await p.fill('#tvViewForm [name="where"]', 'The boat'); await p.click('#tvViewGo'); await settle(200);
  await p.click('#tvViewAdd'); await settle(200); await p.click('#tvViewGo'); await settle(200);
  ok('another can be added', await ev(() => document.querySelectorAll('#tvViews .tvviewrow').length === 2));
  await p.click('[data-tvvx="1"]'); await settle(100);
  ok('and taken off again', await ev(() => document.querySelectorAll('#tvViews .tvviewrow').length === 1));
  await p.fill('#tvForm [name="barcode"]', '5 051892-212345');
  await p.fill('#tvForm [name="price"]', '£12.99');
  await ev(() => { const f = $('tvForm').elements; f.bought_from.value = 'HMV'; f.lent_to.value = 'Dickie Deal'; f.lent_to_id.value = '1'; });
  await p.click('#tvLinkAdd');
  await p.fill('.bklink [name="link_url"]', 'www.imdb.com/title/tt4468740');
  await p.fill('.bklink [name="link_quote"]', 'Funny');
  await p.click('#tvLinkAdd');   // a second, left empty, is ignored
  await p.check('#tvForm [name="share"][value="sandra"]');
  await clearWrites();
  await p.click('#tvSave'); await settle(600);
  let ins = (await writes('insert', 'shows')).pop();
  let r = ins && ins.rows;
  ok('it saves the film', !!r && r.title === 'Paddington 2' && r.kind === 'film' && r.created_by === 'me', JSON.stringify(r));
  ok('with what was found', r && r.year === 2017 && r.running_mins === 103 && r.director === 'Paul King' && r.genre === 'Comedy, Family'
    && r.wikidata_id === 'Q1' && r.tvmaze_id === null && r.seasons === null);
  ok('watched, five stars, your notes and who recommended it', r && r.status === 'watched' && r.stars === 5 && r.notes === 'Best film ever'
    && r.recommended_by === 'Dickie Deal' && r.recommended_by_id === 1);
  ok('the time you watched it', r && JSON.stringify(r.viewings) === JSON.stringify([{ on: today, where: 'The boat', how: 'Blu-ray', with: 'Sandra', cost: 3.49 }]), r && JSON.stringify(r.viewings));
  ok('a Blu-ray, its barcode without spaces, the price as a number', r && r.copy === 'bluray' && r.barcode === '5051892212345' && r.price === 12.99, JSON.stringify(r));
  ok('bought from a shop, lent to a contact, today if no day is given', r && r.bought_from === 'HMV' && r.bought_from_id === null
    && r.lent_to === 'Dickie Deal' && r.lent_to_id === 1 && r.lent_on === today);
  ok('the link made a proper web address, with its line', r && JSON.stringify(r.links) === '[{"url":"https://www.imdb.com/title/tt4468740","quote":"Funny"}]', r && JSON.stringify(r.links));
  ok('its poster, who it is shared with, and no series place for a film', r && r.photos.length === 1 && /^tv\/me\//.test(r.photos[0].path)
    && JSON.stringify(r.shared_with) === '["sandra"]' && r.at_season === null && r.at_episode === null);
  ok('the list moves to where it went, and the form closes', await ev(() => TV_LIST === 'watched') && !(await shown('tvEd')));
  await closeAll();

  console.log('\nFinding a series');
  await setRows(); await ev(() => { TV_EPS = {}; return openShows(); }); await settle(200);
  await ev(() => tvAskName('film')); await settle(200);
  await p.fill('#tvFindQ', 'Line of Duty');
  calls = [];
  await p.click('[data-tvfk="series"]');
  await p.waitForSelector('[data-tvhit]', { timeout: 10000 }).catch(() => {}); await settle(300);
  ok('switching to TV series looks again, on TVmaze', calls.some(c => /^tvmaze \/search\/shows\?q=Line(%20|\+)of(%20|\+)Duty$/.test(c))
    && await ev(() => document.querySelector('[data-tvfk="series"]').getAttribute('aria-pressed') === 'true'), calls.join(' ; '));
  const shits = await ev(() => [...document.querySelectorAll('[data-tvhit] .mid')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  ok('each with the year it started and its channel', shits[0] === 'Line of Duty TV series · 2012 · BBC One'
    && shits[1] === 'Line of Duty (NZ) TV series · 2020 · Netflix', JSON.stringify(shits));
  calls = []; picsAsked = [];
  await clearWrites();
  await p.click('[data-tvhit="0"]');
  await edShown(); await settle(1500);
  ok('it fetches the series with its cast and episodes in one go', calls.some(c => /^tvmaze \/shows\/353\?embed/.test(c)), calls.join(' ; '));
  fm = await form();
  ok('the new screen is for a series', await ev(() => $('tvForm').dataset.kind === 'series'
    && getComputedStyle($('tvForm').elements.seasons.closest('label')).display !== 'none'));
  ok('title, year it started, episode length and seasons', fm.title === 'Line of Duty' && fm.year === '2012' && fm.running_mins === '60' && fm.seasons === '2', JSON.stringify(fm));
  ok('genre and channel', fm.genre === 'Drama, Crime' && fm.channel === 'BBC One', JSON.stringify(fm));
  ok('the actors, each once', fm.actors === 'Adrian Dunbar, Vicky McClure', fm.actors);
  ok('what it is about, as plain words', fm.synopsis === 'Line of Duty follows AC-12 & the bent coppers.', fm.synopsis);
  ok('TVmaze’s number is kept, and the episodes with it', await ev(() => TV_REF.tvmaze_id === 353 && TV_EPS[353].length === 5));
  ok('its poster', picsAsked.includes('https://static.tvmaze.com/o353.jpg') && (await writes('upload')).length === 1, picsAsked.join(' ; '));
  await p.click('[data-tvstat="watching"]');
  await p.fill('#tvForm [name="at_season"]', '1'); await p.fill('#tvForm [name="at_episode"]', '2');
  await clearWrites();
  await p.click('#tvSave'); await settle(600);
  r = ((await writes('insert', 'shows')).pop() || {}).rows;
  ok('it saves the series, with how far you are', r && r.kind === 'series' && r.status === 'watching' && r.seasons === 2
    && r.tvmaze_id === 353 && r.at_season === 1 && r.at_episode === 2 && r.channel === 'BBC One' && r.director === null, JSON.stringify(r));
  ok('and Watching is the list shown', await ev(() => TV_LIST === 'watching'));
  await closeAll();

  console.log('\nNot found, no poster, and no signal');
  await setRows(); await ev(() => openShows()); await settle(200);
  await ev(() => tvAskName('film')); await settle(150);
  await p.fill('#tvFindQ', 'Nothing at all'); await p.click('#tvFindGo'); await settle(500);
  ok('nothing found says so, and what to try', /Nothing found as a film with that name/.test(await text('#tvFindOut'))
    && /look for it as a TV series/.test(await text('#tvFindOut')));
  await p.click('[data-tvfk="series"]'); await settle(500);
  ok('and the same for a series', /Nothing found as a TV series with that name/.test(await text('#tvFindOut')));
  await p.click('#tvFindHand'); await settle(300);
  ok('Fill it in myself carries the name and the kind across', await shown('tvEd') && await ev(() =>
    $('tvForm').elements.title.value === 'Nothing at all' && $('tvForm').dataset.kind === 'series'));
  await ev(() => $('tvEdCancel').click()); await settle(200);
  tvmMode = 'down';
  await ev(() => { window.__w0 = console.warn; console.warn = () => {}; tvAskName('series'); }); await settle(150);
  await p.fill('#tvFindQ', 'Line of Duty'); await p.click('#tvFindGo'); await settle(500);
  ok('no signal says so, and that nothing is lost', /Couldn’t reach TVmaze just now/.test(await text('#tvFindOut')) && await ev(() => !!$('tvFindBox')));
  tvmMode = 'ok';
  await p.click('#tvFindNo'); await settle(100);
  wikiMode = 'nosummary';
  await clearWrites();
  await ev(() => tvAskName('film')); await settle(150);
  await p.fill('#tvFindQ', 'Paddington 2'); await p.click('#tvFindGo');
  await p.waitForSelector('[data-tvhit]', { timeout: 10000 }).catch(() => {}); await settle(200);
  await p.click('[data-tvhit="0"]'); await edShown(); await settle(400);
  ok('when the details will not come, the form opens with the name to fill in the rest', await ev(() =>
    $('tvForm').elements.title.value === 'Paddington 2' && $('tvForm').elements.director.value === '')
    && /Couldn’t fetch the rest/.test(await said()) && (await writes('upload')).length === 0);
  await ev(() => $('tvEdCancel').click()); await settle(200);
  wikiMode = 'ok'; picMode = 'none'; wdMode = 'down';
  await clearWrites();
  await ev(() => tvAskName('film')); await settle(150);
  await p.fill('#tvFindQ', 'Paddington 2'); await p.click('#tvFindGo');
  await p.waitForSelector('[data-tvhit]', { timeout: 10000 }).catch(() => {}); await settle(200);
  await p.click('[data-tvhit="0"]'); await edShown(); await settle(600);
  ok('no Wikidata: Wikipedia’s words and the year are still filled in', await ev(() =>
    $('tvForm').elements.synopsis.value.startsWith('Paddington the bear') && $('tvForm').elements.year.value === '2017'
    && $('tvForm').elements.director.value === ''));
  ok('no poster: it says to add a photo', /Found it: add a photo of the poster/.test(await said()) && (await writes('upload')).length === 0, await said());
  await ev(() => { $('tvEdCancel').click(); console.warn = window.__w0; }); await settle(200);
  picMode = 'ok'; wdMode = 'ok';
  await closeAll();

  console.log('\nWhat it will not save');
  const refuse = async (fill, want, kind) => {
    await ev(kind => openShowEd(null, { kind }), kind || 'film'); await settle(150);
    await ev(fill); await clearWrites();
    await p.click('#tvSave'); await settle(200);
    return new RegExp(want).test(await said()) && (await writes('insert', 'shows')).length === 0;
  };
  ok('no title', await refuse(() => {}, 'Give it a title'));
  ok('a year that is not a year', await refuse(() => { const f = $('tvForm').elements; f.title.value = 'X'; f.year.value = '17th'; }, 'The year needs to be like 2017'));
  ok('a running time that is not minutes', await refuse(() => { const f = $('tvForm').elements; f.title.value = 'X'; f.running_mins.value = '1h30'; }, 'running time is in minutes'));
  ok('a season with no episode', await refuse(() => { const f = $('tvForm').elements; f.title.value = 'X'; f.at_season.value = '2'; },
    'Give both the season and the episode', 'series'));
  ok('a price that is not a number', await refuse(() => { const f = $('tvForm').elements; f.title.value = 'X'; f.price.value = 'ten pounds'; }, 'price needs to be a number'));
  ok('a barcode that is not numbers', await refuse(() => { const f = $('tvForm').elements; f.title.value = 'X'; f.barcode.value = 'ABC123'; }, 'A barcode is the numbers'));
  ok('a link that is not a web address', await refuse(() => { const f = $('tvForm').elements; f.title.value = 'X';
    $('tvLinkAdd').click(); document.querySelector('.bklink [name="link_url"]').value = 'not a link'; }, 'isn’t a web address'));
  await ev(() => $('tvEdCancel').click()); await settle(200);
  ok('Cancel puts away a photo added but not saved', await ev(() => DPH === null));
  await ev(() => openShowEd(null, { kind: 'film' })); await settle(150);
  const notSet = await ev(async () => {
    const real = sb.from, e0 = console.error; console.error = () => {};
    sb.from = t => t === 'shows' ? { insert: () => ({ select: () => ({ single: () =>
      Promise.resolve({ data: null, error: { message: 'relation "public.shows" does not exist' } }) }) }) } : real(t);
    $('tvForm').elements.title.value = 'X';
    window.__said = []; await saveShow(); sb.from = real; console.error = e0;
    return window.__said.join(' | ') + (document.getElementById('tvEd').classList.contains('hidden') ? ' CLOSED' : ' OPEN');
  });
  ok('before step 63 saving says to run it, and keeps the form', /needs step 63 run in Supabase first/.test(notSet) && /OPEN$/.test(notSet), notSet);
  await ev(() => $('tvEdCancel').click()); await settle(200);
  await closeAll();

  console.log('\nThe barcode');
  await setRows(); await ev(() => openShows()); await settle(200);
  await clearWrites();
  await ev(() => tvByBarcode('5051892212345')); await settle(300);
  ok('a disc you have already opens that one', await shown('tvShow') && await ev(() => TV_VIEW === 901) && /You have this one already/.test(await said()));
  await closeAll(); await ev(() => openShows()); await settle(200);
  await ev(() => tvByBarcode('5012345678900')); await settle(200);
  ok('a new one keeps the barcode while you find the film', /Barcode 5012345678900 kept/.test(await text('#tvFindBox')));
  await p.fill('#tvFindQ', 'Some film'); await p.click('#tvFindHand'); await settle(300);
  ok('and it goes in the form', await ev(() => $('tvForm').elements.barcode.value === '5012345678900' && $('tvForm').elements.title.value === 'Some film'));
  await ev(() => $('tvEdCancel').click()); await settle(200);
  await closeAll();
  await ev(() => {
    window.__codes = [];
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13', 'upc_a', 'qr_code']; }
      constructor(o) { window.__bdFormats = o && o.formats; } async detect() { return window.__codes; } };
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d'); setInterval(() => { g.fillStyle = '#' + Math.floor(Math.random() * 4096).toString(16).padStart(3, '0'); g.fillRect(0, 0, 64, 64); }, 50);
    window.__stream = null;
    const md = { getUserMedia: async (want) => { window.__camWant = want; window.__stream = c.captureStream(10); return window.__stream; } };
    Object.defineProperty(navigator, 'mediaDevices', { value: md, configurable: true });
  });
  await setRows(); await ev(() => openShows()); await settle(200);
  await ev(() => { tvScan(tvByBarcode); }); await settle(800);
  ok('Scan opens the back camera, over everything', await ev(() => !!$('tvScan') && window.__camWant.video.facingMode === 'environment'
    && getComputedStyle($('tvScan')).zIndex === '100'));
  ok('and looks only for the barcodes on boxes', await ev(() => JSON.stringify(window.__bdFormats) === '["ean_13","upc_a"]'));
  await clearWrites();
  await ev(() => { window.__codes = [{ rawValue: '5051892212345' }]; }); await settle(800);
  ok('reading one closes the camera', await ev(() => !$('tvScan')
    && window.__stream.getTracks().every(t => t.readyState === 'ended') && BK_SCAN_STOP === null));
  ok('and opens that disc', await shown('tvShow') && await ev(() => TV_VIEW === 901));
  await closeAll();
  await ev(() => { window.__codes = []; openShowEd(null, { kind: 'film' }); }); await settle(200);
  await p.click('#tvBarScan'); await settle(500);
  await ev(() => { window.__codes = [{ rawValue: '5099999999999' }]; }); await settle(800);
  ok('Scan in the form fills in the barcode', await ev(() => !$('tvScan') && $('tvForm').elements.barcode.value === '5099999999999'));
  await ev(() => $('tvEdCancel').click()); await settle(200);
  await ev(() => { window.__codes = []; openShows(); tvScan(tvByBarcode); }); await settle(600);
  await ev(() => AREA_SHUT.tv()); await settle(100);
  ok('leaving TV/Movies stops the camera', await ev(() => !$('tvScan') && window.__stream.getTracks().every(t => t.readyState === 'ended')));
  await ev(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['qr_code']; } }; window.__said = []; return tvScan(tvByBarcode); }); await settle(200);
  ok('a phone that cannot read them says to type it in', /can’t read barcodes/.test(await said()) && await ev(() => !$('tvScan')));
  await ev(() => { window.BarcodeDetector = class { static async getSupportedFormats() { return ['ean_13']; } async detect() { return []; } };
    navigator.mediaDevices.getUserMedia = async () => { const e = new Error('no'); e.name = 'NotAllowedError'; throw e; };
    window.__said = []; return tvScan(tvByBarcode); }); await settle(200);
  ok('a camera not allowed says so', /camera wasn’t allowed/.test(await said()));
  await closeAll();
  await ev(() => { if (window.__bd) window.BarcodeDetector = window.__bd; else delete window.BarcodeDetector; });

  console.log('\nChanging and deleting');
  await setRows(); await ev(() => openShows()); await settle(200);
  await ev(() => openShow(901)); await settle(200);
  await p.click('#tvEditBtn'); await settle(300);
  ok('Edit opens it filled in', await shown('tvEd') && await ev(() => {
    const f = $('tvForm').elements;
    return $('tvEdTitle').textContent === 'Change' && f.title.value === 'Paddington 2' && f.lent_to.value === 'Dickie Deal'
      && f.recommended_by.value === 'Dickie Deal' && f.barcode.value === '5051892212345'
      && document.querySelectorAll('.bklink').length === 1 && DPH.photos.length === 2
      && document.querySelectorAll('#tvViews .tvviewrow').length === 2
      && document.querySelectorAll('#tvStarPick [aria-pressed="true"]').length === 5
      && document.querySelector('[data-tvcopy="dvd"]').getAttribute('aria-pressed') === 'true'
      && document.querySelector('#tvForm [name="share"][value="sandra"]').checked; }));
  await p.click('[data-tvcopy="dvd"]');
  ok('tapping the copy again clears it', await ev(() => !document.querySelector('#tvCopy [aria-pressed="true"]')));
  await clearWrites();
  await p.click('#tvSave'); await settle(400);
  up = (await writes('update', 'shows')).pop();
  ok('saving changes that one, keeping what it had', up && where(up, 901)
    && up.patch.copy === null && up.patch.stars === 5 && up.patch.lent_on === '2026-11-10' && up.patch.viewings.length === 2
    && up.patch.links.length === 1 && up.patch.photos.length === 2 && !('created_by' in up.patch), JSON.stringify(up && up.patch));
  ok('and goes back to it', await shown('tvShow') && !(await shown('tvEd')));
  await ev(() => openShowEd(SHOWS.find(x => x.id === 901))); await settle(200);
  await clearWrites();
  await p.click('#tvDelete'); await settle(400);
  ok('Delete removes it', (await writes('delete', 'shows')).some(w => where(w, 901)));
  const rm = (await writes('rmfile')).pop();
  ok('and your photos with it', rm && rm.paths.includes('tv/me/p1.jpg') && rm.paths.includes('tv/me/p2.jpg'), JSON.stringify(rm));
  ok('and closes its screens', !(await shown('tvEd')) && !(await shown('tvShow')));
  await closeAll();

  console.log('\nAn empty list gives way');
  await ev(() => { window.__rows.shows = window.__rows.shows.filter(x => x.status === 'want'); TV_LIST = 'watched'; });
  await ev(() => openShows()); await settle(200);
  ok('opening with nothing Watched shows Want to watch', await ev(() => TV_LIST === 'want'));
  await p.click('[data-tvlist="watched"]'); await settle(150);
  ok('but an empty list can still be looked at', await ev(() => TV_LIST === 'watched') && /None here yet/.test(await text('#tvList')));
  await p.click('[data-tvlist="shelf"]'); await settle(150);
  ok('an empty shelf says how to fill it', /No DVDs or Blu-rays yet/.test(await text('#tvList')));
  await ev(() => { window.__rows.shows = []; }); await ev(() => openShows()); await settle(200);
  ok('nothing at all says how to add one', /Nothing here yet. Press the red \+/.test(await text('#tvList')));
  await closeAll();

  console.log('\nFetching again, and the screen it is');
  await setRows(); await ev(() => { TV_LIST = 'watched'; return openShows(); }); await settle(200);
  ok('the app knows it is in TV/Movies', await ev(() => currentScreen() === 'tv'));
  await ev(() => { window.__rows.shows.push({ id: 909, created_by: 'me', title: 'Jaws', kind: 'film', status: 'watched', stars: 5,
    links: [], photos: [], viewings: [], shared_with: [] }); });
  await ev(() => refreshAll()); await settle(600);
  ok('Refresh brings in a new one', /Jaws/.test(await text('#tvList')));
  await ev(() => openShow(902)); await settle(200);
  ok('and the app knows one is open', await ev(() => currentScreen() === 'tv'));
  await ev(() => backHome('tv')); await settle(200);
  ok('the home button puts all three screens away', !(await shown('tv')) && !(await shown('tvShow')) && !(await shown('tvEd')));

  console.log('\nNarrow phones');
  for (const w of [320, 360]) {
    await p.setViewportSize({ width: w, height: 760 });
    await setRows(); await ev(() => { TV_LIST = 'watched'; return openShows(); }); await settle(250);
    const over = async id => ev(id => { const e = $(id); return e.scrollWidth - e.clientWidth; }, id);
    ok(`the list fits at ${w}`, await over('tvBody') <= 0 && await ev(() => document.documentElement.scrollWidth <= innerWidth));
    await ev(() => openShow(901)); await settle(200);
    ok(`one film fits at ${w}`, await over('tvShowBody') <= 0);
    await ev(() => openShow(902)); await settle(300);
    ok(`a series with how far you are fits at ${w}`, await over('tvShowBody') <= 0);
    await ev(() => openShowEd(SHOWS.find(x => x.id === 901))); await settle(200);
    await ev(() => $('tvLinkAdd').click());
    ok(`the form fits at ${w}`, await over('tvEdBody') <= 0, String(await over('tvEdBody')));
    ok(`the copy buttons and stars sit tidily at ${w}`, await ev(() => {
      const s = [...document.querySelectorAll('#tvStarPick button')].map(x => x.getBoundingClientRect().top);
      const c = [...document.querySelectorAll('#tvCopy button')].map(x => x.getBoundingClientRect().right);
      return Math.max(...s) - Math.min(...s) < 2 && Math.max(...c) <= innerWidth; }));
    await ev(() => $('tvEdCancel').click()); await settle(150);
    await ev(() => tvAskName('film')); await settle(150);
    await p.fill('#tvFindQ', 'Paddington 2'); await p.click('#tvFindGo');
    await p.waitForSelector('[data-tvhit]', { timeout: 10000 }).catch(() => {}); await settle(200);
    ok(`the find box fits at ${w}`, await ev(() => { const i = document.querySelector('#tvFindBox .inner');
      const q = $('tvFindQ').getBoundingClientRect(), g = $('tvFindGo').getBoundingClientRect(), box = i.getBoundingClientRect();
      return i.scrollWidth <= i.clientWidth && g.right <= box.right && Math.abs(q.top - g.top) < 8; }));
    await ev(() => document.querySelector('#tvFindNo').click());
    await ev(() => openShow(903)); await settle(200);
    ok(`your review box fits at ${w}`, await over('tvShowBody') <= 0);
    await closeAll();
  }
  await p.setViewportSize({ width: 390, height: 844 });

  console.log('\nThe version');
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const vt = vj.history.find(h => h.version === '2026.11.16.6');
  ok('the app and version.json agree', await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version, vj.version);
  ok('What’s new mentions TV/Movies', !!vt && vt.changes.length > 0 && vt.changes.every(c => /^TV\/Movies: /.test(c) && c.length < 160));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
