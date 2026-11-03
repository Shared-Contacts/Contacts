// My Stuff (ML135, step 50): the things you own and their papers. Types with
// their own boxes, photos and PDFs, a service record, Share with, due dates
// as Diary to-dos with a push a week before, and no passwords.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const shown = id => ev(id => !document.getElementById(id).classList.contains('hidden'), id);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && (!table || w.table === table)), [op, table]);
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); });
  const day = n => ev(n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); }, n);

  console.log('\nThe tile');
  ok('My Stuff can go on the home screen', await ev(() => TILE_DEST.stuff && TILE_DEST.stuff.label === 'My Stuff'));
  ok('a new person gets it, just before Settings', await ev(() =>
    TILE_DEFAULTS.indexOf('stuff') === TILE_DEFAULTS.indexOf('settings') - 1));
  ok('someone with tiles already set out gets it at the end', await ev(() => {
    const was = MY_PROFILE;
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }, { dest: 'settings' }], hidden: [] } };
    loadTiles(); const got = TILES.map(t => t.dest);
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: ['stuff'] } };
    loadTiles(); const binned = TILES.map(t => t.dest);
    MY_PROFILE = was; loadTiles();
    return got[got.length - 1] === 'stuff' && !binned.includes('stuff');
  }));
  ok('it is a place in the menu', await ev(() => AREAS.stuff && AREAS.stuff.title === 'My Stuff'
    && areaItems('stuff').some(x => x.label === 'Add something')));
  ok('and has its own Help', await ev(() => { openHelp('stuff');
    const h = document.getElementById('h-stuff'); $('help').classList.add('hidden');
    return !!h && /Passwords/.test(h.parentElement.innerHTML); }));

  console.log('\nBefore step 50, and when it will not load');
  const whyText = msg => ev(async msg => {
    const real = sb.from;
    sb.from = t => (t === 'stuff' || t === 'stuff_service')
      ? { select: () => ({ order: () => Promise.resolve({ data: null, error: { message: msg } }) }) } : real(t);
    const e0 = console.error; console.error = () => {};
    await openStuff(); sb.from = real; console.error = e0;
    return $('stfBody').textContent.replace(/\s+/g, ' ');
  }, msg);
  let why = await whyText('relation "public.stuff" does not exist');
  ok('no table yet: it says to run step 50', /Run the step 50 file in Supabase/.test(why), why.slice(0, 120));
  ok('and does not pretend the list is empty', !/Nothing here yet/.test(why));
  why = await whyText('Failed to fetch');
  ok('a failed load says nothing has been lost', /Nothing has been lost/.test(why) && !/Nothing here yet/.test(why), why.slice(0, 120));
  await closeAll();

  console.log('\nThe list');
  const soon = await day(10), later = await day(200), old = await day(-400), next = await day(300);
  await ev(([soon, later, old, next]) => {
    window.__rows.stuff = [
      { id: 1, created_by: 'me', kind: 'vehicle', name: 'The car', notes: 'Spare key in the drawer',
        login_where: 'Google Password Manager, under DVLA',
        details: { make: 'Ford', model: 'Focus', reg: 'AB12 CDE', mot_due: soon, mot_price: '54.85',
          insurance_due: later, tax_due: old },
        photos: [{ path: 'stf/me/car.jpg' }], files: [{ path: 'stf/me/v5.pdf', name: 'V5 logbook' }],
        shared_with: ['sandra'], reminders: {} },
      { id: 2, created_by: 'me', kind: 'document', name: 'My will', details: { kept_where: 'The solicitor' },
        photos: [], files: [], shared_with: [], reminders: {} },
      { id: 3, created_by: 'sandra', kind: 'vehicle', name: 'The boat', details: { make: 'Narrowboat' },
        photos: [], files: [], shared_with: ['me'], reminders: {} }];
    window.__rows.stuff_service = [
      { id: 11, stuff_id: 1, done_on: '2025-03-01', where_done: 'Old garage', price: 120, work: 'Oil and filter', next_due: '2026-03-01' },
      { id: 12, stuff_id: 1, done_on: '2026-03-02', where_done: 'Main dealer', price: 210.5, work: 'Full service', next_due: next },
      { id: 13, stuff_id: 3, done_on: '2026-05-01', where_done: 'Boatyard', price: 400, work: 'Blacking', next_due: null }];
  }, [soon, later, old, next]);
  await ev(() => openStuff()); await settle(400);
  let list = await ev(() => $('stfBody').textContent.replace(/\s+/g, ' '));
  ok('grouped by type', /Vehicles/.test(list) && /Documents/.test(list) && !/Insurance policies/.test(list), list.slice(0, 200));
  ok('a row says what it is', /The car Ford · Focus · AB12 CDE/.test(list), list.slice(0, 200));
  ok('anything due within 30 days is in red', await ev(() =>
    /MOT due/.test((document.querySelector('[data-stf="1"] .late') || {}).textContent || '')));
  ok('one shared with you says who from', /The boat Narrowboat from Sandra/.test(list));

  console.log('\nLooking at one');
  await p.click('[data-stf="1"]'); await settle(300);
  ok('it opens', await shown('stuffView') && await ev(() => $('stfViewTitle').textContent) === 'The car');
  let view = await ev(() => $('stfView').innerText.replace(/\s+/g, ' '));
  ok('with its boxes', /Registration AB12 CDE/.test(view) && /MOT price £54\.85/.test(view), view.slice(0, 240));
  ok('the MOT says how soon', /MOT due .* in 10 days/.test(view));
  ok('where the login is kept, and who it is shared with',
    /Where the login is kept Google Password Manager, under DVLA/.test(view) && /Shared with Sandra/.test(view));
  ok('photos and PDFs', await ev(() => !!document.querySelector('[data-stfpic="0"]')
    && /V5 logbook/.test(document.querySelector('[data-stfpdf="0"]').textContent)));
  ok('the service record, newest first', await ev(() => {
    const t = [...document.querySelectorAll('[data-stfsv]')].map(e => e.dataset.stfsv); return t.join() === '12,11'; }));
  ok('with the next due date', /Main dealer · £210\.50/.test(view) && /Next due/.test(view));
  ok('yours can be changed', await ev(() => !!$('stfEditBtn') && !!$('stfSvAdd')));

  // Opening a PDF: a window first, then the link.
  await ev(() => { window.__opened = { location: {} }; window.__open0 = window.open;
    window.open = () => window.__opened; });
  await p.click('[data-stfpdf="0"]'); await settle(300);
  ok('a PDF opens in its own window', await ev(() =>
    window.__opened.location.href === 'https://signed.test/stf/me/v5.pdf'), await ev(() => JSON.stringify(window.__opened)));
  await ev(() => { window.open = window.__open0; });

  console.log('\nThe service record');
  await clearWrites();
  await p.click('#stfSvAdd'); await settle(300);
  ok('Add a service opens a form', await ev(() => !!$('stfSvBox')));
  ok('it asks for date, where, price, parts and work, and next due', await ev(() => {
    const f = $('stfSvForm'); return ['done_on', 'where_done', 'price', 'work', 'next_due'].every(n => f.elements[n]); }));
  await ev(() => { const f = $('stfSvForm'); f.elements.where_done.value = 'Kwik Fit';
    f.elements.price.value = '£1,089.99'; f.elements.work.value = 'Tyres x4'; f.elements.next_due.value = '2027-11-01'; });
  await p.click('#stfSvGo'); await settle(600);
  const sv = (await writes('insert', 'stuff_service')).pop();
  ok('it is saved against the car', sv && sv.rows.stuff_id === 1 && sv.rows.price === 1089.99
    && sv.rows.work === 'Tyres x4' && sv.rows.next_due === '2027-11-01' && sv.rows.created_by === 'me',
    JSON.stringify(sv && sv.rows));
  await clearWrites();
  await p.click('[data-stfsvx="11"]'); await settle(500);
  const svdel = (await writes('delete', 'stuff_service')).pop();
  ok('× removes one', svdel && svdel.where.some(w => w[1] === 'id' && w[2] === 11));
  await closeAll();

  console.log('\nOne shared with you');
  await ev(() => openStuffThing(3)); await settle(300);
  view = await ev(() => $('stfView').innerText.replace(/\s+/g, ' '));
  ok('you can look', /Blacking/.test(view) && /Shared by Sandra/.test(view));
  ok('but not change it', await ev(() => !$('stfEditBtn') && !$('stfSvAdd')
    && !document.querySelector('[data-stfsvx]') && !document.querySelector('[data-stfsv]')));
  await closeAll();

  console.log('\nAdding something');
  await ev(() => openStuff()); await settle(300);
  await p.click('#stfAdd'); await settle(200);
  ok('first it asks what it is', await ev(() =>
    [...document.querySelectorAll('[data-stfkind]')].map(b => b.dataset.stfkind).join()) === 'vehicle,boat,item,property,document,policy,loyalty');
  const boxesFor = k => ev(k => { document.querySelectorAll('.daypick').forEach(d => d.remove());
    openStuffEd(null, k);
    return [...$('stfForm').querySelectorAll('label')].map(l => l.firstChild.textContent.trim()).join('|'); }, k);
  const vb = await boxesFor('vehicle');
  ok('a vehicle asks for registration, MOT, insurance and tax',
    /Registration/.test(vb) && /MOT due/.test(vb) && /MOT test number/.test(vb) && /Insurance renews/.test(vb)
    && /Road tax or licence renews/.test(vb) && /Value now/.test(vb), vb);
  const ib = await boxesFor('item');
  ok('an item asks for serial number and warranty, not MOT', /Serial number/.test(ib) && /Warranty until/.test(ib) && !/MOT/.test(ib), ib);
  const pb = await boxesFor('property');
  ok('property asks for the address', /Address/.test(pb) && /Insurance renews/.test(pb) && !/Registration/.test(pb));
  const db = await boxesFor('document');
  ok('a document asks where the original is kept', /Where the original is kept/.test(db) && /Renew or expiry date/.test(db));
  const yb = await boxesFor('policy');
  ok('an insurance policy asks for insurer and policy number', /Insurer/.test(yb) && /Policy number/.test(yb) && /What it covers/.test(yb));
  ok('everything has photos, PDFs and where the login is kept', /Where the login is kept/.test(yb)
    && await ev(() => !!document.querySelector('#stfPics') && !!$('stfPdfAdd')));
  ok('nowhere to type a password', await ev(() => !$('stfEdBody').querySelector('input[type=password]')
    && !/name="[^"]*pass/i.test($('stfEdBody').innerHTML)));
  await ev(() => $('stfEdCancel').click()); await settle(200);

  await clearWrites();
  await ev(() => openStuffEd(null, 'vehicle')); await settle(200);
  await ev(() => { const f = $('stfForm'); f.elements.name.value = 'The van';
    f.elements.d_make.value = 'Bedford'; f.elements.d_mot_price.value = 'lots'; });
  await p.click('#stfSave'); await settle(300);
  ok('a price that is not a number is refused', (await writes('insert', 'stuff')).length === 0
    && /MOT price needs to be a number/.test(await said()), await said());
  await ev(() => { const f = $('stfForm'); f.elements.d_mot_price.value = '£1,234.50';
    f.querySelector('[name="share"][value="sandra"]').checked = true; });
  await p.click('#stfSave'); await settle(600);
  const ins = (await writes('insert', 'stuff')).pop();
  ok('saved as yours, with its type', ins && ins.rows.created_by === 'me' && ins.rows.kind === 'vehicle'
    && ins.rows.name === 'The van', JSON.stringify(ins && ins.rows).slice(0, 200));
  ok('its boxes go in details, the price as a plain number', ins && ins.rows.details.make === 'Bedford'
    && ins.rows.details.mot_price === '1234.50' && !('reg' in ins.rows.details));
  ok('shared with the people ticked', ins && JSON.stringify(ins.rows.shared_with) === '["sandra"]');

  console.log('\nPDFs');
  await clearWrites();
  await ev(() => openStuffEd(window.__rows.stuff[1])); await settle(200);
  await ev(async () => {
    await stfAddPdfs([new File(['%PDF-1.4 test'], 'Will 2024.pdf', { type: 'application/pdf' }),
      new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
      new File([new Uint8Array(21 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' })]);
  });
  const ups = await writes('upload');
  ok('a PDF goes into your own folder', ups.length === 1 && /^stf\/me\/.+\.pdf$/.test(ups[0].path)
    && ups[0].type === 'application/pdf', JSON.stringify(ups));
  ok('it is listed by its name', await ev(() => /Will 2024/.test($('stfPdfs').textContent)));
  ok('a picture is sent to Photos instead', /pictures go under Photos/.test(await said()));
  ok('anything over 20 MB is refused', /huge\.pdf is over 20 MB/.test(await said()));
  const upPath = ups[0] && ups[0].path;
  await ev(() => $('stfEdCancel').click()); await settle(300);
  ok('cancelled, the new PDF is cleared away', (await writes('rmfile')).some(w => w.paths.includes(upPath)));
  await closeAll();

  console.log('\nDue dates go into the Diary');
  await clearWrites();
  await ev(() => { ITEMS.length = 0; });
  await ev(async () => { await loadStuff(); await stfSyncReminders(STUFF.find(x => x.id === 1)); });
  const made = await writes('insert', 'items');
  const titles = made.map(w => w.rows.title).sort();
  ok('a to-do for the MOT, the insurance and the next service',
    titles.join('|') === 'Insurance renewal: The car|MOT due: The car|Service due: The car', titles.join('|'));
  ok('a date long gone is left out', !titles.some(t => /Tax/.test(t)));
  const mot = made.find(w => /MOT/.test(w.rows.title));
  ok('each one is a to-do on the day, reminding a week before', mot && mot.rows.kind === 'todo'
    && mot.rows.created_by === 'me' && mot.rows.remind_mins === 10080
    && new Date(mot.rows.due_at) - new Date(mot.rows.remind_at) === 7 * 864e5
    && isoDayOf(mot.rows.due_at) === soon, JSON.stringify(mot && mot.rows));
  function isoDayOf(s) { const d = new Date(s); const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  ok('a week is one of the Diary’s own reminder choices', await ev(() => REMIND_CHOICES.some(c => c[0] === '10080')));
  const rem = (await writes('update', 'stuff')).pop();
  ok('the car remembers which to-do is which', rem && Object.keys(rem.patch.reminders).sort().join() === 'insurance_due,mot_due,service');

  // Now the to-dos exist. Move the MOT, take the insurance away, leave the service.
  await clearWrites();
  const later2 = await day(40);
  await ev(([soon, next, later2]) => {
    const due = d => new Date(d + 'T09:00:00').toISOString();
    ITEMS.length = 0;
    ITEMS.push({ id: 901, kind: 'todo', title: 'MOT due: The car', due_at: due(soon), done_at: '2026-11-01T10:00:00Z' },
      { id: 902, kind: 'todo', title: 'Insurance renewal: The car', due_at: due(soon), done_at: null },
      { id: 903, kind: 'todo', title: 'Service due: The car', due_at: due(next), done_at: null });
    const t = STUFF.find(x => x.id === 1);
    t.reminders = { mot_due: 901, insurance_due: 902, service: 903 };
    t.details = { ...t.details, mot_due: later2 }; delete t.details.insurance_due;
    return stfSyncReminders(t);
  }, [soon, next, later2]);
  const upd = await writes('update', 'items'), del = await writes('delete', 'items');
  const u901 = upd.find(w => w.where.some(x => x[2] === 901));
  ok('a new MOT date moves its to-do', u901 && isoDayOf(u901.patch.due_at) === later2, JSON.stringify(upd));
  ok('and puts it back as needing doing, with the reminder to go again',
    u901 && u901.patch.done_at === null && u901.patch.pushed_at === null);
  ok('a date taken away removes its to-do', del.length === 1 && del[0].where.some(x => x[2] === 902));
  ok('an unchanged one is left alone', !upd.some(w => w.where.some(x => x[2] === 903)) && (await writes('insert', 'items')).length === 0);
  await clearWrites();
  await ev(() => stfSyncReminders(STUFF.find(x => x.id === 3)));
  ok('nothing goes into your Diary for someone else’s thing', (await writes('insert', 'items')).length === 0);

  console.log('\nDeleting');
  await clearWrites();
  await ev(() => { ITEMS.length = 0;
    ITEMS.push({ id: 801, kind: 'todo', title: 'MOT due: The car', due_at: new Date().toISOString(), done_at: null },
      { id: 802, kind: 'todo', title: 'Service due: The car', due_at: new Date().toISOString(), done_at: '2026-10-01T10:00:00Z' });
    return stfDelete({ ...STUFF.find(x => x.id === 1), reminders: { mot_due: 801, service: 802 } });
  });
  await settle(400);
  ok('the thing is deleted', (await writes('delete', 'stuff')).some(w => w.where.some(x => x[2] === 1)));
  const idel = (await writes('delete', 'items')).pop();
  ok('its to-do still waiting goes; a ticked one stays', idel && JSON.stringify(idel.where.find(x => x[0] === 'in')[2]) === '[801]');
  const rm = (await writes('rmfile')).pop();
  ok('and your photos and PDFs with it', rm && rm.paths.includes('stf/me/car.jpg') && rm.paths.includes('stf/me/v5.pdf'));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
