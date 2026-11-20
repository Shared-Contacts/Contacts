// 20 Nov 2026 (version 2026.11.20.6), asked by Barry that evening:
//   ML346  Send a book, film or series to someone, in the app or not: pick
//          them from Contacts, or type a mobile number or email address (with
//          a tick to add them to Contacts), then WhatsApp, Text or Email opens
//          with the words written. The title, your stars, your notes and a
//          link. Other apps: the phone's Share list, with the picture.
//   ML347  The same for a contact's details (as words, or a contact card),
//          a recipe and a diary entry.
// Pretend people, books and films only; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|does not exist|schema cache|bank-holidays/i;
const SHOTS = process.env.SHOTS;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  p.on('popup', pop => pop.close().catch(() => {}));
  await p.route(/gov\.uk|bsky\.app/, r => r.abort());

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const closeAll = () => ev(() => { document.querySelectorAll('.sendbox').forEach(x => x.remove());
    document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); lockBackground(); });
  const said = () => ev(() => window.__said.join(' | '));
  // The phone's Share list, pretend: it notes what it was handed.
  await ev(() => { WX_OFF = true; BSKY_OFF = true; window.__said = []; const t = toast; toast = s => { window.__said.push(s); t(s); };
    window.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__shared.push({ title: d.title, text: d.text,
      files: await Promise.all((d.files || []).map(async f => ({ name: f.name, type: f.type, text: /^text/.test(f.type) ? await f.text() : '' }))) }); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    // A tap on WhatsApp, Text or Email: the link is noted, nothing opens.
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-sendway]')) e.preventDefault(); }, true);
    // and the link as it stood at the moment of the tap
    window.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-sendway]'); if (a) window.__tapped = a.getAttribute('href'); });
  });
  const box = () => ev(() => { const x = document.querySelector('.sendbox'); return x && {
    head: x.querySelector('.dsec').textContent.replace(/\s+/g, ' ').trim(), text: $('sendText').value,
    other: ($('sendOther') || {}).textContent || '' }; });
  const ways = sel => ev(s => [...document.querySelectorAll(s + ' [data-sendway]')].map(a => a.textContent.trim()).join('|'), sel);
  const tap = async sel => { await p.click(sel); await settle(150); return ev(s => document.querySelector(s).getAttribute('href'), sel); };
  const enc = encodeURIComponent;

  // Pretend people, books, films, a recipe and diary entries.
  const T = await ev(() => { const n = new Date(); return [n.getFullYear(), n.getMonth(), n.getDate()]; });
  await ev(T => {
    const base = { created_by: 'me', contact_groups: [], phones: [], emails: [], socials: [] };
    window.__rows.contacts.push(
      { ...base, id: 961, first_name: 'Pat', last_name: 'Example', phones: [{ label: 'Mobile', value: '07700 900123' }],
        emails: [{ label: 'Home', value: 'pat@example.com' }], address: 'Lock Cottage', town: 'Testbury', postcode: 'TE1 1ST',
        birth_date: '1970-03-04', notes: 'Private note' },
      { ...base, id: 962, first_name: 'Kiri', last_name: 'Kauri', country: 'New Zealand', phones: [{ label: 'Mobile', value: '021 555 0123' }] },
      { ...base, id: 963, first_name: 'Nemo', last_name: 'Noways' },
      { ...base, id: 964, created_by: 'sandra', first_name: 'Shared', last_name: 'Person', phones: [{ label: 'Mobile', value: '07700 900555' }] });
    window.__rows.books = [
      { id: 5, created_by: 'me', title: 'The Salt Path', author: 'Raynor Winn', status: 'read', stars: 5, notes: 'Read it on the boat.',
        links: [{ url: 'https://www.goodreads.com/book/show/1', quote: 'Moving' }], photos: [{ path: 'b/cover.jpg' }], shared_with: [] },
      { id: 6, created_by: 'sandra', title: 'Her Book', author: 'A Writer', status: 'read', stars: 2, notes: 'Hers',
        links: [], photos: [], shared_with: ['me'] }];
    window.__rows.book_reviews = [{ id: 1, book_id: 6, user_id: 'me', stars: 4, words: 'Lovely' }];
    window.__rows.shows = [
      { id: 7, created_by: 'me', title: 'Paddington 2', kind: 'film', year: 2017, channel: 'Netflix', status: 'watched', stars: 4,
        notes: 'Brilliant', links: [{ url: 'https://www.imdb.com/title/tt4468740/' }], photos: [{ path: 't/poster.jpg' }], shared_with: [], views: [] },
      { id: 8, created_by: 'me', title: 'Line of Duty', kind: 'series', status: 'want', links: [], photos: [], shared_with: [], views: [] }];
    window.__rows.show_reviews = [];
    window.__rows.recipes = [
      { id: 1, created_by: 'me', title: 'Leek soup', about: 'A warming one.', categories: ['Soups'], serves: 4,
        ingredients: [{ head: 'For the soup' }, { qty: '2', unit: '', name: 'leeks' }, { qty: '1', unit: 'litre', name: 'stock' }],
        prep_steps: ['Chop the leeks.'], cook_steps: ['Fry gently.', 'Add the stock.'], notes: 'Freezes well.',
        source_url: 'https://example.com/soup', photos: [{ path: 'r/soup.jpg' }], to_try: false, share_all: true, created_at: '2026-10-20T10:00:00Z' },
      { id: 2, created_by: 'me', title: 'Found one', categories: [], serves: 2, ingredients: [], prep_steps: [], cook_steps: [], photos: [],
        to_try: true, share_all: true, created_at: '2026-10-21T10:00:00Z' }];
    const at = (d, h, m) => new Date(T[0], T[1], T[2] + d, h, m).toISOString();
    window.__rows.items.push(
      { id: 971, kind: 'appointment', title: 'Dentist', created_by: 'me', repeat_every: 'none', starts_at: at(1, 14, 0), ends_at: at(1, 15, 30),
        notes: 'Bring the card', updated_at: '2026-01-01' },
      { id: 972, kind: 'todo', title: 'Ring the boatyard', created_by: 'me', repeat_every: 'none', due_at: at(2, 12, 0), updated_at: '2026-01-01' });
  }, T);
  await ev(async () => { await loadAll(); });

  // ---------------------------------------------------------------
  console.log('\nML346 A book');
  await ev(() => { openBooks(); }); await settle(300);
  await ev(() => openBook(5)); await settle(400);
  ok('a book has Send to someone…', await ev(() => !!$('bkSend') && $('bkSend').textContent.trim() === 'Send to someone…'));
  await shot('f-book');
  await p.click('#bkSend'); await settle(300);
  let bx = await box();
  const bookText = 'Thought you might like this book: The Salt Path by Raynor Winn. I gave it 5 out of 5.\n\nRead it on the boat.\n\nhttps://www.goodreads.com/book/show/1';
  ok('it opens the box: Send this book', bx && bx.head === 'Send this book', JSON.stringify(bx));
  ok('  the words: title, author, your stars, your notes, its first link', bx.text === bookText, JSON.stringify(bx.text));
  ok('  and Share with the cover, for other apps', /^Share with the cover…$/.test(bx.other.trim()), bx.other);
  await shot('f-box');
  await p.fill('#sendFind', 'pat'); await settle(200);
  ok('typing a name finds them in Contacts', await ev(() => [...document.querySelectorAll('#sendHits [data-sendpick]')].map(x => x.textContent).includes('Pat Example')));
  await p.click('#sendHits [data-sendpick="961"]'); await settle(200);
  ok('  picked: their name, with WhatsApp, Text and Email', await ev(() => document.querySelector('.sendpicked b').textContent) === 'Pat Example'
    && await ways('#sendWho') === 'WhatsApp|Text|Email');
  ok('  Someone else looks like a link: underlined', await ev(() => /underline/.test(getComputedStyle($('sendWhoChange')).textDecorationLine)));
  await shot('f-picked');
  let h = await tap('#sendWho [data-sendway="whatsapp"]');
  ok('WhatsApp: to their mobile, as +44, with the words written', h === 'https://wa.me/447700900123?text=' + enc(bookText), h);
  ok('  opening in WhatsApp', await ev(() => document.querySelector('#sendWho [data-sendway="whatsapp"]').target === '_blank'));
  await p.fill('#sendText', bookText + '\n\nEnjoy!'); await settle(100);
  h = await tap('#sendWho [data-sendway="text"]');
  ok('Text: the words as changed in the box', h === 'sms:07700900123?body=' + enc(bookText + '\n\nEnjoy!'), h);
  h = await tap('#sendWho [data-sendway="email"]');
  ok('Email: to their address, the title as the subject', h === 'mailto:pat@example.com?subject=' + enc('The Salt Path by Raynor Winn') + '&body=' + enc(bookText + '\n\nEnjoy!'), h);
  await p.click('#sendWhoChange'); await settle(150);
  await p.fill('#sendFind', 'kiri'); await settle(200); await p.click('#sendHits [data-sendpick="962"]'); await settle(150);
  h = await tap('#sendWho [data-sendway="whatsapp"]');
  ok('someone in New Zealand: WhatsApp as +64', /^https:\/\/wa\.me\/64215550123\?text=/.test(h), h);
  await p.click('#sendWhoChange'); await settle(150);
  await p.fill('#sendFind', 'nemo'); await settle(200); await p.click('#sendHits [data-sendpick="963"]'); await settle(150);
  ok('someone with no number or email: says so, nothing to tap', await ways('#sendWho') === ''
    && /No mobile number or email address for them in Contacts/.test(await ev(() => $('sendWho').textContent)));
  await p.click('#sendWhoChange'); await settle(150);
  await p.fill('#sendFind', 'zzqx'); await settle(200);
  ok('  and nobody by that name: says to type their number or email instead', /Nobody by that name/.test(await ev(() => $('sendHits').textContent)));

  console.log('\nSomeone not in Contacts');
  await p.fill('#sendTo', 'hello'); await settle(150);
  ok('neither a number nor an email address: says what it wants', await ways('#sendToWays') === ''
    && /A mobile number or an email address/.test(await ev(() => $('sendToWays').textContent)));
  await p.fill('#sendTo', '07700 900999'); await settle(150);
  ok('a mobile number: WhatsApp and Text, and a tick to add them to Contacts', await ways('#sendToWays') === 'WhatsApp|Text'
    && await ev(() => !!$('sendAdd') && !$('sendAdd').checked && $('sendName').hidden));
  await ev(() => { window.__writes.length = 0; window.__said.length = 0;
    // The pretend database keeps a contact added here, as the real one does.
    const push = window.__writes.push.bind(window.__writes);
    window.__writes.push = w => { if (w.op === 'insert' && w.table === 'contacts' && !Array.isArray(w.rows))
      window.__rows.contacts.push({ id: 9901, contact_groups: [], socials: [], ...w.rows }); return push(w); }; });
  await p.check('#sendAdd'); await settle(100);
  ok('  ticked: a box for their name', await ev(() => !$('sendName').hidden));
  ok('  the tick sits with its words, in the app\'s usual rounded tick', await ev(() => { const l = $('sendAdd').closest('label');
    const t = $('sendAdd').getBoundingClientRect(), w = l.getBoundingClientRect();
    return !!l.closest('.checks') && w.width < $('sendTo').getBoundingClientRect().width && t.left - w.left < 20; }));
  await shot('f-typed');
  await p.click('#sendToWays [data-sendway="whatsapp"]'); await settle(200);
  ok('  no name yet: nothing opens, it asks for one', await ev(() => document.querySelector('#sendToWays [data-sendway="whatsapp"]').getAttribute('href')) === '#'
    && /Type their name to add them/.test(await said()) && await ev(() => !window.__writes.some(w => w.op === 'insert' && w.table === 'contacts')));
  await p.fill('#sendName', 'Sam Newman'); await settle(100);
  await p.click('#sendToWays [data-sendway="whatsapp"]'); await settle(500);
  const ins = await ev(() => window.__writes.filter(w => w.op === 'insert' && w.table === 'contacts').map(w => w.rows));
  h = await ev(() => window.__tapped);
  ok('  with a name: WhatsApp opens to that number', h === 'https://wa.me/447700900999?text=' + enc(bookText + '\n\nEnjoy!'), h);
  ok('  and they are added to Contacts with that mobile number', ins.length === 1 && ins[0].first_name === 'Sam' && ins[0].last_name === 'Newman'
    && ins[0].created_by === 'me' && JSON.stringify(ins[0].phones) === JSON.stringify([{ label: 'Mobile', value: '07700 900999' }]), JSON.stringify(ins));
  ok('  told so', /Added Sam Newman to Contacts/.test(await said()), await said());
  ok('  and the box now says they are in Contacts, with no tick', await ev(() =>
    /That’s Sam Newman in your Contacts/.test($('sendToWays').textContent) && !$('sendAdd')), await ev(() => $('sendToWays').textContent));
  await p.fill('#sendTo', 'jo@example.org'); await settle(150);
  ok('an email address: Email only', await ways('#sendToWays') === 'Email');
  h = await tap('#sendToWays [data-sendway="email"]');
  ok('  to that address', /^mailto:jo@example\.org\?subject=/.test(h), h);
  await p.fill('#sendTo', '+44 7700 900123'); await settle(150);
  ok('the number of someone already in Contacts: says who, no tick to add them again', await ev(() =>
    /That’s Pat Example in your Contacts/.test($('sendToWays').textContent) && !$('sendAdd')));

  console.log('\nOther apps');
  await ev(() => { window.__writes.length = 0; });
  await p.click('#sendOther'); await settle(400);
  let sh = await ev(() => window.__shared.pop());
  ok('Share with the cover: the phone\'s Share list gets the words', sh && sh.text === bookText + '\n\nEnjoy!' && sh.title === 'The Salt Path', JSON.stringify(sh));
  ok('  and the cover', sh && sh.files.length === 1 && sh.files[0].type === 'image/jpeg'
    && await ev(() => window.__writes.some(w => w.op === 'download' && w.path === 'b/cover.jpg')), JSON.stringify(sh && sh.files));
  await p.click('#sendClose'); await settle(200);
  ok('Close: the box goes', await ev(() => !document.querySelector('.sendbox')));
  await ev(() => openBook(6)); await settle(400);
  await p.click('#bkSend'); await settle(300);
  bx = await box();
  ok('someone else\'s book shared with you: your own stars and words, not theirs', /I gave it 4 out of 5\./.test(bx.text) && /Lovely/.test(bx.text)
    && !/Hers|2 out of 5/.test(bx.text), bx.text);
  ok('  no cover, so just Other apps', bx.other.trim() === 'Other apps…', bx.other);
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML346 A film and a series');
  await ev(() => openShows()); await settle(300);
  await ev(() => openShow(7)); await settle(400);
  ok('a film has Send to someone…', await ev(() => !!$('tvSend')));
  await p.click('#tvSend'); await settle(300);
  bx = await box();
  ok('Send this film: the title and year, where it\'s on, your stars, notes and link', bx.head === 'Send this film'
    && bx.text === 'Thought you might like this film: Paddington 2 (2017). It\'s on Netflix. I gave it 4 out of 5.\n\nBrilliant\n\nhttps://www.imdb.com/title/tt4468740/', JSON.stringify(bx));
  ok('  and Share with the poster', bx.other.trim() === 'Share with the poster…', bx.other);
  await closeAll(); await ev(() => openShow(8)); await settle(400);
  await p.click('#tvSend'); await settle(300);
  bx = await box();
  ok('a series with no year, channel or stars: just its name', bx.head === 'Send this series' && bx.text === 'Thought you might like this series: Line of Duty.', JSON.stringify(bx));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML347 A contact\'s details');
  await ev(() => openDetail(961)); await settle(500);
  ok('your own contact has Send their details to someone…', await ev(() => !!$('detSend')));
  await ev(() => $('detSend').scrollIntoView({ block: 'center' })); await shot('f-contact');
  await p.click('#detSend'); await settle(300);
  bx = await box();
  ok('Send Pat Example’s details: name, numbers, email and address', bx.head === 'Send Pat Example’s details'
    && bx.text === 'Pat Example\nMobile: 07700 900123\nHome email: pat@example.com\nAddress: Lock Cottage, Testbury, TE1 1ST', JSON.stringify(bx));
  ok('  not their birthday or notes', !/1970|Private/.test(bx.text));
  ok('  Other apps sends a contact card', bx.other.trim() === 'Share as a contact card…', bx.other);
  await p.click('#sendOther'); await settle(300);
  sh = await ev(() => window.__shared.pop());
  const card = sh && sh.files[0] && sh.files[0].text;
  ok('  a .vcf card they can save', sh && sh.files.length === 1 && sh.files[0].name === 'Pat-Example.vcf' && sh.files[0].type === 'text/vcard', JSON.stringify(sh && sh.files));
  ok('  with the name, mobile, email and address', /^BEGIN:VCARD\r\nVERSION:3\.0\r\nN:Example;Pat;;;\r\nFN:Pat Example\r\n/.test(card || '')
    && /TEL;TYPE=CELL:07700 900123\r\n/.test(card) && /EMAIL:pat@example\.com\r\n/.test(card)
    && /ADR;TYPE=HOME:;;Lock Cottage;Testbury;;TE1 1ST;\r\n/.test(card) && /END:VCARD\r\n$/.test(card), JSON.stringify(card));
  await closeAll();
  await ev(() => openDetail(964)); await settle(500);
  ok('one shared with you by someone else: not yours to pass on, no button', await ev(() => !$('detSend')));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML347 A recipe');
  await ev(() => openRecipes()); await settle(400);
  await ev(() => openRecipe(1)); await settle(400);
  ok('a recipe has Send to someone…', await ev(() => !!$('rvSend')));
  await p.click('#rvSend'); await settle(300);
  bx = await box();
  ok('Send this recipe: the whole of it', bx.head === 'Send this recipe' && /^Leek soup\n\nA warming one\.\n\nServes 4\n\nIngredients\n\nFor the soup\n- 2 leeks\n- 1 ?litre stock\n\nPreparing\n1\. Chop the leeks\.\n\nCooking\n1\. Fry gently\.\n2\. Add the stock\.\n\nNotes\nFreezes well\.\n\nhttps:\/\/example\.com\/soup$/.test(bx.text), JSON.stringify(bx.text));
  ok('  and Share with the photo', bx.other.trim() === 'Share with the photo…', bx.other);
  await closeAll();
  await ev(() => { openRecipes(); openRecipe(2); }); await settle(400);
  ok('one found on the web, still to keep or reject: no Send yet', await ev(() => !$('rvSend')));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML347 A diary entry');
  await ev(() => openItem(ITEMS.find(x => x.id === 971))); await settle(400);
  ok('a saved appointment has Send to someone…', await ev(() => !!$('itSend')));
  await p.click('#itSend'); await settle(300);
  bx = await box();
  const want = await ev(T => { const d = new Date(T[0], T[1], T[2] + 1);
    return d.toLocaleDateString('en-GB', { weekday: 'long' }) + ' ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      + ', 14:00 to 15:30'; }, T);
  ok('Send this appointment: the title, the day and times, the notes', bx.head === 'Send this appointment'
    && bx.text === 'Dentist\n\n' + want + '\n\nBring the card', JSON.stringify(bx));
  await closeAll();
  await ev(() => openItem(ITEMS.find(x => x.id === 972))); await settle(400);
  await p.click('#itSend'); await settle(300);
  bx = await box();
  ok('a to-do: By the day it is due, with no comma after the day', bx.head === 'Send this to-do' && /^Ring the boatyard\n\nBy \w+day \d{1,2} \w+ \d{4}, 12:00$/.test(bx.text), JSON.stringify(bx));
  await closeAll();
  await ev(() => openItem(null)); await settle(300);
  ok('a new one, not saved yet: no Send', await ev(() => !$('itSend')));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nOn a narrow phone');
  for (const w of [320, 360]) {
    await p.setViewportSize({ width: w, height: 700 }); await settle(200);
    await ev(() => { openBooks(); openBook(5); }); await settle(300);
    await p.click('#bkSend'); await settle(300);
    await p.fill('#sendFind', 'pat'); await settle(150); await p.click('#sendHits [data-sendpick="961"]'); await settle(150);
    const fit = await ev(() => { const i = document.querySelector('.sendbox .inner').getBoundingClientRect();
      const ws = [...document.querySelectorAll('#sendWho [data-sendway]')].map(a => a.getBoundingClientRect());
      const spill = [...document.querySelectorAll('#sendWho [data-sendway]')].some(a => a.scrollWidth > a.clientWidth + 1);
      return { l: i.left, r: i.right, tops: [...new Set(ws.map(x => Math.round(x.top)))].length, wide: document.documentElement.scrollWidth, spill }; });
    ok(`at ${w} wide: the box fits, the three buttons on one line, their words inside them`, fit.l >= 0 && fit.r <= w && fit.tops === 1
      && fit.wide <= w && !fit.spill, JSON.stringify(fit));
    if (w === 320) await shot('f-320');
    await closeAll();
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);

  // ---------------------------------------------------------------
  console.log('\nHelp and the version');
  const hp = await ev(() => { openHelp('contacts'); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    $('help').classList.add('hidden'); lockBackground(); return t; });
  ok('Help says how, for each', /Send to someone… on a book’s screen sends it to anyone, in the app or not/.test(hp)
    && /Send to someone… works as it does for a book/.test(hp) && /Send to someone… on a recipe sends the whole of it/.test(hp)
    && /Send to someone…, at the bottom of an entry you have saved/.test(hp)
    && /Send their details to someone… on one of your own contacts/.test(hp) && /Share as a contact card/.test(hp));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const V = vj.history.find(x => x.version === '2026.11.20.6');
  ok('2026.11.20.6 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version
    && vj.history[0].version === vj.version);
  ok('  what\'s new says so', !!V && /Send to someone/.test(V.changes.join(' ')) && /contact card/.test(V.changes.join(' ')));

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
