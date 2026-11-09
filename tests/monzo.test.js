// Versions 2026.11.09.3 and .4, driven through the real page on a phone-sized
// screen (and the note about pairs at laptop width too):
//   ML229 Finances: Monzo's export from a search (headings ID, Created, Title,
//         Subtitle, Amount, Currency, Categories) said "Nothing in this file
//         for this account", because no column is called Date or Description.
//         The date is now the column whose values all look like dates, and the
//         description one called just Title (or Name, Merchant, Counterparty).
//   ML235 Finances: that file holds the account and its pots together, so each
//         move between them is in it twice, out and back in at the same
//         minute. Those pairs are left out, with Bring them in too.
// Every name and reference below is made up.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object|NotAllowedError/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

const MONZO = [
  'ID,Created,Title,Subtitle,Amount,Currency,Categories',
  'tx_TEST0001,"08/11/26, 02:48",Saving Challenge (2026),,2.4,GBP,savings',
  'tx_TEST0002,"08/11/26, 02:48",Saving Challenge (2026),Day 120 of 365,-2.4,GBP,savings',
  'tx_TEST0003,"24/10/26, 15:48",Corner Shop,,-6.45,GBP,shopping',
  'tx_TEST0004,"23/10/26, 17:13",Pat Example,Petrol money,20,GBP,general',
  'tx_TEST0005,"01/09/26, 03:53",Interest for August 2026,,1.25,GBP,savings',
  'tx_TEST0006,"12/09/26, 05:26",Extra plan,,-3,GBP,bills'
].join('\r\n');
const PLAIN = 'Date,Description,Amount\n03/11/2026,TESCO STORES,-12.50\n04/11/2026,FROM SANDRA,250.00';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
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
  const writes = () => ev(() => window.__writes);
  const flat = s => String(s || '').replace(/\s+/g, ' ');
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  const V93 = VJ.history.find(h => h.version === '2026.11.09.3');
  ok('the page and version.json are 2026.11.09.4, with 2026.11.09.3 before it', appVer === '2026.11.09.4' && VJ.version === appVer && VJ.history[0].version === appVer && !!V93, appVer + ' / ' + VJ.version);
  ok('  saying Monzo files now come in, without the moves to and from pots', !!V93 && /Monzo/.test(V93.changes.join(' ')) && /pots/.test(V93.changes.join(' ')));
  ok('  and that the note about them reads across the screen', /note about rows left out/.test(VJ.history[0].changes.join(' ')));
  ok('  each line short enough for the What\'s new list', [...VJ.history[0].changes, ...(V93 ? V93.changes : [])].every(c => c.length < 160));

  // ---------------------------------------------------------------
  console.log('\nA Monzo file exported from a search (ML229)');
  await ev(() => {
    window.__rows.accounts.push(
      { id: 30, name: 'Monzo - Test', kind: 'current', currency: 'GBP', opening_balance: 0, opening_date: '2026-01-01', active: true, sort: 300 },
      { id: 31, name: 'Barclays - Test', kind: 'current', currency: 'GBP', opening_balance: 0, opening_date: '2026-01-01', active: true, sort: 310 });
    window.__rows.import_maps = [];
  });
  await ev(() => loadMoney()); await ev(() => openMoney()); await settle(500);
  const readInto = async (acc, csv) => {
    await ev(() => openImport()); await settle(200);
    await ev(a => { IMPORT.acc = a; renderImport(); }, acc);
    await p.fill('#impPaste', csv); await p.click('#impRead'); await settle(400);
  };
  const named = () => ev(() => { const o = {}; for (const k of ['date', 'desc', 'amount', 'in', 'out', 'ref', 'only', 'cur'])
    o[k] = IMPORT.map[k] === '' || IMPORT.map[k] === undefined ? '' : IMPORT.head[Number(IMPORT.map[k])]; o.flip = IMPORT.map.flip; return o; });
  const preview = async () => { await p.click('#impPreview'); await settle(500); return flat(await p.textContent('#impOut')); };

  await readInto(30, MONZO);
  let m = await named();
  ok('Created is taken as the date', m.date === 'Created', JSON.stringify(m));
  ok('Title as the description (not Subtitle)', m.desc === 'Title', JSON.stringify(m));
  ok('Amount as the amount, Currency as the currency, ID as each row\'s reference', m.amount === 'Amount' && m.cur === 'Currency' && m.ref === 'ID', JSON.stringify(m));
  ok('minus means spending, as Monzo writes it', m.flip === '', JSON.stringify(m));
  ok('  and the boxes on screen show it', await ev(() => { const s = $('impBody').querySelector('[data-imap="date"]'); return !!s && s.value === '1'; }));
  let out = await preview();
  ok('the four real rows come through', /4 rows for this account/.test(out), out.slice(0, 200));
  ok('  not "Nothing in this file"', !/Nothing in this file/.test(out));
  ok('the move to the pot, in the file twice, is left out and it says so', /2 rows left out: money moving within the bank, such as between this account and its pots/.test(out), out.slice(0, 400));
  ok('  with Bring them in too', await ev(() => !!$('impPots') && $('impPots').textContent.trim() === 'Bring them in too'));
  // The first build put the button beside the words, in a row, and the words
  // were squeezed into a column one letter wide (seen on the laptop).
  for (const width of [390, 1280]) {
    await p.setViewportSize({ width, height: 844 }); await settle(200);
    const box = await ev(() => { const c = $('impPotNote').getBoundingClientRect(), t = $('impPotNote').querySelector('dd').getBoundingClientRect(),
      b = $('impPots').getBoundingClientRect(); return { card: c.width, text: t.width, high: t.height, under: b.top >= t.bottom - 1, btn: b.width }; });
    ok(`at ${width}px wide the note reads across the card, a few lines deep, with the button under it`,
      box.text > box.card * 0.7 && box.high < 140 && box.under && box.btn > box.card * 0.7, JSON.stringify(box));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);
  let rows = await ev(() => IMPORT.ready.map(x => [x.date, x.desc, x.amount, x.bref, x.take]));
  ok('dates read day first, with the time ignored', rows.map(r => r[0]).join() === '2026-10-24,2026-10-23,2026-09-01,2026-09-12', rows.map(r => r[0]).join());
  ok('the shop is money out, the interest money in', rows[0][2] === -6.45 && rows[2][2] === 1.25 && rows[1][2] === 20, JSON.stringify(rows));
  ok('each row keeps Monzo\'s own reference', rows.map(r => r[3]).join() === 'tx_TEST0003,tx_TEST0004,tx_TEST0005,tx_TEST0006', rows.map(r => r[3]).join());
  ok('  all ticked', rows.every(r => r[4]));

  // Untick one, then bring the pairs in: what was unticked stays unticked.
  await p.click('[data-imp="' + (await ev(() => IMPORT.ready[3].key)) + '"]'); await settle(200);
  await p.click('#impPots'); await settle(300);
  out = flat(await p.textContent('#impOut'));
  rows = await ev(() => IMPORT.ready.map(x => [x.bref, x.take, x.pot]));
  ok('Bring them in too: all six rows, the pair ticked', /6 rows for this account/.test(out) && rows.length === 6
    && rows.filter(r => r[2]).map(r => r[0] + r[1]).join() === 'tx_TEST0001true,tx_TEST0002true', JSON.stringify(rows));
  ok('  each marked as half of a move within the bank', (out.match(/half of a move within the bank/g) || []).length === 2, out.slice(0, 300));
  ok('  and the one unticked before is still unticked', rows.find(r => r[0] === 'tx_TEST0006')[1] === false, JSON.stringify(rows));
  ok('  the button now says Leave them out', /2 rows brought in/.test(out) && await ev(() => $('impPots').textContent.trim()) === 'Leave them out');
  await p.click('#impPots'); await settle(300);
  ok('Leave them out: back to four', await ev(() => IMPORT.ready.length) === 4 && /4 rows for this account/.test(flat(await p.textContent('#impOut'))));
  await p.click('[data-imp="' + (await ev(() => IMPORT.ready[3].key)) + '"]'); await settle(200);

  await clear();
  await p.click('#impGo'); await settle(800);
  const w = await writes();
  const heads = (w.find(x => x.op === 'insert' && x.table === 'transactions') || {}).rows || [];
  ok('imported: four transactions, with the right dates and references', heads.length === 4
    && heads[0].bank_ref === 'tx_TEST0003' && heads[0].tdate === '2026-10-24', JSON.stringify(heads.map(h => [h.tdate, h.bank_ref])));
  const lines = (w.find(x => x.op === 'insert' && x.table === 'transaction_items') || {}).rows || [];
  ok('  and the amounts as the file has them', lines.map(l => l.amount).join() === '-6.45,20,1.25,-3', lines.map(l => l.amount).join());

  console.log('\nWhat counts as a pair');
  const pairsIn = async csv => { await readInto(31, csv); await preview(); return ev(() => IMPORT.ready.length + ' in, ' + ($('impPotNote') ? $('impPotNote').textContent.match(/(\d+) rows left out/)[1] : 0) + ' out'); };
  ok('a refund on the same day, with no time in the file, is not taken for a pair',
    await pairsIn('Date,Description,Amount\n03/11/2026,TESCO,-12.50\n03/11/2026,TESCO,12.50') === '2 in, 0 out');
  ok('the same minute but different names is not a pair',
    await pairsIn('Created,Title,Amount\n"03/11/26, 10:15",Pot A,-5\n"03/11/26, 10:15",Pot B,5') === '2 in, 0 out');
  ok('the same minute and name but not the same amount is not a pair',
    await pairsIn('Created,Title,Amount\n"03/11/26, 10:15",Pot A,-5\n"03/11/26, 10:15",Pot A,4') === '2 in, 0 out');
  ok('three halves: one pair left out, the third comes in',
    await pairsIn('Created,Title,Amount\n"03/11/26, 10:15",Pot A,-5\n"03/11/26, 10:15",Pot A,5\n"03/11/26, 10:15",Pot A,-5') === '1 in, 2 out');
  ok('Revolut\'s balance moved out and straight back in counts too',
    await pairsIn('Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n'
      + 'Transfer,Current,18/06/2026 08:51,18/06/2026 08:51,Balance migration,-73.77,0.00,GBP,COMPLETED,0\n'
      + 'Transfer,Current,18/06/2026 08:51,18/06/2026 08:51,Balance migration,73.77,0.00,GBP,COMPLETED,73.77\n'
      + 'Card Payment,Current,19/06/2026 09:00,19/06/2026 09:00,Cafe,-3.20,0.00,GBP,COMPLETED,70.57') === '1 in, 2 out');
  out = await pairsIn('Created,Title,Amount\n"03/11/26, 10:15",Pot A,-5\n"03/11/26, 10:15",Pot A,5');
  ok('a file of nothing but pairs: nothing else to bring in, and it says so', out === '0 in, 2 out'
    && /Nothing else in this file for this account/.test(flat(await p.textContent('#impOut'))) && !(await p.$('#impGo')), out);
  await ev(() => { IMPORT.potsIn = true; });
  await readInto(31, 'Created,Title,Amount\n"03/11/26, 10:15",Pot A,-5\n"03/11/26, 10:15",Pot A,5');
  ok('reading a new file starts with the pairs left out again', await ev(() => IMPORT.potsIn) === false);

  // ---------------------------------------------------------------
  console.log('\nOther files are read as before');
  await ev(() => { window.__rows.import_maps = []; });
  await readInto(31, PLAIN);
  m = await named();
  ok('a column called Date still wins', m.date === 'Date' && m.desc === 'Description', JSON.stringify(m));
  await readInto(31, 'Posted,Name,Amount\n03/11/2026,TESCO,-12.50\n04/11/2026,SHELL,-40');
  m = await named();
  ok('a date column called something else is found by what is in it', m.date === 'Posted', JSON.stringify(m));
  ok('  and a column called just Name is the description', m.desc === 'Name', JSON.stringify(m));
  await readInto(31, 'When,Payee name,Code,Amount\n2026-11-03,TESCO,12/34,-12.50\n2026-11-04,SHELL,,-40');
  m = await named();
  ok('year-first dates are found the same way', m.date === 'When' && m.desc === 'Payee name', JSON.stringify(m));
  await readInto(31, 'Posted,Name,Amount\n03/11/2026,TESCO,-12.50\n,SHELL,-40\n,BOOTS,-3\n,CAFE,-2');
  ok('a column mostly empty is not taken for the date', (await named()).date === '');
  await readInto(31, 'Ref,Item,Amount\nA1,TESCO,-12.50\nA2,SHELL,-40');
  m = await named();
  ok('a file with no dates in it at all: no date column guessed', m.date === '', JSON.stringify(m));
  out = await preview();
  ok('  and it says why nothing came in', /Nothing in this file for this account/.test(out) && /had no date the app could read/.test(out), out.slice(0, 200));

  console.log('\nHelp');
  await ev(() => { $('moneyImp').classList.add('hidden'); $('money').classList.add('hidden'); lockBackground(); });
  await ev(() => openHelp('import')); await settle(300);
  const iHelp = flat(await ev(() => document.getElementById('h-import').parentElement.textContent));
  ok('Help says a Monzo file\'s moves to and from pots are left out, and how to have them', /Monzo file exported from a search/.test(iHelp)
    && /leaves those pairs out/.test(iHelp) && /Bring them in too/.test(iHelp));

  console.log('\n' + (errors.length ? errors.join('\n') : 'No page errors.'));
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
