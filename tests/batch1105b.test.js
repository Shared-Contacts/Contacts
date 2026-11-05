// The second 5 Nov 2026 batch. Versions: the app says when a new version is
// ready, with what changed and a Restart now button, and Menu > What's new
// lists every change (ML195). People: each sign-in's name and phone, filled in
// from Contacts, and shown as name, email and phone wherever people are
// chosen; Barry and Sandra can fill in anyone's (ML196, with step 56).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|set_person|PGRST202/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  let answer = true; const asked = [];
  p.on('dialog', d => { asked.push(d.message()); return answer ? d.accept() : d.dismiss(); });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const top = () => ev(() => SHEET_STACK[SHEET_STACK.length - 1]);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); lockBackground(); });
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const rpcs = name => ev(n => window.__writes.filter(w => w.op === 'rpc' && w.name === n), name);
  const clear = () => ev(() => { window.__writes.length = 0; });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });
  // The page is opened from a file in here, so there is no version.json beside
  // it. A suite hands it one by standing in for the fetch.
  const serve = info => ev(i => { window.fetchVersionInfo = async () => i ? JSON.parse(JSON.stringify(i)) : null; }, info);
  const NEWER = { version: '2099.12.31.1', history: [
    { version: '2099.12.31.1', changes: ['Something better on Today.', 'A fix in Finances.'] }].concat(VJ.history) };

  // ---------------------------------------------------------------
  console.log('\nThe version file and the page agree (ML195)');
  const appVer = await ev(() => APP_VERSION);
  ok('version.json names the version the page says it is', VJ.version === appVer, VJ.version + ' / ' + appVer);
  ok('  and its newest entry is that version', VJ.history[0] && VJ.history[0].version === appVer);
  ok('the history is newest first, each version once', await ev(h => h.every((x, i) => i === 0 || verCmp(h[i - 1].version, x.version) > 0), VJ.history));
  ok('  every entry says what changed, in a line or two each', VJ.history.every(h => Array.isArray(h.changes) && h.changes.length
    && h.changes.every(c => typeof c === 'string' && c.length > 10 && c.length < 160)));
  ok('the page is opened from a file: it does not go looking for one', await ev(async () => (await fetchVersionInfo()) === null)
    && !(await p.$('#verBar')) && !(await p.$('#verNotice')));

  console.log('\nComparing versions');
  ok('a later update the same day is newer', await ev(() => verCmp('2026.11.05.2', '2026.11.05.1') === 1));
  ok('the number of the day counts, not the spelling of it', await ev(() => verCmp('2026.11.10.1', '2026.11.9.3') === 1 && verCmp('2026.11.05.1', '2026.11.5.1') === 0));
  ok('an older one is older', await ev(() => verCmp('2026.11.04.3', '2026.11.05.1') === -1));
  ok('nothing seen yet counts as older than anything', await ev(() => verCmp('', '2026.11.02.1') === -1));
  ok('shown in words: 5 Nov 2026, update 2', await ev(() => verWords('2026.11.05.2')) === '5 Nov 2026, update 2', await ev(() => verWords('2026.11.05.2')));
  ok('  the first of the day is just the date', await ev(() => verWords('2026.11.05.1')) === '5 Nov 2026');

  // ---------------------------------------------------------------
  console.log('\nWhat’s new on Today, once, after a restart');
  await serve(VJ);
  await ev(() => { localStorage.removeItem('ver-seen'); });
  await settle(200);
  await ev(() => checkVersion(true)); await settle(300);
  ok('no bar: this is the newest version', !(await p.$('#verBar')));
  ok('a first visit: the notice shows just this version’s changes', await ev(() => {
    const n = $('verNotice'); return !!n && n.querySelectorAll('.vnwhen').length === 1; }),
    await ev(() => $('verNotice') ? $('verNotice').textContent.slice(0, 200) : 'no notice'));
  ok('  with its first change in it', await ev(t => $('verNotice').textContent.includes(t), VJ.history[0].changes[0]));
  ok('  it is the first thing on the opening screen', await ev(() => $('homeBody').firstElementChild.id === 'verNotice'));
  await p.click('#verSeenGo'); await settle(200);
  ok('Got it: gone, and remembered', !(await p.$('#verNotice')) && await ev(() => localStorage.getItem('ver-seen')) === appVer);
  await ev(() => { renderHome(); }); await ev(() => checkVersion(true)); await settle(200);
  ok('  it does not come back', !(await p.$('#verNotice')));
  await ev(() => { localStorage.setItem('ver-seen', '2026.11.04.1'); renderHome(); }); await settle(200);
  const since = await ev(() => [...$('verNotice').querySelectorAll('.vnwhen')].map(x => x.textContent));
  const want = await ev(h => h.filter(x => verCmp(x.version, '2026.11.04.1') > 0 && verCmp(x.version, APP_VERSION) <= 0)
    .map(x => verWords(x.version)), VJ.history);
  ok('last seen on 4 Nov: everything since then, newest first', since.length >= 4 && since.join() === want.join()
    && since[0] === await ev(v => verWords(v), appVer) && since[since.length - 1] === '4 Nov 2026, update 2', since.join(' | '));
  await p.click('#verSeenX'); await settle(200);
  ok('  the × marks it seen too', !(await p.$('#verNotice')) && await ev(() => localStorage.getItem('ver-seen')) === appVer);

  // ---------------------------------------------------------------
  console.log('\nA new version is ready');
  await serve(NEWER); await ev(() => checkVersion(true)); await settle(300);
  ok('the bar comes up', !!(await p.$('#verBar')));
  const bar = await ev(() => ({ t: $('verBar').textContent.replace(/\s+/g, ' '),
    r: $('verBar').getBoundingClientRect().toJSON(), tray: $('tray').getBoundingClientRect().top,
    w: innerWidth, z: getComputedStyle($('verBar')).zIndex }));
  ok('  saying so, with the first change and how many more', /A new version of the app is ready/.test(bar.t)
    && bar.t.includes('Something better on Today.') && /and 1 more/.test(bar.t), bar.t);
  ok('  with Restart now, What’s new and an ×', !!(await p.$('#verGo')) && !!(await p.$('#verWhat')) && !!(await p.$('#verLater')));
  ok('  inside the screen, above the tiles at the bottom', bar.r.left >= 0 && bar.r.right <= bar.w && bar.r.bottom <= bar.tray + 1, JSON.stringify(bar));
  ok('  the buttons are big enough for a thumb', await ev(() => ['verGo', 'verWhat', 'verLater'].every(id => {
    const r = $(id).getBoundingClientRect(); return r.height >= 40 && r.width >= 40; })),
    JSON.stringify(await ev(() => ['verGo', 'verWhat', 'verLater'].map(id => { const r = $(id).getBoundingClientRect(); return [r.width, r.height]; }))));
  await ev(() => checkVersion(true)); await settle(200);
  ok('checking again does not make a second bar', await ev(() => document.querySelectorAll('#verBar').length) === 1);
  ok('the menu says so too', await ev(() => { openMenu(); return /a new version is ready/.test($('menuBody').textContent); }));
  await ev(() => shutMenu());

  // While you type, the keyboard would push it up over the form.
  await ev(() => { const i = document.createElement('input'); i.id = 'tmpType'; document.body.appendChild(i); });
  await p.focus('#tmpType'); await settle(100);
  ok('out of the way while you are typing', await ev(() => getComputedStyle($('verBar')).display === 'none'));
  await ev(() => { $('tmpType').blur(); $('tmpType').remove(); }); await settle(100);
  ok('  and back when you stop', await ev(() => getComputedStyle($('verBar')).display !== 'none'));

  await clearToasts();
  await p.click('#verLater'); await settle(200);
  ok('× puts it off: gone, with a word about when', !(await p.$('#verBar')) && /again in an hour/.test(await toasts()), await toasts());
  await ev(() => checkVersion(true)); await settle(200);
  ok('  it stays away for the hour, even when checking again', !(await p.$('#verBar')));
  await ev(() => { VER.later = Date.now() - 1; paintVerBar(); }); await settle(100);
  ok('  and comes back after it', !!(await p.$('#verBar')));

  // ---------------------------------------------------------------
  console.log('\nWhat’s new, from the bar and the menu');
  await p.click('#verWhat'); await settle(400);
  ok('opens over whatever is on the screen', await top() === 'verSheet');
  let wn = await ev(() => $('verBody').textContent.replace(/\s+/g, ' '));
  ok('  saying which version this phone has, and the newer one', wn.includes(await ev(() => verWords(APP_VERSION))) && wn.includes('31 Dec 2099') && /newer one/.test(wn), wn.slice(0, 200));
  ok('  with a Restart now button', !!(await p.$('#verGo2')));
  ok('  and every change there has been, newest first', await ev(n => {
    const w = [...$('verBody').querySelectorAll('.vnwhen')].map(x => x.textContent);
    return w.length === n && w[0] === '31 Dec 2099'; }, NEWER.history.length));
  ok('  it starts at the top', await ev(() => $('verBody').scrollTop === 0));
  await p.click('#verBack'); await settle(200);
  ok('Back closes it', await ev(() => $('verSheet').classList.contains('hidden')));

  await serve(VJ); await ev(() => { VER.info = null; VER.at = 0; checkVersion(true); }); await settle(200);
  ok('once that is the version running, the bar goes', !(await p.$('#verBar')));
  await ev(() => openMenu()); await settle(150);
  ok('  and the menu row is just What’s new', await ev(() => { const r = $('menuBody').querySelector('[data-mver]');
    return !!r && /What.s new/.test(r.textContent) && !/new version is ready/.test(r.textContent); }));
  await ev(() => $('menuBody').querySelector('[data-mver]').click()); await settle(400);
  ok('  which opens the list', await top() === 'verSheet' && await ev(() => /That is the newest/.test($('verBody').textContent)));
  ok('  with no Restart button', !(await p.$('#verGo2')));
  await serve(null); await ev(() => { VER.info = null; VER.at = 0; }); await ev(() => openWhatsNew()); await settle(300);
  ok('no signal: says it could not fetch the list, not an empty one', await ev(() => /Could not fetch the list of changes/.test($('verBody').textContent.replace(/\s+/g, ' '))),
    await ev(() => $('verBody').textContent.replace(/\s+/g, ' ').slice(0, 200)));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nPeople: names, then email and phone (ML196)');
  const pn = await ev(() => [
    personName({ display_name: 'b@example.com', email: 'b@example.com' }),
    personName({ display_name: 'B@Example.com ', email: 'b@example.com' }),
    personName({ display_name: 'Sandra', email: 's@example.com' }),
    personName({ display_name: '  ', email: 'pat@example.com' }),
    personName(null), personName({})]);
  ok('a name that is still the email shows as the start of it', pn[0] === 'b' && pn[1] === 'b', pn.join(' | '));
  ok('a proper name shows as itself', pn[2] === 'Sandra');
  ok('no name at all: the start of the email, or Someone', pn[3] === 'pat' && pn[4] === 'Someone' && pn[5] === 'Someone', pn.join(' | '));
  ok('the details line: email · phone, or just the email', await ev(() =>
    personDetail({ email: 'e@example.com', phone: '07700 900000' }) === 'e@example.com · 07700 900000'
    && personDetail({ email: 'e@example.com' }) === 'e@example.com'));
  ok('a name with < in it is drawn as text', await ev(() => !/<i>/.test(pplWho({ display_name: '<i>x</i>', email: 'x@example.com' }))));

  // Everyone, in name order. Before step 56, Sandra's name could be her email.
  await ev(async () => {
    window.__rows.profiles = [{ id: 'me', display_name: 'Barry', email: 'b@example.com', theme: 'ink' },
      { id: 'zed', display_name: 'zed@example.com', email: 'zed@example.com' },
      { id: 'sandra', display_name: 'Sandra', email: 's@example.com', phone: '07700 900111' },
      { id: 'other', display_name: 'Annie Example', email: 'e@example.com' }];
    window.__rows.app_owners = [];
    await loadAll(); });
  ok('the others are in name order, whatever their email', await ev(() => USERS.map(personName).join()) === 'Annie Example,Sandra,zed',
    await ev(() => USERS.map(personName).join()));

  await ev(() => openWhere()); await settle(400);
  const rows = await ev(() => [...document.querySelectorAll('.checks.ppl label')].filter(l => l.querySelector('[name="shareWith"]')).map(l => ({
    b: (l.querySelector('.pplwho b') || {}).textContent, s: (l.querySelector('.pplwho small') || {}).textContent,
    box: !!l.querySelector('input[type=checkbox]'), w: l.getBoundingClientRect().width, h: l.getBoundingClientRect().height,
    left: l.querySelector('input').getBoundingClientRect().left < l.querySelector('.pplwho').getBoundingClientRect().left })));
  ok('choosing who sees where you are: a row each', rows.length === 3 && rows.every(r => r.box), JSON.stringify(rows));
  ok('  the name in bold, then email · phone underneath', rows[1] && rows[1].b === 'Sandra' && rows[1].s === 's@example.com · 07700 900111', JSON.stringify(rows[1]));
  ok('  the tick box on the left', rows.every(r => r.left));
  ok('  the full width, and tall enough to tap', rows.every(r => r.w > 300 && r.h >= 40), JSON.stringify(rows.map(r => [r.w, r.h])));
  ok('  one above the other', await ev(() => { const l = [...document.querySelectorAll('.checks.ppl label')].filter(x => x.querySelector('[name="shareWith"]'));
    return l.length > 1 && l[1].getBoundingClientRect().top >= l[0].getBoundingClientRect().bottom - 1; }));
  ok('  ticking one still picks that person', await ev(() => { const i = document.querySelector('[name="shareWith"][value="sandra"]');
    i.closest('label').click(); return i.checked; }));
  await closeAll();

  // A long list taller than the screen once hung off the top, out of reach
  // (Barry, Send to with 14 people, 5 Nov 2026).
  await ev(async () => { for (let i = 0; i < 14; i++) window.__rows.profiles.push({ id: 'many' + i,
    display_name: 'Person Number ' + i, email: 'person.number' + i + '@example.com', phone: '07700 9000' + (10 + i) });
    await loadAll(); pickPeople('Who should get a copy?', () => {}); });
  await settle(300);
  const tall = await ev(() => { const box = document.querySelector('.daypick'); box.scrollTop = 0;
    const t = box.querySelector('.dsec').getBoundingClientRect(), inner = box.querySelector('.inner').getBoundingClientRect();
    box.scrollTop = box.scrollHeight; const go = $('ppGo').getBoundingClientRect();
    return { title: t.top, tall: inner.height > innerHeight, goBottom: go.bottom, h: innerHeight }; });
  ok('a list taller than the screen: scrolled up, the top is there to see', tall.tall && tall.title >= 0 && tall.title < 60, JSON.stringify(tall));
  ok('  and scrolled down, so is Send', tall.goBottom <= tall.h, JSON.stringify(tall));
  await closeAll();
  await ev(async () => { window.__rows.profiles = window.__rows.profiles.filter(x => !/^many/.test(x.id)); await loadAll(); });
  await ev(() => pickPeople('Short list', () => {})); await settle(200);
  ok('  a short one still sits in the middle of the screen', await ev(() => { const r = document.querySelector('.daypick .inner').getBoundingClientRect();
    return Math.abs(r.top - (innerHeight - r.bottom)) < 4 && r.top > 40; }));
  await ev(() => document.querySelector('.daypick').classList.add('typing')); await settle(100);
  ok('  and goes to the top while typing, as before', await ev(() => document.querySelector('.daypick .inner').getBoundingClientRect().top <= 12));
  await closeAll();

  // Every place people are chosen, as the page is written.
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const pickers = (src.match(/\$\{pplWho\(u\)\}/g) || []).length;
  ok('every place people are chosen shows them this way (11 lists, plus Finances)', pickers >= 12, pickers);
  ok('  every list of tick boxes for people is drawn as rows', !/<div class="checks"[^>]*>\s*\$\{(USERS|spare)\.map/.test(src)
    && (src.match(/class="checks ppl"/g) || []).length >= 9);
  ok('  nowhere still shows the email as the name', !/display_name\|\|u\.email/.test(src) && !/display_name\|\|x\.u\.email/.test(src));

  // ---------------------------------------------------------------
  console.log('\nOwners: from the database once step 56 has run');
  ok('no owners table yet: the old rule (Barry is one)', await ev(() => OWNERS === null && isOwner() === true));
  await ev(async () => { window.__rows.app_owners = [{ user_id: 'sandra' }]; await loadAll(); });
  ok('the table says Sandra: so she is, and Barry is not', await ev(() => OWNERS.join() === 'sandra' && isOwner() === false));
  await ev(async () => { window.__rows.app_owners = [{ user_id: 'sandra' }, { user_id: 'me' }]; await loadAll(); });
  ok('the table says both: Barry is one again', await ev(() => isOwner() === true));

  // ---------------------------------------------------------------
  console.log('\nSettings > The app > People who can sign in');
  const openPeople = async () => { await ev(() => openSettings('People who can sign in')); await settle(500);
    await ev(() => { const d = document.querySelector('[data-setcard="people"]'); if (d) d.open = true; }); await settle(100); };
  await openPeople();
  let card = await ev(() => { const d = document.querySelector('[data-setcard="people"]');
    return { rows: [...d.querySelectorAll('.pplrow')].map(r => ({ t: r.textContent.replace(/\s+/g, ' ').trim(), tap: r.tagName === 'BUTTON',
      own: !!r.querySelector('.pplown') })), text: d.textContent.replace(/\s+/g, ' ') }; });
  ok('lists everyone who can sign in, you first', card.rows.length === 4 && /^Barry/.test(card.rows[0].t), JSON.stringify(card.rows));
  ok('  each with their email', card.rows.every(r => /@example\.com/.test(r.t)));
  ok('  the owners marked', card.rows.filter(r => r.own).length === 2 && card.rows[0].own && card.rows.find(r => /^Sandra/.test(r.t)).own);
  ok('  an owner can tap anyone', card.rows.every(r => r.tap));
  ok('  no word about step 56 once it has run', !/needs step 56/.test(card.text));
  ok('  the welcome email is still there for owners', !!(await p.$('#goInvite')));

  await ev(async () => { window.__rows.app_owners = [{ user_id: 'sandra' }]; await loadAll(); });
  await openPeople();
  card = await ev(() => [...document.querySelectorAll('[data-setcard="people"] .pplrow')].map(r => ({ me: /^Barry/.test(r.textContent.trim()), tap: r.tagName === 'BUTTON' })));
  ok('not an owner: only your own row can be tapped', card.length === 4 && card.filter(r => r.tap).length === 1 && card.find(r => r.me).tap, JSON.stringify(card));
  ok('  and no welcome email', !(await p.$('#goInvite')));

  // Before step 56: the table is not there at all.
  await ev(async () => {
    window.__origFrom = window.__origFrom || sb.from;
    sb.from = t => t === 'app_owners' ? { select: () => Promise.resolve({ data: null, error: { code: '42P01', message: 'relation "app_owners" does not exist' } }) } : window.__origFrom(t);
    await loadAll(); });
  ok('step 56 not run yet: the app still loads, on the old rule', await ev(() => CONTACTS.length > 0 && OWNERS === null && PEOPLE_READY === false && isOwner()));
  await openPeople();
  ok('  and the card says it needs step 56', await ev(() => /needs step 56 run in Supabase first/.test(document.querySelector('[data-setcard="people"]').textContent)));
  await ev(async () => { sb.from = window.__origFrom; window.__rows.app_owners = [{ user_id: 'me' }, { user_id: 'sandra' }]; await loadAll(); });

  // ---------------------------------------------------------------
  console.log('\nFilling in someone’s name and phone');
  await ev(() => { window.__rows.contacts.push({ id: 31, created_by: 'me', first_name: 'Annie', last_name: 'Example',
    emails: [{ label: 'Home', value: ' E@Example.com ' }],
    phones: [{ label: 'Home', value: '01234 567890' }, { label: 'Mobile', value: '07700 900222' }], contact_groups: [] },
    { id: 32, created_by: 'me', first_name: 'Zed', last_name: 'Zebedee', phones: [{ label: 'Work', value: '01234 000111' }], contact_groups: [] }); });
  await ev(() => loadAll());
  await openPeople();
  await ev(() => document.querySelector('[data-person="other"]').click()); await settle(300);
  ok('tapping someone opens their details', !!(await p.$('#personBox')));
  ok('  says what they sign in with, which stays', await ev(() => /Signs in as e@example\.com/.test($('personBox').textContent)));
  ok('  the name box has their name', await ev(() => $('pfName').value) === 'Annie Example');
  ok('  the phone box is for a phone, not corrected', await ev(() => $('pfPhone').type === 'tel' && $('pfPhone').getAttribute('autocorrect') === 'off'));
  ok('the contact with the same email is offered', await ev(() => !!$('pfMatch') && /Fill in from Annie Example in Contacts/.test($('pfMatch').textContent)));
  await ev(() => { $('pfName').value = ''; $('pfPhone').value = ''; });
  await p.click('#pfMatch'); await settle(100);
  ok('  one tap fills in the name, and the mobile rather than the first number', await ev(() => $('pfName').value === 'Annie Example' && $('pfPhone').value === '07700 900222'),
    await ev(() => $('pfName').value + ' / ' + $('pfPhone').value));
  await ev(() => { $('pfName').value = '  Annie Example '; });
  await clear(); await clearToasts();
  await p.click('#pfSave'); await settle(400);
  let r = await rpcs('set_person');
  ok('Save asks the database, for that person', r.length === 1 && r[0].args.who === 'other' && r[0].args.full_name === 'Annie Example' && r[0].args.phone_no === '07700 900222', JSON.stringify(r));
  ok('  which has not had step 56: says so, and keeps what was typed', /step 56/.test(await toasts()) && !!(await p.$('#personBox')), await toasts());
  await ev(() => { window.__rpc = (n, a) => { if (n !== 'set_person') return { data: null, error: { code: 'PGRST202', message: 'no ' + n } };
    const u = window.__rows.profiles.find(x => x.id === a.who); u.display_name = a.full_name || u.email; u.phone = a.phone_no || null;
    return { data: null, error: null }; }; });
  await clearToasts(); await p.click('#pfSave'); await settle(500);
  ok('  once it has: saved, closed, and the list shows it', !(await p.$('#personBox')) && /Saved/.test(await toasts())
    && await ev(() => /e@example\.com · 07700 900222/.test(document.querySelector('[data-setcard="people"]').textContent)), await toasts());
  ok('  Settings stays open on the same card', await ev(() => !$('settings').classList.contains('hidden')));

  // Someone whose name is still their email, and nobody in Contacts with it.
  await ev(() => document.querySelector('[data-person="zed"]').click()); await settle(300);
  ok('a name that is still the email: the box starts empty', await ev(() => $('pfName').value === ''));
  ok('  nobody in Contacts with that email: no one offered', !(await p.$('#pfMatch')));
  await p.click('#pfPick'); await settle(300);
  ok('Choose from Contacts opens the contact picker', await ev(() => !!$('pkQ') && !$('personBox')));
  await p.fill('#pkQ', 'Zebedee'); await settle(200);
  await ev(() => document.querySelector('[data-pk="32"]').click()); await settle(300);
  ok('  picking one brings the details back, filled in from them', await ev(() => !!$('personBox') && $('pfName').value === 'Zed Zebedee' && $('pfPhone').value === '01234 000111'),
    await ev(() => $('personBox') ? $('pfName').value + ' / ' + $('pfPhone').value : 'closed'));
  await p.click('#pfPick'); await settle(300);
  await ev(() => $('pkCancel').click()); await settle(300);
  ok('  cancelling the picker keeps what was there', await ev(() => !!$('personBox') && $('pfName').value === 'Zed Zebedee'));
  await p.click('#pfCancel'); await settle(200);
  ok('Cancel closes it, nothing saved', !(await p.$('#personBox')) && await ev(() => window.__rows.profiles.find(x => x.id === 'zed').display_name) === 'zed@example.com');

  // Yourself: the contact set as you.
  await ev(async () => { window.__rows.profiles[0].my_contact_id = 1; await loadAll(); });
  await openPeople();
  await ev(() => document.querySelector('[data-person="me"]').click()); await settle(300);
  ok('you: the contact set as you is offered', await ev(() => /You/.test($('personBox').querySelector('.dsec').textContent)
    && !!$('pfMatch') && /Dickie Deal/.test($('pfMatch').textContent)));
  await p.click('#pfCancel'); await settle(100);

  // Not an owner: your own row only (the database refuses the rest anyway).
  await ev(async () => { window.__rows.app_owners = [{ user_id: 'sandra' }]; await loadAll(); });
  await openPeople();
  ok('not an owner: other people’s rows do nothing', await ev(() => !document.querySelector('[data-person="sandra"]') && !!document.querySelector('[data-person="me"]')));
  await closeAll();

  // The Help, and the backup.
  console.log('\nHelp and the backup');
  await ev(() => openHelp('home')); await settle(400);
  ok('Help has a part about names and phones', await ev(() => !!document.getElementById('h-names') && document.getElementById('h-names').parentElement.classList.contains('helpbox')
    && /Fill in from/.test(document.getElementById('h-names').parentElement.textContent)));
  ok('  and one about new versions', await ev(() => !!document.getElementById('h-versions') && /Restart now/.test(document.getElementById('h-versions').parentElement.textContent)));
  await p.fill('#helpQ', 'restart'); await settle(200);
  ok('  searching for restart finds it', await ev(() => [...document.querySelectorAll('.helpbox:not(.hidden) h4')].some(h => h.id === 'h-versions')));
  await closeAll();
  ok('the in-app backup copies the owners table', /select 'app_owners'/.test(src) && /from app_owners t/.test(src));
  const step = fs.readFileSync(path.join(ROOT, 'database', 'contacts-step56.sql'), 'utf8');
  ok('step 56 holds no emails, phone numbers or keys (the repo is public)', !/@/.test(step)
    && !/\b0\d{3,4}\s?\d{6}\b/.test(step) && !/eyJ|service_role|REMINDER_SECRET|sk_/i.test(step));

  // ---------------------------------------------------------------
  console.log('\nRestart now');
  await serve(NEWER); await ev(() => { VER.at = 0; VER.later = 0; checkVersion(true); }); await settle(300);
  await ev(() => { $('editor').classList.remove('hidden'); });
  answer = false; asked.length = 0;
  const before = p.url();
  await p.click('#verGo'); await settle(300);
  ok('something open and not saved: it asks first', asked.length === 1 && /not saved/.test(asked[0]), asked.join(' | '));
  ok('  saying no stays put', p.url() === before);
  await ev(() => { $('editor').classList.add('hidden'); });
  answer = true; asked.length = 0;
  // In here there is no index.html beside the test page, so the load itself
  // fails; what matters is the address it asked for.
  const went = p.waitForRequest(r => /index\.html\?v=/.test(r.url()), { timeout: 4000 }).catch(() => null);
  await p.click('#verGo');
  const req = await went; await settle(300);
  ok('nothing open: it restarts straight away, fetching the new page afresh', asked.length === 0 && !!req
    && /\/index\.html\?v=2099.12.31.1$/.test(req.url()), req ? req.url() : 'no request');

  await p.goto('file://' + path.join(__dirname, 'boot.html') + '?v=2099.12.31.1');
  await p.waitForTimeout(900);
  ok('once restarted, the ?v= is tidied off the address', await ev(() => location.search === '' && /boot\.html$/.test(location.pathname)), await ev(() => location.href));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
