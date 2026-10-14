// The four things from Barry's last message.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 },
    permissions:['geolocation'], geolocation:{ latitude:52.48, longitude:-1.90 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);

  // ---------------------------------------------------------------
  console.log('\n1. Typing over an amount');
  await p.evaluate(() => openMoney());
  await p.waitForTimeout(500);
  await p.click('#moneyBody [data-tx="1"]');          // Tesco, 42.50
  await p.waitForTimeout(400);
  await p.click('[data-la="0"]');
  await p.waitForTimeout(150);
  const sel = await p.evaluate(() => {
    const e = document.querySelector('[data-la="0"]');
    return { start:e.selectionStart, end:e.selectionEnd, val:e.value };
  });
  ok('tapping the amount selects what is there',
     sel.start === 0 && sel.end === sel.val.length, JSON.stringify(sel));
  await p.keyboard.type('9');
  await p.waitForTimeout(150);
  ok('typing replaces it rather than appending',
     (await p.inputValue('[data-la="0"]')) === '9',
     'got ' + await p.inputValue('[data-la="0"]'));
  ok('the total followed', /−£9\.00/.test(await p.textContent('#txTotal')),
     await p.textContent('#txTotal'));
  await p.click('#moneyEdCancel');
  await p.waitForTimeout(200);

  // ---------------------------------------------------------------
  console.log('\n2. The red banner shows on every screen, not just Contacts');
  await p.evaluate(() => {
    SHARE_UNTIL = new Date(Date.now() + 3600e3);
    SHARED_WITH = ['sandra'];
    paintShareBar();
  });
  await p.waitForTimeout(200);
  ok('the banner is no longer buried inside the contacts list',
     await p.evaluate(() => !document.getElementById('app')
        .contains(document.getElementById('shareBar'))));
  ok('it is visible on the contacts screen', await p.isVisible('#shareBar'));

  const seenOn = {};
  for (const [name, fn] of [['home', () => showHome()],
                            ['daily log', () => openLog()],
                            ['finances', () => openMoney()],
                            ['settings', () => openSettings()]]) {
    await p.evaluate(fn);
    await p.waitForTimeout(400);
    seenOn[name] = await p.evaluate(() => {
      const e = document.getElementById('shareBar');
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      // is anything painted on top of it?
      const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return !!(hit && e.contains(hit));
    });
  }
  ok('and on the home screen', seenOn['home'] === true);
  ok('and on the daily log', seenOn['daily log'] === true);
  ok('and on Finances', seenOn['finances'] === true);
  ok('and on Settings', seenOn['settings'] === true);
  ok('nothing can hide underneath it', await p.evaluate(() =>
     document.body.classList.contains('sharing')));
  await p.evaluate(() => { $('settings').classList.add('hidden'); });

  console.log('   and it goes away when sharing stops');
  await p.evaluate(() => { SHARE_UNTIL = null; paintShareBar(); });
  await p.waitForTimeout(200);
  ok('hidden again', !(await p.isVisible('#shareBar')));
  ok('and the extra padding goes with it', await p.evaluate(() =>
     !document.body.classList.contains('sharing')));

  // ---------------------------------------------------------------
  console.log('\n3. A shared position that actually moves');
  // The banner test toured every screen; shut them all so nothing intercepts taps.
  await p.evaluate(() => document.querySelectorAll('.sheet')
    .forEach(s => s.classList.add('hidden')));
  await p.evaluate(() => {
    window.__rows.live_locations = [{ user_id:'sandra', lat:52.48, lng:-1.90,
      accuracy:10, label:'Sandra', updated_at:new Date().toISOString(),
      until:new Date(Date.now()+3600e3).toISOString() }];
  });
  await p.evaluate(() => openWhere());
  await p.waitForTimeout(600);
  ok('her position is shown', /Sandra/.test(await p.textContent('#whereBody')));
  ok('the screen is now watching for changes', await p.evaluate(() => WHERE_POLL !== null));

  const firstPin = await p.evaluate(() => OTHERS[0].lat);
  await p.evaluate(() => {           // she moves a mile up the cut
    window.__rows.live_locations[0].lat = 52.52;
    window.__rows.live_locations[0].updated_at = new Date().toISOString();
  });
  await p.evaluate(() => refreshOthers());
  await p.waitForTimeout(500);
  ok('the pin follows her without closing the app',
     (await p.evaluate(() => OTHERS[0].lat)) !== firstPin,
     'was ' + firstPin + ', now ' + await p.evaluate(() => OTHERS[0].lat));

  console.log('   it only redraws when somebody has actually moved');
  await p.evaluate(() => { window.__redraws = 0;
    window.__realRender = renderWhere;
    window.renderWhere = function(){ window.__redraws++; return window.__realRender(); }; });
  await p.evaluate(() => refreshOthers());
  await p.waitForTimeout(300);
  ok('nothing moved, so nothing was redrawn',
     (await p.evaluate(() => window.__redraws)) === 0,
     await p.evaluate(() => window.__redraws) + ' redraws');
  await p.evaluate(() => { window.__rows.live_locations[0].lng = -1.80; });
  await p.evaluate(() => refreshOthers());
  await p.waitForTimeout(300);
  ok('she moved, so it redrew', (await p.evaluate(() => window.__redraws)) === 1);
  await p.evaluate(() => { window.renderWhere = window.__realRender; });

  console.log('   and it stops asking once you leave the screen');
  await p.click('#whereMenu');
  await p.waitForTimeout(300);
  await p.click('[data-mgo="home"]');
  await p.waitForTimeout(300);
  ok('the watching stops', await p.evaluate(() => WHERE_POLL === null));

  // ---------------------------------------------------------------
  console.log('\n4. Ways to reach somebody, in the list');
  await p.evaluate(() => {
    const c = CONTACTS.find(x => x.id === 1);
    c.phones  = [{label:'Mobile', value:'07700 900123'}];
    c.emails  = [{label:'Home',   value:'dickie@example.com'}];
    c.socials = [{label:'Facebook', value:'dickie.deal'},
                 {label:'WhatsApp', value:'07700 900123'}];
    c.websites= [{label:'Site', value:'dickiedeal.co.uk'}];
    const s = CONTACTS.find(x => x.id === 2);
    s.phones = []; s.emails = []; s.socials = []; s.websites = [];
    VIEW = 'az'; applyView();        // a flat list, so every contact has a row
    render();
  });
  await p.waitForTimeout(400);

  const ways = await p.$$eval('ul.list li .way',
    els => els.map(e => ({ label:e.getAttribute('aria-label'), href:e.getAttribute('href') })));
  ok('icons appear for the contact who has them', ways.length > 0, JSON.stringify(ways));
  ok('a phone icon dials', ways.some(w => /^Call/.test(w.label) && w.href === 'tel:07700900123'),
     JSON.stringify(ways));
  ok('WhatsApp uses the WhatsApp account, not a plain text',
     ways.some(w => w.label === 'WhatsApp' && /wa\.me/.test(w.href)), JSON.stringify(ways));
  ok('an email icon opens mail',
     ways.some(w => /^Email/.test(w.label) && w.href === 'mailto:dickie@example.com'));
  ok('Facebook is there as a lettered circle, not a logo',
     ways.some(w => w.label === 'Facebook' && /facebook\.com/.test(w.href)));
  ok('at most four, so the name still fits', ways.length <= 4, ways.length + ' icons');
  const bare = await p.evaluate(() => {
     const li = [...document.querySelectorAll('ul.list li')]
       .find(x => /Sandra/.test(x.textContent));
     return li ? li.querySelectorAll('.way').length : 'row missing';
  });
  ok('a contact with no details gets none', bare === 0, String(bare));

  console.log('   tapping an icon must not open the contact');
  ok('the icons sit outside the row button', await p.evaluate(() => {
    const w = document.querySelector('ul.list li .way');
    return w ? !w.closest('button') : false;
  }));
  ok('the browser did not break the row button apart', await p.evaluate(() => {
    const li = document.querySelector('ul.list li');
    return li.querySelectorAll('button.row').length === 1;
  }));

  console.log('   and they stand aside while picking contacts to delete');
  await p.evaluate(() => startPicking());
  await p.waitForTimeout(400);
  ok('no icons in picking mode', (await p.$$('ul.list li .way')).length === 0);
  await p.evaluate(() => stopPicking && stopPicking());
  await p.waitForTimeout(300);

  await p.screenshot({ path: path.join(__dirname,'ways.png') });
  await b.close();

  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
