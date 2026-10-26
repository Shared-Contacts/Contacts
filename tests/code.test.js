// The category code decides the order of the list.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  const names = rows => page.evaluate(r => catsInOrder(r).map(c => c.name), rows);

  console.log('\nCoded categories lead, in code order');
  ok('a code puts one ahead of the uncoded',
     JSON.stringify(await names([
       {name:'Plain', sort:10}, {name:'Coded', sort:90, code:'100'}
     ])) === '["Coded","Plain"]');

  ok('numbers read as numbers, not as text',
     JSON.stringify(await names([
       {name:'hundred', code:'100'}, {name:'twenty', code:'20'}, {name:'three', code:'3'}
     ])) === '["three","twenty","hundred"]');

  ok('letters work just as well',
     JSON.stringify(await names([
       {name:'diesel', code:'DIES'}, {name:'coal', code:'COAL'}
     ])) === '["coal","diesel"]');

  ok('upper and lower case are not two different schemes',
     JSON.stringify(await names([
       {name:'b', code:'b10'}, {name:'A', code:'A10'}
     ])) === '["A","b"]');

  ok('the uncoded keep the order they were set up in',
     JSON.stringify(await names([
       {name:'Groceries', sort:90}, {name:'Mooring', sort:10}, {name:'Diesel', sort:50}
     ])) === '["Mooring","Diesel","Groceries"]');

  ok('a code of spaces counts as no code',
     JSON.stringify(await names([
       {name:'Blank', sort:99, code:'   '}, {name:'Real', sort:10}
     ])) === '["Real","Blank"]');

  ok('two of the same code fall back to the name',
     JSON.stringify(await names([
       {name:'Zebra', code:'100'}, {name:'Apple', code:'100'}
     ])) === '["Apple","Zebra"]');

  ok('the original list is left alone', await page.evaluate(() => {
    const rows = [{name:'b', sort:20}, {name:'a', sort:10}];
    catsInOrder(rows);
    return rows[0].name === 'b';
  }));

  console.log('\nAnd the app uses it');
  ok('the loaded categories come back in that order', await page.evaluate(async () => {
    window.__rows.categories.find(c => c.name === 'Groceries').code = '200';
    window.__rows.categories.find(c => c.name === 'Mooring').code = '100';
    await loadMoney();
    return FCATS[0].name === 'Mooring' && FCATS[1].name === 'Groceries';
  }));
  await page.evaluate(() => (async()=>{ MONEY_REC=true; await loadTxns(); return editTxn(1); })());
  await page.waitForTimeout(500);
  const opts = await page.evaluate(() =>
    [...document.querySelectorAll('[data-lc] option')].map(o => o.textContent.trim()));
  ok('the picker shows the code in front of the name',
     opts.some(o => /^100 — Mooring$/.test(o)), JSON.stringify(opts.slice(0,6)));
  ok('and lists the coded ones first',
     opts.indexOf('100 — Mooring') < opts.indexOf('200 — Groceries'), JSON.stringify(opts));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
