// The 11 Nov 2026 batch (version 2026.11.11.1), driven through the real page
// on a phone-sized screen:
//   ML254 Calendar: a Days view like a wall calendar, with weekends in red,
//         bank holidays, birthdays and the moon's quarters, today shaded,
//         each day opening out and folding again.
//   ML255 Wishlist: a Copy button under each photo.
//   ML256 Contacts: Google and Outlook files read as they come, a contact
//         shared in, and what is missing filled in for people already here
//         (the service worker side of sharing is in sharein.test.js).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|PGRST204|does not exist|^\[object Object\]$|JSHandle@object|NotAllowedError|Object not found|no photo/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const flat = s => String(s || '').replace(/\s+/g, ' ');

const GOOGLE = [
  'First Name,Middle Name,Last Name,Phonetic First Name,Nickname,Birthday,Notes,Labels,E-mail 1 - Label,E-mail 1 - Value,'
  + 'Phone 1 - Label,Phone 1 - Value,Phone 2 - Label,Phone 2 - Value,Address 1 - Label,Address 1 - Formatted,'
  + 'Address 1 - Street,Address 1 - City,Address 1 - PO Box,Address 1 - Region,Address 1 - Postal Code,Address 1 - Country,'
  + 'Address 1 - Extended Address,Organization Name,Organization Title,Website 1 - Label,Website 1 - Value',
  'Anna,May,Boatman,,Annie,1971-06-09,Met at Braunston,* myContacts,* Home,anna@example.org,Mobile,'
  + '+44 7700 900444 ::: 07700 900445,Home,01829 000000,Home,"1 Lock Lane\nMalpas",1 Lock Lane,Malpas,,Cheshire,SY14 1AA,'
  + 'United Kingdom,,Canal Co,Skipper,,https://example.org',
  'Bob,,Tiller,,,--03-12,,* myContacts,,,,,,,,,,,,,,,,,,,'
].join('\r\n');
const GOOGLE_OLD = 'Name,Given Name,Additional Name,Family Name,Birthday,Group Membership,E-mail 1 - Type,E-mail 1 - Value,'
  + 'Phone 1 - Type,Phone 1 - Value,Organization 1 - Type,Organization 1 - Name,Organization 1 - Title\n'
  + 'Dee Paddle,Dee,,Paddle,1955-01-02,* My Contacts,* Work,dee@example.org,Work Fax,0161 000009,,Paddle Ltd,Owner';
const OUTLOOK = 'First Name,Middle Name,Last Name,Title,Suffix,Nickname,E-mail Address,E-mail 2 Address,E-mail Display Name,'
  + 'Home Phone,Business Phone,Mobile Phone,Business Fax,Assistant\'s Phone,Job Title,Department,Company,Business Street,'
  + 'Business City,Business State,Business Postal Code,Business Country/Region,Home Street,Home City,Home State,'
  + 'Home Postal Code,Home Country/Region,Spouse,Birthday,Web Page,Notes\n'
  + 'Cara,,Narrow,Mrs,,,cara@example.org,cara.work@example.org,Cara Narrow (cara@example.org),01606 000001,0161 000002,'
  + '07700 900555,0161 000003,0161 000004,Lock keeper,Waterways,CRT,1 Office Rd,Northwich,Cheshire,CW9 1AA,UK,2 Home St,'
  + 'Middlewich,Cheshire,CW10 9AA,UK,Dan,4/23/1980,www.example.com,Likes tea';
const VCF_WA = 'BEGIN:VCARD\nVERSION:3.0\nN:Lock;Kate;;;\nFN:Kate Lock\n'
  + 'TEL;type=CELL;type=VOICE;waid=447700900111:+44 7700 900111\nEND:VCARD\n';
