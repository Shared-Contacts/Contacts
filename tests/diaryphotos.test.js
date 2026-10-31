// Regular jobs and photos (asked for 28 Oct 2026, ML74 to ML76): a new
// regular job starts under ASAP; an ASAP job tapped on Today opens the
// Regular list with it picked out; appointments, to-dos and regular jobs
// can carry photos, kept as dia/<user>/... (step 46).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

// A real (tiny) picture, so the page's shrinking step has something to draw.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const pic = n => ({ name: 'photo' + n + '.png', mimeType: 'image/png', buffer: PNG });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const writes = () => ev(() => window.__writes);
  const clear = () => ev(() => { window.__writes = []; });
  const last = async (op, table) => (await writes()).filter(w => w.op === op && (!table || w.table === table)).pop();
  const visible = id => ev(i => !document.getElementById(i).classList.contains('hidden'), id);

  await ev(async () => {
    window.__rows.routines = [
      { id: 1, created_by: 'me', title: 'Tax return', heading: 'ASAP', done: false, sort_order: 1, photos: [] },
      { id: 2, created_by: 'me', title: 'Paint the roof', heading: 'Boat', done: false, sort_order: 2,
        photos: [{ path: 'dia/me/roof.jpg' }] },
      { id: 3, created_by: 'me', title: 'Oil change', heading: 'Boat', done: false, sort_order: 3 }];
    const at = h => { const x = new Date(); x.setHours(h, 0, 0, 0); return x.toISOString(); };
    window.__rows.items = [
      { id: 10, created_by: 'me', kind: 'todo', title: 'Fix the pump', due_at: at(23), photos: [] },
      { id: 11, created_by: 'sandra', kind: 'appointment', title: 'Boat survey', starts_at: at(23),
        photos: [{ path: 'dia/sandra/hull.jpg' }, { path: 'dia/me/prop.jpg' }] },
      { id: 12, created_by: 'me', kind: 'todo', title: 'Before step 46', due_at: at(23) }];
    window.__rows.item_shares = [{ item_id: 11, user_id: 'me', can_edit: true }];
    await loadAll();
  });

  // ---------------------------------------------------------------
  console.log('\nA new regular job starts under ASAP');
  await ev(() => { DIARY_VIEW = 'routine'; openDiary(); }); await settle();
  ok('the heading box already says ASAP', await ev(() => $('rtHead').value) === 'ASAP');
  await p.focus('#rtHead');
  ok('tapping it selects the word, so typing replaces it',
     await ev(() => { const h = $('rtHead'); return h.selectionStart === 0 && h.selectionEnd === 4; }));
  await clear();
  await p.fill('#rtTitle', 'Ring the boatyard'); await ev(() => $('rtHead').value = 'ASAP');
  await p.click('#rtAdd'); await settle();
  let w = await last('insert', 'routines');
  ok('left alone, the job goes in under ASAP', w && w.rows.heading === 'ASAP' && w.rows.title === 'Ring the boatyard',
     JSON.stringify(w && w.rows));
  await p.fill('#rtTitle', 'Paint the tiller'); await p.fill('#rtHead', 'Boat');
  await p.click('#rtAdd'); await settle();
  w = await last('insert', 'routines');
  ok('another heading can be typed instead', w && w.rows.heading === 'Boat');
  ok('and the box keeps it for the next job', await ev(() => $('rtHead').value) === 'Boat');
  await p.fill('#rtTitle', 'Something loose'); await p.fill('#rtHead', '');
  await p.click('#rtAdd'); await settle();
  w = await last('insert', 'routines');
  ok('cleared, the job has no heading', w && w.rows.heading === null);
  await ev(() => renderDiary()); await settle(100);
  ok('the list opened afresh says ASAP again', await ev(() => $('rtHead').value) === 'ASAP');

  // ---------------------------------------------------------------
  console.log('\nTapping an ASAP job on Today');
  await ev(() => { DIARY_VIEW = 'list'; $('diary').classList.add('hidden'); lockBackground(); openBrief(); });
  await settle();
  ok('the ASAP job is a button', await ev(() => !!document.querySelector('#briefBody button[data-briefr="1"]')));
  ok('only ASAP jobs are on Today', await ev(() => !document.querySelector('[data-briefr="2"]')));
  await p.click('[data-briefr="1"]'); await settle(300);
  ok('Today closes', !(await visible('brief')));
  ok('the Diary opens', await visible('diary'));
  ok('with the job’s own screen open over it (ML121)', await visible('rtEd')
    && await ev(() => $('rtForm').elements.title.value) === 'Tax return');
  ok('on the Regular list', await ev(() => DIARY_VIEW === 'routine'
    && document.querySelector('[data-dview="routine"]').getAttribute('aria-pressed') === 'true'));
  ok('the job is picked out', await ev(() =>
    document.querySelector('[data-rtedit="1"]').closest('.item').classList.contains('flashrow')));
  ok('and only that one', await ev(() => document.querySelectorAll('.flashrow').length) === 1);
  await settle(2800);
  ok('the picking out fades after a moment', await ev(() => !document.querySelector('.flashrow')));
  ok('the Diary remembers Regular next time', await ev(() => localStorage.getItem('dview')) === 'routine');
  await p.click('#rtCancel'); await settle(200);
  ok('Cancel goes back to the Regular list', !(await visible('rtEd')) && await visible('diary'));

  // ---------------------------------------------------------------
  console.log('\nOpening a regular job');
  ok('a job with photos says how many on the list',
     /📷 1/.test(await ev(() => document.querySelector('[data-rtedit="2"]').textContent)));
  await clear();
  await p.click('[data-rtedit="1"]'); await settle();
  ok('tapping a job opens its own screen', await visible('rtEd'));
  ok('with the wording and heading in it', await ev(() =>
    $('rtForm').elements.title.value === 'Tax return' && $('rtForm').elements.heading.value === 'ASAP'));
  ok('and a Photos section with Camera and Choose', await ev(() =>
    /Photos/.test($('rtBody').textContent) && $('rtBody').querySelectorAll('[data-dphadd]').length === 2
    && !!$('rtBody').querySelector('[data-dphadd][capture]')));
  ok('saying none yet', /None yet/.test(await ev(() => $('rtPics').textContent)));
  await p.fill('#rtForm input[name="title"]', 'Tax return 2025-26');
  await p.fill('#rtForm input[name="heading"]', 'Admin');
  await p.click('#rtSave'); await settle();
  w = await last('update', 'routines');
  ok('Save changes the wording and heading', w && w.patch.title === 'Tax return 2025-26' && w.patch.heading === 'Admin',
     JSON.stringify(w && w.patch));
  ok('without sending photos when there are none (works before step 46)', w && !('photos' in w.patch));
  ok('the screen closes', !(await visible('rtEd')));

  console.log('\nAdding a photo to a regular job');
  await clear();
  await ev(() => openRoutine(ROUTINES.find(r => r.id === 3))); await settle();
  await p.setInputFiles('#rtBody [data-dphadd]:not([capture])', [pic(1), pic(2)]); await settle(900);
  let ups = (await writes()).filter(x => x.op === 'upload');
  ok('both photos go up', ups.length === 2, JSON.stringify(ups));
  ok('into your own diary folder, as JPEGs', ups.every(u => /^dia\/me\/[\w-]+\.jpg$/.test(u.path) && u.type === 'image/jpeg'),
     JSON.stringify(ups.map(u => u.path)));
  ok('two thumbnails show', await ev(() => $('rtPics').querySelectorAll('img').length) === 2);
  await p.click('#rtPics [data-dphview="0"]'); await settle(200);
  ok('tapping one shows it full size', await ev(() => !!document.querySelector('.lightbox img')));
  await ev(() => document.querySelector('.lightbox').click()); await settle(100);
  await p.click('#rtPics [data-dphx="1"]'); await settle(200);
  let rm = await last('rmfile');
  ok('taking off one just added clears it from the store at once', rm && rm.paths[0] === ups[1].path);
  await p.click('#rtSave'); await settle();
  w = await last('update', 'routines');
  ok('Save keeps the other', w && JSON.stringify(w.patch.photos) === JSON.stringify([{ path: ups[0].path }]),
     JSON.stringify(w && w.patch));
  ok('on the right job', w && JSON.stringify(w.where) === JSON.stringify([['eq', 'id', 3]]));

  console.log('\nCancel and removing');
  await clear();
  await ev(() => openRoutine(ROUTINES.find(r => r.id === 2))); await settle();
  ok('a saved photo shows', await ev(() => $('rtPics').querySelector('img').src) === 'https://signed.test/dia/me/roof.jpg');
  await p.setInputFiles('#rtBody [data-dphadd]:not([capture])', [pic(3)]); await settle(700);
  const fresh = (await last('upload')).path;
  await p.click('#rtPics [data-dphx="0"]'); await settle(200);
  ok('taking off a saved one leaves the store alone until Save', !(await last('rmfile')));
  await p.click('#rtCancel'); await settle();
  rm = await last('rmfile');
  ok('Cancel clears away the one just added', rm && JSON.stringify(rm.paths) === JSON.stringify([fresh]));
  ok('and keeps the saved one', !(await writes()).some(x => x.op === 'rmfile' && x.paths.includes('dia/me/roof.jpg')));
  ok('nothing is saved', !(await last('update', 'routines')));
  await ev(() => openRoutine(ROUTINES.find(r => r.id === 2))); await settle();
  await p.click('#rtPics [data-dphx="0"]'); await p.click('#rtSave'); await settle();
  w = await last('update', 'routines');
  ok('taking it off and saving empties the list', w && JSON.stringify(w.patch.photos) === '[]');
  ok('and then clears it from the store', (await writes()).some(x => x.op === 'rmfile' && x.paths.includes('dia/me/roof.jpg')));
  await clear();
  await ev(() => openRoutine(ROUTINES.find(r => r.id === 2))); await settle();
  await p.click('#rtDelete'); await settle();
  ok('Remove from the list deletes the job', !!(await last('delete', 'routines')));
  ok('with its photos', (await writes()).some(x => x.op === 'rmfile' && x.paths.includes('dia/me/roof.jpg')));
  ok('and closes the screen', !(await visible('rtEd')));

  // ---------------------------------------------------------------
  console.log('\nPhotos on to-dos and appointments');
  await clear();
  await ev(() => { DIARY_VIEW = 'list'; renderDiary(); }); await settle();
  ok('the list says how many photos', /📷 2/.test(await ev(() => document.querySelector('[data-item="11"]').textContent)));
  await ev(() => openItem(null)); await settle();
  ok('a new entry has a Photos section', await ev(() =>
    [...$('itBody').querySelectorAll('legend')].some(l => l.textContent === 'Photos')
    && $('itBody').querySelectorAll('[data-dphadd]').length === 2));
  ok('just above Delete, after Reminder', await ev(() => {
    const ls = [...$('itBody').querySelectorAll('legend')].map(l => l.textContent);
    return ls.indexOf('Photos') === ls.indexOf('Reminder') + 1; }));
  await p.fill('#itForm input[name="title"]', 'Collect the parcel');
  await p.setInputFiles('#itBody [data-dphadd]:not([capture])', [pic(4)]); await settle(700);
  const up = (await last('upload')).path;
  await p.click('#itSave'); await settle();
  w = await last('insert', 'items');
  ok('the new to-do is saved with its photo', w && JSON.stringify(w.rows.photos) === JSON.stringify([{ path: up }]),
     JSON.stringify(w && w.rows));
  await clear();
  await ev(() => openItem(ITEMS.find(x => x.id === 12))); await settle();
  await p.click('#itSave'); await settle();
  w = await last('update', 'items');
  ok('one without photos saves without them (works before step 46)', w && !('photos' in w.patch), JSON.stringify(w && w.patch));

  console.log('\nOn an appointment shared with you');
  await clear();
  await ev(() => openItem(ITEMS.find(x => x.id === 11))); await settle();
  ok('you see Sandra\'s photos', await ev(() => [...$('itPics').querySelectorAll('img')].map(i => i.src).join()) ===
     'https://signed.test/dia/sandra/hull.jpg,https://signed.test/dia/me/prop.jpg');
  await p.click('#itPics [data-dphx="0"]'); await settle(200);
  await p.click('#itSave'); await settle();
  w = await last('update', 'items');
  ok('taking hers off takes it off the appointment', w && JSON.stringify(w.patch.photos) === JSON.stringify([{ path: 'dia/me/prop.jpg' }]),
     JSON.stringify(w && w.patch));
  ok('but her file stays in her folder', !(await writes()).some(x => x.op === 'rmfile'));
  await clear();
  await ev(() => openItem(ITEMS.find(x => x.id === 10))); await settle();
  await p.setInputFiles('#itBody [data-dphadd]:not([capture])', [pic(5)]); await settle(700);
  const f2 = (await last('upload')).path;
  await p.click('#itCancel'); await settle();
  ok('Cancel on an entry clears the photo just added', (await writes()).some(x => x.op === 'rmfile' && x.paths.includes(f2)));
  await clear();
  await ev(() => { window.__rows.items.find(x => x.id === 10).photos = [{ path: 'dia/me/pump.jpg' }]; return loadAll(); });
  await ev(() => openItem(ITEMS.find(x => x.id === 10))); await settle();
  await p.click('#itDelete'); await settle();
  ok('deleting an entry takes your photos with it', (await writes()).some(x => x.op === 'rmfile' && x.paths.includes('dia/me/pump.jpg')));

  console.log('\nBefore step 46 has been run');
  ok('a save that fails on photos says to run step 46', await ev(() =>
    dphStepMissing({ photos: [] }, { message: 'column "photos" of relation "items" does not exist' })) ===
    'Could not save: photos need step 46 run in Supabase first');
  ok('any other failure does not', await ev(() => dphStepMissing({ photos: [] }, { message: 'network' })) === '');

  console.log('\nHelp');
  await ev(() => openHelp && openHelp()); await settle();
  const help = await ev(() => $('helpBody').textContent);
  ok('Help mentions ASAP for new jobs and photos', /A new job starts under ASAP/.test(help) && /Appointments, to-dos and regular jobs can all\s+have photos/.test(help));

  console.log(errors.length ? '\nErrors:\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail++;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
