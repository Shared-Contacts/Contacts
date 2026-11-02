// My Stuff, second round (ML139, step 51): Bought from, the insurer and where
// a service was done come from Contacts (or a new one, on the full contact
// form), year built on vehicles, and the first photo small on the list and
// large on the thing's own screen.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch/i;

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

  await ev(() => {
    window.__rows.contacts.push({ id: 50, created_by: 'me', is_organisation: true, company: 'Halfords',
      town: 'Oxford', contact_groups: [] });
    window.__rows.stuff = [
      { id: 1, created_by: 'me', kind: 'vehicle', name: 'The car',
        details: { make: 'Ford', model: 'Focus', year: '2015', reg: 'AB12 CDE',
          bought_from: 'Halfords', bought_from_id: 50 },
        photos: [{ path: 'stf/me/car.jpg' }, { path: 'stf/me/car2.jpg' }], files: [], shared_with: [], reminders: {} },
      { id: 2, created_by: 'me', kind: 'item', name: 'The telly', details: { bought_from: 'A man in the pub' },
        photos: [], files: [], shared_with: [], reminders: {} },
      { id: 3, created_by: 'sandra', kind: 'policy', name: 'Boat insurance',
        details: { insurer: 'Navigators', insurer_id: 777 }, photos: [], files: [], shared_with: ['me'], reminders: {} }];
    window.__rows.stuff_service = [
      { id: 11, stuff_id: 1, done_on: '2026-03-02', where_done: 'Halfords', where_contact: 50, price: 99 }];
  });
  await ev(() => loadAll()); await settle(300);

  console.log('\nYear built');
  ok('vehicles have a Year built box, after the model', await ev(() => {
    const ks = STF_TYPES.vehicle.fields.map(f => f.k);
    return ks.indexOf('year') === ks.indexOf('model') + 1 && STF_TYPES.vehicle.fields[ks.indexOf('year')].l === 'Year built'; }));
  ok('items do not', await ev(() => !STF_TYPES.item.fields.some(f => f.k === 'year')));

  console.log('\nThe list');
  await ev(() => openStuff()); await settle(400);
  const list = await ev(() => $('stfBody').textContent.replace(/\s+/g, ' '));
  ok('the year is on the row', /The car Ford · Focus · 2015 · AB12 CDE/.test(list), list.slice(0, 200));
  ok('the first photo is a small picture on the right of the row', await ev(() => {
    const row = document.querySelector('[data-stf="1"]'), img = row.querySelector('img.sthumb.right');
    return img && row.lastElementChild === img && /car\.jpg/.test(img.src); }));
  ok('a thing with no photo has none', await ev(() => !document.querySelector('[data-stf="2"] img')));
  ok('the insurer on a policy row comes from Contacts by name', /Boat insurance Navigators/.test(list));

  console.log('\nLooking at one');
  await p.click('[data-stf="1"]'); await settle(300);
  ok('the first photo is large at the top', await ev(() => {
    const v = $('stfView'), hero = v.firstElementChild;
    return hero.tagName === 'IMG' && hero.classList.contains('stfhero') && /car\.jpg/.test(hero.src)
      && hero.getBoundingClientRect().width > 300; }));
  ok('the others are under More photos, without the first again', await ev(() =>
    /More photos/.test($('stfView').textContent)
    && [...document.querySelectorAll('.rcpthumbs [data-stfpic]')].map(i => i.dataset.stfpic).join() === '1'));
  await ev(() => { window.__lb = null; window.__lb0 = lightbox; lightbox = u => { window.__lb = u; }; });
  await p.click('.stfhero'); await settle(100);
  ok('tapping it shows it full size', await ev(() => /car\.jpg/.test(window.__lb || '')));
  await ev(() => { lightbox = window.__lb0; });
  let view = await ev(() => $('stfView').innerText.replace(/\s+/g, ' '));
  ok('Year built and Bought from are shown', /Year built 2015/.test(view) && /Bought from Halfords/.test(view), view.slice(0, 200));
  ok('Bought from opens the contact', await ev(() => !!document.querySelector('[data-stfcontact="50"]')));
  await p.click('[data-stfcontact="50"]'); await settle(400);
  ok('tap it and Halfords opens in Contacts', await shown('detail') && await ev(() => CURRENT && CURRENT.id === 50));
  await closeAll();
  await ev(() => openStuffThing(2)); await settle(200);
  view = await ev(() => $('stfView').innerText.replace(/\s+/g, ' '));
  ok('one typed before the link still shows, as plain text', /Bought from A man in the pub/.test(view)
    && await ev(() => !document.querySelector('[data-stfcontact]')));
  await closeAll();
  await ev(() => openStuffThing(3)); await settle(200);
  view = await ev(() => $('stfView').innerText.replace(/\s+/g, ' '));
  ok('shared with you, a contact you cannot see still shows its name', /Insurer Navigators/.test(view)
    && await ev(() => !document.querySelector('[data-stfcontact]')));
  await closeAll();

  console.log('\nChoosing from Contacts');
  await clearWrites();
  await ev(() => openStuffEd(STUFF.find(x => x.id === 2))); await settle(200);
  ok('Bought from is a button, showing what is there', await ev(() =>
    document.querySelector('[data-stfwho="d_bought_from"]').textContent.trim() === 'A man in the pub'));
  await p.click('[data-stfwho="d_bought_from"]'); await settle(200);
  ok('it opens the contact picker, with + New contact', await ev(() => !!$('pkQ') && !!$('pkNew')));
  await ev(() => { $('pkQ').value = 'half'; $('pkQ').dispatchEvent(new Event('input')); });
  await p.click('[data-pk="50"]'); await settle(200);
  ok('picking one fills it in', await ev(() => {
    const f = $('stfForm'); return f.elements.d_bought_from.value === 'Halfords' && f.elements.d_bought_from_id.value === '50'
      && document.querySelector('[data-stfwho="d_bought_from"]').textContent === 'Halfords'; }));
  await p.click('#stfSave'); await settle(500);
  let up = (await writes('update', 'stuff')).find(w => w.patch.details);
  ok('saved with the name and the contact', up && up.patch.details.bought_from === 'Halfords'
    && up.patch.details.bought_from_id === 50, JSON.stringify(up && up.patch.details));
  await closeAll();

  await clearWrites();
  await ev(() => openStuffEd(window.__rows.stuff[0])); await settle(200);
  await p.click('[data-stfwho="d_bought_from"]'); await settle(200);
  await p.click('#pkNone'); await settle(200);
  ok('Nobody empties it', await ev(() => { const f = $('stfForm');
    return f.elements.d_bought_from.value === '' && f.elements.d_bought_from_id.value === ''
      && document.querySelector('[data-stfwho="d_bought_from"]').textContent === 'Choose from Contacts'; }));
  await ev(() => { $('stfForm').elements.d_year.value = '98'; });
  await p.click('#stfSave'); await settle(300);
  ok('a year has to be four figures', /Year built needs to be a year/.test(await said())
    && !(await writes('update', 'stuff')).length, await said());
  await ev(() => { $('stfForm').elements.d_year.value = '1998'; });
  await p.click('#stfSave'); await settle(500);
  up = (await writes('update', 'stuff')).find(w => w.patch.details);
  ok('saved: the year kept, Bought from and its link gone', up && up.patch.details.year === '1998'
    && !('bought_from' in up.patch.details) && !('bought_from_id' in up.patch.details), JSON.stringify(up && up.patch.details));
  await closeAll();

  console.log('\nA new contact, on the full form');
  // The stand-in does not keep what is added, so this one does, as Supabase would.
  await ev(() => { window.__from0 = sb.from; sb.from = t => { const a = window.__from0(t);
    if (t === 'contacts') { const ins = a.insert; a.insert = r => { const o = ins(r);
      return { select: () => ({ single: async () => { const res = await o.select().single();
        window.__rows.contacts.push({ ...res.data, contact_groups: [] }); window.__newContact = res.data.id; return res; } }) }; }; }
    return a; }; });
  await ev(() => openStuffEd(null, 'policy')); await settle(200);
  await ev(() => { $('stfForm').elements.name.value = 'Home insurance'; });
  await p.click('[data-stfwho="d_insurer"]'); await settle(200);
  await p.click('#pkNew'); await settle(500);
  ok('+ New contact opens the full contact form on top', await shown('editor') && await shown('stuffEd')
    && await ev(() => SHEET_STACK[SHEET_STACK.length - 1] === 'editor' && $('edTitle').textContent === 'Add a contact'));
  await ev(() => { const f = $('edForm'); f.elements.is_organisation.checked = true;
    f.elements.is_organisation.dispatchEvent(new Event('change'));
    f.elements.company.value = 'Aviva'; f.querySelector('input[name="grp"][value="1"]').checked = true; });
  await p.click('#edSave'); await settle(800);
  ok('saving it goes back to My Stuff, not to the contact', !(await shown('editor')) && !(await shown('detail'))
    && await shown('stuffEd'));
  ok('with the new contact filled in', await ev(() => { const f = $('stfForm');
    return f.elements.d_insurer.value === 'Aviva' && Number(f.elements.d_insurer_id.value) === window.__newContact; }));
  ok('and the rest of the form as it was', await ev(() => $('stfForm').elements.name.value === 'Home insurance'));
  await ev(() => { sb.from = window.__from0; });
  await closeAll();

  await ev(() => openStuffEd(null, 'item')); await settle(200);
  await p.click('[data-stfwho="d_bought_from"]'); await settle(200);
  await p.click('#pkNew'); await settle(500);
  await p.click('#edCancel'); await settle(300);
  ok('cancelling the contact form goes back with nothing changed', await shown('stuffEd')
    && await ev(() => $('stfForm').elements.d_bought_from.value === '' && AFTER_NEW_CONTACT === null));
  await closeAll();

  console.log('\nWhere a service was done');
  await clearWrites();
  await ev(() => openStuffThing(1)); await settle(300);
  ok('the service row shows the contact by name', /Halfords · £99\.00/.test(await ev(() => $('stfView').innerText)));
  await p.click('#stfSvAdd'); await settle(300);
  ok('Where is chosen from Contacts', await ev(() => !!document.querySelector('#stfSvBox [data-stfwho="where_done"]')));
  await p.click('#stfSvBox [data-stfwho="where_done"]'); await settle(200);
  await p.click('#pkNew'); await settle(500);
  ok('a new one hides the service form while the contact form is open', await shown('editor')
    && await ev(() => $('stfSvBox').style.display === 'none'));
  await p.click('#edCancel'); await settle(300);
  ok('and brings it back after', await ev(() => $('stfSvBox').style.display === ''));
  await p.click('#stfSvBox [data-stfwho="where_done"]'); await settle(200);
  await p.click('[data-pk="50"]'); await settle(200);
  await p.click('#stfSvGo'); await settle(500);
  const sv = (await writes('insert', 'stuff_service')).pop();
  ok('the service is saved with the name and the contact', sv && sv.rows.where_done === 'Halfords'
    && sv.rows.where_contact === 50, JSON.stringify(sv && sv.rows));
  await closeAll();

  await clearWrites();
  await ev(() => openStuffThing(1)); await settle(300);
  await p.click('#stfSvAdd'); await settle(300);
  await ev(() => { $('stfSvForm').elements.work.value = 'Did it myself'; });
  await p.click('#stfSvGo'); await settle(500);
  const sv2 = (await writes('insert', 'stuff_service')).pop();
  ok('one with no contact does not send the new column (still saves before step 51)',
    sv2 && !('where_contact' in sv2.rows), JSON.stringify(sv2 && sv2.rows));
  await closeAll();

  console.log('\nA contact form left some other way');
  await ev(() => openStuffThing(1)); await settle(300);
  await p.click('#stfSvAdd'); await settle(300);
  await p.click('#stfSvBox [data-stfwho="where_done"]'); await settle(200);
  await p.click('#pkNew'); await settle(400);
  await ev(() => { $('editor').classList.add('hidden'); lockBackground(); });
  await ev(() => openEditor(null)); await settle(400);
  ok('the next contact form is an ordinary one, and the old service form is cleared away',
    await ev(() => AFTER_NEW_CONTACT === null && !$('stfSvBox')));
  await closeAll();

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
