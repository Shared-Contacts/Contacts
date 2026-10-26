// Searching the transactions, Select all on the reconcile screen, and the
// blue dot for a transaction with a receipt photo against it.
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
  const page = await browser.newPage({ viewport:{ width:360, height:740 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error' && !/simulated/.test(m.text()))
    errors.push('CONSOLE: ' + m.text()); });

  await page.goto('file://' + path.join(DIR, 'boot.html'));
  await page.waitForTimeout(900);
  await page.evaluate(() => { try{ localStorage.removeItem('moneyacc'); }catch(e){}
    MONEY_ACC='all'; });
  await page.evaluate(() => openMoney());
  await page.waitForTimeout(500);

  const shown = () => page.$$eval('#moneyBody [data-tx]', els => els.map(e => +e.dataset.tx));
  const search = async (words) => {
    await page.fill('#mq', words);
    await page.click('#mqGo');
    await page.waitForTimeout(300);
  };

  console.log('\nThe search box');
  ok('there is a search box on the Finances screen', await page.isVisible('#mq'));
  ok('leave out reconciled starts unticked', !(await page.isChecked('#mqNoRec')));
  ok('with Everything chosen there is no this-account choice',
     (await page.$$('#moneyBody [data-qall]')).length === 0);

  console.log('\nWhat it finds');
  await search('lens');
  ok('a line description is found', JSON.stringify(await shown()) === '[4]',
     JSON.stringify(await shown()));
  ok('the heading says these are search results',
     /Search results/.test(await page.textContent('#moneyBody .dsec')));
  ok('it says how many were found', /1 found/.test(await page.textContent('.mqfound')));
  ok('the keyboard is put away after searching',
     await page.evaluate(() => document.activeElement.id !== 'mq'));
  await search('tesco');
  ok('a payee is found', JSON.stringify(await shown()) === '[1]', JSON.stringify(await shown()));
  await search('photography');
  ok('a category is found', JSON.stringify(await shown()) === '[5]', JSON.stringify(await shown()));
  await search('212.40');
  ok('an amount is found without typing the minus',
     JSON.stringify(await shown()) === '[4]', JSON.stringify(await shown()));
  await search('£88.12');
  ok('an amount with a pound sign is found', JSON.stringify(await shown()) === '[5]',
     JSON.stringify(await shown()));
  await search('zzqx');
  ok('no match says so', /Nothing matches that/.test(await page.textContent('#moneyBody')));

  console.log('\nLeaving out the reconciled ones');
  await search('tesco');
  await page.check('#mqNoRec');
  await page.waitForTimeout(300);
  ok('the reconciled Tesco is left out', (await shown()).length === 0,
     JSON.stringify(await shown()));
  ok('the tick stays ticked', await page.isChecked('#mqNoRec'));
  await page.uncheck('#mqNoRec');
  await page.waitForTimeout(300);
  ok('unticking brings it back', JSON.stringify(await shown()) === '[1]');

  console.log('\nThis account or all of them');
  await page.click('#moneyBody [data-acc="1"]');
  await page.waitForTimeout(300);
  ok('with an account chosen the two choices appear',
     (await page.$$('#moneyBody [data-qall]')).length === 2);
  ok('Search this account is the one picked',
     await page.getAttribute('#moneyBody [data-qall="0"]','aria-pressed') === 'true');
  await search('lens');
  ok('the Amex lens hood is not in Barclays', (await shown()).length === 0,
     JSON.stringify(await shown()));
  await page.click('#moneyBody [data-qall="1"]');
  await page.waitForTimeout(300);
  ok('Search all finds it', JSON.stringify(await shown()) === '[4]',
     JSON.stringify(await shown()));
  ok('and Search all is now the one picked',
     await page.getAttribute('#moneyBody [data-qall="1"]','aria-pressed') === 'true');

  console.log('\nClearing');
  await page.click('#mqClear');
  await page.waitForTimeout(300);
  ok('the box is empty again', (await page.inputValue('#mq')) === '');
  ok('the ordinary list is back', (await shown()).length >= 2 &&
     !/Search results/.test(await page.textContent('#moneyBody .dsec')));
  await page.click('#moneyBody [data-acc="all"]');
  await page.waitForTimeout(300);

  console.log('\nFits a 360px phone with the keyboard up');
  await page.setViewportSize({ width:360, height:380 });
  await page.focus('#mq');
  await page.waitForTimeout(200);
  const fit = await page.evaluate(() => {
    const b=$('moneyBody'), r=$('mqGo').getBoundingClientRect();
    return { wide:b.scrollWidth<=b.clientWidth+1, btn:r.right<=window.innerWidth };
  });
  ok('nothing spills off the side', fit.wide);
  ok('the Search button is on screen', fit.btn);
  await page.setViewportSize({ width:360, height:740 });

  console.log('\nA failed load is not an empty list');
  await page.evaluate(() => {
    window.__realFrom = sb.from;
    sb.from = t => {
      const q = window.__realFrom.call(sb, t);
      if (t !== 'transactions') return q;
      const bad = Promise.resolve({ data:null, error:{ message:'simulated outage' } });
      const p = new Proxy(q, { get(o,k){
        if (k === 'then') return bad.then.bind(bad);
        const v = o[k];
        return typeof v === 'function' ? (...a) => (v.apply(o,a), p) : v; } });
      return p;
    };
  });
  await page.evaluate(async () => { await loadTxns(); renderMoney(); });
  let txt = await page.textContent('#moneyBody');
  ok('it says the transactions could not be loaded', /Could not load your transactions/.test(txt));
  ok('it does not say nothing is recorded', !/Nothing recorded yet/.test(txt));
  await search('tesco');
  txt = await page.textContent('#moneyBody');
  ok('a failed search says so too', /Could not search just now/.test(txt));
  ok('and does not pretend nothing matched', !/Nothing matches that/.test(txt));
  await page.evaluate(() => { sb.from = window.__realFrom; });
  await page.click('#mqClear');
  await page.waitForTimeout(300);

  console.log('\nThe receipt photo dot');
  await page.evaluate(async () => {
    window.__rows.transactions.find(t => t.id === 5).photos = [{ path:'r/1.jpg', at:'2026-02-20' }];
    await loadTxns(); renderMoney();
  });
  const dots = await page.$$eval('#moneyBody .txn', els =>
    els.filter(e => e.querySelector('.pdot')).map(e => +e.dataset.tx));
  ok('only the one with a photo has a dot', JSON.stringify(dots) === '[5]', JSON.stringify(dots));
  ok('the reconciled one is still hidden from the ordinary list',
     (await page.$$('#moneyBody .txn .recdot')).length === 0);

  console.log('\nSelect all when reconciling');
  await page.evaluate(() => openRecon(1));
  await page.waitForTimeout(500);
  ok('there is a Select all', await page.isVisible('#rcAll'));
  ok('the photo dot shows here too',
     (await page.$$('#reconBody [data-rt="5"] .pdot')).length === 1);
  const ticks = () => page.$$eval('#reconBody [data-rt] .tick.on', e => e.length);
  const rowsN = (await page.$$('#reconBody [data-rt]')).length;
  const before = await page.textContent('.recsum');
  const w0 = await page.evaluate(() => window.__writes.length);
  await page.click('#rcAll');
  await page.waitForTimeout(200);
  ok('Select all ticks every row', (await ticks()) === rowsN, (await ticks()) + ' of ' + rowsN);
  ok('the tally moves with it', (await page.textContent('.recsum')) !== before);
  ok('Select all shows as ticked', (await page.$$('#rcAll .tick.on')).length === 1);
  await page.click('#reconBody [data-rt="2"]');
  await page.waitForTimeout(200);
  ok('one can be unticked by hand', (await ticks()) === rowsN - 1);
  ok('Select all is no longer ticked', (await page.$$('#rcAll .tick.on')).length === 0);
  ok('nothing is saved until Save is pressed', w0 === await page.evaluate(() => window.__writes.length));
  await page.click('#rcAll');
  await page.waitForTimeout(200);
  ok('pressing it again ticks the rest', (await ticks()) === rowsN);
  await page.click('#rcAll');
  await page.waitForTimeout(200);
  ok('and once more clears them all', (await ticks()) === 0);
  await page.click('#rcAll');
  await page.waitForTimeout(200);
  await page.click('#reconBody [data-rt="2"]');
  await page.waitForTimeout(200);
  const going = await page.evaluate(() =>
    RECON.rows.filter(t => RECON.tick[t.id]).map(t => t.id).sort());
  ok('what will be saved is the ticked ones, less the one unticked',
     JSON.stringify(going) === '[1,5]', JSON.stringify(going));
  await page.evaluate(() => { window.__writes.length = 0; });
  await page.click('#rcSave');
  await page.waitForTimeout(500);
  const w = await page.evaluate(() => window.__writes);
  ok('Save marks them reconciled against the statement',
     w.some(x => x.op === 'update' && x.table === 'transactions' &&
       x.patch.reconciled === true && x.patch.statement_id === 1), JSON.stringify(w));

  await page.screenshot({ path: path.join(DIR,'finsearch.png'), fullPage:false });
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
