// Barry's actual case: a transfer entered by hand on the 22nd, then the
// Barclays statement showing the same £100 leaving on the 23rd.
const { chromium } = require('playwright');
const path=require('path');
const errors=[]; let pass=0,fail=0;
const ok=(w,c,e='')=>{ if(c){pass++;console.log('  ✓ '+w);}else{fail++;console.log('  ✗ '+w+(e?'  <- '+e:''));} };

const CSV=[
 'Date,Description,Amount',
 '23/09/2026,Revolut**8916* ON 22 SEP CPM,-100.00',
 '24/09/2026,UBER *TRIP NETHERLANDS,-8.39',
 '24/09/2026,PENSION BARRY,241.30'
].join('\n');

(async()=>{
  const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errors.push('PAGE ERROR: '+e.message));
  p.on('console',m=>{const t=m.text();
    if(m.type()==='error'&&!/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))errors.push('CONSOLE: '+t);});
  await p.goto('file://'+path.join(__dirname,'boot.html'));
  await p.waitForTimeout(900);

  await p.evaluate(()=>{
    // the hand-entered transfer: Barclays side, 22 Sept
    window.__rows.transactions.push({id:300,account_id:1,tdate:'2026-09-22',
      kind:'transfer',transfer_id:'tx-9',total:-100,business:false,
      reconciled:false,photos:[],payee_id:null,reference:null});
    window.__rows.transaction_items.push({id:300,transaction_id:300,category_id:null,
      description:'To Revolut - Barry at 1.2083 EUR to the pound',qty:1,
      amount:-100,line_total:-100,sort:0});
    // and something far away with the same amount, which must NOT match
    window.__rows.transactions.push({id:301,account_id:1,tdate:'2026-08-01',
      kind:'expense',total:-100,business:false,reconciled:false,photos:[],
      payee_id:null,reference:'OLD THING'});
  });
  await p.evaluate(()=>openMoney()); await p.waitForTimeout(500);
  await p.evaluate(()=>openImport()); await p.waitForTimeout(300);
  await p.evaluate(()=>{IMPORT.acc=1;});
  await p.fill('#impPaste',CSV);
  await p.click('#impRead'); await p.waitForTimeout(400);
  await p.click('#impPreview'); await p.waitForTimeout(900);
  const out=await p.textContent('#impOut');

  console.log('\nThe statement row for a transfer already entered by hand');
  ok('it is spotted even though the dates differ by a day',
     /1 already in your books/.test(out), out.slice(0,120));
  ok('and it says what it matched',
     /To Revolut - Barry/.test(out), out.replace(/\s+/g,' ').slice(0,300));
  ok('and on which date', /on 22 Sept/.test(out.replace(/\s+/g,' ')),
     out.replace(/\s+/g,' ').match(/already here[^<]{0,90}/));
  ok('so only two are ticked', /Import 2 transactions/.test(out), out.slice(-170));
  ok('it explains the date window',
     /rarely agrees with you about the date/.test(out.replace(/\s+/g,' ')));

  console.log('\nThe £100 from seven weeks earlier is left well alone');
  const matched=await p.evaluate(()=>IMPORT.ready.filter(x=>x.dup).map(x=>x.was.id));
  ok('it matched the 22 Sept transfer, not the August one',
     matched.length===1 && matched[0]===300, JSON.stringify(matched));

  console.log('\nTwo genuinely separate payments of the same amount');
  await p.evaluate(()=>{
    window.__rows.transactions.push({id:302,account_id:1,tdate:'2026-09-24',
      kind:'expense',total:-8.39,business:false,reconciled:false,photos:[],
      payee_id:null,reference:'UBER *TRIP NETHERLANDS'});
  });
  await p.fill('#impPaste','Date,Description,Amount\n'+
    '24/09/2026,UBER ONE,-8.39\n25/09/2026,UBER TWO,-8.39\n');
  await p.click('#impRead'); await p.waitForTimeout(300);
  await p.click('#impPreview'); await p.waitForTimeout(900);
  const two=await p.evaluate(()=>IMPORT.ready.map(x=>({d:x.desc,dup:x.dup,
    was:x.was?x.was.id:null})));
  ok('only one of them is claimed by the single existing row',
     two.filter(x=>x.dup).length===1, JSON.stringify(two));
  ok('the other stays ticked, ready to come in',
     two.filter(x=>!x.dup).length===1, JSON.stringify(two));

  console.log('\nAnd a flagged row can still be ticked back on');
  const dupKey=await p.evaluate(()=>(IMPORT.ready.find(x=>x.dup)||{}).key);
  await p.click(`[data-imp="${dupKey.replace(/"/g,'\\"')}"]`);
  await p.waitForTimeout(350);
  ok('ticking it back brings the count up',
     /Import 2 transactions/.test(await p.textContent('#impOut')),
     (await p.textContent('#impOut')).slice(-150));

  console.log('\nIt looks beyond what is on screen');
  ok('the check queried the database rather than the loaded page',
     await p.evaluate(()=>Array.isArray(IMPORT.have)&&IMPORT.have.length>0),
     'IMPORT.have length '+await p.evaluate(()=>(IMPORT.have||[]).length));

  await b.close();
  console.log('\n'+'='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length?errors.length+' page error(s):':'No page errors.');
  [...new Set(errors)].slice(0,8).forEach(e=>console.log('  '+e));
  process.exit(fail||errors.length?1:0);
})();
