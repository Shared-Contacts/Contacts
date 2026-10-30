// Asked for 30 Oct 2026 (ML94 to ML97, ML99): Copy buttons and photos on
// Wishlist ideas, "money moved between my own accounts" above "What it was
// for", a Clear button beside the transaction search, and photos on shopping
// items. Wishlist photos are kept as wsh/<user>/..., shopping ones as
// shp/<user>/... (step 47).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

// A real (tiny) picture, so the page's shrinking step has something to draw.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const pic = n => ({ name: 'photo' + n + '.png', mimeType: 'image/png', buffer: PNG });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const writes = () => ev(() => window.__writes);
  const clear = () => ev(() => { window.__writes = []; });
  const last = async (op, table) => (await writes()).filter(w => w.op === op && (!table || w.table === table)).pop();
  const removed = async f => (await writes()).some(x => x.op === 'rmfile' && x.paths.includes(f));

  await ev(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: async s => { window.__copied = s; }, readText: async () => '' } });
    window.__rows.wishes = [
      { id: 1, created_by: 'me', app: 'contacts', status: 'idea', title: 'Copy buttons on the Wishlist',
        notes: 'So ideas can go into Claude', created_at: '2026-10-30T09:00:00Z',
        photos: [{ path: 'wsh/me/screen.jpg' }] },
      { id: 2, created_by: 'sandra', app: 'contacts', status: 'idea', title: 'Bigger buttons',
        notes: null, created_at: '2026-10-29T09:00:00Z' }];
    window.__rows.shopping_lists = [{ id: 1, owner_id: 'me', name: 'Supermarket' },
      { id: 2, owner_id: 'me', name: 'Chandlery' }];
    window.__rows.shopping = [
      { id: 1, list_id: 1, created_by: 'me', name: 'Coffee', qty: '2 jars', got: false, sort_order: 101,
        photos: [{ path: 'shp/me/coffee.jpg' }] },
      { id: 2, list_id: 1, created_by: 'me', name: 'Milk', qty: null, got: false, sort_order: 102 },
      { id: 3, list_id: 1, created_by: 'sandra', name: 'Bread', qty: null, got: true, sort_order: 103,
        got_at: '2026-10-30T10:00:00Z', photos: [{ path: 'shp/me/loaf.jpg' }, { path: 'shp/sandra/b.jpg' }] },
      { id: 4, list_id: 2, created_by: 'me', name: 'Fender', qty: null, got: false, sort_order: 101,
        photos: [{ path: 'shp/me/fender.jpg' }] }];
  });

  // ---------------------------------------------------------------
  console.log('\nWishlist: copy buttons');
  await ev(() => openWish()); await settle();
  ok('each idea has Copy idea', await ev(() =>
    $('wishBody').querySelectorAll('[data-wfield="t"]').length) === 2);
  ok('and Copy notes only where there are notes', await ev(() =>
    [...$('wishBody').querySelectorAll('[data-wfield="n"]')].map(b => b.dataset.wcopy).join()) === '1');
  await p.click('[data-wcopy="1"][data-wfield="t"]'); await settle(200);
  ok('Copy idea puts the idea on the clipboard', await ev(() => window.__copied) === 'Copy buttons on the Wishlist');
  ok('and says so', /Copied/.test(await ev(() => $('toasts') ? $('toasts').textContent : '')));
  await p.click('[data-wcopy="1"][data-wfield="n"]'); await settle(200);
  ok('Copy notes puts the notes on it', await ev(() => window.__copied) === 'So ideas can go into Claude');
  await p.click('[data-wcopy="2"][data-wfield="t"]'); await settle(200);
  ok('somebody else\'s idea can be copied too', await ev(() => window.__copied) === 'Bigger buttons');
  ok('copying writes nothing to the database', !(await writes()).some(x => /insert|update|delete/.test(x.op)));

  console.log('\nWishlist: photos on the list');
  ok('an idea with a photo shows it', await ev(() =>
    $('wishBody').querySelector('img[data-wpic]').src) === 'https://signed.test/wsh/me/screen.jpg');
  await p.click('img[data-wpic]'); await settle(200);
  ok('tapping it shows it full size', await ev(() =>
    document.querySelector('.lightbox img').src) === 'https://signed.test/wsh/me/screen.jpg');
  await ev(() => document.querySelector('.lightbox').click()); await settle(100);

  console.log('\nWishlist: adding an idea with a photo');
  ok('the Add card has Camera and Choose', await ev(() =>
    $('wishBody').querySelectorAll('.wpics [data-dphadd]').length === 2
    && !!$('wishBody').querySelector('.wpics [data-dphadd][capture]')));
  await clear();
  await p.fill('#wTitle', 'Photos on ideas');
  await p.setInputFiles('#wishBody .wpics [data-dphadd]:not([capture])', [pic(1)]); await settle(800);
  let up = await last('upload');
  ok('the photo goes up into your own Wishlist folder', up && /^wsh\/me\/[\w-]+\.jpg$/.test(up.path), up && up.path);
  ok('and shows in the Add card', await ev(() => $('wPics').querySelectorAll('img').length) === 1);
  await p.click('[data-wset="2:maybe"]'); await settle();
  ok('it is still there after moving another idea along', await ev(() => $('wPics').querySelectorAll('img').length) === 1);
  await p.fill('#wTitle', 'Photos on ideas');
  await p.click('#wAdd'); await settle();
  let w = await last('insert', 'wishes');
  ok('Add it saves the idea with its photo', w && w.rows.title === 'Photos on ideas'
     && JSON.stringify(w.rows.photos) === JSON.stringify([{ path: up.path }]), JSON.stringify(w && w.rows));
  ok('and the Add card is empty again', await ev(() => $('wPics').querySelectorAll('img').length) === 0);
  await clear();
  await p.fill('#wTitle', 'No photo this time');
  await p.click('#wAdd'); await settle();
  w = await last('insert', 'wishes');
  ok('one without photos is added without them (works before step 47)', w && !('photos' in w.rows), JSON.stringify(w && w.rows));
  await clear();
  await p.setInputFiles('#wishBody .wpics [data-dphadd]:not([capture])', [pic(2)]); await settle(800);
  const left = (await last('upload')).path;
  await ev(() => backHome('wish')); await settle();
  ok('leaving the Wishlist clears away a photo never added', await removed(left));

  console.log('\nWishlist: the pencil');
  await ev(() => openWish()); await settle();
  await clear();
  await p.click('[data-wedit="1"]'); await settle();
  ok('the box has Copy idea and Copy notes', await ev(() =>
    document.querySelectorAll('.daypick [data-wecopy]').length) === 2);
  await p.fill('#weNotes', 'Changed notes');
  await p.click('.daypick [data-wecopy="n"]'); await settle(200);
  ok('Copy notes copies what is in the box now', await ev(() => window.__copied) === 'Changed notes');
  ok('the saved photo shows', await ev(() =>
    document.querySelector('#wePics img').src) === 'https://signed.test/wsh/me/screen.jpg');
  await p.setInputFiles('.daypick [data-dphadd]:not([capture])', [pic(3)]); await settle(800);
  up = await last('upload');
  await p.click('#wePics [data-dphx="0"]'); await settle(200);
  await p.click('#weGo'); await settle();
  w = await last('update', 'wishes');
  ok('Save keeps the new photo and drops the old', w && JSON.stringify(w.patch.photos) === JSON.stringify([{ path: up.path }])
     && w.patch.notes === 'Changed notes', JSON.stringify(w && w.patch));
  ok('and clears the old one from the store', await removed('wsh/me/screen.jpg'));
  ok('the box closes', await ev(() => !document.querySelector('.daypick')));
  await clear();
  await p.click('[data-wedit="1"]'); await settle();
  await p.setInputFiles('.daypick [data-dphadd]:not([capture])', [pic(4)]); await settle(800);
  const gone = (await last('upload')).path;
  await p.click('#weCancel'); await settle();
  ok('Cancel clears away the photo just added', await removed(gone));
  ok('and saves nothing', !(await last('update', 'wishes')));
  ok('only your own ideas have the pencil', await ev(() => !document.querySelector('[data-wedit="2"]')));
  await clear();
  await ev(() => { window.__rows.wishes.find(x => x.id === 1).photos = [{ path: 'wsh/me/keep.jpg' }];
    return loadLists().then(renderWish); }); await settle();
  await p.click('[data-wdel="1"]'); await settle();
  ok('removing your idea takes its photos with it', await removed('wsh/me/keep.jpg'));

  // ---------------------------------------------------------------
  console.log('\nFinances: the transfer button');
  await ev(() => { backHome('wish'); openMoney(); }); await settle(600);
  await ev(() => editTxn(5)); await settle(600);
  ok('the button is there', await p.isVisible('#txPair'));
  ok('above What it was for', await ev(() => {
    const h = [...document.querySelectorAll('h3')].find(x => x.textContent === 'What it was for');
    return !!h && !!(document.getElementById('txPair').compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  ok('and below the account and Business box', await ev(() =>
    !!(document.getElementById('txBiz').compareDocumentPosition(document.getElementById('txPair')) & Node.DOCUMENT_POSITION_FOLLOWING)));

  console.log('\nFinances: Clear beside Search');
  await ev(() => { $('moneyEd').classList.add('hidden'); openMoney(); }); await settle(600);
  ok('no Clear until something is searched for', !(await p.isVisible('#mqClearTop')));
  await p.fill('#mq', 'Alamy'); await p.click('#mqGo'); await settle(500);
  ok('after a search, Clear sits beside Search', await ev(() =>
    $('mqClearTop') && $('mqClearTop').parentElement === $('mqGo').parentElement));
  await p.click('#mqClearTop'); await settle(500);
  ok('Clear empties the box', (await p.inputValue('#mq')) === '');
  ok('and brings back the ordinary list', !/Search results/.test(await ev(() => document.querySelector('#moneyBody .dsec').textContent)));
  ok('and the Clear button goes', !(await p.isVisible('#mqClearTop')));

  // ---------------------------------------------------------------
  console.log('\nShopping: photos on the list');
  await ev(() => { backHome('money'); openShop(); }); await settle(600);
  ok('an item with a photo shows it small', await ev(() =>
    document.querySelector('img[data-spic]').src) === 'https://signed.test/shp/me/coffee.jpg');
  ok('only items with photos have one', await ev(() =>
    !document.querySelector('[data-sedit="2"]').closest('.item').querySelector('img')));
  await p.click('img[data-spic="shp/me/coffee.jpg"]'); await settle(200);
  ok('tapping it shows it full size', await ev(() => !!document.querySelector('.lightbox img')));
  ok('without opening the item', await ev(() => !document.querySelector('.daypick')));
  await ev(() => document.querySelector('.lightbox').click()); await settle(100);

  console.log('\nShopping: opening an item');
  await clear();
  await p.click('[data-sedit="2"]'); await settle();
  ok('tapping an item opens a box, not the old one-line question', await ev(() => !!document.querySelector('.daypick #seName')));
  ok('with the wording, how many and Camera and Choose', await ev(() =>
    $('seName').value === 'Milk' && $('seQty').value === ''
    && document.querySelectorAll('.daypick [data-dphadd]').length === 2));
  await p.fill('#seName', 'Semi-skimmed milk'); await p.fill('#seQty', '2 pints');
  await p.setInputFiles('.daypick [data-dphadd]:not([capture])', [pic(5)]); await settle(800);
  up = await last('upload');
  ok('the photo goes into your own shopping folder', up && /^shp\/me\/[\w-]+\.jpg$/.test(up.path), up && up.path);
  await p.click('#seGo'); await settle();
  w = await last('update', 'shopping');
  ok('Save changes the wording, how many and photos', w && w.patch.name === 'Semi-skimmed milk' && w.patch.qty === '2 pints'
     && JSON.stringify(w.patch.photos) === JSON.stringify([{ path: up.path }]), JSON.stringify(w && w.patch));
  ok('on the right item', w && JSON.stringify(w.where) === JSON.stringify([['eq', 'id', 2]]));
  ok('the box closes', await ev(() => !document.querySelector('.daypick')));
  await clear();
  await ev(() => { window.__rows.shopping.find(x => x.id === 2).photos = []; return loadShopping().then(renderShop); });
  await p.click('[data-sedit="2"]'); await settle();
  await p.click('#seGo'); await settle();
  w = await last('update', 'shopping');
  ok('one without photos saves without them (works before step 47)', w && !('photos' in w.patch), JSON.stringify(w && w.patch));
  await clear();
  await p.click('[data-sedit="1"]'); await settle();
  await p.setInputFiles('.daypick [data-dphadd]:not([capture])', [pic(6)]); await settle(800);
  const tmp = (await last('upload')).path;
  await p.click('#seCancel'); await settle();
  ok('Cancel clears away the photo just added', await removed(tmp));
  ok('and keeps the saved one', !(await removed('shp/me/coffee.jpg')));

  console.log('\nShopping: removing');
  await clear();
  await p.click('[data-sdel="1"]'); await settle();
  ok('the × takes your photos with the item', await removed('shp/me/coffee.jpg'));
  await clear();
  await p.click('#sClear'); await settle();
  ok('Clear the trolley takes your photos too', await removed('shp/me/loaf.jpg'));
  ok('but leaves Sandra\'s file in her folder', !(await removed('shp/sandra/b.jpg')));
  await clear();
  await ev(() => { CUR_LIST = 2; renderShop(); }); await settle();
  await ev(() => binList(2)); await settle();
  ok('deleting a list takes your photos on it', await removed('shp/me/fender.jpg'));

  console.log('\nBefore step 47 has been run');
  ok('a save that fails on photos says to run step 47', await ev(() => {
    dphStart('x', [], 'shp', 47);
    const s = dphStepMissing({ photos: [] }, { message: 'column "photos" of relation "shopping" does not exist' });
    dphCancel(); return s; }) === 'Could not save: photos need step 47 run in Supabase first');
  ok('the diary still says step 46', await ev(() =>
    dphStepMissing({ photos: [] }, { message: 'column "photos" does not exist' })) ===
    'Could not save: photos need step 46 run in Supabase first');

  console.log('\nHelp');
  await ev(() => openHelp && openHelp()); await settle();
  const help = await ev(() => $('helpBody').textContent);
  ok('Help explains Wishlist photos and Copy', /Copy image/.test(help) && /Copy idea/.test(help));
  ok('and shopping photos', /the packet you are after/.test(help));

  console.log(errors.length ? '\nErrors:\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail++;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
