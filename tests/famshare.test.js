// Sharing the Family Tree (ML406, step 70, version 2026.11.25.3): the owner
// ticks who can see their tree; someone it is shared with switches to it with
// Yours / theirs at the top, moves about it and opens anyone in it, with their
// photos, PDFs and whole card, but cannot add or change anything. Before step
// 70 the tree works as before. tree70.test.js runs step 70 itself.
// Everyone here is made up.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|PGRST205|does not exist|not shared with you|Server unwell|^\[object Object\]$/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
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
  const writes = (op, table) => ev(([o, t]) => window.__writes.filter(w => w.op === o && w.table === t), [op, table]);
  const visible = id => ev(i => !document.getElementById(i).classList.contains('hidden'), id);
  const nodes = () => ev(() => [...document.querySelectorAll('[data-famnode]')].map(x => Number(x.dataset.famnode)).sort((a, b) => a - b).join(','));
  const menu = () => ev(() => areaItems('fam').map(x => x.label));
  const changed = () => ev(() => window.__writes.filter(w => ['insert', 'update', 'delete', 'upsert', 'upload', 'rmfile'].includes(w.op)).length);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // Your own tree, as family.test.js has it, and the tree "Someone Else" shares.
  await ev(async () => {
    const c = (id, first, last, more) => ({ id, created_by: 'me', first_name: first, last_name: last, is_organisation: false,
      former_names: [], photos: [], family: {}, tree_only: false, ...more });
    window.__rows.link_kinds = [
      { id: 2, name: 'Married to', inverse_name: 'Married to', sort_order: 20, tree_role: 'partner' },
      { id: 3, name: 'Parent of', inverse_name: 'Child of', sort_order: 30, tree_role: 'parent' },
      { id: 4, name: 'Child of', inverse_name: 'Parent of', sort_order: 40, tree_role: 'child' },
      { id: 6, name: 'Friend of', inverse_name: 'Friend of', sort_order: 120, tree_role: null }];
    window.__rows.contacts = [c(1, 'Peter', 'Fake', { birth_date: '1960-05-01' }), c(2, 'Ann', 'Fake', { sex: 'F' }),
      c(10, 'Edith', 'Jones', { tree_only: true, sex: 'F' })];
    window.__rows.relationships = [{ id: 100, from_contact: 2, to_contact: 1, kind: 'Parent of', tree_only: false, family: {} },
      { id: 102, from_contact: 10, to_contact: 2, kind: 'Parent of', tree_only: false, family: {} }];
    window.__rows.tree_shares = [];
    const me = window.__rows.profiles.find(x => x.id === 'me'); me.my_contact_id = 1;
    const o = (id, first, last, more) => ({ id, created_by: 'other', first_name: first, last_name: last, is_organisation: false,
      former_names: [], photos: [], family: {}, tree_only: true, ...more });
    window.__theirs = { people: [
      o(500, 'Olive', 'Other', { tree_only: false, sex: 'F', phones: [{ label: 'Mobile', value: '07000 000001' }],
        emails: [{ label: 'Home', value: 'olive@example.com' }], town: 'Hull', photos: [{ path: '500/p.jpg' }], notes: 'Kept the shop' }),
      o(501, 'Oscar', 'Other', { sex: 'M' }),
      o(502, 'Opal', 'Old', { sex: 'F', family: { birth: { d: '1890-01-01', p: 'year', q: 'about', pl: 'Hull' },
        files: [{ path: 'fam/other/x.pdf', name: 'Birth certificate' }] }, photos: [{ path: 'fam/other/y.jpg' }] })],
      links: [{ id: 900, from_contact: 501, to_contact: 500, kind: 'Parent of', family: {} },
        { id: 901, from_contact: 502, to_contact: 500, kind: 'Parent of', family: {} },
        { id: 902, from_contact: 501, to_contact: 502, kind: 'Married to', family: { married: { d: '1888-06-01', p: 'month', pl: 'York' } } }],
      mid: 500 };
    window.__treeRpc = 'ok';
    window.__rpc = (name, args) => name === 'family_tree'
      ? (window.__treeRpc === 'ok' && args.o === 'other' ? { data: JSON.parse(JSON.stringify(window.__theirs)), error: null }
        : { data: null, error: { code: 'P0001', message: 'That family tree is not shared with you' } })
      : { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + name } };
    try { ['fam-mid', 'fam-of', 'fam-mid:other'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
    FAM_ONLY = null; FAM_MID = null; FAM_OF = null; await loadAll();
  });

  // ---------------------------------------------------------------
  console.log('\nYour tree, shared with nobody yet');
  await ev(() => openFam()); await settle(600);
  ok('it opens as before, with no Yours / theirs buttons', await nodes() === '1,2,10' && await ev(() => !document.querySelector('.famof')));
  ok('  the + is there to add someone', await ev(() => $('famAdd').style.display !== 'none'));
  ok('the menu has Who can see your tree', (await menu()).includes('Who can see your tree'));
  await ev(() => famShareBox()); await settle(200);
  ok('it lists everyone who signs in, nobody ticked', await ev(() => {
    const bx = [...document.querySelectorAll('#famShare [data-famshare]')];
    return bx.map(x => x.dataset.famshare).sort().join(',') === 'other,sandra' && bx.every(x => !x.checked); }));
  ok('  and says what they will see, and that only you can change it', await ev(() =>
    /whole tree/.test($('famShare').textContent) && /photos and PDFs/.test($('famShare').textContent) && /Only you can change it/.test($('famShare').textContent)));
  await clearToasts(); await ev(() => { window.__writes.length = 0; });
  await p.click('#famShare [data-famshare="sandra"]'); await settle(300);
  ok('ticking Sandra shares it with her', JSON.stringify((await writes('insert', 'tree_shares')).map(w => w.rows))
    === JSON.stringify([{ owner_id: 'me', viewer_id: 'sandra' }]) && /Sandra can see your tree now/.test(await toasts()));
  await ev(() => { $('famShare').remove(); famShareBox(); }); await settle(100);
  ok('  and she is still ticked when the box opens again', await ev(() => document.querySelector('#famShare [data-famshare="sandra"]').checked));
  await clearToasts();
  await p.click('#famShare [data-famshare="sandra"]'); await settle(300);
  const del = await writes('delete', 'tree_shares');
  ok('unticking her stops it, for your tree and her only', del.length === 1
    && JSON.stringify(del[0].where) === JSON.stringify([['eq', 'owner_id', 'me'], ['eq', 'viewer_id', 'sandra']])
    && /Sandra no longer sees your tree/.test(await toasts()), JSON.stringify(del));
  await p.click('#famShareDone'); await settle(100);
  ok('Done closes the box', await ev(() => !$('famShare')));

  console.log('\nBefore step 70');
  await ev(async () => { window.__realFrom = sb.from; const real = sb.from.bind(sb);
    sb.from = t => t === 'tree_shares' ? { select: () => Promise.resolve({ data: null,
      error: { code: 'PGRST205', message: "Could not find the table 'public.tree_shares' in the schema cache" } }) } : real(t);
    await famRefresh(); });
  await settle(200); await clearToasts();
  ok('your tree still draws', await nodes() === '1,2,10');
  await ev(() => famShareBox()); await settle(200);
  ok('  and Who can see your tree says step 70 is needed first', await ev(() => !$('famShare'))
    && /needs step 70 run in Supabase first/.test(await toasts()));
  await ev(async () => { sb.from = window.__realFrom; await famRefresh(); });

  // ---------------------------------------------------------------
  console.log('\nA tree shared with you');
  await ev(async () => { window.__rows.tree_shares = [{ owner_id: 'other', viewer_id: 'me' }]; await openFam(); }); await settle(500);
  ok('you still open on your own tree, with Yours and theirs at the top', await nodes() === '1,2,10' && await ev(() =>
    [...document.querySelectorAll('.famof button')].map(x => x.textContent.trim() + ':' + x.getAttribute('aria-pressed')).join(',')
      === 'Yours:true,Someone Else’s:false'));
  await ev(() => { window.__writes.length = 0; });
  await p.click('.famof [data-famof="other"]'); await settle(500);
  ok('tapping theirs fetches it from the database', await ev(() => JSON.stringify(window.__writes.filter(w => w.op === 'rpc').map(w => [w.name, w.args]))
    === JSON.stringify([['family_tree', { o: 'other' }]])));
  ok('  and draws their people only, with them in the middle', await nodes() === '500,501,502'
    && await ev(() => FAM_MID === 500 && /In the middle: Olive Other/.test(document.querySelector('.fammidline').textContent)));
  ok('  saying whose it is, and that it is to look at', await ev(() =>
    /Someone Else’s tree, shared with you to look at/.test(document.querySelector('.famtheirs').textContent)));
  ok('  with no + to add anyone', await ev(() => $('famAdd').style.display === 'none'));
  ok('  remembered on this phone', await ev(() => localStorage.getItem('fam-of') === 'other'));
  const m = await menu();
  ok('the menu lets you look about and go back, nothing more', JSON.stringify(m) === JSON.stringify(['See all of the tree', 'The list of people', 'Back to your own tree']), JSON.stringify(m));

  console.log('\nOpening someone in it');
  await p.click('[data-famnode="500"]'); await settle(500);
  ok('tapping the one in the middle opens them', await visible('famPerson') && await ev(() => $('famEdTitle').textContent === 'Olive Other'));
  ok('  to look at: no Save, Close not Cancel, nothing to type in', await ev(() =>
    $('famSave').style.visibility === 'hidden' && $('famEdCancel').textContent === 'Close'
    && !$('famForm') && $('famEdBody').querySelectorAll('input,textarea,select').length === 0));
  ok('  saying whose tree it is', await ev(() => /In Someone Else’s tree, to look at. Only they can change it./.test($('famEdBody').textContent)));
  ok('  her whole card: phone, email, town, notes', await ev(() => {
    const t = $('famEdBody'); return !!t.querySelector('a[href="tel:07000000001"]') && !!t.querySelector('a[href="mailto:olive@example.com"]')
      && /Contact details/.test(t.textContent) && /Hull/.test(t.textContent) && /Kept the shop/.test(t.textContent); }),
    await ev(() => $('famEdBody').innerHTML.slice(0, 600)));
  ok('  her mother and father', await ev(() => {
    const t = [...$('famEdBody').querySelectorAll('.famsub, [data-famkin] .t')].map(x => x.textContent.trim()).join('|');
    return /Father\|Oscar Other/.test(t) && /Mother\|Opal Old/.test(t); }),
    await ev(() => [...$('famEdBody').querySelectorAll('.famsub, [data-famkin] .t')].map(x => x.textContent.trim()).join('|')));
  ok('  and her photo', await ev(() => { const i = document.querySelector('#famLookPics img'); return i && /signed\.test\/500\/p\.jpg/.test(i.src); }));
  await p.click('#famEdBody [data-famkin="502"]'); await settle(500);
  ok('tapping her mother opens her the same way', await ev(() => $('famEdTitle').textContent === 'Opal Old' && !$('famForm')));
  ok('  born about 1890 in Hull', await ev(() => /Born\s*About 1890, Hull/.test($('famEdBody').textContent)));
  ok('  married June 1888 in York, under her partner', await ev(() => /Oscar Other[\s\S]*Married June 1888, York/.test($('famEdBody').textContent)));
  ok('  her photo from the tree', await ev(() => { const i = document.querySelector('#famLookPics img'); return i && /fam\/other\/y\.jpg/.test(i.src); }));
  await ev(() => { window.__opened = null; window.open = () => (window.__opened = { location: {}, close() {} }); });
  await p.click('#famEdBody [data-famlookpdf="0"]'); await settle(300);
  ok('  and her PDF opens', await ev(() => /Birth certificate/.test($('famEdBody').textContent)
    && window.__opened && window.__opened.location.href === 'https://signed.test/fam/other/x.pdf'));
  await p.click('#famMidBtn'); await settle(400);
  ok('Put them in the middle works, kept for their tree only', await ev(() => FAM_MID === 502 && !$('famPerson').classList.contains('hidden') === false
    && localStorage.getItem('fam-mid:other') === '502' && localStorage.getItem('fam-mid') !== '502'));
  await clearToasts(); await ev(() => openFamPerson(null)); await settle(200);
  ok('there is no adding to their tree', !(await visible('famPerson')) && /Only Someone Else can add to their tree/.test(await toasts()));
  await ev(() => { FAM_LIST = true; famRender(); }); await settle(200);
  ok('The list of people lists their 3', await ev(() => document.querySelectorAll('#famBody [data-famopen]').length === 3));
  await ev(() => { FAM_LIST = false; famRender(); });
  ok('nothing was changed anywhere while looking', await changed() === 0);

  console.log('\nBack to yours, and the next time');
  await ev(() => areaItems('fam').find(x => x.label === 'Back to your own tree').fn()); await settle(400);
  ok('Back to your own tree goes back, with + again', await nodes() === '1,2,10' && await ev(() => FAM_OF === null
    && $('famAdd').style.display !== 'none' && localStorage.getItem('fam-of') === ''));
  await ev(() => openFamPerson(10)); await settle(300);
  ok('  and your own people open to change, with Save and Cancel', await ev(() => !!$('famForm')
    && $('famSave').style.visibility === '' && $('famEdCancel').textContent === 'Cancel'));
  await ev(() => famCancel());
  await ev(() => { localStorage.setItem('fam-of', 'other'); return openFam(); }); await settle(500);
  ok('it opens on the tree you looked at last', await nodes() === '500,501,502' && await ev(() => FAM_MID === 502));
  await ev(async () => { await loadAll(); await openDetail(2); }); await settle(500);
  await p.click('#detBody [data-famgo="10"]'); await settle(400);
  ok('someone on your own card opens in your own tree, not theirs', await ev(() => FAM_OF === null && $('famEdTitle').textContent === 'Edith Jones' && !!$('famForm')));
  await ev(() => { famCancel(); $('detail').classList.add('hidden'); lockBackground(); });

  console.log('\nWhen the share ends');
  await ev(async () => { localStorage.setItem('fam-of', 'other'); window.__treeRpc = 'gone'; await openFam(); }); await settle(400);
  ok('if the database says no, it says they no longer share it', await ev(() =>
    /Someone Else no longer shares their family tree with you/.test($('famBody').textContent) && !!document.querySelector('.famof')));
  await ev(async () => { window.__treeRpc = 'ok'; window.__rows.tree_shares = []; await famRefresh(); }); await settle(300);
  ok('once it is gone from the list, refresh goes back to yours', await nodes() === '1,2,10' && await ev(() => FAM_OF === null && !document.querySelector('.famof')));

  console.log('\nWith no tree of your own');
  await ev(async () => { window.__rows.tree_shares = [{ owner_id: 'other', viewer_id: 'me' }];
    window.__rows.contacts = []; window.__rows.relationships = [];
    window.__rows.profiles.find(x => x.id === 'me').my_contact_id = null;
    localStorage.removeItem('fam-of'); await loadAll(); await openFam(); }); await settle(500);
  ok('it opens on the tree shared with you', await nodes() === '500,501,502' && await ev(() => FAM_OF === 'other'));

  console.log('\nThe help and the version');
  ok('the help says how sharing works', await ev(() => { const h = document.documentElement.innerHTML;
    return /<strong>Sharing your tree.<\/strong>/.test(h) && /<strong>Who can see your tree<\/strong> \(Menu\)/.test(h)
      && /for each tree: <strong>Yours<\/strong> and theirs/.test(h) && !/Only you see your tree, for now/.test(h); }));
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.25.3');
  ok('2026.11.25.3 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  its lines for What\'s new are short enough', V && V.changes.length >= 1 && V.changes.every(x => x.length < 160));

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
