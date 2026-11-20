// 20 Nov 2026 (version 2026.11.20.5), from Barry's phone:
//   ML342  Sent to you: under Contacts you sent, the OK button took the whole
//          width of its line, squeezing the words beside it into a column
//          with no room, so they spilled out underneath it.
//   ML343  Diary, Days: the Today button taken off. Days starts from today
//          each time the Diary opens anyway.
// Pretend people only; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|does not exist|schema cache|bank-holidays/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.route(/gov\.uk/, r => r.abort());

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); lockBackground(); });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; });

  // ---------------------------------------------------------------
  console.log('\nML342 Contacts you sent: OK beside the words, not over them');
  const rect = el => { const q = el.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width }; };
  for (const w of [320, 360, 412]) {
    await p.setViewportSize({ width: w, height: 800 }); await settle(200);
    const r = await ev(() => {
      const now = new Date().toISOString();
      OFFERS = [
        { id: 901, from_user: ME.id, to_user: 'u-pretend', decided_at: now, outcome: 'accepted', name: 'Pat Example' },
        { id: 902, from_user: ME.id, to_user: 'u-pretend', decided_at: now, outcome: 'merged', name: 'Alexandra Longname-Example' },
        { id: 903, from_user: 'u-pretend', to_user: ME.id, decided_at: null, outcome: null, name: 'Dan & Danny', created_at: now },
      ];
      openOffers();
      const g = el => { const q = el.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width }; };
      return [...document.querySelectorAll('[data-offseen]:not([data-offseen="all"])')].map(bt => {
        const mid = bt.parentElement.querySelector('.mid'), row = bt.parentElement;
        return { btn: g(bt), mid: g(mid), row: g(row), text: bt.textContent.trim(),
          lines: mid.querySelector('.t').getClientRects().length }; });
    });
    ok(`at ${w} wide: an OK beside each answer`, r.length === 2 && r.every(x => x.text === 'OK'), JSON.stringify(r));
    ok('  the OK only as wide as it needs', r.every(x => x.btn.w < 80), JSON.stringify(r.map(x => x.btn.w)));
    ok('  the words beside it, not under it', r.every(x => x.mid.r <= x.btn.l && x.mid.w > 150), JSON.stringify(r.map(x => [x.mid, x.btn])));
    ok('  the words read across, not one to a line: two lines at most for a short name', r[0].lines <= 2
      && (w < 360 || r[0].lines === 1), JSON.stringify(r.map(x => x.lines)));
    ok('  all inside the card', r.every(x => x.btn.r <= x.row.r && x.mid.l >= x.row.l && x.mid.b <= x.row.b + 1), JSON.stringify(r.map(x => x.row)));
  }
  ok('OK to all, under two or more, is still the full width', await ev(() => {
    const a = document.querySelector('[data-offseen="all"]'), c = a && a.previousElementSibling;
    return !!a && Math.abs(a.getBoundingClientRect().width - c.getBoundingClientRect().width) <= 1; }));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML343 Diary, Days: no Today button');
  await p.setViewportSize({ width: 360, height: 800 }); await settle(200);
  await ev(() => { DIARY_VIEW = 'days'; openDiary(); }); await settle(400);
  const top = await ev(() => { const n = document.querySelector('#diaryBody .dnav'), e = n.querySelector('[data-dmore="-7"]');
    const nr = n.getBoundingClientRect(), er = e.getBoundingClientRect();
    return { today: !!$('dToday'), btns: n.querySelectorAll('button').length, text: e.textContent.trim(),
      centred: Math.abs((er.left - nr.left) - (nr.right - er.right)) <= 2 }; });
  ok('no Today button', !top.today, JSON.stringify(top));
  ok('  Earlier days on its own at the top, in the middle like Later days at the bottom', top.btns === 1
    && top.text === '▲ Earlier days' && top.centred, JSON.stringify(top));
  const k0 = await ev(() => document.querySelector('.dday').dataset.dkey);
  await ev(() => document.querySelector('[data-dmore="-7"]').click()); await settle(200);
  ok('Earlier days still adds a week', await ev(k => document.querySelector('.dday').dataset.dkey < k
    && document.querySelectorAll('.dday').length === 21, k0));
  await closeAll();
  await ev(() => { DIARY_VIEW = 'days'; openDiary(); }); await settle(300);
  ok('opening the Diary again starts from today', await ev(k => document.querySelector('.dday').dataset.dkey === k
    && document.querySelectorAll('.dday').length === 14 && !!document.querySelector('.dday.today'), k0));
  await closeAll();
  const h = await ev(() => { openHelp('diary'); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    $('help').classList.add('hidden'); lockBackground(); return t; });
  ok('Help no longer mentions a Today button on Days', /Earlier days and Later days add more, and it starts from today again each time you open the Diary\./.test(h)
    && !/and Today comes back/.test(h));

  // ---------------------------------------------------------------
  console.log('\nThe version');
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const V = vj.history.find(x => x.version === '2026.11.20.5');
  ok('2026.11.20.5 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version
    && vj.history[0].version === vj.version);
  ok('  what\'s new says both', !!V && /OK button no longer covers the words/.test(V.changes.join(' '))
    && /the Today button is gone/.test(V.changes.join(' ')));

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
