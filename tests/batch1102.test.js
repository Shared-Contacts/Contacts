// The 2 Nov 2026 batch: a party popper and a woozy face for birthdays on Today
// (ML128), holding and sliding a Regular job to move it (ML129), looking at a
// contact sent to you before deciding, and the sender being told (ML130), Our
// location on the maps (ML131) and an x to empty a map's Find box (ML132).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
    permissions: ['geolocation'], geolocation: { latitude: 51.5005, longitude: -1.2505 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  // No real address lookups: a made-up answer for the spot above.
  await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({
    contentType: 'application/json', body: JSON.stringify({ display_name: 'x',
      address: { house_number: '4', road: 'Wharf Lane', suburb: 'Lower End', town: 'Testbury',
        county: 'Midshire', state: 'England', postcode: 'ZZ1 1ZZ', country: 'United Kingdom' } }) }));
  await p.route('https://fonts.gstatic.com/s/e/notoemoji/**', r => r.abort());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const shown = id => ev(id => !document.getElementById(id).classList.contains('hidden'), id);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && w.table === table), [op, table]);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); });

  console.log('\nToday: party popper on the day, woozy face the day after (ML128)');
  await ev(() => {
    const ago = n => { const d = new Date(); d.setDate(d.getDate() + n);
      return (d.getFullYear() - 30) + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    CONTACTS.push({ id: 801, created_by: 'me', first_name: 'Birthday', last_name: 'Today', birth_date: ago(0), contact_groups: [] },
      { id: 802, created_by: 'me', first_name: 'Birthday', last_name: 'Yesterday', birth_date: ago(-1), contact_groups: [] },
      { id: 803, created_by: 'me', first_name: 'Birthday', last_name: 'Later', birth_date: ago(3), contact_groups: [] });
    openBrief();
  });
  await settle(600);
  const icons = await ev(() => Object.fromEntries([801, 802, 803].map(id => {
    const c = document.querySelector(`[data-briefc="${id}"] .bcake`);
    return [id, c ? { cls: c.className, img: (c.querySelector('img') || {}).src || '', text: c.textContent.trim() } : null];
  })));
  ok('on the day: a moving party popper', icons[801] && /party/.test(icons[801].cls)
    && await ev(() => /<img src="https:\/\/fonts\.gstatic\.com\/s\/e\/notoemoji\/latest\/1f389\/512\.webp"/
      .test(bdayIcon(0))), JSON.stringify(icons[801]));
  ok('the day after: the woozy face', icons[802] && /hangover/.test(icons[802].cls)
    && icons[802].text === '\u{1F974}', JSON.stringify(icons[802]));
  ok('later in the week: still the cake', icons[803] && icons[803].text === '\u{1F382}'
    && !icons[803].img, JSON.stringify(icons[803]));
  await settle(300);
  ok('with no signal the popper is a still one instead of a broken picture',
    await ev(() => { const c = document.querySelector('[data-briefc="801"] .bcake');
      return !c.querySelector('img') && c.textContent.trim() === '\u{1F389}'; }));
  ok('the rows still say who and how old',
    await ev(() => /Turns 30 today/.test(document.querySelector('[data-briefc="801"]').textContent)
      && /Turned 30/.test(document.querySelector('[data-briefc="802"]').textContent)));
  await ev(() => { CONTACTS.splice(CONTACTS.findIndex(c => c.id === 801), 3); });
  await closeAll();

  console.log('\nRegular: hold a job and slide it (ML129)');
  await ev(() => {
    window.__rows.routines = [
      { id: 41, title: 'Oil change', heading: 'Boat', done: false, sort_order: 10, photos: [] },
      { id: 42, title: 'Grease the stern gland', heading: 'Boat', done: false, sort_order: 11, photos: [] },
      { id: 43, title: 'Check the bilge', heading: 'Boat', done: false, sort_order: 12, photos: [] },
      { id: 44, title: 'Blacking', heading: 'Boat', done: true, done_at: '2026-10-01T10:00:00Z', sort_order: 13, photos: [] },
      { id: 45, title: 'MOT', heading: 'Car', done: false, sort_order: 5, photos: [] }];
  });
  await ev(async () => { await loadAll(); DIARY_VIEW = 'routine'; openDiary(); });
  await settle(600);
  const order = () => ev(() => [...document.querySelector('[data-rtdrag="41"]').parentElement.children]
    .filter(e => e.matches('[data-rtdrag]')).map(e => +e.dataset.rtdrag));
  ok('jobs still to do can be moved', (await order()).join() === '41,42,43', (await order()).join());
  ok('done jobs cannot', await ev(() => !document.querySelector('[data-rtdrag="44"]')));
  ok('the hint under the add box says how',
    await ev(() => /Hold one for a moment and slide it/.test($('diaryBody').textContent)));
  ok('a long press will not select the words',
    await ev(() => getComputedStyle(document.querySelector('[data-rtdrag="41"]')).userSelect === 'none'));

  const box = id => ev(id => { const r = document.querySelector(`[data-rtdrag="${id}"] .mid`).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; }, id);
  // A quick tap still opens the job.
  let a = await box(41);
  await p.mouse.click(a.x, a.y); await settle(400);
  ok('a quick tap still opens the job', await shown('rtEd'));
  await ev(() => shutRoutine()); await settle(200);

  // Moving straight away is a scroll, not a drag.
  await ev(() => { window.__writes.length = 0; });
  a = await box(41);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  await p.mouse.move(a.x, a.y + 60, { steps: 4 }); await settle(600);
  await p.mouse.move(a.x, a.y + 120, { steps: 4 }); await p.mouse.up(); await settle(400);
  ok('moving before the half second is a scroll, not a move',
    (await writes('update', 'routines')).length === 0 && !(await ev(() => !!document.querySelector('.lifted'))));
  await ev(() => shutRoutine()); await settle(200);

  // Hold, then slide the first job below the third.
  await ev(() => { window.__writes.length = 0; renderDiary(); }); await settle(200);
  a = await box(41); const c = await box(43);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await settle(650);
  ok('held still, the job lifts', await ev(() => document.querySelector('[data-rtdrag="41"]').classList.contains('lifted')));
  await p.mouse.move(a.x, (a.y + c.y) / 2, { steps: 6 });
  await p.mouse.move(a.x, c.y + 12, { steps: 6 });
  ok('it slides past the others as you go', (await order()).join() === '42,43,41', (await order()).join());
  await p.mouse.up(); await settle(500);
  ok('letting go does not open it', !(await shown('rtEd')));
  const ups = await writes('update', 'routines');
  const to = Object.fromEntries(ups.map(w => [w.where.find(x => x[0] === 'eq' && x[1] === 'id')[2], w.patch.sort_order]));
  ok('the new order is saved, using the same numbers', to[42] === 10 && to[43] === 11 && to[41] === 12,
    JSON.stringify(to));
  ok('only that heading is touched', !(45 in to) && !(44 in to), JSON.stringify(to));
  ok('nothing is left lifted', await ev(() => !document.querySelector('.lifted') && !document.body.classList.contains('jobdrag')));

  // Two on the same number: numbered afresh so the order sticks.
  await ev(() => { window.__writes.length = 0;
    window.__rows.routines.forEach(r => { if (r.heading === 'Boat') r.sort_order = 7; }); });
  await ev(() => loadAll().then(renderDiary)); await settle(400);
  const first = await ev(() => +document.querySelector('[data-rtdrag]').parentElement
    .querySelector('[data-rtdrag]').dataset.rtdrag);
  a = await box(first);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await settle(650);
  await p.mouse.move(a.x, a.y + a.h * 1.4, { steps: 8 }); await p.mouse.up(); await settle(500);
  const nums = (await writes('update', 'routines')).map(w => w.patch.sort_order);
  ok('jobs sharing a number get numbers of their own', nums.length >= 2 && new Set(nums).size === nums.length,
    JSON.stringify(nums));
  ok('the Help says how to move a job', await ev(() =>
    /hold a job still for a moment until it lifts/.test(document.body.innerHTML)));
  await closeAll();

  console.log('\nSent to you: look first, and the sender is told (ML130)');
  await ev(() => {
    window.__rows.contact_offers = [
      { id: 61, from_user: 'sandra', to_user: 'me', name: 'Pat Example', decided_at: null, outcome: null,
        payload: { first_name: 'Pat', last_name: 'Example', partner_name: 'Sam', town: 'Testbury',
          birth_date: '2001-11-06', phones: [{ label: 'Mobile', value: '07700 900111' }] } },
      { id: 62, from_user: 'me', to_user: 'sandra', name: 'Dickie Deal', decided_at: '2026-11-03T09:00:00Z', outcome: 'accepted', payload: {} },
      { id: 63, from_user: 'me', to_user: 'other', name: 'Bob Builder', decided_at: '2026-11-04T09:00:00Z', outcome: 'declined', payload: {} },
      { id: 64, from_user: 'me', to_user: 'other', name: 'Old Handover', decided_at: '2026-10-01T09:00:00Z', outcome: 'accepted', payload: {} },
      { id: 65, from_user: 'me', to_user: 'sandra', name: 'Still Waiting', decided_at: null, outcome: null, payload: {} },
      { id: 66, from_user: 'sandra', to_user: 'other', name: 'Not Mine', decided_at: '2026-11-04T09:00:00Z', outcome: 'accepted', payload: {} }];
  });
  await ev(() => loadAll()); await settle(300);
  ok('the tile counts the one waiting and the two answers', await ev(() => tilePip('offers')) === 3,
    String(await ev(() => tilePip('offers'))));
  await ev(() => openOffers()); await settle(300);
  const off = await ev(() => $('offBody').textContent.replace(/\s+/g, ' '));
  ok('you are told Sandra accepted the one you sent', /Sandra accepted Dickie Deal/.test(off), off.slice(0, 200));
  ok('and who said no thanks', /Someone Else said no thanks to Bob Builder/.test(off));
  ok('older decisions are left in peace', !/Old Handover/.test(off));
  ok('nothing about other people’s sending', !/Not Mine/.test(off) && !/Still Waiting/.test(off));
  ok('the one sent to you is still listed', /Pat Example/.test(off) && /from Sandra/.test(off));
  ok('the note says you can look first', /Tap one to look at it before you decide/.test(off));

  await ev(() => { window.__writes.length = 0; });
  await p.click('[data-offone="61"]'); await settle(300);
  ok('tapping it opens a look at the contact', await ev(() => !!$('offView')));
  const look = await ev(() => $('offView').textContent.replace(/\s+/g, ' '));
  ok('with its details', /Testbury/.test(look) && /Mobile: 07700 900111/.test(look)
    && /6 November 2001/.test(look) && /Partner's name Sam/.test(look), look.slice(0, 240));
  ok('and nothing saved yet', (await writes('insert', 'contacts')).length === 0
    && (await writes('update', 'contact_offers')).length === 0);
  await p.click('#ovLeave'); await settle(200);
  ok('Leave it closes it and keeps it waiting', await ev(() => !$('offView'))
    && (await writes('update', 'contact_offers')).length === 0);
  await p.click('[data-offone="61"]'); await settle(300);
  await p.click('#ovYes'); await settle(600);
  const ins = await writes('insert', 'contacts');
  ok('Accept adds it to your contacts', ins.length === 1 && ins[0].rows.first_name === 'Pat');
  ok('and marks it accepted, so the sender is told',
    (await writes('update', 'contact_offers')).some(w => w.patch.outcome === 'accepted'));
  await closeAll();

  await ev(() => { window.__writes.length = 0; openOffers(); }); await settle(300);
  ok('OK to all shows when there are several', await ev(() => !!document.querySelector('[data-offseen="all"]')));
  await p.click('[data-offseen="62"]'); await settle(400);
  const del = (await writes('delete', 'contact_offers')).pop();
  const inIds = del && del.where.find(x => x[0] === 'in');
  ok('OK clears that one answer away', inIds && inIds[2].join() === '62', JSON.stringify(del && del.where));
  ok('and it goes from the screen', await ev(() => !/Dickie Deal/.test($('offBody').textContent)
    && /Bob Builder/.test($('offBody').textContent)));
  ok('the tile number drops', await ev(() => tilePip('offers')) === 2);
  ok('the Help says the sender is told', await ev(() =>
    /You are told what they decided/.test(document.body.innerHTML)));
  await closeAll();

  console.log('\nMaps: Our location and the x in the Find box (ML131, ML132)');
  await ev(() => openEditor(CONTACTS.find(c => c.id === 1))); await settle(700);
  ok('the home map has Our location', await ev(() => !!document.querySelector('#homeMap .herebtn')));
  ok('so does the where-we-met map', await ev(() => !!document.querySelector('#metEditMap .herebtn')));
  ok('the Find box has an x', await ev(() => $('geoQ').parentElement.classList.contains('geoin')
    && !!$('geoQ').parentElement.querySelector('.geox')));
  ok('the x shows when there is something to empty', await ev(() => {
    $('geoQ').value = 'Botley'; return getComputedStyle($('geoQ').nextElementSibling).display !== 'none'; }));
  await p.click('#geoQ + .geox'); await settle(200);
  ok('and one tap empties the box', await ev(() => $('geoQ').value === ''));
  ok('the x hides again when it is empty', await ev(() => getComputedStyle($('geoQ').nextElementSibling).display === 'none'));
  await ev(() => { const f = $('edForm');
    f.elements.address.value = '1 Old Road'; f.elements.address_2.value = 'Somewhere';
    f.elements.town.value = 'Oldtown'; f.elements.postcode.value = 'OL1 1DD'; });
  await p.click('#homeMap .herebtn'); await settle(900);
  const got = await ev(() => { const f = $('edForm');
    return { a: f.elements.address.value, a2: f.elements.address_2.value, t: f.elements.town.value,
      c: f.elements.county.value, pc: f.elements.postcode.value, co: f.elements.country.value,
      q: $('geoQ').value, lat: DRAFT.lat, lng: DRAFT.lng }; });
  ok('Our location moves the pin to where the phone is', Math.abs(got.lat - 51.5005) < 1e-6
    && Math.abs(got.lng + 1.2505) < 1e-6, JSON.stringify(got));
  ok('and writes over the old address', got.a === '4 Wharf Lane' && got.a2 === 'Lower End' && got.t === 'Testbury'
    && got.c === 'Midshire' && got.pc === 'ZZ1 1ZZ' && got.co === 'United Kingdom', JSON.stringify(got));
  ok('with the address in the Find box', got.q === '4 Wharf Lane, Lower End, Testbury, ZZ1 1ZZ, United Kingdom', got.q);
  ok('nothing is saved until Save', (await writes('update', 'contacts')).length === 0);
  await p.click('#metEditMap .herebtn'); await settle(900);
  ok('on the where-we-met map it moves that pin, and leaves the address alone',
    await ev(() => Math.abs(DRAFT.mlat - 51.5005) < 1e-6 && $('edForm').elements.address.value === '4 Wharf Lane'
      && /Wharf Lane/.test($('metQ').value)));
  await closeAll();

  await ev(() => { window.__TODAY = isoDay(new Date()); editLog(window.__TODAY); }); await settle(700);
  ok('the Daily Log map has Our location and the x', await ev(() =>
    !!document.querySelector('#logEditMap .herebtn') && $('logGeoQ').parentElement.classList.contains('geoin')));
  await p.click('#logEditMap .herebtn'); await settle(900);
  ok('and it moves that pin', await ev(() => Math.abs(LOGDRAFT.blat - 51.5005) < 1e-6
    && /Testbury/.test($('logGeoQ').value)));
  await ev(() => $('placeAdd') && $('placeAdd').click()); await settle(500);
  ok('a "somewhere else" place gets them too', await ev(() =>
    !!document.querySelector('#pmap0 .herebtn')
    && document.querySelector('[data-pq="0"]').parentElement.classList.contains('geoin')));
  ok('the Help mentions Our location', await ev(() => /<strong>Our location<\/strong>/.test(document.body.innerHTML)));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
