// 19 Nov 2026 (version 2026.11.19.3):
//   ML307  MY Slideshow. A tile playing photos at random, full screen, all
//          upright or all sideways. Slideshows of your own keep their photos
//          on the phone or computer only (the browser's own store, nothing in
//          Supabase); your Bluesky photo posts are a ready-made one. No sound
//          of its own: music plays from your own app behind it.
// Pretend pictures (plain coloured squares and oblongs) and a pretend
// Bluesky; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED|Slideshow store|ERR_FAILED/i;   // ERR_FAILED: Bluesky cut off, on purpose

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const answers = [];
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(answers.length ? answers.shift() : '') : d.accept());

  // A pretend Bluesky: two pages of posts, and the pictures in them.
  const feeds = []; let bskyDown = false;
  await p.route(/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getAuthorFeed/, route => {
    const u = new URL(route.request().url()); feeds.push(u.searchParams);
    if (bskyDown) return route.abort();
    const post = (n, imgs, extra = {}) => ({ post: { uri: 'at://did:plc:x/app.bsky.feed.post/' + n,
      author: { handle: 'pretend.bsky.social' }, record: { text: 'Post ' + n, createdAt: '2026-11-01T10:00:00Z' },
      embed: { $type: 'app.bsky.embed.images#view', images: imgs } }, ...extra });
    const img = (n, ar) => ({ fullsize: 'https://cdn.example/' + n + '.png', thumb: 'https://cdn.example/t' + n + '.png',
      alt: 'Picture ' + n, ...(ar ? { aspectRatio: ar } : {}) });
    const body = !u.searchParams.get('cursor')
      ? { cursor: 'page2', feed: [post(1, [img('wide1', { width: 1500, height: 1000 }), img('tall1', { width: 1000, height: 1500 })]),
          post(2, [img('wide2', { width: 1600, height: 900 })], { reason: { $type: 'app.bsky.feed.defs#reasonRepost' } }),
          { post: { uri: 'at://did:plc:x/app.bsky.feed.post/3', embed: { $type: 'app.bsky.embed.video#view', thumbnail: 'https://cdn.example/v.png' } } }] }
      : { feed: [post(4, [img('mystery', null)])] };
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  let pics = {};
  await p.route(/cdn\.example\//, route => {
    const n = route.request().url().split('/').pop().replace('.png', '');
    route.fulfill({ contentType: 'image/png', body: pics[n] || pics.wide1 });
  });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  await ev(() => { window.__said = []; const t = toast; toast = s => { window.__said.push(s); t(s); }; });
  const said = () => ev(() => window.__said.join(' | '));
  const png = async (w, h, c) => Buffer.from(await ev(([w, h, c]) => { const cv = document.createElement('canvas');
    cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h);
    return cv.toDataURL('image/png').split(',')[1]; }, [w, h, c]), 'base64');
  pics = { wide1: await png(300, 200, '#36c'), tall1: await png(200, 300, '#c63'), mystery: await png(200, 320, '#3c6') };
  const files = {
    tall: { name: 'lock.png', mimeType: 'image/png', buffer: await png(600, 900, '#246') },
    wide: { name: 'towpath.png', mimeType: 'image/png', buffer: await png(1200, 800, '#462') },
    big: { name: 'tunnel.png', mimeType: 'image/png', buffer: await png(4000, 3000, '#642') },
    square: { name: 'swan.png', mimeType: 'image/png', buffer: await png(500, 500, '#999') },
    broken: { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a picture at all') },
    words: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } };
  // The phone's own Keep the screen on and Turn the screen, noted rather than done.
  await ev(() => { window.__wake = 0; window.__rel = 0; window.__locks = []; window.__unlock = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wake++;
      return { release() { window.__rel++; }, addEventListener() {} }; } } });
    Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async o => { window.__locks.push(o); } });
    Object.defineProperty(screen.orientation, 'unlock', { configurable: true, value: () => { window.__unlock++; } }); });

  // ---------------------------------------------------------------
  console.log('\nThe tile');
  ok('a Slideshow tile that opens the Slideshow', await ev(() => TILE_DEST.sld && TILE_DEST.sld.label === 'Slideshow'
    && TILE_DEST.sld.go === openSlides));
  ok('  after the Timeline, with Settings still last', await ev(() =>
    TILE_DEFAULTS.indexOf('sld') === TILE_DEFAULTS.indexOf('tml') + 1 && TILE_DEFAULTS[TILE_DEFAULTS.length - 1] === 'settings'));
  ok('  its own colour from the set, worn by both its screens', await ev(() => TILE_COLOURS.includes(TILE_DEFAULT_COLOUR.sld)
    && TILE_DEFAULT_COLOUR.sld !== TILE_DEFAULT_COLOUR.tml && TILE_SKIN.sld.join() === 'sld,sldTheme'));
  ok('it joins a home screen already arranged, unless you took it off', await ev(() => {
    const was = MY_PROFILE;
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: [] } }; loadTiles();
    const joined = TILES.some(t => t.dest === 'sld');
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: ['sld'] } }; loadTiles();
    const kept = !TILES.some(t => t.dest === 'sld');
    MY_PROFILE = was; loadTiles(); return joined && kept; }));
  await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); showHome(); });
  const tile = await ev(() => { const t = [...document.querySelectorAll('#homeBody .tile')].find(x =>
    x.querySelector('.tname').textContent === 'Slideshow'); if (t) t.click(); return !!t && !!t.querySelector('.tmy svg'); });
  await settle(500);
  ok('  on the home screen as MY Slideshow, and tapping it opens it', tile && await ev(() => !$('sld').classList.contains('hidden')));
  let txt = await ev(() => $('sldBody').textContent.replace(/\s+/g, ' '));
  ok('none yet: it says how to start one', /None yet\. Press the red \+ to start one, such as Canals, Scenic or People/.test(txt), txt.slice(0, 200));
  ok('  the Bluesky one is there from the start, with Barry’s name', /Photo posts from @barryandsandra\.bsky\.social/.test(txt)
    && await ev(() => !!document.querySelector('[data-sldplay="bsky:up"]') && !!document.querySelector('[data-sldplay="bsky:side"]')));
  ok('  and it says where the photos are kept, and how music works', /kept on this (phone|computer) only, not online/.test(txt)
    && /start it in your own app first, then play a slideshow here: it carries on behind/.test(txt));
  ok('the menu: New slideshow, and the Bluesky photos sideways, upright or both ways (ML317)', await ev(() =>
    areaItems('sld').map(x => x.label).join('|') === 'New slideshow|Play your Bluesky photos sideways|Play your Bluesky photos upright|Play your Bluesky photos both ways'));
  ok('Help knows where it is', await ev(() => currentScreen() === 'sld' && HELP_AT.sld === 'h-sld'));

  // ---------------------------------------------------------------
  console.log('\nStarting one');
  answers.push('   ');
  await p.click('#sldAdd'); await settle();
  ok('no name, nothing made', await ev(() => SLD_THEMES.length === 0 && $('sldTheme').classList.contains('hidden')));
  answers.push('Canals');
  await p.click('#sldAdd'); await settle(500);
  ok('named Canals: made, and it opens', await ev(() => SLD_THEMES.length === 1 && SLD_THEMES[0].name === 'Canals'
    && !$('sldTheme').classList.contains('hidden') && $('sldThemeTitle').textContent === 'Canals'));
  ok('  kept in this device’s own store, one for each person', await ev(async () =>
    (await indexedDB.databases()).some(d => d.name === 'myslides-me')));
  txt = await ev(() => $('sldThemeBody').textContent.replace(/\s+/g, ' '));
  ok('  empty: both Play buttons there but greyed', /No photos in it yet/.test(txt) && await ev(() =>
    document.querySelector('#sldThemeBody [data-sldplay$=":up"]').disabled
    && document.querySelector('#sldThemeBody [data-sldplay$=":side"]').disabled));
  answers.push('canals');
  await ev(() => sldNew()); await settle();
  ok('a second with the same name is refused', /You already have one called canals/.test(await said()) && await ev(() => SLD_THEMES.length === 1));

  console.log('\nAdding photos');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#sldPick')]);
  ok('Add photos asks for pictures, several at once', fc.isMultiple() && await ev(() => true));
  await fc.setFiles([files.tall, files.wide, files.big, files.square, files.broken, files.words]);
  await p.waitForFunction(() => window.__said.some(s => / added/.test(s)), null, { timeout: 30000 });
  ok('4 added, the broken one could not be read, the words left out', /4 added, 1 could not be read/.test(await said()), await said());
  const stored = await ev(async () => { const ps = sldOf(SLD_CUR);
    const big = ps.find(x => x.name === 'tunnel.png'), bm = await createImageBitmap(big.img), tm = await createImageBitmap(big.thumb);
    return { n: ps.length, shapes: ps.map(x => x.name + ':' + sldShape(x)).sort().join(),
      big: [big.w, big.h, bm.width, bm.height, tm.width, tm.height].join(), type: big.img.type }; });
  ok('each sorted into upright, sideways or square', stored.shapes === 'lock.png:up,swan.png:both,towpath.png:side,tunnel.png:side', stored.shapes);
  ok('a big one kept the size of a big screen, with a little one for the list', stored.big === '4000,3000,2560,1920,360,270'
    && stored.type === 'image/jpeg', stored.big);
  txt = await ev(() => $('sldThemeBody').textContent.replace(/\s+/g, ' '));
  ok('Play upright (2) and Play sideways (3): the square one is in both', /Play upright \(2\)/.test(txt) && /Play sideways \(3\)/.test(txt), txt.slice(0, 120));
  ok('  the four shown small, newest first', await ev(() => document.querySelectorAll('#sldThemeBody .sldth img').length === 4
    && [...document.querySelectorAll('#sldThemeBody .sldth img')].every(i => /^blob:/.test(i.getAttribute('src')))));
  await ev(() => { window.__said.length = 0; });
  await ev(() => sldAddFiles([new File(['hello'], 'notes.txt', { type: 'text/plain' })]));
  ok('picking no photos at all says so', /No photos in that/.test(await said()));
  await ev(() => { window.__said.length = 0; });
  // The same files picked again.
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('#sldPick')]);
  await fc2.setFiles([files.tall, files.square]);
  await p.waitForFunction(() => window.__said.some(s => / added/.test(s)), null, { timeout: 30000 });
  ok('picking the same ones again adds none twice', /0 added, 2 already in it/.test(await said())
    && await ev(() => sldOf(SLD_CUR).length === 4), await said());
  await ev(async () => { SLD_PHOTOS = []; SLD_THEMES = []; await loadSlides(); renderSlideTheme(); });
  ok('still there when the app is opened again', await ev(() => SLD_THEMES.length === 1 && sldOf(SLD_CUR).length === 4));
  await ev(() => { $('sldTheme').classList.add('hidden'); renderSlides(); });
  txt = await ev(() => $('sldBody').textContent.replace(/\s+/g, ' '));
  ok('the list says Canals: 4 photos, 2 upright, 3 sideways, with a little picture', /Canals ?4 photos: 2 upright, 3 sideways/.test(txt)
    && await ev(() => /^blob:/.test(document.querySelector('[data-sldopen] img').getAttribute('src'))), txt.slice(0, 160));

  // ---------------------------------------------------------------
  console.log('\nPlaying upright');
  await p.click('[data-sldopen]'); await settle();
  await p.click('#sldThemeBody [data-sldplay$=":up"]'); await settle(700);
  let show = await ev(() => { const s = SLD, box = $('sldPlay'), st = $('sldStage');
    return s && { shape: s.shape, n: s.list.length, names: s.list.map(x => x.name).sort().join(), title: box.querySelector('.sldtitle').textContent,
      count: $('sldCount').textContent, on: box.querySelectorAll('.sldimg.on').length, src: box.querySelector('.sldimg.on').getAttribute('src'),
      fixed: getComputedStyle(box).position, z: Number(getComputedStyle(box).zIndex), t: getComputedStyle(st).transform,
      wake: window.__wake, locks: window.__locks.join() }; });
  ok('full screen and black, over everything', show && show.fixed === 'fixed' && show.z >= 100);
  ok('  only the upright ones and the square one', show.n === 2 && show.names === 'lock.png,swan.png', show.names);
  ok('  one photo showing, with its name and 1 of 2', show.on === 1 && /^blob:/.test(show.src) && show.title === 'Canals'
    && /^1 of 2$/.test(show.count), JSON.stringify(show));
  ok('  the screen kept on and turned upright', show.wake === 1 && show.locks === 'portrait', show.wake + ' ' + show.locks);
  ok('  not turned round on an upright phone', show.t === 'none', show.t);
  ok('  the buttons showing to start with', await ev(() => $('sldCtl').classList.contains('on')));
  const first = await ev(() => SLD.list[SLD.i].id);
  await p.click('#sldNext'); await settle(500);
  ok('Next: 2 of 2, a different photo', await ev(f => /^2 of 2$/.test($('sldCount').textContent) && SLD.list[SLD.i].id !== f, first));
  const second = await ev(() => SLD.list[SLD.i].id);
  await p.click('#sldNext'); await settle(500);
  ok('after the last it starts again in a new order, never the same one twice running', await ev(s =>
    /^1 of 2$/.test($('sldCount').textContent) && SLD.list[SLD.i].id !== s, second));
  await p.click('#sldPrev'); await settle(500);
  ok('Back goes back', await ev(() => /^2 of 2$/.test($('sldCount').textContent)));
  await ev(() => { SLD.secs = 0.3; sldSchedule(); });
  await settle(1100);
  ok('it moves on by itself', await ev(() => /^1 of 2$/.test($('sldCount').textContent) || /^2 of 2$/.test($('sldCount').textContent))
    && await ev(() => SLD.turn >= 5));
  await p.click('#sldPause');
  const turnAt = await ev(() => SLD.turn); await settle(900);
  ok('Pause stops it, and says so', await ev(t => SLD.paused && SLD.turn === t && /^Paused · /.test($('sldCount').textContent)
    && $('sldPause').getAttribute('aria-label') === 'Play', turnAt));
  await p.click('#sldPause');
  ok('  and Play starts it again', await ev(() => !SLD.paused && !!SLD.timer));
  await ev(() => { SLD.secs = 8; sldSchedule(); });
  await p.click('#sldSecs');
  ok('the seconds button goes 8, 15, 30, 5, and is remembered', await ev(() => SLD.secs === 15 && $('sldSecs').textContent === '15 sec'
    && sldPrefs().secs === 15));
  await p.click('#sldFill');
  ok('Fill fills the screen, and is remembered', await ev(() => $('sldPlay').classList.contains('fill')
    && getComputedStyle(document.querySelector('.sldimg.on')).objectFit === 'cover' && sldPrefs().fill === true
    && $('sldFill').textContent === 'Whole photo'));
  await p.click('#sldFill');
  ok('  Whole photo shows all of it', await ev(() => getComputedStyle(document.querySelector('.sldimg.on')).objectFit === 'contain'
    && sldPrefs().fill === false));
  await ev(() => { $('sldCtl').classList.remove('on'); });
  await p.mouse.click(195, 420); await settle(200);
  ok('a tap in the middle brings the buttons back', await ev(() => $('sldCtl').classList.contains('on')));
  const before = await ev(() => SLD.i);
  await p.mouse.click(370, 420); await settle(500);
  ok('a tap at the right goes on', await ev(b => SLD.i !== b, before));
  const fsWas = await ev(() => SLD.fs);
  await p.click('#sldClose'); await settle(300);
  ok('× ends it: gone, the screen let go, back where you were', await ev(() => !SLD && !$('sldPlay') && window.__rel === 1
    && window.__unlock >= 1 && !$('sldTheme').classList.contains('hidden')));

  console.log('\nPlaying sideways');
  await p.click('#sldThemeBody [data-sldplay$=":side"]'); await settle(700);
  show = await ev(() => { const st = $('sldStage').getBoundingClientRect();
    return { n: SLD.list.length, names: SLD.list.map(x => x.name).sort().join(), t: getComputedStyle($('sldStage')).transform,
      w: Math.round(st.width), h: Math.round(st.height), locks: window.__locks.join() }; });
  ok('the sideways ones and the square one', show.n === 3 && show.names === 'swan.png,towpath.png,tunnel.png', show.names);
  ok('  the screen turned to landscape', show.locks === 'portrait,landscape', show.locks);
  ok('  and, on a phone still held upright, the picture turned round to fill it', show.t !== 'none' && show.w === 390 && show.h === 844,
    JSON.stringify(show));
  await p.setViewportSize({ width: 844, height: 390 }); await settle(300);
  ok('  but not once the phone is turned', await ev(() => getComputedStyle($('sldStage')).transform === 'none'));
  await p.setViewportSize({ width: 390, height: 844 }); await settle(300);
  await ev(() => sldStop());
  if (fsWas) ok('(full screen was on, and leaving it ends the show)', true);

  // ---------------------------------------------------------------
  console.log('\nTaking out, renaming, deleting');
  await ev(() => { window.__said.length = 0; });
  await p.click('#sldThemeBody .sldth'); await settle(400);
  ok('tap a photo to take it out (after asking)', await ev(async () => sldOf(SLD_CUR).length === 3
    && (await sldTx('photos', 'readonly', s => s.count())) === 3 && document.querySelectorAll('#sldThemeBody .sldth').length === 3));
  answers.push('Canals and rivers');
  await p.click('#sldThemeName'); await settle(400);
  ok('Rename', await ev(async () => $('sldThemeTitle').textContent === 'Canals and rivers'
    && (await sldTx('themes', 'readonly', s => s.getAll()))[0].name === 'Canals and rivers'));
  answers.push('People');
  await ev(() => sldNew()); await settle(400);
  ok('a second one, People, opens empty', await ev(() => SLD_THEMES.map(t => t.name).join() === 'Canals and rivers,People'
    && $('sldThemeTitle').textContent === 'People'));
  await p.click('#sldThemeBody [data-sldplay$=":up"]', { force: true }).catch(() => {}); await settle(200);
  ok('  nothing plays from an empty one', await ev(() => !SLD));
  await ev(() => openSlideTheme(SLD_THEMES[0].id)); await settle();
  await p.click('#sldDrop'); await settle(500);
  ok('Delete this slideshow takes it and its photos off this device', await ev(async () =>
    SLD_THEMES.map(t => t.name).join() === 'People' && SLD_PHOTOS.length === 0
    && (await sldTx('photos', 'readonly', s => s.count())) === 0 && $('sldTheme').classList.contains('hidden'))
    && /Canals and rivers deleted/.test(await said()));

  // ---------------------------------------------------------------
  console.log('\nYour Bluesky photos');
  await ev(() => { window.__said.length = 0; });
  await p.click('[data-sldplay="bsky:side"]'); await settle(1200);
  const q = feeds.map(f => [f.get('actor'), f.get('filter'), f.get('limit'), f.get('cursor') || ''].join(' '));
  ok('fetched from Bluesky: their photo posts, a hundred at a time, then the next page', q.length === 2
    && q[0] === 'barryandsandra.bsky.social posts_with_media 100 ' && q[1] === 'barryandsandra.bsky.social posts_with_media 100 page2', q.join(' / '));
  show = await ev(() => SLD && { ids: SLD.list.map(x => x.id.split('/').pop()).sort().join(), src: document.querySelector('.sldimg.on')
    && document.querySelector('.sldimg.on').getAttribute('src'), title: document.querySelector('.sldtitle').textContent });
  ok('playing sideways: the sideways picture and the one of no known shape, not the upright one, the repost or the video',
    show && show.ids === '1#0,4#0' && show.title === 'Bluesky', JSON.stringify(show));
  await ev(() => sldShow(1)); await settle(800);
  ok('  the one of no known shape turned out upright, so it is skipped', await ev(() =>
    /cdn\.example\/wide1\.png$/.test(document.querySelector('.sldimg.on').getAttribute('src'))
    && SLD.list.find(x => /4#0$/.test(x.id)).h === 320));
  await ev(() => sldStop());
  await p.click('[data-sldplay="bsky:up"]'); await settle(800);
  ok('upright: kept from before, not fetched again', feeds.length === 2 && await ev(() => SLD
    && SLD.list.map(x => x.id.split('/').pop()).sort().join() === '1#1,4#0'));
  await ev(() => sldStop());
  bskyDown = true;
  await ev(() => { SLD_BSKY.at = 0; window.__said.length = 0; });
  await p.click('[data-sldplay="bsky:up"]'); await settle(800);
  ok('no signal: it says so and nothing opens', await ev(() => !SLD && !$('sldPlay'))
    && /Could not reach Bluesky/.test(await said()), await said());
  bskyDown = false;

  // ---------------------------------------------------------------
  console.log('\nHow it plays, and fitting on a phone');
  await ev(() => renderSlides());
  await p.click('[data-sldsecs="30"]');
  ok('the seconds chosen on the screen are remembered', await ev(() => sldPrefs().secs === 30
    && document.querySelector('[data-sldsecs="30"]').getAttribute('aria-pressed') === 'true'));
  await p.click('[data-sldfill="1"]');
  ok('  and Fill the screen', await ev(() => sldPrefs().fill === true));
  for (const w of [320, 390, 412]) {
    await p.setViewportSize({ width: w, height: 800 }); await settle(200);
    await ev(() => { renderSlides(); openSlideTheme(SLD_THEMES[0].id); });
    await settle(200);
    const fit = await ev(() => ['sldBody', 'sldThemeBody'].every(id => $(id).scrollWidth <= $(id).clientWidth + 1)
      && [...document.querySelectorAll('#sldThemeBody .sldplays .btn')].every(b => b.getBoundingClientRect().right <= innerWidth));
    ok(`everything fits at ${w} wide`, fit);
    await ev(() => { $('sldTheme').classList.add('hidden'); lockBackground(); });
  }
  await p.setViewportSize({ width: 390, height: 844 });

  console.log('\nWhen the store will not open');
  await ev(async () => { const real = indexedDB.open; window.__realOpen = real; SLD_DBP = null;
    indexedDB.open = () => { throw new Error('not here'); }; await loadSlides(); renderSlides();
    indexedDB.open = real; SLD_DBP = null; });
  txt = await ev(() => $('sldBody').textContent.replace(/\s+/g, ' '));
  ok('it says so, rather than showing no slideshows as if there were none', /would not open the place it keeps the Slideshow's photos/.test(txt));
  await ev(async () => { await loadSlides(); renderSlides(); });
  ok('  and they are back once it opens', await ev(() => SLD_OK && SLD_THEMES.length === 1));

  console.log('\nLeaving');
  await p.click('[data-sldplay="bsky:side"]'); await settle(800);
  await ev(() => backHome('sld')); await settle(300);
  ok('the home button ends a show and puts the Slideshow away', await ev(() => !SLD && !$('sldPlay')
    && $('sld').classList.contains('hidden') && !$('home').classList.contains('hidden')));

  // ---------------------------------------------------------------
  console.log('\nHelp and the version');
  const help = await ev(() => { openHelp('sld'); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); return t; });
  ok('Help explains the Slideshow', /Slideshow plays your photos at random, full screen, either all upright or all sideways/.test(help)
    && /kept on that phone or computer only, not online/.test(help) && /Your Bluesky photos is ready-made/.test(help)
    && /start it in your own app first/.test(help));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const appVer = await ev(() => APP_VERSION), V = vj.history.find(h => h.version === '2026.11.19.3');
  ok('2026.11.19.3 is in version.json, and the page is the newest', !!V && V.changes.length === 3
    && vj.version === appVer && vj.history[0].version === appVer, appVer + ' / ' + vj.version);

  ok('no page errors', errors.length === 0, errors.join(' / '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
