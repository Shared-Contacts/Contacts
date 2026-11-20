// 20 Nov 2026 (version 2026.11.20.4), after Barry tried 2026.11.20.3 on the phone:
//   ML334  The title at the start stays 11 seconds: Chrome's message about
//          full screen takes about 9 to go on his phone.
//   ML335  The buttons are back. They show over the title and go when the
//          first photo comes; a tap in the middle brings them back.
//   ML336  'Seconds slide shows for', with 5, 8, 15 and 30 in circles.
//   ML337  The first Slideshow page centred.
//   ML338  'Both ways' is now 'Both', so all three fit on one line.
//   ML339  'Which way' is now 'Which Slideshow Images to view'.
// Pretend photos only; nothing goes online.
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
  await p.route(/public\.api\.bsky\.app/, r => r.abort());

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const help = () => ev(() => { openHelp('contacts'); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    $('help').classList.add('hidden'); lockBackground(); return t; });
  const on = () => ev(() => $('sldCtl').classList.contains('on'));
  await ev(() => { WX_OFF = true; BSKY_OFF = true;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release() {}, addEventListener() {} }) } });
    Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async () => {} });
    Object.defineProperty(screen.orientation, 'unlock', { configurable: true, value: () => {} }); });

  // One slideshow of three pretend upright photos and one sideways, with the dates the camera noted.
  await ev(() => openSlides()); await settle(300);
  answers.push('Mixed Bag');
  await ev(() => sldNew()); await settle(400);
  await ev(async () => { const out = [];
    for (const [n, w, h, c] of [['a.jpg', 400, 600, '#246'], ['b.jpg', 400, 600, '#642'], ['c.jpg', 400, 600, '#462'], ['d.jpg', 600, 400, '#264']]) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h);
      out.push(new File([await new Promise(o => cv.toBlob(o, 'image/jpeg'))], n, { type: 'image/jpeg' })); }
    await sldAddFiles(out);
    const R = Date, at = { 'a.jpg': new R(2010, 5, 3, 9), 'b.jpg': new R(2015, 1, 1, 9), 'c.jpg': new R(2024, 7, 10, 9) };
    SLD_PHOTOS.forEach(x => { if (at[x.name]) { x.taken = at[x.name].getTime(); x.takenBy = 'camera'; } });
    sldSavePrefs({ ...sldPrefs(), order: 'date' });
    $('sldTheme').classList.add('hidden'); SLD_CUR = null; lockBackground(); renderSlides(); $('sldBody').scrollTop = 0; });
  await settle(300);

  // ---------------------------------------------------------------
  console.log('\nML336 Seconds slide shows for, in circles');
  const secs = await ev(() => { const bs = [...$('sldBody').querySelectorAll('[data-sldsecs]')];
    const lab = bs[0].closest('.pickrow').previousElementSibling.textContent.trim();
    return { lab, nums: bs.map(x => x.textContent.trim()).join('|'), aria: bs.map(x => x.getAttribute('aria-label')).join('|'),
      round: bs.every(x => { const r = x.getBoundingClientRect(); return Math.abs(r.width - r.height) <= 1 && r.width >= 44
        && getComputedStyle(x).borderTopLeftRadius === '50%'; }),
      pressed: bs.filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.textContent.trim()).join(),
      colour: getComputedStyle($('sldBody').querySelector('[data-sldsecs="8"]')).backgroundColor,
      plain: getComputedStyle($('sldBody').querySelector('[data-sldsecs="5"]')).backgroundColor,
      old: /Each photo shows for/.test($('sldBody').textContent) }; });
  ok('the label says Seconds slide shows for', secs.lab === 'Seconds slide shows for' && !secs.old, JSON.stringify(secs));
  ok('  5, 8, 15 and 30, just the numbers', secs.nums === '5|8|15|30', secs.nums);
  ok('  each in a circle, big enough for a thumb', secs.round, JSON.stringify(secs));
  ok('  read out as seconds for a screen reader', secs.aria === '5 seconds|8 seconds|15 seconds|30 seconds', secs.aria);
  ok('  8 chosen to begin with, filled in', secs.pressed === '8' && secs.colour !== secs.plain, JSON.stringify(secs));
  await p.tap('#sldBody [data-sldsecs="15"]'); await settle(200);
  ok('  press 15: chosen and kept', await ev(() => sldPrefs().secs === 15
    && $('sldBody').querySelector('[data-sldsecs="15"]').getAttribute('aria-pressed') === 'true'));

  console.log('\nML338 ML339 Which Slideshow Images to view: Upright, Sideways, Both');
  const shp = await ev(() => { const bs = [...$('sldBody').querySelectorAll('[data-sldshape]')];
    return { lab: bs[0].closest('.pickrow').previousElementSibling.textContent.trim(), names: bs.map(x => x.textContent.trim()).join('|'),
      old: /Which way|Both ways/.test($('sldBody').textContent), txt: $('sldBody').textContent.replace(/\s+/g, ' ') }; });
  ok('the label says Which Slideshow Images to view', shp.lab === 'Which Slideshow Images to view' && !shp.old, shp.lab);
  ok('  Upright, Sideways and Both', shp.names === 'Upright|Sideways|Both', shp.names);
  ok('  the note under it says Both too', /Both plays them all, and leaves the phone free to turn\./.test(shp.txt));
  for (const w of [320, 360, 390]) {
    await p.setViewportSize({ width: w, height: 760 }); await settle(250);
    const tops = await ev(() => [...$('sldBody').querySelectorAll('[data-sldshape]')].map(x => Math.round(x.getBoundingClientRect().top)));
    ok(`  all three on one line at ${w} wide`, new Set(tops).size === 1, JSON.stringify(tops));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(250);

  console.log('\nML337 The first page centred');
  const mid = await ev(() => {
    const ta = el => getComputedStyle(el).textAlign, card = $('sldBody').querySelector('.setadd').getBoundingClientRect();
    const rows = [...$('sldBody').querySelectorAll('.setadd .pickrow')].map(r => { const bs = [...r.children];
      const l = bs[0].getBoundingClientRect().left - card.left, rt = card.right - bs[bs.length - 1].getBoundingClientRect().right;
      return Math.round(Math.abs(l - rt)); });
    return { heads: [...$('sldBody').querySelectorAll('.dsec')].map(ta), labels: [...$('sldBody').querySelectorAll('.setadd .coords')].map(ta),
      notes: [...$('sldBody').querySelectorAll('.sldhow, .sldnote')].map(ta), rows }; });
  ok('the headings centred', mid.heads.length === 2 && mid.heads.every(x => x === 'center'), JSON.stringify(mid.heads));
  ok('  the labels and notes in How it plays centred', mid.labels.length >= 5 && mid.labels.every(x => x === 'center'), JSON.stringify(mid.labels));
  ok('  each row of buttons in the middle', mid.rows.length === 4 && mid.rows.every(x => x <= 2), JSON.stringify(mid.rows));
  ok('  the notes under it centred', mid.notes.length >= 2 && mid.notes.every(x => x === 'center'), JSON.stringify(mid.notes));
  ok('  the note says the buttons come with the title', /It opens with its name and the buttons for about 10 seconds, then just the photos\./.test(shp.txt)
    && /tap the middle for the buttons \(pause and the rest\)/.test(shp.txt));
  ok('  the list of slideshows still a list: picture, name, Photos button', await ev(() => {
    const r = document.querySelector('#sldBody .sldrow:has(.sldph)'), im = r.querySelector('img').getBoundingClientRect(),
      nm = r.querySelector('b').getBoundingClientRect(), ph = r.querySelector('.sldph').getBoundingClientRect();
    return im.right <= nm.left && nm.right <= ph.left; }));

  // ---------------------------------------------------------------
  console.log('\nML334 ML335 The title, with the buttons over it');
  ok('the title stays 11 seconds', await ev(() => SLD_INTRO) === 11000);
  await p.tap('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(500);
  let st = await ev(() => { const v = el => getComputedStyle(el).visibility;
    return { intro: SLD.intro, on: $('sldCtl').classList.contains('on'), op: getComputedStyle($('sldCtl')).opacity,
      btns: [...document.querySelectorAll('.sldbtm button')].map(x => x.getAttribute('aria-label') || x.textContent).join('|'),
      x: v($('sldClose')), title: v(document.querySelector('.sldtitle')), count: v($('sldCount')),
      secs: $('sldSecs').textContent, fill: $('sldFill').textContent }; });
  ok('a tap on Mixed Bag: the title, with the buttons on it', st.intro && st.on && st.op === '1', JSON.stringify(st));
  ok('  seconds, back, pause, next and Fill along the bottom, × at the top', st.btns === 'How long each photo shows|Back one|Pause|Next one|Fill'
    && st.x === 'visible', JSON.stringify(st));
  ok('  the top bar\'s name and count kept back while the title shows them', st.title === 'hidden' && st.count === 'hidden', JSON.stringify(st));
  ok('  the seconds button says the time chosen on the first page', st.secs === '15 sec', st.secs);
  await settle(4500);
  ok('  they stay all the time the title is up', await ev(() => SLD.intro && $('sldCtl').classList.contains('on')));
  await p.tap('#sldSecs'); await settle(200);
  ok('the seconds button on the title: 15 to 30, the title and the first page\'s choice too', await ev(() => SLD.secs === 30
    && $('sldSecs').textContent === '30 sec' && / · 30 seconds each · /.test($('sldIdet').textContent) && sldPrefs().secs === 30 && SLD.intro));
  await p.tap('#sldFill'); await settle(200);
  ok('  Fill: the photos fill the screen, and the button offers the whole photo back', await ev(() => SLD.fill
    && $('sldPlay').classList.contains('fill') && $('sldFill').textContent === 'Whole photo' && sldPrefs().fill));
  await p.tap('#sldFill'); await settle(200);
  await p.tap('#sldPause'); await settle(200);
  ok('  pause on the title: paused, still the title', await ev(() => SLD.paused && SLD.intro
    && $('sldPause').getAttribute('aria-label') === 'Play' && !document.querySelector('.sldimg.on')));
  await p.tap('#sldNext'); await settle(700);
  st = await ev(() => ({ intro: SLD.intro, i: SLD.i, paused: SLD.paused, on: $('sldCtl').classList.contains('on'),
    count: $('sldCount').textContent, title: document.querySelector('.sldtitle').textContent, timer: SLD.timer,
    vis: getComputedStyle(document.querySelector('.sldtitle')).visibility }));
  ok('next on the title: the first photo now, still paused, the buttons kept', !st.intro && st.i === 0 && st.paused && st.on && !st.timer, JSON.stringify(st));
  ok('  along the top: the name, the date taken, and where you are', st.vis === 'visible' && st.title === 'Mixed Bag · 3 Jun 2010'
    && st.count === 'Paused · 1 of 3', JSON.stringify(st));
  await p.tap('#sldNext'); await settle(500);
  ok('  next: on one', await ev(() => SLD.i === 1 && $('sldCount').textContent === 'Paused · 2 of 3'
    && document.querySelector('.sldtitle').textContent === 'Mixed Bag · 1 Feb 2015'));
  await p.tap('#sldPrev'); await settle(500);
  ok('  back: back one', await ev(() => SLD.i === 0));
  await p.tap('#sldPause'); await settle(200);
  ok('  play: carries on, the button says Pause again', await ev(() => !SLD.paused && !!SLD.timer
    && $('sldPause').getAttribute('aria-label') === 'Pause' && $('sldCount').textContent === '1 of 3'));
  await settle(4400);
  ok('  and a few seconds later the buttons go', !(await on()));
  await p.mouse.click(195, 420); await settle(300);
  ok('a tap in the middle brings them back, still playing', await on() && await ev(() => !SLD.paused));
  await p.mouse.click(195, 420); await settle(300);
  ok('  another puts them away again', !(await on()));
  await p.keyboard.press('ArrowRight'); await settle(500);
  ok('  on a computer, the arrow keys show them too', await on() && await ev(() => SLD.i === 1));
  await p.tap('#sldClose'); await settle(400);
  ok('× ends it, back at the list', await ev(() => !SLD && !$('sldPlay') && !$('sld').classList.contains('hidden')));
  ok('  the first page shows the 30 seconds chosen on the show', await ev(() =>
    $('sldBody').querySelector('[data-sldsecs="30"]').getAttribute('aria-pressed') === 'true'));
  await p.tap('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(500);
  await p.tap('#sldPrev'); await settle(700);
  ok('back on the title starts the photos too, at the first; the buttons go a few seconds later', await ev(() => !SLD.intro && SLD.i === 0
    && !SLD.paused && !!SLD.ctlTimer));
  await ev(() => sldStop());

  console.log('\nThe buttons on the screen at other sizes');
  for (const [w, h, shape] of [[360, 640, 'up'], [844, 390, 'side'], [390, 844, 'side']]) {
    await p.setViewportSize({ width: w, height: h }); await settle(250);
    await ev(s => { sldSavePrefs({ ...sldPrefs(), shape: s }); renderSlides(); }, shape);
    await ev(() => sldPlay(SLD_THEMES[0].id)); await settle(500);
    const r = await ev(() => [...document.querySelectorAll('#sldCtl button')].map(x => { const q = x.getBoundingClientRect();
      return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; }));
    ok(`  ${w} × ${h}, ${shape === 'up' ? 'upright' : 'sideways'}: all six buttons on the screen`, r.length === 6
      && r.every(([l, t, rt, bo]) => l >= 0 && t >= 0 && rt <= w && bo <= h), JSON.stringify(r));
    await ev(() => sldStop());
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);

  // ---------------------------------------------------------------
  console.log('\nHelp and the version');
  const hp = await help();
  ok('Help uses the new names', /Seconds slide shows for, how long each photo shows \(5, 8, 15 or 30 seconds\)/.test(hp)
    && /and Which Slideshow Images to view\./.test(hp) && /Both plays them all, which suits a laptop/.test(hp) && !/Both ways plays/.test(hp));
  ok('  and says where the buttons are', /It opens with a title for about 10 seconds/.test(hp)
    && /The buttons are on the title too; when the first photo comes they go, leaving just the photos/.test(hp)
    && /Tap the middle to bring the buttons back for a few seconds/.test(hp) && /They stay while it is paused/.test(hp));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  ok('2026.11.20.4, the app and version.json agree', await ev(() => APP_VERSION) === '2026.11.20.4' && vj.version === '2026.11.20.4'
    && vj.history[0].version === '2026.11.20.4');
  const what = vj.history[0].changes.join(' ');
  ok('  what\'s new says all three', /stays about 10 seconds/.test(what) && /the buttons are back/.test(what) && /first page is centred/.test(what), what);

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
