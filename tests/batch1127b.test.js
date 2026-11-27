// 27 Nov 2026 (version 2026.11.27.2), Barry's three requests that afternoon:
//   ML423  Wishlist: the whole of Done and Not doing folds away by tapping its
//          heading, like the lists in Settings and Finances. Both start
//          folded, the phone remembers each, and a search opens them.
//   ML424  Family Tree: the current partner (the top of the Partners list)
//          on the person's right, the earlier ones on their left with the
//          oldest furthest out, each child still under the right partner.
//   ML425  LBC added to Open with, with Global Player, where LBC's podcasts
//          are (com.thisisglobal.player.lbc and com.global.player).
// Run as an Android phone, as Barry's is, so the apps are asked for by name.
// Everyone here is made up.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|open_with|^\[object Object\]$/i;
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ANDROID });
  const p = await ctx.newPage();
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
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });
  ok('running as an Android phone', await ev(() => ON_ANDROID && ON_PHONE));

  // ---------------------------------------------------------------
  console.log('\nML423: Done and Not doing fold away by their headings');
  await ev(() => {
    window.__rows.wishes = [
      { id: 11, created_by: 'me', app: 'contacts', status: 'idea', title: 'Diary: bigger dates', notes: 'Make the dates bigger', created_at: '2026-11-01T09:00:00Z' },
      { id: 13, created_by: 'me', app: 'contacts', status: 'done', title: 'Finances: export', notes: 'Export the cashbook', created_at: '2026-10-05T09:00:00Z' },
      { id: 14, created_by: 'me', app: 'contacts', status: 'done', title: 'Alarm: snooze', notes: null, created_at: '2026-11-20T09:00:00Z' },
      { id: 15, created_by: 'sandra', app: 'contacts', status: 'no', title: 'Diary: colours', notes: 'Pink', created_at: '2026-10-20T09:00:00Z' },
      { id: 16, created_by: 'me', app: 'contacts', status: 'doing', title: 'Wishlist: search', notes: 'Find ideas', created_at: '2026-11-26T09:00:00Z' }];
  });
  const sec = k => ev(k => { const h = document.querySelector(`#wishLists .wsec.w-${k}`);
    return h ? { btn: h.tagName === 'BUTTON', open: h.getAttribute('aria-expanded'), text: h.textContent.replace(/\s+/g, ' ').trim(),
      card: !!document.querySelector(`#wishLists .wcard.w-${k}`), rows: document.querySelectorAll(`#wishLists .wcard.w-${k} > *`).length } : null; }, k);
  const shutSaved = () => ev(() => { try { return JSON.parse(localStorage.getItem('wish-shut')); } catch (e) { return 'bad'; } });
  ok('nothing remembered yet, so both start folded away', await ev(() => localStorage.getItem('wish-shut') === null
    && WISH_SHUT.has('done') && WISH_SHUT.has('no') && WISH_SHUT.size === 2));
  await ev(() => openWish()); await settle(500);
  let d = await sec('done'), n = await sec('no');
  ok('Done is just its heading, with its count and nothing under it', d && d.btn && d.open === 'false' && !d.card && /^Done 2$/.test(d.text), JSON.stringify(d));
  ok('  Not doing too', n && n.btn && n.open === 'false' && !n.card && /^Not doing 1$/.test(n.text), JSON.stringify(n));
  ok('Idea and Doing are as they were: a plain heading and their ideas', await ev(() =>
    document.querySelector('#wishLists .wsec.w-idea').tagName === 'P' && !!document.querySelector('#wishLists .wcard.w-idea [data-wset="11:done"]')
    && document.querySelector('#wishLists .wsec.w-doing').tagName === 'P' && !!document.querySelector('#wishLists [data-wset="16:done"]')));
  ok('the heading looks like the others: same size, capitals and width, with a ▸', await ev(() => {
    const a = document.querySelector('#wishLists .wsec.w-done'), i = document.querySelector('#wishLists .wsec.w-idea');
    const s = getComputedStyle(a), t = getComputedStyle(i), arrow = getComputedStyle(a, '::before').content;
    return s.fontSize === t.fontSize && s.fontWeight === t.fontWeight && s.textTransform === 'uppercase' && s.fontFamily === t.fontFamily
      && s.letterSpacing === t.letterSpacing && Math.abs(a.getBoundingClientRect().width - i.getBoundingClientRect().width) < 1
      && s.textAlign === 'left' && /▸/.test(arrow) && s.backgroundColor === 'rgba(0, 0, 0, 0)'; }));
  ok('  and keeps its Done colour', await ev(() => getComputedStyle(document.querySelector('.wsec.w-done')).color
    === getComputedStyle(document.querySelector('.wsec.w-done')).borderLeftColor));
  await p.click('#wishLists .wsec.w-done'); await settle(300);
  d = await sec('done'); n = await sec('no');
  ok('tapping Done opens it: its ideas, one line each', d.open === 'true' && d.card && d.rows === 2
    && await ev(() => document.querySelectorAll('#wishLists .wcard.w-done .wfold').length === 2), JSON.stringify(d));
  ok('  the ▸ turns to point down', await ev(() => getComputedStyle(document.querySelector('.wsec.w-done'), '::before').transform !== 'none'));
  ok('  Not doing stays folded', n.open === 'false' && !n.card);
  ok('  and the phone remembers it', JSON.stringify(await shutSaved()) === '["no"]', JSON.stringify(await shutSaved()));
  await p.click('[data-wopen="13"]'); await settle(300);
  ok('an idea inside still opens out as before', await ev(() => document.querySelectorAll('#wishLists [data-wset^="13:"]').length === 5));
  await ev(() => openWish()); await settle(400);
  d = await sec('done'); n = await sec('no');
  ok('opened again, Done is still open and Not doing still folded', d.open === 'true' && d.card && n.open === 'false' && !n.card);
  ok('  with its ideas folded to one line again', await ev(() => !!document.querySelector('[data-wopen="13"]')));
  await p.click('#wishLists .wsec.w-done'); await settle(300);
  d = await sec('done');
  ok('tapping Done again folds it away', d.open === 'false' && !d.card
    && JSON.stringify((await shutSaved() || []).sort()) === '["done","no"]', JSON.stringify(await shutSaved()));
  await p.focus('#wishLists .wsec.w-no'); await p.keyboard.press('Enter'); await settle(300);
  n = await sec('no');
  ok('Enter opens one on a keyboard', n.open === 'true' && n.card && n.rows === 1);
  await p.focus('#wishLists .wsec.w-no'); await p.keyboard.press('Enter'); await settle(300);

  console.log('\nSearching');
  await p.fill('#wQ', 'export'); await settle(300);
  d = await sec('done');
  ok('a search opens Done to show what it found, with a plain heading', d && !d.btn && d.card && d.rows === 1
    && await ev(() => !!document.querySelector('[data-wopen="13"]')), JSON.stringify(d));
  await p.fill('#wQ', 'colours'); await settle(300);
  n = await sec('no');
  ok('  and Not doing', n && !n.btn && n.card && n.rows === 1 && !(await sec('done')));
  await p.fill('#wQ', ''); await settle(300);
  d = await sec('done'); n = await sec('no');
  ok('emptied, they fold away again as they were', d.btn && !d.card && n.btn && !n.card
    && JSON.stringify((await shutSaved() || []).sort()) === '["done","no"]');

  console.log('\nMoving an idea along');
  await ev(() => { window.__realFrom = sb.from; sb.from = t => { const a = window.__realFrom(t);
    if (t === 'wishes') { const u = a.update; a.update = q => { u(q); a.eq = (c, v) => { const w = window.__rows.wishes.find(x => x[c] === v); if (w) Object.assign(w, q); return a; }; return a; }; }
    return a; }; });
  await p.click('[data-wset="16:done"]'); await settle(500);
  d = await sec('done');
  ok('Doing to Done goes in with the others, folded away, and the count goes up', d.btn && !d.card && /^Done 3$/.test(d.text)
    && !(await sec('doing')), JSON.stringify(d));
  await ev(() => { sb.from = window.__realFrom; });

  console.log('\nOn small and large phones');
  for (const w of [320, 412]) {
    await p.setViewportSize({ width: w, height: 800 }); await settle(200);
    ok(`at ${w} wide nothing runs off the side, and the headings are one line`, await ev(() =>
      $('wishBody').scrollWidth <= $('wishBody').clientWidth + 1
      && [...document.querySelectorAll('#wishLists .wshut')].every(h => h.getBoundingClientRect().height < 50)));
  }
  await p.setViewportSize({ width: 390, height: 844 });
  ok('the help says so', await ev(() => /Tap the Done or Not doing heading to fold the whole list away/
    .test(document.body.innerHTML.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '))));
  await ev(() => { closeSheets && closeSheets(); }).catch(() => {});

  // ---------------------------------------------------------------
  console.log('\nML424: partners either side of the person');
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
      c(1, 'Peter', 'Test', { tree_only: false, sex: 'M', birth_date: '1945-06-01' }),
      c(29, 'Ann', 'Ash', { sex: 'F' }), c(30, 'Jane', 'Bell', { sex: 'F' }), c(31, 'Kate', 'Birch', { sex: 'F' }),
      c(40, 'Amy', 'Test', { sex: 'F', birth_date: '1972-03-03' }),
      c(41, 'Ben', 'Test', { sex: 'M', birth_date: '1982-04-04' }),
      c(42, 'Cal', 'Test', { sex: 'M', birth_date: '1997-05-05' }),
      c(43, 'Dot', 'Test', { sex: 'F', birth_date: '1975-06-06' }),
      c(60, 'Zed', 'Cole', { sex: 'M' }), c(61, 'Yan', 'Dale', { sex: 'M' }),
      c(50, 'George', 'Test', { sex: 'M', birth_date: '1915-01-01' }),
      c(51, 'Mary', 'Test', { sex: 'F', birth_date: '1918-01-01' })];
    let n = 300;
    const l = (a, z, kind, fam) => ({ id: n++, from_contact: a, to_contact: z, kind, tree_only: a !== 1 && z !== 1, family: fam || {} });
    window.__rows.relationships = [
      l(1, 30, 'Married to', { married: { d: '1980', p: 'year' } }), l(1, 31, 'Married to', { married: { d: '1995', p: 'year' } }),
      l(1, 29, 'Married to', { married: { d: '1970', p: 'year' } }),
      l(1, 40, 'Parent of'), l(29, 40, 'Parent of'), l(1, 41, 'Parent of'), l(30, 41, 'Parent of'),
      l(1, 42, 'Parent of'), l(31, 42, 'Parent of'), l(1, 43, 'Parent of'),
      l(40, 60, 'Married to', { married: { d: '1995', p: 'year' } }), l(40, 61, 'Partner of', { married: { d: '2005', p: 'year' } }),
      l(50, 1, 'Parent of'), l(51, 1, 'Parent of'), l(50, 51, 'Married to')];
    window.__rows.profiles.find(x => x.id === 'me').my_contact_id = 1;
    try { localStorage.removeItem('fam-mid'); } catch (e) {}
    FAM_ONLY = null; FAM_MID = null; await loadAll();
  });
  await ev(() => openFam()); await settle(700);
  await ev(() => famSetMid(1)); await settle(300);
  const lay = mid => ev(mid => { const L = famLayout(famGraph(), mid), W = FAM_BOX.w + FAM_BOX.gx, X = id => (L.nodes.find(n => n.id === id) || {}).x;
    return { W, X: Object.fromEntries(L.nodes.map(n => [n.id, n.x])), left: L.nodes.filter(n => n.left).map(n => n.id),
      rows: L.nodes.reduce((o, n) => ((o[n.row] = o[n.row] || []).push(n.x), o), {}),
      ds: L.downs.filter(d => d.row === 0).map(d => ({ from: d.from, xs: d.xs, lane: d.lane, lanes: d.lanes })) }; }, mid);
  let t = await lay(1);
  const me = t.X[1], W = t.W;
  ok('his Partners list is newest at the top, as before', await ev(() => famGraph().mates(1).join()) === '31,30,29');
  ok('Kate, the current one, on his right', t.X[31] === me + W, JSON.stringify(t.X));
  ok('  Jane, the one before, on his left, and Ann, the oldest, furthest out', t.X[30] === me - W && t.X[29] === me - 2 * W);
  ok('  so the row reads Ann, Jane, Peter, Kate', [29, 30, 1, 31].map(i => t.X[i]).every((x, i, a) => !i || x > a[i - 1]));
  ok('  only the earlier ones, his and Zed (Amy\'s), are marked as on the left', t.left.sort().join() === '29,30,60', t.left.join());
  const from = x => t.ds.find(d => d.xs.includes(x));
  ok('Ann\'s children hang from the join between Ann and Jane', from(t.X[40]).from === me - 1.5 * W, JSON.stringify(t.ds));
  ok('  Jane\'s from the join between Jane and Peter', from(t.X[41]).from === me - W / 2);
  ok('  Kate\'s from the join between Peter and Kate', from(t.X[42]).from === me + W / 2);
  ok('  Dot, whose mother isn\'t in the tree, under the oldest', from(t.X[43]) === from(t.X[40]));
  ok('children left to right by partner: Ann\'s (Amy, Dot), then Jane\'s (Ben), then Kate\'s (Cal)',
    t.X[40] < t.X[43] && t.X[43] < t.X[41] && t.X[41] < t.X[42], JSON.stringify(t.X));
  ok('Kate\'s line lowest, then Jane\'s, then Ann\'s, so they stop short of each other',
    from(t.X[42]).lane === 0 && from(t.X[41]).lane === 1 && from(t.X[40]).lane === 2 && t.ds.every(d => d.lanes === 3));
  ok('Amy\'s own partners the same way: Yan, the current one, right of her; Zed left', t.X[61] === t.X[40] + W && t.X[60] === t.X[40] - W);
  ok('nobody overlaps anyone else in any row', Object.values(t.rows).every(xs => xs.slice().sort((a, b) => a - b)
    .every((x, i, a) => !i || x - a[i - 1] >= W - 0.001)), JSON.stringify(t.rows));
  ok('his parents are still over him', await ev(() => { const L = famLayout(famGraph(), 1), X = id => L.nodes.find(n => n.id === id).x;
    return (X(50) + X(51)) / 2 === X(1); }));
  // The drawn tree: the short line joining partners sits in the gap between them.
  const joins = await ev(() => {
    const d = document.querySelector('.famlines path').getAttribute('d'), B = FAM_BOX;
    const segs = [...d.matchAll(/M([-\d.]+) ([-\d.]+)H([-\d.]+)/g)].map(m => m.slice(1).map(Number));
    const box = id => { const e = document.querySelector(`[data-famnode="${id}"]`); return { l: parseFloat(e.style.left), t: parseFloat(e.style.top) }; };
    const has = (a, c, y) => segs.some(s => Math.abs(s[0] - a) < 0.01 && Math.abs(s[2] - c) < 0.01 && Math.abs(s[1] - y) < 0.01);
    const ann = box(29), jane = box(30), pe = box(1), kate = box(31), y = pe.t + B.h / 2;
    return { annJane: has(ann.l + B.w, jane.l, y), janePeter: has(jane.l + B.w, pe.l, y), peterKate: has(pe.l + B.w, kate.l, y),
      annOut: has(ann.l - B.gx, ann.l, y), kateOut: has(kate.l + B.w, kate.l + B.w + B.gx, y), gap: jane.l - (ann.l + B.w) };
  });
  ok('in the drawn tree each pair is joined across the gap between them', joins.annJane && joins.janePeter && joins.peterKate && joins.gap === 14, JSON.stringify(joins));
  ok('  and no line sticks out past Ann or Kate', !joins.annOut && !joins.kateOut, JSON.stringify(joins));
  ok('the whole tree fits its canvas', await ev(() => [...document.querySelectorAll('#famCanvas .fambox')].every(e =>
    parseFloat(e.style.left) >= 0 && parseFloat(e.style.left) + FAM_BOX.w <= parseFloat($('famCanvas').style.width))));
  t = await lay(50);
  ok('one partner only: on the right, as before', t.X[51] === t.X[50] + t.W && t.ds.length === 1 && t.ds[0].from === t.X[50] + t.W / 2);
  // Moving Ann to the top of his Partners list makes her the current one.
  await ev(async () => { const c = famFindOwn(1); c.family = { ...(c.family || {}), order: { mates: [29, 31, 30] } }; });
  t = await lay(1);
  ok('put at the top of his list, Ann moves to his right; Jane then Kate on his left, oldest (Jane) furthest out',
    t.X[29] === t.X[1] + t.W && t.X[31] === t.X[1] - t.W && t.X[30] === t.X[1] - 2 * t.W, JSON.stringify(t.X));
  ok('  and her children follow her', t.ds.find(d => d.xs.includes(t.X[40])).from === t.X[1] + t.W / 2
    && t.X[40] > t.X[41] && t.X[40] > t.X[42]);
  ok('the help says where they go', await ev(() => /current partner, the top one, sits on their right and the earlier ones on their left, the oldest furthest out/
    .test(document.body.innerHTML.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '))));

  // ---------------------------------------------------------------
  console.log('\nML425: LBC and Global Player');
  const g = await ev(() => ({ gp: linkAppFor('https://www.globalplayer.com/podcast/42KqCF/'), gp2: linkAppFor('https://globalplayer.com/podcast/42KqCF'),
    lbc: linkAppFor('https://www.lbc.co.uk/radio/presenters/james-obrien/'), bbc: linkAppFor('https://www.bbc.co.uk/sounds/brand/p02nrsln'),
    fake: linkAppFor('https://notlbc.co.uk/'), fake2: linkAppFor('https://lbc.co.uk.example.com/'), fake3: linkAppFor('https://myglobalplayer.com/') }));
  ok('a Global Player page goes to Global Player', g.gp === 'globalplayer' && g.gp2 === 'globalplayer', JSON.stringify(g));
  ok('  an LBC page to the LBC app', g.lbc === 'lbc');
  ok('  BBC Sounds is still BBC Sounds', g.bbc === 'sounds');
  ok('  and look-alike sites are neither', g.fake === '' && g.fake2 === '' && g.fake3 === '');
  ok('the apps\' names on the Play Store', await ev(() => linkApp('lbc').pkg === 'com.thisisglobal.player.lbc' && linkApp('globalplayer').pkg === 'com.global.player'
    && linkApp('lbc').label === 'LBC' && linkApp('globalplayer').label === 'Global Player'));
  ok('on the phone a podcast set to Global Player asks for the app, falling back to the page', await ev(() =>
    linkHref({ url: 'https://www.globalplayer.com/podcast/42KqCF/', open_with: 'globalplayer' })
    === 'intent://www.globalplayer.com/podcast/42KqCF/#Intent;scheme=https;package=com.global.player;'
      + 'S.browser_fallback_url=https%3A%2F%2Fwww.globalplayer.com%2Fpodcast%2F42KqCF%2F;end'));
  ok('  and one set to LBC the LBC app', await ev(() => /package=com\.thisisglobal\.player\.lbc;/.test(
    linkHref({ url: 'https://www.lbc.co.uk/radio/', open_with: 'lbc' }))));
  ok('the page\'s name is tidied: "… - Podcast | Global Player" goes', await ev(() =>
    tuneTidy('Full Disclosure with James O\'Brien - Podcast | Global Player') === 'Full Disclosure with James O\'Brien'
    && tuneTidy('The News Agents | Global Player') === 'The News Agents' && tuneTidy('Call Clive - LBC') === 'Call Clive'
    && tuneTidy('LBC Election Hour') === 'LBC Election Hour'));
  ok('  and "LBC" or "Global Player" alone isn\'t taken as the podcast\'s name', await ev(() =>
    tuneBare({ title: 'Global Player', url: 'https://www.globalplayer.com/podcast/x/' }) && tuneBare({ title: 'LBC', url: 'https://www.lbc.co.uk/' })
    && !tuneBare({ title: 'LBC Election Hour', url: 'https://www.lbc.co.uk/' })));

  console.log('\nAdding one');
  const pressed = () => ev(() => [...document.querySelectorAll('[data-leapp][aria-pressed="true"]')].map(b => b.dataset.leapp).join());
  await ev(() => editLink(null, { url: 'https://www.globalplayer.com/podcast/42KqCF/' }, 'pods')); await settle(400);
  ok('Open with lists LBC and Global Player after the music apps', await ev(() => [...document.querySelectorAll('[data-leapp]')].map(b => b.textContent).slice(-4).join('|'))
    === 'YouTube Music|Amazon Music|LBC|Global Player');
  ok('a Global Player podcast starts on Global Player', await pressed() === 'globalplayer', await pressed());
  await p.fill('#leUrl', 'https://www.lbc.co.uk/radio/'); await settle(100);
  ok('  an LBC page on LBC', await pressed() === 'lbc', await pressed());
  ok('  and the box fits the phone', await ev(() => { const r = $('leApps').getBoundingClientRect(); return r.right <= innerWidth + 1; }));
  await ev(() => { closeSheets && closeSheets(); }).catch(() => {});

  console.log('\nIn MY Podcasts');
  await ev(() => {
    window.__rows.url_links = [{ id: 501, created_by: 'me', url: 'https://www.globalplayer.com/podcast/42KqCF/', title: 'Full Disclosure',
      description: null, level: 'everyday', subjects: ['Podcasts'], share_all: false, opens: 0, last_opened: null,
      created_at: '2026-11-27T10:00:00Z', open_with: 'globalplayer' }];
    window.__rows.url_link_shares = [];
  });
  await ev(() => openTunes('pods')); await settle(700);
  ok('its tile says Global Player', await ev(() => /Global Player/.test(document.querySelector('#podsBody [data-podopen="501"]').textContent)));
  ok('  and an episode of it opens the podcast in Global Player', await ev(() => {
    const l = ULINKS.find(x => x.id === 501), h = epHref(l, { guid: 'x', link: '', t: 'Episode 1' }, 'Full Disclosure');
    return /package=com\.global\.player;/.test(h.href) && h.url === l.url; }));
  ok('the help names them', await ev(() => /Amazon Music, LBC or Global Player, where LBC’s podcasts are/
    .test(document.body.innerHTML.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/\s+/g, ' '))));

  // ---------------------------------------------------------------
  console.log('\nRemembered on the phone');
  await ev(() => localStorage.setItem('wish-shut', JSON.stringify(['no', 'zzz'])));
  await p.reload(); await p.waitForTimeout(900);
  ok('after a reload only what was left folded is folded, and nothing made up', await ev(() => [...WISH_SHUT].join()) === 'no');
  await ev(() => localStorage.setItem('wish-shut', 'rubbish'));
  await p.reload(); await p.waitForTimeout(900);
  ok('  and anything unreadable starts both folded', await ev(() => [...WISH_SHUT].sort().join()) === 'done,no');

  console.log('\nThe version');
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.27.2');
  ok('2026.11.27.2 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  three lines for What\'s new, each short enough', V && V.changes.length === 3 && V.changes.every(x => x.length < 160));

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
