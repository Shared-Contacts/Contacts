// Choosing several transactions and getting rid of them together.
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
  p.on('dialog',d=>d.accept());
  await p.goto('file://'+path.join(__dirname,'boot.html'));
  await p.waitForTimeout(900);

  await p.evaluate(()=>{
    window.__rows.accounts.push({id:9,name:'Barclays Business',kind:'current',
      currency:'GBP',opening_balance:0,opening_date:'2026-01-01',active:true,sort:60});
    const T=window.__rows.transactions,I=window.__rows.transaction_items;
    for(let i=0;i<12;i++){
      const id=600+i;
      T.push({id,account_id:9,tdate:'2026-10-0'+((i%9)+1),kind:'expense',
        total:-(10+i),business:true,reconciled:false,photos:[],payee_id:null,
        reference:'BUSINESS THING '+i});
      I.push({id:id+900,transaction_id:id,category_id:null,
        description:'BUSINESS THING '+i,qty:1,amount:-(10+i),line_total:-(10+i),sort:0});
    }
  });
  await p.evaluate(()=>openMoney()); await p.waitForTimeout(600);

  console.log('\nGoing into choosing mode');
  await p.evaluate(() => { const d = document.querySelector('#moneyJobs'); if (d) d.open = true; });
  await p.waitForTimeout(150);  await p.click('#goMoneyPick'); await p.waitForTimeout(400);
  ok('the bar appears', await p.isVisible('#moneyPickBar'));
  ok('tick boxes appear on the rows', (await p.$$('#moneyBody .txn .tick')).length>0);
  ok('the + button steps aside', !(await p.isVisible('#moneyAdd')));
  ok('Delete is off until something is chosen',
     await p.evaluate(()=>$('mpDel').disabled));

  console.log('\nTapping a row chooses it instead of opening it');
  await p.click('#moneyBody [data-tx="600"]'); await p.waitForTimeout(300);
  ok('the editor did not open', !(await p.isVisible('#moneyEd')));
  ok('one is chosen', /1 chosen/.test(await p.textContent('#moneyPickBar')),
     await p.textContent('#moneyPickBar'));
  await p.click('#moneyBody [data-tx="601"]'); await p.waitForTimeout(300);
  ok('two are chosen', /2 chosen/.test(await p.textContent('#moneyPickBar')));
  await p.click('#moneyBody [data-tx="601"]'); await p.waitForTimeout(300);
  ok('tapping again lets it go', /1 chosen/.test(await p.textContent('#moneyPickBar')));

  console.log('\nFiltering to the business account, then taking the lot');
  await p.click('#moneyBody [data-acc="9"]'); await p.waitForTimeout(500);
  ok('the bar says which view you are selecting within',
     /showing Barclays Business/.test(await p.textContent('#moneyPickBar')),
     (await p.textContent('#moneyPickBar')).replace(/\s+/g,' '));
  ok('the buttons have room of their own', await p.evaluate(()=>{
     const w=document.querySelector('.mpwho').getBoundingClientRect();
     const btn=document.querySelector('.mpbtns').getBoundingClientRect();
     return btn.top >= w.bottom - 1 && btn.right <= window.innerWidth + 1;
  }));
  await p.click('#mpAll'); await p.waitForTimeout(700);
  const n=await p.evaluate(()=>MONEY_PICKED.size);
  ok('every one of the twelve is chosen, not just the loaded page',
     n>=12, n+' chosen');
  ok('and only that account', await p.evaluate(()=>{
     const ids=[...MONEY_PICKED];
     return ids.every(id=>id>=600&&id<=611);
  }), JSON.stringify(await p.evaluate(()=>[...MONEY_PICKED].slice(0,20))));

  console.log('\nTapping All again lets them all go');
  await p.click('#mpAll'); await p.waitForTimeout(600);
  ok('back to none chosen', (await p.evaluate(()=>MONEY_PICKED.size))===0);

  console.log('\nDeleting');
  await p.click('#mpAll'); await p.waitForTimeout(700);
  await p.evaluate(()=>{window.__writes=[];});
  await p.click('#mpDel'); await p.waitForTimeout(1200);
  const dels=(await p.evaluate(()=>window.__writes))
    .filter(x=>x.op==='delete'&&x.table==='transactions');
  ok('it deleted them', dels.length>0, JSON.stringify(dels.length));
  ok('choosing mode ended afterwards', await p.evaluate(()=>MONEY_PICKING===false));
  ok('the bar went away', !(await p.isVisible('#moneyPickBar')));

  console.log('\nLeaving choosing mode by hand');
  await p.click('#moneyBody [data-acc="all"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { const d = document.querySelector('#moneyJobs'); if (d) d.open = true; });
  await p.waitForTimeout(150);  await p.click('#goMoneyPick'); await p.waitForTimeout(400);
  await p.click('#moneyBody [data-tx="1"]'); await p.waitForTimeout(250);
  await p.click('#mpStop'); await p.waitForTimeout(350);
  ok('the bar goes', !(await p.isVisible('#moneyPickBar')));
  ok('nothing stays chosen', (await p.evaluate(()=>MONEY_PICKED.size))===0);
  ok('tapping a row opens it again', await (async()=>{
     await p.click('#moneyBody [data-tx="1"]'); await p.waitForTimeout(400);
     return p.isVisible('#moneyEd');
  })());

  console.log('\nAnd it does not follow you off the screen');
  await p.evaluate(()=>{$('moneyEd').classList.add('hidden');});
  await p.evaluate(() => { const d = document.querySelector('#moneyJobs'); if (d) d.open = true; });
  await p.waitForTimeout(150);  await p.click('#goMoneyPick'); await p.waitForTimeout(350);
  await p.click('#moneyMenu');
  await p.waitForTimeout(300);
  await p.click('[data-mgo="home"]'); await p.waitForTimeout(350);
  ok('leaving Finances clears it', !(await p.isVisible('#moneyPickBar')));
  ok('and choosing mode is off', await p.evaluate(()=>MONEY_PICKING===false));

  await p.evaluate(()=>{openMoney();}); await p.waitForTimeout(600);
  await p.evaluate(() => { const d = document.querySelector('#moneyJobs'); if (d) d.open = true; });
  await p.waitForTimeout(150);  await p.click('#goMoneyPick'); await p.waitForTimeout(300);
  await p.click('#moneyBody [data-tx="1"]'); await p.waitForTimeout(250);
  await p.screenshot({path:path.join(__dirname,'pick.png')});
  await b.close();
  console.log('\n'+'='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length?errors.length+' page error(s):':'No page errors.');
  [...new Set(errors)].slice(0,8).forEach(e=>console.log('  '+e));
  process.exit(fail||errors.length?1:0);
})();
