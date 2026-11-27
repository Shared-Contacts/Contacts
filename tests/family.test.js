// The Family Tree (ML402 part one, step 68, version 2026.11.24.2): family-only
// people kept out of Contacts, the tree drawn in generations with zoom and
// drag, the person screen with part dates, links, photos and PDFs, and the
// Ancestry import read from a .ged or a .zip, run twice without doubling.
// Everyone here is made up. family68.test.js runs step 68 itself.
const { chromium } = require('playwright');
const path = require('path');
const zlib = require('zlib');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|Server unwell|^\[object Object\]$/i;

const GED = (extra = {}) => `0 HEAD
1 SOUR Ancestry.com Family Trees
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I100000000001@ INDI
1 NAME John William /Fake/
2 GIVN John William
2 SURN Fake
1 SEX M
1 BIRT
2 DATE 12 MAR 1850
2 PLAC ${extra.johnBorn || 'Leeds, Yorkshire, England'}
1 DEAT
2 DATE ABT. 1920
1 FAMS @F1@
0 @I100000000002@ INDI
1 NAME Mary /Smith/
2 GIVN Mary
2 SURN Smith
1 NAME Mary /Fake/
1 SEX F
1 BIRT
2 DATE 1852
1 BAPM
2 DATE Spring 1852
2 PLAC St Peter's, Leeds
1 RESI
2 DATE 1881
2 PLAC Leeds
1 RESI
2 DATE 1891
2 PLAC York
${extra.maryDied ? '1 DEAT\n2 DATE 3 JUN 1930\n2 PLAC York\n' : ''}1 FAMS @F1@
0 @I100000000003@ INDI
1 NAME Tom /Fake/
2 GIVN Tom
2 SURN Fake
1 SEX M
1 BIRT
2 DATE 03/04/1901
1 DEAT
2 DATE Deceased
1 FAMC @F1@
1 FAMS @F2@
0 @I100000000004@ INDI
1 NAME Peter /Fake/
2 GIVN Peter
2 SURN Fake
1 SEX M
1 BIRT
2 DATE 1 MAY 1960
1 FAMC @F2@
0 @I100000000005@ INDI
1 NAME Ann /Jones/
1 SEX F
1 FAMS @F2@
0 @F1@ FAM
1 HUSB @I100000000001@
1 WIFE @I100000000002@
1 CHIL @I100000000003@
1 MARR
2 DATE 1875
2 PLAC Leeds
0 @F2@ FAM
1 HUSB @I100000000003@
1 WIFE @I100000000005@
1 CHIL @I100000000004@
0 TRLR
`;
// A zip made the way Ancestry's is (checked on Barry's export, 24 Nov 2026):
// squeezed, with the sizes left blank at the start of each file and given
// after it and in the list at the end. Other files can come before the .ged.
function zipOf(name, text, before = []) {
  const crcOf = data => { let c, t = [], r = 0xFFFFFFFF; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    for (const b of data) r = t[(r ^ b) & 0xFF] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], dir = []; let at = 0;
  for (const [nmS, txt] of [...before, [name, text]]) {
    const data = Buffer.from(txt, 'utf8'), comp = zlib.deflateRawSync(data), nm = Buffer.from(nmS), crc = crcOf(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0808, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(nm.length, 26);
    const dd = Buffer.alloc(16); dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4); dd.writeUInt32LE(comp.length, 8); dd.writeUInt32LE(data.length, 12);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0808, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(at, 42);
    parts.push(h, nm, comp, dd); dir.push(c, nm); at += 30 + nm.length + comp.length + 16;
  }
  const cd = Buffer.concat(dir), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(dir.length / 2, 8); e.writeUInt16LE(dir.length / 2, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(at, 16);
  return Buffer.concat([...parts, cd, e]);
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const answers = [];
  p.on('dialog', d => (d.type() === 'prompt' && answers.length ? d.accept(answers.shift()) : d.accept()));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.route(/gov\.uk|bsky\.app|bsky\.social|open-meteo|nominatim/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await answerLkAsks(p, () => true);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const writes = (op, table) => ev(([o, t]) => window.__writes.filter(w => w.op === o && w.table === t), [op, table]);
  const visible = id => ev(i => !document.getElementById(i).classList.contains('hidden'), id);
  const box = id => ev(i => { const e = document.querySelector(`[data-famnode="${i}"]`); return e ? { x: e.offsetLeft + 75, y: e.offsetTop, mid: e.classList.contains('mid'), dot: e.classList.contains('card') } : null; }, id);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  const seed = () => ev(async () => {
    const c = (id, first, last, more) => ({ id, created_by: 'me', first_name: first, last_name: last, is_organisation: false,
      former_names: [], photos: [], family: {}, tree_only: false, ...more });
    window.__rows.link_kinds = [
      { id: 1, name: 'Partner of', inverse_name: 'Partner of', sort_order: 10, tree_role: 'partner' },
      { id: 2, name: 'Married to', inverse_name: 'Married to', sort_order: 20, tree_role: 'partner' },
      { id: 3, name: 'Parent of', inverse_name: 'Child of', sort_order: 30, tree_role: 'parent' },
      { id: 4, name: 'Child of', inverse_name: 'Parent of', sort_order: 40, tree_role: 'child' },
      { id: 5, name: 'Sibling of', inverse_name: 'Sibling of', sort_order: 50, tree_role: 'sibling' },
      { id: 6, name: 'Friend of', inverse_name: 'Friend of', sort_order: 120, tree_role: null }];
    window.__rows.contacts = [
      c(1, 'Peter', 'Fake', { birth_date: '1960-05-01' }),
      c(2, 'Ann', 'Fake', { birth_date: '1935-02-02', death_date: '2010-07-07', sex: 'F', former_names: [{ label: 'Maiden', value: 'Jones' }] }),
      c(3, 'Sue', 'Fake', { birth_date: '1962-08-08', sex: 'F' }),
      c(10, 'Edith', 'Jones', { tree_only: true, sex: 'F', birth_date: '1900-01-01', family: { birth: { d: '1900-01-01', p: 'year', q: 'about', pl: 'Hull' } } }),
      c(11, 'Albert', 'Jones', { tree_only: true, sex: 'M', birth_date: '1898-01-01', family: { birth: { d: '1898-01-01', p: 'year' } } }),
      c(12, 'Martha', 'Brown', { tree_only: true, sex: 'F', birth_date: new Date().toISOString().slice(0, 10) }),
      c(20, 'Bob', 'Pal', {})];
    const l = (id, a, z, kind, tree) => ({ id, from_contact: a, to_contact: z, kind, tree_only: !!tree, family: {} });
    window.__rows.relationships = [l(100, 2, 1, 'Parent of'), l(101, 3, 2, 'Child of'), l(102, 10, 2, 'Parent of'),
      l(103, 11, 2, 'Parent of'), l(104, 12, 10, 'Parent of', true), l(105, 11, 10, 'Married to', true), l(106, 1, 20, 'Friend of')];
    const me = window.__rows.profiles.find(x => x.id === 'me'); me.my_contact_id = 1;
    try { localStorage.removeItem('fam-mid'); } catch (e) {}
    FAM_ONLY = null; FAM_MID = null; await loadAll();
  });
  await seed();

  // ---------------------------------------------------------------
  console.log('\nFamily-only people stay out of Contacts');
  ok('the everyday list has the 4 contacts, none of the 3 family-only people', await ev(() =>
    CONTACTS.map(c => c.id).sort((a, b) => a - b).join(',') === '1,2,3,20'));
  ok('  and none of the links between family-only people', await ev(() => LINKS.map(l => l.id).sort().join(',') === '100,101,102,103,106'));
  ok('Martha, family only, born on this day, has no birthday anywhere', await ev(() =>
    !CONTACTS.some(c => c.first_name === 'Martha') && !document.body.innerText.includes('Martha')));
  ok('searching Contacts for Jones finds Ann (her maiden name), never Edith or Albert Jones', await ev(() =>
    CONTACTS.filter(c => matches(c, 'Jones')).map(c => c.id).join(',') === '2'));
  await ev(() => openDetail(2)); await settle(700);
  ok('Ann\'s own card names her mother, from the tree, not "(hidden)"', await ev(() => {
    const b = [...document.querySelectorAll('#detBody .linkrow .to')].map(x => x.textContent.trim() + (x.dataset.famgo ? ':tree' : ''));
    return b.includes('Edith Jones:tree') && b.includes('Albert Jones:tree') && !b.includes('(hidden)'); }),
    await ev(() => [...document.querySelectorAll('#detBody .linkrow')].map(x => x.textContent.replace(/\s+/g, ' ')).join(' | ')));
  await p.click('#detBody [data-famgo="10"]'); await settle(400);
  ok('  and tapping her opens her in the Family Tree', await visible('famPerson') && await ev(() => $('famEdTitle').textContent === 'Edith Jones'));
  await ev(() => { famCancel(); $('detail').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nThe tile and the tree');
  ok('a Family Tree tile, joining everyone\'s home screen', await ev(() => TILE_DEST.fam && TILE_DEST.fam.label === 'Family Tree'
    && TILE_DEFAULTS.includes('fam') && TILES.some(t => t.dest === 'fam')));
  await ev(() => openFam()); await settle(700);
  ok('it opens with you in the middle', (await box(1) || {}).mid === true && /In the middle: Peter Fake/.test(await ev(() => document.querySelector('.fammidline').textContent)));
  const me = await box(1), mum = await box(2), ed = await box(10), al = await box(11), ma = await box(12), sue = await box(3);
  ok('your mother above you, her parents above her, side by side over her', me && mum && ed && al && mum.y < me.y && ed.y < mum.y
    && ed.y === al.y && Math.abs((ed.x + al.x) / 2 - mum.x) < 2 && Math.abs(mum.x - me.x) < 2, JSON.stringify({ me, mum, ed, al }));
  ok('  father\'s side on the left', al.x < ed.x);
  ok('  and Edith\'s mother above her', ma && ma.y < ed.y && Math.abs(ma.x - ed.x) < 2);
  ok('the rows are named', await ev(() => [...document.querySelectorAll('.famgen')].map(x => x.textContent).join(',') === 'Great-grandparents,Grandparents,Parents'));
  ok('lines join them up', await ev(() => (document.querySelector('.famlines path').getAttribute('d') || '').split('M').length > 8));
  ok('anyone in your contacts as well has a dot', me.dot && mum.dot && !ed.dot);
  ok('a sister is not drawn beside you (she\'s on the person screen)', !sue);
  ok('you are in the middle of the screen', await ev(() => { const v = $('famView').getBoundingClientRect(), b = document.querySelector('[data-famnode="1"]').getBoundingClientRect();
    return Math.abs((b.left + b.right) / 2 - (v.left + v.right) / 2) < 3 && Math.abs((b.top + b.bottom) / 2 - (v.top + v.bottom) / 2) < 3; }));
  const z0 = await ev(() => ({ ...FAM_Z }));
  await p.click('#famIn'); await settle(100);
  ok('the magnifier zooms in, keeping the middle where it was', await ev(z => FAM_Z.s > z.s, z0) && await ev(() => {
    const v = $('famView').getBoundingClientRect(), b = document.querySelector('[data-famnode="1"]').getBoundingClientRect();
    return Math.abs((b.left + b.right) / 2 - (v.left + v.right) / 2) < 3; }));
  await p.click('#famOut'); await p.click('#famOut'); await settle(100);
  ok('  and out', await ev(z => FAM_Z.s < z.s, z0));
  const v = await ev(() => { const r = $('famView').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; });
  const zb = await ev(() => ({ ...FAM_Z }));
  await p.mouse.move(v.x, v.y); await p.mouse.down(); await p.mouse.move(v.x + 60, v.y + 40, { steps: 5 }); await p.mouse.up(); await settle(100);
  ok('dragging moves the tree about', await ev(z => Math.abs(FAM_Z.x - z.x - 60) < 2 && Math.abs(FAM_Z.y - z.y - 40) < 2, zb));
  ok('  without opening anyone', !(await visible('famPerson')) && await ev(() => FAM_MID === 1));
  await p.mouse.move(v.x + 100, v.y + 100); await p.mouse.wheel(0, -200); await settle(100);
  ok('the mouse wheel zooms too', await ev(z => FAM_Z.s > z.s, zb));
  await ev(() => famFit()); await settle(100);
  ok('See all of the tree fits it on the screen', await ev(() => { const v = $('famView').getBoundingClientRect(), c = $('famCanvas').getBoundingClientRect();
    return c.left >= v.left - 1 && c.right <= v.right + 1 && c.top >= v.top - 1 && c.bottom <= v.bottom + 1; }));
  await p.click('[data-famnode="10"]'); await settle(300);
  ok('tapping Edith puts her in the middle, remembered on this phone', await ev(() => FAM_MID === 10 && localStorage.getItem('fam-mid') === '10')
    && (await box(10)).mid && !(await visible('famPerson')));
  ok('  with her daughter below and her husband beside her', await ev(() => {
    const e = document.querySelector('[data-famnode="10"]'), a = document.querySelector('[data-famnode="11"]'), n = document.querySelector('[data-famnode="2"]');
    return a && n && a.offsetTop === e.offsetTop && a.offsetLeft > e.offsetLeft && n.offsetTop > e.offsetTop; }));
  ok('  and her grandchildren below that', await ev(() => !!document.querySelector('[data-famnode="1"]') && !!document.querySelector('[data-famnode="3"]')
    && [...document.querySelectorAll('.famgen')].map(x => x.textContent).join(',') === 'Parents,Children,Grandchildren'));
  await p.click('[data-famnode="10"]'); await settle(400);
  ok('tapping her again opens her', await visible('famPerson') && await ev(() => $('famEdTitle').textContent === 'Edith Jones'));
  await ev(() => famCancel()); await settle(200);
  await p.click('[data-famsw="list"]'); await settle(200);
  ok('People lists all 6 in the tree, by surname, Ann by her maiden name', await ev(() => [...document.querySelectorAll('#famBody .pplrow b')].map(x => x.textContent).join(',')
    === 'Martha Brown,Peter Fake,Sue Fake,Albert Jones,Ann Jones,Edith Jones') && /6 people/.test(await ev(() => document.querySelector('#famBody .dsec').textContent)),
    await ev(() => [...document.querySelectorAll('#famBody .pplrow b')].map(x => x.textContent).join(',')));
  ok('  Bob, a friend with no family links, is not in it', await ev(() => !/Bob Pal/.test($('famBody').textContent)));
  await p.fill('#famQ', 'jones'); await settle(200);
  ok('  and finds by name, maiden names too', await ev(() => [...document.querySelectorAll('#famBody .pplrow b')].map(x => x.textContent).join(',') === 'Albert Jones,Ann Jones,Edith Jones'),
    await ev(() => [...document.querySelectorAll('#famBody .pplrow b')].map(x => x.textContent).join(',')));
  await p.fill('#famQ', 'ann fake'); await settle(200);
  ok('  and by the name she has in Contacts', await ev(() => [...document.querySelectorAll('#famBody .pplrow b')].map(x => x.textContent).join(',') === 'Ann Jones'));
  await ev(() => { FAM_Q = ''; FAM_LIST = false; famRender(true); });
  // Women go by the surname they were born with in the tree (Barry, 25 Nov 2026).
  ok('Ann, Ann Fake in Contacts, is Ann Jones in the tree, her maiden name', await ev(() =>
    document.querySelector('[data-famnode="2"] b').textContent === 'Ann Jones' && fullName(CONTACTS.find(c => c.id === 2)).includes('Fake')
    && CONTACTS.find(c => c.id === 2).last_name === 'Fake'));
  ok('  a woman matched to Ancestry with no maiden name given goes by Ancestry\'s surname; a man never does', await ev(() =>
    famSurname({ sex: 'F', tree_only: false, last_name: 'Fake', family: { ged: { last_name: 'Smith' } } }) === 'Smith'
    && famSurname({ sex: 'M', tree_only: false, last_name: 'Fake', family: { ged: { last_name: 'Smith' } } }) === 'Fake'
    && famSurname({ sex: 'F', tree_only: false, last_name: 'Fake', family: {} }) === 'Fake'
    && famSurname({ sex: 'F', first_name: 'Ann', last_name: 'Fake', former_names: [{ label: 'Maiden', value: 'Ann Jones' }] }) === 'Jones'
    && famSurname({ sex: 'F', first_name: 'Ann', last_name: 'Fake', former_names: [{ label: 'Previously', value: 'Brown' }] }) === 'Fake'));

  // ---------------------------------------------------------------
  console.log('\nA person, with part dates');
  await ev(() => openFamPerson(10)); await settle(400);
  const val = n => ev(n => $('famForm').elements[n].value, n);
  ok('Edith opens with "About 1900" and Hull', await val('birth_on') === 'About 1900' && await val('birth_pl') === 'Hull');
  ok('  her mother, husband and daughter, and Add buttons', await ev(() => {
    const t = $('famKin').textContent.replace(/\s+/g, ' ');
    return /Father\s*Choose father/.test(t) && /Mother\s*Martha Brown/.test(t) && /Partners\s*Albert Jones/.test(t) && /Children\s*Ann Jones/.test(t)
      && /Add a partner/.test(t) && /Add a child/.test(t); }),
    await ev(() => $('famKin').textContent.replace(/\s+/g, ' ')));
  ok('  a photo strip (she\'s family only) and PDFs', await ev(() => !!$('famPics') && !!$('famPdfs') && !$('famToCard')));
  await p.fill('#famForm input[name="birth_on"]', 'Mar 1901');
  ok('the date is read as you type', await ev(() => document.querySelector('[name="birth_on"]').parentNode.querySelector('.famdq').textContent === 'March 1901'));
  await p.fill('#famForm input[name="chr_on"]', '12/03/1901');
  ok('  12/03/1901 is read day first', await ev(() => document.querySelector('[name="chr_on"]').parentNode.querySelector('.famdq').textContent === '12 March 1901 (day first)'));
  await p.fill('#famForm input[name="chr_pl"]', 'St Mary\'s, Hull');
  await p.fill('#famForm input[name="death_on"]', 'about 1975');
  await p.fill('#famForm input[name="burial_on"]', 'bet 1975 and 1976');
  await p.click('#famHomeAdd'); await p.fill('#famForm input[name="home_on_0"]', '1911'); await p.fill('#famForm input[name="home_pl_0"]', 'Hull');
  await p.click('#famHomeAdd'); await p.fill('#famForm input[name="home_on_1"]', '1901'); await p.fill('#famForm input[name="home_pl_1"]', 'Beverley');
  await p.click('#famNameAdd'); await p.fill('#famForm input[name="fn_value_0"]', 'Brown');
  await clear(); await clearToasts();
  await p.click('#famSave'); await settle(600);
  let w = (await writes('update', 'contacts')).pop();
  const fam = w && w.patch.family;
  ok('Save: Born March 1901, as a month', w && w.patch.birth_date === '1901-03-01' && fam.birth.p === 'month' && fam.birth.pl === 'Hull' && !fam.birth.q,
    JSON.stringify(w && w.patch));
  ok('  christened 12 March 1901 at St Mary\'s', fam && fam.chr.d === '1901-03-12' && fam.chr.p === 'day' && fam.chr.pl === "St Mary's, Hull");
  ok('  died about 1975, buried between 1975 and 1976', fam && fam.death.q === 'about' && fam.death.p === 'year' && w.patch.death_date === '1975-01-01'
    && fam.burial.q === 'between' && fam.burial.d2 === '1976-01-01');
  ok('  addresses in date order', fam && fam.homes.map(h => String(h.d).slice(0, 4) + ' ' + h.pl).join(',') === '1901 Beverley,1911 Hull');
  ok('  and her maiden name', w && JSON.stringify(w.patch.former_names) === JSON.stringify([{ label: 'Maiden', value: 'Brown' }]));
  ok('  still family only', w && w.patch.tree_only === true && /Saved/.test(await toasts()));
  await ev(async () => { const r = window.__rows.contacts.find(x => x.id === 10); Object.assign(r, (window.__writes.filter(x => x.op === 'update' && x.table === 'contacts').pop() || {}).patch); await famLoad(true); });
  await ev(() => openFamPerson(10)); await settle(300);
  await p.fill('#famForm input[name="death_on"]', 'Spring 1975');
  await clear(); await clearToasts();
  await p.click('#famSave'); await settle(300);
  ok('a date it can\'t read isn\'t saved: it says so', (await writes('update', 'contacts')).length === 0 && /Can't read the date for Died/.test(await toasts()));
  await ev(() => famCancel());
  await ev(() => openFamPerson(2)); await settle(300);
  ok('Ann, also in your contacts: her photos stay on her card, and Family tree only is off', await ev(() => !$('famPics') && !!$('famToCard')
    && !$('famForm').elements.tree_only.checked));
  await p.fill('#famForm input[name="birth_on"]', '1935');
  await p.fill('#famForm input[name="death_pl"]', 'Leeds');
  await clear();
  await p.click('#famSave'); await settle(500);
  w = (await writes('update', 'contacts')).pop();
  ok('a year alone on an everyday contact is kept, but never makes a birthday', w && w.patch.birth_date === null && w.patch.family.birth.p === 'year'
    && w.patch.death_date === '2010-07-07' && w.patch.family.death.pl === 'Leeds', JSON.stringify(w && w.patch));
  await ev(() => famCancel());

  // ---------------------------------------------------------------
  console.log('\nLinking people');
  await ev(() => openFamPerson(10)); await settle(300);
  await p.click('[data-famset="father"]'); await settle(100);
  await p.fill('#famPickQ', 'bob'); await settle(100);
  ok('Choose father: type a name, and everyone matching is offered, contacts too', await ev(() => /Bob Pal/.test($('famPickList').textContent)));
  await clear();
  await p.click('#famPickList [data-fampick="20"]'); await settle(500);
  let r = await writes('insert', 'relationships');
  ok('  picked: Bob is linked as her father, the right way round', r.length === 1 && r[0].rows.from_contact === 20 && r[0].rows.to_contact === 10 && r[0].rows.kind === 'Parent of',
    JSON.stringify(r));
  w = (await writes('update', 'contacts')).pop();
  ok('  and, having no sex given, he is taken as a man', w && w.patch.sex === 'M');
  await p.click('[data-famset="child"]'); await settle(100);
  await p.click('[data-fampick="new"]'); await settle(400);
  ok('Add a child, Someone new: a new person, with her last name', await visible('famPerson') && await ev(() => $('famEdTitle').textContent === 'New person'
    && $('famForm').elements.last.value === 'Jones' && $('famForm').elements.tree_only.checked));
  await p.fill('#famForm input[name="first"]', 'Lily'); await p.fill('#famForm input[name="birth_on"]', '1925');
  await clear();
  await p.click('#famSave'); await settle(600);
  const ins = (await writes('insert', 'contacts'))[0], lk = (await writes('insert', 'relationships'))[0];
  ok('  saved as family only, then linked as her child', ins && ins.rows.tree_only === true && ins.rows.created_by === 'me' && ins.rows.birth_date === '1925-01-01'
    && lk && lk.rows.from_contact === 10 && lk.rows.kind === 'Parent of', JSON.stringify({ ins: ins && ins.rows, lk: lk && lk.rows }));
  ok('  and back on Edith, now Edith Brown in the tree (her maiden name, given above)', await ev(() => $('famEdTitle').textContent === 'Edith Brown'));
  answers.push('12 Jun 1922', 'Hull Minster');
  await clear();
  await p.click('[data-fammarr="105"]'); await settle(400);
  w = (await writes('update', 'relationships')).pop();
  ok('when and where she married: on the link between them', w && w.patch.family.married.d === '1922-06-12' && w.patch.family.married.pl === 'Hull Minster', JSON.stringify(w && w.patch));
  await clear();
  await p.click('[data-famunlink="104"]'); await settle(400);
  ok('taking a link off asks, then takes off only the link', (await writes('delete', 'relationships')).length === 1 && (await writes('delete', 'contacts')).length === 0);
  // Since ML419 (27 Nov 2026) the list has the person themselves in it too, greyed, oldest first.
  ok('  brothers and sisters are worked out from parents, with the person themselves in their place', await ev(() => { famCancel(); openFamPerson(1);
    return /Brothers and sisters/.test($('famKin').textContent) && [...$('famKin').querySelectorAll('[data-hm^="fsib:1:"]')].map(r => r.dataset.hm.split(':')[2]).join(',') === '1,3'
      && /This person/.test($('famKin').querySelector('.famme').textContent); }));
  await ev(() => famCancel());

  // ---------------------------------------------------------------
  console.log('\nPhotos, PDFs, and taking someone out');
  await ev(() => openFamPerson(11)); await settle(300);
  await clear();
  await p.setInputFiles('#famPdfAdd', { name: 'Census 1911.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 pretend') });
  await settle(400);
  ok('a PDF goes to fam/<you>/', await ev(() => window.__writes.some(x => x.op === 'upload' && /^fam\/me\/.+\.pdf$/.test(x.path))));
  await p.click('#famSave'); await settle(500);
  w = (await writes('update', 'contacts')).pop();
  ok('  and is kept on him, by name', w && w.patch.family.files.length === 1 && w.patch.family.files[0].name === 'Census 1911', JSON.stringify(w && w.patch.family));
  await ev(async () => { const x = window.__rows.contacts.find(y => y.id === 11); x.family = { files: [{ path: 'fam/me/abc.pdf', name: 'Census 1911' }] }; x.photos = [{ path: 'fam/me/p1.jpg' }]; await famLoad(true); });
  await ev(() => openFamPerson(11)); await settle(300);
  await clear();
  await p.click('#famDelete'); await settle(600);
  ok('Take them out of the tree: deletes him, his photos and PDFs', (await writes('delete', 'contacts')).length === 1
    && await ev(() => window.__writes.some(x => x.op === 'rmfile' && x.paths.includes('fam/me/abc.pdf') && x.paths.includes('fam/me/p1.jpg'))));
  ok('  only for family-only people: Ann has no such button', await ev(() => { openFamPerson(2); const r = !$('famDelete'); famCancel(); return r; }));

  // ---------------------------------------------------------------
  console.log('\nBringing a tree in from Ancestry');
  await seed();
  await ev(() => openFam()); await settle(400);
  await ev(() => openFamImport()); await settle(200);
  await p.setInputFiles('#famImpFile', { name: 'Fake Family Tree.zip', mimeType: 'application/zip',
    buffer: zipOf('Fake Family Tree.ged', GED(), [['Read me.txt', 'Not the tree']]) });
  await settle(800);
  const imp = () => ev(() => $('famImpBody').textContent.replace(/\s+/g, ' '));
  ok('it reads the zip Ancestry gives you', /5 people and 2 families in the file/.test(await imp()), (await imp()).slice(0, 200));
  ok('  4 new, and Peter Fake taken as the same person (same name, born the same year)', /4 new to bring in/.test(await imp())
    && /Peter Fake born 1960 in the file, and Peter Fake born 1960 in your contacts/.test(await imp())
    && await ev(() => document.querySelector('[data-famsame$=":1"]').getAttribute('aria-pressed') === 'true'));
  ok('  Ann Jones, born who knows when, is offered against Ann Fake (Jones was her maiden name), as not the same', /Ann Jones in the file, and Ann Fake born 1935 in your contacts/.test(await imp())
    && await ev(() => [...document.querySelectorAll('[data-famsame$=":0"]')].some(b => b.getAttribute('aria-pressed') === 'true')));
  ok('  the date it can\'t read is listed', /1 date it can't read, left out/.test(await imp()) && /Mary Smith: Christened "Spring 1852"/.test(await imp()));
  ok('  and the one read day first', /1 date read day first/.test(await imp()) && /Tom Fake: "03\/04\/1901"/.test(await imp()));
  await clear();
  await p.click('#famImpGo'); await settle(1500);
  const cins = (await writes('insert', 'contacts')).flatMap(x => x.rows);
  ok('Bring them in: 4 family-only people, each with Ancestry\'s number', cins.length === 4 && cins.every(x => x.tree_only && x.created_by === 'me' && /^1000000000\d\d$/.test(x.ged_id)),
    JSON.stringify(cins.map(x => x.ged_id)));
  const john = cins.find(x => x.first_name === 'John'), mary = cins.find(x => x.first_name === 'Mary'), tom = cins.find(x => x.first_name === 'Tom');
  ok('  John William: first and middle names, born 12 March 1850 in Leeds, died about 1920', john && john.given_names === 'William' && john.birth_date === '1850-03-12'
    && john.family.birth.pl === 'Leeds, Yorkshire, England' && john.family.death.q === 'about' && john.death_date === '1920-01-01', JSON.stringify(john));
  ok('  Mary: her married name as another name, two addresses, christening place kept without the date', mary && mary.last_name === 'Smith'
    && mary.former_names[0].value === 'Mary Fake' && mary.family.homes.length === 2 && mary.family.chr.pl === "St Peter's, Leeds" && !mary.family.chr.d);
  ok('  Tom: born 3 April 1901, died with no date known', tom && tom.birth_date === '1901-04-03' && tom.family.death.dead === true && !tom.death_date);
  ok('  what came from Ancestry is noted, for next time', john && john.family.ged && john.family.ged.first_name === 'John' && john.family.ged.birth.d === '1850-03-12');
  w = (await writes('update', 'contacts')).find(x => x.where.some(c => c[1] === 'id' && c[2] === 1));
  ok('Peter, already in your contacts: gets Ancestry\'s number, but his name and birthday are left alone', w && w.patch.ged_id === '100000000004'
    && !('first_name' in w.patch) && !('birth_date' in w.patch), JSON.stringify(w && w.patch));
  const rins = (await writes('insert', 'relationships')).flatMap(x => x.rows);
  ok('links: both couples married (as Ancestry has them), John and Mary in 1875 in Leeds, Tom and Ann with no wedding recorded',
    rins.filter(x => x.kind === 'Married to').length === 2 && rins.filter(x => x.kind === 'Partner of').length === 0
    && rins.filter(x => x.family && x.family.married).length === 1 && rins.find(x => x.family && x.family.married).family.married.pl === 'Leeds'
    && rins.find(x => x.family && x.family.married).family.married.d === '1875-01-01', JSON.stringify(rins));
  ok('  and each child to both parents', rins.filter(x => x.kind === 'Parent of').length === 4 && rins.some(x => x.kind === 'Parent of' && x.to_contact === 1));
  // The server fills a key missing from some rows of a batch with nothing, and
  // step 68's family box can't be nothing: on 24 Nov 2026 every batch of Barry's
  // links was refused because parent links had no family box and couples did.
  ok('  every row in each batch it saves has the same keys, the family box included', await ev(() =>
    window.__writes.filter(x => x.op === 'insert' && Array.isArray(x.rows) && x.rows.length > 1).every(x => {
      const k = r => Object.keys(r).filter(n => r[n] !== undefined).sort().join(',');
      return x.rows.every(r => k(r) === k(x.rows[0])) && (x.table !== 'relationships' || x.rows.every(r => r.family && typeof r.family === 'object')); })));
  ok('  done, and says what it did', /Done\. 4 new people, 1 brought up to date, 6 new links/.test(await imp()), await imp());

  console.log('\nThe same tree again, newer, from Ancestry');
  // What the first run saved, as the database would now hold it.
  await ev(() => {
    const ins = window.__writes.filter(x => x.op === 'insert' && x.table === 'contacts').flatMap(x => x.rows);
    // The stub numbers new rows in turn, so the first of the 4 has the lowest new
    // number the links use.
    const known = new Set(window.__rows.contacts.map(c => c.id));
    const rel0 = window.__writes.filter(x => x.op === 'insert' && x.table === 'relationships').flatMap(x => x.rows);
    let id = Math.min(...rel0.flatMap(r => [r.from_contact, r.to_contact]).filter(i => !known.has(i))) - 1; const byG = {};
    ins.forEach(x => { const row = { id: ++id, is_organisation: false, photos: [], ...JSON.parse(JSON.stringify(x)) }; byG[x.ged_id] = row.id; window.__rows.contacts.push(row); });
    const up = window.__writes.filter(x => x.op === 'update' && x.table === 'contacts').pop();
    Object.assign(window.__rows.contacts.find(x => x.id === 1), JSON.parse(JSON.stringify(up.patch)));
    byG['100000000004'] = 1;
    // The links, against the ids the database gave.
    const rel = window.__writes.filter(x => x.op === 'insert' && x.table === 'relationships').flatMap(x => x.rows);
    rel.forEach((r, i) => window.__rows.relationships.push({ id: 900 + i, tree_only: false, ...r }));
    window.__rows.relationships.forEach(r => { if (r.id >= 900) {
      const a = window.__rows.contacts.find(c => c.id === r.from_contact), b = window.__rows.contacts.find(c => c.id === r.to_contact);
      r.tree_only = !!(a && b && a.tree_only && b.tree_only); } });
    // The database hands each box back with its parts reordered (shortest
    // name first, then a to z), as Postgres's jsonb does.
    const jsonb = v => Array.isArray(v) ? v.map(jsonb) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map(k => [k, jsonb(v[k])])) : v;
    window.__rows.contacts.forEach(c => { if (c.family) c.family = jsonb(c.family); if (c.former_names) c.former_names = jsonb(c.former_names); });
    // Changed here since: John's birthplace.
    const j = window.__rows.contacts.find(x => x.first_name === 'John'); j.family.birth.pl = 'Headingley, Leeds';
  });
  await ev(async () => { await loadAll(); await famLoad(true); openFamImport(); }); await settle(200);
  await p.setInputFiles('#famImpFile', { name: 'Fake Family Tree.ged', mimeType: 'text/plain', buffer: Buffer.from(GED({ maryDied: true, johnBorn: 'Leeds, England' })) });
  await settle(800);
  ok('it reads a .ged on its own: nobody new, all 5 already here', /0 new to bring in; 5 already here, brought up to date/.test(await imp()), (await imp()).slice(0, 200));
  ok('  and asks nothing this time', !(await ev(() => !!document.querySelector('[data-famsame]'))));
  await clear();
  await p.click('#famImpGo'); await settle(1500);
  ok('nobody is added twice', (await writes('insert', 'contacts')).length === 0);
  const ups = await writes('update', 'contacts');
  const maryUp = ups.find(x => x.patch.family && x.patch.family.ged && x.patch.family.ged.first_name === 'Mary');
  ok('Mary\'s death, new on Ancestry, comes in', maryUp && maryUp.patch.death_date === '1930-06-03' && maryUp.patch.family.death.pl === 'York', JSON.stringify(maryUp && maryUp.patch));
  const johnUp = ups.find(x => x.patch.family && x.patch.family.ged && x.patch.family.ged.first_name === 'John');
  ok('John\'s birthplace, changed here and on Ancestry, stays as you have it', johnUp && johnUp.patch.family.birth.pl === 'Headingley, Leeds'
    && johnUp.patch.family.ged.birth.pl === 'Leeds, England', JSON.stringify(johnUp && johnUp.patch.family));
  ok('  and it says so', /1 detail changed here since the last time were kept as you have them/.test(await imp()), await imp());
  ok('no link made twice', (await writes('insert', 'relationships')).flatMap(x => x.rows).length === 0);
  ok('nobody unchanged is saved again', ups.length === 2, ups.length);

  // ---------------------------------------------------------------
  console.log('\nOther things');
  await ev(() => { $('famImp').classList.add('hidden'); lockBackground(); });
  ok('an empty tree says how to start, with Bring in from Ancestry', await ev(async () => {
    const keep = [FAM_ONLY, CONTACTS, LINKS]; FAM_ONLY = []; FAM_LINKS = []; CONTACTS = []; LINKS = [];
    const save = MY_PROFILE.my_contact_id; MY_PROFILE.my_contact_id = null; FAM_MID = null; famRender();
    const t = $('famBody').textContent; [FAM_ONLY, CONTACTS, LINKS] = keep; MY_PROFILE.my_contact_id = save; await famLoad(true); famRender(true);
    return /Nobody in your family tree yet/.test(t) && /Bring in from Ancestry/.test(t); }));
  ok('a tree that can\'t be reached says so, and never looks empty', await ev(() => {
    FAM_LOAD_FAILED = true; famRender(); const t = $('famBody').textContent; FAM_LOAD_FAILED = false; famRender(true);
    return /Could not reach your family tree/.test(t) && /Nothing is lost/.test(t); }));
  ok('dates: the shapes in Ancestry files', await ev(() => {
    const t = x => { const d = famParseDate(x); return d ? (d.bad ? 'bad' : famDateText(d)) : ''; };
    return t('12 MAR 1850') === '12 March 1850' && t('ABT. 1850') === 'About 1850' && t('ABOUT 1850') === 'About 1850' && t('BEF. 3 JUN 1900') === 'Before 3 June 1900'
      && t('Sept 1888') === 'September 1888' && t('12 July 1850') === '12 July 1850' && t('1850-1855') === '1850 to 1855' && t('UNKNOWN') === ''
      && t('Deceased') === 'Date not known' && t('03/04/1901 9:15:00 P.M.') === '3 April 1901' && t('25/12/1900') === '25 December 1900'
      && t('12/25/1900') === '25 December 1900' && t('1.6.1890') === '1 June 1890' && t('31 Feb 1900') === 'bad' && t('Spring 1852') === 'bad'
      && t(famDateText(famParseDate('bet 1975 and 1976'))) === '1975 to 1976'; }));
  ok('  German months, as in records from Germany', await ev(() => {
    const t = x => { const d = famParseDate(x); return d ? (d.bad ? 'bad' : famDateText(d)) : ''; };
    return t('5 Okt 1766') === '5 October 1766' && t('21 Dez 1848') === '21 December 1848' && t('3. März 1850') === '3 March 1850'
      && t('Mrz 1850') === 'March 1850' && t('Mai 1850') === 'May 1850' && t('abt. 11 Dez 1796') === 'About 11 December 1796'; }));
  ok('  and registration quarters: Jun Qrtr 1857 is April to June', await ev(() => {
    const t = x => { const d = famParseDate(x); return d ? (d.bad ? 'bad' : famDateText(d)) : ''; };
    return t('Jun Qrtr 1857') === 'April 1857 to June 1857' && t('Mar Qtr 1900') === 'January 1900 to March 1900'
      && t('December Quarter 1871') === 'October 1871 to December 1871' && t('Q3 1890') === 'July 1890 to September 1890'
      && famParseDate('Sep Qtr 1890').d === '1890-07-01' && famParseDate('Sep Qtr 1890').d2 === '1890-09-01' && t('Dec 173 1871') === 'bad'; }));
  // The first time, the tree is empty: its own Bring in from Ancestry button, then
  // Bring them in on the import screen (they once shared a name, so the second did nothing).
  await ev(async () => { window.__rows.contacts = []; window.__rows.relationships = []; MY_PROFILE.my_contact_id = null;
    try { localStorage.removeItem('fam-mid'); } catch (e) {} FAM_MID = null; await loadAll(); await famLoad(true); openFam(); }); await settle(300);
  await p.click('#famEmptyImp'); await settle(200);
  ok('an empty tree: its Bring in from Ancestry button opens the import', await visible('famImp'));
  await p.setInputFiles('#famImpFile', { name: 'Fake Family Tree.zip', mimeType: 'application/zip', buffer: zipOf('Fake Family Tree.ged', GED()) });
  await settle(800); await clear();
  await p.click('#famImpBody #famImpGo'); await settle(1500);
  ok('  and Bring them in brings them in', (await writes('insert', 'contacts')).flatMap(x => x.rows).length === 5 && /Done\./.test(await imp()), await imp());
  await ev(() => { $('famImp').classList.add('hidden'); lockBackground(); MY_PROFILE.my_contact_id = 1; });
  ok('the menu has Add someone, Bring in from Ancestry and See all of the tree', await ev(() => {
    const l = areaItems('fam').map(x => x.label); return l.includes('Add someone') && l.includes('Bring in from Ancestry') && l.includes('See all of the tree'); }));
  const help = s => ev(t => document.documentElement.innerHTML.includes(t), s);
  ok('the help explains it', await help('<h4 id="h-fam">Family Tree</h4>') && await help('<strong>Bring in from Ancestry</strong> (Menu) reads the file Ancestry exports')
    && await help('When a contact dies, give them the date in Died as usual') && await ev(() => HELP_AT.fam === 'h-fam'));
  ok('nothing spills off the side at 320 wide', await (async () => {
    await p.setViewportSize({ width: 320, height: 700 }); await ev(() => { openFamPerson(10); }); await settle(300);
    const r = await ev(() => [$('famEdBody'), $('famBody')].every(b => b.scrollWidth <= b.clientWidth + 1));
    await ev(() => famCancel()); await p.setViewportSize({ width: 390, height: 844 }); return r; })());

  console.log('\nThe version');
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.25.1');
  ok('2026.11.25.1 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  its lines for What\'s new are short enough', V && V.changes.length >= 1 && V.changes.every(x => x.length < 160));

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
