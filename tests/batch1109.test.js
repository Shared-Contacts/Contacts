// The 9 Nov 2026 batch, driven through the real page on a phone-sized,
// touch screen held upright:
//   ML217 Finances: each account in a box of its own, its name bold on a
//         line of its own, with sort code, account number and IBAN (step 59),
//         each tidied into its usual layout.
//   Putting accounts in order: the screen now creeps along just above the
//         Wishlist/Help strip (it used to wait for the finger to be ON the
//         strip), and the account boxes fold to their names while one moves.
//   ML218 Jigsaws: a landscape puzzle opens on its page first (more in
//         batch1106.test.js).
//   ML219 Loxx: questions during a game on the game sheet, turned with it,
//         and the messages turned too.
//   ML220 Wishlist: Tile/Area and Description of idea/change; Copy idea
//         copies both.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|set_person|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const NAMES = ['Barclays Everyday Saver', 'Barclays ISA Issue 1', 'Barclays BBA Ovdrft', 'Revolut GBP', 'Revolut EUR',
  'Premium Bonds', 'Cash', 'ASB Cheque', 'ASB Savings', 'Amex Gold', 'Nationwide FlexDirect', 'Wise USD'];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const native = [];
  p.on('dialog', d => { native.push(d.message()); return d.accept(); });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const writes = t => ev(t => window.__writes.filter(w => w.table === t), t);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  // A later version goes on top; this one stays in the list.
  const V9 = VJ.history.find(h => h.version === '2026.11.09.1');
  ok('2026.11.09.1 is in version.json, and the page is the newest', !!V9 && VJ.version === appVer && VJ.history[0].version === appVer, appVer + ' / ' + VJ.version);
  const said = (V9 ? V9.changes : []).join(' ');
  ok('  saying what changed: accounts, putting in order, jigsaws, Loxx, Wishlist', /sort code/.test(said) && /order/.test(said)
    && /Jigsaws/.test(said) && /Loxx/.test(said) && /Tile\/Area/.test(said), said);

  // ---------------------------------------------------------------
  console.log('\nAccounts in Settings, each in a box of its own (ML217)');
  await ev(names => { window.__rows.accounts = names.map((n, i) => ({ id: i + 1, name: n, group_name: n.split(' ')[0], kind: 'savings',
    currency: 'GBP', opening_balance: 100, opening_date: '2026-08-31', active: true, sort: (i + 1) * 10, created_by: 'me',
    sort_code: i === 0 ? '20-00-00' : null })); }, NAMES);
  const openFin = async () => { await ev(async () => { await loadMoney(); openSettings('Finances'); }); await settle(500);
    await ev(() => document.querySelectorAll('.card.logsec').forEach(d => d.open = true)); await settle(150); };
  await openFin();
  const box = await ev(() => {
    const r = document.querySelector('[data-hm="acc:1"]'), n = r.querySelector('.accname'), cs = getComputedStyle(r), ns = getComputedStyle(n);
    const card = getComputedStyle(r.parentElement);
    const next = document.querySelector('[data-hm="acc:2"]').getBoundingClientRect();
    return { box: r.classList.contains('accbox'), border: cs.borderTopWidth, radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, cardBg: card.backgroundColor,
      weight: Number(ns.fontWeight), size: parseFloat(ns.fontSize), nameW: n.getBoundingClientRect().width, rowW: r.getBoundingClientRect().width,
      nameTop: n.getBoundingClientRect().top, groupTop: r.querySelector('[data-afield$=":group_name"]').getBoundingClientRect().top,
      gap: next.top - r.getBoundingClientRect().bottom, value: n.value, sc: r.querySelector('[data-afield$=":sort_code"]').value };
  });
  ok('each account is a box with a border and rounded corners', box.box && parseFloat(box.border) >= 1 && parseFloat(box.radius) >= 8, JSON.stringify(box));
  ok('  with a wash of colour of its own', box.bg !== box.cardBg && box.bg !== 'rgba(0, 0, 0, 0)', box.bg + ' / ' + box.cardBg);
  ok('  and a gap between one box and the next', box.gap >= 8, box.gap);
  ok('the name is bold and bigger', box.weight >= 700 && box.size >= 18, box.weight + ' ' + box.size);
  ok('  on a line of its own, nearly the width of the box', box.nameW >= box.rowW - 70 && box.groupTop > box.nameTop + 20, JSON.stringify(box));
  const labels = await ev(() => [...document.querySelectorAll('[data-hm="acc:1"] .accbank label')].map(l => l.firstChild.textContent.trim()));
  ok('three new boxes: Sort code, Account number, International number (IBAN)',
    labels.join('|') === 'Sort code|Account number|International number (IBAN)', labels.join('|'));
  ok('  a sort code already saved shows', box.sc === '20-00-00', box.sc);

  const put = async (field, id, v) => { await clearToasts(); await clear();
    // Typed, then the finger moves on: the box loses focus, which is when
    // the phone says it has changed.
    await p.fill(`[data-afield="${id}:${field}"]`, v);
    await p.$eval(`[data-afield="${id}:${field}"]`, e => e.blur());
    await settle(250);
    const w = (await writes('accounts')).filter(x => x.op === 'update');
    return { saved: w.length ? w[0].patch[field] : undefined, shown: await ev(([f, i]) => { const e = document.querySelector(`[data-afield="${i}:${f}"]`); return e ? e.value : null; }, [field, id]),
      who: w.length ? w[0].where[0][2] : null, toast: await toasts() }; };
  let s = await put('sort_code', 2, '401234');
  ok('a sort code typed as six figures is saved as 40-12-34', s.saved === '40-12-34' && s.shown === '40-12-34' && s.who === 2, JSON.stringify(s));
  s = await put('sort_code', 2, '40 12 34');
  ok('  and with spaces, the same', s.saved === '40-12-34', JSON.stringify(s));
  s = await put('sort_code', 2, '4012');
  ok('  four figures: kept as typed, with a word about six', s.saved === '4012' && /six numbers/.test(s.toast), JSON.stringify(s));
  s = await put('account_number', 2, '1234 5678');
  ok('a UK account number: eight figures, no spaces', s.saved === '12345678' && s.shown === '12345678', JSON.stringify(s));
  s = await put('account_number', 8, '123456123456700');
  ok('a New Zealand one (15 figures): 12-3456-1234567-00', s.saved === '12-3456-1234567-00', JSON.stringify(s));
  s = await put('account_number', 8, '1234561234567001');
  ok('  and with a three-figure suffix: 12-3456-1234567-001', s.saved === '12-3456-1234567-001', JSON.stringify(s));
  s = await put('account_number', 8, 'ABC 99');
  ok('  anything else is kept as typed', s.saved === 'ABC 99', JSON.stringify(s));
  s = await put('iban', 5, 'gb29nwbk60161331926819');
  ok('an IBAN: capitals, in groups of four', s.saved === 'GB29 NWBK 6016 1331 9268 19' && s.shown === s.saved, JSON.stringify(s));
  ok('  a good one says nothing', !/IBAN/.test(s.toast), s.toast);
  s = await put('iban', 5, 'GB29 NWBK 6016 1331 9268 18');
  ok('  one figure wrong: saved, with a word that it doesn’t add up', s.saved === 'GB29 NWBK 6016 1331 9268 18' && /doesn’t add up/.test(s.toast), JSON.stringify(s));
  ok('  the check knows a real one from elsewhere (Germany)', await ev(() => ibanOk('DE89 3704 0044 0532 0130 00') && !ibanOk('DE89 3704 0044 0532 0130 01')));
  s = await put('iban', 5, '   ');
  ok('emptying a box clears it', s.saved === null, JSON.stringify(s));

  // Before step 59 is run, the database has no such boxes.
  await ev(() => { const real = sb.from.bind(sb); window.__realFrom = sb.from;
    sb.from = t => { const q = real(t); if (t !== 'accounts') return q; const u = q.update;
      q.update = patch => { const r = u(patch); if ('iban' in patch) r.then = (f, j) => Promise.resolve({ data: null,
        error: { code: 'PGRST204', message: "Could not find the 'iban' column of 'accounts' in the schema cache" } }).then(f, j); return r; };
      return q; }; });
  s = await put('iban', 5, 'GB29NWBK60161331926819');
  ok('before step 59 is run, it says so plainly', /step 59/.test(s.toast), s.toast);
  await ev(() => { sb.from = window.__realFrom; });

  await ev(() => openHelp('money')); await settle(300);
  ok('Help explains the bank details and putting accounts in order', await ev(() => { const t = document.getElementById('h-money').parentElement.textContent;
    return /sort code/.test(t) && /IBAN/.test(t) && /fold down to their names/.test(t); }));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nPutting the accounts in order, with a thumb');
  await openFin();
  const grip = id => ev(i => { const r = document.querySelector(`[data-hm="acc:${i}"] > .grip`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
  const scTop = () => ev(() => $('setBody').scrollTop);
  await ev(() => document.querySelector('[data-hm="acc:2"]').scrollIntoView({ block: 'start' })); await settle(200);
  ok('the boxes are tall: only a few fit on the screen', await ev(() => document.querySelector('[data-hm="acc:2"]').getBoundingClientRect().height > 250));
  ok('it says how to put them in order', await ev(() => /hold the ⠿ beside a name and slide it/.test($('setBody').textContent)));
  await clear();
  let a = await grip(2);
  await touch('touchStart', a.x, a.y); await settle(650);
  const folded = await ev(([x, y]) => { const r = document.querySelector('[data-hm="acc:2"]'), b = r.getBoundingClientRect();
    return { on: r.parentElement.classList.contains('hmfolding'), lifted: r.classList.contains('lifted'),
      hs: [...document.querySelectorAll('[data-hm^="acc:"]')].map(e => Math.round(e.getBoundingClientRect().height)),
      under: b.top <= y && b.bottom >= y, bank: getComputedStyle(r.querySelector('.accbank')).display,
      name: getComputedStyle(r.querySelector('.accname')).display }; }, [a.x, a.y]);
  ok('held still: it lifts, and every box folds down to its name', folded.on && folded.lifted && folded.hs.every(h => h < 75), JSON.stringify(folded));
  ok('  the names still show, nothing else', folded.name !== 'none' && folded.bank === 'none', JSON.stringify(folded));
  ok('  and the held one is still under the finger', folded.under, JSON.stringify(folded));
  // Slide down to just above the Wishlist/Help strip and hold it there.
  const strip = await ev(() => $('tray').getBoundingClientRect().top);
  const y = strip - 24;
  for (let i = 1; i <= 12; i++) { await touch('touchMove', a.x, a.y + (y - a.y) * i / 12); await p.waitForTimeout(16); }
  const st0 = await scTop(); await settle(1200); const st1 = await scTop();
  ok('held just above the Wishlist/Help strip, the screen moves along (it used to need the strip itself)', st1 > st0 + 100, st0 + ' -> ' + st1);
  await touch('touchEnd'); await settle(700);
  let w = (await writes('accounts')).filter(x => x.op === 'update').map(x => x.where[0][2]);
  ok('let go: the new order is saved, and Revolut EUR and beyond came up past it', w.length === 12 && w.indexOf(2) > 4, w.join());
  ok('  and the boxes are back to their full size', await ev(() => !document.querySelector('.hmfolding')
    && document.querySelector('[data-hm^="acc:"]').getBoundingClientRect().height > 250));

  // Moving up still works the same way.
  await openFin(); await clear();
  await ev(() => document.querySelector('[data-hm="acc:10"]').scrollIntoView({ block: 'center' })); await settle(200);
  a = await grip(10);
  const barBottom = await ev(() => $('setBody').getBoundingClientRect().top);
  await touch('touchStart', a.x, a.y); await settle(650);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', a.x, a.y + (barBottom + 20 - a.y) * i / 12); await p.waitForTimeout(16); }
  await settle(1500); await touch('touchEnd'); await settle(700);
  w = (await writes('accounts')).filter(x => x.op === 'update').map(x => x.where[0][2]);
  ok('held near the top: it creeps up, and Amex Gold goes up the list', w.length === 12 && w.indexOf(10) < 5, w.join());
  ok('the visible edge allows for the strip at the bottom', await ev(() => {
    const row = document.querySelector('[data-hm="acc:1"]'); const b = hmBounds({ scroller: hmScroller(row) });
    return Math.abs(b.bottom - $('tray').getBoundingClientRect().top) < 1; }));
  await ev(() => { $('settings').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nJigsaws: the page first (ML218)');
  const wideAt = await ev(() => JIGSAWS.findIndex(j => !j.v));
  await p.route(/jigsawexplorer\.com/, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await ev(() => { window.__turns = []; screen.orientation.lock = o => { window.__turns.push(o); return Promise.resolve(); };
    screen.orientation.unlock = () => { window.__turns.push('unlock'); }; });
  await ev(() => openJig()); await settle(300);
  await p.click(`[data-jig="${wideAt}"]`); await settle(500);
  ok('a landscape puzzle opens on its page: the picture and its words', await ev(() => !$('jigPlay').classList.contains('jigfull')
    && document.querySelector('.jigpic').getBoundingClientRect().top < 300) && (await ev(() => window.__turns.length)) === 0);
  ok('  with Play full screen, on its side above the puzzle', await ev(() => /Play full screen, on its side/.test($('jigGoFull').textContent)
    && $('jigGoFull').getBoundingClientRect().top < document.querySelector('.jigframe').getBoundingClientRect().top));
  await ev(() => $('jigGoFull').click()); await settle(300);
  ok('  which turns it on its side, full screen', await ev(() => $('jigPlay').classList.contains('jigfull') && window.__turns.join() === 'landscape'));
  await ev(() => toast('A message while the puzzle is on its side')); await settle(100);
  ok('  a message then reads the same way round as the puzzle', await ev(() => /matrix\(0, 1, -1, 0/.test(getComputedStyle($('toasts')).transform)),
    await ev(() => getComputedStyle($('toasts')).transform));
  await ev(() => $('jigAll').click()); await settle(300);
  await ev(() => { $('jig').classList.add('hidden'); lockBackground(); });
  ok('back on an ordinary screen, messages are upright again', await ev(() => getComputedStyle($('toasts')).transform === 'none'));

  // ---------------------------------------------------------------
  console.log('\nLoxx: questions on the game sheet, turned with it (ML219)');
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  await ev(() => window.__lkFake());
  const rpcs = name => ev(n => window.__writes.filter(w => w.op === 'rpc' && w.name === n), name);
  await ev(() => openGames()); await settle(300);
  await p.click('#lkNew'); await settle(300);
  await ev(() => document.querySelector('#lkWho input[value="sandra"]').click());
  await p.click('#lkwGo'); await settle(300);
  await p.click('[data-lkfirst="0"]'); await settle(500);
  ok('a game is open, on its side on a phone held upright', await ev(() => !$('lkPlay').classList.contains('hidden')
    && /matrix\(0, 1, -1, 0/.test(getComputedStyle($('lkStage')).transform)));
  native.length = 0; await clear();
  await ev(() => $('lkDone').click()); await settle(300);
  const ask = await ev(() => { const a = document.querySelector('.lkask');
    return a && { inStage: a.parentElement === $('lkStage'), text: a.querySelector('p').textContent,
      btns: [...a.querySelectorAll('button')].map(b => b.textContent), r: a.querySelector('.lkaskin').getBoundingClientRect().toJSON() }; });
  ok('Done with nothing marked: the penalty question is on the game sheet, not the phone’s own box',
    !!ask && ask.inStage && native.length === 0 && /two penalties: minus 10/.test(ask.text), JSON.stringify(ask) + ' ' + native.join('|'));
  ok('  so it turns with the game: taller than it is wide on the upright screen', ask && ask.r.height > ask.r.width, JSON.stringify(ask && ask.r));
  ok('  with plain buttons: Go back, Take them', ask && ask.btns.join() === 'Go back,Take them', JSON.stringify(ask && ask.btns));
  await ev(() => lkPaint()); await settle(100);
  ok('  a redraw while it is open (a live change) leaves it there', await ev(() => !!document.querySelector('#lkStage .lkask')));
  await ev(() => document.querySelector('.lkask [data-ask="0"]').click()); await settle(250);
  ok('Go back: nothing taken, nothing sent', await ev(() => !document.querySelector('.lkask') && lkSheet(lkMe(LK_CUR).sheet).pen === 0)
    && (await rpcs('finish_turn')).length === 0);
  // The game moving on while the question is open: the answer is not acted on.
  await ev(() => $('lkDone').click()); await settle(300);
  await ev(() => { const g = lkGame(LK_CUR); g.turn_no = g.turn_no + 1; }); await clearToasts();
  await ev(() => document.querySelector('.lkask [data-ask="1"]').click()); await settle(300);
  ok('the game moved on while it was asking: no penalty taken, and it says why', await ev(() => lkSheet(lkMe(LK_CUR).sheet).pen === 0)
    && (await rpcs('finish_turn')).length === 0 && /moved on while you were deciding/.test(await toasts()), await toasts());
  await ev(async () => { await lkReload(LK_CUR); lkPaint(); }); await settle(200);
  await ev(() => toast('Your roll')); await settle(100);
  ok('messages during the game read the same way round as the game', await ev(() => /matrix\(0, 1, -1, 0/.test(getComputedStyle($('toasts')).transform)));
  const tr = await ev(() => { const t = document.querySelector('.toast').getBoundingClientRect(); return { l: t.left, w: t.width, h: t.height, iw: innerWidth }; });
  ok('  along the bottom of the game: the left edge of the upright screen', tr.l < 120 && tr.h > tr.w, JSON.stringify(tr));
  native.length = 0; await clear();
  await ev(() => $('lkStop').click()); await settle(300);
  ok('Stop game asks on the sheet too', await ev(() => /Stop this game for everyone/.test((document.querySelector('.lkask p') || {}).textContent || ''))
    && native.length === 0);
  await ev(() => document.querySelector('.lkask [data-ask="1"]').click()); await settle(400);
  ok('  Stop the game: stopped for everyone', (await rpcs('stop_game')).length === 1);
  await ev(() => $('lkOverBack').click()); await settle(300);
  ok('leaving the game, messages go upright again', await ev(() => getComputedStyle($('toasts')).transform === 'none'));
  ok('none of Loxx’s questions use the phone’s own box any more', await ev(() =>
    ![lkTap, lkTakeBack, lkDone, lkCarryOn, lkClearAway, lkStop].some(f => /\bconfirm\(/.test(f.toString()))));
  await ev(() => { $('games').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nWishlist: Tile/Area and Description of idea/change (ML220)');
  await ev(() => openWish()); await settle(400);
  ok('the first box says Tile/Area, the second Description of idea/change', await ev(() =>
    $('wTitle').placeholder === 'Tile/Area' && $('wNotes').placeholder === 'Description of idea/change'));
  await clearToasts(); await ev(() => $('wAdd').click()); await settle(200);
  ok('  nothing in Tile/Area: it asks for it', /tile or area/.test(await toasts()), await toasts());
  await clear();
  await p.fill('#wTitle', 'Finance'); await p.fill('#wNotes', 'Sort codes on the accounts');
  await ev(() => $('wAdd').click()); await settle(400);
  w = (await writes('wishes')).filter(x => x.op === 'insert');
  ok('  added: Tile/Area as the idea, the description as its notes', w.length === 1 && w[0].rows.title === 'Finance' && w[0].rows.notes === 'Sort codes on the accounts', JSON.stringify(w));
  // Copy idea on one with notes, and one without.
  const wid = await ev(() => { WISHES.push({ id: 991, app: WISH_APP, title: 'Loxx', notes: 'Questions the same way round', status: 'idea', created_by: 'me', created_at: new Date().toISOString(), photos: [] },
    { id: 992, app: WISH_APP, title: 'Jigsaws', notes: null, status: 'idea', created_by: 'me', created_at: new Date().toISOString(), photos: [] }); renderWish(); return 991; });
  await ev(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: async s => { window.__copied = s; }, readText: async () => '' } }); });
  await ev(() => document.querySelector('[data-wcopy="991"][data-wfield="t"]').click()); await settle(200);
  ok('Copy idea: Tile/Area on the first line, the description under it', await ev(() => window.__copied) === 'Loxx\nQuestions the same way round', JSON.stringify(await ev(() => window.__copied)));
  // Copy notes went later the same day (ML225): Copy idea already carries it.
  ok('no Copy notes button (it went with ML225)', await ev(() => !document.querySelector('[data-wcopy="991"][data-wfield="n"]')));
  await ev(() => document.querySelector('[data-wcopy="992"][data-wfield="t"]').click()); await settle(200);
  ok('Copy idea with no description: just the Tile/Area', await ev(() => window.__copied) === 'Jigsaws');
  await ev(id => editWish(id), wid); await settle(300);
  ok('Change this idea: the same two headings', await ev(() => { const l = [...document.querySelectorAll('.daypick label')].map(x => x.firstChild.textContent.trim());
    return l[0] === 'Tile/Area' && l[1] === 'Description of idea/change'; }));
  await p.fill('#weNotes', 'Changed words');
  await ev(() => document.querySelector('[data-wecopy="t"]').click()); await settle(200);
  ok('  its Copy idea copies both as they are in the boxes now', await ev(() => window.__copied) === 'Loxx\nChanged words');
  await ev(() => document.querySelector('#weCancel').click()); await settle(200);
  await ev(() => openHelp('wish')); await settle(300);
  ok('Help says what the two boxes are for', await ev(() => /Tile\/Area/.test(document.getElementById('h-wish').parentElement.textContent)));

  console.log('\n' + (errors.length ? errors.join('\n') : 'No page errors.'));
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
