// The second 9 Nov 2026 batch (version 2026.11.09.2), driven through the real
// page on a phone-sized screen:
//   ML225 Wishlist: Copy notes gone; Share idea sends the words and the
//         idea's photos together through the phone's Share list.
//   ML226 Wishlist: a picture shared to the app lands on a new idea (the page
//         side here; the service worker side is in sharein.test.js).
//   ML227 Finances: American Express files the right way round, the status
//         column only when it is one, and each account's choices remembered.
//   ML228 Finances: Take an import out again.
//   ML229 Finances: "Nothing in this file" says why.
//   ML230 Home: the last row of tiles scrolls clear of the Wishlist/Help strip.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object|NotAllowedError/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

const AMEX = [
  'Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,Town/City,Postcode,Country,Reference,Category',
  '05/11/2026,INSTALMENT PLAN FEE,26.42,,INSTALMENT PLAN FEE,,,,,\'AT253100012345678901234\',General Purchases-Other',
  '31/10/2026,CKO*ASPIRE COMPETITIONS,16.00,,CKO*ASPIRE COMPETITIONS,LONDON,,,UNITED KINGDOM,\'AT253100012345678901235\',Entertainment-Other',
  '27/10/2026,PAYMENT RECEIVED - THANK YOU,-1500.00,,PAYMENT RECEIVED - THANK YOU,,,,,\'AT253100012345678901236\',Payments'
].join('\n');
const PLAIN = 'Date,Description,Amount\n03/11/2026,TESCO STORES,-12.50\n04/11/2026,FROM SANDRA,250.00';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const asked = []; let answer = true;
  p.on('dialog', d => { asked.push(d.message()); return answer ? d.accept() : d.dismiss(); });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const writes = () => ev(() => window.__writes);
  const flat = s => String(s || '').replace(/\s+/g, ' ');
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  ok('the page and version.json are 2026.11.09.2', appVer === '2026.11.09.2' && VJ.version === appVer && VJ.history[0].version === appVer, appVer + ' / ' + VJ.version);
  const said = VJ.history[0].changes.join(' ');
  ok('  saying what changed', /Share idea/.test(said) && /screenshot/.test(said) && /American Express/.test(said)
    && /Take an import out again/.test(said) && /says why/.test(said) && /tiles/.test(said), said);
  ok('  each line short enough for the What\'s new list', VJ.history[0].changes.every(c => c.length < 160));

  // ---------------------------------------------------------------
  console.log('\nWishlist: Copy notes gone, Share idea in (ML225)');
  await ev(() => {
    window.__shared = []; window.__shareFail = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
      if (window.__shareFail) { const e = new Error('no'); e.name = window.__shareFail; window.__shareFail = null; throw e; }
      window.__shared.push({ text: d.text, title: d.title, files: (d.files || []).map(f => [f.name, f.type, f.size]) }); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: async s => { window.__copied = s; }, readText: async () => '' } });
    window.__rows.wishes = [
      { id: 995, app: 'contacts', title: 'Finance', notes: 'Sort codes on the accounts', status: 'idea', created_by: 'me',
        created_at: '2026-11-09T09:00:00Z', photos: [{ path: 'wsh/me/a.jpg' }, { path: 'wsh/sandra/b.jpg' }] },
      { id: 996, app: 'contacts', title: 'Jigsaws', notes: null, status: 'idea', created_by: 'sandra',
        created_at: '2026-11-09T10:00:00Z', photos: [] }];
  });
  await ev(() => openWish()); await settle(500);
  ok('no Copy notes anywhere', await ev(() => !document.querySelector('[data-wfield="n"]')));
  ok('every idea has Copy idea and Share idea', await ev(() => ['995', '996'].every(id =>
    document.querySelector(`[data-wcopy="${id}"][data-wfield="t"]`)
    && (document.querySelector(`[data-wcopy="${id}"][data-wfield="s"]`) || {}).textContent === 'Share idea')));
  await clear();
  await p.click('[data-wcopy="995"][data-wfield="s"]'); await settle(400);
  let sh = await ev(() => window.__shared.slice(-1)[0]);
  ok('Share idea: the words as Copy idea gives them', sh && sh.text === 'Finance\nSort codes on the accounts', JSON.stringify(sh));
  ok('  and both photos, as pictures', sh && sh.files.length === 2 && sh.files.every(f => /^photo-\d\.jpg$/.test(f[0]) && f[1] === 'image/jpeg' && f[2] > 0), JSON.stringify(sh && sh.files));
  ok('  fetched from the photo store', JSON.stringify((await writes()).filter(w => w.op === 'download').map(w => w.path))
    === JSON.stringify(['wsh/me/a.jpg', 'wsh/sandra/b.jpg']));
  ok('  with no title, so nothing gets the Tile/Area twice', sh && sh.title === undefined);
  ok('  and nothing written to the database', !(await writes()).some(w => /insert|update|delete/.test(w.op)));
  await clear();
  await p.click('[data-wcopy="996"][data-wfield="s"]'); await settle(300);
  sh = await ev(() => window.__shared.slice(-1)[0]);
  ok('an idea with no photos shares just its words', sh && sh.text === 'Jigsaws' && sh.files.length === 0, JSON.stringify(sh));
  ok('  without fetching anything', !(await writes()).some(w => w.op === 'download'));
  await ev(() => { window.__noPhoto = 'wsh/sandra/b.jpg'; });
  await p.click('[data-wcopy="995"][data-wfield="s"]'); await settle(400);
  sh = await ev(() => window.__shared.slice(-1)[0]);
  ok('a photo that cannot be fetched is left out, and the rest still go', sh && sh.files.length === 1, JSON.stringify(sh));
  await ev(() => { window.__noPhoto = null; });

  // The phone only allows the Share list for a few seconds after a tap.
  await clear(); await clearToasts();
  await ev(() => { window.__shareFail = 'NotAllowedError'; });
  const n0 = await ev(() => window.__shared.length);
  await p.click('[data-wcopy="995"][data-wfield="s"]'); await settle(400);
  ok('photos too slow to fetch: the button says they are ready', await ev(() =>
    document.querySelector('[data-wcopy="995"][data-wfield="s"]').textContent) === 'Ready: tap to share' && /tap Share idea again/.test(await toasts()));
  await clear();
  await p.click('[data-wcopy="995"][data-wfield="s"]'); await settle(300);
  ok('  the next tap shares them at once, without fetching them again', await ev(() => window.__shared.length) === n0 + 1
    && !(await writes()).some(w => w.op === 'download') && (await ev(() => window.__shared.slice(-1)[0].files.length)) === 2);
  await clearToasts();
  await ev(() => { window.__shareFail = 'AbortError'; });
  await p.click('[data-wcopy="996"][data-wfield="s"]'); await settle(300);
  ok('closing the Share list is not an error', !/Could not/.test(await toasts()), await toasts());

  await ev(() => editWish(995)); await settle(400);
  ok('Change this idea: Copy idea and Share idea, no Copy notes', await ev(() =>
    !!document.querySelector('.daypick [data-wecopy="t"]') && !!document.querySelector('.daypick [data-wecopy="s"]')
    && !document.querySelector('.daypick [data-wecopy="n"]')));
  await p.fill('#weNotes', 'Changed words');
  await p.click('#wePics [data-dphx="1"]'); await settle(200);
  await p.click('.daypick [data-wecopy="s"]'); await settle(400);
  sh = await ev(() => window.__shared.slice(-1)[0]);
  ok('  its Share idea sends what is in the boxes and photos now', sh && sh.text === 'Finance\nChanged words' && sh.files.length === 1, JSON.stringify(sh));
  await ev(() => document.querySelector('#weCancel').click()); await settle(200);
  await ev(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); renderWish(); });
  ok('a phone that cannot share shows no Share idea button', await ev(() => !document.querySelector('[data-wfield="s"]')
    && !!document.querySelector('[data-wfield="t"]')));
  await ev(() => openHelp('wish')); await settle(300);
  const wHelp = flat(await ev(() => document.getElementById('h-wish').parentElement.textContent));
  ok('Help explains Share idea and the screenshot', /Share idea sends the words and the idea's photos/.test(wHelp)
    && /A screenshot straight in/.test(wHelp) && !/Copy notes/.test(wHelp));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nA picture shared to the app lands on a new idea (ML226)');
  await ev(() => { $('wish').classList.add('hidden'); DPH = null; lockBackground(); });
  await clear(); await clearToasts();
  await ev(async () => {
    const pic = await new Promise(res => { const c = document.createElement('canvas'); c.width = 60; c.height = 40;
      const g = c.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, 60, 40);
      c.toBlob(bl => res(new File([bl], 'Screenshot_20261109.png', { type: 'image/png' })), 'image/png'); });
    await sharedPicsIn({ text: 'Seen on the Finances page', files: Promise.resolve([pic]) });
  });
  await settle(600);
  ok('the Wishlist opens', await ev(() => !$('wish').classList.contains('hidden')));
  const up = (await writes()).filter(w => w.op === 'upload');
  ok('  the picture is put in the Wishlist\'s photo store', up.length === 1 && /^wsh\/me\/.+\.jpg$/.test(up[0].path), JSON.stringify(up));
  ok('  and shows on the new idea', await ev(() => document.querySelectorAll('#wPics img').length) === 1);
  ok('  the words shared with it go in the description', await ev(() => $('wNotes').value) === 'Seen on the Finances page');
  ok('  it says so, and the Tile/Area box is ready to type in', /Picture added: now fill in the two boxes/.test(await toasts())
    && await ev(() => document.activeElement && document.activeElement.id === 'wTitle'), await toasts());
  await p.fill('#wTitle', 'Finance');
  await ev(() => $('wAdd').click()); await settle(500);
  const ins = (await writes()).filter(w => w.op === 'insert' && w.table === 'wishes');
  ok('Add it saves the idea with the picture', ins.length === 1 && ins[0].rows.title === 'Finance'
    && JSON.stringify(ins[0].rows.photos) === JSON.stringify([{ path: up[0].path }]), JSON.stringify(ins));
  await clearToasts();
  await ev(() => { $('wish').classList.add('hidden'); DPH = null; lockBackground(); });
  await ev(() => sharedPicsIn({ text: '', files: Promise.resolve([]) })); await settle(400);
  ok('a picture that never arrived: the Wishlist still opens, and says to use Choose', await ev(() => !$('wish').classList.contains('hidden'))
    && /did not come through: add it with Choose/.test(await toasts()), await toasts());
  await ev(() => { $('wish').classList.add('hidden'); lockBackground(); });

  // Arriving at the address the service worker sends the app to.
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push('PAGE ERROR (shared in): ' + e.message));
  await p2.goto('file://' + path.join(__dirname, 'boot.html') + '?share_pics=1&share_text=' + encodeURIComponent('A note'));
  await p2.waitForTimeout(1500);
  ok('opening at ?share_pics=1 goes to the Wishlist, with the words', await p2.evaluate(() =>
    !$('wish').classList.contains('hidden') && $('wNotes').value === 'A note'));
  ok('  and takes it off the address, so a refresh cannot do it twice', await p2.evaluate(() => location.search === ''));
  ok('  rather than to URL Links', await p2.evaluate(() => !document.querySelector('#links:not(.hidden)')));
  await p2.close();

  // ---------------------------------------------------------------
  console.log('\nAn American Express file (ML227)');
  await ev(() => {
    window.__rows.accounts.push(
      { id: 20, name: 'American Express - Sandra', kind: 'credit card', currency: 'GBP', opening_balance: 0, opening_date: '2026-01-01', active: true, sort: 200 },
      { id: 21, name: 'Barclays BBA', kind: 'current', currency: 'GBP', opening_balance: 0, opening_date: '2026-01-01', active: true, sort: 210 });
    window.__rows.import_maps = [];
  });
  await ev(() => loadMoney()); await ev(() => openMoney()); await settle(500);
  const readInto = async (acc, csv) => {
    await ev(() => openImport()); await settle(200);
    await ev(a => { IMPORT.acc = a; renderImport(); }, acc);
    await p.fill('#impPaste', csv); await p.click('#impRead'); await settle(400);
  };
  const named = () => ev(() => { const o = {}; for (const k of ['date', 'desc', 'amount', 'in', 'out', 'ref', 'only'])
    o[k] = IMPORT.map[k] === '' || IMPORT.map[k] === undefined ? '' : IMPORT.head[Number(IMPORT.map[k])]; o.flip = IMPORT.map.flip; return o; });
  const preview = async () => { await p.click('#impPreview'); await settle(500); return flat(await p.textContent('#impOut')); };

  await readInto(20, AMEX);
  let m = await named();
  ok('Amount, Description and Date found', m.amount === 'Amount' && m.desc === 'Description' && m.date === 'Date', JSON.stringify(m));
  ok('Spending shows as: set to American Express by itself', m.flip === '1' && await ev(() => $('impBody').querySelector('[data-imap="flip"]').value) === '1');
  ok('"Appears On Your Statement As" is no longer taken for a status column', m.only === '', JSON.stringify(m));
  ok('their Reference column is used as each row\'s own reference', m.ref === 'Reference', JSON.stringify(m));
  let out = await preview();
  ok('all three rows come through', /3 rows for this account/.test(out), out.slice(0, 120));
  let rows = await ev(() => IMPORT.ready.map(x => [x.desc, x.amount]));
  ok('the fee and the shop are money out, the payment money in', JSON.stringify(rows) === JSON.stringify(
    [['INSTALMENT PLAN FEE', -26.42], ['CKO*ASPIRE COMPETITIONS', -16], ['PAYMENT RECEIVED - THANK YOU', 1500]]), JSON.stringify(rows));
  ok('  shown that way: a minus on the fee, none on the payment', /−£26\.42/.test(out) && /£1,500\.00/.test(out) && !/−£1,500\.00/.test(out), out);

  await clear();
  await p.click('#impGo'); await settle(800);
  let w = await writes();
  const heads = (w.find(x => x.op === 'insert' && x.table === 'transactions') || {}).rows || [];
  ok('imported: the fee as spending, the payment as money in', heads.length === 3 && heads[0].kind === 'expense' && heads[2].kind === 'income', JSON.stringify(heads.map(h => [h.reference, h.kind])));
  ok('  each with Amex\'s own reference', heads.map(h => h.bank_ref).join() === "'AT253100012345678901234','AT253100012345678901235','AT253100012345678901236'", heads.map(h => h.bank_ref).join());
  const lines = (w.find(x => x.op === 'insert' && x.table === 'transaction_items') || {}).rows || [];
  ok('  and the amounts the right way round', lines.map(l => l.amount).join() === '-26.42,-16,1500', lines.map(l => l.amount).join());
  let mp = w.filter(x => x.table === 'import_maps');
  ok('the choices are remembered for the account, with the file\'s headings', mp.length === 1 && mp[0].op === 'insert'
    && mp[0].rows.account_id === 20 && mp[0].rows.map.flip === '1' && mp[0].rows.map.heads.length === 11, JSON.stringify(mp));

  // Remembered: a layout saved with the same headings comes back by itself.
  await ev(saved => { window.__rows.import_maps = [{ id: 77, account_id: 20, name: 'Last used', map: saved }]; },
    { ...mp[0].rows.map, desc: '4' });
  await readInto(20, AMEX);
  m = await named();
  ok('next time, the same file comes in the way it was set last time', m.desc === 'Appears On Your Statement As' && m.flip === '1', JSON.stringify(m));
  ok('  and says so', /Set the way you had it last time/.test(flat(await p.textContent('#impBody'))));
  await clear();
  await preview(); await p.click('#impGo'); await settle(800);
  mp = (await writes()).filter(x => x.table === 'import_maps');
  ok('  importing again updates that layout rather than adding another', mp.length === 1 && mp[0].op === 'update'
    && JSON.stringify(mp[0].where).includes('77'), JSON.stringify(mp));
  await ev(() => { window.__rows.import_maps = [{ id: 78, account_id: 20, name: 'Other', map: { head: true, date: '0', desc: '2', amount: '1', flip: '', heads: ['A', 'B', 'C'] } }]; });
  await readInto(20, AMEX);
  ok('a layout kept for a file with other headings is not used', (await named()).desc === 'Description' && !(await ev(() => IMPORT.used)));
  // One saved by the old "Remember this layout as" box, which kept no headings.
  await ev(() => { window.__rows.import_maps = [{ id: 79, account_id: 21, name: 'Barclays', map: { head: true, date: '0', desc: '1', amount: '2', fmt: 'dmy' } }]; });
  await readInto(21, PLAIN);
  ok('an old layout without headings is used when it fits the file', await ev(() => IMPORT.used) === 'Barclays');
  await ev(() => { window.__rows.import_maps = [{ id: 80, account_id: 21, name: 'Odd', map: { head: true, date: '1', desc: '0', amount: '2', fmt: 'dmy' } }]; });
  await readInto(21, PLAIN);
  ok('  and not when its date column has no dates in it', !(await ev(() => IMPORT.used)));
  await ev(() => { window.__rows.import_maps = []; });

  console.log('\nWhich way round, for other files');
  await readInto(21, PLAIN);
  ok('a bank\'s own file: minus means spending, as before', (await named()).flip === '');
  out = await preview();
  rows = await ev(() => IMPORT.ready.map(x => x.amount));
  ok('  so Tesco is money out', JSON.stringify(rows) === '[-12.5,250]', JSON.stringify(rows));
  await p.selectOption('#impAcc', '20'); await settle(500);
  ok('choosing an American Express account for the same file turns it round', (await named()).flip === '1');
  await p.selectOption('[data-imap="flip"]', ''); await settle(300);
  rows = await ev(() => { importPreview(); return IMPORT.ready.map(x => x.amount); });
  ok('  and choosing "with a minus" puts it back', JSON.stringify(rows) === '[-12.5,250]', JSON.stringify(rows));
  await readInto(21, AMEX);
  ok('an Amex file is known by its headings, whatever the account is called', (await named()).flip === '1');
  await readInto(21, 'Date,Description,Money In,Money Out\n03/11/2026,TESCO,,12.50\n04/11/2026,PAY,100.00,');
  ok('money in and out columns: no Spending shows as choice (it cannot be wrong)', await ev(() => !$('impBody').querySelector('[data-imap="flip"]')));
  await readInto(21, 'Date,Description,Transaction Status,Amount\n03/11/2026,TESCO,Booked,-5\n04/11/2026,SHELL,Pending,-40');
  ok('a column really called Transaction Status is still found', (await named()).only === 'Transaction Status'
    && await ev(() => IMPORT.map.onlyVal) === 'Booked');
  await readInto(21, 'Date,Description,Statement Period,Amount\n03/11/2026,TESCO,Nov,-5');
  ok('  but not one that only has "state" inside a longer word', (await named()).only === '');
  // Money in/out headings that are empty all the way down, beside an amount column that is not.
  await readInto(21, 'Date,Name,Amount,Money Out,Money In\n03/11/2026,TESCO,-12.50,,\n04/11/2026,SANDRA,250.00,,');
  ok('empty Money in and Money out columns give way to the Amount column', (await named()).amount === 'Amount');

  // ---------------------------------------------------------------
  console.log('\nWhen nothing comes through, it says why (ML229)');
  await readInto(21, 'Date,Description,Amount\nyesterday,TESCO,-5\nlast week,SHELL,-40');
  out = await preview();
  ok('dates it cannot read', /Nothing in this file for this account/.test(out) && /2 of the 2 rows had no date the app could read/.test(out)
    && /one says “yesterday”/.test(out) && /Dates look like/.test(out), out.slice(0, 300));
  await readInto(21, 'Date,Description,Money In,Money Out\n03/11/2026,TESCO,,\n04/11/2026,SHELL,,');
  out = await preview();
  ok('no money in the columns', /2 came out as no money at all \(the column was empty\)/.test(out) && /Money in and Money out columns/.test(out), out.slice(0, 300));
  await readInto(21, 'Date,Description,Status,Amount\n03/11/2026,TESCO,Pending,-5');
  await ev(() => { IMPORT.map.onlyVal = 'Settled'; });
  out = await preview();
  ok('left out by Only rows where', /1 were left out by Only rows where/.test(out) && /Bring in every row/.test(out), out.slice(0, 300));
  await readInto(21, PLAIN);
  out = await preview();
  ok('a file that works shows none of that', !/Nothing in this file/.test(out) && !/no date the app could read/.test(out));

  // ---------------------------------------------------------------
  console.log('\nTaking an import out again (ML228)');
  const T1 = '2026-11-05T14:02:11.000+00:00', T2 = '2026-10-28T09:00:00.000+00:00';
  await ev(([T1, T2]) => {
    const T = window.__rows.transactions;
    T.push({ id: 501, account_id: 20, tdate: '2026-11-05', kind: 'income', total: 26.42, imported_at: T1, bank_ref: 'a', photos: [] },
      { id: 502, account_id: 20, tdate: '2026-10-31', kind: 'income', total: 16, imported_at: T1, bank_ref: 'b', photos: [] },
      { id: 503, account_id: 20, tdate: '2026-10-27', kind: 'transfer', total: -1500, imported_at: T1, bank_ref: 'c', transfer_id: 'tx-9', photos: [] },
      { id: 504, account_id: 20, tdate: '2026-10-20', kind: 'income', total: 9, imported_at: T2, bank_ref: 'd', photos: [] },
      { id: 505, account_id: 20, tdate: '2026-10-21', kind: 'income', total: 8, imported_at: T2, bank_ref: 'e', photos: [] },
      { id: 506, account_id: 20, tdate: '2026-10-22', kind: 'expense', total: -5, photos: [] },
      { id: 507, account_id: 21, tdate: '2026-10-27', kind: 'transfer', total: 1500, transfer_id: 'tx-9', photos: [] });
    window.__rows.bank_files = [{ id: 31, account_id: 20, name: 'activity.csv', path: 'fin/20/statements/x-activity.csv',
      created_at: '2026-11-05T14:02:40.000+00:00' }];
  }, [T1, T2]);
  await ev(() => loadBankFiles());
  await ev(() => openImport()); await settle(200);
  await ev(() => { IMPORT.acc = 20; renderImport(); });
  ok('the page has Take an import out again, folded away', await ev(() => !!$('impUndo') && !$('impUndo').open
    && /Take an import out again/.test($('impUndo').querySelector('summary').textContent)));
  await p.click('#impUndo summary'); await settle(500);
  const list = await ev(() => [...$('impUndoList').querySelectorAll('.setrow')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok('opening it lists each file brought in, newest first', list.length === 2 && /5 Nov 2026/.test(list[0]) && /28 Oct 2026/.test(list[1]), JSON.stringify(list));
  ok('  with how many it brought, the dates they cover and the file', /3 transactions/.test(list[0]) && /27 Oct/.test(list[0]) && /activity\.csv/.test(list[0])
    && /2 transactions/.test(list[1]) && !/csv/.test(list[1]), JSON.stringify(list));
  ok('  one typed in by hand is not in any of them', await ev(() => IMPORT.groups.every(g => !g.ids.includes(506))));
  answer = false; asked.length = 0; await clear();
  await p.click('[data-impundo="0"]'); await settle(400);
  ok('Take out asks first, saying what goes', asked.length === 1 && /Take out the 3 transactions brought into American Express - Sandra/.test(asked[0])
    && /goes with them/.test(asked[0]) && /1 on the other side of a transfer/.test(asked[0]) && /activity\.csv/.test(asked[0])
    && /cannot be undone/.test(asked[0]), asked[0]);
  ok('  and No leaves everything alone', !(await writes()).some(x => x.op === 'delete' || x.op === 'rmfile'));
  answer = true; asked.length = 0; await clear(); await clearToasts();
  await p.click('[data-impundo="0"]'); await settle(800);
  w = await writes();
  const del = w.filter(x => x.op === 'delete' && x.table === 'transactions');
  ok('Yes takes out those three and the other half of the transfer', del.length === 1
    && JSON.stringify(del[0].where.find(c => c[0] === 'in')[2].slice().sort()) === '[501,502,503,507]', JSON.stringify(del));
  ok('  and the statement file kept with them', w.some(x => x.op === 'rmfile' && x.paths[0] === 'fin/20/statements/x-activity.csv')
    && w.some(x => x.op === 'delete' && x.table === 'bank_files' && JSON.stringify(x.where).includes('31')));
  ok('  and says what to do next', /4 taken out. Now bring the file in again/.test(await toasts()), await toasts());

  await ev(() => { window.__failDelete = t => t === 'transactions' ? { message: 'statement is locked' } : null; });
  await clear(); await clearToasts();
  await ev(() => paintImpUndo()); await settle(400);
  await p.click('[data-impundo="0"]'); await settle(800);
  w = await writes();
  ok('rows on a locked statement are refused, and it says so', /0 taken out, 4 refused: those are on a locked statement/.test(await toasts()), await toasts());
  ok('  and then the statement file kept with them stays', !w.some(x => x.op === 'rmfile') && !w.some(x => x.table === 'bank_files'));
  await ev(() => { window.__failDelete = null; });
  await p.selectOption('#impAcc', '21'); await settle(500);
  ok('an account nothing was imported into says so', /Nothing has come into this account from a file/.test(await ev(() => $('impUndoList').textContent)));
  await ev(() => { $('moneyImp').classList.add('hidden'); $('money').classList.add('hidden'); lockBackground(); });
  await ev(() => openHelp('import')); await settle(300);
  const iHelp = flat(await ev(() => document.getElementById('h-import').parentElement.textContent));
  ok('Help covers American Express, why nothing came in, and taking an import out', /American Express writes spending as a plain figure/.test(iHelp)
    && /If nothing comes through, the app says why/.test(iHelp) && /Take an import out again/.test(iHelp) && !/Give the layout a name/.test(iHelp));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nThe home screen clears the Wishlist/Help strip (ML230)');
  for (const h of [844, 700, 600]) {
    await p.setViewportSize({ width: 390, height: h }); await settle(200);
    await ev(() => showHome()); await settle(400);
    const r = await ev(() => { const hb = $('homeBody'); hb.scrollTop = 1e6;
      const tiles = [...hb.querySelectorAll('.tile')]; const last = tiles[tiles.length - 1].getBoundingClientRect();
      return { last: last.bottom, tray: $('tray').getBoundingClientRect().top, scrolls: hb.scrollHeight > hb.clientHeight }; });
    ok(`at ${h}px high, scrolled to the end, the last tile ends above the strip`, r.last <= r.tray - 8, JSON.stringify(r));
  }

  console.log('\n' + (errors.length ? errors.join('\n') : 'No page errors.'));
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
