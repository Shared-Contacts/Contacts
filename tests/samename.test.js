// Contacts searched for by name (ML143), in the pickers and on the Contacts
// screen: Barry looked for Tattenhall Marina
// under Bought from and got the boaters moored there, but not the marina, so
// added it again. A name now comes first in every contact search, and a new
// contact with a name already in Contacts asks: use that one, or keep both?
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
  const clearWrites = () => ev(() => { window.__writes.length = 0; });
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); });
  // Fills in a new contact on the full form: a business, or a person.
  const fillNew = (who) => ev(who => { const f = $('edForm');
    if (who.company) { f.elements.is_organisation.checked = true;
      f.elements.is_organisation.dispatchEvent(new Event('change')); f.elements.company.value = who.company; }
    else { f.elements.first_name.value = who.first; f.elements.last_name.value = who.last; }
    f.elements.notes.value = 'typed on the new one';
    f.querySelector('input[name="grp"][value="1"]').checked = true; }, who);

  // Barry's case: the marina, and more boaters moored there than the picker shows.
  await ev(() => {
    for (let i = 0; i < 45; i++) window.__rows.contacts.push({ id: 100 + i, created_by: 'me',
      first_name: 'Boater', last_name: 'Number' + String(i).padStart(2, '0'),
      met_where: 'Tattenhall Marina', notes: 'Moored at Tattenhall Marina', contact_groups: [] });
    window.__rows.contacts.push({ id: 60, created_by: 'me', is_organisation: true, company: 'Tattenhall Marina',
      town: 'Tattenhall', phones: [{ label: 'office', value: '01829 770000' }], contact_groups: [] });
    window.__rows.link_kinds.push({ id: 1, name: 'Friend of', inverse_name: 'Friend of', sort_order: 1 });
    window.__rows.contacts.push({ id: 61, created_by: 'me', first_name: 'Tom', last_name: 'Tattenhall', contact_groups: [] });
  });
  await ev(() => loadAll()); await settle(300);

  console.log('\nSearching');
  const picked = q => ev(async q => {
    const was = pickContact('Bought from?', null, true); await new Promise(r => setTimeout(r, 60));
    $('pkQ').value = q; $('pkQ').dispatchEvent(new Event('input'));
    const ids = [...document.querySelectorAll('#pkHits [data-pk]')].map(b => Number(b.dataset.pk));
    $('pkCancel').click(); await was; return ids;
  }, q);
  let ids = await picked('Tattenhall Marina');
  ok('Tattenhall Marina comes first, above the 45 boaters moored there', ids[0] === 60, ids.slice(0, 5).join());
  ids = await picked('tattenhall');
  ok('one word finds it too, with Tom Tattenhall next and the boaters after', ids[0] === 60 && ids[1] === 61, ids.slice(0, 5).join());
  ids = await picked('marina');
  ok('a word from inside the name still puts it above the boaters', ids[0] === 60, ids.slice(0, 5).join());
  ok('with nothing typed, the list is in its usual order', await ev(() => {
    const all = CONTACTS.filter(pickable).sort(byName).slice(0, 40).map(c => c.id);
    return all.join() === CONTACTS.filter(pickable).sort(bestFirst('')).slice(0, 40).map(c => c.id).join(); }));
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ok('the other contact searches put names first as well',
    (src.match(/\.sort\(bestFirst\(q\)\)/g) || []).length === 4
    && !/matches\(c,q\)\)?(\.filter\(pickable\))?\s*\.sort\(byName\)/.test(src));

  console.log('\nThe Contacts screen search');
  const listed = q => ev(q => { $('search').value = q; render();
    const ids = [...document.querySelectorAll('#list .row')].map(r => Number(r.dataset.id));
    $('search').value = ''; render(); return ids; }, q);
  ids = await listed('tattenhall');
  ok('searching the Contacts screen puts the marina first too', ids[0] === 60 && ids[1] === 61 && ids.length === 47,
    ids.slice(0, 4).join() + ' of ' + ids.length);
  ok('with no search, the screen is as it was', await ev(() => { $('search').value = ''; render();
    return /by group and country/.test($('count').textContent); }));

  console.log('\nThe same name, added again from My Stuff');
  await clearWrites();
  await ev(() => openStuffEd(null, 'item')); await settle(200);
  await ev(() => { $('stfForm').elements.name.value = 'The tender'; });
  await p.click('[data-stfwho="d_bought_from"]'); await settle(200);
  await p.click('#pkNew'); await settle(500);
  await fillNew({ company: 'tattenhall  marina.' });
  await p.click('#edSave'); await settle(400);
  ok('it says it is already there, whatever the capitals and full stops', await ev(() =>
    !!$('sameName') && /already in your contacts/.test($('sameName').textContent)));
  ok('showing which one, with its town and phone', await ev(() =>
    /Tattenhall · 01829 770000/.test(document.querySelector('[data-same="60"]').textContent)));
  ok('and nothing saved yet', (await writes('insert', 'contacts')).length === 0);
  await p.click('#sameBack'); await settle(200);
  ok('Go back leaves the form open to look again', await shown('editor') && await ev(() => !$('sameName')));
  await p.click('#edSave'); await settle(400);
  await p.click('[data-same="60"]'); await settle(600);
  ok('using the old one adds nothing', (await writes('insert', 'contacts')).length === 0);
  ok('and fills in Bought from with it', !(await shown('editor')) && await shown('stuffEd') && await ev(() => {
    const f = $('stfForm'); return f.elements.d_bought_from.value === 'Tattenhall Marina'
      && f.elements.d_bought_from_id.value === '60' && f.elements.name.value === 'The tender'; }));
  await closeAll();

  await clearWrites();
  await ev(() => openStuffEd(null, 'item')); await settle(200);
  await p.click('[data-stfwho="d_bought_from"]'); await settle(200);
  await p.click('#pkNew'); await settle(500);
  await fillNew({ company: 'Tattenhall Marina' });
  await p.click('#edSave'); await settle(400);
  await p.click('#sameKeep'); await settle(600);
  ok('keeping the new one saves it as well', (await writes('insert', 'contacts')).length === 1
    && await ev(() => !!$('stfForm').elements.d_bought_from_id.value && $('stfForm').elements.d_bought_from_id.value !== '60'));
  await closeAll();

  console.log('\nThe same name, added in Contacts');
  await clearWrites();
  await ev(() => openEditor(null)); await settle(400);
  await fillNew({ first: 'Dickie', last: 'Deal' });
  await p.click('#edSave'); await settle(400);
  ok('a person with the same first and last name is caught too', await ev(() => !!document.querySelector('[data-same="1"]')));
  await p.click('[data-same="1"]'); await settle(600);
  ok('and using the old one opens them, adding nothing', (await writes('insert', 'contacts')).length === 0
    && await shown('detail') && await ev(() => CURRENT.id === 1));
  await closeAll();

  await clearWrites();
  await ev(() => openEditor(null)); await settle(400);
  await fillNew({ first: 'Dickie', last: 'Dealer' });
  await p.click('#edSave'); await settle(600);
  ok('a name that is not already there just saves', !(await ev(() => !!$('sameName')))
    && (await writes('insert', 'contacts')).length === 1);
  await closeAll();

  await clearWrites();
  await ev(() => openEditor(CONTACTS.find(c => c.id === 1))); await settle(500);
  await p.click('#edSave'); await settle(600);
  ok('changing a contact that is already there does not ask', !(await ev(() => !!$('sameName'))));
  await closeAll();

  console.log('\nLinking a person who is already there');
  await clearWrites();
  await ev(() => openDetail(2)); await settle(400);
  await ev(() => { const k = $('linkKind'); k.value = k.options[1] ? k.options[1].value : ''; });
  const hasKind = await ev(() => !!$('linkKind').value);
  ok('there is a link kind to test with', hasKind);
  if (hasKind) {
    await ev(() => startLinkedContact('Dickie Deal')); await settle(400);
    await ev(() => { $('edForm').querySelector('input[name="grp"][value="1"]').checked = true; });
    await p.click('#edSave'); await settle(400);
    await p.click('[data-same="1"]'); await settle(600);
    const rel = (await writes('insert', 'relationships')).pop();
    ok('the link goes to the one already there', rel && rel.rows.from_contact === 2 && rel.rows.to_contact === 1
      && (await writes('insert', 'contacts')).length === 0, JSON.stringify(rel));
  } else ok('the link goes to the one already there (no link kinds to test with)', true);
  await closeAll();

  console.log('\nA supplier typed in');
  await clearWrites();
  await ev(() => { window.__sup = addSupplier('TATTENHALL MARINA'); }); await settle(200);
  await p.click('[data-same="60"]'); await settle(300);
  ok('a supplier already in Contacts is used, not added again', await ev(async () => (await window.__sup).id === 60)
    && (await writes('insert', 'contacts')).length === 0);

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
