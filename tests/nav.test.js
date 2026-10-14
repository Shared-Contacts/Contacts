// The menu on every section bar, one refresh command, the Recipes tile,
// and whatever you open coming to the front.
const { chromium } = require('playwright');
const path = require('path');

const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  const areas = ['contacts','money','log','diary','shop','wish','where','chats'];

  // ---------------------------------------------------------------
  console.log('\nEvery section has a menu where the Back button was');
  for (const a of areas) {
    ok(a + ' has one', (await page.$$(`[data-menu="${a}"]`)).length === 1);
  }
  ok('and none of them still says Back', await page.evaluate(() =>
    ['homeBtn','logBack','diaryBack','shopBack','wishBack','whereBack','chatsBack','moneyBack']
      .every(id => { const el = document.getElementById(id);
        return !el || !/Back/.test(el.textContent); })));
  ok('the menu button is at the left end of the bar, after the arrow home',
     await page.evaluate(() => {
       const b = document.querySelector('[data-menu="money"]');
       return b.previousElementSibling.dataset.home === 'money'
           && !b.previousElementSibling.previousElementSibling;
     }));

  console.log('\nAnd a back arrow beside it, straight to the home screen');
  for (const a of areas) {
    ok(a + ' has one', (await page.$$(`[data-home="${a}"]`)).length === 1);
  }
  ok('the arrow is first, the menu second', await page.evaluate(() => {
    const bar = document.querySelector('[data-home="money"]').parentElement;
    return bar.children[0].dataset.home === 'money'
        && bar.children[1].dataset.menu === 'money';
  }));
  ok('it is a solid arrow, not an outline', await page.evaluate(() => {
    const svg = document.querySelector('[data-home="money"] svg');
    return svg.getAttribute('fill') === 'currentColor';
  }));
  ok('it says where it goes', await page.evaluate(() =>
    document.querySelector('[data-home="log"]').title === 'Home screen'));

  const home = await page.evaluate(async () => {
    await openMoney();
    await new Promise(r => setTimeout(r, 300));
    document.querySelector('[data-home="money"]').click();
    await new Promise(r => setTimeout(r, 300));
    return { shut: $('money').classList.contains('hidden'),
             home: !$('home').classList.contains('hidden') };
  });
  ok('one tap closes the section', home.shut);
  ok('and the home screen is there', home.home);

  // The old Back buttons did a bit of tidying up on the way out. The arrow
  // has to do the same, or a map keeps running and a tick list keeps ticking.
  const tidy = await page.evaluate(async () => {
    await openMoney();
    startMoneyPicking();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('[data-home="money"]').click();
    await new Promise(r => setTimeout(r, 200));
    const picking = MONEY_PICKING;
    await openWhere();
    await new Promise(r => setTimeout(r, 300));
    document.querySelector('[data-home="where"]').click();
    await new Promise(r => setTimeout(r, 300));
    return { picking, watching: typeof WHERE_POLL === 'undefined' ? null : WHERE_POLL };
  });
  ok('a half-made tick list is put down', tidy.picking === false);
  ok('and the map stops watching', tidy.watching === null);

  console.log('\nBut an editing screen keeps its way out');
  for (const [id, word] of [['moneyEdCancel','Cancel'], ['edCancel','Cancel'],
                            ['reconBack','Back'], ['impBack','Back'],
                            ['logEdCancel','Cancel'], ['itCancel','Cancel'],
                            ['chatBack','Back'], ['detBack','Back']]) {
    const el = await page.$('#' + id);
    ok(id + ' still says ' + word, !!el && (await el.textContent()).trim() === word);
  }

  // ---------------------------------------------------------------
  console.log('\nThe menu knows where it was opened from');
  await page.evaluate(() => openMoney());
  await page.waitForTimeout(400);
  await page.click('[data-menu="money"]');
  await page.waitForTimeout(300);
  ok('it opens', await page.isVisible('#menu'));
  ok('and is titled for the area', (await page.textContent('#menuTitle')) === 'Finances');
  let body = await page.textContent('#menuBody');
  ok('the Finances jobs are on it',
     /Reconcile a statement/.test(body) && /Import from a bank file/.test(body)
     && /Find transfers/.test(body) && /Choose several to delete/.test(body), body);
  ok('with that area\'s settings', /Settings for Finances/.test(body));
  ok('and that area\'s help', /How Finances works/.test(body));
  ok('one command fetches everything', /Refresh Data and Images/.test(body));
  ok('and it does not offer to take you where you already are',
     !/data-mgo="money"/.test(await page.innerHTML('#menuBody')));
  ok('the other sections are all there', await page.evaluate(() =>
     ['contacts','log','diary','shop','wish','where','chats','home']
       .every(k => !!document.querySelector(`[data-mgo="${k}"]`))));

  console.log('\nThe contacts menu carries the contacts jobs');
  await page.evaluate(() => { shutMenu(); goArea('contacts'); });
  await page.waitForTimeout(400);
  await page.click('[data-menu="contacts"]');
  await page.waitForTimeout(300);
  body = await page.textContent('#menuBody');
  ok('titled Contacts', (await page.textContent('#menuTitle')) === 'Contacts');
  ok('delete several is there', /Delete several contacts/.test(body));
  ok('so is import and export', /Import and export contacts/.test(body));
  ok('and contacts sent to you', /Contacts sent to you/.test(body));
  ok('settings point at Contacts', /Settings for Contacts/.test(body));

  console.log('\nA section with nothing of its own still gets the rest');
  await page.evaluate(() => { shutMenu(); goArea('wish'); });
  await page.waitForTimeout(400);
  await page.click('[data-menu="wish"]');
  await page.waitForTimeout(300);
  body = await page.textContent('#menuBody');
  ok('no jobs section is invented', !/^In Wishlist/m.test(body));
  ok('plain Settings when it has none of its own',
     /Settings/.test(body) && !/Settings for Wishlist/.test(body));
  ok('help still points at the Wishlist', /How Wishlist works/.test(body));

  console.log('\nHelp and settings land in the right place');
  await page.evaluate(() => { shutMenu(); goArea('money'); });
  await page.waitForTimeout(400);
  await page.click('[data-menu="money"]');
  await page.waitForTimeout(300);
  await page.click('[data-mhelp]');
  await page.waitForTimeout(400);
  ok('help opens', await page.isVisible('#help'));
  ok('at the cashbook', await page.evaluate(() => {
    const h = document.getElementById('h-money');
    return !!h && h.getBoundingClientRect().top < 400;
  }));
  await page.evaluate(() => { $('help').classList.add('hidden'); lockBackground(); });
  await page.click('[data-menu="money"]');
  await page.waitForTimeout(300);
  await page.click('[data-mset]');
  await page.waitForTimeout(600);
  ok('settings open', await page.isVisible('#settings'));
  ok('on the Finances heading', /Accounts/.test(await page.textContent('#setBody')));

  // ---------------------------------------------------------------
  console.log('\nGoing somewhere else puts away where you were');
  await page.evaluate(() => { $('settings').classList.add('hidden'); lockBackground(); });
  const piled = await page.evaluate(async () => {
    await openMoney();
    openMenu('money');
    goArea('wish');
    await new Promise(r => setTimeout(r, 300));
    return { money: $('money').classList.contains('hidden'),
             wish: !$('wish').classList.contains('hidden') };
  });
  ok('the one you left is closed', piled.money);
  ok('and the one you chose is open', piled.wish);

  console.log('\nWhatever is opened comes to the front');
  const z = await page.evaluate(async () => {
    const n = id => +getComputedStyle($(id)).zIndex;
    await openMoney();
    await new Promise(r => setTimeout(r, 200));
    await openWish();                       // opened second, and earlier in the page
    await new Promise(r => setTimeout(r, 200));
    const after = { money:n('money'), wish:n('wish') };
    $('wish').classList.add('hidden'); lockBackground();
    return { after, moneyBack:n('money'), wishLet:$('wish').style.zIndex };
  });
  ok('the Wishlist sits above what was already open',
     z.after.wish > z.after.money, JSON.stringify(z.after));
  ok('and both stay below the bottom tray', z.after.wish < 50, JSON.stringify(z.after));
  ok('closing it hands the front back, and lets go of its own place',
     z.moneyBack >= 40 && z.wishLet === '', JSON.stringify(z));

  // ---------------------------------------------------------------
  console.log('\nOne command for the figures and the pictures');
  const ref = await page.evaluate(async () => {
    const calls = [];
    const la = window.loadAll, rp = window.refreshPhotos;
    window.loadAll = async () => { calls.push('data'); };
    window.refreshPhotos = async q => { calls.push('photos' + (q ? ' quietly' : '')); };
    window.__toasts = []; const t = window.toast;
    window.toast = m => { window.__toasts.push(m); t(m); };
    await refreshAll();
    window.loadAll = la; window.refreshPhotos = rp; window.toast = t;
    return { calls, toasts: window.__toasts.slice() };
  });
  ok('it fetches the data', ref.calls.includes('data'));
  ok('and the photos, in the same go', ref.calls.includes('photos quietly'),
     JSON.stringify(ref.calls));
  ok('and says so once, not three times', ref.toasts.length === 1, JSON.stringify(ref.toasts));

  console.log('\nAnd the button for it is on every section bar');
  const bars = await page.evaluate(() => {
    const out = {};
    ['topbar','log','diary','shop','wish','where','chats','money','menu'].forEach(id => {
      const bar = $(id).querySelector('.sheetbar, .plate');
      out[id] = !!bar && !!bar.querySelector('[data-barref]');
    });
    return out;
  });
  Object.entries(bars).forEach(([id, has]) => ok(id + ' has one', has));
  ok('and it says what it does now', await page.evaluate(() =>
    document.querySelector('[data-barref]').title === 'Refresh Data and Images'));

  // ---------------------------------------------------------------
  console.log('\nRecipes, on the way');
  ok('there is a tile for it', await page.evaluate(() => !!TILE_DEST.recipes));
  ok('it is on the home screen by default',
     await page.evaluate(() => TILE_DEFAULTS.includes('recipes')));
  ok('it appears for somebody who arranged their tiles before it existed',
     await page.evaluate(() => {
       MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[] };
       loadTiles();
       return TILES.some(t => t.dest === 'recipes');
     }));
  ok('but not for somebody who has taken it off',
     await page.evaluate(() => {
       MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:['recipes'] };
       loadTiles();
       return !TILES.some(t => t.dest === 'recipes');
     }));
  const said = await page.evaluate(async () => {
    MY_PROFILE.home_tiles = null; loadTiles();
    window.__toasts = []; const t = window.toast;
    window.toast = m => { window.__toasts.push(m); t(m); };
    TILE_DEST.recipes.go();
    window.toast = t;
    return window.__toasts.slice();
  });
  ok('and tapping it says it is coming', /coming soon/i.test(said[0] || ''), JSON.stringify(said));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.filter(e => /PAGE ERROR/.test(e)).length ? 1 : 0);
})();
