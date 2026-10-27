// Reports must show a changed category straight away (asked for 27 Oct 2026).
// Barry unlocked a reconciled transaction, changed its category, pressed the
// refresh arrow, opened the report again and still saw the old category: the
// report kept the figures it had fetched the first time.
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
  page.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|service worker|^reports /i.test(t))
      errors.push('CONSOLE: ' + t); });
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);
  const ev = (f, a) => page.evaluate(f, a);
  const settle = () => page.waitForTimeout(400);
  const text = () => ev(() => $('repOut').textContent.replace(/\s+/g,' '));
  // The Tesco shop (transaction 1, reconciled) moved to another category, as
  // if saved on another phone or through the pencil.
  const recat = cat => ev(c => { window.__rows.transaction_items.find(x => x.id===1).category_id = c; }, cat);

  await ev(() => openMoney()); await settle();
  await ev(() => { REP.from='2026-02-01'; REP.to='2026-02-28'; REP.kind='cats'; return openReports(); }); await settle();
  let t = await text();
  ok('to start with, the Tesco shop is under Groceries', /Groceries\s*1 item\s*−£42\.50/.test(t), t);

  // ---------------------------------------------------------------
  console.log('\nWhat Barry did: change it, press the refresh arrow, open the report again');
  await page.click('#repBack'); await settle();
  await recat(4);
  await page.click('#money [data-barref]'); await settle(); await settle();
  await ev(() => openReports()); await settle();
  t = await text();
  ok('the report shows it under Mooring now', /Mooring\s*1 item\s*−£42\.50/.test(t), t);
  ok('and Groceries has gone', !/Groceries/.test(t), t);

  // ---------------------------------------------------------------
  console.log('\nSaving a transaction is enough on its own');
  await page.click('#repBack'); await settle();
  await recat(2);
  await ev(() => txnDone('Saved')); await settle();
  await ev(() => openReports()); await settle();
  t = await text();
  ok('moved to Diesel without pressing anything else', /Diesel\s*2 items\s*−£254\.90/.test(t) && !/Mooring/.test(t), t);

  console.log('\nThe refresh arrow with the report open');
  await recat(1);
  ok('the report bar has the arrow too', await ev(() => !!document.querySelector('#reports [data-barref]')));
  await page.click('#reports [data-barref]'); await settle(); await settle();
  t = await text();
  ok('pressing it redoes the report on the spot', /Groceries\s*1 item\s*−£42\.50/.test(t) && /Diesel\s*1 item/.test(t), t);

  // ---------------------------------------------------------------
  console.log('\nThe Refresh transactions button on the report');
  ok('it is there', await ev(() => !!$('repFresh')));
  ok('and says what it does', await ev(() => /Refresh transactions/.test($('repFresh').textContent)));
  await recat(4);
  await page.click('#repFresh'); await settle(); await settle();
  t = await text();
  ok('pressing it fetches the figures again', /Mooring\s*1 item\s*−£42\.50/.test(t) && !/Groceries/.test(t), t);
  ok('and the same report stays open', await ev(() => REP.kind==='cats' && REP.from==='2026-02-01'));
  ok('it is also there when nothing was recorded in the dates', await ev(async () => {
    REP.from='2030-01-01'; REP.to='2030-01-31'; await repLoad(); return !!$('repFresh'); }));
  ok('and when the figures could not be fetched', await ev(() => {
    REP.failed=true; renderReports(); return !!$('repFresh'); }));
  ok('while it is adding up there is nothing to press twice', await ev(() => {
    REP.failed=false; REP.busy=true; renderReports(); const b=!$('repFresh'); REP.busy=false; return b; }));

  console.log('\n' + '='.repeat(52));
  ok('no page errors', errors.length===0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
