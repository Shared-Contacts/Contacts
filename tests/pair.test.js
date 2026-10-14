// Joining two loose halves into a proper transfer — Barry's whole problem.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (w, c, e='') => {
  if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); }
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

  await p.evaluate(() => {
    window.__rows.accounts.push(
      {id:7,name:'Revolut GBP',kind:'current',currency:'GBP',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:40},
      {id:8,name:'Revolut EUR',kind:'current',currency:'EUR',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:50});
    const T = window.__rows.transactions, I = window.__rows.transaction_items;
    // same currency, two days apart — the finder should spot this one
    T.push({id:400,account_id:1,tdate:'2026-09-22',kind:'expense',total:-200,
      business:false,reconciled:false,photos:[],payee_id:null,
      reference:'SANDRA WALSH TO REVOLUT'});
    T.push({id:401,account_id:7,tdate:'2026-09-24',kind:'income',total:200,
      business:false,reconciled:false,photos:[],payee_id:null,
      reference:'Top-up from Barclays'});
    // different currencies — only pairable by hand
    T.push({id:402,account_id:1,tdate:'2026-09-25',kind:'expense',total:-100,
      business:false,reconciled:false,photos:[],payee_id:null,
      reference:'Revolut**8916*'});
    T.push({id:403,account_id:8,tdate:'2026-09-26',kind:'income',total:120.83,
      business:false,reconciled:false,photos:[],payee_id:null,
      reference:'Exchanged from GBP'});
    // a decoy: right amount, wrong direction, same account as 400
    T.push({id:404,account_id:1,tdate:'2026-09-23',kind:'income',total:200,
      business:false,reconciled:false,photos:[],payee_id:null,reference:'Refund'});
    // a split shop, which must never be taken for a transfer
    T.push({id:405,account_id:1,tdate:'2026-09-22',kind:'expense',total:-60,
      business:false,reconciled:false,photos:[],payee_id:null,reference:'Big shop'});
    T.push({id:406,account_id:7,tdate:'2026-09-22',kind:'income',total:60,
      business:false,reconciled:false,photos:[],payee_id:null,reference:'Something'});
    [[400,-200],[401,200],[402,-100],[403,120.83],[404,200],[406,60]]
      .forEach(([tid,amt],n)=>I.push({id:500+n,transaction_id:tid,category_id:null,
        description:(T.find(t=>t.id===tid)||{}).reference,qty:1,amount:amt,
        line_total:amt,sort:0}));
    // 405 has two lines
    I.push({id:520,transaction_id:405,category_id:1,description:'Food',qty:1,
      amount:-40,line_total:-40,sort:0});
    I.push({id:521,transaction_id:405,category_id:2,description:'Fuel',qty:1,
      amount:-20,line_total:-20,sort:1});
  });

  await p.evaluate(() => openMoney());
  await p.waitForTimeout(600);

  console.log('\nThe finder');
  await p.evaluate(() => { const d = document.querySelector('#moneyJobs'); if (d) d.open = true; });
  await p.waitForTimeout(150);  await p.click('#goPairs');
  await p.waitForTimeout(900);
  ok('the transfers screen opens', await p.isVisible('#pairs'));
  const found = await p.evaluate(() => PAIRS.map(x => [x.out.id, x.inn.id]));
  ok('it found the same-currency pair', found.some(x => x[0]===400 && x[1]===401),
     JSON.stringify(found));
  ok('it did not pair the refund in the same account',
     !found.some(x => x.includes(404)), JSON.stringify(found));
  ok('it left the split shop alone', !found.some(x => x.includes(405)),
     JSON.stringify(found));
  ok('and it did not guess at the cross-currency pair',
     !found.some(x => x.includes(402) || x.includes(403)), JSON.stringify(found));
  ok('it says why cross-currency is left out',
     /different currencies/.test(await p.textContent('#pairsBody')));

  console.log('\nJoining the pair it found');
  await p.evaluate(() => { window.__writes = []; });
  await p.click('[data-join="0"]');
  await p.waitForTimeout(900);
  const w = await p.evaluate(() => window.__writes);
  const heads = w.filter(x => x.op==='update' && x.table==='transactions');
  ok('both sides were made transfers',
     heads.filter(x => x.patch.kind === 'transfer').length === 2,
     JSON.stringify(heads.map(x => x.patch)));
  ok('they share one reference', (() => {
     const r = heads.filter(x => x.patch.transfer_id).map(x => x.patch.transfer_id);
     return r.length === 2 && r[0] === r[1];
  })());
  ok('the payee was cleared, since a transfer has none',
     heads.every(x => x.patch.payee_id === null));
  const li = w.filter(x => x.op==='update' && x.table==='transaction_items');
  ok('both sides were renamed', li.length === 2,
     JSON.stringify(li.map(x => x.patch.description)));
  ok('one says To and the other From',
     li.some(x => /^To /.test(x.patch.description)) &&
     li.some(x => /^From /.test(x.patch.description)),
     JSON.stringify(li.map(x => x.patch.description)));
  ok('no rate on a same-currency move',
     li.every(x => !/ at /.test(x.patch.description)),
     JSON.stringify(li.map(x => x.patch.description)));
  ok('no amount was touched',
     !w.some(x => x.table === 'transaction_items' && x.patch && 'amount' in x.patch));

  console.log('\nPairing a cross-currency one by hand');
  await p.evaluate(() => { $('pairs').classList.add('hidden'); });
  await p.evaluate(() => editTxn(402));
  await p.waitForTimeout(600);
  ok('the editor offers to pair it', await p.isVisible('#txPair'));
  await p.click('#txPair');
  await p.waitForTimeout(900);
  const cands = await p.evaluate(() =>
    [...document.querySelectorAll('[data-mate]')].map(e => ({
      id:+e.dataset.mate, txt:e.textContent.replace(/\s+/g,' ').trim().slice(0,60) })));
  ok('the euro arrival is offered', cands.some(c => c.id === 403),
     JSON.stringify(cands));
  ok('nothing from the same account is offered',
     !cands.some(c => [404,405].includes(c.id)), JSON.stringify(cands));

  await p.evaluate(() => { window.__writes = []; });
  await p.click('[data-mate="403"]');
  await p.waitForTimeout(900);
  const w2 = await p.evaluate(() => window.__writes);
  const li2 = w2.filter(x => x.op==='update' && x.table==='transaction_items');
  ok('the rate is written into both sides',
     li2.length === 2 && li2.every(x => /at 1\.2083 EUR to the pound/.test(x.patch.description)),
     JSON.stringify(li2.map(x => x.patch.description)));
  ok('and it names the other account',
     li2.some(x => /Revolut EUR/.test(x.patch.description)) &&
     li2.some(x => /Barclays/.test(x.patch.description)),
     JSON.stringify(li2.map(x => x.patch.description)));

  console.log('\nRefusals that matter');
  const sameAcc = await p.evaluate(() => joinAsTransfer(400, 404).then(r => r));
  ok('two rows in one account are refused', sameAcc === false);
  const bothOut = await p.evaluate(() => joinAsTransfer(400, 402).then(r => r));
  ok('two outgoings are refused', bothOut === false);
  const split = await p.evaluate(() => joinAsTransfer(405, 406).then(r => r));
  ok('a transaction split across lines is refused', split === false);

  console.log('\nSeparating them again');
  await p.evaluate(() => {
    window.__rows.transactions.find(t => t.id===400).transfer_id = 'abc';
    window.__rows.transactions.find(t => t.id===401).transfer_id = 'abc';
    window.__writes = [];
  });
  const undone = await p.evaluate(() =>
    splitTransfer({id:400, transfer_id:'abc'}).then(r => r));
  ok('it comes apart', undone === true);
  const w3 = await p.evaluate(() => window.__writes);
  ok('the link is cleared on both',
     w3.some(x => x.table==='transactions' && x.patch.transfer_id === null));
  ok('money coming in goes back to being income',
     w3.some(x => x.table==='transactions' && x.patch.kind === 'income'),
     JSON.stringify(w3.filter(x=>x.patch).map(x => x.patch.kind)));

  await p.evaluate(() => { $('moneyEd').classList.add('hidden'); openPairs(); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(__dirname,'pairs.png') });
  await b.close();

  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
