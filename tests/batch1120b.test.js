// 20 Nov 2026 (version 2026.11.20.2), after Barry tried 2026.11.20.1 on the phone:
//   ML326  The phone's Back arrow: the second Back in a row closed the app.
//          After a Back, Chrome ignores any step a page adds until the next
//          touch, and adding one then makes Back skip them all. Steps are
//          now added only just after a real tap or key press, enough for
//          several Backs in a row.
//   ML327  Slideshow: how long each photo shows, on the slideshow's own
//          page, before you press Play.
// Pretend people and photos only; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|does not exist|schema cache/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const asked = []; let answer = true; const answers = [];
  p.on('dialog', d => { asked.push(d.message());
    if (d.type() === 'prompt') return d.accept(answers.shift() || '');
    return answer ? d.accept() : d.dismiss(); });
  p.on('popup', pop => pop.close().catch(() => {}));

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const open = id => ev(i => !!$(i) && !$(i).classList.contains('hidden'), id);
  const url0 = p.url();
  const back = async () => { await ev(() => history.back()); await settle(450); };
  const touch = async () => { await p.keyboard.press('Shift'); await settle(650); };
  const still = async () => p.url() === url0 && await ev(() => typeof ME !== 'undefined' && !!ME);
  const at = () => ev(() => backAt());
  const help = () => ev(() => { const was = $('help').classList.contains('hidden'); openHelp('contacts');
    const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    if (was) { $('help').classList.add('hidden'); lockBackground(); } return t; });

  // ---------------------------------------------------------------
  console.log('\nML326 The phone\'s Back arrow, several times in a row');
  const len0 = await ev(() => history.length);
  ok('before the app is touched, it adds nothing (Chrome would skip it)', await ev(() =>
    !(history.state && history.state.myl === 'back') && !BACK_TOUCHED));
  // Watch every step added: none may come between a Back and the next touch.
  await ev(() => { window.__late = 0; window.__adds = 0; let after = false;
    addEventListener('popstate', () => { after = true; }, true);
    ['pointerup', 'click', 'keydown'].forEach(t => document.addEventListener(t, e => {
      if (e.isTrusted && e.key !== 'Escape') after = false; }, true));
    const P = history.pushState.bind(history);
    history.pushState = function (st, ...r) { window.__adds++; if (after) window.__late++; return P(st, ...r); }; });
  await answerLkAsks(p, () => true);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await settle(300); }
  await ev(() => { WX_OFF = true; BSKY_OFF = true; document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); showHome(); });
  await touch();
  ok('a touch on the home screen: two spare steps', await at() === 2 && await ev(() => history.length) === len0 + 2,
    `${await at()} / ${await ev(() => history.length)} from ${len0}`);
  await ev(() => { hideHome(); openDetail(1); }); await settle(400);
  await ev(async () => { await openSettings(); }); await settle(300);
  await ev(() => openHelp('sld')); await settle(300);
  await touch();
  ok('Contacts, a contact, Settings and Help over it, then a touch: one step for each and two more', await at() === 6, String(await at()));
  await back();
  ok('Back: Help goes, Settings still there', !(await open('help')) && await open('settings') && await still());
  await back();
  ok('Back again straight away: Settings goes, the contact still there', !(await open('settings')) && await open('detail') && await still());
  await back();
  ok('  and again: Contacts', !(await open('detail')) && !(await open('home')) && await still());
  await back();
  ok('  and again: the home screen', await open('home') && await still());
  await back(); await back();
  ok('  and twice more: still on the home screen, still in the app', await open('home') && await still() && await at() === 0);
  ok('no step was added between a Back and a touch', await ev(() => window.__late) === 0, String(await ev(() => window.__late)));
  await ev(() => { document.body.click(); $('home').click(); }); await settle(700);
  ok('the app\'s own clicks don\'t count as a touch', await at() === 0 && await ev(() => window.__late) === 0);
  await p.keyboard.press('Escape'); await settle(700);
  ok('  nor does Esc (Chrome doesn\'t count it either)', await at() === 0 && await ev(() => window.__late) === 0);
  await touch();
  ok('the next real touch puts the spare steps back', await at() === 2, String(await at()));
  await ev(() => hideHome()); await touch();
  ok('  and tops them up as screens open', await at() === 3, String(await at()));
  await ev(() => { window.__bd = backDepth; backDepth = () => 40; }); await touch();
  ok('never more than 12, however much is open', await at() === 12, String(await at()));
  await ev(() => { backDepth = window.__bd; });
  await back();
  ok('a Back then: one step only (Contacts to home)', await open('home') && await at() === 11 && await still());
  await ev(async () => { await openSettings(); }); await touch();
  const rw = await ev(() => new Promise(r => backRewind(() => r({ at: backAt(), settings: !$('settings').classList.contains('hidden') }))));
  ok('before the app restarts itself, it goes back to its first step, without taking a Back step', rw.at === 0 && rw.settings, JSON.stringify(rw));
  ok('  used by Restart now and by Sign out', await ev(() => /backRewind\(/.test(verRestart.toString())
    && /backRewind\(/.test($('signoutBtn').onclick.toString())));
  await ev(() => { BACK_REWIND = false; $('settings').classList.add('hidden'); lockBackground(); });
  ok('no step was added between a Back and a touch, all the way through', await ev(() => window.__late) === 0);
  ok('the page itself never changed', p.url() === url0);

  // ---------------------------------------------------------------
  console.log('\nML327 How long each photo shows, chosen before it starts (moved to the top by ML331)');
  await ev(() => openSlides()); await settle(300);
  answers.push('Canals');
  await ev(() => sldNew()); await settle(400);
  await ev(async () => { const mk = async (n, w, h, c) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h);
    return new File([await new Promise(o => cv.toBlob(o, 'image/jpeg'))], n, { type: 'image/jpeg' }); };
    await sldAddFiles([await mk('a.jpg', 300, 200, '#468'), await mk('b.jpg', 200, 300, '#846'), await mk('c.jpg', 300, 200, '#684')]); });
  await settle(400);
  ok('a slideshow\'s own page: its photos only, no choices', await ev(() =>
    !$('sldThemeBody').querySelector('[data-sldsecs], [data-sldorder], [data-sldplay], [data-sldshape]')));
  await ev(() => { $('sldTheme').classList.add('hidden'); SLD_CUR = null; lockBackground(); renderSlides(); $('sldBody').scrollTop = 0; }); await settle(300);
  ok('Each photo shows for: at the top of the first page, above the list, without scrolling', await ev(() => {
    const se = $('sldBody').querySelector('[data-sldsecs]'), l = $('sldBody').querySelector('[data-sldgo]');
    return !!se && !!l && !!(se.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING) && se.getBoundingClientRect().bottom <= innerHeight; }));
  await p.click('#sldBody [data-sldsecs="15"]'); await settle(300);
  ok('press 15 seconds: chosen and kept', await ev(() => sldPrefs().secs === 15
    && $('sldBody').querySelector('[data-sldsecs="15"]').getAttribute('aria-pressed') === 'true'));
  await p.click('#sldBody [data-sldshape="up"]'); await settle(200);
  await p.click('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(600);
  ok('tap the slideshow: it starts, and its title says 15 seconds each', await ev(() => !!SLD && SLD.secs === 15
    && /15 seconds each/.test($('sldIdet').textContent)));
  await ev(() => sldStop()); await settle(200);
  const h = await help();
  ok('Help says where', /how long each photo shows \(5, 8, 15 or 30 seconds\)/.test(h) && /How it plays is at the top of the Slideshow, for every slideshow/.test(h));

  // ---------------------------------------------------------------
  console.log('\nThe version');
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const V2 = vj.history.find(x => x.version === '2026.11.20.2');
  ok('2026.11.20.2 is in version.json, and the page is the newest', !!V2 && await ev(() => APP_VERSION) === vj.version
    && vj.history[0].version === vj.version);
  ok('  what\'s new says both', !!V2 && /twice or more in a row no longer closes the app/.test(V2.changes.join(' '))
    && /before you press Play/.test(V2.changes.join(' ')));

  // ---------------------------------------------------------------
  console.log('\nML326 After the page is reloaded on a spare step');
  await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); showHome(); }); await touch();
  const before = await at();
  await p.reload(); await settle(1200);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await settle(300); }
  ok('it counts again from where it is', before > 0 && await ev(() => history.state && history.state.myl === 'back' && backAt() === 0),
    before + ' ' + JSON.stringify(await ev(() => history.state)));
  await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); showHome(); }); await touch();
  await ev(() => { window.__same = 1; });
  await back();
  ok('  a Back from there stays in the same page, not loaded again', await at() === 1 && await ev(() => !!ME && window.__same === 1) && p.url() === url0);

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