const VCF_GAPS = ['BEGIN:VCARD', 'VERSION:3.0', 'N:Deal;Dickie;;;', 'FN:Dickie Deal',
  'TEL;TYPE=CELL:+44 7700 900333', 'TEL;TYPE=HOME:01234 567890', 'EMAIL;TYPE=INTERNET:dickie@example.org',
  'BDAY:1960-04-05', 'ADR;TYPE=HOME:;;9 Other St;Somewhere;;AB1 2CD;UK', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:3.0', 'N:Walsh;Sandra;;;', 'END:VCARD',
  'BEGIN:VCARD', 'VERSION:4.0', 'FN:Ed Rudder', 'N:Rudder;Ed;;;', 'TEL;TYPE="cell,voice";VALUE=uri:tel:+447700900666',
  'BDAY;X-APPLE-OMIT-YEAR=1604:1604-08-01', 'END:VCARD'].join('\r\n');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.emulateMedia({ reducedMotion: 'reduce' });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  // The government's bank-holiday list, as the phone would fetch it.
  let govAsked = 0, govDay = '';
  await p.route('https://www.gov.uk/bank-holidays.json', r => { govAsked++;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ 'england-and-wales': { division: 'england-and-wales', events: govDay
        ? [{ title: 'Test bank holiday', date: govDay, notes: '', bunting: true }] : [] } }) }); });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  const clearToasts = () => ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const clear = () => ev(() => { window.__writes.length = 0; });
  const writes = () => ev(() => window.__writes);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); lockBackground(); });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  const V = VJ.history.find(h => h.version === '2026.11.11.1');
  ok('2026.11.11.1 is in version.json, and the page is the newest', !!V && VJ.version === appVer && VJ.history[0].version === appVer, appVer + ' / ' + VJ.version);
  const said = V ? V.changes.join(' ') : '';
  ok('  saying what changed', /Days/.test(said) && /bank holidays/.test(said) && /moon/.test(said) && /Copy button/.test(said)
    && /Google Contacts/.test(said) && /Outlook/.test(said) && /WhatsApp/.test(said) && /fill in/.test(said), said);
  ok('  each line short enough for the What\'s new list', !!V && V.changes.every(c => c.length < 160));

  // ---------------------------------------------------------------
  console.log('\nThe moon and the bank holidays (ML254)');
  ok('Jan 2027 quarters match the wall calendar: new 7, first 15, full 22, last 29',
    JSON.stringify(await ev(() => moonPhasesIn(2027, 1))) === JSON.stringify({ 7: 'new', 15: 'fq', 22: 'full', 29: 'lq' }),
    JSON.stringify(await ev(() => moonPhasesIn(2027, 1))));
  const r27 = await ev(() => bankHolRules(2027));
  ok('2027 bank holidays by the rules, with Christmas on a Saturday moved on', JSON.stringify(r27) === JSON.stringify({
    '2027-01-01': 'New Year’s Day', '2027-03-26': 'Good Friday', '2027-03-29': 'Easter Monday',
    '2027-05-03': 'Early May bank holiday', '2027-05-31': 'Spring bank holiday', '2027-08-30': 'Summer bank holiday',
    '2027-12-27': 'Christmas Day (substitute day)', '2027-12-28': 'Boxing Day (substitute day)' }), JSON.stringify(r27));
  ok('  New Year on a Saturday: the Monday after', await ev(() => bankHolRules(2028)['2028-01-03']) === 'New Year’s Day (substitute day)');
  ok('  a year the list does not reach comes from the rules', await ev(() => bankHolOn('2031-12-25')) === 'Christmas Day');
  ok('  the list wins for a year it covers (a coronation, say)', await ev(() => {
    const was = BANKHOL;
    BANKHOL = { at: '2000-01-01', days: { '2023-05-08': 'Bank holiday for the coronation of King Charles III' }, years: ['2023'] };
    const r = [bankHolOn('2023-05-08'), bankHolOn('2023-05-01')];
    BANKHOL = was; return r; }).then(r => r[0] === 'Bank holiday for the coronation of King Charles III' && r[1] === ''));

  // ---------------------------------------------------------------
  console.log('\nThe Days view (ML254)');
  const K = await ev(() => { const t = new Date(); const o = {}; for (let n = -12; n <= 26; n++) o[n] = dayKeyOf(dayPlus(t, n)); return o; });
  govDay = K[3];
  await ev(async K => {
    const at = (k, h) => new Date(k + 'T' + h).toISOString();
    const it = (id, kind, title, k, h, more) => Object.assign({ id, kind, title, created_by: 'me', repeat_every: 'none',
      updated_at: '2026-01-01' }, kind === 'appointment' ? { starts_at: at(k, h), ends_at: at(k, h.replace(/^(\d\d)/, (m, x) => String(+x + 1).padStart(2, '0'))) }
      : { due_at: at(k, h) }, more || {});
    window.__rows.items.push(
      it(1101, 'appointment', 'Dentist', K[0], '10:00'),
      it(1102, 'todo', 'Ring the boatyard', K[1], '12:00'),
      it(1103, 'todo', 'Post the cards', K[-1], '09:00', { done_at: new Date().toISOString() }),
      it(1104, 'appointment', 'One', K[2], '09:00'), it(1105, 'appointment', 'Two', K[2], '11:00'),
      it(1106, 'appointment', 'Three', K[2], '13:00'));
    Object.assign(window.__rows.contacts.find(c => c.id === 1), { birth_date: '1960-' + K[1].slice(5) });
    await loadAll();
    DIARY_VIEW = 'days'; openDiary();
  }, K);
  await settle(500);
  const days = () => ev(() => [...document.querySelectorAll('#diaryBody .dday')].map(d => ({ key: d.dataset.dkey,
    cls: d.className, text: d.querySelector('.dhead').textContent.replace(/\s+/g, ' ').trim(),
    lines: [...d.querySelectorAll('.dsum .dl')].map(l => ({ t: l.textContent.trim(), done: l.classList.contains('done') })),
    hol: (d.querySelector('.dhol') || {}).textContent || '', moon: (d.querySelector('.dmoon') || {}).textContent || '',
    open: d.querySelector('.dhead').getAttribute('aria-expanded') === 'true' })));
  let D = await days();
  ok('Days is a fifth button beside the others, pressed', await ev(() => {
    const bs = [...document.querySelectorAll('#diaryBody [data-dview]')];
    return bs.length === 5 && bs.map(x => x.textContent.trim()).join(',') === 'List,Week,Month,Days,Regular'
      && document.querySelector('[data-dview="days"]').getAttribute('aria-pressed') === 'true'; }),
    await ev(() => [...document.querySelectorAll('#diaryBody [data-dview]')].map(x => x.textContent.trim()).join(',')));
  ok('it opens three days back and ten ahead, a line a day', D.length === 14 && D[0].key === K[-3] && D[13].key === K[10],
    D.map(d => d.key).join(' '));
  const T = D.find(d => d.key === K[0]);
  ok('today is shaded, and only today', !!T && /\btoday\b/.test(T.cls) && D.filter(d => /\btoday\b/.test(d.cls)).length === 1);
  ok('  in a washed colour, not the plain white of the other days', await ev(k => {
    const a = getComputedStyle(document.querySelector(`.dday[data-dkey="${k}"]`)).backgroundColor;
    const o = getComputedStyle(document.querySelector('.dday:not(.today)')).backgroundColor;
    return a !== o && a !== 'rgba(0, 0, 0, 0)'; }, K[0]));
  const wk = await ev(() => [...document.querySelectorAll('.dday')].map(d => {
    const day = new Date(d.dataset.dkey + 'T12:00').getDay();
    return { we: day === 0 || day === 6, cls: d.classList.contains('wkend'),
      col: getComputedStyle(d.querySelector('.dnum')).color, name: getComputedStyle(d.querySelector('.dname')).color }; }));
  ok('weekends are marked, and only weekends', wk.every(w => w.we === w.cls) && wk.some(w => w.we), JSON.stringify(wk));
  ok('  with the date and day in red', wk.filter(w => w.we).every(w => w.col === 'rgb(255, 107, 94)' && w.name === 'rgb(200, 50, 43)')
    && wk.filter(w => !w.we).every(w => w.col === 'rgb(255, 255, 255)'), JSON.stringify(wk.slice(0, 3)));
  ok('a day shows what is on it, with the time', T && T.lines.length === 1 && /10:00/.test(T.lines[0].t) && /Dentist/.test(T.lines[0].t), JSON.stringify(T));
  const T1 = D.find(d => d.key === K[1]);
  ok('a birthday shows on its day, with the to-do', T1 && T1.lines.some(l => /Dickie Deal/.test(l.t))
    && T1.lines.some(l => /Ring the boatyard/.test(l.t)), JSON.stringify(T1));
  const Tm1 = D.find(d => d.key === K[-1]);
  ok('a finished one still shows, crossed through', Tm1 && Tm1.lines.length === 1 && Tm1.lines[0].done && /Post the cards/.test(Tm1.lines[0].t), JSON.stringify(Tm1));
  const T2 = D.find(d => d.key === K[2]);
  ok('two lines fit on a day; the rest say how many more', T2 && T2.lines.length === 3 && /One/.test(T2.lines[0].t)
    && /Two/.test(T2.lines[1].t) && T2.lines[2].t === '+1 more', JSON.stringify(T2));
  ok('the government\'s list was fetched once, and its holiday named on its day', govAsked === 1
    && (D.find(d => d.key === K[3]) || {}).hol === 'Test bank holiday', govAsked + ' ' + JSON.stringify(D.find(d => d.key === K[3])));
  ok('  and kept on the phone for the rest of the day', await ev(() => {
    const c = JSON.parse(localStorage.getItem('bankhols') || 'null'); return !!c && c.at === dayKeyOf(new Date()); }));
  const moons = await ev(() => [...document.querySelectorAll('.dday')].map(d => {
    const [y, m, n] = d.dataset.dkey.split('-').map(Number); const q = moonPhasesIn(y, m)[n];
    const s = d.querySelector('.dmoon'); return { want: q ? MOON[q][0] : '', got: s ? s.textContent : '' }; }));
  ok('the moon\'s quarters are marked on their days, and nowhere else', moons.every(m => m.want === m.got) && moons.some(m => m.got),
    JSON.stringify(moons.filter(m => m.want || m.got)));

  console.log('\nOpening a day out');
  await ev(k => document.querySelector(`[data-dopen="${k}"]`).click(), K[2]); await settle(200);
  let full = await ev(k => { const d = document.querySelector(`.dday[data-dkey="${k}"]`);
    return { open: d.classList.contains('open'), exp: d.querySelector('.dhead').getAttribute('aria-expanded'),
      items: d.querySelectorAll('.dfull .item').length, add: !!d.querySelector('[data-dadd]'),
      sum: d.querySelectorAll('.dsum .dl').length, text: d.querySelector('.dfull').textContent.replace(/\s+/g, ' ') }; }, K[2]);
  ok('tapping a day opens it with everything on it', full.open && full.exp === 'true' && full.items === 3
    && /One/.test(full.text) && /Two/.test(full.text) && /Three/.test(full.text), JSON.stringify(full));
  ok('  and + Add on this day', full.add);
  ok('  the short lines give way to the full list', full.sum === 0, JSON.stringify(full));
  await ev(k => document.querySelector(`[data-dopen="${k}"]`).click(), K[2]); await settle(200);
  ok('tapping it again folds it', await ev(k => { const d = document.querySelector(`.dday[data-dkey="${k}"]`);
    return !d.classList.contains('open') && !d.querySelector('.dfull') && d.querySelectorAll('.dsum .dl').length === 3; }, K[2]));
  await ev(k => document.querySelector(`[data-dopen="${k}"]`).click(), K[1]); await settle(200);
  full = await ev(k => document.querySelector(`.dday[data-dkey="${k}"] .dfull`).textContent.replace(/\s+/g, ' '), K[1]);
  const age = await ev(k => Number(k.slice(0, 4)) - 1960, K[1]);
  ok('an opened day shows the birthday, with the age', new RegExp('Dickie Deal.*Birthday · ' + age).test(full), full);
  await ev(k => document.querySelector(`[data-dopen="${k}"]`).click(), K[-1]); await settle(200);
  ok('a finished one can be opened from its day', await ev(k =>
    !!document.querySelector(`.dday[data-dkey="${k}"] .dfull .item`), K[-1]));
  await ev(k => document.querySelector(`[data-dopen="${k}"]`).click(), K[-1]); await settle(200);
  const st = await ev(async () => { $('diaryAdd').click(); document.querySelector('[data-newkind="appointment"]').click();
    await new Promise(r => setTimeout(r, 150)); return $('itForm').elements.starts_at.value; });
  ok('with one day open, + adds on that day', st.startsWith(K[1] + 'T'), st + ' / ' + K[1]);
  await closeAll(); await ev(() => { $('diary').classList.remove('hidden'); renderDiary(); });
  const st2 = await ev(async k => { document.querySelector(`[data-dadd="${k}"]`).click();
    document.querySelector('[data-newkind="todo"]').click();
    await new Promise(r => setTimeout(r, 150)); const f = $('itForm');
    return (f.elements.due_at || f.elements.starts_at || {}).value || ''; }, K[1]);
  ok('+ Add on this day does the same', st2.startsWith(K[1]), st2);
  await closeAll(); await ev(() => { $('diary').classList.remove('hidden'); DAYS_OPEN.clear(); renderDiary(); });

  console.log('\nEarlier, later and back to today');
  await ev(() => document.querySelector('[data-dmore="-7"]').click()); await settle(200);
  D = await days();
  ok('Earlier days adds a week before', D.length === 21 && D[0].key === K[-10], D.length + ' ' + D[0].key);
  await ev(() => document.querySelector('[data-dmore="14"]').click()); await settle(200);
  D = await days();
  ok('Later days adds a fortnight after', D.length === 35 && D[34].key === K[24], D.length + ' ' + D[34].key);
  ok('  with the month named where a new one starts', await ev(() => {
    const ps = [...document.querySelectorAll('#diaryBody .dmonth')];
    return ps.length >= 1 && ps.every(x => { const n = x.nextElementSibling; return n && (n.dataset.dkey.endsWith('-01') || n === document.querySelector('.dday')); }); }));
  await ev(() => $('dToday').click()); await settle(200);
  D = await days();
  ok('Today goes back to the first view', D.length === 14 && D[0].key === K[-3]);
  await closeAll();
  await ev(() => { DIARY_VIEW = 'days'; openDiary(); }); await settle(300);
  ok('opening the Calendar again starts afresh from today, all folded, without fetching the list again',
    (await days()).length === 14 && (await days()).every(d => !d.open) && govAsked === 1, 'asked ' + govAsked);

  console.log('\nIt fits a narrow phone');
  for (const w of [320, 360]) {
    await p.setViewportSize({ width: w, height: 740 }); await ev(() => renderDiary()); await settle(250);
    const fit = await ev(() => {
      const body = $('diaryBody').getBoundingClientRect();
      const bs = [...document.querySelectorAll('#diaryBody [data-dview]')].map(x => x.getBoundingClientRect());
      const heads = [...document.querySelectorAll('.dhead')].map(x => x.getBoundingClientRect());
      const vb = [...document.querySelectorAll('#diaryBody [data-dview]')].every(x => x.scrollWidth <= x.clientWidth + 1);
      return { doc: document.documentElement.scrollWidth, win: innerWidth, body: $('diaryBody').scrollWidth <= $('diaryBody').clientWidth + 1,
        btns: bs.every(r => r.left >= body.left - 1 && r.right <= body.right + 1), words: vb,
        rows: heads.every(r => r.right <= body.right + 1) };
    });
    ok(`at ${w} wide the five buttons, words and days all fit`, fit.doc <= fit.win && fit.body && fit.btns && fit.words && fit.rows, JSON.stringify(fit));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await ev(() => renderDiary()); await settle(200);
  await p.screenshot({ path: path.join(__dirname, 'days.png') });
  ok('Help explains Days', /<strong>Days<\/strong> is laid out like a wall calendar/.test(HTML) && /Later days/.test(HTML));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nA Copy button under each Wishlist photo (ML255)');
  await ev(() => {
    window.__clip = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async t => { window.__clip.push({ text: t }); },
      write: async items => { for (const it of items) for (const t of it.types) {
        const blob = await it.getType(t); window.__clipBlob = blob; window.__clip.push({ type: t, blob: blob.type, size: blob.size }); } } } });
  });
  const jpg = await ev(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30;
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 30);
    window.__photoBlob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)); return window.__photoBlob.size; });
  await ev(async () => {
    window.__rows.wishes.push({ id: 1201, created_by: 'me', app: 'contacts', title: 'Finances', notes: 'Make the totals bold',
      status: 'idea', created_at: new Date().toISOString(), photos: [{ path: 'wsh/me/a.jpg' }, { path: 'wsh/me/b.jpg' }] });
    await loadLists(); await openWish(); });
  await settle(400);
  const pics = await ev(() => [...document.querySelectorAll('#wishBody .wpic')].map(s => ({
    img: !!s.querySelector('img[data-wpic]'), btn: (s.querySelector('[data-wpcopy]') || {}).textContent || '',
    path: (s.querySelector('[data-wpcopy]') || { dataset: {} }).dataset.wpcopy,
    w: Math.round(s.getBoundingClientRect().width), bw: Math.round((s.querySelector('[data-wpcopy]') || s).getBoundingClientRect().width) })));
  ok('each photo has a Copy button under it', pics.length === 2 && pics.every(x => x.img && x.btn === 'Copy')
    && pics[0].path === 'wsh/me/a.jpg' && pics[1].path === 'wsh/me/b.jpg', JSON.stringify(pics));
  ok('  as wide as the photo, and no wider', pics.every(x => x.w === 72 && x.bw <= 72), JSON.stringify(pics));
  ok('  and Copy idea and Share idea are still there', await ev(() => !!document.querySelector('[data-wcopy="1201"][data-wfield="t"]')));
  await clear(); await clearToasts();
  await ev(() => document.querySelector('[data-wpcopy="wsh/me/a.jpg"]').click()); await settle(600);
  const clip = await ev(() => window.__clip);
  ok('Copy fetches that photo and puts it on the clipboard as a PNG', clip.length === 1 && clip[0].type === 'image/png'
    && clip[0].blob === 'image/png' && clip[0].size > 0, JSON.stringify(clip));
  ok('  the whole picture', await ev(async () => { const im = await createImageBitmap(window.__clipBlob); return im.width === 40 && im.height === 30; }));
  ok('  fetched from the photo store', (await writes()).some(w => w.op === 'download' && w.bucket === 'photos' && w.path === 'wsh/me/a.jpg'),
    JSON.stringify(await writes()));
  ok('  and says so', /Photo copied: now paste it in/.test(await toasts()), await toasts());
  await clearToasts(); await ev(() => { window.__noPhoto = 'wsh/me/b.jpg'; });
  await ev(() => document.querySelector('[data-wpcopy="wsh/me/b.jpg"]').click()); await settle(500);
  ok('a photo that cannot be fetched says so, and copies nothing', /Could not copy that photo/.test(await toasts())
    && (await ev(() => window.__clip.length)) === 1, await toasts());
  await ev(() => { window.__noPhoto = null; });
  await ev(() => document.querySelector('[data-wcopy="1201"][data-wfield="t"]').click()); await settle(300);
  ok('Copy idea is still the words', await ev(() => JSON.stringify(window.__clip[1])) === JSON.stringify({ text: 'Finances\nMake the totals bold' }),
    await ev(() => JSON.stringify(window.__clip)));
  const noClip = await ev(() => { const was = window.ClipboardItem; delete window.ClipboardItem; renderWish();
    const n = document.querySelectorAll('[data-wpcopy]').length; document.querySelectorAll('.toast').forEach(t => t.remove());
    copyPhoto('wsh/me/a.jpg'); const t = [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' ');
    window.ClipboardItem = was; renderWish(); return { n, t }; });
  ok('a phone that cannot copy pictures shows no Copy buttons', noClip.n === 0, JSON.stringify(noClip));
  ok('  and says to use Share idea', /cannot copy pictures: use Share idea/.test(noClip.t), noClip.t);
  ok('Help says how to paste an idea with its pictures', /each photo has its own <strong>Copy<\/strong> button/.test(HTML));
  await ev(() => { window.__photoBlob = null; });
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nBringing contacts in: a contact shared from WhatsApp (ML256)');
  await clear(); await clearToasts();
  await ev(vc => sharedPicsIn({ text: '', files: Promise.resolve([new File([vc], 'Kate Lock.vcf', { type: 'text/x-vcard' })]) }), VCF_WA);
  await settle(400);
  const rep = async () => flat(await ev(() => $('ioReport').innerText));
  ok('it opens Import and export contacts, not the Wishlist', await ev(() => !$('io').classList.contains('hidden') && $('wish').classList.contains('hidden')));
  ok('  with the contact ready to check', /In the file 1/.test(await rep()) && /New 1/.test(await rep()) && /Kate Lock/.test(await rep()), await rep());
  ok('  and the button says what it will do', await ev(() => $('ioGo').textContent.trim()) === 'Add this one');
  ok('  nothing is saved until it is tapped', !(await writes()).some(w => w.op === 'insert' && w.table === 'contacts'));
  await ev(() => $('ioGo').click()); await settle(500);
  let ins = (await writes()).filter(w => w.op === 'insert' && w.table === 'contacts');
  ok('tapping it adds the contact, with the number as a mobile', ins.length === 1 && ins[0].rows.first_name === 'Kate'
    && ins[0].rows.last_name === 'Lock' && JSON.stringify(ins[0].rows.phones) === JSON.stringify([{ label: 'Mobile', value: '+44 7700 900111' }])
    && ins[0].rows.created_by === 'me', JSON.stringify(ins));
  ok('  and says so', /1 added/.test(await rep()), await rep());
  await closeAll();
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push('PAGE ERROR (shared in): ' + e.message));
  await p2.goto('file://' + path.join(__dirname, 'boot.html') + '?share_text=' + encodeURIComponent(VCF_WA));
  await p2.waitForTimeout(1500);
  ok('a contact shared as words opens Import too', await p2.evaluate(() => !$('io').classList.contains('hidden')
    && /Kate Lock/.test($('ioReport').textContent) && $('wish').classList.contains('hidden')));
  ok('  rather than URL Links', await p2.evaluate(() => !document.querySelector('#links:not(.hidden)')));
  ok('  and is taken off the address', await p2.evaluate(() => location.search === ''));
  await p2.close();
  await clearToasts();
  await ev(() => sharedPicsIn({ text: '', files: Promise.resolve([new File(['nothing useful'], 'x.vcf', { type: 'text/vcard' })]) }));
  await settle(300);
  ok('a contact file with no contact in it says so', /did not come through/.test(await toasts()), await toasts());
  await closeAll();

  console.log('\nFilling in what is missing for people already here');
  await ev(async () => { Object.assign(window.__rows.contacts.find(c => c.id === 1),
    { phones: [{ label: 'Mobile', value: '07700 900333' }], birth_date: null, updated_at: 'A' }); await loadAll(); openIO(); });
  await clear();
  await p.setInputFiles('#ioFile', { name: 'contacts.vcf', mimeType: 'text/x-vcard', buffer: Buffer.from(VCF_GAPS) });
  await settle(400);
  let R = await rep();
  ok('it counts the new and the ones already here', /In the file 3/.test(R) && /New 1/.test(R) && /Already here 2, 1 with more in the file/.test(R), R);
  ok('  and lists what the file has on them that is not here', /Dickie Deal: a phone number, an email, a birthday/.test(R), R);
  ok('  a number already here in another form is not added again', !/2 phone numbers/.test(R), R);
  ok('  ticked to fill them in, and the button says both', await ev(() => $('ioGaps').checked && $('ioGo').textContent.trim() === 'Add 1 new and fill in 1'),
    await ev(() => $('ioGo').textContent));
  await ev(() => { $('ioGaps').click(); });
  ok('untick it and the button just adds', await ev(() => $('ioGo').textContent.trim()) === 'Add this one');
  await ev(() => { $('ioGaps').click(); });
  await ev(() => $('ioGo').click()); await settle(600);
  const W = await writes();
  const up = W.filter(w => w.op === 'update' && w.table === 'contacts');
  ok('the one already here is changed once, only where something was missing', up.length === 1
    && JSON.stringify(up[0].where) === JSON.stringify([['eq', 'id', 1], ['eq', 'updated_at', 'A']]), JSON.stringify(up));
  const pt = up[0] ? up[0].patch : {};
  ok('  the new number added alongside the old one', JSON.stringify(pt.phones) === JSON.stringify([{ label: 'Mobile', value: '07700 900333' },
    { label: 'Home', value: '01234 567890' }]), JSON.stringify(pt.phones));
  ok('  with the email and birthday', JSON.stringify(pt.emails) === JSON.stringify([{ label: 'Personal', value: 'dickie@example.org' }])
    && pt.birth_date === '1960-04-05', JSON.stringify(pt));
  ok('  but the town already there is left as it is (no address from the file)', !('town' in pt) && !('address' in pt) && !('postcode' in pt), JSON.stringify(pt));
  ins = W.filter(w => w.op === 'insert' && w.table === 'contacts');
  ok('the new one is added: a tel: number read, a birthday with no year left out', ins.length === 1 && ins[0].rows.first_name === 'Ed'
    && JSON.stringify(ins[0].rows.phones) === JSON.stringify([{ label: 'Mobile', value: '+447700900666' }]) && !ins[0].rows.birth_date, JSON.stringify(ins));
  ok('  Sandra, with nothing new, is not touched', !up.some(u => JSON.stringify(u.where).includes('2')));
  ok('it says what it did', /1 added, 1 filled in/.test(await rep()), await rep());
  await clear();
  await ev(async () => { Object.assign(window.__rows.contacts.find(c => c.id === 1), { phones: [], updated_at: 'A' }); await loadAll(); });
  await p.setInputFiles('#ioFile', { name: 'contacts.vcf', mimeType: 'text/x-vcard', buffer: Buffer.from(VCF_GAPS) });
  await settle(300);
  await ev(() => { window.__rows.contacts.find(c => c.id === 1).updated_at = 'B'; $('ioGo').click(); }); await settle(500);
  ok('someone changed it meanwhile: it is left alone, and it says so', /0 filled in/.test(await rep())
    && /1 could not be filled in \(changed meanwhile/.test(await rep()), await rep());
  await clear();
  await ev(async () => { Object.assign(window.__rows.contacts.find(c => c.id === 1), { phones: [], updated_at: 'A' }); await loadAll(); });
  await p.setInputFiles('#ioFile', { name: 'contacts.vcf', mimeType: 'text/x-vcard', buffer: Buffer.from(VCF_GAPS) });
  await settle(300);
  await ev(() => { $('ioGaps').click(); $('ioGo').click(); }); await settle(500);
  ok('unticked: the new one is added and nobody already here is changed', !(await writes()).some(w => w.op === 'update' && w.table === 'contacts')
    && (await writes()).filter(w => w.op === 'insert' && w.table === 'contacts').length === 1 && /^1 added\./.test(await rep()), await rep());
  await ev(async () => { Object.assign(window.__rows.contacts.find(c => c.id === 1), { phones: [], birth_date: null, updated_at: null }); await loadAll(); });

  console.log('\nA Google Contacts file, as it comes');
  await clear();
  await p.setInputFiles('#ioFile', { name: 'contacts.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + GOOGLE) });
  await settle(400);
  R = await rep();
  ok('read without the template', /In the file 2/.test(R) && /New 2/.test(R) && /Anna Boatman, Bob Tiller/.test(R), R);
  await ev(() => $('ioGo').click()); await settle(500);
  ins = (await writes()).filter(w => w.op === 'insert' && w.table === 'contacts').map(w => w.rows);
  const A = ins.find(x => x.first_name === 'Anna') || {};
  ok('names, nickname, birthday and notes', A.given_names === 'May' && A.last_name === 'Boatman' && A.nickname === 'Annie'
    && A.birth_date === '1971-06-09' && A.notes === 'Met at Braunston', JSON.stringify(A));
  ok('  every phone number, the ::: ones split, with their labels', JSON.stringify(A.phones) === JSON.stringify([
    { label: 'Mobile', value: '+44 7700 900444' }, { label: 'Mobile', value: '07700 900445' }, { label: 'Home', value: '01829 000000' }]), JSON.stringify(A.phones));
  ok('  email and website', JSON.stringify(A.emails) === JSON.stringify([{ label: 'Personal', value: 'anna@example.org' }])
    && JSON.stringify(A.websites) === JSON.stringify([{ label: 'Website', value: 'https://example.org' }]), JSON.stringify(A));
  ok('  the address in its parts, and work', A.address === '1 Lock Lane' && A.town === 'Malpas' && A.county === 'Cheshire'
    && A.postcode === 'SY14 1AA' && A.country === 'United Kingdom' && A.company === 'Canal Co' && A.job_title === 'Skipper', JSON.stringify(A));
  const Bt = ins.find(x => x.first_name === 'Bob') || {};
  ok('  a birthday with no year is left out, not guessed', Bt.last_name === 'Tiller' && !Bt.birth_date && !Bt.phones, JSON.stringify(Bt));
  await clear();
  await p.setInputFiles('#ioFile', { name: 'old.csv', mimeType: 'text/csv', buffer: Buffer.from(GOOGLE_OLD) });
  await settle(300); await ev(() => $('ioGo').click()); await settle(400);
  const Dp = ((await writes()).find(w => w.op === 'insert' && w.table === 'contacts') || {}).rows || {};
  ok('the older Google layout too', Dp.first_name === 'Dee' && Dp.last_name === 'Paddle' && Dp.company === 'Paddle Ltd'
    && Dp.job_title === 'Owner' && Dp.birth_date === '1955-01-02'
    && JSON.stringify(Dp.emails) === JSON.stringify([{ label: 'Work', value: 'dee@example.org' }])
    && JSON.stringify(Dp.phones) === JSON.stringify([{ label: 'Fax', value: '0161 000009' }]), JSON.stringify(Dp));

  console.log('\nAn Outlook file, as it comes');
  await clear();
  await p.setInputFiles('#ioFile', { name: 'outlook.csv', mimeType: 'text/csv', buffer: Buffer.from(OUTLOOK) });
  await settle(300); await ev(() => $('ioGo').click()); await settle(400);
  const C = ((await writes()).find(w => w.op === 'insert' && w.table === 'contacts') || {}).rows || {};
  ok('names, work and partner', C.first_name === 'Cara' && C.last_name === 'Narrow' && C.company === 'CRT' && C.job_title === 'Lock keeper'
    && C.department === 'Waterways' && C.partner_name === 'Dan' && C.notes === 'Likes tea', JSON.stringify(C));
  ok('  phones labelled Home, Work, Mobile and Fax (the assistant\'s left out)', JSON.stringify(C.phones) === JSON.stringify([
    { label: 'Home', value: '01606 000001' }, { label: 'Work', value: '0161 000002' }, { label: 'Mobile', value: '07700 900555' },
    { label: 'Fax', value: '0161 000003' }]), JSON.stringify(C.phones));
  ok('  both emails, but not the display name', JSON.stringify(C.emails) === JSON.stringify([{ label: 'Personal', value: 'cara@example.org' },
    { label: 'Personal', value: 'cara.work@example.org' }]), JSON.stringify(C.emails));
  ok('  the home address rather than the office', C.address === '2 Home St' && C.town === 'Middlewich' && C.postcode === 'CW10 9AA'
    && C.county === 'Cheshire' && C.country === 'UK', JSON.stringify(C));
  ok('  an American date read the American way, and the web page', C.birth_date === '1980-04-23'
    && JSON.stringify(C.websites) === JSON.stringify([{ label: 'Website', value: 'www.example.com' }]), JSON.stringify(C));
  const dates = await ev(() => ['1985-03-12', '19850312', '--03-12', '0/0/00', '3/4/1985', '4/23/1980', '12 March 1985',
    '1604-03-12', '31/02/1990', '1985-03-12T00:00:00Z', ''].map(importDate));
  ok('dates in all the ways files write them, a UK one the UK way', JSON.stringify(dates) === JSON.stringify(['1985-03-12', '1985-03-12', '', '',
    '1985-04-03', '1980-04-23', '1985-03-12', '', '', '1985-03-12', '']), JSON.stringify(dates));

  console.log('\nThe template and sheets made by hand, as before');
  await clear();
  const tpl = await ev(() => { let got = ''; const was = window.download;
    window.download = (n, t) => { got = t; }; try { exportTemplate(); } finally { window.download = was; } return got; });
  await p.setInputFiles('#ioFile', { name: 'tpl.csv', mimeType: 'text/csv',
    buffer: Buffer.from('﻿' + tpl.replace('Friend; Boater', 'Family')) });
  await settle(300);
  ok('the template still reads (even saved with a BOM)', /New 1/.test(await rep()) && /Jane Example/.test(await rep()), await rep());
  await ev(() => $('ioGo').click()); await settle(400);
  let Wt = await writes();
  const J = (Wt.find(w => w.op === 'insert' && w.table === 'contacts') || {}).rows || {};
  ok('  with its phones and groups', J.town === 'Malpas' && J.is_organisation === false
    && JSON.stringify(J.phones) === JSON.stringify([{ label: 'Mobile', value: '07700 900000' }])
    && Wt.some(w => w.op === 'insert' && w.table === 'contact_groups' && JSON.stringify(w.rows).includes('"group_id":1')), JSON.stringify(Wt));
  await clear();
  await p.setInputFiles('#ioFile', { name: 'hand.csv', mimeType: 'text/csv',
    buffer: Buffer.from('First Name,Last Name,Town,Postcode\nFred,Gate,Nantwich,CW5 1AA') });
  await settle(300); await ev(() => $('ioGo').click()); await settle(400);
  const F = ((await writes()).find(w => w.op === 'insert' && w.table === 'contacts') || {}).rows || {};
  ok('a sheet made by hand with plain column names', F.first_name === 'Fred' && F.last_name === 'Gate' && F.town === 'Nantwich'
    && F.postcode === 'CW5 1AA', JSON.stringify(F));
  await clearToasts();
  await p.setInputFiles('#ioFile', { name: 'bank.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Amount\n1/1/2026,5') });
  await settle(300);
  ok('a file with no names in it says so', /No name column found/.test(await toasts()), await toasts());
  ok('the chooser takes every kind of contact file', await ev(() => {
    const a = $('ioFile').accept; return ['.csv', '.vcf', 'text/x-vcard', 'text/comma-separated-values'].every(x => a.includes(x)); }));
  ok('the screen says nothing filled in is ever changed', /nothing already filled in is ever changed/.test(flat(await ev(() => $('ioBody').textContent))));
  const help = flat(HTML.slice(HTML.indexOf('id="h-io"'), HTML.indexOf('id="h-colours"')));
  ok('Help covers Google, Outlook, sharing from WhatsApp and filling in', /Google Contacts/.test(help) && /Outlook/.test(help)
    && /WhatsApp/.test(help) && /Fill in what is missing/.test(help) && /Nothing already filled in is ever changed/.test(help), help.slice(0, 200));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
