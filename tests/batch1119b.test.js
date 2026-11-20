// 19 Nov 2026 (version 2026.11.19.2):
//   ML306  Birthday messages. On someone's birthday, Today and their contact
//          page have a Send Happy Birthday button that opens WhatsApp,
//          Messages or email with the words written; you press Send. A
//          Birthday message card on the contact (tick, way, wording), and the
//          wordings under Settings > Contacts. Yours alone (step 66).
// Pretend people, numbers and addresses only; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED|refused/i;   // refused: the failed save, on purpose

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  p.on('popup', pop => pop.close().catch(() => {}));
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  const ups = t => ev(t => window.__writes.filter(w => w.op === 'upsert' && w.table === t).map(w => w.rows), t);
  // The links would open WhatsApp, Messages or email; here they go nowhere.
  await ev(() => document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-bsend]')) e.preventDefault(); }, true));

  const today = await ev(() => dayKeyOf(new Date()));
  const inThree = await ev(() => { const t = new Date(); return dayKeyOf(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 3)); });
  const born = k => '1960-' + k.slice(5);
  await ev(([bt, b3]) => {
    const base = { created_by: 'me', contact_groups: [], phones: [], emails: [], socials: [] };
    window.__rows.contacts.push(
      { ...base, id: 801, first_name: 'Ann', last_name: 'Ash', birth_date: bt,
        phones: [{ label: 'Mobile', value: '07700 900111' }], emails: [{ label: 'Home', value: 'ann@example.com' }] },
      { ...base, id: 802, first_name: 'Ben', last_name: 'Birch', birth_date: bt,
        emails: [{ label: 'Work', value: 'ben@example.com' }] },
      { ...base, id: 803, first_name: 'Cat', last_name: 'Cole', birth_date: bt },
      { ...base, id: 804, first_name: 'Dan', last_name: 'Dale', birth_date: bt,
        phones: [{ label: 'Home', value: '01632 960111' }] },
      { ...base, id: 805, first_name: 'Eve', last_name: 'Elm', birth_date: bt, death_date: '2020-01-01',
        phones: [{ label: 'Mobile', value: '07700 900555' }] },
      { ...base, id: 806, first_name: 'Fay', last_name: 'Fern', birth_date: b3, country: 'New Zealand',
        phones: [{ label: 'Mobile', value: '021 555 0101' }], socials: [{ label: 'WhatsApp', value: '+64 21 555 0199' }] },
      { ...base, id: 807, first_name: 'Gus', last_name: 'Gale', birth_date: bt,
        phones: [{ label: 'Mobile', value: '07700 900777' }] },
      { ...base, id: 808, first_name: 'Hal', last_name: 'Hay', birth_date: bt,
        phones: [{ label: '', value: '07700 900888' }], emails: [{ label: 'Home', value: 'hal@example.com' }] },
      { ...base, id: 809, first_name: 'Ivy', last_name: 'Ives', birth_date: bt, country: 'New Zealand',
        phones: [{ label: 'Home', value: '07 555 0109' }] });
    window.__rows.bday_wordings = [];
    window.__rows.bday_sends = [
      { created_by: 'me', contact_id: 807, send: false, wording: null, way: null, sent_on: null },
      { created_by: 'me', contact_id: 808, send: true, wording: 'gone', way: 'email', sent_on: null },
      // Someone else's choice about Ann, which is theirs alone.
      { created_by: 'sandra', contact_id: 801, send: false, wording: null, way: 'text', sent_on: null }];
  }, [born(today), born(inThree)]);

  // ---------------------------------------------------------------
  console.log('\nBefore step 66 is run');
  await ev(async () => {
    const real = sb.from.bind(sb); window.__realFrom = real;
    sb.from = t => /^bday_/.test(t)
      ? { select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'relation "' + t + '" does not exist' } }) }) }
      : real(t);
    await loadAll();
    sb.from = real;
  });
  ok('the app still opens, with birthday messages switched off', await ev(() => BDAY_READY === false && CONTACTS.length > 5));
  await ev(() => renderBrief());
  ok('  Today shows the birthdays, with no Send button', await ev(() =>
    !!document.querySelector('#briefBody [data-briefc="801"]') && !document.querySelector('#briefBody .bsend')));
  await ev(() => openDetail(801)); await settle();
  ok('  and no Birthday message card on the contact', await ev(() => !$('bdayCard')));
  await ev(async () => { SET_OPEN.bdaymsg = true; await openSettings(); }); await settle();
  const pre = await ev(() => { const c = document.querySelector('[data-setcard="bdaymsg"]'); return c ? c.textContent.replace(/\s+/g, ' ') : 'no card'; });
  ok('  Settings says step 66 is needed first', /need step 66 run in Supabase first/.test(pre), pre.slice(0, 200));
  await ev(() => { $('settings').classList.add('hidden'); });

  // ---------------------------------------------------------------
  console.log('\nAfter step 66');
  await ev(() => loadAll());
  ok('switched on once both tables are there', await ev(() => BDAY_READY === true));
  ok('only your own choices are read, not someone else’s on a shared contact', await ev(() =>
    !BDAY_SENDS[801] && BDAY_SENDS[807] && BDAY_SENDS[807].send === false && bdayChoice(CONTACTS.find(c => c.id === 801)).send === true));
  ok('with none saved, three wordings to start with, the first the standard', await ev(() =>
    bdayWordings().length === 3 && /^Happy Birthday \{name\}! Hope you have a lovely day\.$/.test(bdayWordings()[0].text)));

  console.log('\nWhere a message can go');
  const ways = await ev(() => Object.fromEntries([801, 802, 803, 804, 806, 808, 809].map(id =>
    [id, bdayWays(CONTACTS.find(c => c.id === id))])));
  ok('a UK mobile: WhatsApp, text, and email too', ways[801].whatsapp === '447700900111' && ways[801].text === '07700900111'
    && ways[801].email === 'ann@example.com', JSON.stringify(ways[801]));
  ok('just an email: email only', JSON.stringify(ways[802]) === '{"email":"ben@example.com"}', JSON.stringify(ways[802]));
  ok('nothing to send to: nowhere', JSON.stringify(ways[803]) === '{}' && JSON.stringify(ways[804]) === '{}',
    JSON.stringify([ways[803], ways[804]]));
  ok('WhatsApp goes to their WhatsApp number when they have one', ways[806].whatsapp === '64215550199'
    && ways[806].text === '0215550101', JSON.stringify(ways[806]));
  ok('a 07 number with no label counts as a UK mobile', ways[808].whatsapp === '447700900888', JSON.stringify(ways[808]));
  ok('but in New Zealand a 07 number is a landline', JSON.stringify(ways[809]) === '{}', JSON.stringify(ways[809]));
  const intl = await ev(() => [bdayIntl('07700 900222', {}), bdayIntl('+44 (0)7700 900222', {}), bdayIntl('0044 7700 900222', {}),
    bdayIntl('021 555 0101', { country: 'NZ' }), bdayIntl('0412 345 678', { country: 'Australia' }),
    bdayIntl('06 12 34 56 78', { country: 'France' }), bdayIntl('+33 6 12 34 56 78', { country: 'France' })]);
  ok('numbers made ready for WhatsApp, by country', JSON.stringify(intl) === JSON.stringify(['447700900222',
    '447700900222', '447700900222', '64215550101', '61412345678', null, '33612345678']), JSON.stringify(intl));

  // ---------------------------------------------------------------
  console.log('\nToday, on the day');
  await clearWrites();
  await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); openBrief(); }); await settle();
  const brief = await ev(() => [...document.querySelectorAll('#briefBody .bsend')].map(x => ({
    after: x.previousElementSibling && x.previousElementSibling.dataset.briefc,
    a: x.querySelector('a') && { href: x.querySelector('a').getAttribute('href'), text: x.textContent.replace(/\s+/g, ' ').trim(),
      target: x.querySelector('a').getAttribute('target'), id: x.querySelector('a').dataset.bsend } })));
  const at = id => brief.find(x => x.after === String(id));
  ok('a Send button under each person whose birthday it is, who can be sent one', brief.length === 3
    && at(801) && at(802) && at(808), JSON.stringify(brief.map(x => x.after)));
  ok('  none for someone with nowhere to send it, someone unticked, someone who has died, or a birthday still to come',
    ![803, 804, 805, 806, 807, 809].some(at));
  ok('  Ann: WhatsApp, opening in WhatsApp with the words written',
    at(801).a.href.startsWith('https://wa.me/447700900111?text=') && at(801).a.target === '_blank'
    && decodeURIComponent(at(801).a.href.split('?text=')[1]) === 'Happy Birthday Ann! Hope you have a lovely day.'
    && /Send Happy Birthday · WhatsApp/.test(at(801).a.text), JSON.stringify(at(801)));
  ok('  Ben: email, with a subject', at(802).a.href.startsWith('mailto:ben@example.com?subject=Happy%20Birthday&body=')
    && /Happy%20Birthday%20Ben!/.test(at(802).a.href) && /· Email/.test(at(802).a.text) && !at(802).a.target, JSON.stringify(at(802)));
  ok('  Hal: email as chosen, and the standard wording since the one chosen has gone',
    at(808).a.href.startsWith('mailto:hal@example.com') && /Hope%20you%20have%20a%20lovely%20day/.test(at(808).a.href));
  ok('  the Send button is not inside the row’s own button', await ev(() =>
    !document.querySelector('#briefBody .brow a, #briefBody .brow .bsend')));
  const fits = await ev(() => { const btn = document.querySelector('#briefBody .bsendbtn'), card = btn.closest('.card');
    const r = btn.getBoundingClientRect(), c = card.getBoundingClientRect();
    return { ok: r.right <= c.right + 0.5 && r.left >= c.left && document.documentElement.scrollWidth <= 390, w: r.width, h: r.height }; });
  ok('  it fits on a phone, big enough to tap', fits.ok && fits.h >= 40, JSON.stringify(fits));

  await p.click('#briefBody a[data-bsend="801"]'); await settle();
  const sentRows = await ups('bday_sends');
  ok('tapping it notes it as sent today, for you', sentRows.length === 1 && sentRows[0].created_by === 'me'
    && sentRows[0].contact_id === 801 && sentRows[0].sent_on === today && !('send' in sentRows[0]), JSON.stringify(sentRows));
  ok('  and it opens nothing else in the app', await ev(() => $('detail') ? $('detail').classList.contains('hidden') : true));
  const after = await ev(() => { const x = document.querySelector('#briefBody .brow[data-briefc="801"]').nextElementSibling;
    return x.textContent.replace(/\s+/g, ' ').trim(); });
  ok('  the button becomes Sent by WhatsApp, with a Send again', /✓ Sent by WhatsApp/.test(after) && /Send again/.test(after), after);
  await ev(() => renderBrief());
  ok('  and stays that way when Today is drawn again', await ev(() =>
    /Sent by WhatsApp/.test(document.querySelector('#briefBody .brow[data-briefc="801"]').nextElementSibling.textContent)));
  ok('tapping the name still opens their contact', await ev(() => typeof document.querySelector('#briefBody [data-briefc="801"]').onclick === 'function'));

  // ---------------------------------------------------------------
  console.log('\nTheir contact page');
  await clearWrites();
  await ev(() => openDetail(801)); await settle();
  const card = () => ev(() => { const c = $('bdayCard'); if (!c) return null;
    return { ticked: $('bdaySend') && $('bdaySend').checked,
      ways: [...c.querySelectorAll('[data-bdway]')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      opts: $('bdayWord') ? [...$('bdayWord').options].map(o => o.textContent) : [],
      word: $('bdayWord') && $('bdayWord').value,
      say: c.querySelector('.bdaysay') && c.querySelector('.bdaysay').textContent,
      href: c.querySelector('[data-bsend]') && c.querySelector('[data-bsend]').getAttribute('href'),
      text: c.textContent.replace(/\s+/g, ' ') }; });
  let k = await card();
  ok('a Birthday message card, straight after Personal', !!k && await ev(() => {
    const cards = [...$('detBody').querySelectorAll('.card')]; const i = cards.indexOf($('bdayCard'));
    return i > 0 && cards[i - 1].querySelector('h3').textContent === 'Personal'; }));
  ok('  ticked to begin with: Send birthday message', k.ticked === true && /Send birthday message/.test(k.text));
  ok('  WhatsApp, Text and Email to choose from, WhatsApp chosen', k.ways.join() === 'WhatsApp*,Text,Email', k.ways.join());
  ok('  the three wordings, with their name in, the first the standard', k.opts.length === 3
    && /^Happy Birthday Ann! .*\(standard\)$/.test(k.opts[0]) && !/\{name\}/.test(k.opts.join()), k.opts.join(' / '));
  ok('  the message as it will read', k.say === 'Happy Birthday Ann! Hope you have a lovely day.', k.say);
  ok('  and on the day, the button (here already Sent)', /Sent by WhatsApp/.test(k.text) && !!k.href);

  await p.click('#bdayCard [data-bdway="text"]'); await settle();
  k = await card();
  let u = await ups('bday_sends');
  ok('choosing Text saves it, for you', u.length === 1 && u[0].way === 'text' && u[0].created_by === 'me' && u[0].contact_id === 801,
    JSON.stringify(u));
  ok('  and the button now opens Messages', k.ways.join() === 'WhatsApp,Text*,Email' && /^sms:07700900111\?body=Happy%20Birthday%20Ann/.test(k.href), k.href);
  await p.selectOption('#bdayWord', 's3'); await settle();
  k = await card(); u = await ups('bday_sends');
  ok('choosing another wording saves it and shows it', u.length === 2 && u[1].wording === 's3'
    && k.say === 'Many happy returns, Ann! Have a brilliant day.' && k.word === 's3', JSON.stringify(u[1]) + ' ' + k.say);
  await ev(() => renderBrief());
  ok('  and Today uses it', await ev(() => /^sms:.*Many%20happy%20returns%2C%20Ann/.test(
    document.querySelector('#briefBody a[data-bsend="801"]').getAttribute('href'))));

  await p.click('#bdaySend'); await settle();
  k = await card(); u = await ups('bday_sends');
  ok('untick: saved as no, and the choices tuck away', u[2].send === false && k.ticked === false && k.ways.length === 0 && !k.say,
    JSON.stringify(u[2]));
  await ev(() => renderBrief());
  ok('  and Today has no button for them', await ev(() => !document.querySelector('#briefBody a[data-bsend="801"]')));
  await p.click('#bdaySend'); await settle();
  k = await card(); u = await ups('bday_sends');
  ok('tick again: back, with what you chose before', u[3].send === true && k.ways.join() === 'WhatsApp,Text*,Email' && k.word === 's3');

  console.log('\nWhen a save fails');
  await ev(() => { const real = window.__realFrom; sb.from = t => { const a = real(t);
    if (t === 'bday_sends') a.upsert = () => Promise.resolve({ data: null, error: { message: 'refused' } }); return a; }; });
  await clearWrites();
  await p.click('#bdaySend'); await settle();
  k = await card();
  ok('it says so and puts the tick back', /Could not save that/.test(await said()) && k.ticked === true
    && await ev(() => BDAY_SENDS[801].send !== false));
  await ev(() => { sb.from = window.__realFrom; });

  console.log('\nOther contacts');
  await ev(() => openDetail(806)); await settle();
  k = await card();
  ok('a birthday still to come: what will happen on the day, no button yet', !k.href
    && /At 8pm the evening before their birthday \(morning in\s+New Zealand\), Today has a button that opens WhatsApp/.test(k.text), k.text.slice(0, 200));   // Fay is in New Zealand (ML316)
  await ev(() => openDetail(803)); await settle();
  k = await card();
  ok('nowhere to send it: a note saying what to add, no tick', !!k && !k.ticked && k.ways.length === 0
    && /Add a mobile number or an email address/.test(k.text), JSON.stringify(k));
  await ev(() => openDetail(802)); await settle();
  k = await card();
  ok('email only: just Email to choose', k.ways.join() === 'Email*', k.ways.join());
  await ev(() => openDetail(805)); await settle();
  ok('someone who has died: no card', await ev(() => !$('bdayCard')));
  await ev(() => openDetail(1)); await settle();
  ok('someone with no birthday: no card', await ev(() => !$('bdayCard')));
  await ev(() => openDetail(801)); await settle();
  const cardFits = await ev(() => { const c = $('bdayCard').getBoundingClientRect(), s = $('bdayWord').getBoundingClientRect();
    return s.right <= c.right + 0.5 && $('detBody').scrollWidth <= $('detBody').clientWidth + 1; });
  ok('the card fits on a phone', cardFits);

  // ---------------------------------------------------------------
  console.log('\nSettings › Contacts › Birthday messages');
  await clearWrites();
  await ev(async () => { SET_OPEN.bdaymsg = true; await openSettings(); }); await settle();
  const setc = () => ev(() => { const c = document.querySelector('[data-setcard="bdaymsg"]');
    return { open: c.open, under: (() => { let x = c.previousElementSibling; while (x && !x.matches('p.dsec')) x = x.previousElementSibling;
        return x && x.textContent; })(),
      texts: [...c.querySelectorAll('[data-bdtext]')].map(t => t.value),
      stars: [...c.querySelectorAll('[data-bdstar]')].map(b => b.getAttribute('aria-pressed')),
      words: c.textContent.replace(/\s+/g, ' ') }; });
  let s = await setc();
  ok('a card under Contacts', s.under === 'Contacts' && s.open, s.under);
  ok('  the three wordings to start with, the first starred', s.texts.length === 3 && s.stars.join() === 'true,false,false'
    && s.texts[2] === 'Many happy returns, {name}! Have a brilliant day.');
  ok('  saying {name} becomes their first name, and they are yours alone', /\{name\} becomes their first name/.test(s.words)
    && /Yours alone/.test(s.words));
  await p.click('#bdAdd'); await settle();
  ok('Add with nothing typed asks for the words', /Type the wording first/.test(await said()) && (await ups('bday_wordings')).length === 0);
  await p.fill('#bdNew', 'Happy Birthday {name}! Love from us both'); await p.click('#bdAdd'); await settle(400);
  let w = await ups('bday_wordings'); s = await setc();
  ok('adding one saves all four for you, the new one last', w.length === 1 && w[0].created_by === 'me'
    && w[0].wordings.length === 4 && w[0].wordings[3].text === 'Happy Birthday {name}! Love from us both'
    && w[0].wordings[0].k === 's1' && s.texts.length === 4, JSON.stringify(w[0] && w[0].wordings));
  const newK = w[0].wordings[3].k;
  await p.click(`[data-bdstar="${newK}"]`); await settle(400);
  w = await ups('bday_wordings'); s = await setc();
  ok('the star makes it the standard: moved to the top', w[1].wordings[0].k === newK && s.stars.join() === 'true,false,false,false'
    && s.texts[0] === 'Happy Birthday {name}! Love from us both', JSON.stringify(w[1].wordings.map(x => x.k)));
  // Typed and then left, as on the phone: one change each.
  const typeIn = (sel, v) => ev(([sel, v]) => { const t = document.querySelector(sel); t.value = v;
    t.dispatchEvent(new Event('change')); }, [sel, v]);
  await typeIn(`[data-bdtext="s2"]`, 'Happy Birthday {name}! Have a great year.'); await settle(400);
  w = await ups('bday_wordings');
  ok('changing the words saves them', w[2].wordings.find(x => x.k === 's2').text === 'Happy Birthday {name}! Have a great year.'
    && /Saved/.test(await said()));
  await typeIn(`[data-bdtext="s1"]`, '   '); await settle(300);
  ok('emptying one is not saved: it puts the words back', (await ups('bday_wordings')).length === 3
    && /Use the × to remove a wording/.test(await said())
    && await ev(() => document.querySelector('[data-bdtext="s1"]').value === 'Happy Birthday {name}! Hope you have a lovely day.'));
  await p.click('[data-bddrop="s3"]'); await settle(400);
  w = await ups('bday_wordings'); s = await setc();
  ok('× removes one', w[3].wordings.length === 3 && !w[3].wordings.some(x => x.k === 's3') && s.texts.length === 3);

  await ev(() => { $('settings').classList.add('hidden'); });
  await ev(() => openDetail(801)); await settle();
  k = await card();
  ok('on the contact, the new standard comes first', /^Happy Birthday Ann! Love from us both \(standard\)$/.test(k.opts[0]), k.opts[0]);
  ok('  and Ann, set to the one removed, gets the standard one', k.say === 'Happy Birthday Ann! Love from us both' && k.word === newK, k.say);
  ok('  {name} is filled in wherever it is', await ev(() => bdayFill('Hi {NAME}, from {name}?', CONTACTS.find(c => c.id === 801)) === 'Hi Ann, from Ann?'));

  await ev(async () => { SET_OPEN.bdaymsg = true; await openSettings(); }); await settle();
  await p.click('[data-bddrop="s2"]'); await settle(400);
  await p.click('[data-bddrop="s1"]'); await settle(400);
  await clearWrites();
  await p.click(`[data-bddrop="${newK}"]`); await settle(300);
  ok('the last one cannot be removed', /Keep at least one wording/.test(await said()) && (await ups('bday_wordings')).length === 0
    && (await setc()).texts.length === 1);
  const setFits = await ev(() => document.documentElement.scrollWidth <= 390 && $('setBody').scrollWidth <= $('setBody').clientWidth + 1);
  ok('  and the card fits on a phone', setFits);
  await ev(() => { $('settings').classList.add('hidden'); });

  // Saved wordings are read back as they were left.
  await ev(async () => { window.__rows.bday_wordings = [{ created_by: 'me', wordings: [{ k: 'a', text: 'Cheers {name}' }, { k: 'b', text: '  ' }] },
    { created_by: 'sandra', wordings: [{ k: 'z', text: 'Not yours' }] }];
    await loadAll(); });
  ok('your saved wordings are read back, blank ones left out, nobody else’s', await ev(() =>
    bdayWordings().length === 1 && bdayWordings()[0].text === 'Cheers {name}'));

  // ---------------------------------------------------------------
  console.log('\nHelp and the version');
  const help = await ev(() => { openHelp(); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); return t; });
  ok('Help explains birthday messages', /Birthday messages/.test(help) && /press Send yourself: the app never sends anything on its own/.test(help)
    && /Settings › Contacts › Birthday messages/.test(help) && /WhatsApp is offered for any mobile/.test(help));
  ok('  and Today mentions the button', /On someone’s birthday there is a green Send Happy Birthday button under their name/.test(help));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const appVer = await ev(() => APP_VERSION), V = vj.history.find(h => h.version === '2026.11.19.2');
  ok('2026.11.19.2 is in version.json, and the page is the newest', !!V && V.changes.length === 3
    && vj.version === appVer && vj.history[0].version === appVer, appVer + ' / ' + vj.version);

  ok('no page errors', errors.length === 0, errors.join(' / '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
