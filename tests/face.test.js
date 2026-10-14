// Making a gallery photo the profile photo, and finding a date in the log.
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
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  // Three photos on Dickie, none of them the profile photo yet.
  const seed = async () => page.evaluate(async () => {
    const c = window.__rows.contacts.find(x => x.id === 1);
    c.photos = [{path:'1/aaa.jpg'}, {path:'1/bbb.jpg'}, {path:'1/ccc.jpg'}];
    c.avatar_path = null;
    window.__writes.length = 0;
    await loadAll();
    await openDetail(1, true);
    await new Promise(r => setTimeout(r, 300));
  });
  await seed();

  console.log('\nEvery gallery photo offers to be the profile one');
  ok('a star on each', (await page.$$('[data-setface]')).length === 3);
  ok('and none of them is flagged as the profile yet',
     (await page.$$('.gallery .mainpip')).length === 0);
  ok('it says what the star does',
     /Tap .* to make it the profile photo/.test(await page.textContent('#detBody'))
     || /profile photo/.test(await page.textContent('#detBody')));

  console.log('\nTapping one');
  await page.click('[data-setface="1/bbb.jpg"]');
  await page.waitForTimeout(500);
  const w = await page.evaluate(() => window.__writes.slice());
  const up = w.find(x => x.table === 'contacts' && x.op === 'update');
  ok('the contact is updated', !!up, JSON.stringify(w));
  ok('to point at that photo', up && up.patch.avatar_path === '1/bbb.jpg');
  ok('and nothing is uploaded — it is the picture already there',
     !w.some(x => x.op === 'upload'), JSON.stringify(w));

  console.log('\nAnd the one in use says so');
  await page.evaluate(async () => {
    window.__rows.contacts.find(x => x.id === 1).avatar_path = '1/bbb.jpg';
    await loadAll(); await openDetail(1, true);
    await new Promise(r => setTimeout(r, 200));
  });
  await page.waitForTimeout(300);
  ok('one is marked Profile', (await page.$$('.gallery .mainpip')).length === 1);
  ok('and it is not offered again', (await page.$$('[data-setface]')).length === 2);
  ok('the big one at the top is that photo', await page.evaluate(() => {
    const img = document.querySelector('#detBody img.avatar');
    return !!img && img.dataset.big === '1/bbb.jpg';
  }));

  console.log('\nThe same file in two places is removed carefully');
  // Taking the profile photo off must not delete a file the gallery still shows.
  const a = await page.evaluate(async () => {
    window.__writes.length = 0;
    await removePhoto('1/bbb.jpg', true);
    return window.__writes.slice();
  });
  ok('the profile photo is let go', a.some(x => x.table === 'contacts'
     && x.patch && x.patch.avatar_path === null), JSON.stringify(a));
  ok('but the file stays, because the gallery still shows it',
     !a.some(x => x.op === 'rmfile'), JSON.stringify(a));

  const b = await page.evaluate(async () => {
    window.__rows.contacts.find(x => x.id === 1).avatar_path = '1/bbb.jpg';
    await loadAll(); await openDetail(1, true);
    await new Promise(r => setTimeout(r, 200));
    window.__writes.length = 0;
    await removePhoto('1/bbb.jpg', false);      // the × on the gallery photo
    return window.__writes.slice();
  });
  const pat = (b.find(x => x.table === 'contacts' && x.op === 'update') || {}).patch || {};
  ok('removing it from the gallery takes the file too', b.some(x => x.op === 'rmfile'),
     JSON.stringify(b));
  ok('and it stops being the profile photo, instead of hanging there broken',
     pat.avatar_path === null, JSON.stringify(pat));
  ok('the other two are left alone', (pat.photos || []).length === 2,
     JSON.stringify(pat.photos));

  const c = await page.evaluate(async () => {
    const row = window.__rows.contacts.find(x => x.id === 1);
    row.photos = [{path:'1/aaa.jpg'}];
    row.avatar_path = '1/own-face.jpg';          // uploaded on its own, as before
    await loadAll(); await openDetail(1, true);
    await new Promise(r => setTimeout(r, 200));
    window.__writes.length = 0;
    await removePhoto('1/own-face.jpg', true);
    return window.__writes.slice();
  });
  ok('a profile photo of its own is still deleted properly',
     c.some(x => x.op === 'rmfile'), JSON.stringify(c));

  // ---------------------------------------------------------------
  console.log('\nFinding a date in the Daily Log');
  await page.evaluate(async () => { await openLog(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => openDayPick());
  await page.waitForTimeout(300);
  ok('the picker opens', (await page.$$('.daypick')).length === 1);
  ok('with a date box', (await page.$$('#pickGo')).length === 1);
  // What you can type into it is picked over in batch.test.js.
  ok('that is a plain box, not another calendar on top of this one',
     (await page.getAttribute('#pickGo', 'type')) === null);
  ok('and a Today button beside it', (await page.$$('#pickToday')).length === 1);
  ok('the months can still be stepped through', (await page.$$('[data-pm]')).length === 2);

  const jumped = await page.evaluate(async () => {
    const i = document.querySelector('#pickGo');
    i.value = '2019-07-04';
    document.querySelector('#pickGoBtn').click();
    await new Promise(r => setTimeout(r, 300));
    return { date: LOG_DATE, shut: document.querySelectorAll('.daypick').length === 0,
             bar: document.querySelector('#logPick').textContent };
  });
  ok('typing a date goes straight there', jumped.date === '2019-07-04', jumped.date);
  ok('the picker closes behind you', jumped.shut);
  // Another year, so the bar adds it — two digits, as everywhere else.
  ok('and the bar says which year, since it is not this one',
     /4 Jul 19$/.test(jumped.bar.trim()), jumped.bar);

  const today = await page.evaluate(async () => {
    openDayPick();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('#pickToday').click();
    await new Promise(r => setTimeout(r, 300));
    return LOG_DATE === isoDay(new Date());
  });
  ok('and Today gets back in one tap', today);

  const junk = await page.evaluate(async () => {
    openDayPick();
    await new Promise(r => setTimeout(r, 200));
    const before = LOG_DATE;
    document.querySelector('#pickGo').value = '';
    document.querySelector('#pickGoBtn').click();
    await new Promise(r => setTimeout(r, 200));
    const same = LOG_DATE === before;
    const open = document.querySelectorAll('.daypick').length === 1;
    document.querySelectorAll('.daypick').forEach(x => x.remove());
    return { same, open };
  });
  ok('a half-typed date does nothing rash', junk.same);
  ok('and leaves the picker open', junk.open);

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
