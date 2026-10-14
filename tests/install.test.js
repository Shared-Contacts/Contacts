// Getting it onto the home screen, whatever the browser calls the button.
const { chromium } = require('playwright');
const path=require('path');
const errors=[]; let pass=0,fail=0;
const ok=(w,c,e='')=>{ if(c){pass++;console.log('  ✓ '+w);}else{fail++;console.log('  ✗ '+w+(e?'  <- '+e:''));} };
const JOT='file://'+path.join(__dirname,'jotboot.html');
const ANDROID='Mozilla/5.0 (Linux; Android 14; CPH2451) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

async function open(b,ua,init){
  const ctx=await b.newContext({viewport:{width:390,height:844},userAgent:ua});
  if(init) await ctx.addInitScript(init);
  const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push('PAGE ERROR: '+e.message));
  p.on('console',m=>{const t=m.text();
    if(m.type()==='error'&&!/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|Failed to fetch/i.test(t))errors.push('CONSOLE: '+t);});
  await p.goto(JOT); await p.waitForTimeout(800);
  return {ctx,p};
}

(async()=>{
  const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});

  console.log('\nWhen Chrome offers to install it');
  let {ctx,p}=await open(b,ANDROID);
  await p.evaluate(()=>{
    const e=new Event('beforeinstallprompt');
    e.prompt=()=>{ window.__prompted=true; };
    e.userChoice=Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(e);
  });
  await p.waitForTimeout(300);
  ok('a proper Install button appears', await p.isVisible('#doInstall'));
  ok('no menu-hunting instructions alongside it',
     !/three dots/i.test(await p.textContent('#install')),
     (await p.textContent('#install')).replace(/\s+/g,' ').slice(0,120));
  await p.click('#doInstall'); await p.waitForTimeout(400);
  ok('tapping it asks the browser to do the job',
     await p.evaluate(()=>window.__prompted===true));
  await ctx.close();

  console.log('\nWhen it does not offer — an Android');
  ({ctx,p}=await open(b,ANDROID));
  const andr=await p.textContent('#install');
  ok('it names every wording Chrome uses',
     /Install app/.test(andr) && /Install and create shortcut/.test(andr)
     && /Add to Home screen/.test(andr), andr.replace(/\s+/g,' ').slice(0,260));
  ok('it explains what "already installed" really means',
     /about the main app, not this one/i.test(andr.replace(/\s+/g,' ')));
  ok('and points at Create shortcut, which does work',
     /Create shortcut/.test(andr));
  ok('and says what that costs you',
     /browser bar/i.test(andr.replace(/\s+/g,' ')));
  await p.click('#noInstall'); await p.waitForTimeout(300);
  ok('it can be hidden', (await p.textContent('#install')).trim()==='');
  await p.reload(); await p.waitForTimeout(800);
  ok('and stays hidden', (await p.textContent('#install')).trim()==='');
  await ctx.close();

  console.log('\nAn iPhone gets the Safari route');
  ({ctx,p}=await open(b,IPHONE));
  const ios=await p.textContent('#install');
  ok('it names the Share button', /Share/.test(ios));
  ok('and Add to Home Screen', /Add to Home Screen/i.test(ios));
  ok('it does not mention three dots', !/three dots/i.test(ios));
  await ctx.close();

  console.log('\nAlready running as an installed app');
  ({ctx,p}=await open(b,ANDROID,()=>{
    const real=window.matchMedia.bind(window);
    window.matchMedia=q=>/display-mode: standalone/.test(q)
      ?{matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}
      :real(q);
  }));
  ok('nothing is offered, it is already there',
     (await p.textContent('#install')).trim()==='');
  ok('and it records that for the main app',
     (await p.evaluate(()=>localStorage.getItem('jot-installed')))==='1');
  await ctx.close();

  console.log('\nWhen the browser says it has been installed');
  ({ctx,p}=await open(b,ANDROID));
  await p.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await p.waitForTimeout(400);
  ok('the flag is set', (await p.evaluate(()=>localStorage.getItem('jot-installed')))==='1');
  ok('and it says so', /home screen now/i.test(
     await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' ')).catch(()=>'')),
     await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' ')).catch(()=>'(none)'));
  await p.screenshot({path:path.join(__dirname,'install.png')});
  await ctx.close();

  await b.close();
  console.log('\n'+'='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length?errors.length+' page error(s):':'No page errors.');
  [...new Set(errors)].slice(0,8).forEach(e=>console.log('  '+e));
  process.exit(fail||errors.length?1:0);
})();
