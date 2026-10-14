// Splitting an imported transaction across several lines, the way Barry did it.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};
const total = p => p.textContent('#txTotal');
const left  = p => p.textContent('#txLeft');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:1180, height:900 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });

  // An imported transaction: the bank said 98.36 and nothing else.
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.__rows.transactions.push({ id:90, account_id:1, tdate:'2026-09-15',
      kind:'expense', pay_method:null, payee_id:null, total:-98.36,
      business:false, reconciled:false, photos:[],
      reference:'TREVOR BASE  ON 15 SEP CPM',
      bank_ref:'2026-09-15|-98.36', imported_at:'2026-10-07T12:00:00Z' });
    window.__rows.transaction_items.push({ id:90, transaction_id:90, category_id:null,
      description:'TREVOR BASE  ON 15 SEP CPM', qty:1, amount:-98.36,
      line_total:-98.36, business:false, sort:0 });
    window.__rows.categories.push(
      {id:9,code:null,name:'Pump out',kind:'expense',business:false,sort:80,active:true},
      {id:10,code:null,name:'Photography expenses',kind:'expense',business:true,sort:210,active:true});
  });
  await p.evaluate(() => openMoney());
  await p.waitForTimeout(500);

  console.log('\nThe list falls back to the bank wording when there is no payee');
  ok('the bank’s own words show in the list',
     /TREVOR BASE/.test(await p.textContent('#moneyBody')));

  await p.click('#moneyBody [data-tx="90"]');
  await p.waitForTimeout(400);

  console.log('\nOpening an imported transaction');
  ok('the total shows straight away', (await total(p)) === '−£98.36',
     'got ' + await total(p));
  ok('it says what the bank said', /The bank said/.test(await p.textContent('#moneyEdBody')));
  ok('nothing is outstanding yet', /all accounted for/.test(await left(p)), await left(p));
  ok('How defaults to Debit card',
     (await p.inputValue('#txMethod')) === 'debit card',
     'got ' + await p.inputValue('#txMethod'));

  console.log('\nTyping the first split amount — this is what was broken');
  await p.fill('[data-la="0"]', '78.36');
  await p.waitForTimeout(200);
  ok('the total follows what you type, without leaving the box',
     (await total(p)) === '−£78.36', 'got ' + await total(p));
  ok('it says £20.00 is still to put somewhere',
     /£20\.00 still to put somewhere/.test(await left(p)), await left(p));
  ok('the cursor is still in the amount box',
     await p.evaluate(() => document.activeElement.dataset.la === '0'));

  console.log('\nAdding the second line');
  await p.fill('[data-ld="0"]', 'Diesel');
  await p.selectOption('[data-lc="0"]', { label:'Diesel' });
  await p.click('#txAddLine');
  await p.waitForTimeout(300);
  ok('the remaining £20.00 is already filled in',
     (await p.inputValue('[data-la="1"]')) === '20',
     'got ' + await p.inputValue('[data-la="1"]'));
  ok('the total is back to the bank’s figure',
     (await total(p)) === '−£98.36', 'got ' + await total(p));
  ok('and it says so', /all accounted for/.test(await left(p)), await left(p));

  console.log('\nSplitting three ways');
  await p.fill('[data-ld="1"]', 'Pumpout');
  await p.selectOption('[data-lc="1"]', { label:'Pump out' });
  await p.fill('[data-la="1"]', '15');
  await p.waitForTimeout(200);
  ok('the shortfall is picked up again', /£5\.00 still to put somewhere/.test(await left(p)),
     await left(p));
  await p.click('#txAddLine');
  await p.waitForTimeout(300);
  ok('the third line starts with the last £5.00',
     (await p.inputValue('[data-la="2"]')) === '5',
     'got ' + await p.inputValue('[data-la="2"]'));
  ok('three lines, adding to the bank’s figure',
     (await p.$$('#txLines .lrow')).length === 3 && (await total(p)) === '−£98.36');

  console.log('\nGoing over the bank’s figure is flagged, not silently accepted');
  await p.fill('[data-la="2"]', '25');
  await p.waitForTimeout(200);
  ok('it says you are over', /£20\.00 more than the bank said/.test(await left(p)),
     await left(p));
  ok('and marks it red', await p.evaluate(() =>
     $('txLeftRow').classList.contains('over')));
  await p.fill('[data-la="2"]', '5');
  await p.waitForTimeout(200);
  ok('putting it right clears the warning', await p.evaluate(() =>
     $('txLeftRow').classList.contains('ok')));

  console.log('\nA business category ticks the business box');
  ok('it starts unticked', !(await p.isChecked('#txBiz')));
  await p.selectOption('[data-lc="2"]', { label:'Photography expenses' });
  await p.waitForTimeout(300);
  ok('picking a business category ticks it', await p.isChecked('#txBiz'));

  console.log('\nSaving keeps all three lines and the right signs');
  await p.evaluate(() => { window.__writes = []; });
  await p.click('#moneyEdSave');
  await p.waitForTimeout(600);
  const w = await p.evaluate(() => window.__writes);
  const ins = w.filter(x => x.op==='insert' && x.table==='transaction_items').pop();
  const lines = ins && Array.isArray(ins.rows) ? ins.rows : [];
  ok('three lines were written', lines.length === 3, 'got ' + lines.length);
  ok('they add up to the bank’s figure',
     Math.abs(lines.reduce((s,l)=>s+l.qty*l.amount,0) + 98.36) < 0.005,
     JSON.stringify(lines.map(l=>l.qty*l.amount)));
  ok('all three are negative, being money out',
     lines.every(l => l.amount < 0), JSON.stringify(lines.map(l=>l.amount)));
  const head = w.filter(x => x.op==='update' && x.table==='transactions').pop();
  ok('debit card was saved', head && head.patch.pay_method === 'debit card',
     JSON.stringify(head && head.patch.pay_method));
  ok('business was saved', head && head.patch.business === true);

  console.log('\nA brand new transaction is not nagged about a bank figure');
  await p.evaluate(() => newTxn());
  await p.waitForTimeout(400);
  ok('no "the bank said" row on a fresh one',
     !/The bank said/.test(await p.textContent('#moneyEdBody')));
  ok('its total starts at nothing', (await total(p)) === '£0.00',
     'got ' + await total(p));
  ok('How still starts on Debit card',
     (await p.inputValue('#txMethod')) === 'debit card');

  await p.screenshot({ path: path.join(__dirname,'split.png') });
  await b.close();

  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
