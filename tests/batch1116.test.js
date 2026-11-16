// The 16 Nov 2026 batch (version 2026.11.16.1), driven through the real page
// on a phone-sized screen:
//   ML264 Contacts, Grouped: UK and United Kingdom (and NZ, Aus, USA) are one
//         country, under the full name; what each contact says is unchanged.
//   ML265 Reports: Tick all and Untick all at the top of the list of
//         accounts, Refresh transactions above the list.
//   ML267 Pounds: Real dice at the top of the start screen, and Play again
//         asks, with last game's players and dice ticked.
// ML268 (the other phones going straight to the new game) needs two phones:
// it is in twopounds.test.js (Pounds) and twophone.test.js (Loxx).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object|NotAllowedError|Object not found|no photo/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const V1116 = VJ.history.find(h => h.version === '2026.11.16.1');
  ok('version.json still lists 2026.11.16.1, with its five changes', !!V1116 && V1116.changes.length === 5);

  // ---------------------------------------------------------------
  console.log('\nML264 Contacts: one name per country in Grouped');
  ok('UK, U.K., uk, GB and Great Britain are United Kingdom', await ev(() =>
    ['UK', 'U.K.', ' uk ', 'GB', 'Great Britain', 'united kingdom', 'United Kingdom'].every(x => countryName(x) === 'United Kingdom')));
  ok('NZ is New Zealand, Aus is Australia, USA and US are United States', await ev(() =>
    ['NZ', 'nz', 'New Zealand', 'N.Z.'].every(x => countryName(x) === 'New Zealand')
    && ['Aus', 'AUS', 'Australia'].every(x => countryName(x) === 'Australia')
    && ['USA', 'U.S.A.', 'US', 'United States of America', 'America'].every(x => countryName(x) === 'United States')));
  ok('anything else stays as typed (tidied of extra spaces), and nothing is No country', await ev(() =>
    countryName('Isle Of Man') === 'Isle Of Man' && countryName(' New  Caledonia ') === 'New Caledonia'
    && countryName('') === 'No country' && countryName(null) === 'No country' && countryName('  ') === 'No country'));

  const heads = () => ev(() => [...document.querySelectorAll('#list .countryhd')].map(b => {
    const n = b.querySelector('.n').textContent, c = b.querySelector('.caret').textContent;
    return b.textContent.replace(c, '').replace(n, '').trim() + ':' + n; }));
  await ev(() => {
    window.__was = { C: CONTACTS, T: TAGS, V: VIEW, M: MODE };
    const mk = (id, last, country) => ({ id, created_by: 'me', first_name: 'T' + id, last_name: last, country, contact_groups: [] });
    CONTACTS = [mk(901, 'Aardvark', 'UK'), mk(902, 'Badger', 'United Kingdom'), mk(903, 'Coot', 'NZ'), mk(904, 'Dipper', 'New Zealand'),
      mk(905, 'Egret', 'Aus'), mk(906, 'Fox', 'Australia'), mk(907, 'Grebe', 'Wales'), mk(908, 'Heron', ''), mk(909, 'Ibis', 'u.k.')];
    TAGS = {}; CONTACTS.forEach(c => TAGS[c.id] = [1]);
    VIEW = 'grouped'; MODE = 'grouped'; FILTER = null; $('search').value = '';
    OPEN.clear(); OPEN.add('g1'); render();
  });
  await settle(150);
  ok('Family lists each country once, under its full name, with both spellings counted', JSON.stringify(await heads())
    === JSON.stringify(['Australia:2', 'New Zealand:2', 'United Kingdom:4', 'No country:1']), JSON.stringify(await heads()));
  await ev(() => { OPEN.add('g1|United Kingdom'); render(); }); await settle(150);
  const ukNames = await ev(() => [...document.querySelectorAll('#list li')].map(li => li.textContent).join(' | '));
  ok('  United Kingdom opens to all four: the UK, the United Kingdom, the Wales and the u.k. one', /Aardvark/.test(ukNames)
    && /Badger/.test(ukNames) && /Grebe/.test(ukNames) && /Ibis/.test(ukNames) && !/Coot|Dipper/.test(ukNames), ukNames.slice(0, 200));
  ok('  what each contact says is left alone', await ev(() => CONTACTS.find(c => c.id === 901).country === 'UK'
    && CONTACTS.find(c => c.id === 909).country === 'u.k.'));
  await ev(() => { const w = window.__was; CONTACTS = w.C; TAGS = w.T; VIEW = w.V; MODE = w.M; OPEN.clear(); render(); });

  // ---------------------------------------------------------------
  console.log('\nML265 Reports: Tick all and Untick all at the top');
  await ev(() => { REP.from = '2026-02-01'; REP.to = '2026-02-28'; REP.accsOpen = true; return openReports(); }); await settle(500);
  const order = await ev(() => {
    const before = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const d = document.querySelector('.repaccs'), all = $('repAll'), none = $('repNone'), list = d && d.querySelector('.checks'),
      fresh = $('repFresh');
    return { inside: !!d && d.contains(all) && d.contains(none), allFirst: before(all, list) && before(none, list),
      sumFirst: before(d && d.querySelector('summary'), all), fresh: before(fresh, d) };
  });
  ok('Tick all and Untick all are inside the list of accounts, above the accounts', order.inside && order.allFirst && order.sumFirst, JSON.stringify(order));
  ok('  Refresh transactions sits above the list', order.fresh, JSON.stringify(order));
  ok('  on a phone the two buttons are in sight with the list open', await ev(() => {
    const r = $('repAll').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 40; }));
  await ev(() => { document.querySelectorAll('[data-repacc]').forEach(c => { c.checked = false; }); }); await p.click('#repNone'); await settle(300);
  await p.click('#repAll'); await settle(300);
  ok('  and still work: Untick all, then Tick all ticks every account', await ev(() =>
    [...document.querySelectorAll('[data-repacc]')].every(c => c.checked)));
  await ev(() => { REP.accsOpen = false; $('reports') && $('reports').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nML267 Pounds: the dice choice comes first');
  await ev(() => { window.__lkFake(); GAMES_READY = true; });
  await ev(() => { pdNewGame(); }); await settle(300);
  const pick = () => ev(() => {
    const w = $('pdWho'); if (!w) return null;
    const real = $('pdwReal'), ppl = w.querySelector('.ppl');
    const r = real.closest('label').getBoundingClientRect();
    return { first: !!(real.compareDocumentPosition(ppl) & Node.DOCUMENT_POSITION_FOLLOWING), real: real.checked,
      ticked: [...w.querySelectorAll('.ppl input:checked')].map(i => i.value), seen: r.top >= 0 && r.bottom <= innerHeight,
      again: /Play again/.test(w.textContent) };
  });
  let w = await pick();
  ok('New game: Real dice is above the list of people, unticked, nobody ticked', !!w && w.first && !w.real && !w.ticked.length && !w.again, JSON.stringify(w));
  ok('  and in sight without scrolling', !!w && w.seen, JSON.stringify(w));
  await p.click('#pdwCancel'); await settle(200);
  await ev(() => { pdNewGame(['sandra'], true); }); await settle(300);
  w = await pick();
  ok('Play again: says so, with Sandra and Real dice ticked as last game', !!w && w.again && w.real
    && JSON.stringify(w.ticked) === JSON.stringify(['sandra']), JSON.stringify(w));
  await p.click('#pdwCancel'); await settle(200);
  ok('  Cancel starts nothing', await ev(() => !$('pdWho') && !(window.__rows.games || []).some(g => g.kind === 'pounds')));

  // ---------------------------------------------------------------
  console.log('\nHelp');
  // Help is drawn from the page's own text when it opens: read it there.
  const help = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ');
  ok('Help says Real dice is at the top, and what Play again does in both games', /tick Real dice, at the top, when you start the game/.test(help)
    && (help.match(/Playing again:/g) || []).length === 2 && /taken straight to the new game/.test(help));

  console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
