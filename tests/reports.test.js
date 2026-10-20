// Finances > Reports. Every figure here is worked out by hand from the
// cashbook in stub.js, so a report that adds up wrongly fails loudly.
//
// February 2026, from stub.js:
//   Barclays (GBP)  3 Feb  Tesco, Groceries               -42.50
//                  10 Feb  transfer to ASB                -500.00
//                  20 Feb  Alamy, Photography sales (biz)  +88.12
//   Amex (GBP)     14 Feb  Diesel x2 (business)           -212.40
//   ASB (NZD)      13 Feb  transfer from Barclays        +1050.00
// Added here: 12 Feb 2025, Barclays, Groceries -30.00 (for Year on year),
// and 2 Mar 2026, Barclays, a refund of +10.00 on Groceries.
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
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, acceptDownloads:true });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|service worker|^reports /i.test(t))
      errors.push('CONSOLE: ' + t); });
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);
  const ev = (f, a) => page.evaluate(f, a);
  const settle = () => page.waitForTimeout(400);
  // The section headings are drawn in capitals, so compare without minding case.
  const text = () => ev(() => $('repOut').textContent.replace(/\s+/g,' '));

  await ev(() => {
    window.__rows.transactions.push(
      {id:90, account_id:1, tdate:'2025-02-12', kind:'expense', payee_id:1, total:-30, business:false, photos:[]},
      {id:91, account_id:1, tdate:'2026-03-02', kind:'refund',  payee_id:1, total:10,  business:false, photos:[]});
    window.__rows.transaction_items.push(
      {id:90, transaction_id:90, category_id:1, description:'Shop', qty:1, amount:-30, line_total:-30, business:false},
      {id:91, transaction_id:91, category_id:1, description:'Returned', qty:1, amount:10, line_total:10, business:false});
  });
  await ev(() => openMoney()); await settle();

  // ---------------------------------------------------------------
  console.log('\nGetting there');
  ok('Reports is in the Finances menu', await ev(() => areaItems('money').some(x => x.label==='Reports')));
  await ev(() => { REP.from='2026-02-01'; REP.to='2026-02-28'; return openReports(); }); await settle();
  ok('it opens', await ev(() => !$('reports').classList.contains('hidden')));
  ok('Help knows where it is', await ev(() => currentScreen()==='reports' && HELP_AT.reports==='h-reports'));
  ok('all six reports are offered', await ev(() =>
    [...document.querySelectorAll('[data-repkind]')].map(b => b.textContent).join('|')
      === 'All accounts|By category|Month by month|Business|Year on year|Trended statement'));
  ok('all three accounts are ticked to start with', await ev(() =>
    document.querySelectorAll('[data-repacc]:checked').length===3));

  // ---------------------------------------------------------------
  console.log('\nAll accounts');
  let t = await text();
  ok('Barclays: in £88.12, out −£42.50, change −£454.38 with the transfer',
     /Barclays\s*−£500\.00 moved\s*£88\.12\s*−£42\.50\s*−£454\.38/.test(t), t.slice(0,400));
  ok('Amex: out −£212.40', /Amex\s*£0\.00\s*−£212\.40\s*−£212\.40/.test(t));
  ok('ASB in NZ dollars, shown by code: change NZD 1,050.00', /ASB\s*NZD 1,050\.00 moved\s*NZD 0\.00\s*NZD 0\.00\s*NZD 1,050\.00/.test(t), t.slice(0,500));
  ok('a total for each currency, not mixed together',
     /Total GBP\s*£88\.12\s*−£254\.90\s*−£666\.78/.test(t) && /Total NZD/.test(t));
  ok('and a section for the month', /February 2026/i.test(t));

  // ---------------------------------------------------------------
  console.log('\nBy category');
  await page.click('[data-repkind="cats"]'); await settle();
  t = await text();
  ok('By category keeps the code: PH Photography sales £88.12', /Income\s*PH Photography sales\s*1 item\s*£88\.12/.test(t), t.slice(0,300));
  ok('spending: Diesel −£212.40 first, as the biggest', /Spending\s*Diesel\s*1 item\s*−£212\.40.*Groceries\s*1 item\s*−£42\.50/.test(t), t);
  ok('transfers are not spending', !/500\.00|1,050/.test(t));
  ok('income less spending −£166.78', /Income less spending\s*−£166\.78/.test(t));
  await ev(() => document.querySelector('.repcat').open = true);
  ok('tapping a category shows the item behind it', await ev(() =>
    /Alamy/.test(document.querySelector('.repcat .replist').textContent)));

  // ---------------------------------------------------------------
  console.log('\nA refund counts back');
  await ev(() => { REP.from='2026-02-01'; REP.to='2026-03-31'; return repLoad(); }); await settle();
  t = await text();
  ok('Groceries over Feb and Mar is −£32.50 (−42.50 + 10.00)', /Groceries\s*2 items\s*−£32\.50/.test(t), t);

  // ---------------------------------------------------------------
  console.log('\nMonth by month');
  await page.click('[data-repkind="months"]'); await settle();
  t = await text();
  ok('February: in £88.12, out −£254.90, difference −£166.78', /Feb 2026\s*£88\.12\s*−£254\.90\s*−£166\.78/.test(t), t);
  ok('March: the refund, £10.00', /Mar 2026\s*£10\.00\s*£0\.00\s*£10\.00/.test(t));
  ok('total for the period', /Total\s*£98\.12\s*−£254\.90\s*−£156\.78/.test(t));

  // ---------------------------------------------------------------
  console.log('\nBusiness');
  await page.click('[data-repkind="business"]'); await settle();
  t = await text();
  ok('only the business lines: sales £88.12, Diesel costs −£212.40', /Photography sales\s*1 item\s*£88\.12/.test(t)
     && /Costs\s*Diesel\s*1 item\s*−£212\.40/.test(t) && !/Groceries/.test(t), t);
  ok('profit −£124.28', /Profit\s*−£124\.28/.test(t));
  ok('with no category codes in front of the names', !/PH Photography/.test(t));

  // ---------------------------------------------------------------
  console.log('\nYear on year');
  await ev(() => { REP.from='2026-02-01'; REP.to='2026-02-28'; });
  await page.click('[data-repkind="yoy"]'); await settle();
  t = await text();
  ok('Groceries now −£42.50, a year before −£30.00, change −£12.50', /Groceries\s*−£42\.50\s*−£30\.00\s*−£12\.50/.test(t), t);
  ok('Diesel, new this year', /Diesel\s*−£212\.40\s*£0\.00\s*−£212\.40/.test(t));
  ok('Year on year shows names without codes', /Photography sales/.test(t) && !/PH Photography/.test(t));
  ok('it says which dates it compares', /1 Feb 2026 to 28 Feb 2026, against 1 Feb 2025 to 28 Feb 2025/.test(t));

  // ---------------------------------------------------------------
  console.log('\nTrended statement');
  await ev(() => { REP.from='2026-02-01'; REP.to='2026-03-31'; });
  await page.click('[data-repkind="trend"]'); await settle();
  const grid = await ev(() => [...document.querySelectorAll('.reptab.trend tr')]
    .map(tr => [...tr.children].map(c => c.textContent.trim()).join(' | ')));
  ok('a column for each month, and a total', grid[0]==='Category | Feb 26 | Mar 26 | Total', grid[0]);
  ok('Photography sales: 88.12 in Feb, nothing in Mar', grid.includes('Photography sales | 88.12 | \u2013 | 88.12'), JSON.stringify(grid));
  const dI = grid.indexOf('Diesel | \u2212212.40 | \u2013 | \u2212212.40'), gI = grid.indexOf('Groceries | \u221242.50 | 10.00 | \u221232.50');
  ok('Diesel then Groceries, in the order set in Settings', dI > 0 && gI > dI, JSON.stringify(grid));
  ok('total spending for each month', grid.includes('Total spending | \u2212254.90 | 10.00 | \u2212244.90'));
  ok('income less spending along the bottom', grid[grid.length-1]==='Income less spending | \u2212166.78 | 10.00 | \u2212156.78', grid[grid.length-1]);
  ok('it scrolls sideways inside its box, not the whole page', await ev(() => {
    const box = document.querySelector('.reptrend');
    return getComputedStyle(box).overflowX==='auto' && $('repBody').scrollWidth<=$('repBody').clientWidth; }));
  ok('with the category names held still on the left', await ev(() =>
    getComputedStyle(document.querySelector('.reptab.trend tbody tr:not(.sec) th')).position==='sticky'));
  const [dl2] = await Promise.all([ page.waitForEvent('download'), page.click('#repCsv') ]);
  const csv2 = require('fs').readFileSync(await dl2.path(), 'utf8');
  ok('the download has the months as columns', /Section,Category,Currency,Feb 26,Mar 26,Total/.test(csv2)
     && /Spending,Groceries,GBP,-42\.50,10\.00,-32\.50/.test(csv2) && /Net,Income less spending,GBP,-166\.78,10\.00,-156\.78/.test(csv2), csv2);
  await ev(() => { window.__land = null; window.print = () => {
    const st = document.getElementById('printPage'); window.__land = !!st && /landscape/.test(st.textContent); }; });
  await page.click('#repPrint');
  ok('it prints on a landscape page', await ev(() => window.__land===true));
  await ev(() => window.dispatchEvent(new Event('afterprint')));
  ok('and the page goes back to normal afterwards', await ev(() => !document.getElementById('printPage')));

  // ---------------------------------------------------------------
  console.log('\nChoosing accounts');
  await page.click('[data-repkind="cats"]'); await settle();
  await ev(() => { const d = document.querySelector('.repaccs'); d.open = true; });
  // Note which accounts the database is asked about.
  await ev(() => { window.__asked = []; const from = sb.from.bind(sb); window.__realFrom = from;
    sb.from = t => { const q = from(t); if (t !== 'transactions') return q;
      const inner = q.in; q.in = (col, val) => { if (col==='account_id') window.__asked.push(val.slice()); return inner(col, val); };
      return q; }; });
  await ev(() => { const b = document.querySelector('[data-repacc="2"]'); b.checked = false; b.dispatchEvent(new Event('change')); });
  await settle();
  t = await text();
  ok('leaving out Amex takes its Diesel out', !/Diesel/.test(t) && /Groceries/.test(t));
  ok('the heading says 2 of 3 accounts', await ev(() => /2 of 3 accounts/.test(document.querySelector('.repaccs summary').textContent)));
  const asked = await ev(() => { sb.from = window.__realFrom; return window.__asked; });
  ok('only the ticked accounts are asked for', asked.length && asked.every(a => JSON.stringify(a)==='[1,3]'), JSON.stringify(asked));
  await page.click('#repNone'); await settle();
  ok('none ticked says so, rather than an empty page', /No accounts are ticked/.test(await text()));
  await page.click('#repAll'); await settle();

  // ---------------------------------------------------------------
  console.log('\nDates');
  await page.click('[data-repquick="tt"]'); await settle();
  const tt = await ev(() => [REP.from, REP.to]);
  const now = new Date(), y = now.getFullYear();
  const start = (now.getMonth() > 3 || (now.getMonth()===3 && now.getDate() >= 6)) ? y : y-1;
  ok('This tax year runs 6 April to 5 April', tt[0]===start+'-04-06' && tt[1]===(start+1)+'-04-05', JSON.stringify(tt));
  ok('and its button shows as chosen', await ev(() =>
    document.querySelector('[data-repquick="tt"]').getAttribute('aria-pressed')==='true'));
  await ev(() => { $('repFrom').value='2026-03-01'; $('repTo').value='2026-02-01'; $('repTo').dispatchEvent(new Event('change')); });
  await settle();
  ok('From after To is explained', /From date is after the To date/.test(await text()));
  await ev(() => { $('repFrom').value='2024-01-01'; $('repTo').value='2024-01-31'; $('repTo').dispatchEvent(new Event('change')); });
  await settle();
  ok('a quiet month says nothing was recorded, not a blank', /Nothing recorded between 1 Jan 2024 and 31 Jan 2024/.test(await text()));

  // ---------------------------------------------------------------
  console.log('\nTaking it out of the app');
  await ev(() => { REP.from='2026-02-01'; REP.to='2026-02-28'; REP.kind='cats'; return repLoad(); }); await settle();
  const [dl] = await Promise.all([ page.waitForEvent('download'), page.click('#repCsv') ]);
  ok('Download names the file after the report and dates', dl.suggestedFilename()==='report-cats-2026-02-01-to-2026-02-28.csv', dl.suggestedFilename());
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  ok('with plain numbers and the currency in its own column',
     /Spending,Diesel,GBP,1,-212\.40/.test(csv) && /Income,PH Photography sales,GBP,1,88\.12/.test(csv), csv.slice(0,300));
  ok('and what it covers at the top', /^﻿?By category\r\n1 Feb 2026 to 28 Feb 2026\r\n/.test(csv));
  await ev(() => { window.__printed = 0; window.print = () => { window.__printed++;
      window.__printHtml = $('printArea').innerHTML;
      window.__printing = document.body.classList.contains('printing'); }; });
  await page.click('#repPrint');
  const pr = await ev(() => ({ n:window.__printed, on:window.__printing, html:window.__printHtml||'' }));
  ok('Print opens the print screen', pr.n===1 && pr.on);
  ok('with a clean page: the title, the dates and the accounts, no buttons',
     /<h1>By category<\/h1>/.test(pr.html) && /1 Feb 2026 to 28 Feb 2026/.test(pr.html)
     && /Barclays, Amex, ASB/.test(pr.html) && !/repPrint|repCsv/.test(pr.html));
  await ev(() => window.dispatchEvent(new Event('afterprint')));
  ok('and the app comes back afterwards', await ev(() => !document.body.classList.contains('printing')));

  // ---------------------------------------------------------------
  console.log('\nWhen the figures cannot be fetched');
  await ev(() => { const from = sb.from.bind(sb); window.__realFrom = from;
    sb.from = t => t==='transactions'
      ? { select:()=>{ const q={ gte:()=>q, lte:()=>q, in:()=>q, order:()=>q,
            range:()=>Promise.resolve({data:null, error:{message:'offline'}}) }; return q; } }
      : from(t);
    REP.key=''; REP.from='2026-01-01'; return repLoad(); });
  await settle();
  ok('it says so, with Try again, instead of showing nothing', /could not be fetched just now/.test(await text())
     && !!(await page.$('#repAgain')));
  await ev(() => { sb.from = window.__realFrom; });
  await page.click('#repAgain'); await settle();
  ok('Try again brings the report back', /Spending/.test(await text()));

  // ---------------------------------------------------------------
  console.log('\nLeaving');
  await ev(() => { openMenu('money'); goArea('home'); }); await settle();
  ok('going somewhere else from the menu puts Reports away too', await ev(() => $('reports').classList.contains('hidden')));

  await browser.close();
  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0, 8).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
