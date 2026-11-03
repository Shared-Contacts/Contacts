// My Stuff, round three (ML158 to ML164): the round red +, the number of
// photos on the photo, every date under the name (red when close), Boat and
// Loyalty or membership card types, Change the type, locked things behind a
// password of your own, and the date picker that types a date or picks a year.
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
  const text = id => ev(id => $(id).textContent.replace(/\s+/g, ' '), id);

  // The sign-in side of Supabase, as far as the lock uses it.
  await ev(() => {
    window.__auth = [];
    sb.auth.updateUser = async ({ data }) => { window.__auth.push({ op: 'update', data });
      return { data: { user: { ...ME, user_metadata: { ...(ME.user_metadata || {}), ...data } } }, error: null }; };
    sb.auth.signInWithPassword = async ({ email, password }) => { window.__auth.push({ op: 'signin', email });
      return password === 'sign-in-pw' ? { data: { user: ME }, error: null } : { data: {}, error: { message: 'Invalid' } }; };
  });

  const soon = await day(12), far = await day(250), old = await day(-400);
  await ev(([soon, far, old]) => {
    window.__rows.stuff = [
      { id: 1, created_by: 'me', kind: 'vehicle', name: 'Kingfisher',
        details: { make: 'Liverpool Boats', reg: '521234', tax_due: far, tax_price: '1100', insurance_due: soon, mot_due: old },
        photos: [{ path: 'stf/me/a.jpg' }, { path: 'stf/me/b.jpg' }, { path: 'stf/me/c.jpg' }], files: [],
        shared_with: [], reminders: {} },
      { id: 2, created_by: 'me', kind: 'document', name: 'Passport',
        details: { renew_due: far, kept_where: 'The safe', locked: true },
        photos: [{ path: 'stf/me/pp.jpg' }], files: [], shared_with: [], reminders: {} },
      { id: 3, created_by: 'me', kind: 'item', name: 'The TV', details: { make: 'Sony' },
        photos: [], files: [], shared_with: [], reminders: {} }];
    window.__rows.stuff_service = [
      { id: 21, stuff_id: 1, done_on: '2026-05-01', where_done: 'Boatyard', price: 400, work: 'Blacking', next_due: null }];
  }, [soon, far, old]);

  console.log('\nThe round red +');
  await ev(() => openStuff()); await settle(400);
  ok('a round + on My Stuff, like Calendar and Shopping', await ev(() => {
    const a = $('stfAdd'); return a && a.classList.contains('fab') && a.closest('#stuff') && a.textContent.trim() === '+'; }));
  ok('the wide Add something bar has gone', !/Add something/.test(await text('stfBody')));
  await p.click('#stfAdd'); await settle(200);
  ok('it asks what it is, Boat and Loyalty card included', await ev(() =>
    [...document.querySelectorAll('[data-stfkind]')].map(b => b.dataset.stfkind).join()) === 'vehicle,boat,item,property,document,policy,loyalty');
  await closeAll();

  console.log('\nThe list');
  await ev(() => openStuff()); await settle(400);
  ok('the number of photos sits on the photo', await ev(() => {
    const r = document.querySelector('[data-stf="1"]'), b = r.querySelector('.stfpic b');
    return b && b.textContent === '3' && r.lastElementChild === b.closest('.stfpic'); }));
  ok('and the old camera line has gone', !/\u{1F4F7}/u.test(await text('stfBody')));
  ok('no number on a thing without photos', await ev(() => !document.querySelector('[data-stf="3"] .stfpic')));
  const row1 = await ev(() => [...document.querySelectorAll('[data-stf="1"] .w')].map(e => e.textContent + (e.classList.contains('late') ? '!' : '')));
  ok('every date is under the name', row1.some(x => /^Insurance renewal /.test(x)) && row1.some(x => /^Tax or licence renewal /.test(x)), row1.join(' / '));
  ok('red when 30 days or less', row1.some(x => /^Insurance renewal .*!$/.test(x)), row1.join(' / '));
  ok('grey when further off', row1.some(x => /^Tax or licence renewal [^!]*$/.test(x)), row1.join(' / '));
  ok('a date long gone is not shown', !row1.some(x => /MOT/.test(x)), row1.join(' / '));

  console.log('\nLocked, on the list');
  const r2 = await ev(() => { const r = document.querySelector('[data-stf="2"]');
    return { t: r.textContent.replace(/\s+/g, ' '), img: !!r.querySelector('img'), lock: !!r.querySelector('.stflock') }; });
  ok('a padlock where the photo goes', r2.lock && !r2.img, JSON.stringify(r2));
  ok('its name and dates still show, not its details', /Passport/.test(r2.t) && /Renewal due/.test(r2.t) && !/The safe/.test(r2.t), r2.t);
  ok('no Lock them again while nothing is open', await ev(() => !$('stfRelock')));

  console.log('\nOpening a locked thing');
  await clearWrites();
  await ev(() => { ME.user_metadata = {}; });
  await p.click('[data-stf="2"]'); await settle(300);
  ok('with no password yet, it asks you to choose one', await ev(() => !!$('stfLockBox')
    && !!document.querySelector('#stfLockForm [name=pw2]')));
  ok('saved under "My Stuff lock", for Google Password Manager', await ev(() => {
    const f = $('stfLockForm'); return f.elements.username.value === 'My Stuff lock'
      && f.elements.username.autocomplete === 'username' && f.elements.pw.autocomplete === 'new-password'; }));
  await ev(() => { const f = $('stfLockForm'); f.elements.pw.value = 'kingfisher'; f.elements.pw2.value = 'kingfishr'; });
  await p.click('#stfLockForm .go'); await settle(300);
  ok('two that do not match are refused', /do not match/.test(await said()) && await ev(() => window.__auth.length === 0));
  await ev(() => { const f = $('stfLockForm'); f.elements.pw.value = 'abc'; f.elements.pw2.value = 'abc'; });
  await p.click('#stfLockForm .go'); await settle(300);
  ok('too short is refused', /at least six/.test(await said()));
  await ev(() => { const f = $('stfLockForm'); f.elements.pw.value = 'kingfisher'; f.elements.pw2.value = 'kingfisher'; });
  await p.click('#stfLockForm .go'); await settle(900);
  const saved = await ev(() => window.__auth.find(a => a.op === 'update'));
  const lk = saved && saved.data.stuff_lock;
  ok('it is kept with your sign-in, scrambled', lk && lk.salt && /^[0-9a-f]{64}$/.test(lk.hash), JSON.stringify(saved));
  ok('never the password itself', !JSON.stringify(saved || {}).includes('kingfisher'));
  ok('and in no table', (await writes('insert')).length === 0 && (await writes('update')).every(w => w.table !== 'profiles'));
  ok('then the thing opens', await shown('stuffView') && /The safe/.test(await text('stfView')));
  ok('saying it is locked', /Locked/.test(await text('stfView')));
  await ev(() => { $('stuffView').classList.add('hidden'); });
  await ev(() => renderStuff());
  ok('the photo shows while it is open', await ev(() => !!document.querySelector('[data-stf="2"] img')));
  ok('with Lock them again', await ev(() => !!$('stfRelock')));
  await p.click('#stfRelock'); await settle(200);
  ok('which locks them', await ev(() => !STF_OPEN && !!document.querySelector('[data-stf="2"] .stflock')));

  await p.click('[data-stf="2"]'); await settle(300);
  ok('next time it asks for the password', await ev(() => !!$('stfLockBox')
    && !document.querySelector('#stfLockForm [name=pw2]')
    && $('stfLockForm').elements.pw.autocomplete === 'current-password'));
  await ev(() => { $('stfLockForm').elements.pw.value = 'wrong one'; });
  await p.click('#stfLockForm .go'); await settle(900);
  ok('the wrong one does not open it', /not it/.test(await said()) && !(await shown('stuffView')));
  await ev(() => { $('stfLockForm').elements.pw.value = 'kingfisher'; });
  await p.click('#stfLockForm .go'); await settle(900);
  ok('the right one does', await shown('stuffView') && !(await ev(() => !!$('stfLockBox'))));
  await ev(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState; });
  await settle(200);
  ok('putting the app in the background locks it and closes it', await ev(() => !STF_OPEN)
    && !(await shown('stuffView')));

  console.log('\nForgotten it');
  await p.click('[data-stf="2"]'); await settle(300);
  await p.click('#stfLockForgot'); await settle(200);
  ok('it asks for your sign-in password', await ev(() => /sign in to the app with/.test($('stfLockBox').textContent)
    && $('stfLockForm').elements.username.value === ME.email));
  await ev(() => { $('stfLockForm').elements.pw.value = 'not it'; });
  await p.click('#stfLockForm .go'); await settle(300);
  ok('the wrong sign-in password goes no further', /not your sign-in password/.test(await said())
    && await ev(() => !document.querySelector('#stfLockForm [name=pw2]')));
  await ev(() => { $('stfLockForm').elements.pw.value = 'sign-in-pw'; });
  await p.click('#stfLockForm .go'); await settle(300);
  ok('the right one lets you choose a new one', await ev(() => !!document.querySelector('#stfLockForm [name=pw2]')));
  await ev(() => { const f = $('stfLockForm'); f.elements.pw.value = 'heronheron'; f.elements.pw2.value = 'heronheron'; });
  await p.click('#stfLockForm .go'); await settle(900);
  ok('and it opens', await shown('stuffView'));
  ok('Menu has Change the lock password', await ev(() => areaItems('stuff').some(x => x.label === 'Change the lock password')));
  await closeAll();

  console.log('\nLocking from the form');
  await clearWrites();
  await ev(() => { STF_OPEN = true; openStuffEd(STUFF.find(x => x.id === 3)); }); await settle(200);
  ok('a Keep it locked box', await ev(() => !!$('stfForm').elements.locked && !$('stfForm').elements.locked.checked));
  await ev(() => { const f = $('stfForm'); f.querySelector('[name="share"][value="sandra"]').checked = true;
    f.elements.locked.checked = true; f.elements.locked.onchange(); });
  ok('ticking it hides Share with', await ev(() => $('stfShareSet').style.display === 'none'));
  await p.click('#stfSave'); await settle(600);
  const up = (await writes('update', 'stuff')).find(w => w.patch.details);
  ok('saved locked, and shared with nobody', up && up.patch.details.locked === true
    && JSON.stringify(up.patch.shared_with) === '[]', JSON.stringify(up && up.patch).slice(0, 200));
  await closeAll();
  await clearWrites();
  await ev(() => { openStuffEd(STUFF.find(x => x.id === 2)); $('stfForm').elements.locked.checked = false; });
  await p.click('#stfSave'); await settle(600);
  const up2 = (await writes('update', 'stuff')).find(w => w.patch.details);
  ok('unticked, it is unlocked', up2 && !('locked' in up2.patch.details), JSON.stringify(up2 && up2.patch.details));
  await closeAll();
  await clearWrites();
  await ev(() => { ME.user_metadata = {}; openStuffEd(null, 'document');
    const f = $('stfForm'); f.elements.name.value = 'My will'; f.elements.locked.checked = true; });
  await p.click('#stfSave'); await settle(400);
  ok('the first locked thing with no password asks for one before saving', await ev(() => !!$('stfLockBox'))
    && (await writes('insert', 'stuff')).length === 0);
  await p.click('#stfLockNo'); await settle(300);
  ok('cancelled, nothing is saved', (await writes('insert', 'stuff')).length === 0 && await shown('stuffEd'));
  await closeAll();

  console.log('\nA boat');
  const boxes = await ev(() => { openStuffEd(null, 'boat');
    return [...$('stfForm').querySelectorAll('label')].map(l => l.firstChild.textContent.trim()).join('|'); });
  ok('it asks for CRT registration, size, BSS, licence and insurance', ['CRT registration number', 'Length', 'Width (beam)',
    'Draught', 'BSS last done', 'BSS renewal due', 'CRT licence type', 'Licence last renewed', 'Licence next due',
    'Licence cost', 'Insurance company', 'Insurance cost', 'Insurance renews'].every(x => boxes.split('|').includes(x)), boxes);
  ok('with hints for the sizes', await ev(() => $('stfForm').elements.d_length.placeholder === 'e.g. 57 ft'));
  ok('autocorrect off for the CRT number', await ev(() => $('stfForm').elements.d_crt_reg.getAttribute('autocorrect') === 'off'));
  ok('and photos, PDFs and notes', await ev(() => !!document.querySelector('#stfPics') && !!$('stfPdfAdd') && !!$('stfForm').elements.notes));
  ok('a boat has a service record', await ev(() => STF_TYPES.boat.service === true));
  ok('the BSS, licence and insurance dates go into the Diary', await ev(() =>
    stfDues({ kind: 'boat', id: -1, details: { bss_due: '2027-05-01', licence_due: '2027-06-01', insurance_due: '2027-07-01' } })
      .map(x => x.label).join() === 'BSS due,CRT licence renewal,Insurance renewal'));
  await ev(() => $('stfEdCancel').click()); await settle(200);

  console.log('\nA loyalty or membership card');
  const lb = await ev(() => { openStuffEd(null, 'loyalty');
    return [...$('stfForm').querySelectorAll('label')].map(l => l.firstChild.textContent.trim()).join('|'); });
  ok('it asks for description, number, where kept, date, expiry and cost', ['Name', 'Description', 'Card or member number',
    'Where the card is kept', 'Date joined or started', 'Expiry date', 'Annual cost'].every(x => lb.split('|').includes(x)), lb);
  ok('the expiry date goes into the Diary', await ev(() =>
    stfDues({ kind: 'loyalty', id: -1, details: { expiry_due: '2027-03-01' } }).map(x => x.label).join() === 'Card expires'));
  ok('no service record', await ev(() => STF_TYPES.loyalty.service === false));
  await ev(() => $('stfEdCancel').click()); await settle(200);

  console.log('\nChange the type');
  await ev(() => { STF_OPEN = true; }); await ev(() => openStuffThing(1)); await settle(300);
  ok('yours has Change the type', await ev(() => !!$('stfKindBtn')));
  await p.click('#stfKindBtn'); await settle(200);
  ok('it offers every other type', await ev(() =>
    [...document.querySelectorAll('[data-stfkind]')].map(b => b.dataset.stfkind).join()) === 'boat,item,property,document,policy,loyalty');
  await clearWrites();
  await p.click('[data-stfkind="boat"]'); await settle(600);
  const ch = (await writes('update', 'stuff')).find(w => w.patch.kind);
  const cd = ch && ch.patch.details;
  ok('the vehicle becomes a boat', ch && ch.patch.kind === 'boat', JSON.stringify(ch && ch.patch).slice(0, 200));
  ok('registration moves to CRT registration, road tax to the licence', cd && cd.crt_reg === '521234' && !cd.reg
    && cd.licence_due === await day(250) && cd.licence_price === '1100' && !cd.tax_due, JSON.stringify(cd));
  ok('the same box carries straight over, the rest is kept', cd && cd.insurance_due === soon && cd.make === 'Liverpool Boats');
  await ev(d => { const t = window.__rows.stuff.find(x => x.id === 1); t.kind = 'boat'; t.details = d; }, cd);
  await ev(async () => { await loadStuff(); renderStuffThing(); });
  const bv = await ev(() => $('stfView').innerText.replace(/\s+/g, ' '));
  ok('shown with the boat boxes', /CRT registration number 521234/.test(bv) && /Licence next due/.test(bv), bv.slice(0, 200));
  ok('and the make under Also kept', /Also kept Make Liverpool Boats/i.test(bv), bv);
  ok('its service record goes with it', /Blacking/.test(bv));
  await closeAll();

  console.log('\nThe date picker');
  const pick = (value, withTime) => ev(([value, withTime]) => {
    window.__picked = 'waiting'; whenPicker({ value, withTime, title: 'Bought on' }).then(v => { window.__picked = v; }); },
    [value, withTime]);
  await pick('', false); await settle(200);
  ok('a box to type the date', await ev(() => !!$('pkType') && $('pkType').placeholder === 'dd/mm/yyyy'));
  await p.click('#pkType'); await p.keyboard.type('15062024');
  ok('the slashes put themselves in', await ev(() => $('pkType').value) === '15/06/2024');
  await p.click('#pkTypeGo'); await settle(200);
  ok('Go uses it straight away', await ev(() => window.__picked) === '2024-06-15' && await ev(() => !PICK_OPEN));
  await pick('', false); await settle(200);
  await ev(() => { $('pkType').value = 'nonsense'; }); await p.click('#pkTypeGo'); await settle(200);
  ok('something that is not a date says how to write one', /Try 4\/7\/19/.test(await said()) && await ev(() => !!PICK_OPEN));
  await ev(() => document.getElementById('pkCancel').click()); await settle(100);

  const yr = await ev(() => new Date().getFullYear());
  await pick('', false); await settle(200);
  await p.click('#pkMY'); await settle(150);
  const years = await ev(() => [...document.querySelectorAll('[data-yr]')].map(b => Number(b.dataset.yr)));
  ok('tapping the month gives the years, mostly gone by', years.length === 12 && years[0] === yr - 8 && years.includes(yr), years.join());
  await p.click('[data-yv="-12"]'); await settle(100);
  ok('the arrows go back twelve years', await ev(() => Number(document.querySelector('[data-yr]').dataset.yr)) === yr - 20);
  await p.click('[data-yv="12"]'); await settle(100);
  await p.click(`[data-yr="${yr - 2}"]`); await settle(100);
  ok('a year gives the months', await ev(() => document.querySelectorAll('[data-mo]').length === 12));
  await p.click('[data-mo="2"]'); await settle(100);
  ok('a month gives its days', await ev(() => /March/.test($('pkMY').textContent)) && await ev(() => $('pkMY').textContent.includes(String(new Date().getFullYear() - 2))));
  await p.click('[data-day="9"]'); await settle(100);
  await p.click('#pkSet'); await settle(150);
  ok('and the day is chosen', await ev(() => window.__picked) === `${yr - 2}-03-09`);

  await pick('2026-11-20T14:30', true); await settle(200);
  await ev(() => { $('pkType').value = '01/12/2026'; }); await p.click('#pkTypeGo'); await settle(150);
  ok('with a time to pick, a typed date waits for Use this', await ev(() => !!PICK_OPEN && window.__picked === 'waiting'));
  await p.click('#pkSet'); await settle(150);
  ok('keeping the time', await ev(() => window.__picked) === '2026-12-01T14:30');

  console.log('\nThe Daily Log still types its dates');
  ok('the slashes there come from the same place', await ev(() => typeof autoSlash === 'function'
    && /autoSlash\(go\)/.test(drawDayPick.toString())));

  console.log('\nHelp');
  ok('says about locked things, boats, cards and dates', await ev(() => { openHelp('stuff');
    const h = document.getElementById('h-stuff').parentElement.innerHTML; $('help').classList.add('hidden');
    return /Locked things/.test(h) && /Boats/.test(h) && /Loyalty and membership cards/.test(h)
      && /Choosing a date/.test(h) && /round red/.test(h); }));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
