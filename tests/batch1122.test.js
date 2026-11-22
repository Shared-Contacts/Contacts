// 22 Nov 2026 (version 2026.11.22.1), Barry's two fixes that day:
//   ML375  Finances > Find transfers: Not these two. A pair that happens to
//          match but doesn't go together is never offered again, by this
//          person; it waits at the bottom, folded away, with Offer these two
//          again. Kept with the person's own settings, as Contacts' "not the
//          same person" is.
//   ML376  Diary > Regular: ticking or removing a job used to fold the "done"
//          lists shut and jump the screen to another part of the list. Drawn
//          again in place, it now stays as it was.
// Pretend accounts, payees and jobs only.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|PGRST205|does not exist|schema cache|bank-holidays|Failed to load resource/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const asked = [];
  p.on('dialog', d => { asked.push(d.message()); return d.accept(); });
  p.on('popup', pop => pop.close().catch(() => {}));
  await p.route(/gov\.uk|bsky\.app|bsky\.social/, r => r.abort());

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; window.__said = []; const t = toast; toast = s => { window.__said.push(s); t(s); }; });
  const said = () => ev(() => window.__said.join(' | '));

  // ---------------------------------------------------------------- ML375
  console.log('Find transfers: Not these two');
  await ev(() => {
    window.__rows.accounts.push({ id: 7, name: 'Saver', kind: 'savings', currency: 'GBP', opening_balance: 0,
      opening_date: '2026-01-01', active: true, sort: 40, created_by: 'me' });
    const T = window.__rows.transactions, I = window.__rows.transaction_items;
    const add = (id, acc, d, total, ref) => {
      T.push({ id, account_id: acc, tdate: d, kind: total < 0 ? 'expense' : 'income', total, business: false,
        reconciled: false, photos: [], payee_id: null, reference: ref });
      I.push({ id: 900 + id, transaction_id: id, category_id: null, description: ref, qty: 1, amount: total, line_total: total, sort: 0 });
    };
    add(400, 1, '2026-09-22', -200, 'TO SAVER');            // a real transfer
    add(401, 7, '2026-09-24', 200, 'From current account');
    add(410, 1, '2026-09-09', -25, 'PRETEND PERSON');        // money to a person...
    add(411, 7, '2026-09-03', 25, 'Bond prize');             // ...that happens to match
  });
  await ev(() => openMoney()); await settle(600);
  await ev(() => openPairs()); await settle(900);
  let found = await ev(() => PAIRS.map(x => x.out.id + '-' + x.inn.id));
  ok('both pairs are offered to begin with', found.includes('400-401') && found.includes('410-411'), JSON.stringify(found));
  ok('each has a Not these two button', await ev(() => document.querySelectorAll('#pairsBody [data-notpair]').length === PAIRS.length));
  ok('the words at the top say what it does', /Not these two and they won.t be offered again/.test(await p.textContent('#pairsBody')));

  const idx = await ev(() => PAIRS.findIndex(x => x.out.id === 410 && x.inn.id === 411));
  await ev(() => { window.__writes.length = 0; });
  await p.click(`[data-notpair="${idx}"]`); await settle(900);
  found = await ev(() => PAIRS.map(x => x.out.id + '-' + x.inn.id));
  ok('that pair is no longer offered', !found.includes('410-411'), JSON.stringify(found));
  ok('the other one still is', found.includes('400-401'));
  ok('nothing in Finances is changed', await ev(() => !window.__writes.some(w => /^transaction/.test(w.table || ''))));
  const saved = await ev(() => window.__writes.filter(w => w.op === 'update' && w.table === 'profiles'));
  ok('it is kept with your own settings', saved.length === 1 && JSON.stringify(saved[0].patch.home_tiles.notpair) === '["410-411"]'
    && JSON.stringify(saved[0].where).includes('"me"'), JSON.stringify(saved.map(x => x.patch.home_tiles && x.patch.home_tiles.notpair)));
  ok('and the rest of your settings go with it unchanged', saved[0] && Array.isArray(saved[0].patch.home_tiles.tiles) && Array.isArray(saved[0].patch.home_tiles.notsame));
  ok('it says so', /won.t be offered again/.test(await said()));
  ok('it waits at the bottom, folded away', await ev(() => { const d = $('pairsNo');
    return !!d && !d.open && /1 you said don.t go together/.test(d.textContent) && /PRETEND PERSON/.test(d.textContent) && /Bond prize/.test(d.textContent); }));

  await ev(() => { $('pairs').classList.add('hidden'); return openPairs(); }); await settle(900);
  ok('opened again, it is still not offered', !(await ev(() => PAIRS.map(x => x.out.id + '-' + x.inn.id))).includes('410-411'));

  // On another phone, or after a fresh start: it comes from your settings.
  const blob = saved[0] ? saved[0].patch.home_tiles : {};
  await ev(b => { NOT_PAIR = []; MY_PROFILE.home_tiles = b; loadTiles(); }, blob);
  ok('a fresh start reads it back from your settings', await ev(() => JSON.stringify(NOT_PAIR) === '["410-411"]'));
  await ev(() => { $('pairs').classList.add('hidden'); return openPairs(); }); await settle(900);
  ok('and it is still not offered', !(await ev(() => PAIRS.map(x => x.out.id + '-' + x.inn.id))).includes('410-411'));

  // Changing your mind.
  await ev(() => { $('pairsNo').open = true; window.__writes.length = 0; });
  await p.click('[data-pairback="0"]'); await settle(900);
  found = await ev(() => PAIRS.map(x => x.out.id + '-' + x.inn.id));
  ok('Offer these two again puts it back', found.includes('410-411'), JSON.stringify(found));
  ok('and your settings no longer hold it', await ev(() => { const w = window.__writes.filter(x => x.op === 'update' && x.table === 'profiles');
    return w.length === 1 && Array.isArray(w[0].patch.home_tiles.notpair) && w[0].patch.home_tiles.notpair.length === 0; }));
  ok('the folded list has gone', await ev(() => !$('pairsNo')));

  // With nothing left to offer, what you turned down is still there to put back.
  await ev(async () => { NOT_PAIR = ['400-401', '410-411']; await findPairs(); renderPairs(); });
  ok('nothing offered still shows the ones you turned down', await ev(() => PAIRS.length === 0 && /Nothing here looks like/.test($('pairsBody').textContent)
    && !!$('pairsNo') && /2 you said don.t go together/.test($('pairsNo').textContent)));
  // A key whose transactions are gone or joined is simply not listed.
  await ev(async () => { NOT_PAIR = ['999-998', '410-411']; await findPairs(); renderPairs(); });
  ok('one whose transactions have gone is left out of the list', await ev(() => PAIRS_NO.length === 1 && PAIRS_NO[0].key === '410-411'));
  await ev(async () => { NOT_PAIR = []; await findPairs(); renderPairs(); });

  // Joining still works as before.
  await ev(() => { window.__writes.length = 0; });
  const j = await ev(() => PAIRS.findIndex(x => x.out.id === 400));
  await p.click(`[data-join="${j}"]`); await settle(900);
  ok('Join these two still joins', await ev(() => window.__writes.filter(w => w.op === 'update' && w.table === 'transactions' && w.patch.kind === 'transfer').length === 2));

  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ok('Help explains Not these two and putting one back', /Tap <strong>Not these\s+two<\/strong>/.test(src) && /Offer these two again<\/strong> in case you change/.test(src));
  await ev(() => { $('pairs').classList.add('hidden'); $('money').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------- ML376
  console.log('Diary > Regular stays put');
  await ev(async () => {
    const r = []; let id = 1;
    ['Car', 'Health', 'Order'].forEach(h => { for (let i = 0; i < 3; i++) r.push({ id: id++, created_by: 'me', title: h + ' job ' + i, heading: h, done: false, sort_order: 100 + id }); });
    for (let i = 0; i < 25; i++) r.push({ id: id++, created_by: 'me', title: 'Old job ' + i, heading: 'Boat', done: true, done_at: new Date(Date.now() - i * 864e5).toISOString(), sort_order: 300 + i });
    r.push({ id: id++, created_by: 'me', title: 'Still to do', heading: 'Boat', done: false, sort_order: 400 });
    r.push({ id: id++, created_by: 'me', title: 'Wash car', heading: 'Car', done: true, done_at: new Date().toISOString(), sort_order: 500 });
    window.__rows.routines = r;
    // Removing takes effect in the pretend database, as it would in the real one.
    const push = window.__writes.push.bind(window.__writes);
    window.__writes.push = w => { if (w.op === 'delete' && w.table === 'routines') queueMicrotask(() => {
      const idw = (w.where || []).find(x => x[1] === 'id'); if (idw) window.__rows.routines = window.__rows.routines.filter(x => String(x.id) !== String(idw[2])); });
      return push(w); };
    await loadAll();
    DIARY_VIEW = 'routine';
    openDiary();
  });
  await settle(400);
  const st = () => ev(() => ({
    view: DIARY_VIEW, shown: !$('diary').classList.contains('hidden'), scroll: Math.round($('diaryBody').scrollTop),
    boat: !![...document.querySelectorAll('#diaryBody details.rtdone')].find(d => d.dataset.keep === 'done:Boat' && d.open),
    car: !![...document.querySelectorAll('#diaryBody details.rtdone')].find(d => d.dataset.keep === 'done:Car' && d.open),
    add: !!(document.querySelector('#diaryBody details[data-keep="rtadd"]') || {}).open,
    rows: document.querySelectorAll('#diaryBody [data-rtdel]').length }));
  let s0 = await st();
  ok('opened: the done lists start folded, at the top', !s0.boat && !s0.car && s0.scroll === 0 && s0.add, JSON.stringify(s0));

  await ev(() => { [...document.querySelectorAll('#diaryBody details.rtdone')].find(d => d.dataset.keep === 'done:Boat').open = true; });
  await ev(() => document.querySelector('[data-rtdel="22"]').scrollIntoView({ block: 'center' })); await settle(300);
  s0 = await st();
  const rowAt = () => ev(() => { const n = document.querySelector('[data-rtdel="23"]'); return n ? Math.round(n.getBoundingClientRect().top) : null; });
  const y0 = await rowAt();
  await p.click('[data-rtdel="22"]'); await settle(900);
  let s1 = await st();
  ok('removing a done job asks first, as before', /Remove "Old job 12" from the regular list for good\?/.test(asked[asked.length - 1] || ''), asked[asked.length - 1]);
  ok('the job has gone', s1.rows === s0.rows - 1 && !(await ev(() => !!document.querySelector('[data-rtdel="22"]'))));
  ok('it stays on Regular, in the Diary', s1.view === 'routine' && s1.shown);
  ok('the done list stays open', s1.boat, JSON.stringify(s1));
  ok('the screen stays at the same place', Math.abs(s1.scroll - s0.scroll) <= 2, s0.scroll + ' -> ' + s1.scroll);
  const y1 = await rowAt();
  ok('the next job moves up into the gap, nothing else moves', y0 !== null && y1 !== null && y1 < y0 && y0 - y1 < 80, y0 + ' -> ' + y1);

  // Ticking a job keeps things as they are too.
  s0 = await st();
  await ev(() => { window.__writes.length = 0; });
  await ev(() => document.querySelector('[data-rt="24"]').click()); await settle(900);
  s1 = await st();
  ok('ticking or unticking one keeps the done list open', s1.boat && Math.abs(s1.scroll - s0.scroll) <= 2, JSON.stringify([s0, s1]));
  ok('and it was saved', await ev(() => window.__writes.some(w => w.op === 'update' && w.table === 'routines')));

  // The Add a regular job box, folded shut, stays shut.
  await ev(() => { document.querySelector('#diaryBody details[data-keep="rtadd"]').open = false; });
  await ev(() => renderDiary()); await settle(200);
  ok('Add a regular job, folded shut, stays shut when drawn again', !(await st()).add);

  // Opening the Diary afresh, or another view, starts as it always did.
  await ev(() => { $('diary').classList.add('hidden'); openDiary(); }); await settle(300);
  s1 = await st();
  ok('opened afresh: folded, at the top, as before', !s1.boat && s1.add && s1.scroll === 0, JSON.stringify(s1));
  await ev(() => { [...document.querySelectorAll('#diaryBody details.rtdone')].find(d => d.dataset.keep === 'done:Boat').open = true; });
  await ev(() => document.querySelector('[data-dview="list"]').click()); await settle(300);
  await ev(() => document.querySelector('[data-dview="routine"]').click()); await settle(300);
  ok('back from another view, Regular starts folded again', !(await st()).boat);

  // A heading with quotes or odd characters in it is still found again.
  await ev(async () => { window.__rows.routines.push({ id: 90, created_by: 'me', title: 'Odd one', heading: 'Bits & "pieces"', done: true, done_at: new Date().toISOString(), sort_order: 600 });
    await loadAll(); renderDiary(); });
  await ev(() => { [...document.querySelectorAll('#diaryBody details.rtdone')].find(d => d.dataset.keep === 'done:Bits & "pieces"').open = true; });
  await ev(() => renderDiary()); await settle(200);
  ok('a heading with quotes and & in it stays open too', await ev(() => !![...document.querySelectorAll('#diaryBody details.rtdone')].find(d => d.dataset.keep === 'done:Bits & "pieces"' && d.open)));

  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('\n0 passed, 1 failed'); process.exit(1); });
