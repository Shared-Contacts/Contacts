// Screens keep your place when they redraw, changing a transaction from the
// reconcile screen, and the two-line greeting (asked for 26 Oct 2026).
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

  // Enough accounts and transactions that the screens have to scroll.
  await p.evaluate(()=>{
    for(let i=0;i<10;i++) window.__rows.accounts.push({id:20+i,name:'Spare '+i,
      kind:'savings',currency:'GBP',opening_balance:0,opening_date:'2026-01-01',
      active:true,sort:100+i*10,created_by:'me'});
    const T=window.__rows.transactions,I=window.__rows.transaction_items;
    for(let i=0;i<30;i++){
      const id=700+i;
      T.push({id,account_id:1,tdate:'2026-02-'+String((i%27)+1).padStart(2,'0'),
        kind:'expense',pay_method:'debit card',total:-(5+i),business:false,
        reconciled:false,photos:[],payee_id:null,reference:'SHOP '+i});
      I.push({id:id+900,transaction_id:id,category_id:1,description:'SHOP '+i,
        qty:1,amount:-(5+i),line_total:-(5+i),sort:0});
    }
  });

  console.log('\nMoving an account in Settings keeps your place');
  await p.evaluate(async()=>{
    SET_OPEN.finAccounts=true; SET_OPEN.Finances=true;
    await loadMoney(); await openSettings('Finances');
  });
  await p.waitForTimeout(500);
  await p.evaluate(()=>{ document.querySelectorAll('#setBody [data-setcard]')
    .forEach(d=>{ if(d.querySelector('[data-amv]')) d.open=true; }); });
  await p.waitForTimeout(200);
  const btn='#setBody [data-amv="25:down"]';
  await p.$eval(btn, e=>e.scrollIntoView({block:'center'}));
  await p.waitForTimeout(200);
  const before=await p.evaluate(()=>{ window.__writes=[]; return $('setBody').scrollTop; });
  await p.click(btn); await p.waitForTimeout(800);
  const after=await p.evaluate(()=>$('setBody').scrollTop);
  ok('the screen was scrolled down to start with', before>300, String(before));
  ok('it stays where it was', Math.abs(after-before)<5, before+' -> '+after);
  // The stand-in database only records writes, so look at what was written.
  ok('the account was moved down', await p.evaluate(()=>{
     const w=window.__writes.filter(x=>x.op==='update'&&x.table==='accounts');
     const at=id=>{ const x=w.find(x=>x.where.some(c=>c[1]==="id"&&String(c[2])===String(id)));
       return x?x.patch.sort:null; };
     return at(25)!==null && at(25)>at(26); }));

  console.log('\nOpening Settings fresh still starts at the top');
  await p.evaluate(()=>{ $('settings').classList.add('hidden'); return openSettings(); });
  await p.waitForTimeout(400);
  ok('a fresh open is at the top', await p.evaluate(()=>$('setBody').scrollTop)===0);
  await p.evaluate(()=>{ $('settings').classList.add('hidden'); lockBackground(); });

  console.log('\nSaving a transaction keeps your place in Finances');
  await p.evaluate(()=>openMoney()); await p.waitForTimeout(600);
  await p.$eval('#moneyBody [data-tx="705"]', e=>e.scrollIntoView({block:'center'}));
  const mBefore=await p.evaluate(()=>$('moneyBody').scrollTop);
  await p.click('#moneyBody [data-tx="705"]'); await p.waitForTimeout(500);
  await p.click('#moneyEdSave'); await p.waitForTimeout(900);
  const mAfter=await p.evaluate(()=>$('moneyBody').scrollTop);
  ok('Finances was scrolled down', mBefore>300, String(mBefore));
  ok('and is still there after saving', Math.abs(mAfter-mBefore)<5, mBefore+' -> '+mAfter);

  console.log('\nShow more transactions goes back to hidden when the account changes');
  await p.click('#moreTxns'); await p.waitForTimeout(400);
  ok('pressing it shows the reconciled ones', await p.evaluate(()=>MONEY_REC===true));
  await p.evaluate(()=>{ $('moneyBody').querySelector('[data-acc="2"]').click(); });
  await p.waitForTimeout(500);
  ok('choosing another account hides them again', await p.evaluate(()=>MONEY_REC===false));
  await p.evaluate(()=>{ $('moneyBody').querySelector('[data-acc="1"]').click(); });
  await p.waitForTimeout(500);

  console.log('\nChanging a transaction from the reconcile screen');
  await p.evaluate(()=>openRecon(1)); await p.waitForTimeout(700);
  ok('each row has a pencil', (await p.$$('#reconBody [data-rtx]')).length>0);
  await p.click('#reconBody [data-rt="702"]'); await p.waitForTimeout(200);
  ok('tapping the row still ticks it', await p.evaluate(()=>RECON.tick[702]===true));
  await p.$eval('#reconBody [data-rtx="720"]', e=>e.scrollIntoView({block:'center'}));
  const rBefore=await p.evaluate(()=>$('reconBody').scrollTop);
  await p.click('#reconBody [data-rtx="720"]'); await p.waitForTimeout(600);
  ok('the pencil opens the transaction', await p.isVisible('#moneyEd'));
  ok('it is the right one', await p.evaluate(()=>TX&&TX.id===720));
  ok('without ticking it', await p.evaluate(()=>!RECON.tick[720]));
  ok('its line came with it', await p.evaluate(()=>TXL.length===1&&TXL[0].description==='SHOP 20'),
     await p.evaluate(()=>JSON.stringify(TXL)));
  await p.evaluate(()=>{ window.__writes=[]; });
  await p.click('#moneyEdSave'); await p.waitForTimeout(1000);
  ok('it saved', (await p.evaluate(()=>window.__writes))
     .some(w=>w.table==='transactions'&&w.op==='update'));
  ok('the editor closed', !(await p.isVisible('#moneyEd')));
  ok('you are back on the reconcile screen', await p.isVisible('#recon'));
  ok('what you had ticked is still ticked', await p.evaluate(()=>RECON.tick[702]===true));
  const rAfter=await p.evaluate(()=>$('reconBody').scrollTop);
  ok('and you are where you were', Math.abs(rAfter-rBefore)<5, rBefore+' -> '+rAfter);
  await p.evaluate(()=>{ $('recon').classList.add('hidden'); $('money').classList.add('hidden'); lockBackground(); });

  console.log('\nThe greeting on the Today screen');
  await p.evaluate(()=>openBrief()); await p.waitForTimeout(600);
  const g=await p.evaluate(()=>{ const h=$('briefHello');
    return { text:h.innerText, lines:Math.round(h.getBoundingClientRect().height
      / parseFloat(getComputedStyle(h).lineHeight||'24')) }; });
  const parts=g.text.split('\n');
  ok('the time is on the top line', /^Good (morning|afternoon|evening) it's now \d{1,2}:\d\d [AP]M$/.test(parts[0]), g.text);
  ok('the date with the year is on the second',
     /^[A-Z][a-z]+day \d{1,2}(st|nd|rd|th) [A-Z][a-z]+ \d{4}$/.test(parts[1]||''), g.text);

  console.log('\nNo errors anywhere');
  ok('no page errors', errors.length===0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
