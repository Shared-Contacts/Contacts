// The 3 Nov 2026 batch: Add it stays above the keyboard while typing a
// Wishlist idea (ML149), the ideas go A to Z then oldest first (ML150), and
// the phone's keyboard leaves websites, emails and the like alone (ML151).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); });

  console.log('\nWishlist: A to Z, then oldest first (ML150)');
  await ev(() => {
    const w = (id, title, day, status = 'idea') => ({ id, app: 'contacts', created_by: 'me', title,
      notes: null, status, photos: [], created_at: '2026-10-' + day + 'T10:00:00Z' });
    window.__rows.wishes = [w(1, 'Recipes: bigger photos', '20'), w(2, 'Diary:', '25'),
      w(3, 'contacts: merge doubles', '22'), w(4, 'Diary:', '05'), w(5, 'Bank import', '28'),
      w(6, 'Zebra', '01', 'done'), w(7, 'Apple', '30', 'done')];
  });
  await ev(() => openWish()); await settle(600);
  const order = await ev(() => [...document.querySelectorAll('.wcard')].map(c =>
    [...c.querySelectorAll('[data-wdel]')].map(b => +b.dataset.wdel)));
  ok('ideas A to Z, capitals or not, and the two "Diary:" oldest first',
    JSON.stringify(order[0]) === '[5,3,4,2,1]', JSON.stringify(order));
  ok('each heading (Idea, Done) sorted on its own', JSON.stringify(order[1]) === '[7,6]', JSON.stringify(order));

  console.log('\nWishlist: Add it stays above the keyboard (ML149)');
  // Plenty of ideas so the page can scroll, then the keyboard "opens".
  await ev(() => { for (let i = 10; i < 30; i++) window.__rows.wishes.push({ id: i, app: 'contacts',
    created_by: 'me', title: 'Idea ' + i, notes: 'Some words', status: 'idea', photos: [],
    created_at: '2026-10-01T10:00:00Z' }); });
  await ev(() => openWish()); await settle(600);
  const addSeen = () => ev(() => { const a = $('wAdd').getBoundingClientRect();
    const h = window.visualViewport ? window.visualViewport.height : innerHeight;
    return a.bottom <= h + 1 && a.top >= 0; });
  for (const box of ['#wTitle', '#wNotes']) {
    await p.setViewportSize({ width: 390, height: 844 }); await settle(300);
    await ev(() => { $('wishBody').scrollTop = 0; });
    await p.focus(box);
    await p.setViewportSize({ width: 390, height: 420 });      // the keyboard comes up
    await settle(900);
    ok('typing in ' + (box === '#wTitle' ? 'Tile/Area' : 'Description of idea/change')
      + ': Add it is in sight', await addSeen(),
      JSON.stringify(await ev(() => [$('wAdd').getBoundingClientRect().bottom, visualViewport.height])));
    ok('  and the box being typed in is still there to see', await ev(sel => {
      const r = document.querySelector(sel).getBoundingClientRect(); return r.bottom > 0 && r.top < visualViewport.height; }, box));
  }
  await p.evaluate(() => document.activeElement.blur());
  await p.setViewportSize({ width: 390, height: 844 }); await settle(300);
  ok('Add it still adds an idea', await (async () => {
    await p.fill('#wTitle', 'A new one'); await p.click('#wAdd'); await settle(500);
    return ev(() => window.__writes.some(w => w.op === 'insert' && w.table === 'wishes'
      && JSON.stringify(w).includes('A new one')));
  })());
  await closeAll();

  console.log('\nThe keyboard leaves these boxes alone (ML151)');
  await ev(() => openEditor(null)); await settle(600);
  for (const k of ['websites', 'emails', 'phones', 'socials']) {
    await ev(k => { const b = document.querySelector(`[data-add="${k}"]`); if (b) b.click(); }, k);
  }
  await settle(300);
  const attrs = await ev(() => Object.fromEntries(['websites', 'emails', 'phones', 'socials'].map(k => {
    const i = document.querySelector(`[data-val="${k}:0"]`);
    return [k, i ? { im: i.getAttribute('inputmode'), ac: i.getAttribute('autocorrect'),
      cap: i.getAttribute('autocapitalize'), sp: i.getAttribute('spellcheck') } : null];
  })));
  const plain = a => a && a.ac === 'off' && a.cap === 'none' && a.sp === 'false';
  ok('website: no autocorrect, no capitals, the web keyboard', plain(attrs.websites) && attrs.websites.im === 'url', JSON.stringify(attrs.websites));
  ok('email: the same, with the email keyboard', plain(attrs.emails) && attrs.emails.im === 'email', JSON.stringify(attrs.emails));
  ok('phone: the number keypad', plain(attrs.phones) && attrs.phones.im === 'tel', JSON.stringify(attrs.phones));
  ok('social account names: left alone', plain(attrs.socials), JSON.stringify(attrs.socials));
  ok('both what3words boxes: left alone', await ev(() => ['what3words', 'met_what3words'].every(n => {
    const i = document.querySelector(`[name="${n}"]`);
    return i && i.getAttribute('autocorrect') === 'off' && i.getAttribute('spellcheck') === 'false'; })));
  ok('names and addresses still get their capitals and the normal keyboard', await ev(() => {
    const i = document.querySelector('[name="last_name"]');
    return i && !i.hasAttribute('autocorrect') && !i.hasAttribute('spellcheck'); }));
  // What is typed is what is kept: the app itself never changes a website.
  await ev(() => { const i = document.querySelector('[data-val="websites:0"]');
    i.value = 'merciamarina.co.uk'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('blur')); });
  ok('merciamarina.co.uk stays exactly as typed', await ev(() => DRAFT.websites[0].value === 'merciamarina.co.uk'
    && document.querySelector('[data-val="websites:0"]').value === 'merciamarina.co.uk'));
  await closeAll();

  await ev(() => openStuffEd(null, "vehicle")).catch(() => {});
  await settle(400);
  const codes = await ev(() => ['reg', 'mot_number', 'make'].map(k => {
    const i = document.querySelector(`[name="d_${k}"]`);
    return i ? i.getAttribute('autocorrect') : 'missing'; }));
  ok('My Stuff: Registration and MOT test number left alone, Make as before',
    codes[0] === 'off' && codes[1] === 'off' && codes[2] === null, JSON.stringify(codes));
  await closeAll();

  console.log('\nCooking timer: the sound is got ready by the tap (ML155)');
  // Count the beeps and which sound player made them.
  await ev(() => {
    window.__ctxMade = 0; window.__beeps = [];
    const C = window.AudioContext || window.webkitAudioContext;
    const Made = class extends C { constructor() { super(); window.__ctxMade++; this.__n = window.__ctxMade; }
      createOscillator() { window.__beeps.push(this.__n); return super.createOscillator(); } };
    window.AudioContext = Made; window.webkitAudioContext = Made;
    openCook({ id: 9901, title: 'Timer test', serves: 2, ingredients: [],
      prep_steps: [], cook_steps: ['Simmer for 2 mins'] });
  });
  await settle(300);
  ok('nothing made ready before the tap', await ev(() => window.__ctxMade) === 0);
  await p.click('[data-cooktimer]'); await settle(300);
  ok('Start the timer gets the sound ready inside the tap', await ev(() =>
    window.__ctxMade === 1 && COOK_AUDIO && COOK_AUDIO.state !== 'closed'));
  await ev(() => { window.__beeps = []; COOK.timers[0].ends = Date.now() - 10; }); await settle(1300);
  ok('when the time is up it rings on that same one (no new player the iPhone would keep silent)',
    await ev(() => window.__ctxMade === 1 && window.__beeps.length >= 3 && window.__beeps.every(n => n === 1)),
    JSON.stringify(await ev(() => [window.__ctxMade, window.__beeps])));
  ok('it says so on screen as before', /Done/.test(await p.textContent('#cookTimers')));
  await p.click('[data-cookstop]'); await settle(200);
  await ev(() => shutCook()); await settle(200);
  ok('leaving Cook mode lets the sound go', await ev(() => COOK_AUDIO === null));
  await closeAll();

  ok('no errors on any screen', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
