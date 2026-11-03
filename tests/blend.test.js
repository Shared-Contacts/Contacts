// Contacts used elsewhere can't be deleted and wear a link mark (ML153), and
// double-ups can be found and blended into one (ML154). Both need step 52;
// before it is run everything works as it did.
const { chromium } = require('playwright');
const path = require('path');
const errors = [], dialogs = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())
    && !/CONTACT IN USE|Could not find the function/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && (!table || w.table === table || w.name === table)), [op, table]);
  const clearW = () => ev(() => { window.__writes.length = 0; });
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); });

  await ev(async () => {
    window.__rows.contacts.push(
      { id: 3, created_by: 'me', first_name: 'Nobody', last_name: 'Uses', contact_groups: [] });
    window.__rows.relationships.push({ id: 1, from_contact: 2, to_contact: 3, kind: 'Friend', created_by: 'me' });
    await loadAll(); render();
  });
  await settle();

  console.log('\nBefore step 52: as it was');
  ok('no link marks', await ev(() => document.querySelectorAll('.linkmark').length) === 0);
  await clearW(); dialogs.length = 0;
  await ev(() => deleteContact(CONTACTS.find(c => c.id === 3))); await settle();
  ok('deleting asks once and deletes', dialogs.length === 1 && /Delete Nobody Uses\? This cannot be undone/.test(dialogs[0])
    && (await writes('delete', 'contacts')).length === 1, JSON.stringify(dialogs));
  ok('Find double-ups says blending needs step 52', await (async () => {
    await ev(() => openDoubles()); await settle(200);
    const t = await ev(() => $('doubles').textContent);
    await closeAll(); return /contacts-step52\.sql/.test(t);
  })());

  console.log('\nAfter step 52: the link mark and the card (ML153)');
  await ev(async () => {
    window.__uses = { 1: { diary: 2, payees: 1, links: 1 }, 2: { links: 1 }, 3: {} };
    window.__rpc = (name, a) => {
      if (name === 'linked_contacts') return { data: Object.keys(window.__uses)
        .filter(id => Object.keys(window.__uses[id]).some(k => k !== 'links')).map(Number), error: null };
      if (name === 'contact_uses') return { data: window.__uses[a.cid] || {}, error: null };
      if (name === 'merge_contacts') {
        window.__rows.contacts = window.__rows.contacts.filter(c => c.id !== a.gone);
        return { data: null, error: null };
      }
      return { data: null, error: { message: 'no ' + name } };
    };
    await loadAll(); VIEW = 'az-last'; applyView(); render();
  });
  await settle();
  const marks = await ev(() => [...document.querySelectorAll('.linkmark')].map(m => +m.closest('[data-id]').dataset.id));
  ok('a link mark on the one used elsewhere (1), not on one with only a connection (2)',
    JSON.stringify(marks) === '[1]', JSON.stringify(marks));
  await ev(() => openDetail(1)); await settle(600);
  ok('its card says where it is used', /Used in: 2 appointments or to-dos in the Diary, 1 payee in Finances/
    .test(await ev(() => $('detUsed').textContent)), await ev(() => ($('detUsed') || {}).textContent));
  await ev(() => openDetail(2)); await settle(400);
  ok('no such line on one used nowhere', await ev(() => !$('detUsed')));
  await closeAll();

  console.log('\nDeleting (ML153)');
  await clearW(); dialogs.length = 0;
  await ev(() => deleteContact(CONTACTS.find(c => c.id === 1))); await settle();
  ok('one in use: not offered for deleting, nothing deleted', dialogs.length === 0
    && (await writes('delete', 'contacts')).length === 0, JSON.stringify(dialogs));
  const iu = await ev(() => $('inUse') && $('inUse').textContent);
  ok('it says where instead, and offers to blend', /Dickie Deal is in use/.test(iu) && /2 appointments or to-dos in the Diary/.test(iu)
    && /1 payee in Finances/.test(iu) && !/connection/.test(iu) && /Blend into another/.test(iu), iu);
  await p.click('#iuOk'); await settle(200);
  await clearW(); dialogs.length = 0;
  await ev(() => deleteContact(CONTACTS.find(c => c.id === 2))); await settle();
  ok('one used nowhere: asks, saying its connection goes too, and deletes',
    dialogs.length === 1 && /Its connection to other contacts goes with it\. This cannot be undone/.test(dialogs[0])
    && (await writes('delete', 'contacts')).length === 1, JSON.stringify(dialogs));
  // The database has the last word, in case the app's picture is out of date.
  await ev(() => { window.__failDelete = t => t === 'contacts'
    ? { code: 'P0001', message: 'CONTACT IN USE {"log": 1}' } : null; });
  await ev(() => deleteContact(CONTACTS.find(c => c.id === 2))); await settle();
  ok('if the database refuses, it says where', /1 day in the Daily Log \(Purchased from\)/
    .test(await ev(() => $('inUse') && $('inUse').textContent)));
  await closeAll();
  await ev(() => { window.__failDelete = null; });

  console.log('\nDeleting several (ML153)');
  await clearW(); dialogs.length = 0;
  await ev(() => { startPicking(); PICKED.add(1); PICKED.add(2); deletePicked(); }); await settle();
  const del = await writes('delete', 'contacts');
  ok('the one in use is left out, the other deleted',
    del.length === 1 && JSON.stringify(del[0].where) === '[["in","id",[2]]]', JSON.stringify(del.map(d => d.where)));
  ok('and the question says which was left alone', /Left alone, because they are used elsewhere in the app: Dickie Deal/
    .test(dialogs[0] || ''), dialogs[0]);
  await clearW(); dialogs.length = 0;
  await ev(() => { PICKED.clear(); PICKED.add(1); deletePicked(); }); await settle();
  ok('only ones in use picked: nothing deleted, and it says why',
    (await writes('delete', 'contacts')).length === 0 && /used elsewhere in the app/.test(dialogs[0] || ''), dialogs[0]);
  await ev(() => stopPicking());

  console.log('\nFinding double-ups (ML154)');
  await ev(async () => {
    const c = (id, o) => Object.assign({ id, created_by: 'me', contact_groups: [], phones: [], emails: [], websites: [], photos: [] }, o);
    window.__rows.contacts.push(
      c(10, { is_organisation: true, company: 'Tattenhall Marina', town: 'Tattenhall', notes: 'The original' }),
      c(11, { is_organisation: true, company: 'tattenhall marina.', town: 'Chester', postcode: 'CH3 9NE',
        notes: 'Added again', phones: [{ label: 'Work', value: '01829 123456' }],
        websites: [{ label: 'Website', value: 'tattenhallmarina.co.uk' }],
        photos: [{ path: '11/abc.jpg' }], avatar_path: '11/abc.jpg' }),
      c(12, { first_name: 'Sam', last_name: 'Jones', phones: [{ label: 'Mobile', value: '07700 900123' }] }),
      c(13, { first_name: 'Samuel', last_name: 'Jones', phones: [{ label: 'Mobile', value: '+44 7700 900123' }] }),
      c(14, { first_name: 'Ann', last_name: 'Lee', emails: [{ label: 'Personal', value: 'ann@example.com' }] }),
      c(15, { created_by: 'other', first_name: 'Ann', last_name: 'Lee', emails: [{ label: 'Work', value: 'ANN@example.com ' }] }),
      c(16, { created_by: 'other', first_name: 'Not', last_name: 'Mine' }),
      c(17, { created_by: 'other', first_name: 'Not', last_name: 'Mine' }));
    window.__rows.contact_shares.push({ contact_id: 15, user_id: 'me', can_edit: true });
    window.__uses[10] = { diary: 1 };
    await loadAll(); render();
  });
  await ev(() => openDoubles()); await settle(300);
  const found = await ev(() => [...document.querySelectorAll('[data-dbl]')].map(r =>
    r.dataset.dbl + ' ' + r.querySelector('.coords').textContent.trim()));
  ok('same name, whatever the capitals and full stop', found.includes('10-11 Same name'), JSON.stringify(found));
  ok('same phone, 07... and +44 7...', found.includes('12-13 Same phone'), JSON.stringify(found));
  ok('same name and email, one shared with you', found.includes('14-15 Same name · Same email'), JSON.stringify(found));
  ok('not two that are both someone else\'s', !found.some(f => /^16-17/.test(f)), JSON.stringify(found));
  await clearW();
  await p.click('[data-dblno="12-13"]'); await settle(300);
  const saved = (await writes('update', 'profiles')).map(w => w.patch.home_tiles && w.patch.home_tiles.notsame);
  ok('Not the same takes it off and remembers it', saved.some(n => n && n.includes('12-13'))
    && await ev(() => !document.querySelector('[data-dbl="12-13"]')), JSON.stringify(saved));
  await closeAll();
  await ev(() => openDoubles()); await settle(200);
  ok('and it stays off next time', await ev(() => !document.querySelector('[data-dbl="12-13"]')));

  console.log('\nBlending (ML154)');
  await p.click('[data-dblgo="10-11"]'); await settle(400);
  let bl = await ev(() => $('blend').textContent.replace(/\s+/g, ' '));
  ok('the one already in use stays, the new one goes', /Stays\s*Tattenhall Marina\s*Tattenhall/.test(bl)
    && /across\s*tattenhall marina\.\s*Chester/.test(bl), bl);
  const asked = await ev(() => [...document.querySelectorAll('#blend [data-blch$=":keep"]')].map(b =>
    b.closest('.cmprow').querySelector('.coords').textContent));
  ok('asks about what differs: the address (whole), the name and the notes',
    JSON.stringify(asked.slice().sort()) === JSON.stringify(['Address', 'Company', 'Notes']), JSON.stringify(asked));
  ok('the address is offered whole', await ev(() =>
    document.querySelector('[data-blch="home:gone"]').textContent.trim() === 'Chester, CH3 9NE'));
  ok('notes can be both', await ev(() => !!document.querySelector('[data-blch="notes:both"]')));
  await p.click('#blSwap'); await settle(200);
  bl = await ev(() => $('blend').textContent.replace(/\s+/g, ' '));
  ok('Swap them over swaps them', /Stays\s*tattenhall marina\.\s*Chester/.test(bl), bl);
  await p.click('#blSwap'); await settle(200);
  await p.click('[data-blch="home:gone"]'); await p.click('[data-blch="notes:both"]');
  await clearW(); dialogs.length = 0;
  await p.click('#blGo'); await settle(900);
  ok('asks before it blends', /Blend tattenhall marina\. into Tattenhall Marina\?/.test(dialogs[0] || ''), dialogs[0]);
  const up = (await writes('update', 'contacts')).find(w => JSON.stringify(w.where) === '[["eq","id",10]]');
  const pt = up && up.patch;
  ok('the one that stays gets the chosen address', pt && pt.town === 'Chester' && pt.postcode === 'CH3 9NE', JSON.stringify(pt));
  ok('keeps its own name where not chosen', pt && !('company' in pt), JSON.stringify(pt));
  ok('both lots of notes', pt && pt.notes === 'The original\n\nAdded again', JSON.stringify(pt && pt.notes));
  ok('the phone and website it did not have', pt && pt.phones.length === 1 && pt.phones[0].value === '01829 123456'
    && pt.websites[0].value === 'tattenhallmarina.co.uk', JSON.stringify(pt));
  const cp = await writes('copyfile');
  ok('the photo is copied into the folder of the one that stays', cp.length === 1 && cp[0].from === '11/abc.jpg'
    && cp[0].to === '10/abc.jpg' && pt.photos[0].path === '10/abc.jpg' && pt.avatar_path === '10/abc.jpg',
    JSON.stringify([cp, pt && pt.photos, pt && pt.avatar_path]));
  const rp = await writes('rpc', 'merge_contacts');
  ok('then the database moves the links and removes the other', rp.length === 1 && rp[0].args.keep === 10 && rp[0].args.gone === 11,
    JSON.stringify(rp));
  ok('and the one that stays is opened', await ev(() => !$('detail').classList.contains('hidden') && CURRENT && CURRENT.id === 10
    && !CONTACTS.some(c => c.id === 11)));
  await closeAll();

  console.log('\nBlending with one shared with you (ML154)');
  await ev(() => openBlend(CONTACTS.find(c => c.id === 14), CONTACTS.find(c => c.id === 15))); await settle(300);
  bl = await ev(() => $('blend').textContent.replace(/\s+/g, ' '));
  ok('yours goes into the shared one you can change; no swapping', /Stays\s*Ann Lee\s*shared with you/.test(bl)
    && /across\s*Ann Lee\s*added by you/.test(bl) && await ev(() => !$('blSwap')), bl);
  await closeAll();
  await ev(() => { window.__rows.contact_shares = []; });
  await ev(async () => { await loadAll(); openBlend(CONTACTS.find(c => c.id === 16), CONTACTS.find(c => c.id === 17)); });
  await settle(300);
  ok('two that are both someone else\'s can\'t be blended', await ev(() => !$('blend')));

  console.log('\nFrom a contact in use, Blend into another (ML154)');
  await ev(() => deleteContact(CONTACTS.find(c => c.id === 10))); await settle();
  await p.click('#iuBlend'); await settle(300);
  await p.fill('#pkQ', 'Sam'); await settle(300);
  await p.click('[data-pk="12"]'); await settle(400);
  bl = await ev(() => $('blend') && $('blend').textContent.replace(/\s+/g, ' '));
  ok('the one you were deleting is the one that goes', /Stays\s*Sam Jones/.test(bl || '')
    && /across\s*Tattenhall Marina/.test(bl || ''), bl);
  await closeAll();

  ok('no errors on any screen', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
