// 27 Nov 2026 (version 2026.11.27.1), Barry's two requests that day:
//   ML419  Family Tree order: on a person's screen, Partners, Children and
//          Brothers and sisters are put in order by holding a name and
//          sliding it. Partners newest at the top, oldest at the bottom (by
//          wedding date until moved); children and brothers and sisters
//          oldest first (by birth date until moved). Brothers and sisters
//          include the person themselves, greyed. In the tree the oldest
//          partner sits next to them, and each child hangs from the partner
//          they are a child of. The order is kept in family.order on each
//          person; moving children keeps the other parent's list in step, and
//          moving brothers and sisters changes their parents' order.
//   ML420  Wishlist: Done and Not doing ideas fold to one line each until
//          tapped; a search box (every word, in Tile/Area, description or who
//          it's from) and Tile/Area, Newest or Oldest order, remembered.
// Everyone here is made up.
const { chromium } = require('playwright');
const path = require('path');
const { holdSlide } = require('./hold');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|Server unwell|^\[object Object\]$/i;

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
  const clear = () => ev(() => { window.__writes.length = 0; });
  // The order saved for a person, from what the page sent.
  const saved = (id, k) => ev(([i, k]) => { const w = window.__writes.filter(x => x.op === 'update' && x.table === 'contacts'
      && x.where.some(f => f[0] === 'eq' && f[1] === 'id' && f[2] === i)).pop();
    const o = w && w.patch.family && w.patch.family.order; return o && o[k] ? o[k].join(',') : null; }, [id, k]);
  const keys = pre => ev(pre => [...$('famKin').querySelectorAll(`[data-hm^="${pre}"]`)].map(r => r.dataset.hm.split(':').pop()).join(','), pre);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  await ev(async () => {
    const c = (id, first, last, more) => ({ id, created_by: 'me', first_name: first, last_name: last, is_organisation: false,
      former_names: [], photos: [], family: {}, tree_only: true, ...more });
    window.__rows.link_kinds = [
      { id: 1, name: 'Partner of', inverse_name: 'Partner of', sort_order: 10, tree_role: 'partner' },
      { id: 2, name: 'Married to', inverse_name: 'Married to', sort_order: 20, tree_role: 'partner' },
      { id: 3, name: 'Parent of', inverse_name: 'Child of', sort_order: 30, tree_role: 'parent' },
      { id: 4, name: 'Child of', inverse_name: 'Parent of', sort_order: 40, tree_role: 'child' },
      { id: 5, name: 'Sibling of', inverse_name: 'Sibling of', sort_order: 50, tree_role: 'sibling' }];
    window.__rows.contacts = [
      c(1, 'Peter', 'Test', { tree_only: false, sex: 'M', birth_date: '1955-06-01' }),
      c(30, 'Jane', 'Ash', { sex: 'F' }), c(31, 'Kate', 'Birch', { sex: 'F' }),
      c(40, 'Amy', 'Test', { sex: 'F', birth_date: '1982-03-03' }),
      c(41, 'Ben', 'Test', { sex: 'M', birth_date: '1997-04-04' }),
      c(42, 'Cal', 'Test', { sex: 'M' }),
      c(50, 'George', 'Test', { sex: 'M', birth_date: '1925-01-01' }),
      c(51, 'Mary', 'Test', { sex: 'F', birth_date: '1928-01-01' }),
      c(52, 'Ruth', 'Test', { sex: 'F', birth_date: '1950-01-01' }),
      c(53, 'Sam', 'Test', { sex: 'M' }),
      c(54, 'Lily', 'Dean', { sex: 'F', family: { birth: { d: '1960', p: 'year' } } })];
    let n = 200;
    const l = (a, z, kind, fam) => ({ id: n++, from_contact: a, to_contact: z, kind, tree_only: a !== 1 && z !== 1, family: fam || {} });
    window.__rows.relationships = [
      l(1, 30, 'Married to', { married: { d: '1980', p: 'year' } }), l(1, 31, 'Married to', { married: { d: '1995', p: 'year' } }),
      l(1, 40, 'Parent of'), l(30, 40, 'Parent of'), l(1, 41, 'Parent of'), l(31, 41, 'Parent of'), l(1, 42, 'Parent of'), l(30, 42, 'Parent of'),
      l(50, 1, 'Parent of'), l(51, 1, 'Parent of'), l(50, 52, 'Parent of'), l(51, 52, 'Parent of'),
      l(50, 53, 'Parent of'), l(51, 53, 'Parent of'), l(51, 54, 'Parent of'), l(50, 51, 'Married to')];
    window.__rows.profiles.find(x => x.id === 'me').my_contact_id = 1;
    try { localStorage.removeItem('fam-mid'); localStorage.removeItem('wish-sort'); } catch (e) {}
    FAM_ONLY = null; FAM_MID = null; await loadAll();
  });

  // ---------------------------------------------------------------
  console.log('\nML419: the lists start in date order');
  await ev(() => openFam()); await settle(700);
  await ev(() => openFamPerson(1)); await settle(400);
  ok('partners: the newest marriage (Kate, 1995) at the top, Jane (1980) at the bottom', await keys('fmate:1:') === '31,30', await keys('fmate:1:'));
  ok('  each with their wedding line moving with them', await ev(() => !!$('famKin').querySelector('[data-hm="fmate:1:30"] [data-fammarr]')
    && /Married 1980/.test($('famKin').querySelector('[data-hm="fmate:1:30"]').textContent)));
  ok('children oldest first, Cal (no birth date) last', await keys('fkid:1:') === '40,41,42', await keys('fkid:1:'));
  ok('brothers and sisters oldest first, with Peter himself in his place, greyed, and Sam (no date) last',
    await keys('fsib:1:') === '52,1,54,53' && await ev(() => $('famKin').querySelector('[data-hm="fsib:1:1"] .famme') !== null
      && /This person/.test($('famKin').querySelector('[data-hm="fsib:1:1"]').textContent)
      && !$('famKin').querySelector('[data-hm="fsib:1:1"] [data-famkin]')), await keys('fsib:1:'));
  ok('  Lily, his mother\'s daughter only, is among them', /Lily Dean/.test(await ev(() => $('famKin').textContent)));
  ok('each list says how to move them', await ev(() => { const t = $('famKin').textContent;
    return /Newest at the top, oldest at the bottom\. Hold a name/.test(t) && /Oldest first\. Hold a name/.test(t); }));
  ok('a grip beside each name that moves; none on Father and Mother', await ev(() =>
    $('famKin').querySelectorAll('.fammove .grip').length === 9 && $('famKin').querySelectorAll('.grip').length === 9));
  ok('nothing on the person screen runs off the side of the phone', await ev(() => $('famEdBody').scrollWidth <= $('famEdBody').clientWidth + 1));
  await ev(() => famCancel()); await settle(200);

  console.log('\nThe tree');
  const lay = () => ev(() => { const L = famLayout(famGraph(), 1), W = FAM_BOX.w + FAM_BOX.gx, X = id => (L.nodes.find(n => n.id === id) || {}).x;
    const ds = L.downs.filter(d => d.row === 0);
    return { W, me: X(1), jane: X(30), kate: X(31), amy: X(40), ben: X(41), cal: X(42),
      ds: ds.map(d => ({ from: d.from, xs: d.xs, lane: d.lane, lanes: d.lanes })) }; });
  await ev(() => famSetMid(1)); await settle(300);
  let t = await lay();
  ok('the oldest partner (Jane) sits next to him, Kate further out', t.jane === t.me + t.W && t.kate === t.me + 2 * t.W, JSON.stringify(t));
  ok('Jane\'s children hang from the join between Peter and Jane', t.ds.length === 2 && t.ds[0].from === t.me + t.W / 2
    && t.ds[0].xs.join() === [t.amy, t.cal].join(), JSON.stringify(t.ds));
  ok('  Kate\'s from the join between Jane and Kate', t.ds[1] && t.ds[1].from === t.me + 1.5 * t.W && t.ds[1].xs.join() === [t.ben].join());
  ok('  Jane\'s children to the left of Kate\'s, oldest first', t.amy < t.cal && t.cal < t.ben);
  ok('  and the two lines at different heights, so they don\'t run into each other', await ev(() => {
    const d = document.querySelector('.famlines path').getAttribute('d');
    const hs = [...d.matchAll(/M[\d.]+ ([\d.]+)H/g)].map(m => Number(m[1]));
    return new Set(hs).size >= 3; }));
  ok('one partner and no other children: drawn as before', await ev(() => {
    const L = famLayout(famGraph(), 50); const d = L.downs.filter(x => x.row === 0);
    return d.length === 1 && d[0].lanes === 1; }));

  // ---------------------------------------------------------------
  console.log('\nMoving partners');
  await ev(() => openFamPerson(1)); await settle(400);
  await clear(); await clearToasts();
  await holdSlide(p, '[data-hm="fmate:1:30"]', '[data-hm="fmate:1:31"]', { below: false });
  await settle(400);
  ok('holding Jane and sliding her up puts her at the top', await keys('fmate:1:') === '30,31', await keys('fmate:1:'));
  ok('  saved on Peter as family.order.mates', await saved(1, 'mates') === '30,31', String(await saved(1, 'mates')));
  ok('  keeping the rest of his family details', await ev(() => { const w = window.__writes.filter(x => x.op === 'update' && x.table === 'contacts').pop();
    return w && Object.keys(w.patch).join() === 'family'; }));
  ok('  and says so', /Order saved/.test(await toasts()));
  t = await lay();
  ok('  so in the tree Kate, now at the bottom, sits next to him', t.kate === t.me + t.W && t.jane === t.me + 2 * t.W, JSON.stringify(t));
  ok('  and Jane\'s children still hang from her', t.ds.find(d => d.xs.includes(t.amy)).from === t.me + 1.5 * t.W);
  ok('the tap that ends the move opened nobody', await ev(() => $('famEdTitle').textContent === 'Peter Test'));

  console.log('\nMoving children');
  await clear(); await clearToasts();
  await holdSlide(p, '[data-hm="fkid:1:42"]', '[data-hm="fkid:1:40"]', { below: false });
  await settle(400);
  ok('Cal, with no birth date, held and slid to the top', await keys('fkid:1:') === '42,40,41', await keys('fkid:1:'));
  ok('  saved on Peter', await saved(1, 'kids') === '42,40,41', String(await saved(1, 'kids')));
  ok('  and on Jane, his mother, so her list agrees', await saved(30, 'kids') === '42,40', String(await saved(30, 'kids')));
  ok('  Kate\'s list, with just Ben, the same as it was', [null, '41'].includes(await saved(31, 'kids')));
  t = await lay();
  ok('  in the tree Cal now comes before Amy', t.cal < t.amy);
  await ev(() => openFamPerson(30)); await settle(400);
  ok('  and Jane\'s own screen has them in the same order', await keys('fkid:30:') === '42,40', await keys('fkid:30:'));

  console.log('\nMoving brothers and sisters');
  await ev(() => openFamPerson(1)); await settle(400);
  await clear(); await clearToasts();
  await holdSlide(p, '[data-hm="fsib:1:53"]', '[data-hm="fsib:1:52"]', { below: false });
  await settle(400);
  ok('Sam held and slid to the top', await keys('fsib:1:') === '53,52,1,54', await keys('fsib:1:'));
  ok('  it is their parents\' order that changes: their father\'s', await saved(50, 'kids') === '53,52,1', String(await saved(50, 'kids')));
  ok('  and their mother\'s, with Lily (hers only) kept where she was', await saved(51, 'kids') === '53,52,1,54', String(await saved(51, 'kids')));
  ok('  nothing saved on Peter for it', await saved(1, 'sibs') === null);
  await ev(() => openFamPerson(52)); await settle(400);
  ok('Ruth\'s screen agrees, with her greyed in her place', await keys('fsib:52:') === '53,52,1,54', await keys('fsib:52:'));
  await ev(() => openFamPerson(50)); await settle(400);
  ok('  and so does their father\'s list of children', await keys('fkid:50:') === '53,52,1', await keys('fkid:50:'));

  console.log('\nA quick tap still opens them');
  await ev(() => openFamPerson(1)); await settle(400);
  await p.click('[data-hm="fmate:1:31"] [data-famkin="31"]'); await settle(500);
  ok('tapping Kate\'s name opens Kate', await ev(() => $('famEdTitle').textContent === 'Kate Birch'));
  await ev(() => openFamPerson(1)); await settle(400);
  await p.focus('[data-hm="fkid:1:41"] [data-famkin="41"]'); await p.keyboard.press('Enter'); await settle(500);
  ok('  and Enter on a keyboard opens Ben', await ev(() => $('famEdTitle').textContent === 'Ben Test'));

  console.log('\nWhen it can\'t be saved');
  await ev(() => openFamPerson(1)); await settle(400);
  await ev(() => { window.__realFrom = sb.from; sb.from = t => { const a = window.__realFrom(t);
    if (t === 'contacts') { const u = a.update; a.update = q => { u(q); a.then = (f, r) => Promise.resolve({ data: null, error: { message: 'Server unwell' } }).then(f, r); return a; }; }
    return a; }; });
  await clearToasts();
  // Whatever order is on screen, the top one goes to the bottom.
  const before = await keys('fmate:1:'), [top, bottom] = before.split(',');
  await holdSlide(p, `[data-hm="fmate:1:${top}"]`, `[data-hm="fmate:1:${bottom}"]`, { below: true });
  await settle(300);
  ok('it says so', /Could not save the new order/.test(await toasts()), await toasts());
  ok('  and goes back to what is saved', await ev(() => famOrd(famFindOwn(1), 'mates').length === 0) && await keys('fmate:1:') === '31,30',
    before + ' -> ' + await keys('fmate:1:'));
  await ev(() => { sb.from = window.__realFrom; });
  await ev(() => famCancel()); await settle(200);

  console.log('\nThe order helpers');
  ok('people not in a saved order go in by date, undated ones at the end', await ev(() => {
    const d = { 1: '1950', 2: '1960', 3: '', 4: '1955', 5: '1990' };
    return famInOrder([1, 2, 3, 4, 5], [2, 1], i => d[i]).join() === '4,2,1,5,3'
      && famInOrder([1, 2, 3, 4], [], i => d[i]).join() === '1,4,2,3'
      && famInOrder([1, 2, 3, 4], [], i => d[i], true).join() === '2,4,1,3'
      && famInOrder([1, 2, 3, 4], [3, 1], i => d[i]).join() === '3,1,4,2'
      && famInOrder([1, 2, 3], [3], i => d[i]).join() === '1,2,3'; }));
  ok('two orders made one', await ev(() => famMerge([1, 2, 3], [2, 5, 3]).join() === '1,2,5,3' && famMerge([1, 2], [4, 1]).join() === '4,1,2'));
  ok('a saved order that names someone twice, or as text, is read once as numbers', await ev(() =>
    famOrd({ family: { order: { kids: ['4', 4, 2] } } }, 'kids').join() === '4,2' && famOrd({}, 'kids').length === 0));

  // ---------------------------------------------------------------
  console.log('\nML420: the Wishlist');
  await ev(() => {
    window.__rows.wishes = [
      { id: 11, created_by: 'me', app: 'contacts', status: 'idea', title: 'Diary: bigger dates', notes: 'Make the dates bigger', created_at: '2026-11-01T09:00:00Z' },
      { id: 12, created_by: 'sandra', app: 'contacts', status: 'idea', title: 'Contacts: sort by town', notes: null, created_at: '2026-10-25T09:00:00Z' },
      { id: 13, created_by: 'me', app: 'contacts', status: 'done', title: 'Finances: export',
        notes: 'A long description that goes on and on, to check it is cut to one line on the phone without spilling over the edge of the screen at all',
        created_at: '2026-10-05T09:00:00Z', photos: [{ path: 'wsh/me/x.jpg' }] },
      { id: 14, created_by: 'me', app: 'contacts', status: 'done', title: 'Alarm: snooze', notes: null, created_at: '2026-11-20T09:00:00Z' },
      { id: 15, created_by: 'sandra', app: 'contacts', status: 'no', title: 'Diary: colours', notes: 'Pink', created_at: '2026-10-20T09:00:00Z' },
      { id: 16, created_by: 'me', app: 'contacts', status: 'doing', title: 'Wishlist: search', notes: 'Find ideas', created_at: '2026-11-26T09:00:00Z' }];
    WISH_Q = '';
  });
  const ids = sec => ev(s => { const c = document.querySelector(`#wishLists .wcard.w-${s}`); if (!c) return null;
    return [...c.children].map(r => r.dataset.wopen || (r.querySelector('[data-wset]') || {}).dataset?.wset?.split(':')[0]).join(','); }, sec);
  await ev(() => openWish()); await settle(500);
  ok('Done ideas show one line each, with no buttons', await ev(() =>
    document.querySelectorAll('#wishLists .w-done .wfold').length === 2 && !document.querySelector('#wishLists [data-wset^="13:"]')));
  ok('  Not doing too', await ev(() => document.querySelectorAll('#wishLists .w-no .wfold').length === 1));
  ok('  Idea and Doing stay as they were', await ev(() => !!document.querySelector('#wishLists [data-wset="11:done"]')
    && !!document.querySelector('#wishLists [data-wset="16:done"]') && !document.querySelector('#wishLists .w-idea .wfold')));
  ok('  each line is the Tile/Area, then the start of the description', await ev(() => {
    const r = document.querySelector('[data-wopen="13"]'), o = r.querySelector('.wone');
    return o.textContent.startsWith('Finances: export · A long description') && getComputedStyle(o).whiteSpace === 'nowrap'
      && r.getBoundingClientRect().height < 60 && o.scrollWidth > o.clientWidth; }));
  ok('  and the counts still show', await ev(() => /Done\s*2/.test(document.querySelector('.wsec.w-done').textContent)));
  ok('  a folded idea\'s photos aren\'t fetched', await ev(() => !document.querySelector('#wishLists img[data-wpic]')));
  ok('nothing runs off the side of the phone', await ev(() => $('wishBody').scrollWidth <= $('wishBody').clientWidth + 1));
  await p.click('[data-wopen="13"]'); await settle(300);
  ok('tapping one opens it out: the description, photo and buttons', await ev(() =>
    document.querySelectorAll('#wishLists [data-wset^="13:"]').length === 5 && !!document.querySelector('#wishLists img[data-wpic]')
    && !!document.querySelector('[data-wfold="13"]') && !document.querySelector('[data-wopen="13"]')));
  ok('  the other Done one stays folded', await ev(() => !!document.querySelector('[data-wopen="14"]')));
  await p.click('[data-wfold="13"]'); await settle(300);
  ok('  and its ▾ folds it away again', await ev(() => !!document.querySelector('[data-wopen="13"]') && !document.querySelector('[data-wset^="13:"]')));
  await p.focus('[data-wopen="14"]'); await p.keyboard.press('Enter'); await settle(300);
  ok('  Enter opens one on a keyboard', await ev(() => !!document.querySelector('[data-wfold="14"]')));
  await p.click('[data-wfold="14"]'); await settle(200);

  console.log('\nThe order');
  ok('Tile/Area to begin with, A to Z', await ids('idea') === '12,11' && await ids('done') === '14,13'
    && await ev(() => document.querySelector('[data-wsort="az"]').getAttribute('aria-pressed') === 'true'), await ids('idea') + ' ' + await ids('done'));
  await p.click('[data-wsort="new"]'); await settle(300);
  ok('Newest: the latest put in at the top of each heading', await ids('idea') === '11,12' && await ids('done') === '14,13' && await ids('no') === '15');
  await p.click('[data-wsort="old"]'); await settle(300);
  ok('Oldest: the first put in at the top', await ids('idea') === '12,11' && await ids('done') === '13,14', await ids('idea') + ' ' + await ids('done'));
  ok('  the button shows which, and the phone remembers it', await ev(() =>
    document.querySelector('[data-wsort="old"]').getAttribute('aria-pressed') === 'true'
    && document.querySelector('[data-wsort="new"]').getAttribute('aria-pressed') === 'false' && localStorage.getItem('wish-sort') === 'old'));
  await ev(() => { closeSheets && closeSheets(); }).catch(() => {});
  await ev(() => openWish()); await settle(400);
  ok('  and opens that way next time', await ids('idea') === '12,11' && await ids('done') === '13,14' && await ev(() => document.querySelector('[data-wsort="old"]').getAttribute('aria-pressed') === 'true'));

  console.log('\nSearching');
  await p.fill('#wTitle', 'Half typed');
  await p.fill('#wQ', 'diary'); await settle(300);
  ok('"diary" finds the two Diary ideas, and only them', await ids('idea') === '11' && await ids('no') === '15' && await ids('done') === null
    && await ids('doing') === null);
  ok('  the half-typed new idea is still there, and typing carries on in the search box', await ev(() =>
    $('wTitle').value === 'Half typed' && document.activeElement && document.activeElement.id === 'wQ'));
  await p.fill('#wQ', 'diary bigger'); await settle(300);
  ok('every word has to be in it', await ids('idea') === '11' && await ids('no') === null);
  await p.fill('#wQ', 'export'); await settle(300);
  ok('  the description counts, and a Done one found still shows one line', await ids('done') === '13' && await ev(() => !!document.querySelector('[data-wopen="13"]')));
  await p.fill('#wQ', 'sandra'); await settle(300);
  ok('  and who it\'s from', await ids('idea') === '12' && await ids('no') === '15');
  await p.fill('#wQ', 'zzz'); await settle(300);
  ok('nothing found says so, not an empty Wishlist', await ev(() => /No ideas with “zzz” in them/.test($('wishLists').textContent)));
  await p.fill('#wQ', ''); await settle(300);
  ok('emptied, everything is back', await ev(() => document.querySelectorAll('#wishLists .wcard > *').length === 6));
  await p.fill('#wQ', 'colours'); await settle(300);
  await p.click('[data-wopen="15"]'); await settle(300);
  await ev(() => openWish()); await settle(400);
  ok('opened again: no search left over, and Done and Not doing folded again', await ev(() =>
    $('wQ').value === '' && !!document.querySelector('[data-wopen="15"]') && document.querySelectorAll('#wishLists .wcard > *').length === 6));
  await p.fill('#wTitle', 'Half typed');

  console.log('\nMoving an idea along');
  await ev(() => { window.__realFrom = sb.from; sb.from = t => { const a = window.__realFrom(t);
    if (t === 'wishes') { const u = a.update; a.update = q => { u(q); a.eq = (c, v) => { const w = window.__rows.wishes.find(x => x[c] === v); if (w) Object.assign(w, q); return a; }; return a; }; }
    return a; }; });
  await p.click('[data-wset="16:done"]'); await settle(500);
  ok('Doing to Done: it folds away with the others', await ev(() => !!document.querySelector('.w-done [data-wopen="16"]') && !document.querySelector('.w-doing')));
  ok('  and the half-typed new idea is still there', await ev(() => $('wTitle').value === 'Half typed'));
  await ev(() => { sb.from = window.__realFrom; });

  console.log('\nOn a laptop');
  await p.setViewportSize({ width: 1280, height: 900 }); await settle(300);
  await ev(() => openWish()); await settle(400);
  ok('the one-line ideas and the search card fit, nothing runs off the side', await ev(() =>
    $('wishBody').scrollWidth <= $('wishBody').clientWidth + 1 && document.querySelector('[data-wopen="13"]').getBoundingClientRect().height < 60
    && document.querySelector('.wfind').getBoundingClientRect().width <= $('wishBody').clientWidth));
  await ev(() => { openFam(); }); await settle(500);
  await ev(() => openFamPerson(1)); await settle(400);
  ok('  and the person screen too', await ev(() => $('famEdBody').scrollWidth <= $('famEdBody').clientWidth + 1));
  await ev(() => famCancel());
  await p.setViewportSize({ width: 390, height: 844 });

  console.log('\nThe version');
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.27.1');
  ok('2026.11.27.1 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  three lines for What\'s new, each short enough', V && V.changes.length === 3 && V.changes.every(x => x.length < 160));

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
