// The second 16 Nov 2026 batch (version 2026.11.16.2, with step 62), driven
// through the real page:
//   ML266 Finances: a SWIFT code on each bank account, with the account
//         number beside the sort code, then the IBAN, then the SWIFT code.
//   ML271 Contacts: United Kingdom for UK, GB, England, Wales and so on, with
//         England, Scotland, Wales or Northern Ireland as Part of the UK.
//   ML203 Loxx with the phone's dice: Real dice ticked or not when starting,
//         a Roll button, the same six dice on every phone, and the numbers
//         they allow ringed. Two phones on step 62's real SQL: twophone.test.js.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object|NotAllowedError|Object not found|no photo/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
    permissions: ['geolocation'], geolocation: { latitude: 51.5005, longitude: -1.2505 } });
  const p = await ctx.newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  // No real address lookups: a made-up answer, in Wales.
  await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({
    contentType: 'application/json', body: JSON.stringify({ display_name: 'x',
      address: { house_number: '4', road: 'Lock Lane', town: 'Testtown', county: 'Testshire',
        state: 'Wales', postcode: 'ZZ9 9ZZ', country: 'United Kingdom' } }) }));
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  const asked = [];
  await answerLkAsks(p, m => { asked.push(m); return true; });
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const writes = (op, t) => ev(([o, t]) => window.__writes.filter(w => w.op === o && (!t || w.table === t)), [op, t]);
  const rpcs = name => ev(n => window.__writes.filter(w => w.op === 'rpc' && w.name === n), name);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); window.__lkFake(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  const V = VJ.history.find(h => h.version === '2026.11.16.2');
  ok('2026.11.16.2 is in version.json, and the page is the newest', !!V && VJ.version === appVer && VJ.history[0].version === appVer, appVer + ' / ' + VJ.version);
  const said = (V ? V.changes : []).join(' ');
  ok('  saying what changed: SWIFT, Part of the UK, Loxx with the phone’s dice, step 62', /SWIFT/.test(said)
    && /Part of the UK/.test(said) && /Loxx/.test(said) && /step 62/.test(said), said);
  ok('  each line short enough for the What’s new list', (V ? V.changes : []).every(c => c.length < 160));

  // ---------------------------------------------------------------
  console.log('\nML266 Finances: the SWIFT code, under the IBAN');
  await ev(() => { window.__rows.accounts = [{ id: 1, name: 'Test Current', group_name: 'Test', kind: 'current',
    currency: 'GBP', opening_balance: 0, opening_date: '2026-08-31', active: true, sort: 10, created_by: 'me',
    sort_code: '20-00-00', account_number: '12345678', iban: 'GB33BUKB20201555555555', swift: null }]; });
  await ev(async () => { await loadMoney(); openSettings('Finances'); }); await settle(500);
  await ev(() => document.querySelectorAll('.card.logsec').forEach(d => d.open = true)); await settle(150);
  await ev(() => document.querySelector('[data-afold="1"]').click()); await settle(300);
  const at = k => ev(k => { const r = document.querySelector(`[data-afield="1:${k}"]`).getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; }, k);
  const sc = await at('sort_code'), an = await at('account_number'), ib = await at('iban'), sw = await at('swift');
  ok('the account number sits beside the sort code, on the same line', Math.abs(sc.y - an.y) <= 2 && an.x > sc.x + sc.w - 2,
    JSON.stringify([sc, an]));
  ok('  the IBAN under them, and the SWIFT code under that, each the full width', ib.y > sc.y + 10 && sw.y > ib.y + 10
    && Math.abs(ib.x - sc.x) <= 2 && Math.abs(sw.x - sc.x) <= 2 && Math.abs(sw.w - ib.w) <= 2, JSON.stringify([ib, sw]));
  ok('  the SWIFT box is called SWIFT code (BIC), with an example', await ev(() => {
    const i = document.querySelector('[data-afield="1:swift"]');
    return /SWIFT code \(BIC\)/.test(i.closest('label').textContent) && i.placeholder === 'ABCDGB22'; }));
  await clear(); await clearToasts();
  await p.fill('[data-afield="1:swift"]', ' bukb gb 22 ');
  await p.$eval('[data-afield="1:swift"]', e => e.blur()); await settle(400);
  let up = (await writes('update', 'accounts'));
  ok('typed with spaces and in small letters, it is saved in capitals, run together', up.length === 1 && up[0].patch.swift === 'BUKBGB22'
    && await ev(() => document.querySelector('[data-afield="1:swift"]').value) === 'BUKBGB22', JSON.stringify(up));
  ok('  a good one, for the same country as the IBAN: nothing to warn about', !/SWIFT/.test(await toasts()), await toasts());
  await clearToasts();
  await p.fill('[data-afield="1:swift"]', 'BUKB');
  await p.$eval('[data-afield="1:swift"]', e => e.blur()); await settle(400);
  ok('too short: saved, with a word on what a SWIFT code looks like', /A SWIFT code is 8 or 11 letters and numbers/.test(await toasts()), await toasts());
  await clearToasts();
  await p.fill('[data-afield="1:swift"]', 'DEUTDEFF500');
  await p.$eval('[data-afield="1:swift"]', e => e.blur()); await settle(400);
  ok('11 letters for a German bank, with a UK IBAN: saved, but worth checking', /SWIFT code is for DE and the IBAN for GB/.test(await toasts()), await toasts());
  ok('  the Help says where the SWIFT code goes', /SWIFT code/.test(SRC.split('id="h-money"')[1] || SRC));
  await ev(() => { $('settings').classList.add('hidden'); lockBackground(); });

  // ---------------------------------------------------------------
  console.log('\nML271 Contacts: Part of the UK');
  ok('England, Scotland, Wales and Northern Ireland become United Kingdom, with that part', await ev(() =>
    [['Wales', 'Wales'], ['england', 'England'], [' SCOTLAND ', 'Scotland'], ['Northern  Ireland', 'Northern Ireland']]
      .every(([t, part]) => { const x = countryFix(t); return x.country === 'United Kingdom' && x.part === part; })));
  ok('  UK, GB and Great Britain keep a part already chosen', await ev(() =>
    ['UK', 'gb', 'Great Britain', 'United Kingdom'].every(t => { const x = countryFix(t, 'Scotland'); return x.country === 'United Kingdom' && x.part === 'Scotland'; })
    && countryFix('UK').part === null));
  ok('  anywhere else has no part, whatever was chosen', await ev(() => countryFix('France', 'Wales').part === null
    && countryFix('NZ', 'Wales').country === 'New Zealand' && countryFix('', 'Wales').country === null));
  ok('  an import is tidied the same way, with no part where there is none', await ev(() => {
    const a = tidyCountry({ first_name: 'A', country: 'Wales' }), n = tidyCountry({ first_name: 'N', country: 'NZ', uk_part: 'Wales' });
    return a.country === 'United Kingdom' && a.uk_part === 'Wales' && n.country === 'New Zealand' && !('uk_part' in n); }));
  ok('  and Grouped puts a Wales contact under United Kingdom', await ev(() => countryName('Wales') === 'United Kingdom'));

  await ev(() => openEditor(null)); await settle(600);
  const partShown = () => ev(() => getComputedStyle($('ukPartL')).display !== 'none');
  ok('a new contact: no Part of the UK box until the country is the UK', !(await partShown()));
  const typeCountry = (t, change = true) => ev(([t, change]) => { const i = $('edForm').elements.country; i.value = t;
    i.dispatchEvent(new Event('input')); if (change) i.dispatchEvent(new Event('change')); }, [t, change]);
  await typeCountry('UK', false);
  ok('  typing UK shows it, under the country', await partShown() && await ev(() =>
    $('ukPartL').getBoundingClientRect().top > $('edForm').elements.country.getBoundingClientRect().top));
  ok('  with Not said and the four parts to choose from', await ev(() => [...$('edForm').elements.uk_part.options].map(o => o.text).join()
    === 'Not said,England,Scotland,Wales,Northern Ireland'));
  await typeCountry('UK');
  ok('  moving on, UK becomes United Kingdom', await ev(() => $('edForm').elements.country.value) === 'United Kingdom');
  await typeCountry('Wales');
  ok('  Wales becomes United Kingdom, with Wales chosen for you', await ev(() => $('edForm').elements.country.value === 'United Kingdom'
    && $('edForm').elements.uk_part.value === 'Wales') && await partShown());
  await typeCountry('France');
  ok('  France: the box goes', !(await partShown()));
  await p.click('#homeMap .herebtn'); await settle(900);
  ok('Our location in Wales fills in United Kingdom, part Wales', await ev(() => $('edForm').elements.country.value === 'United Kingdom'
    && $('edForm').elements.uk_part.value === 'Wales') && await partShown());
  await ev(() => { killMaps(); $('editor').classList.add('hidden'); lockBackground(); });

  // Saving: the part goes with the contact, and only when there is one.
  // The editor reads the contact afresh from the database, so it is changed there.
  const dbContact = patch => ev(patch => { const c = window.__rows.contacts.find(x => x.id === 1);
    Object.assign(c, patch, { updated_at: '2026-11-16T09:00:00Z', contact_groups: [{ group_id: 1 }] });
    if (patch.uk_part === undefined) delete c.uk_part; }, patch);
  await dbContact({ country: 'Wales' });
  await ev(() => openEditor(CONTACTS.find(c => c.id === 1))); await settle(600);
  ok('a contact saved as Wales opens with the box showing', await partShown());
  await clear();
  await ev(() => { const i = $('edForm').elements.country; i.dispatchEvent(new Event('change')); }); await settle(100);
  await ev(() => $('edSave').click()); await settle(600);
  up = await writes('update', 'contacts');
  ok('  saved: United Kingdom, part Wales', up.length >= 1 && up[0].patch.country === 'United Kingdom' && up[0].patch.uk_part === 'Wales', JSON.stringify(up.map(u => u.patch && [u.patch.country, u.patch.uk_part])));
  await ev(() => { killMaps(); $('editor').classList.add('hidden'); lockBackground(); });
  await dbContact({ country: 'France' });
  await ev(() => openEditor(CONTACTS.find(c => c.id === 1))); await settle(600);
  await clear();
  await ev(() => $('edSave').click()); await settle(600);
  up = await writes('update', 'contacts');
  ok('  a contact in France is saved with no part at all, so it saves before step 62 too', up.length >= 1
    && up[0].patch.country === 'France' && !('uk_part' in up[0].patch), JSON.stringify(up.map(u => u.patch && Object.keys(u.patch).filter(k => /country|uk/.test(k)))));
  await ev(() => { killMaps(); $('editor').classList.add('hidden'); lockBackground(); });
  await dbContact({ country: 'United Kingdom', uk_part: 'Wales' });
  await ev(() => { const c = CONTACTS.find(x => x.id === 1); c.country = 'United Kingdom'; c.uk_part = 'Wales'; });
  await ev(() => openDetail(1)); await settle(500);
  ok('the contact’s card says Wales, United Kingdom', await ev(() => /Wales, United Kingdom/.test(document.body.innerText)));
  ok('  and searching for Wales finds them', await ev(() => matches(CONTACTS.find(c => c.id === 1), 'wales')));
  await ev(() => { [CONTACTS.find(x => x.id === 1), window.__rows.contacts.find(x => x.id === 1)].forEach(c => { delete c.country; delete c.uk_part; }); });
  await ev(() => { if (typeof closeDetail === 'function') closeDetail(); });

  // ---------------------------------------------------------------
  console.log('\nML203 Loxx: starting a game, with Real dice ticked or not');
  await p.setViewportSize({ width: 844, height: 390 });
  await ev(() => { closeAllSheets && closeAllSheets(); }).catch(() => {});
  await ev(() => openGames()); await settle(500);
  await clear();
  await p.click('#lkNew'); await settle(300);
  ok('New game asks about the dice first, with Real dice ticked, as Loxx has always been', await ev(() => !!$('lkWho')
    && $('lkwReal').checked && !/Play again/.test($('lkWho').textContent)
    && $('lkwReal').getBoundingClientRect().top < $('lkWho').querySelector('.ppl').getBoundingClientRect().top));
  await ev(() => document.querySelector('#lkWho input[value="sandra"]').click());
  await p.click('#lkwGo'); await settle(300);
  ok('  real dice: everyone rolls one die to see who starts, as before', await ev(() => /first to roll a 6 starts/.test($('lkFirst').textContent)));
  await p.click('[data-lkfirst="0"]'); await settle(600);
  ok('  started with step 57’s new_game, as before', (await rpcs('new_game')).length === 1 && (await rpcs('new_loxx')).length === 0);
  ok('  the sheet as it always was: no Roll button, no dice, Done ready', await ev(() => !$('lkRoll') && !document.querySelector('.lkdice')
    && !$('lkDone').disabled && /The white dice total in any row/.test($('lkStatus').textContent)));
  const RG = await ev(() => LK_CUR);
  await ev(() => lkBackToList()); await settle(300);

  await clear();
  await p.click('#lkNew'); await settle(300);
  await ev(() => { $('lkwReal').click(); document.querySelector('#lkWho input[value="sandra"]').click(); });
  await p.click('#lkwGo'); await settle(300);
  if (await ev(() => !!$('lkAlready'))) { await p.click('#lkaNew'); await settle(300); }
  ok('Real dice unticked: who rolls first says the phone rolls the dice', await ev(() => /The phone rolls the dice/.test($('lkFirst').textContent)));
  await p.click('[data-lkfirst="0"]'); await settle(600);
  let r = await rpcs('new_loxx');
  ok('  started with step 62’s new_loxx, the phone’s dice', r.length === 1 && r[0].args.real_dice === false
    && r[0].args.players.join() === 'me,sandra' && (await rpcs('new_game')).length === 0, JSON.stringify(r));
  const G = await ev(() => LK_CUR);
  const status = () => ev(() => $('lkStatus').textContent.replace(/\s+/g, ' ').trim());
  ok('  Your roll. Tap Roll, a Roll button, Done greyed', /Your roll\. Tap Roll/.test(await status())
    && await ev(() => !!$('lkRoll') && $('lkDone').disabled), await status());
  ok('  everything fits across the sheet: the bar no taller than two lines, nothing off the edge', await ev(() => {
    const bar = document.querySelector('.lkbar').getBoundingClientRect(), st = $('lkStage').getBoundingClientRect();
    return bar.height < 60 && [...document.querySelectorAll('.lkbar > *')].every(e => e.getBoundingClientRect().right <= st.right + 1); }));
  await clearToasts();
  await p.click('[data-lk="red:5"]'); await settle(250);
  ok('  a number tapped before rolling: Tap Roll first, and nothing marked', /Tap Roll first/.test(await toasts())
    && await ev(() => lkSheet(lkMe(LK_CUR).sheet).red.length === 0), await toasts());
  await clear();
  await p.click('#lkRoll'); await settle(500);
  r = await rpcs('loxx_dice');
  const v = await ev(() => lkDice(lkGame(LK_CUR)));
  ok('Roll: six dice, sent for roll 1', r.length === 1 && r[0].args.at_turn === 1 && JSON.stringify(r[0].args.d.v) === JSON.stringify(v)
    && v.every(n => n >= 1 && n <= 6), JSON.stringify(r));
  ok('  shown in the bar: two white, then red, yellow, green and blue', await ev(() => {
    const d = [...document.querySelectorAll('#lkDice .lkdie')];
    return d.length === 6 && d.map(x => x.style.getPropertyValue('--dc')).join() === ['#FBFAF5', '#FBFAF5', ...LK_ROWS.map(r => r.bg)].join()
      && d.every(x => x.querySelectorAll('circle').length >= 1); }));
  ok('  and said aloud for a screen reader', await ev(() => /^The dice: white \d, white \d, red \d, yellow \d, green \d, blue \d$/
    .test($('lkDice').getAttribute('aria-label'))), await ev(() => $('lkDice').getAttribute('aria-label')));
  ok('  the words give the white dice total', new RegExp('White dice ' + (v[0] + v[1]) + ', or a white and a colour').test(await status()), await status());
  ok('  Done ready now, and the Roll button gone', await ev(() => !$('lkDone').disabled && !$('lkRoll')));
  const ringed = await ev(() => [...document.querySelectorAll('.lkn.hint')].map(b => b.dataset.lk).sort().join());
  const want = [...new Set(['red', 'yellow', 'green', 'blue'].flatMap((c, i) => [v[0] + v[1], v[0] + v[2 + i], v[1] + v[2 + i]].map(n => c + ':' + n)))].sort().join();
  ok('  ringed: the white total in every row, and each white with each colour in its row', ringed === want, ringed + ' / ' + want);
  await clearToasts();
  await ev(() => lkRollDice()); await settle(300);
  ok('  no rolling twice', /dice are out/.test(await toasts()) && (await rpcs('loxx_dice')).length === 1, await toasts());

  console.log('\nA closed lock’s die is left out');
  const as = async (who, name, args) => { await ev(([w, n, a]) => { window.__who = w; const r = window.__rpc(n, a); window.__who = null; return r; }, [who, name, args]);
    await ev(async () => { await lkReload(LK_CUR); lkPaint(); }); await settle(150); };
  await as('sandra', 'close_row', { g: G, colour: 'red' });
  await p.click('#lkDone'); await settle(400);         // the penalty for no marks is answered yes
  await as('sandra', 'finish_turn', { g: G, at_turn: 1 });
  ok('Sandra’s roll: waiting for her dice, six empty ones, no Roll button', /Sandra is rolling\. Waiting for the dice/.test(await status())
    && await ev(() => !$('lkRoll') && document.querySelectorAll('.lkdie.blank').length === 6), await status());
  await as('sandra', 'loxx_dice', { g: G, at_turn: 2, d: { v: [1, 2, 0, 3, 4, 5] } });
  ok('  her dice arrive: red set aside, faded, with no spots', await ev(() => {
    const d = [...document.querySelectorAll('#lkDice .lkdie')];
    return d.length === 6 && d[2].classList.contains('off') && !d[2].querySelector('circle') && d.filter(x => x.classList.contains('off')).length === 1; }));
  ok('  White dice 3: yours too', /White dice 3: yours too/.test(await status()), await status());
  ok('  ringed: the 3 in yellow, green and blue only, not in the closed red row', await ev(() =>
    [...document.querySelectorAll('.lkn.hint')].map(b => b.dataset.lk).sort().join()) === 'blue:3,green:3,yellow:3');
  await p.click('#lkDone'); await settle(400);
  await as('sandra', 'finish_turn', { g: G, at_turn: 2 });
  await clear();
  await p.click('#lkRoll'); await settle(500);
  r = await rpcs('loxx_dice');
  ok('your roll again: the phone leaves the red die out (0), and the roll is taken', r.length === 1 && r[0].args.d.v[2] === 0
    && r[0].args.d.v.filter((n, i) => i !== 2).every(n => n >= 1) && !!(await ev(() => lkDice(lkGame(LK_CUR)))), JSON.stringify(r));

  console.log('\nBefore step 62 is run');
  await ev(() => lkBackToList()); await settle(300);
  await ev(() => { const was = window.__rpc; window.__rpc = (n, a) => n === 'new_loxx'
    ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.new_loxx' } } : was(n, a); window.__was = was; });
  await clearToasts();
  await p.click('#lkNew'); await settle(300);
  await ev(() => { $('lkwReal').click(); document.querySelector('#lkWho input[value="other"]').click(); });
  await p.click('#lkwGo'); await settle(300);
  await p.click('[data-lkfirst="0"]'); await settle(500);
  ok('the phone’s dice say step 62 is needed', /phone’s dice need step 62/.test(await toasts()), await toasts());
  await ev(() => { window.__rpc = window.__was; });
  ok('  a game with real dice still starts without it', !!(await ev(id => lkGame(id), RG)));

  console.log('\nHelp');
  const help = SRC.split('id="h-games"')[1].split('<h4')[0];
  ok('How to play explains the phone’s dice: Real dice, Roll, the white rings', /Real dice/.test(help) && /<strong>Roll<\/strong>/.test(help)
    && /white ring/.test(help) && /Play again/.test(help));

  console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
