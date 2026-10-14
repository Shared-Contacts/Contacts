// A real-shaped Revolut export: several currencies in one file, a fee column,
// and a pending row that should not come in.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

const CSV = [
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
  'CARD_PAYMENT,Current,2026-09-02 08:11:00,2026-09-02 09:00:00,Tesco,-42.50,0.00,GBP,COMPLETED,957.50',
  'TRANSFER,Current,2026-09-03 10:00:00,2026-09-03 10:01:00,To EUR,-200.00,1.50,GBP,COMPLETED,755.00',
  'CARD_PAYMENT,Current,2026-09-04 12:00:00,2026-09-04 12:30:00,Carrefour,-31.80,0.00,EUR,COMPLETED,168.20',
  'CARD_PAYMENT,Current,2026-09-05 12:00:00,2026-09-05 12:30:00,Boulangerie,-4.20,0.00,EUR,COMPLETED,164.00',
  'TOPUP,Current,2026-09-06 09:00:00,2026-09-06 09:05:00,Payment from Alamy,88.12,0.00,GBP,COMPLETED,843.12',
  'CARD_PAYMENT,Current,2026-09-07 19:00:00,,Pending restaurant,-26.00,0.00,GBP,PENDING,817.12'
].join('\n');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.__rows.accounts.push(
      {id:7,name:'Revolut GBP',kind:'current',currency:'GBP',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:40},
      {id:8,name:'Revolut EUR',kind:'current',currency:'EUR',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:50});
  });
  await p.evaluate(() => openMoney());
  await p.waitForTimeout(500);
  await p.evaluate(() => openImport());
  await p.waitForTimeout(300);

  console.log('\nReading a Revolut file into the GBP account');
  await p.selectOption('#impAcc', { label:'Revolut GBP (GBP)' });
  await p.evaluate(() => { IMPORT.acc = 7; });
  await p.fill('#impPaste', CSV);
  await p.click('#impRead');
  await p.waitForTimeout(400);

  const m = await p.evaluate(() => IMPORT.map);
  const head = await p.evaluate(() => IMPORT.head);
  ok('it found the Currency column by itself',
     head[Number(m.cur)] === 'Currency', 'guessed ' + head[Number(m.cur)]);
  ok('and the Fee column', head[Number(m.fee)] === 'Fee',
     'guessed ' + head[Number(m.fee)]);
  ok('and the Amount column', head[Number(m.amount)] === 'Amount');

  await p.click('#impPreview');
  await p.waitForTimeout(400);
  const out = await p.textContent('#impOut');

  console.log('\nOnly the pounds belong in this account');
  ok('three settled sterling rows found (the pending one is already out)',
     /3 rows for this account/.test(out), out.slice(0,90));
  ok('the euro rows are left out and counted',
     /2 rows[\s\S]{0,30}EUR[\s\S]{0,40}left out/.test(out.replace(/\s+/g,' ')),
     out.replace(/\s+/g,' ').slice(0,260));
  ok('it says where they belong',
     /belong to your EUR account/.test(out.replace(/\s+/g,' ')));
  ok('no euro amounts crept into the list', !/Carrefour|Boulangerie/.test(out));

  console.log('\nThe fee');
  ok('the fee is flagged on the transfer row',
     /includes a .*1\.50 fee/.test(out.replace(/\s+/g,' ')),
     out.replace(/\s+/g,' ').match(/includes[^<]{0,40}/));

  console.log('\nThe pending row keeps itself out');
  ok('it spotted the State column', await p.evaluate(() =>
     IMPORT.head[Number(IMPORT.map.only)] === 'State'),
     await p.evaluate(() => IMPORT.head[Number(IMPORT.map.only)]));
  ok('and chose COMPLETED by itself', await p.evaluate(() =>
     IMPORT.map.onlyVal === 'COMPLETED'), await p.evaluate(() => IMPORT.map.onlyVal));
  ok('so the pending restaurant never arrives', !/Pending restaurant/.test(out));
  ok('three to bring in, not four', /Import 3 transactions/.test(out), out.slice(-170));

  console.log('\nHow it was paid, read off their Type column');
  ok('it found the Type column', await p.evaluate(() =>
     IMPORT.head[Number(IMPORT.map.kind)] === 'Type'));
  const methods = await p.evaluate(() => IMPORT.ready.map(x => [x.desc, x.method]));
  ok('a card payment becomes a debit card',
     methods.some(([d,mm]) => /Tesco/.test(d) && mm === 'debit card'), JSON.stringify(methods));
  ok('a transfer becomes a transfer',
     methods.some(([d,mm]) => /To EUR/.test(d) && mm === 'transfer'), JSON.stringify(methods));
  ok('a top-up becomes a transfer',
     methods.some(([d,mm]) => /Alamy/.test(d) && mm === 'transfer'), JSON.stringify(methods));

  console.log('\nDates carry the year');
  ok('the year is shown on every row', /2 Sept? 2026/.test(out),
     (out.match(/\d+ \w+ \d{4}/g)||[]).slice(0,4).join(' | '));
  ok('no row shows a bare day and month', !/>\s*\d+ \w+\s*</.test(out));

  console.log('\nA row can still be left out by hand');
  const keys = await p.evaluate(() => IMPORT.ready.map(x => ({ k:x.key, d:x.desc })));
  const one = keys.find(x => /Tesco/.test(x.d));
  await p.click(`[data-imp="${one.k.replace(/"/g,'\\"')}"]`);
  await p.waitForTimeout(350);
  ok('unticking drops the count to two',
     /Import 2 transactions/.test(await p.textContent('#impOut')),
     (await p.textContent('#impOut')).slice(-160));
  await p.click(`[data-imp="${one.k.replace(/"/g,'\\"')}"]`);
  await p.waitForTimeout(350);
  ok('and ticking it back brings it to three',
     /Import 3 transactions/.test(await p.textContent('#impOut')));

  console.log('\nImporting');
  await p.evaluate(() => { window.__writes = []; });
  await p.click('#impGo');
  await p.waitForTimeout(700);
  const w = await p.evaluate(() => window.__writes);
  const heads = (w.find(x => x.op==='insert' && x.table==='transactions')||{}).rows || [];
  ok('three transactions written', heads.length === 3, 'got ' + heads.length);
  ok('all into the GBP account', heads.every(h => h.account_id === 7));
  ok('the pending one was not among them',
     !heads.some(h => /Pending/.test(h.reference||'')));
  ok('each one saved how it was paid',
     heads.some(h => /Tesco/.test(h.reference) && h.pay_method === 'debit card') &&
     heads.some(h => /To EUR/.test(h.reference) && h.pay_method === 'transfer'),
     JSON.stringify(heads.map(h => [h.reference, h.pay_method])));
  const lines = (w.find(x => x.op==='insert' && x.table==='transaction_items')||{}).rows || [];
  ok('the fee came in as its own line',
     lines.some(l => l.description === 'Fee' && l.amount === -1.5),
     JSON.stringify(lines.map(l => [l.description, l.amount])));
  ok('so the transfer row still totals what the statement says',
     Math.abs(lines.filter(l => l.transaction_id === lines.find(
        z => z.description === 'Fee').transaction_id)
       .reduce((s,l) => s + l.amount, 0) + 201.5) < 0.005);

  console.log('\nThe same file again, into the EUR account');
  await p.evaluate(() => { IMPORT.acc = 8; importPreview(); });
  await p.waitForTimeout(400);
  const eur = await p.textContent('#impOut');
  ok('now the two euro rows are the ones that count',
     /2 rows for this account/.test(eur), eur.slice(0,90));
  ok('and the sterling ones are the ones left out',
     /GBP/.test(eur) && /left out/.test(eur.replace(/\s+/g,' ')));
  ok('the euro amounts show with a euro sign',
     /€31\.80/.test(eur), eur.match(/[€£$][\d.,]+/g));

  await p.screenshot({ path: path.join(__dirname,'revolut.png') });
  await b.close();

  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
