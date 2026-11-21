// 21 Nov 2026 (version 2026.11.21.1), ML370: photo links that last a week
// and are remembered on each phone or computer.
//   Supabase only shows a photo through a link that stops working after a
//   while. They lasted an hour and were forgotten when the app closed, so each
//   start (and each refresh) asked for new ones, and the browser, seeing a new
//   address, downloaded every photo again. Now a link lasts a week, is kept
//   per person in this browser, is renewed with under two days to go, and is
//   forgotten at sign-out. Finances and My Stuff keep one-hour links that are
//   never kept. A photo that won't load gets one new link and one more try.
// The pretend storage here counts every request for links, and hands back a
// different address each time, as the real one does. Pretend photos only.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|PGRST205|does not exist|schema cache|bank-holidays|Failed to load resource/i;
const WEEK = 7 * 24 * 3600, DAY = 86400e3;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  p.on('popup', pop => pop.close().catch(() => {}));
  await p.route(/gov\.uk|bsky\.app|bsky\.social/, r => r.abort());

  // The pictures themselves: a tiny real one, unless a test wants one to fail.
  const failOnce = new Set(), failAlways = new Set();
  await p.route('https://signed.test/**', r => {
    const at = new URL(r.request().url()).pathname.slice(1);
    if (failAlways.has(at)) return r.abort();
    if (failOnce.has(at)) { failOnce.delete(at); return r.abort(); }
    return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });

  // Before the page starts: the first contact gets a profile photo and two
  // more, and the photo store counts what it is asked for.
  await p.addInitScript(() => {
    window.__signs = []; window.__uploads = [];
    try { localStorage.setItem('view', 'az'); } catch (e) {}   // the contacts list A to Z, not in folded groups
    let real;
    Object.defineProperty(window, 'supabase', { configurable: true, get: () => real, set(v) {
      const c = window.__rows && window.__rows.contacts;
      if (c && c[0]) { c[0].avatar_path = '1/face.jpg'; c[0].photos = [{ path: '1/one.jpg' }, { path: '1/two.jpg' }]; }
      const make = v.createClient;
      real = Object.assign({}, v, { createClient: (...a) => {
        const cl = make(...a);
        const from = cl.storage.from;
        cl.storage.from = bucket => {
          const api = from(bucket), up = api.upload;
          api.createSignedUrls = (paths, secs) => {
            window.__signs.push({ bucket, paths: [...paths], secs });
            return Promise.resolve({ data: paths.map(x => ({ path: x,
              signedUrl: 'https://signed.test/' + x + '?token=' + Math.random().toString(36).slice(2) })), error: null });
          };
          api.upload = (pth, body, opts) => { window.__uploads.push({ path: pth, opts: Object.assign({}, opts) }); return up(pth, body, opts); };
          return api;
        };
        return cl;
      } });
    } });
  });

  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const boot = async (first) => {
    if (first) await p.goto('file://' + path.join(__dirname, 'boot.html'));
    else await p.reload();
    await p.waitForTimeout(900);
    if (await p.$('#noticeX')) { await p.click('#noticeX'); await settle(); }
    await ev(() => { WX_OFF = true; BSKY_OFF = true; });
  };
  const signs = () => ev(() => window.__signs);
  const stored = () => ev(() => JSON.parse(localStorage.getItem('photolinks-me') || 'null'));
  const setStored = v => ev(v => localStorage.setItem('photolinks-me', JSON.stringify(v)), v);
  const faces = ['1/face.jpg', '1/one.jpg', '1/two.jpg'];

  console.log('First start');
  await boot(true);
  let s = await signs();
  ok('the three photos are asked for in one go', s.length === 1 && JSON.stringify([...s[0].paths].sort()) === JSON.stringify(faces), JSON.stringify(s));
  ok('for a week, not an hour', s[0] && s[0].secs === WEEK, s[0] && s[0].secs);
  let kept = await stored();
  ok('kept in this browser under this person', kept && faces.every(x => kept[x]), JSON.stringify(kept));
  const now = await ev(() => Date.now());
  ok('each kept with when it stops, a week on', kept && faces.every(x => Math.abs(kept[x][1] - (now + WEEK * 1000)) < 60e3));
  const first = await ev(() => ({ ...SIGNED }));
  ok('the links in use are the ones kept', faces.every(x => kept[x][0] === first[x]));

  console.log('Second start, the same day');
  await boot();
  s = await signs();
  ok('no links asked for at all', s.length === 0, JSON.stringify(s));
  const again = await ev(() => ({ ...SIGNED }));
  ok('the same addresses as before, so the browser can use its copies', faces.every(x => again[x] === first[x]));
  await ev(() => hideHome()); await settle(500);
  ok('the contacts list shows the profile photo from its kept link',
    await ev(u => { const i = document.querySelector('img.rowpic'); return !!i && i.getAttribute('src') === u; }, first['1/face.jpg']));
  await ev(() => goArea('home')); await settle(300);

  console.log('The refresh button');
  await ev(() => { window.__signs.length = 0; });
  await p.click('#homeRefresh'); await settle(700);
  ok('pressing refresh asks for no new photo links', (await signs()).length === 0, JSON.stringify(await signs()));
  ok('and the links are unchanged', await ev(f => Object.keys(f).every(k => SIGNED[k] === f[k]), first));
  await ev(() => { window.__signs.length = 0; return refreshAll(); });
  ok('refreshAll itself asks for none either', (await signs()).length === 0);

  console.log('Renewing');
  kept = await stored();
  kept['1/face.jpg'][1] = Date.now() + DAY;        // a day left: due
  kept['1/one.jpg'][1] = Date.now() - 1000;        // run out: never used
  await setStored(kept);
  await ev(() => localStorage.setItem('photolinks-sandra', JSON.stringify({ '1/two.jpg': ['https://signed.test/hers', Date.now() + 5 * 86400e3] })));
  await boot();
  s = await signs();
  ok('only the one nearly due and the one run out are asked for', s.length === 1 && JSON.stringify([...s[0].paths].sort()) === JSON.stringify(['1/face.jpg', '1/one.jpg']), JSON.stringify(s));
  const renewed = await ev(() => ({ ...SIGNED }));
  ok('the one run out was not used', renewed['1/one.jpg'] !== first['1/one.jpg']);
  ok('the one with days left kept its link', renewed['1/two.jpg'] === first['1/two.jpg']);
  ok("someone else's links on this phone are not used", renewed['1/two.jpg'] !== 'https://signed.test/hers');
  kept = await stored();
  ok('the renewed links are kept, with a week each', Math.abs(kept['1/face.jpg'][1] - (Date.now() + WEEK * 1000)) < 60e3 && kept['1/one.jpg'][0] === renewed['1/one.jpg']);
  ok("someone else's links are left alone",
    await ev(() => JSON.parse(localStorage.getItem('photolinks-sandra'))['1/two.jpg'][0] === 'https://signed.test/hers'));
  await ev(() => { window.__signs.length = 0; SIGNED_TILL['1/two.jpg'] = Date.now() + 86400e3; return loadAll(); });
  s = await signs();
  ok('the 5-minute reload renews a link that falls due while the app is open', s.length === 1 && s[0].paths.join() === '1/two.jpg', JSON.stringify(s));

  console.log('Finances and My Stuff');
  await ev(() => { window.__signs.length = 0; return signPaths(['fin/1/receipt.jpg', 'stf/me/thing.jpg', 'log/me/day.jpg']); });
  s = await signs();
  const longOne = s.find(x => x.secs === WEEK), shortOne = s.find(x => x.secs === 3600);
  ok('the Daily Log photo gets a week', longOne && longOne.paths.join() === 'log/me/day.jpg', JSON.stringify(s));
  ok('the receipt and the My Stuff photo get an hour', shortOne && JSON.stringify([...shortOne.paths].sort()) === JSON.stringify(['fin/1/receipt.jpg', 'stf/me/thing.jpg']), JSON.stringify(s));
  kept = await stored();
  ok('neither is kept in the browser', kept['log/me/day.jpg'] && !kept['fin/1/receipt.jpg'] && !kept['stf/me/thing.jpg']);
  await ev(() => { window.__signs.length = 0; return signPaths(['fin/1/receipt.jpg', 'stf/me/thing.jpg']); });
  ok('an hour link is used again while it lasts', (await signs()).length === 0);
  await ev(() => { window.__signs.length = 0; SIGNED_TILL['fin/1/receipt.jpg'] = Date.now() + 60e3; return signPaths(['fin/1/receipt.jpg']); });
  s = await signs();
  ok('and renewed in its last five minutes, for another hour', s.length === 1 && s[0].secs === 3600);
  kept = await stored();
  kept['fin/1/planted.jpg'] = ['https://signed.test/fin/1/planted.jpg', Date.now() + 5 * DAY];
  await setStored(kept);
  await boot();
  ok('a Finances link found in the browser is never used', await ev(() => !SIGNED['fin/1/planted.jpg'] && !SIGNED['fin/1/receipt.jpg']));

  console.log('A photo that will not load');
  // Set before the start, as the list behind the home screen may fetch it first.
  const was = await ev(() => SIGNED['1/face.jpg']);
  failOnce.add('1/face.jpg');
  await boot();
  await ev(() => openDetail(1)); await settle(900);
  s = await signs();
  ok('fails once: one new link for that photo alone', s.length === 1 && s[0].paths.join() === '1/face.jpg' && s[0].secs === WEEK, JSON.stringify(s));
  ok('and it is shown with the new link', await ev(w => { const i = document.querySelector('#detail img.avatar');
    return !!i && i.getAttribute('src') === SIGNED['1/face.jpg'] && SIGNED['1/face.jpg'] !== w && i.complete && i.naturalWidth > 0; }, was));
  ok('the new link is kept', (await stored())['1/face.jpg'][0] === await ev(() => SIGNED['1/face.jpg']));
  await ev(() => $('detBack').click()); await settle(300);

  failAlways.add('1/face.jpg');
  await boot();
  await ev(() => hideHome()); await settle(1200);
  s = await signs();
  ok('fails every time: one more try, never a loop', s.length === 1 && s[0].paths.join() === '1/face.jpg', JSON.stringify(s));
  ok('then the contacts list shows the letter instead, as before', await ev(() => {
    const row = [...document.querySelectorAll('#list .rowpic')][0]; return !!row && row.tagName === 'SPAN' && row.textContent.trim() === 'D'; }));
  await settle(800);
  ok('and nothing more is asked for', (await signs()).length === 1);
  failAlways.clear();
  await ev(() => goArea('home')); await settle(300);

  console.log('Browser storage full, blocked or spoilt');
  await ev(() => { window.__realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
  await ev(() => signPaths(['log/me/full.jpg']));
  ok('a full browser storage still shows the photo', await ev(() => !!SIGNED['log/me/full.jpg']));
  await ev(() => { Storage.prototype.setItem = window.__realSet; });
  await ev(() => localStorage.setItem('photolinks-me', '{not json'));
  await boot();
  ok('a spoilt list is ignored and the photos fetched as normal', (await signs()).length === 1 && await ev(() => !!SIGNED['1/face.jpg']));
  await ev(() => localStorage.setItem('photolinks-me', JSON.stringify({ '1/face.jpg': ['javascript:alert(1)', Date.now() + 5 * 86400e3] })));
  await boot();
  ok('only proper https addresses are taken from the browser', await ev(() => /^https:\/\/signed\.test\//.test(SIGNED['1/face.jpg'])));

  console.log('Signing out');
  await ev(() => { window.__at = 'not called';
    sb.auth.signOut = () => { window.__at = localStorage.getItem('photolinks-me'); return new Promise(() => {}); }; });
  ok('there are links kept before signing out', !!(await stored()));
  await ev(() => { $('signoutBtn').onclick(); }); await settle(300);
  ok('signing out forgets them first', await ev(() => window.__at === null), await ev(() => String(window.__at).slice(0, 40)));
  ok("and leaves someone else's on this phone alone", await ev(() => !!localStorage.getItem('photolinks-sandra')));

  console.log('New photos');
  ok('marked to be kept for the week, or the hour for Finances and My Stuff',
    await ev(() => photoKeep('log/me/a.jpg') === '604800' && photoKeep('1/a.jpg') === '604800' &&
      photoKeep('fin/1/a.jpg') === '3600' && photoKeep('stf/me/a.jpg') === '3600'));
  await boot();
  await ev(async () => {
    await openDetail(1);
    const cv = document.createElement('canvas'); cv.width = cv.height = 20;
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
    await uploadPhoto(new File([blob], 'a.png', { type: 'image/png' }), false, true);
  });
  await settle(300);
  const up = await ev(() => window.__uploads);
  ok('a new contact photo goes up marked for the week', up.length === 1 && up[0].opts.cacheControl === '604800' && up[0].opts.upsert === false, JSON.stringify(up));
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const jpgs = src.match(/\.upload\(path,blob,\{contentType:'image\/jpeg'[^}]*\}/g) || [];
  ok('all five photo uploads carry the marking', jpgs.length === 5 && jpgs.every(x => x.includes('cacheControl:photoKeep(path)')), jpgs.length);
  ok('the bank file and PDF uploads are left as they were',
    /\.upload\(path,file,\{contentType:'application\/pdf',upsert:false\}\)/.test(src) && /\.upload\(path,f,\{contentType:f\.type\|\|'text\/csv',upsert:false\}\)/.test(src));

  console.log('Help');
  ok('Help no longer points to a menu item that is gone', !/Fetch them again/.test(src));
  ok('and says the refresh button fetches any that are missing', /Refresh Data and Images<\/strong>\): it fetches any that are missing/.test(src));

  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('\n0 passed, 1 failed'); process.exit(1); });
