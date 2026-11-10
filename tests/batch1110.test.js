// Version 2026.11.10.2, driven through the real page on a phone-sized touch
// screen held upright:
//   ML244 Settings > Finances: every account folded to its name (the size
//         they go while one is moving), opened out with a tap, folded away
//         again with its ▾.
//   ML245 Contacts: two names sharing a line at the top of a contact ("Child
//         of John and Mary Smith") each open their own page.
//   ML246 Today: Tonight's idea picks at random from every main, instead of
//         stepping through the cookbook in the order recipes were added.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|set_person|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const NAMES = ['Barclays Everyday Saver', 'Barclays ISA Issue 1', 'Barclays BBA Ovdrft', 'Revolut GBP', 'Revolut EUR',
  'Premium Bonds', 'Cash', 'ASB Cheque', 'ASB Savings', 'Amex Gold', 'Nationwide FlexDirect', 'Wise USD'];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const clear = () => ev(() => { window.__writes.length = 0; });
  const writes = t => ev(t => window.__writes.filter(w => w.table === t), t);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  const V = VJ.history.find(h => h.version === '2026.11.10.2');
  ok('2026.11.10.2 is in version.json, and the page is the newest', !!V && VJ.version === appVer && VJ.history[0].version === appVer, appVer + ' / ' + VJ.version);
  const said = (V ? V.changes : []).join(' ');
  ok('  saying what changed: accounts, the names at the top of a contact, Tonight’s idea', /accounts/.test(said)
    && /each name opens/.test(said) && /Tonight’s idea/.test(said) && /Mains/.test(said), said);
  ok('  each line short enough for the What’s new list', (V ? V.changes : []).every(c => c.length < 160));

  // ---------------------------------------------------------------
  console.log('\nSettings > Finances: accounts folded to their names (ML244)');
  await ev(names => { window.__rows.accounts = names.map((n, i) => ({ id: i + 1, name: n, group_name: n.split(' ')[0], kind: 'savings',
    currency: 'GBP', opening_balance: 100, opening_date: '2026-08-31', active: true, sort: (i + 1) * 10, created_by: 'me',
    sort_code: i === 0 ? '20-00-00' : null })); }, NAMES);
  const openFin = async (fresh = true) => {
    if (fresh) await ev(() => { $('settings').classList.add('hidden'); lockBackground(); });
    await ev(async () => { await loadMoney(); openSettings('Finances'); }); await settle(500);
    await ev(() => document.querySelectorAll('.card.logsec').forEach(d => d.open = true)); await settle(150); };
  const rows = () => ev(() => [...document.querySelectorAll('[data-hm^="acc:"]')].map(r => ({ id: +r.dataset.arow,
    mini: r.classList.contains('accmini'), h: Math.round(r.getBoundingClientRect().height),
    name: getComputedStyle(r.querySelector('.accname')).display, bank: getComputedStyle(r.querySelector('.accbank')).display,
    ro: r.querySelector('.accname').readOnly })));
  await openFin();
  let rs = await rows();
  ok('the Accounts heading is a folding card, like the others', await ev(() => {
    const d = document.querySelector('[data-setcard="accounts"]'); return d && d.tagName === 'DETAILS' && /Accounts/.test(d.querySelector('summary').textContent); }));
  ok('opened, every account is folded down to its name', rs.length === 12 && rs.every(r => r.mini && r.h < 75), JSON.stringify(rs.map(r => r.h)));
  ok('  the names show, nothing else', rs.every(r => r.name !== 'none' && r.bank === 'none'));
  ok('  and a folded name is not a typing box', rs.every(r => r.ro));
  ok('  with a ▾ on each', await ev(() => [...document.querySelectorAll('[data-hm^="acc:"]')].every(r => {
    const f = r.querySelector('[data-afold]'); return f && getComputedStyle(f).display !== 'none' && f.getAttribute('aria-expanded') === 'false'; })));
  ok('  and words saying how', await ev(() => /tap it to open it\s+out/.test($('setBody').textContent)));

  // The same size as they go while one is being moved.
  const box = id => ev(i => { const r = document.querySelector(`[data-hm="acc:${i}"]`).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height }; }, id);
  const grip = id => ev(i => { const r = document.querySelector(`[data-hm="acc:${i}"] > .grip`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  await ev(() => document.querySelector('[data-hm="acc:4"]').scrollIntoView({ block: 'center' })); await settle(200);
  const miniH = (await box(4)).h;
  let g = await grip(4);
  await touch('touchStart', g.x, g.y); await settle(650);
  const movingH = await ev(() => Math.round(document.querySelector('[data-hm="acc:5"]').getBoundingClientRect().height));
  await touch('touchEnd'); await settle(600);
  ok('folded, they are the size they go while one is moving', Math.abs(miniH - movingH) <= 2, miniH + ' / ' + movingH);
  ok('  and lifting one without moving it opens nothing', (await rows()).every(r => r.mini));

  // A tap opens one out.
  await clear();
  let bx = await box(2);
  await p.touchscreen.tap(bx.x + bx.w / 2, bx.y + bx.h / 2); await settle(300);
  rs = await rows();
  const two = rs.find(r => r.id === 2);
  ok('tapping a name opens that account out', !two.mini && two.h > 250 && two.bank !== 'none', JSON.stringify(two));
  ok('  only that one', rs.filter(r => !r.mini).length === 1);
  ok('  its name can be changed again', !two.ro);
  ok('  and its ▾ turns over', await ev(() => { const f = document.querySelector('[data-afold="2"]');
    return f.getAttribute('aria-expanded') === 'true' && /rotate|matrix/.test(getComputedStyle(f).transform); }));
  ok('  opening it saves nothing', (await writes('accounts')).length === 0);
  await p.fill('[data-afield="2:sort_code"]', '401234');
  await p.$eval('[data-afield="2:sort_code"]', e => e.blur()); await settle(300);
  const sc = (await writes('accounts')).filter(w => w.op === 'update');
  ok('  and what is typed in it is saved, as before', sc.length === 1 && sc[0].patch.sort_code === '40-12-34' && sc[0].where[0][2] === 2, JSON.stringify(sc));

  // A second one can be open at the same time.
  await ev(() => document.querySelector('[data-hm="acc:5"]').scrollIntoView({ block: 'center' })); await settle(150);
  bx = await box(5);
  await p.touchscreen.tap(bx.x + bx.w / 2, bx.y + bx.h / 2); await settle(300);
  ok('a second one opens too, the first staying open', (await rows()).filter(r => !r.mini).map(r => r.id).join() === '2,5');

  // Settings redrawn after a change: the open ones stay open.
  await openFin(false);
  ok('Settings redrawn after a change: those two are still open', (await rows()).filter(r => !r.mini).map(r => r.id).join() === '2,5');

  // The ▾ folds it away again.
  await ev(() => document.querySelector('[data-afold="5"]').scrollIntoView({ block: 'center' })); await settle(150);
  await p.tap('[data-afold="5"]'); await settle(300);
  ok('its ▾ folds it away again', (await rows()).filter(r => !r.mini).map(r => r.id).join() === '2');
  // Tapping inside an open one (a typing box, the group) leaves it open.
  await p.tap('[data-afield="2:group_name"]'); await settle(200);
  ok('tapping a box inside an open account leaves it open', !(await rows()).find(r => r.id === 2).mini);
  await p.$eval('[data-afield="2:group_name"]', e => e.blur()); await settle(200);

  // A tap on the grip is for moving, not opening.
  await ev(() => document.querySelector('[data-hm="acc:7"]').scrollIntoView({ block: 'center' })); await settle(150);
  g = await grip(7);
  await p.touchscreen.tap(g.x, g.y); await settle(300);
  ok('a quick tap on the ⠿ does not open it', (await rows()).find(r => r.id === 7).mini);

  // Opened afresh, they are all folded again.
  await openFin(true);
  ok('closed and opened again, every account is folded', (await rows()).every(r => r.mini));

  // Putting them in order, folded.
  await clear();
  await ev(() => document.querySelector('[data-hm="acc:2"]').scrollIntoView({ block: 'center' })); await settle(200);
  g = await grip(2);
  await touch('touchStart', g.x, g.y); await settle(650);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', g.x, g.y + 300 * i / 10); await p.waitForTimeout(16); }
  await touch('touchEnd'); await settle(700);
  const order = (await writes('accounts')).filter(x => x.op === 'update').map(x => x.where[0][2]);
  ok('held and slid down past several, the new order is saved', order.length === 12 && order.indexOf(2) >= 4, order.join());
  ok('  and letting go opens nothing', (await rows()).every(r => r.mini));

  // A new account opens out, ready for its details.
  await ev(() => { const real = sb.from.bind(sb); window.__realFrom = sb.from;
    sb.from = t => { const q = real(t); if (t !== 'accounts') return q; const ins = q.insert;
      q.insert = r => { window.__rows.accounts.push(Object.assign({ id: 99, kind: 'current', opening_balance: 0, active: true, sort: 999 }, r)); return ins(r); };
      return q; }; });
  await p.fill('[data-anew="name"]', 'Monzo'); await p.click('[data-aadd]'); await settle(600);
  await ev(() => { sb.from = window.__realFrom; });
  rs = await rows();
  ok('a new account is added already opened out', rs.some(r => r.id === 99 && !r.mini) && rs.filter(r => !r.mini).length === 1, JSON.stringify(rs.filter(r => !r.mini)));

  // The name line fits, at phone and laptop width.
  for (const w of [320, 390, 1200]) {
    await p.setViewportSize({ width: w, height: 844 }); await settle(250);
    const fit = await ev(() => { const r = document.querySelector('[data-hm="acc:1"]'), rb = r.getBoundingClientRect();
      const n = r.querySelector('.accname').getBoundingClientRect(), f = r.querySelector('.accfold').getBoundingClientRect();
      return { nameW: Math.round(n.width), inside: f.right <= rb.right + 1 && n.left >= rb.left, sameLine: Math.abs((f.top + f.height / 2) - (n.top + n.height / 2)) < 8 }; });
    ok(`  ${w}px wide: the name has room, the ▾ beside it inside the box`, fit.nameW >= 150 && fit.inside && fit.sameLine, JSON.stringify(fit));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);
  await ev(() => openHelp('money')); await settle(300);
  ok('Help says the accounts show just their names', await ev(() => /show just their names/.test(document.getElementById('h-money').parentElement.textContent)));
  await ev(() => { $('help').classList.add('hidden'); $('settings').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nContacts: each name in a joined line opens its own page (ML245)');
  await ev(async () => {
    window.__rows.contacts.push(
      { id: 101, created_by: 'me', first_name: 'Tom', last_name: 'Smith', contact_groups: [] },
      { id: 102, created_by: 'me', first_name: 'John', last_name: 'Smith', contact_groups: [] },
      { id: 103, created_by: 'me', first_name: 'Mary', last_name: 'Smith', contact_groups: [] },
      { id: 104, created_by: 'me', first_name: 'Ann', last_name: 'Jones', contact_groups: [] },
      { id: 105, created_by: 'me', first_name: 'Bob', last_name: 'Smith', contact_groups: [] });
    window.__rows.link_kinds = [{ id: 1, name: 'Child of', inverse_name: 'Parent of' }, { id: 2, name: 'Friend of', inverse_name: 'Friend of' },
      { id: 3, name: 'Sibling of', inverse_name: 'Sibling of' }];
    window.__rows.relationships = [
      { id: 1, from_contact: 101, to_contact: 102, kind: 'Child of', pinned: true },
      { id: 2, from_contact: 101, to_contact: 103, kind: 'Child of', pinned: true },
      { id: 3, from_contact: 101, to_contact: 104, kind: 'Friend of', pinned: true },
      { id: 4, from_contact: 105, to_contact: 102, kind: 'Sibling of', pinned: true },
      { id: 5, from_contact: 105, to_contact: 104, kind: 'Sibling of', pinned: true },
      { id: 6, from_contact: 105, to_contact: 999, kind: 'Friend of', pinned: true },
      { id: 7, from_contact: 105, to_contact: 101, kind: 'Friend of', pinned: true }];
    await loadAll();
  });
  const pins = () => ev(() => [...document.querySelectorAll('#detBody .pin')].map(x => ({ text: x.textContent.replace(/\s+/g, ' ').trim(),
    go: [...x.querySelectorAll('[data-go]')].map(bt => bt.textContent.trim() + '>' + bt.dataset.go) })));
  await ev(() => openDetail(101)); await settle(400);
  let pn = await pins();
  const child = pn.find(x => /^Child of/.test(x.text));
  ok('the two parents still read as one line: Child of John and Mary Smith', child && child.text === 'Child of John and Mary Smith', JSON.stringify(pn));
  ok('  John and Mary are each a button of their own', child && child.go.join('|') === 'John>102|Mary Smith>103', JSON.stringify(child));
  ok('  "and" is plain words between them', await ev(() => { const a = document.querySelector('#detBody .pin .pand');
    return a && a.textContent === ' and ' && a.tagName === 'SPAN' && getComputedStyle(a).fontWeight < 700; }));
  ok('two friends with different surnames: both in full, each a button', JSON.stringify(pn.find(x => /^Friend of/.test(x.text)).go)
    === '["Ann Jones>104","Bob Smith>105"]', JSON.stringify(pn));
  const gav = await ev(() => { const r = document.querySelector('[data-go="102"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.touchscreen.tap(gav.x, gav.y); await settle(400);
  ok('tapping John opens John', await ev(() => CURRENT && CURRENT.id === 102 && /John Smith/.test($('detTitle').textContent)));
  pn = await pins();
  ok('on his page, a single name still opens its person', JSON.stringify(pn.find(x => /^Parent of/.test(x.text))) === '{"text":"Parent of Tom Smith","go":["Tom Smith>101"]}', JSON.stringify(pn));
  await ev(() => openDetail(101)); await settle(400);
  const hel = await ev(() => { const r = document.querySelector('.pin [data-go="103"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.touchscreen.tap(hel.x, hel.y); await settle(400);
  ok('tapping Mary opens Mary', await ev(() => CURRENT && CURRENT.id === 103 && /Mary Smith/.test($('detTitle').textContent)));

  await ev(() => openDetail(105)); await settle(400);
  pn = await pins();
  const sib = pn.find(x => /^Sibling of/.test(x.text));
  ok('different surnames: both names in full, each its own button', sib && sib.text === 'Sibling of John Smith and Ann Jones'
    && sib.go.join('|') === 'John Smith>102|Ann Jones>104', JSON.stringify(sib));
  const fr = pn.find(x => /^Friend of/.test(x.text));
  ok('someone you cannot see stays as words, the other still a button', fr && /\(hidden\)/.test(fr.text) && fr.go.join('|') === 'Tom Smith>101', JSON.stringify(fr));
  ok('the same words as before for three or more', await ev(() => joinNamesHtml([{ name: 'A Smith', id: 102 }, { name: 'B Smith', id: 103 }, { name: 'C Smith', id: 104 }])
    .replace(/<[^>]+>/g, '') === joinNames(['A Smith', 'B Smith', 'C Smith'])));
  ok('  and for two with different surnames', await ev(() => joinNamesHtml([{ name: 'A Smith', id: 102 }, { name: 'B Jones', id: 103 }])
    .replace(/<[^>]+>/g, '') === joinNames(['A Smith', 'B Jones'])));
  ok('  names are made safe to show', await ev(() => !/<b>/.test(joinNamesHtml([{ name: '<b>x</b> Y', id: 102 }]))));
  await ev(() => { $('detail').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nToday: Tonight’s idea from every main (ML246)');
  const realDay = await ev(() => briefDay());
  await ev(async () => {
    const R = [];
    for (let i = 1; i <= 30; i++) R.push({ id: 500 + i, created_by: 'me', title: 'Main ' + i, categories: ['Mains'], ingredients: [], cook_steps: [], photos: [] });
    for (let i = 1; i <= 10; i++) R.push({ id: 600 + i, created_by: 'me', title: 'Pudding ' + i, categories: ['Puddings'], ingredients: [], cook_steps: [], photos: [] });
    for (let i = 1; i <= 5; i++) R.push({ id: 700 + i, created_by: 'me', title: 'Soup ' + i, categories: ['Soups', 'Mains'], ingredients: [], cook_steps: [], photos: [] });
    R.push({ id: 801, created_by: 'me', title: 'Waiting', categories: ['Mains'], to_try: true, ingredients: [], cook_steps: [], photos: [] });
    window.__rows.recipes = R;
    await loadRecipes(); RCP_PREFS.hide = []; RCP_PREFS.cooked = {}; RCP_PREFS.today = true;
    window.__briefDay = briefDay;
  });
  const days = n => { const out = []; for (let i = 0; i < n; i++) { const d = new Date(2026, 10, 1 + i); out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); } return out; };
  const picks = await ev(ds => ds.map(d => { briefDay = () => d; RCP_SPIN = { day: '', n: 0 }; const r = rcpTodayPick(); return r && r.id; }), days(60));
  const mains = id => (id > 500 && id <= 530) || (id > 700 && id <= 705);
  ok('60 days running: every idea is a main', picks.every(mains), picks.join());
  ok('  never one waiting in To try', !picks.includes(801));
  ok('  and they come from all over the mains, not a few', new Set(picks).size >= 24, new Set(picks).size + ' different');
  const steps = picks.slice(1).filter((id, i) => Math.abs(id - picks[i]) === 1).length;
  ok('  not stepping one recipe along each day, as it did', steps <= 8, steps + ' of 59 days were the next one along');
  ok('  a recipe with Mains among other categories counts', picks.some(id => id > 700));
  // The same all day, and ↻ goes round them all.
  const oneDay = await ev(() => { briefDay = () => '2026-11-20'; RCP_SPIN = { day: '', n: 0 };
    const a = rcpTodayPick().id, again = rcpTodayPick().id, seen = [];
    for (let i = 0; i < 35; i++) { seen.push(rcpTodayPick().id); RCP_SPIN.n++; }
    return { a, again, seen }; });
  ok('the same one all day', oneDay.a === oneDay.again);
  ok('  ↻ goes through every main before one comes round again', new Set(oneDay.seen).size === 35 && oneDay.seen.every(mains), new Set(oneDay.seen).size);
  // Cooked lately: they sit out.
  const cooked = await ev(() => { const today = isoDay(new Date()), long = '2026-01-01';
    RCP_PREFS.cooked = {}; for (let i = 1; i <= 30; i++) RCP_PREFS.cooked[500 + i] = { n: 1, last: i <= 28 ? today : long };
    for (let i = 1; i <= 5; i++) RCP_PREFS.cooked[700 + i] = { n: 1, last: today };
    const ids = new Set(); for (let d = 1; d <= 28; d++) { briefDay = () => '2026-12-' + String(d).padStart(2, '0'); RCP_SPIN = { day: '', n: 0 }; ids.add(rcpTodayPick().id); }
    return [...ids]; });
  ok('mains cooked in the last fortnight sit out', cooked.length && cooked.every(id => id === 529 || id === 530), cooked.join());
  const allCooked = await ev(() => { const today = isoDay(new Date()); RCP_PREFS.cooked = {};
    RECIPES.forEach(r => { RCP_PREFS.cooked[r.id] = { n: 1, last: today }; });
    briefDay = () => '2026-12-01'; RCP_SPIN = { day: '', n: 0 }; const r = rcpTodayPick(); RCP_PREFS.cooked = {}; return r && r.id; });
  ok('  but with every main cooked lately, it still suggests a main', mains(allCooked), allCooked);
  // No Mains at all: the whole cookbook, as before.
  const noMains = await ev(async () => { window.__rows.recipes.forEach(r => { r.categories = r.categories.filter(c => c !== 'Mains'); });
    await loadRecipes(); const ids = new Set();
    for (let d = 1; d <= 40; d++) { briefDay = () => '2027-01-' + String(d % 28 + 1).padStart(2, '0') + ''; RCP_SPIN = { day: '', n: d }; ids.add(rcpTodayPick().id); }
    return [...ids]; });
  ok('with nothing in Mains, it picks from the whole cookbook', noMains.some(id => id > 600 && id < 700) && noMains.some(id => id < 600), noMains.join());
  const mainCourse = await ev(async () => { window.__rows.recipes[0].categories = ['Main course']; window.__rows.recipes[1].categories = ['main']; await loadRecipes();
    const ids = new Set(); for (let d = 1; d <= 20; d++) { briefDay = () => '2027-02-' + String(d).padStart(2, '0'); RCP_SPIN = { day: '', n: 0 }; ids.add(rcpTodayPick().id); }
    return [...ids]; });
  ok('  a category called Main course or main counts as Mains too', mainCourse.length && mainCourse.every(id => id === 501 || id === 502), mainCourse.join());
  // ↻ on Today, and only when there is another to show.
  await ev(async () => { briefDay = window.__briefDay; RCP_SPIN = { day: '', n: 0 }; openBrief(); }); await settle(500);
  const first = await ev(() => { const b = document.querySelector('#briefRecipe [data-ropen]'); return b && +b.dataset.ropen; });
  ok('Today shows it', (first === 501 || first === 502) && /Tonight.s idea/.test(await p.textContent('#briefBody')), first);
  await p.click('[data-briefspin]'); await settle(200);
  const second = await ev(() => +document.querySelector('#briefRecipe [data-ropen]').dataset.ropen);
  ok('  ↻ shows the other main', (second === 501 || second === 502) && second !== first, first + ' / ' + second);
  await ev(async () => { window.__rows.recipes[1].categories = ['Puddings']; await loadRecipes(); paintBriefRecipe(); }); await settle(200);
  ok('  with only one main, no ↻', !(await p.$('[data-briefspin]')) && await ev(() => +document.querySelector('#briefRecipe [data-ropen]').dataset.ropen) === 501);
  ok('Settings and Help say it picks from Mains', await ev(async () => { await openSettings('Home screen');
    const s = $('setBody').textContent; $('settings').classList.add('hidden'); openHelp('recipes');
    const h = document.getElementById('h-recipes'); const t = h ? h.parentElement.textContent : '';
    $('help').classList.add('hidden'); lockBackground();
    return /at random from everything in Mains/.test(s) && /at random from everything in Mains/.test(t); }));
  ok('the real day is back afterwards', await ev(d => briefDay() === d, realDay));
  await ev(() => { shutBrief(); });

  // ---------------------------------------------------------------
  console.log('\nNothing went wrong on the page');
  ok('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASHED: ' + e.stack); process.exit(1); });
