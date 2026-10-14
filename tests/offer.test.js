// The offer a new user gets, and that it only ever asks once.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (w, c, e='') => {
  if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); }
};
const PAGE = 'file://' + path.join(__dirname, 'boot.html');

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';

async function fresh(b, ua) {
  const ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent:ua });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t=m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });
  await p.goto(PAGE);
  await p.waitForTimeout(900);
  // the sharing notice has its say first; answer it so the offer comes up
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(350); }
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });

  console.log('\nA brand new user on an Android');
  let { ctx, p } = await fresh(b, ANDROID);
  ok('the offer is there on the home screen',
     /quick-add app as well/.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')),
     ((await p.textContent('#homeBody')).replace(/\s+/g,' ')).replace(/\s+/g,' ').slice(0,100));
  ok('it says what it is for in plain terms',
     /boat name on its own is enough/.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  ok('there is a Yes and a No', await p.isVisible('#jotYes') && await p.isVisible('#jotNo'));
  ok('no steps until they say yes', !/three dots/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));

  console.log('\nSaying yes gives Android steps, not iPhone ones');
  await p.click('#jotYes'); await p.waitForTimeout(400);
  const andr = (await p.textContent('#homeBody')).replace(/\s+/g,' ');
  ok('it names the three dots', /three dots/i.test(andr));
  ok('and Add to Home screen', /Add to Home screen/i.test(andr));
  ok('it does not mention Safari', !/Safari/i.test(andr));
  ok('there is a button straight to it', await p.isVisible('#jotOpen'));
  await p.click('#jotDone'); await p.waitForTimeout(400);
  ok('once done it goes away',
     !/quick-add app|three dots/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await p.reload(); await p.waitForTimeout(900);
  ok('and stays away after a reload',
     !/quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await ctx.close();

  console.log('\nAn iPhone gets the Safari steps instead');
  ({ ctx, p } = await fresh(b, IPHONE_SAFARI));
  await p.click('#jotYes'); await p.waitForTimeout(400);
  const ios = (await p.textContent('#homeBody')).replace(/\s+/g,' ');
  ok('it names the Share button', /Share/.test(ios));
  ok('and Add to Home Screen', /Add to Home Screen/i.test(ios));
  ok('it does not mention three dots', !/three dots/i.test(ios));
  ok('no warning needed, they are already in Safari',
     !/only Safari can/i.test(ios), ios.replace(/\s+/g,' ').slice(0,200));
  await ctx.close();

  console.log('\nAn iPhone in Chrome is told to switch to Safari first');
  ({ ctx, p } = await fresh(b, IPHONE_CHROME));
  await p.click('#jotYes'); await p.waitForTimeout(400);
  ok('it warns them', /only Safari can/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')),
     ((await p.textContent('#homeBody')).replace(/\s+/g,' ')).replace(/\s+/g,' ').slice(0,200));
  await ctx.close();

  console.log('\nSaying no means no');
  ({ ctx, p } = await fresh(b, ANDROID));
  await p.click('#jotNo'); await p.waitForTimeout(400);
  ok('it goes', !/quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  ok('and says where to find it again',
     /under Help/i.test(await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' ')).catch(()=>'')),
     await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' ')).catch(()=>'(none)'));
  await p.reload(); await p.waitForTimeout(900);
  ok('it does not come back', !/quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await ctx.close();

  console.log('\nThe cross just closes it, same as no');
  ({ ctx, p } = await fresh(b, ANDROID));
  await p.click('#jotX'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(900);
  ok('still gone after a reload', !/quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await ctx.close();

  console.log('\nSomebody who already has it is never asked');
  ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent:ANDROID });
  await ctx.addInitScript(() => {
    try{ localStorage.setItem('jot-installed','1'); }catch(e){}
  });
  p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  await p.goto(PAGE); await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(350); }
  ok('no offer at all', !/quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await ctx.close();

  console.log('\nThe Jotter is what sets that flag');
  ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent:ANDROID });
  p = await ctx.newPage();
  // pretend it is running as an installed app
  await p.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = q => /display-mode: standalone/.test(q)
      ? { matches:true, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }
      : real(q);
  });
  await p.goto('file://' + path.join(__dirname, 'jotboot.html'));
  await p.waitForTimeout(800);
  ok('opening the Jotter as an app records it',
     (await p.evaluate(() => localStorage.getItem('jot-installed'))) === '1',
     String(await p.evaluate(() => localStorage.getItem('jot-installed'))));
  ok('and it is stored plainly, as the main app reads it',
     (await p.evaluate(() => localStorage.getItem('jot-installed'))) === '1');
  await ctx.close();

  console.log('\nIn a browser tab it records nothing');
  ({ ctx, p } = await (async () => {
    const c = await b.newContext({ viewport:{width:390,height:844}, userAgent:ANDROID });
    const pg = await c.newPage();
    await pg.goto('file://' + path.join(__dirname, 'jotboot.html'));
    await pg.waitForTimeout(800);
    return { ctx:c, p:pg };
  })());
  ok('nothing set when it is only a tab',
     (await p.evaluate(() => localStorage.getItem('jot-installed'))) === null);
  await ctx.close();

  console.log('\nIt stays out of the way while rearranging tiles');
  ({ ctx, p } = await fresh(b, ANDROID));
  await p.evaluate(() => { ARRANGING = true; renderHome(); });
  await p.waitForTimeout(300);
  ok('no offer in arrange mode', !/quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await p.evaluate(() => { ARRANGING = false; renderHome(); });
  await p.waitForTimeout(300);
  ok('back when you finish', /quick-add app/i.test((await p.textContent('#homeBody')).replace(/\s+/g,' ')));
  await p.screenshot({ path: path.join(__dirname,'offer.png') });
  await p.click('#jotYes'); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname,'offer-steps.png') });
  await ctx.close();

  await b.close();
  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
