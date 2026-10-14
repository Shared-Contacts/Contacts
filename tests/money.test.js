// Drives the real page in a real browser and checks the Finances screens.
const { chromium } = require('playwright');
const path = require('path');
const DIR = __dirname;

const errors = [];
let pass = 0, fail = 0;
const ok  = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('file://' + path.join(DIR, 'boot.html'));
  await page.waitForTimeout(900);

  console.log('\nOpening Finances');
  await page.evaluate(() => openMoney());
  await page.waitForTimeout(500);
  ok('the Finances screen opens', await page.isVisible('#money'));

  const body = await page.textContent('#moneyBody');
  ok('accounts are listed', /Barclays/.test(body) && /Amex/.test(body) && /ASB/.test(body));
  ok('a sterling balance shows', /£457\.50/.test(body), body.slice(0,180));
  // NZD and USD both use $, so the code is shown instead of the symbol.
  ok('a dollar balance is told apart from the other dollar',
     /NZD\u00a01,550\.00/.test(body), body.slice(0,200));
  ok('a negative shows with a minus', /−£212\.40/.test(body), 'Amex balance');
  ok('transactions are listed', /Tesco/.test(body) && /Alamy/.test(body));
  ok('a category shows under the payee', /Groceries/.test(body));
  ok('business is flagged', /business/.test(body));
  ok('the reconciled tick appears', (await page.$$('#moneyBody .txn .rec')).length === 1);

  // The top line carries one figure now, in whichever currency most of the
  // accounts are kept in. The others are totalled where they belong, never
  // added to it.
  const everything = await page.textContent('#moneyBody .acct');
  const whole = await page.textContent('#moneyBody');
  ok('the top line is one currency only',
     /£/.test(everything) && !/\$/.test(everything), everything);
  ok('and it is the pounds, since most accounts are in pounds',
     /£245\.10/.test(everything), everything);
  ok('the dollars are still shown, in their own right',
     /1,550\.00/.test(whole));

  console.log('\nFiltering to one account');
  await page.click('#moneyBody [data-acc="1"]');
  await page.waitForTimeout(300);
  ok('the account heading changes', /Barclays/.test(await page.textContent('#moneyBody .dsec')));

  console.log('\nOpening an existing transaction');
  await page.click('#moneyBody [data-tx="1"]');
  await page.waitForTimeout(400);
  ok('the editor opens', await page.isVisible('#moneyEd'));
  const ed = await page.textContent('#moneyEdBody');
  ok('the payee is filled in', /Tesco/.test(ed));
  ok('the line description is there', /Weekly shop/.test(await page.inputValue('[data-ld="0"]')));
  ok('the amount shows WITHOUT a minus sign',
     (await page.inputValue('[data-la="0"]')) === '42.5',
     'got ' + await page.inputValue('[data-la="0"]'));
  ok('the total is shown as money out', /−£42\.50/.test(ed), ed.match(/Total[\s\S]{0,40}/));

  console.log('\nAdding a second line');
  await page.click('#txAddLine');
  await page.waitForTimeout(250);
  ok('there are now two lines', (await page.$$('#txLines .lrow')).length === 2);
  await page.fill('[data-ld="1"]', 'Bag of coal');
  await page.fill('[data-la="1"]', '14');
  await page.selectOption('[data-lc="1"]', { label:'Diesel' });
  await page.waitForTimeout(150);
  await page.click('[data-kind="expense"]');     // forces a flush + redraw
  await page.waitForTimeout(250);
  ok('the second line survived the redraw',
     (await page.inputValue('[data-ld="1"]')) === 'Bag of coal');
  ok('the total adds both lines', /−£56\.50/.test(await page.textContent('#moneyEdBody')),
     'expected 42.50 + 14.00');

  console.log('\nSwitching to a Transfer');
  await page.click('[data-kind="transfer"]');
  await page.waitForTimeout(300);
  const tr = await page.textContent('#moneyEdBody');
  ok('a second account appears', await page.isVisible('#txAcc2'));
  ok('an arrival date appears', await page.isVisible('#txDate2'));
  ok('the item lines are replaced by one amount', !(await page.isVisible('#txLines')));
  ok('the payee box is gone on a transfer', !(await page.isVisible('#txPayee')));

  console.log('\nA cross-currency transfer asks what actually arrived');
  await page.selectOption('#txAcc2', { label:'ASB (NZD)' });
  await page.waitForTimeout(300);
  ok('an arriving amount in NZD is asked for', await page.isVisible('#trIn'),
     'Barclays GBP -> ASB NZD');
  ok('it is labelled with the right currency',
     /Arriving \(NZD\)/.test(await page.textContent('#moneyEdBody')));

  console.log('\nSaving the transfer');
  await page.fill('#trOut', '500');
  await page.fill('#trIn', '1050');
  await page.click('#moneyEdSave');
  await page.waitForTimeout(600);
  const writes = await page.evaluate(() => window.__writes);
  const ins = writes.filter(w => w.op==='insert' && w.table==='transactions');
  const pair = ins.length ? (Array.isArray(ins[ins.length-1].rows) ? ins[ins.length-1].rows : []) : [];
  ok('a transfer writes two rows', pair.length === 2, 'got ' + pair.length);
  ok('both halves share one reference',
     pair.length===2 && pair[0].transfer_id && pair[0].transfer_id === pair[1].transfer_id);
  ok('they are on different accounts',
     pair.length===2 && pair[0].account_id !== pair[1].account_id);
  const lineWrite = writes.filter(w => w.op==='insert' && w.table==='transaction_items').pop();
  const lines = lineWrite && Array.isArray(lineWrite.rows) ? lineWrite.rows : [];
  ok('one side is negative and the other positive',
     lines.length===2 && Math.sign(lines[0].amount) !== Math.sign(lines[1].amount),
     JSON.stringify(lines.map(l=>l.amount)));
  ok('the arriving amount is the NZD figure, not the GBP one',
     lines.some(l => Math.abs(l.amount) === 1050) && lines.some(l => Math.abs(l.amount) === 500),
     JSON.stringify(lines.map(l=>l.amount)));

  console.log('\nReconciling');
  await page.evaluate(() => openRecon(1));
  await page.waitForTimeout(500);
  ok('the reconcile screen opens', await page.isVisible('#recon'));
  const rc = await page.textContent('#reconBody');
  ok('it shows what the statement says', /929\.50/.test(rc), rc.slice(0,300));
  ok('it shows a difference to chase', /Still to find|Balanced/.test(rc));
  const lockBtn = await page.$('#rcLock');
  ok('locking is refused while it does not balance',
     lockBtn ? await lockBtn.isDisabled() : false);

  // Barclays only. An Amex or ASB row appearing here would wreck the tally.
  const seen = await page.$$eval('#reconBody [data-rt]', els => els.map(e => +e.dataset.rt));
  const belong = await page.evaluate(ids =>
    ids.every(id => (window.__rows.transactions.find(t => t.id === id) || {}).account_id === 1),
    seen);
  ok('only this account’s transactions are offered', belong && seen.length > 0,
     'rows shown: ' + JSON.stringify(seen));
  ok('the ASB and Amex transactions are kept out',
     !seen.includes(3) && !seen.includes(4));
  ok('what was settled earlier is this account only, not everybody’s',
     /£1,000\.00|£957\.50/.test(await page.textContent('.recsum')),
     (await page.textContent('.recsum')).replace(/\s+/g,' ').slice(0,160));

  console.log('\nTicking an item changes the tally');
  const before = await page.textContent('.recsum');
  const rows = await page.$$('#reconBody [data-rt]');
  ok('there are transactions waiting to reconcile', rows.length > 0, rows.length + ' rows');
  if (rows.length) {
    await rows[0].click();
    await page.waitForTimeout(250);
    ok('the tally moved', (await page.textContent('.recsum')) !== before);
  }

  console.log('\nImporting a bank file');
  await page.evaluate(() => openImport());
  await page.waitForTimeout(300);
  ok('the import screen opens', await page.isVisible('#moneyImp'));
  await page.fill('#impPaste',
    'Date,Description,Paid out,Paid in\n' +
    '03/02/2026,TESCO STORES 3344,42.50,\n' +
    '15/03/2026,BRITISH GAS,61.20,\n' +
    '18/03/2026,ALAMY LTD,,120.00\n');
  await page.click('#impRead');
  await page.waitForTimeout(400);
  ok('the columns are guessed from the headings',
     await page.isVisible('[data-imap="date"]'));
  const mapped = await page.evaluate(() => IMPORT.map);
  ok('it spotted separate in and out columns',
     mapped.amount === '' && mapped.in !== '' && mapped.out !== '',
     JSON.stringify(mapped));

  await page.click('#impPreview');
  await page.waitForTimeout(400);
  const prev = await page.textContent('#impOut');
  ok('all three rows were read', /3 rows for this account/.test(prev), prev.slice(0,120));
  ok('money out came through negative', /−£61\.20/.test(prev));
  ok('money in came through positive', /£120\.00/.test(prev) && !/−£120/.test(prev));
  ok('the one already in the books is flagged', /1 already in your books/.test(prev), prev.slice(0,160));
  ok('a British date was read day-first, not month-first',
     /15 Mar/.test(prev), prev.match(/1[58] \w+/g));

  console.log('\nSettings');
  await page.evaluate(() => { $('moneyImp').classList.add('hidden'); openSettings('Finances'); });
  await page.waitForTimeout(600);
  const set = await page.textContent('#setBody');
  ok('a Finances group appears in Settings', /Finances/.test(set));
  ok('accounts can be edited there', (await page.$$('[data-afield]')).length > 0);
  ok('categories can be edited there', (await page.$$('[data-cfield]')).length > 0);
  ok('payees can be edited there', (await page.$$('[data-pfield]')).length > 0);
  // The old all-or-nothing "who can see the books" card is gone: an account
  // belongs to somebody and is shared one at a time instead.
  ok('the books-wide sharing card has gone', (await page.$$('[data-finwho]')).length === 0);
  ok('each account says who can see it', (await page.$$('[data-ashare]')).length > 0);

  console.log('\nHelp');
  await page.evaluate(() => openHelp('money'));
  await page.waitForTimeout(400);
  const help = await page.textContent('#helpBody');
  ok('there is help for the cashbook', /h-money|Finances/.test(await page.innerHTML('#helpBody')));
  ok('reconciling is explained', /Balanced/.test(help));
  ok('importing is explained', /CSV/.test(help));

  await page.screenshot({ path: path.join(DIR,'money.png'), fullPage:false });

  await browser.close();

  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  if (errors.length) {
    console.log('\n' + errors.length + ' page error(s):');
    [...new Set(errors)].slice(0,12).forEach(e => console.log('  ' + e));
  } else {
    console.log('No page errors.');
  }
  process.exit(fail || errors.length ? 1 : 0);
})();
