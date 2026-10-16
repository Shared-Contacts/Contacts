// Today: a Bluesky photo at the top, from the name each person chooses.
// Bluesky itself is stood in for here, so these run with no signal.
const { chromium } = require('playwright');
const path = require('path');

const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

// A small grey square, so the picture really loads.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8v379fwAJcAPZx0cKRAAAAABJRU5ErkJggg==', 'base64');
const FEED = {
  feed: [
    { post: { uri:'at://did:plc:abc/app.bsky.feed.post/rpt', author:{handle:'other.bsky.social'},
        record:{text:'Somebody else, reposted', createdAt:'2026-10-16T09:00:00Z'},
        embed:{ $type:'app.bsky.embed.images#view',
          images:[{thumb:'https://cdn.bsky.app/img/other.jpg', alt:'not this'}] } },
      reason:{ $type:'app.bsky.feed.defs#reasonRepost' } },
    { post: { uri:'at://did:plc:me/app.bsky.feed.post/3kabc', author:{handle:'boat.bsky.social'},
        record:{text:'Moored up at <Braunston> tonight', createdAt:'2026-10-15T18:00:00Z'},
        embed:{ $type:'app.bsky.embed.images#view',
          images:[{thumb:'https://cdn.bsky.app/img/mine.jpg',
                   fullsize:'https://cdn.bsky.app/img/mine-big.jpg', alt:'Boat at dusk'}] } } },
  ]
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport:{ width:360, height:740 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));

  let mode = 'ok', asked = [];
  await page.route('https://public.api.bsky.app/**', async r => {
    asked.push(r.request().url());
    if (mode === 'down') return r.abort();
    if (mode === 'empty') return r.fulfill({ status:200, contentType:'application/json', body:'{"feed":[]}' });
    if (mode === 'error') return r.fulfill({ status:500, body:'no' });
    return r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(FEED) });
  });
  await page.route('https://cdn.bsky.app/**', r =>
    mode === 'nopic' ? r.abort() : r.fulfill({ status:200, contentType:'image/png', body:PNG }));

  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);
  const settle = () => page.waitForTimeout(500);
  const open = () => page.evaluate(() => { shutBrief(); BSKY = {}; openBrief(); });

  // ---------------------------------------------------------------
  console.log('\nTidying the name people type');
  const names = await page.evaluate(() => [
    bskyClean('@SomeOne.bsky.social '),
    bskyClean('https://bsky.app/profile/boat.bsky.social'),
    bskyClean('https://bsky.app/profile/boat.bsky.social/post/3kabc'),
    bskyClean('did:plc:abc123'),
    bskyClean('just words'),
    bskyClean('')
  ]);
  ok('the @ and capitals come off', names[0] === 'someone.bsky.social', names[0]);
  ok('a pasted profile link is understood', names[1] === 'boat.bsky.social', names[1]);
  ok('and so is a link to one of their posts', names[2] === 'boat.bsky.social', names[2]);
  ok('the long did: form is allowed', names[3] === 'did:plc:abc123');
  ok('words that are not a name are refused', names[4] === '');
  ok('and empty stays empty', names[5] === '');

  // ---------------------------------------------------------------
  console.log('\nNobody has chosen one');
  await page.evaluate(() => { BSKY_HANDLE = ''; });
  asked = [];
  await open(); await settle();
  ok('no photo and no gap', (await page.$$('#briefPhoto')).length === 0);
  ok('and Bluesky is not asked at all', asked.length === 0);
  ok('the greeting is still the first thing',
     await page.evaluate(() => $('briefBody').firstElementChild.id === 'briefHello'));

  // ---------------------------------------------------------------
  console.log('\nA name chosen, Bluesky answers');
  await page.evaluate(() => { localStorage.removeItem('bskyphoto'); BSKY_HANDLE = 'boat.bsky.social'; });
  mode = 'ok'; asked = [];
  await open(); await settle();
  const shown = await page.evaluate(() => {
    const a = document.querySelector('#briefPhoto .bsky');
    const im = a && a.querySelector('img');
    return a && { href:a.getAttribute('href'), target:a.target, src:im.getAttribute('src'),
      alt:im.alt, text:a.querySelector('.bskytext').textContent,
      html:a.querySelector('.bskytext').innerHTML, who:a.querySelector('small').textContent,
      loaded: im.complete && im.naturalWidth > 0,
      top: $('briefHello').nextElementSibling === document.querySelector('#briefPhoto') };
  });
  ok('the photo is there', !!shown);
  ok('it sits just under the greeting', shown && shown.top);
  ok('their own post, not the one they reposted',
     shown && shown.src === 'https://cdn.bsky.app/img/mine.jpg', shown && shown.src);
  ok('and the picture loads', shown && shown.loaded);
  ok('it carries the description for a screen reader', shown && shown.alt === 'Boat at dusk');
  ok('the words of the post are under it',
     shown && shown.text === 'Moored up at <Braunston> tonight', shown && shown.text);
  ok('and they are shown as words, not run as page code',
     shown && shown.html.includes('&lt;Braunston&gt;'));
  ok('a tap opens the post on Bluesky',
     shown && shown.href === 'https://bsky.app/profile/boat.bsky.social/post/3kabc', shown && shown.href);
  ok('in a new window, so the app stays put', shown && shown.target === '_blank');
  ok('it says whose it is and when', shown && /@boat\.bsky\.social/.test(shown.who)
     && /15 Oct/.test(shown.who), shown && shown.who);
  ok('only photo posts are asked for', asked.length === 1 && /filter=posts_with_media/.test(asked[0])
     && /actor=boat\.bsky\.social/.test(asked[0]), asked.join(' '));

  console.log('\nIt fits a small phone');
  const fit = await page.evaluate(() => {
    const p = document.querySelector('#briefPhoto .bsky');
    const r = p.getBoundingClientRect(), im = p.querySelector('img').getBoundingClientRect();
    return { right:r.right, width:innerWidth, imgH:im.height, h:innerHeight,
      wide: document.documentElement.scrollWidth <= innerWidth };
  });
  ok('nothing runs off the side at 360', fit.right <= fit.width && fit.wide, JSON.stringify(fit));
  ok('the picture leaves room for the birthdays', fit.imgH <= fit.h * 0.35, JSON.stringify(fit));

  console.log('\nA tall photo is shown whole');
  const tall = await page.evaluate(async () => {
    const im = document.querySelector('#briefPhoto .bsky img');
    const c = document.createElement('canvas'); c.width = 300; c.height = 600;
    im.src = c.toDataURL();
    await new Promise(r => setTimeout(r, 300));
    const r = im.getBoundingClientRect();
    return { fit: getComputedStyle(im).objectFit, w:r.width, h:r.height, h35: innerHeight * 0.35,
      full: r.width >= document.querySelector('#briefPhoto .bsky').clientWidth - 1 };
  });
  ok('it is shrunk to fit rather than cropped', tall.fit === 'contain', tall.fit);
  ok('to the same height limit as a wide one', tall.h <= tall.h35, JSON.stringify(tall));
  ok('and the box still spans the card', tall.full, JSON.stringify(tall));
  await open(); await settle();

  console.log('\nRedrawing does not ask again');
  asked = [];
  await page.evaluate(() => renderBrief()); await settle();
  ok('Show the whole week and the like do not fetch it again', asked.length === 0);
  ok('and the photo is still there', (await page.$$('#briefPhoto .bsky')).length === 1);

  // ---------------------------------------------------------------
  console.log('\nBluesky cannot be reached');
  mode = 'down';
  await page.evaluate(() => localStorage.removeItem('bskyphoto'));
  await open(); await settle();
  const down = await page.evaluate(() => ({
    note: (document.querySelector('#briefPhoto .bskynote')||{}).textContent || '',
    again: !!document.querySelector('#briefPhoto [data-bskyagain]'),
    pic: !!document.querySelector('#briefPhoto .bsky') }));
  ok('it says the photo did not load', /did not load/.test(down.note), down.note);
  ok('with a Try again', down.again);
  ok('rather than an empty box', !down.pic);
  mode = 'ok';
  await page.click('#briefPhoto [data-bskyagain]'); await settle();
  ok('Try again brings it in once Bluesky is back',
     (await page.$$('#briefPhoto .bsky')).length === 1);

  console.log('\nA poor signal after a good one');
  mode = 'error';
  await open(); await settle();
  const kept = await page.evaluate(() => ({
    pic: !!document.querySelector('#briefPhoto .bsky img'),
    note: (document.querySelector('#briefPhoto .bskynote')||{}).textContent || '' }));
  ok('the last good photo is still shown', kept.pic);
  ok('with a note that it could not get a newer one', /newer/.test(kept.note), kept.note);

  console.log('\nThe picture itself will not load');
  mode = 'nopic';
  await page.evaluate(() => localStorage.removeItem('bskyphoto'));
  await page.route('https://public.api.bsky.app/**', r => r.fulfill({ status:200,
    contentType:'application/json', body:JSON.stringify(FEED) }));
  await open(); await page.waitForTimeout(900);
  const broke = await page.evaluate(() => ({
    pic: !!document.querySelector('#briefPhoto .bsky'),
    note: (document.querySelector('#briefPhoto .bskynote')||{}).textContent || '' }));
  ok('no broken-picture box', !broke.pic);
  ok('it says so instead', /picture did not load/.test(broke.note), broke.note);

  console.log('\nTheir account has no photo posts');
  await page.unroute('https://public.api.bsky.app/**');
  await page.route('https://public.api.bsky.app/**', r =>
    r.fulfill({ status:200, contentType:'application/json', body:'{"feed":[]}' }));
  await page.evaluate(() => localStorage.removeItem('bskyphoto'));
  await open(); await settle();
  const none = await page.evaluate(() =>
    (document.querySelector('#briefPhoto .bskynote')||{}).textContent || '');
  ok('it says there are none yet, so it does not look broken', /No photo posts/.test(none), none);

  // ---------------------------------------------------------------
  console.log('\nThe name lives in Settings › Home screen');
  await page.evaluate(async () => {
    shutBrief();
    openSettings('Home screen');
    await new Promise(r => setTimeout(r, 400));
    document.querySelectorAll('.card.logsec').forEach(d => d.open = true);
  });
  await page.waitForTimeout(300);
  ok('there is a box for it', (await page.$$('#bskyName')).length === 1);
  ok('showing the name already chosen',
     (await page.inputValue('#bskyName')) === 'boat.bsky.social');
  const save = async v => page.evaluate(async v => {
    window.__writes.length = 0;
    $('bskyName').value = v; $('bskySave').click();
    await new Promise(r => setTimeout(r, 400));
    const w = window.__writes.filter(x => x.table === 'profiles').pop();
    return { h: BSKY_HANDLE, box: $('bskyName').value, blob: w && w.patch.home_tiles };
  }, v);
  let s = await save('@SomeOne.bsky.social');
  ok('saving tidies it and keeps it', s.h === 'someone.bsky.social'
     && s.box === 'someone.bsky.social', JSON.stringify(s));
  ok('with the rest of the home screen, so no database change is needed',
     s.blob && s.blob.bsky === 'someone.bsky.social'
     && Array.isArray(s.blob.tiles) && 'brief' in s.blob, JSON.stringify(s.blob));
  s = await save('just words');
  ok('nonsense is refused and nothing is saved',
     s.h === 'someone.bsky.social' && !s.blob, JSON.stringify(s));
  s = await save('');
  ok('emptying the box turns the photo off', s.h === '' && s.blob && s.blob.bsky === '');

  console.log('\nIt comes back next time');
  ok('a saved name is read back', await page.evaluate(() => {
    MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[], bsky:'boat.bsky.social' };
    loadTiles(); return BSKY_HANDLE === 'boat.bsky.social';
  }));
  ok('and somebody who never set one has none', await page.evaluate(() => {
    MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[] };
    loadTiles(); return BSKY_HANDLE === '';
  }));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
