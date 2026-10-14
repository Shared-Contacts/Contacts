const { chromium } = require('playwright');
const path=require('path');
const errors=[]; let pass=0,fail=0;
const ok=(w,c,e='')=>{ if(c){pass++;console.log('  ✓ '+w);}else{fail++;console.log('  ✗ '+w+(e?'  <- '+e:''));} };
(async()=>{
  const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errors.push('PAGE ERROR: '+e.message));
  p.on('console',m=>{const t=m.text();
    if(m.type()==='error'&&!/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))errors.push('CONSOLE: '+t);});
  await p.goto('file://'+path.join(__dirname,'boot.html'));
  await p.waitForTimeout(900);
  await p.evaluate(()=>{
    window.__rows.accounts.push(
      {id:7,name:'Revolut GBP',kind:'current',currency:'GBP',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:40},
      {id:8,name:'Revolut EUR',kind:'current',currency:'EUR',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:50});
  });
  await p.evaluate(()=>openMoney()); await p.waitForTimeout(500);

  console.log('\nSterling into euros');
  await p.evaluate(()=>newTxn()); await p.waitForTimeout(300);
  await p.click('[data-kind="transfer"]'); await p.waitForTimeout(250);
  await p.selectOption('#txAcc',{label:'Revolut GBP (GBP)'}); await p.waitForTimeout(300);
  await p.selectOption('#txAcc2',{label:'Revolut EUR (EUR)'}); await p.waitForTimeout(300);
  ok('it asks for both amounts', await p.isVisible('#trIn'));
  ok('and says it will work the rate out',
     /both amounts/.test(await p.textContent('#trRate')), await p.textContent('#trRate'));
  await p.fill('#trOut','500'); await p.waitForTimeout(150);
  ok('one amount alone is not enough to claim a rate',
     /both amounts/.test(await p.textContent('#trRate')), await p.textContent('#trRate'));
  await p.fill('#trIn','578.40'); await p.waitForTimeout(200);
  ok('the rate appears as you type',
     (await p.textContent('#trRate'))==='1.1568 EUR to the pound',
     await p.textContent('#trRate'));
  await p.fill('#trIn','575'); await p.waitForTimeout(200);
  ok('and follows a correction', (await p.textContent('#trRate'))==='1.15 EUR to the pound',
     await p.textContent('#trRate'));
  await p.fill('#trIn','578.40'); await p.waitForTimeout(200);

  console.log('\nIt is recorded, not just displayed');
  await p.evaluate(()=>{window.__writes=[];});
  await p.click('#moneyEdSave'); await p.waitForTimeout(700);
  const lines=(await p.evaluate(()=>window.__writes))
    .filter(x=>x.op==='insert'&&x.table==='transaction_items').pop();
  const rows=lines&&Array.isArray(lines.rows)?lines.rows:[];
  ok('both halves carry the rate in their wording',
     rows.length===2 && rows.every(r=>/at 1\.1568 EUR to the pound/.test(r.description)),
     JSON.stringify(rows.map(r=>r.description)));
  ok('the amounts are still the real ones',
     rows.some(r=>r.amount===-500) && rows.some(r=>r.amount===578.4),
     JSON.stringify(rows.map(r=>r.amount)));

  console.log('\nNZ dollars into euros — no special handling, same result');
  const r=await p.evaluate(()=>({
    nzdEur: rateWords('NZD','EUR',1000,512.34),
    eurGbp: rateWords('EUR','GBP',200,172.6),
    tiny:   rateWords('NZD','GBP',1,0.4567891),
    big:    rateWords('GBP','JPY',10,1932.5)
  }));
  ok('NZD to EUR works the same way', r.nzdEur==='0.51234 EUR to the NZD', r.nzdEur);
  ok('EUR to GBP reads sensibly', r.eurGbp==='0.863 GBP to the EUR', r.eurGbp);
  ok('a small rate keeps enough places to be useful', /0\.456789/.test(r.tiny), r.tiny);
  ok('a large rate is not cluttered with decimals', /193\.25/.test(r.big), r.big);

  console.log('\nSame currency both ends — no rate to show');
  await p.evaluate(()=>newTxn()); await p.waitForTimeout(300);
  await p.click('[data-kind="transfer"]'); await p.waitForTimeout(250);
  await p.selectOption('#txAcc',{label:'Barclays (GBP)'}); await p.waitForTimeout(300);
  await p.selectOption('#txAcc2',{label:'Revolut GBP (GBP)'}); await p.waitForTimeout(300);
  ok('no arriving box', !(await p.isVisible('#trIn')));
  ok('and no rate row', !(await p.isVisible('#trRate')));
  await p.fill('#trOut','250');
  await p.evaluate(()=>{window.__writes=[];});
  await p.click('#moneyEdSave'); await p.waitForTimeout(700);
  const l2=(await p.evaluate(()=>window.__writes))
    .filter(x=>x.op==='insert'&&x.table==='transaction_items').pop();
  const rows2=l2&&Array.isArray(l2.rows)?l2.rows:[];
  ok('the wording stays plain when there is no conversion',
     rows2.length===2 && rows2.every(r=>!/ at /.test(r.description)),
     JSON.stringify(rows2.map(r=>r.description)));

  await b.close();
  console.log('\n'+'='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length?errors.length+' page error(s):':'No page errors.');
  [...new Set(errors)].slice(0,8).forEach(e=>console.log('  '+e));
  process.exit(fail||errors.length?1:0);
})();
