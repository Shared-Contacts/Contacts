// 20 Nov 2026 (version 2026.11.20.3), after Barry tried 2026.11.20.2:
//   ML331  The Slideshow laid out again. How it plays at the top of the first
//          page, for every slideshow, with Upright, Sideways or Both ways
//          last; the list under it, Bluesky first; a tap on a slideshow plays
//          it, and its Photos button opens its own page. Each show opens with
//          a title (its name, when the photos were taken, how it plays and a
//          small photo) while Chrome's own message about full screen comes
//          and goes; then just the photos: no buttons, a tap in the middle
//          pauses.
// Pretend photos and a pretend Bluesky; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|does not exist|schema cache/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const answers = [];
  p.on('dialog', d => d.type() === 'prompt' ? d.accept(answers.length ? answers.shift() : '') : d.accept());
  // A pretend Bluesky, a little slow to answer: one post, one picture each way round.
  await p.route(/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getAuthorFeed/, async route => {
    await new Promise(r => setTimeout(r, 1200));
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ feed: [{ post: { uri: 'at://x/1',
      record: { createdAt: '2024-05-01T09:00:00Z' }, embed: { images: [
        { fullsize: 'https://cdn.example/wide.png', thumb: 'https://cdn.example/twide.png', aspectRatio: { width: 3, height: 2 } },
        { fullsize: 'https://cdn.example/tall.png', thumb: 'https://cdn.example/ttall.png', aspectRatio: { width: 2, height: 3 } }] } } }] }) });
  });
  let pics = {};
  await p.route(/cdn\.example\//, route => route.fulfill({ contentType: 'image/png',
    body: pics[route.request().url().split('/').pop().replace('.png', '')] || pics.wide }));

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const png = async (w, h, c) => Buffer.from(await ev(([w, h, c]) => { const cv = document.createElement('canvas');
    cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h);
    return cv.toDataURL('image/png').split(',')[1]; }, [w, h, c]), 'base64');
  pics = { wide: await png(300, 200, '#36c'), tall: await png(200, 300, '#c63'), twide: await png(60, 40, '#36c'), ttall: await png(40, 60, '#c63') };
  await ev(() => { WX_OFF = true; BSKY_OFF = true; window.__said = []; const t = toast; toast = s => { window.__said.push(s); t(s); };
    window.__locks = [];
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release() {}, addEventListener() {} }) } });
    Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async o => { window.__locks.push(o); } });
    Object.defineProperty(screen.orientation, 'unlock', { configurable: true, value: () => {} }); });
  const open = id => ev(i => !!$(i) && !$(i).classList.contains('hidden'), id);
  const help = () => ev(() => { openHelp('contacts'); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    $('help').classList.add('hidden'); lockBackground(); return t; });
  const row = name => `#sldBody .sldrow:has(b:text-is("${name}")) [data-sldgo]`;
  const swipe = dx => ev(dx => { const st = $('sldStage'), r = st.getBoundingClientRect(), y = r.top + r.height / 2, x0 = r.left + r.width / 2;
    const mk = (type, x) => { const t = new Touch({ identifier: 1, target: st, clientX: x, clientY: y });
      st.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); };
    mk('touchstart', x0); mk('touchend', x0 + dx); }, dx);
  const playing = () => ev(() => SLD && { intro: SLD.intro, i: SLD.i, paused: SLD.paused, on: document.querySelectorAll('.sldimg.on').length,
    gone: $('sldIntro').classList.contains('gone') });

  // Two slideshows of pretend photos, with the dates the camera noted.
  await ev(() => openSlides()); await settle(300);
  const mkFiles = (list) => ev(async list => { const out = [];
    for (const [n, w, h, c] of list) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h);
      out.push(new File([await new Promise(o => cv.toBlob(o, 'image/jpeg'))], n, { type: 'image/jpeg' })); }
    await sldAddFiles(out); }, list);
  answers.push('Mixed Bag');
  await ev(() => sldNew()); await settle(400);
  await mkFiles([['lock.jpg', 400, 600, '#246'], ['swan.jpg', 400, 600, '#642'], ['towpath.jpg', 600, 400, '#462']]);
  answers.push('Canals');
  await ev(() => sldNew()); await settle(400);
  await mkFiles([['bridge.jpg', 400, 600, '#226']]);
  await ev(() => { const R = Date, at = { 'lock.jpg': new R(2010, 5, 3, 9, 0), 'swan.jpg': new R(2024, 7, 10, 9, 0), 'towpath.jpg': new R(2015, 1, 1) };
    SLD_PHOTOS.forEach(x => { if (at[x.name]) { x.taken = at[x.name].getTime(); x.takenBy = 'camera'; } });
    $('sldTheme').classList.add('hidden'); SLD_CUR = null; lockBackground(); renderSlides(); $('sldBody').scrollTop = 0; });
  await settle(300);

  // ---------------------------------------------------------------
  console.log('\nThe first page');
  ok('How it plays at the top, then Your slideshows', await ev(() =>
    [...$('sldBody').querySelectorAll('.dsec')].map(x => x.textContent.trim()).join('|') === 'How it plays|Your slideshows'));
  ok('  its choices in order: how long, whole or fill, the order, and Which way last', await ev(() => {
    const q = s => $('sldBody').querySelector(s), after = (a, b) => !!(q(a).compareDocumentPosition(q(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    return after('[data-sldsecs]', '[data-sldfill]') && after('[data-sldfill]', '[data-sldorder]') && after('[data-sldorder]', '[data-sldshape]')
      && after('[data-sldshape]', '[data-sldgo]'); }));
  ok('  Which way: Upright, Sideways or Both ways, Upright to begin with', await ev(() =>
    [...$('sldBody').querySelectorAll('[data-sldshape]')].map(x => x.textContent.trim()).join('|') === 'Upright|Sideways|Both ways'
    && $('sldBody').querySelector('[data-sldshape="up"]').getAttribute('aria-pressed') === 'true'));
  const txt = await ev(() => $('sldBody').textContent.replace(/\s+/g, ' '));
  ok('a note says how to get about', /Tap a slideshow to start it\. It opens with its name for a few seconds, then just the photos\. Tap or swipe at either side to go back or on, tap the middle to pause, and press the phone’s Back to finish\./.test(txt), txt.slice(0, 600));
  ok('the list: Your Bluesky photos first, then yours', await ev(() =>
    [...$('sldBody').querySelectorAll('.sldrow b')].map(x => x.textContent).join('|') === 'Your Bluesky photos|Canals|Mixed Bag'));
  ok('  a Photos button beside each of yours, none beside Bluesky', await ev(() =>
    [...$('sldBody').querySelectorAll('.sldrow')].map(r => r.querySelectorAll('.sldph').length).join() === '0,1,1'));
  await p.tap('#sldBody .sldrow:has(b:text-is("Mixed Bag")) .sldph'); await settle(400);
  ok('Photos opens its own page: Add photos, its three photos, Rename and Delete', await open('sldTheme') && await ev(() =>
    $('sldThemeTitle').textContent === 'Mixed Bag' && !!$('sldPick') && document.querySelectorAll('#sldThemeBody .sldth').length === 3
    && !!$('sldThemeName') && !!$('sldDrop')));
  ok('  and nothing else: no choices, no Play buttons', await ev(() =>
    !$('sldThemeBody').querySelector('[data-sldsecs], [data-sldfill], [data-sldorder], [data-sldshape], [data-sldplay], [data-sldgo]')));
  await p.tap('#sldThemeBack'); await settle(300);
  ok('  Back: the list again', !(await open('sldTheme')) && await open('sld'));
  await p.tap('#sldBody [data-sldshape="side"]'); await settle(200);
  ok('Which way: Sideways, chosen and kept', await ev(() => sldPrefs().shape === 'side'
    && $('sldBody').querySelector('[data-sldshape="side"]').getAttribute('aria-pressed') === 'true'));
  await p.tap('#sldBody [data-sldshape="up"]'); await settle(200);

  // ---------------------------------------------------------------
  console.log('\nThe title');
  const t0 = Date.now();
  await p.tap(row('Mixed Bag')); await settle(300);
  let st = await playing();
  ok('a tap on Mixed Bag starts it straight away, with the title first', !!st && st.intro && st.on === 0, JSON.stringify(st));
  ok('  full screen and turned upright asked for at once, while the title is up', await ev(() => window.__locks.join() === 'portrait' && SLD.intro));
  const title = await ev(() => ({ h: document.querySelector('#sldIntro h2').textContent, dates: $('sldIdates').textContent,
    det: $('sldIdet').textContent, pic: $('sldIpic').getAttribute('src'), how: document.querySelector('.sldihow').textContent.replace(/\s+/g, ' ').trim(),
    buttons: $('sldPlay').querySelectorAll('button').length }));
  ok('  its name, and when the photos were taken', title.h === 'Mixed Bag' && title.dates === 'Taken June 2010 to August 2024', JSON.stringify(title));
  ok('  how it will play', title.det === '2 photos · upright · 8 seconds each · in random order', title.det);
  ok('  a small photo from it', /^blob:/.test(title.pic || '') && await ev(() => $('sldIpic').naturalWidth > 0), title.pic);
  ok('  how to get about, and nothing to press', title.how === 'Tap or swipe at the sides for back and next · tap the middle to pause · Back to finish'
    && title.buttons === 0, JSON.stringify(title));
  await p.mouse.click(195, 420); await settle(200);
  ok('a tap in the middle of the title does nothing', (await playing()).intro && !(await playing()).paused);
  await settle(Math.max(0, 4500 - (Date.now() - t0)));
  ok('still the title after four and a half seconds', (await playing()).intro);
  await settle(Math.max(0, 6800 - (Date.now() - t0)));
  st = await playing();
  ok('after six seconds: the title goes and the first photo comes', !st.intro && st.gone && st.on === 1 && st.i === 0, JSON.stringify(st));
  await settle(1000);
  ok('  just the photo: no buttons, no words, the title faded right out', await ev(() =>
    $('sldPlay').querySelectorAll('button').length === 0 && $('sldPaused').hidden && !$('sldSay').textContent
    && getComputedStyle($('sldIntro')).opacity === '0' && getComputedStyle($('sldIntro')).pointerEvents === 'none'));

  console.log('\nGetting about');
  await p.mouse.click(370, 420); await settle(500);
  ok('a tap at the right: on', (await playing()).i === 1);
  await p.mouse.click(20, 420); await settle(500);
  ok('a tap at the left: back', (await playing()).i === 0);
  await swipe(-150); await settle(500);
  ok('a swipe to the left: on', (await playing()).i === 1);
  await swipe(150); await settle(500);
  ok('a swipe to the right: back', (await playing()).i === 0);
  await p.mouse.click(195, 420); await settle(300);
  ok('a tap in the middle: paused, and one line says where you are and when it was taken', await ev(() => SLD.paused && !$('sldPaused').hidden
    && /^Paused · Mixed Bag · 1 of 2 · \d{1,2} (Jun 2010|Aug 2024)$/.test($('sldPaused').textContent)), await ev(() => $('sldPaused').textContent));
  await p.mouse.click(370, 420); await settle(500);
  ok('  on while paused: still paused, the line up to date', await ev(() => SLD.paused && SLD.i === 1 && / · 2 of 2 · /.test($('sldPaused').textContent)));
  await p.mouse.click(195, 420); await settle(300);
  ok('  another tap in the middle carries on, the line gone', await ev(() => !SLD.paused && !!SLD.timer && $('sldPaused').hidden));
  await ev(() => history.back()); await settle(500);
  ok('the phone\'s Back ends it, back at the list', await ev(() => !SLD && !$('sldPlay')) && await open('sld'));

  console.log('\nOn the title, going straight on');
  await p.tap(row('Mixed Bag')); await settle(500);
  await p.mouse.click(370, 420); await settle(400);
  st = await playing();
  ok('a tap at the right of the title: the photos start at once', !st.intro && st.on === 1 && st.i === 0, JSON.stringify(st));
  await ev(() => sldStop());
  await p.tap(row('Mixed Bag')); await settle(500);
  await swipe(-150); await settle(400);
  ok('  so does a swipe on', !(await playing()).intro);
  await ev(() => sldStop());
  await p.tap(row('Mixed Bag')); await settle(500);
  await p.keyboard.press('ArrowRight'); await settle(400);
  ok('  and, on a computer, the arrow key', !(await playing()).intro);
  await p.keyboard.press(' '); await settle(200);
  ok('  the space bar pauses', (await playing()).paused);
  await p.keyboard.press(' '); await settle(200);
  ok('  and carries on', !(await playing()).paused);
  await p.keyboard.press('Escape'); await settle(300);
  ok('  and Esc ends it', !(await ev(() => !!SLD)));
  await ev(() => { window.__said.length = 0; });
  await p.tap(row('Canals')); await settle(300);
  ok('Canals, whose photo has no date from the camera: no dates on its title, just how it plays', await ev(() => !!SLD
    && $('sldIdates').textContent === '' && /1 photo · upright · 8 seconds each · in random order/.test($('sldIdet').textContent)));
  await ev(() => sldStop());

  // ---------------------------------------------------------------
  console.log('\nYour Bluesky photos');
  await p.tap('#sldBody [data-sldshape="side"]'); await settle(200);
  const b0 = Date.now();
  await p.tap('#sldBody [data-sldgo="bsky"]'); await settle(300);
  ok('it opens at once with its title, fetching meanwhile', await ev(() => !!SLD && SLD.intro
    && document.querySelector('#sldIntro h2').textContent === 'Your Bluesky photos' && $('sldIdet').textContent === 'Fetching your photo posts…'));
  await settle(1400);
  const bt = await ev(() => ({ det: $('sldIdet').textContent, dates: $('sldIdates').textContent, pic: $('sldIpic').getAttribute('src'),
    ids: SLD.list.map(x => x.id).join() }));
  ok('  then how it will play: the sideways one only', bt.det === '1 photo · sideways · 8 seconds each · in random order' && bt.ids === 'b:at://x/1#0', JSON.stringify(bt));
  ok('  when it was posted, and a small copy of it', bt.dates === 'Posted May 2024' && bt.pic === 'https://cdn.example/twide.png', JSON.stringify(bt));
  await settle(Math.max(0, 6800 - (Date.now() - b0)));
  ok('  then the photo itself', await ev(() => !SLD.intro && document.querySelector('.sldimg.on').getAttribute('src') === 'https://cdn.example/wide.png'));
  await ev(() => sldStop());
  ok('the menu has Play your Bluesky photos, and it plays the way chosen under How it plays', await ev(async () => {
    const m = areaItems('sld').find(x => x.label === 'Play your Bluesky photos'); if (!m) return false;
    m.fn(); await new Promise(r => setTimeout(r, 50)); const ok = !!SLD && SLD.shape === 'side' && SLD.from === 'bsky'; sldStop(); return ok; }));
  await ev(() => renderSlides()); await settle(200);
  ok('the list shows a small copy of a Bluesky photo once they have been fetched', await ev(() =>
    document.querySelector('[data-sldgo="bsky"] img').getAttribute('src') === 'https://cdn.example/twide.png'));
  await p.tap('#sldBody [data-sldshape="up"]'); await settle(200);

  // ---------------------------------------------------------------
  console.log('\nFitting on a phone');
  for (const w of [320, 360, 412]) {
    await p.setViewportSize({ width: w, height: 760 }); await settle(250);
    const fit = await ev(() => [...$('sldBody').querySelectorAll('.pickrow button, .sldph, .sldgo')].map(x => {
      const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.height)]; }));
    ok(`the first page at ${w} wide: everything fits, big enough for a thumb`, fit.every(([l, r, h]) => l >= 0 && r <= w && h >= 40)
      && await ev(() => $('sldBody').scrollWidth <= $('sldBody').clientWidth + 1), JSON.stringify(fit.filter(([l, r, h]) => l < 0 || r > w || h < 40)));
  }
  for (const [w, h] of [[360, 640], [844, 390]]) {
    await p.setViewportSize({ width: w, height: h }); await settle(250);
    await ev(() => { sldSavePrefs({ ...sldPrefs(), shape: innerWidth > innerHeight ? 'side' : 'up' }); renderSlides(); });
    await ev(() => sldPlay(SLD_THEMES.find(t => t.name === 'Mixed Bag').id)); await settle(500);
    const fit = await ev(() => [...$('sldIntro').children].map(x => { const r = x.getBoundingClientRect();
      return [x.tagName, Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)]; }));
    ok(`the title fits a ${w} × ${h} screen, nothing over anything else`, fit.every(([, t, bo, l, r]) => t >= 0 && bo <= h && l >= 0 && r <= w)
      && fit.slice(0, 4).every((x, i, a) => !i || x[1] >= a[i - 1][2] - 1)
      && fit[4][1] >= fit[3][2], JSON.stringify(fit));
    await ev(() => sldStop());
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);

  // ---------------------------------------------------------------
  console.log('\nHelp and the version');
  const h = await help();
  ok('Help says how it is laid out and how to get about', /How it plays is at the top of the Slideshow, for every slideshow/.test(h)
    && /The Photos button beside a slideshow opens its own page/.test(h) && /Your Bluesky photos is ready-made, first in the list/.test(h)
    && /Playing: tap a slideshow in the list\. It opens with a title for a few seconds/.test(h)
    && /Tap the middle to pause, and a line shows where you are and when the photo was taken/.test(h));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  ok('2026.11.20.3, the app and version.json agree', await ev(() => APP_VERSION) === '2026.11.20.3' && vj.version === '2026.11.20.3'
    && vj.history[0].version === '2026.11.20.3');
  ok('  what\'s new says both', /How it plays is now at the top for every slideshow/.test(vj.history[0].changes.join(' '))
    && /opens with its title for a few seconds, then just the photos/.test(vj.history[0].changes.join(' ')));

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
