// Flagging transactions that still need a category, so a half-done batch is
// obvious and you can pick up where you left off.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);

  // A half-worked batch: two with no category at all, one part done, one transfer.
  await p.evaluate(() => {
    const T = window.__rows.transactions, I = window.__rows.transaction_items;
    T.push(
      {id:91,account_id:1,tdate:'2026-09-15',kind:'expense',total:-98.36,
       reference:'TREVOR BASE',bank_ref:'a',photos:[],reconciled:false},
      {id:92,account_id:1,tdate:'2026-09-16',kind:'expense',total:-31.00,
       reference:'SHELL FILLING',bank_ref:'b',photos:[],reconciled:false},
      {id:93,account_id:1,tdate:'2026-09-17',kind:'expense',total:-60.00,
       reference:'PART DONE ONE',bank_ref:'c',photos:[],reconciled:false});
    I.push(
      {id:91,transaction_id:91,category_id:null,description:'TREVOR BASE',qty:1,
       amount:-98.36,line_total:-98.36,sort:0},
      {id:92,transaction_id:92,category_id:null,description:'SHELL FILLING',qty:1,
       amount:-31,line_total:-31,sort:0},
      // one line categorised, one not — part way through
      {id:93,transaction_id:93,category_id:2,description:'Diesel',qty:1,
       amount:-40,line_total:-40,sort:0},
      {id:94,transaction_id:93,category_id:null,description:'The rest',qty:1,
       amount:-20,line_total:-20,sort:1});
  });
  await p.evaluate(() => openMoney());
  await p.waitForTimeout(600);

  console.log('\nThe marker');
  const flagged = await p.$$eval('#moneyBody .txn.nocat',
    els => els.map(e => e.textContent.replace(/\s+/g,' ').trim().slice(0,30)));
  ok('the uncategorised ones are flagged', flagged.length === 3,
     flagged.length + ': ' + JSON.stringify(flagged));
  ok('a brass edge marks them', await p.evaluate(() => {
    const e = document.querySelector('#moneyBody .txn.nocat');
    return e && getComputedStyle(e).borderLeftWidth === '4px';
  }));
  ok('one with no category says so',
     /no category yet/.test(await p.textContent('#moneyBody')));
  ok('the part-done one says part done',
     /part done/.test(await p.textContent('#moneyBody')));

  console.log('\nTransfers are not nagged — they were never spent on anything');
  const transferFlagged = await p.evaluate(() => {
    const e = document.querySelector('#moneyBody [data-tx="2"]');   // the transfer
    return e ? e.classList.contains('nocat') : 'row missing';
  });
  ok('the transfer is left alone', transferFlagged === false, String(transferFlagged));
  ok('a fully categorised transaction is left alone', await p.evaluate(() => {
    const e = document.querySelector('#moneyBody [data-tx="1"]');   // Tesco/Groceries
    return e ? !e.classList.contains('nocat') : false;
  }));

  console.log('\nThe count and the filter');
  const chip = await p.textContent('#moneyBody [data-todo="1"]');
  ok('the chip counts them', /Needs a category.*3/.test(chip.replace(/\s+/g,' ')),
     chip.replace(/\s+/g,' '));
  await p.click('#moneyBody [data-todo="1"]');
  await p.waitForTimeout(500);
  ok('the heading changes', /Still to sort out/.test(await p.textContent('#moneyBody .dsec')));
  const only = await p.$$('#moneyBody .txn');
  const allFlagged = await p.$$eval('#moneyBody .txn',
    els => els.every(e => e.classList.contains('nocat')));
  ok('only the ones needing a category are listed', only.length === 3 && allFlagged,
     only.length + ' rows, all flagged: ' + allFlagged);

  console.log('\nSorting one out takes it off the list');
  await p.click('#moneyBody [data-tx="92"]');
  await p.waitForTimeout(400);
  await p.selectOption('[data-lc="0"]', { label:'Diesel' });
  await p.waitForTimeout(150);
  await p.click('#moneyEdSave');
  await p.waitForTimeout(700);
  await p.evaluate(() => {   // what the real database would now hold
    window.__rows.transaction_items.find(x => x.transaction_id === 92).category_id = 2;
  });
  await p.evaluate(() => loadMoney().then(renderMoney));
  await p.waitForTimeout(600);
  const left = await p.$$eval('#moneyBody .txn', els => els.length);
  ok('the list is one shorter', left === 2, left + ' rows left');
  const chip2 = await p.textContent('#moneyBody [data-todo="1"]');
  ok('the count came down to 2', /2/.test(chip2.replace(/\s+/g,' ')),
     chip2.replace(/\s+/g,' '));

  console.log('\nWhen there is nothing left it says so');
  await p.evaluate(() => {
    window.__rows.transaction_items.forEach(i => { if (!i.category_id) i.category_id = 1; });
  });
  await p.evaluate(() => { MONEY_TODO = false; return loadMoney().then(renderMoney); });
  await p.waitForTimeout(600);
  ok('the chips go away', (await p.$$('#moneyBody [data-todo]')).length === 0);
  ok('and it confirms all done',
     /every transaction has/.test(await p.textContent('#moneyBody')));

  await p.evaluate(() => {
    window.__rows.transaction_items.find(x => x.transaction_id === 91).category_id = null;
  });
  await p.evaluate(() => loadMoney().then(renderMoney));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname,'todo.png') });

  await b.close();
  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
