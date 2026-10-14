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

  console.log('\nStartup order — which screen appears first');
  const seen=[];
  await p.exposeFunction('__note',s=>seen.push(s));
  await p.addInitScript(()=>{
    const look=()=>{
      const app=document.getElementById('app'), home=document.getElementById('home');
      if(!app||!home) return;
      const a=!app.classList.contains('hidden'), h=!home.classList.contains('hidden');
      if(a&&!h) window.__note('contacts alone');
      if(h) window.__note('home');
    };
    const t=setInterval(look,15); setTimeout(()=>clearInterval(t),2500);
  });
  await p.goto('file://'+path.join(__dirname,'boot.html'));
  await p.waitForTimeout(2000);
  const firstContactsAlone=seen.indexOf('contacts alone');
  const firstHome=seen.indexOf('home');
  ok('the home screen is up before the contacts list is ever revealed',
     firstHome>=0 && (firstContactsAlone===-1 || firstHome<firstContactsAlone),
     'home at '+firstHome+', contacts-alone at '+firstContactsAlone);
  ok('the contacts list never shows on its own at startup',
     firstContactsAlone===-1, seen.slice(0,6).join(' -> '));

  console.log('\nIcons beside each way of reaching somebody');
  await p.evaluate(()=>{
    const c=CONTACTS.find(x=>x.id===1);
    c.phones=[{label:'Mobile',value:'07456 001553'},{label:'Office',value:'0121 496 0000'}];
    c.emails=[{label:'Personal',value:'s@hotmail.com'},{label:'Work',value:'s@sandbar.co.uk'}];
    c.websites=[{label:'Website',value:'barryandsandra.com'}];
    c.socials=[{label:'Facebook',value:'sandra'},{label:'WhatsApp',value:'07456001553'}];
    openDetail(1);
  });
  await p.waitForTimeout(600);
  const marks=await p.$$eval('#detail .tmark',els=>els.length);
  ok('every row has its mark', marks===7, marks+' marks for 7 rows');
  ok('the mobile offers a text alongside the call',
     await p.evaluate(()=>{
       const a=[...document.querySelectorAll('#detail .alsoway')];
       return a.length===1 && a[0].getAttribute('href')==='sms:07456001553';
     }), await p.evaluate(()=>[...document.querySelectorAll('#detail .alsoway')]
        .map(a=>a.getAttribute('href')).join(',')));
  ok('the office landline gets no text offer',
     await p.evaluate(()=>document.querySelectorAll('#detail .alsoway').length===1));
  ok('the phone number still dials', await p.evaluate(()=>
     !!document.querySelector('#detail a[href="tel:07456001553"]')));
  ok('email still opens mail', await p.evaluate(()=>
     !!document.querySelector('#detail a[href="mailto:s@hotmail.com"]')));
  ok('Facebook shows as a lettered circle', await p.evaluate(()=>
     [...document.querySelectorAll('#detail .tmark .initial')].some(e=>e.textContent==='F')));
  ok('WhatsApp gets the bubble, not a letter', await p.evaluate(()=>
     !!document.querySelector('#detail a[href*="wa.me"]')));
  ok('nothing spills off the side', await p.evaluate(()=>
     document.documentElement.scrollWidth<=window.innerWidth+1));
  await p.screenshot({path:path.join(__dirname,'detail.png')});
  await b.close();
  console.log('\n'+'='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length?errors.length+' page error(s):':'No page errors.');
  [...new Set(errors)].slice(0,8).forEach(e=>console.log('  '+e));
  process.exit(fail||errors.length?1:0);
})();
