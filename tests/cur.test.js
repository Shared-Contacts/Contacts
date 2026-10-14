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
  await p.evaluate(()=>openMoney()); await p.waitForTimeout(500);
  await p.evaluate(()=>openSettings('Finances')); await p.waitForTimeout(700);

  console.log('\nThere is now somewhere to add one');
  const txt=await p.textContent('#setBody');
  ok('a Currencies card appears under Finances', /CURRENCIES|Currencies/i.test(txt));
  await p.evaluate(()=>{
    const d=[...document.querySelectorAll('#setBody details')]
      .find(x=>/currencies/i.test(x.querySelector('summary').textContent));
    if(d) d.open=true;
  });
  await p.waitForTimeout(300);
  ok('the four it came with are listed',
     (await p.$$('[data-curfield$=":name"]')).length===4,
     (await p.$$('[data-curfield$=":name"]')).length+' (stub has GBP, NZD, USD, EUR)');
  ok('there are boxes to add a new one',
     await p.isVisible('[data-curnew="code"]') &&
     await p.isVisible('[data-curnew="name"]') &&
     await p.isVisible('[data-curnew="symbol"]'));

  console.log('\nAdding Hong Kong dollars');
  await p.fill('[data-curnew="code"]','hkd');
  await p.fill('[data-curnew="name"]','Hong Kong dollar');
  await p.fill('[data-curnew="symbol"]','$');
  await p.evaluate(()=>{window.__writes=[];});
  await p.click('[data-curadd]');
  await p.waitForTimeout(600);
  const w=(await p.evaluate(()=>window.__writes))
    .find(x=>x.op==='insert'&&x.table==='currencies');
  ok('it was saved', !!w, JSON.stringify(await p.evaluate(()=>window.__writes)));
  ok('the code was put into capitals', w && w.rows.code==='HKD', w&&w.rows.code);
  ok('with its name and sign', w && w.rows.name==='Hong Kong dollar' && w.rows.symbol==='$');

  console.log('\nIt will not take a bad code');
  await p.evaluate(()=>openSettings('Finances')); await p.waitForTimeout(600);
  await p.evaluate(()=>{
    const d=[...document.querySelectorAll('#setBody details')]
      .find(x=>/currencies/i.test(x.querySelector('summary').textContent));
    if(d) d.open=true;
  });
  await p.waitForTimeout(250);
  await p.fill('[data-curnew="code"]','HK');
  await p.evaluate(()=>{window.__writes=[];});
  await p.click('[data-curadd]');
  await p.waitForTimeout(400);
  ok('two letters is refused', (await p.evaluate(()=>window.__writes))
     .filter(x=>x.table==='currencies').length===0);
  ok('and it says why', /Three letters/.test(await p.textContent('#toasts')||''),
     await p.textContent('#toasts').catch(()=>''));
  await p.fill('[data-curnew="code"]','GBP');
  await p.evaluate(()=>{window.__writes=[];});
  await p.click('[data-curadd]');
  await p.waitForTimeout(400);
  ok('a duplicate is refused', (await p.evaluate(()=>window.__writes))
     .filter(x=>x.table==='currencies').length===0);

  console.log('\nA currency in use cannot be removed by accident');
  const inUse=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('[data-curfield$=":name"]')]
      .map(e=>e.dataset.curfield.split(':')[0]);
    return rows.map(code=>({code,
      canDrop: !!document.querySelector(`[data-curdrop="${code}"]`)}));
  });
  ok('GBP has accounts, so no remove button',
     inUse.find(x=>x.code==='GBP') && !inUse.find(x=>x.code==='GBP').canDrop,
     JSON.stringify(inUse));
  ok('an unused one can be removed',
     inUse.some(x=>x.canDrop), JSON.stringify(inUse));

  console.log('\nAnd a new currency is then offered everywhere');
  await p.evaluate(()=>{
    window.__rows.currencies.push({code:'HKD',name:'Hong Kong dollar',symbol:'$',sort:40});
  });
  await p.evaluate(()=>loadMoney()); await p.waitForTimeout(400);
  await p.evaluate(()=>{$('settings').classList.add('hidden'); openSettings('Finances');});
  await p.waitForTimeout(600);
  await p.evaluate(()=>{
    const d=[...document.querySelectorAll('#setBody details')]
      .find(x=>/accounts/i.test(x.querySelector('summary').textContent));
    if(d) d.open=true;
  });
  await p.waitForTimeout(300);
  ok('an account can now be set to HKD', await p.evaluate(()=>{
    const s=document.querySelector('[data-afield$=":currency"]');
    return s ? [...s.options].some(o=>o.value==='HKD') : false;
  }));
  ok('and money shows with its sign',
     (await p.evaluate(()=>money(1234.5,'HKD')))==='$1,234.50',
     await p.evaluate(()=>money(1234.5,'HKD')));

  await p.screenshot({path:path.join(__dirname,'cur.png')});
  await b.close();
  console.log('\n'+'='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length?errors.length+' page error(s):':'No page errors.');
  [...new Set(errors)].slice(0,8).forEach(e=>console.log('  '+e));
  process.exit(fail||errors.length?1:0);
})();
