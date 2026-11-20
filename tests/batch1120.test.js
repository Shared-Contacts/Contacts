// 20 Nov 2026 (version 2026.11.20.1):
//   ML316  Birthday messages: someone in New Zealand or Australia gets the
//          Send button at 8pm the night before; one sent then counts.
//   ML317  Slideshow: Play both ways.
//   ML319  Slideshow: Random or Date taken order, the date read from the
//          photo's camera note (Exif), else the file's date.
//   ML320  Contacts sent to you: a red number on the Contacts tile, a box
//          asking whether to look now, and a list on Today.
//   ML321  Multi Select (was Tidy up), with a tick-box button on Contacts.
//   ML322  The phone's Back arrow goes back one screen; the home screen stays.
//   ML323  Loxx: the words at the top sit on the line of players.
// Pretend people, photos and dates only; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
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
  // Bluesky, faked: two photo posts with their dates.
  await p.route(/public\.api\.bsky\.app|bsky\.social\/xrpc|getAuthorFeed/, route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ feed: [
      { post: { uri: 'at://x/1', indexedAt: '2024-05-02T10:00:00Z', record: { createdAt: '2024-05-01T09:00:00Z' },
        embed: { images: [{ fullsize: 'https://cdn.example/wide1.png', aspectRatio: { width: 3, height: 2 } }] } } },
      { post: { uri: 'at://x/2', indexedAt: '2023-02-02T10:00:00Z', record: { createdAt: '2023-02-01T09:00:00Z' },
        embed: { images: [{ fullsize: 'https://cdn.example/tall1.png', aspectRatio: { width: 2, height: 3 } }] } } }] }) }));
  await p.route(/cdn\.example\//, route => route.fulfill({ contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }));

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await answerLkAsks(p, () => true);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; window.__said = []; const t = toast; toast = s => { window.__said.push(s); t(s); }; });
  const said = () => ev(() => window.__said.join(' | '));
  const clearSaid = () => ev(() => { window.__said.length = 0; });
  const open = id => ev(i => !!$(i) && !$(i).classList.contains('hidden'), id);
  // Help is drawn when it is opened: open it, read it, shut it again.
  const help = () => ev(() => { const was = $('help').classList.contains('hidden'); openHelp('contacts');
    const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    if (was) { $('help').classList.add('hidden'); lockBackground(); } return t; });
  const closeAll = () => ev(() => { if (SLD) sldStop(); document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('body > .daypick').forEach(d => d.remove()); if (PICKING) stopPicking(); lockBackground(); });
  // A clock that says what we tell it, for the evening before a birthday.
  await ev(() => {
    window.__RealDate = Date;
    window.__fakeAt = ms => { const R = window.__RealDate;
      window.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }; };
    window.__realAt = () => { window.Date = window.__RealDate; };
  });

  // ---------------------------------------------------------------
  console.log('\nML316 Birthday messages: the time difference');
  const T = await ev(() => { const n = new Date(); return [n.getFullYear(), n.getMonth(), n.getDate()]; });
  const at = (dd, h, m = 0) => new Date(T[0], T[1], T[2] + dd, h, m).getTime();
  const key = dd => { const d = new Date(T[0], T[1], T[2] + dd); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const born = '1958-' + key(1).slice(5);
  await ev(bd => {
    const base = { created_by: 'me', contact_groups: [], phones: [], emails: [], socials: [] };
    window.__rows.contacts.push(
      { ...base, id: 901, first_name: 'Kiri', last_name: 'Kauri', birth_date: bd, country: 'New Zealand',
        phones: [{ label: 'Mobile', value: '021 555 0123' }] },
      { ...base, id: 902, first_name: 'Abe', last_name: 'Acacia', birth_date: bd, country: 'Australia',
        phones: [{ label: 'Mobile', value: '0412 555 012' }] },
      { ...base, id: 903, first_name: 'Uma', last_name: 'Upton', birth_date: bd,
        phones: [{ label: 'Mobile', value: '07700 900123' }] });
    window.__rows.bday_wordings = []; window.__rows.bday_sends = [];
  }, born);
  await ev(async () => { await loadAll(); });
  ok('step 66 there, and the three are ticked to send', await ev(() => BDAY_READY && [901, 902, 903].every(id => bdayChoice(CONTACTS.find(c => c.id === id)).send)));
  const due = (id, ms) => ev(([id, ms]) => bdayDue(CONTACTS.find(c => c.id === id), new window.__RealDate(ms)), [id, ms]);
  ok('New Zealand, the day before at 7.59pm: not yet', !(await due(901, at(0, 19, 59))));
  ok('  at 8pm: time to send (morning there)', await due(901, at(0, 20, 0)));
  ok('  and late that evening too', await due(901, at(0, 23, 30)));
  ok('  and all through their birthday here', await due(901, at(1, 9, 0)) && await due(901, at(1, 22, 0)));
  ok('Australia: the same, from 8pm the night before', !(await due(902, at(0, 19, 0))) && await due(902, at(0, 20, 15)));
  ok('the United Kingdom: only on the day itself', !(await due(903, at(0, 23, 30))) && await due(903, at(1, 0, 5)));
  ok('two days before, even in New Zealand: not yet', !(await due(901, at(-1, 21, 0))));

  // Today at 8.30pm the evening before.
  await ev(ms => window.__fakeAt(ms), at(0, 20, 30));
  await ev(() => { showSheet('brief'); renderBrief(); lockBackground(); }); await settle(300);
  const row = id => ev(id => { const r = document.querySelector(`[data-briefc="${id}"]`); if (!r) return null;
    const nx = r.nextElementSibling; return { text: r.textContent.replace(/\s+/g, ' ').trim(),
      send: nx && nx.classList.contains('bsend') ? nx.textContent.replace(/\s+/g, ' ').trim() : '' }; }, id);
  let k = await row(901);
  ok('Today at 8.30pm: Kiri says Tomorrow, already their birthday in New Zealand', k && /Tomorrow/.test(k.text)
    && /Already their birthday in New Zealand/.test(k.text), JSON.stringify(k));
  ok('  with the Send Happy Birthday button', k && /Send Happy Birthday · WhatsApp/.test(k.send), JSON.stringify(k));
  const a = await row(902), u = await row(903);
  ok('  Abe in Australia too', a && /Already their birthday in Australia/.test(a.text) && /Send Happy Birthday/.test(a.send), JSON.stringify(a));
  ok('  Uma, here in the UK, waits for tomorrow: no button', u && !u.send && !/Already/.test(u.text), JSON.stringify(u));
  ok('  the words fit beside the date on a phone', await ev(() => { const e = document.querySelector('[data-briefc="901"] .beve');
    return !!e && e.getBoundingClientRect().right <= innerWidth && getComputedStyle(e).color === 'rgb(46, 125, 79)'; }));
  await ev(() => document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-bsend]')) e.preventDefault(); }, true));
  await p.click('[data-bsend="901"]'); await settle(400);
  ok('tapping it notes it as sent this evening', await ev(k => BDAY_SENDS[901] && BDAY_SENDS[901].sent_on === k, key(0)));
  k = await row(901);
  ok('  and it says Sent by WhatsApp', k && /Sent by WhatsApp/.test(k.send), JSON.stringify(k));
  // The next morning, their birthday here.
  await ev(ms => window.__fakeAt(ms), at(1, 9, 0));
  await ev(() => renderBrief()); await settle(200);
  k = await row(901);
  ok('the next morning, their birthday here: still Sent, not asking again', k && /Today/.test(k.text) && /Sent by WhatsApp/.test(k.send)
    && !/Already their birthday/.test(k.text), JSON.stringify(k));
  await ev(k => { BDAY_SENDS[903] = { ...(BDAY_SENDS[903] || { contact_id: 903, created_by: 'me', send: true }), sent_on: k }; }, key(0));
  await ev(() => renderBrief()); await settle(200);
  const u2 = await row(903);
  ok('  someone in the UK tapped the day before still gets the button on the day', u2 && /Send Happy Birthday/.test(u2.send), JSON.stringify(u2));
  ok('  and someone sent to last year is asked again', await ev(() => !bdaySentNow(CONTACTS.find(c => c.id === 901),
    { sent_on: '2001-01-01' })));
  // The contact page, earlier in the day.
  await ev(ms => window.__fakeAt(ms), at(0, 11, 0));
  await ev(() => { $('brief').classList.add('hidden'); openDetail(901); }); await settle(400);
  ok('Kiri\'s page earlier that day says the button comes at 8pm the evening before', await ev(() =>
    /At 8pm the evening before their birthday \(morning in New Zealand\)/.test($('detail').textContent.replace(/\s+/g, ' '))
    && !$('detail').querySelector('.bsendbtn')));
  await ev(ms => window.__fakeAt(ms), at(0, 20, 5));
  await ev(() => openDetail(902)); await settle(400);
  ok('  Abe\'s page at 8.05pm has the button', await ev(() => !!$('detail').querySelector('.bsendbtn')));
  await ev(() => openDetail(903)); await settle(400);
  ok('  Uma\'s page still says On their birthday', await ev(() => /On their birthday, Today has a button/.test($('detail').textContent.replace(/\s+/g, ' '))));
  await ev(() => window.__realAt());
  let h = await help();
  ok('Help says so', /For someone in New Zealand or Australia, whose day starts many hours before ours, the button comes up at 8pm the evening before/.test(h));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML317 and ML319 Slideshow: both ways, and Date taken');
  await ev(() => { window.__locks = []; Object.defineProperty(screen.orientation, 'lock', { configurable: true,
    value: async o => { window.__locks.push(o); } });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release() {}, addEventListener() {} }) } }); });
  // A JPEG with a camera note: its date taken in the Exif folder, or in the first folder.
  await ev(() => {
    window.__jpeg = async (w, h, colour, date, be, where) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, w, h);
      const j = new Uint8Array(await (await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .8))).arrayBuffer());
      if (!date) return j;
      const le = !be, t = new DataView(new ArrayBuffer(64));
      t.setUint16(0, le ? 0x4949 : 0x4D4D); t.setUint16(2, 42, le); t.setUint32(4, 8, le);
      let pos;
      if (where === 'ifd0') { t.setUint16(8, 1, le); t.setUint16(10, 0x0132, le); t.setUint16(12, 2, le); t.setUint32(14, 20, le);
        t.setUint32(18, 26, le); t.setUint32(22, 0, le); pos = 26; }
      else { t.setUint16(8, 1, le); t.setUint16(10, 0x8769, le); t.setUint16(12, 4, le); t.setUint32(14, 1, le); t.setUint32(18, 26, le);
        t.setUint32(22, 0, le); t.setUint16(26, 1, le); t.setUint16(28, 0x9003, le); t.setUint16(30, 2, le); t.setUint32(32, 20, le);
        t.setUint32(36, 44, le); t.setUint32(40, 0, le); pos = 44; }
      for (let i = 0; i < 19; i++) t.setUint8(pos + i, date.charCodeAt(i));
      const tiff = new Uint8Array(t.buffer), L = 2 + 6 + tiff.length, app1 = new Uint8Array(2 + L);
      app1.set([0xFF, 0xE1, L >> 8, L & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]); app1.set(tiff, 10);
      const out = new Uint8Array(j.length + app1.length);
      out.set(j.subarray(0, 2)); out.set(app1, 2); out.set(j.subarray(2), 2 + app1.length);
      return out;
    };
    window.__files = async () => {
      const R = window.__RealDate, f = async (name, w, h, c, date, be, where, mod) =>
        new File([await window.__jpeg(w, h, c, date, be, where)], name, { type: 'image/jpeg', lastModified: mod || R.UTC(2025, 0, 1) });
      const png = async (name, w, h, c, mod) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').fillStyle = c; cv.getContext('2d').fillRect(0, 0, w, h);
        return new File([await new Promise(ok => cv.toBlob(ok, 'image/png'))], name, { type: 'image/png', lastModified: mod }); };
      return [await f('a.jpg', 300, 200, '#468', '2019:06:14 09:30:00', false, 'exif'),
              await f('b.jpg', 300, 200, '#846', '2015:03:02 12:00:00', true, 'exif'),
              await f('c.jpg', 300, 200, '#684', '2017:08:20 10:00:00', false, 'ifd0'),
              await png('d.png', 300, 200, '#448', new R(2021, 4, 1, 8, 0).getTime()),
              await f('e.jpg', 200, 300, '#844', '2010:01:01 08:00:00', false, 'exif')];
    };
  });
  ok('the camera note is read: little-endian Exif, big-endian Exif, and the first folder\'s date', await ev(async () => {
    const R = window.__RealDate, rd = async (d, be, w) => sldExif((await window.__jpeg(30, 20, '#000', d, be, w)).buffer);
    return await rd('2019:06:14 09:30:00', false, 'exif') === new R(2019, 5, 14, 9, 30).getTime()
      && await rd('2015:03:02 12:00:00', true, 'exif') === new R(2015, 2, 2, 12, 0).getTime()
      && await rd('2017:08:20 10:00:00', false, 'ifd0') === new R(2017, 7, 20, 10, 0).getTime(); }));
  ok('  a JPEG with no note, a blank date, or something not a JPEG gives none', await ev(async () =>
    sldExif((await window.__jpeg(30, 20, '#000')).buffer) === 0 && sldExif(new Uint8Array([1, 2, 3, 4, 5]).buffer) === 0
    && sldExifDate('0000:00:00 00:00:00') === 0 && sldExifDate('rubbish') === 0));
  await ev(() => openSlides()); await settle(300);
  answers.push('Canals');
  await ev(() => sldNew()); await settle(400);
  await ev(async () => { await sldAddFiles(await window.__files()); }); await settle(300);
  const got = await ev(() => Object.fromEntries(sldOf(SLD_CUR).map(p => [p.name, [p.taken, p.takenBy]])));
  const R = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi).getTime();
  ok('five added, each with its date taken', /5 added/.test(await said()) && got['a.jpg'][0] === R(2019, 5, 14, 9, 30)
    && got['b.jpg'][0] === R(2015, 2, 2, 12, 0) && got['c.jpg'][0] === R(2017, 7, 20, 10, 0) && got['e.jpg'][0] === R(2010, 0, 1, 8, 0), JSON.stringify(got));
  ok('  the one with no camera note has the file\'s own date', got['d.png'][0] === R(2021, 4, 1, 8, 0) && got['d.png'][1] === 'file'
    && got['a.jpg'][1] === 'camera', JSON.stringify(got));
  ok('  kept with it on this device', await ev(async () => (await sldTx('photos', 'readonly', s => s.getAll())).every(p => p.taken > 0)));
  // Laid out again on 20 Nov (ML331): the choices at the top of the first page, a tap on a slideshow plays it.
  await ev(() => { $('sldTheme').classList.add('hidden'); lockBackground(); renderSlides(); }); await settle(200);
  let txt = await ev(() => $('sldBody').textContent.replace(/\s+/g, ' '));
  ok('the list: Canals, 5 photos, 1 upright and 4 sideways', /Canals ?5 photos: 1 upright, 4 sideways/.test(txt), txt.slice(0, 200));
  ok('  and In what order: Random, chosen to begin with, or Date taken', await ev(() =>
    document.querySelector('#sldBody [data-sldorder="random"]').getAttribute('aria-pressed') === 'true'
    && document.querySelector('#sldBody [data-sldorder="date"]').getAttribute('aria-pressed') === 'false'));
  await p.click('#sldBody [data-sldorder="date"]'); await settle(200);
  ok('Date taken, chosen: remembered', await ev(() => sldPrefs().order === 'date'
    && document.querySelector('#sldBody [data-sldorder="date"]').getAttribute('aria-pressed') === 'true'));
  ok('  for every slideshow, not on each one\'s own page', await ev(() => { renderSlideTheme();
    return !$('sldThemeBody').querySelector('[data-sldorder], [data-sldsecs], [data-sldplay]'); }));
  await ev(() => sldSavePrefs({ ...sldPrefs(), fill: true }));
  const locks0 = await ev(() => window.__locks.length);
  await p.click('#sldBody [data-sldshape="both"]'); await settle(200);
  await p.click('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(400);
  await ev(() => sldBegin(SLD)); await settle(900);
  let show = await ev(() => SLD && { shape: SLD.shape, order: SLD.list.map(p => p.name).join(), i: SLD.i,
    whole: document.querySelector('.sldimg.on').classList.contains('whole') });
  ok('Play both ways: all five, oldest first', show && show.shape === 'both' && show.order === 'e.jpg,b.jpg,c.jpg,a.jpg,d.png', JSON.stringify(show));
  await ev(() => sldPause());
  ok('  paused, the date it was taken shows along the top', await ev(() => $('sldCount').textContent === 'Paused · 1 of 5'
    && / · 1 Jan 2010$/.test($('sldWhen').textContent)), await ev(() => $('sldCount').textContent + ' / ' + $('sldWhen').textContent));
  await ev(() => sldPause());
  ok('  the screen not turned or held: it turns as the phone does', (await ev(() => window.__locks.length)) === locks0);
  ok('  the upright one on an upright phone fills it', show && !show.whole);
  await ev(() => sldShow(1)); await settle(700);
  show = await ev(() => ({ name: SLD.list[SLD.i].name, whole: document.querySelector('.sldimg.on').classList.contains('whole'),
    fit: getComputedStyle(document.querySelector('.sldimg.on')).objectFit, when: $('sldWhen').textContent }));
  ok('  a sideways one is shown whole, though Fill is on', show.name === 'b.jpg' && show.whole && show.fit === 'contain', JSON.stringify(show));
  ok('  with its date', / · 2 Mar 2015$/.test(show.when), show.when);
  await ev(async () => { await sldShow(1); await sldShow(1); await sldShow(1); }); await settle(500);
  show = await ev(() => ({ name: SLD.list[SLD.i].name, when: $('sldWhen').textContent }));
  ok('  one with only the file\'s date shows no date', show.name === 'd.png' && !/\d{4}$/.test(show.when), JSON.stringify(show));
  await ev(() => sldShow(1)); await settle(600);
  show = await ev(() => ({ name: SLD.list[SLD.i].name, i: SLD.i, order: SLD.list.map(p => p.name).join() }));
  ok('  after the newest it goes back to the oldest, in the same order', show.name === 'e.jpg' && show.i === 0
    && show.order === 'e.jpg,b.jpg,c.jpg,a.jpg,d.png', JSON.stringify(show));
  await ev(() => sldStop());
  await p.click('#sldBody [data-sldshape="side"]'); await settle(200);
  await p.click('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(700);
  show = await ev(() => ({ order: SLD.list.map(p => p.name).join(), locks: window.__locks.slice(-1)[0] }));
  ok('Play sideways by date: the four sideways ones, oldest first, the screen turned', show.order === 'b.jpg,c.jpg,a.jpg,d.png'
    && show.locks === 'landscape', JSON.stringify(show));
  await ev(() => sldStop());
  await p.click('#sldBody [data-sldorder="random"]'); await settle(200);
  await p.click('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(700);
  ok('Random again: the four, and the title says so', await ev(() => SLD.order === 'random' && SLD.list.length === 4
    && /in random order/.test($('sldIdet').textContent)));
  await ev(() => sldStop());

  // Photos added before the app read dates.
  await ev(async () => { for (const p of sldOf(SLD_CUR).filter(p => /^(a\.jpg|d\.png)$/.test(p.name))) {
    delete p.taken; delete p.takenBy; await sldTx('photos', 'readwrite', s => s.put(p)); } });
  await p.click('#sldBody [data-sldorder="date"]'); await settle(200);
  await p.click('#sldBody [data-sldopen]'); await settle(300);
  txt = await ev(() => $('sldThemeBody').textContent.replace(/\s+/g, ' '));
  ok('two from before: Date taken says so, and how to fill them in', /2 of these have no date taken yet, as they were added before the app read dates\. Pick them again with Add photos/.test(txt), txt.slice(0, 400));
  ok('  until then they play last, in the order they were added', await ev(() =>
    sldByDate(sldOf(SLD_CUR)).map(p => p.name).join() === 'e.jpg,b.jpg,c.jpg,a.jpg,d.png'
    && sldByDate([{ name: 'x', added: 2 }, { name: 'y', taken: 5, added: 9 }, { name: 'z', added: 1 }]).map(p => p.name).join() === 'y,z,x'));
  await clearSaid();
  await ev(async () => { await sldAddFiles((await window.__files()).filter(f => /^(a\.jpg|d\.png|b\.jpg)$/.test(f.name))); }); await settle(300);
  ok('picking them again: nothing added twice, their dates found', /0 added, 3 already in it, dates found for 2/.test(await said()), await said());
  ok('  and kept', await ev(async () => (await sldTx('photos', 'readonly', s => s.getAll())).every(p => p.taken > 0)
    && sldOf(SLD_CUR).find(p => p.name === 'a.jpg').takenBy === 'camera'));
  ok('  the note has gone', await ev(() => !document.querySelector('#sldThemeBody .sldundated')));
  for (const w of [320, 390]) {
    await p.setViewportSize({ width: w, height: 760 }); await settle(200);
    await ev(() => { renderSlides(); renderSlideTheme(); }); await settle(100);
    ok(`which way, the order and the Photos button fit at ${w} wide`, await ev(() => [...document.querySelectorAll('#sldBody [data-sldshape], #sldBody [data-sldorder], #sldBody .sldph')]
      .every(e => e.getBoundingClientRect().right <= innerWidth && e.getBoundingClientRect().left >= 0)
      && $('sldThemeBody').scrollWidth <= $('sldThemeBody').clientWidth + 1 && $('sldBody').scrollWidth <= $('sldBody').clientWidth + 1));
  }
  await p.setViewportSize({ width: 390, height: 844 });

  // Bluesky
  ok('a Bluesky photo has the date it was posted', await ev(() => { const l = sldBskyPics([{ post: { uri: 'u', record: { createdAt: '2024-05-01T09:00:00Z' },
    embed: { images: [{ fullsize: 'https://cdn.example/a.png' }] } } }]); return l[0].taken === Date.parse('2024-05-01T09:00:00Z') && l[0].takenBy === 'camera'; }));
  ok('Your Bluesky photos first in the list, and the menu plays it', await ev(() => { renderSlides();
    const rows = [...document.querySelectorAll('#sldBody .sldrow')];
    return !!rows[0].querySelector('[data-sldgo="bsky"]') && areaItems('sld').some(x => x.label === 'Play your Bluesky photos'); }));
  h = await help();
  ok('Help knows about both ways and Date taken', /Both plays them all, which suits a laptop/.test(h) && /In what order: at random, or by Date taken/.test(h)
    && /pick them again with Add photos and their dates are filled in/.test(h));
  await ev(() => sldSavePrefs({ secs: 8, fill: false, order: 'random', shape: 'up' }));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML320 Contacts sent to you');
  const tile = () => ev(() => { const i = TILES.findIndex(t => t.dest === 'contacts'); const b = document.querySelector(`[data-tile="${i}"]`);
    return b ? { i, pip: (b.querySelector('.pip') || {}).textContent || '' } : null; });
  await ev(() => showHome()); await settle(200);
  ok('nothing waiting: no red number on the Contacts tile', (await tile()).pip === '');
  await p.click(`[data-tile="${(await tile()).i}"]`); await settle(300);
  ok('  and tapping it just opens Contacts', !(await ev(() => !!document.querySelector('.offask'))) && !(await open('home')));
  await ev(async () => {
    window.__rows.contact_offers.push(
      { id: 71, from_user: 'sandra', to_user: 'me', name: 'Pat Pretend', payload: { first_name: 'Pat', last_name: 'Pretend' },
        source_id: 5, created_at: '2026-11-19T10:00:00Z', decided_at: null, outcome: null },
      { id: 72, from_user: 'sandra', to_user: 'me', name: 'Lou Lookalike', payload: { first_name: 'Lou', last_name: 'Lookalike' },
        source_id: 6, created_at: '2026-11-20T10:00:00Z', decided_at: null, outcome: null });
    await loadAll(); showHome(); });
  await settle(300);
  ok('two sent by Sandra: the Contacts tile has a red 2', (await tile()).pip === '2', JSON.stringify(await tile()));
  await p.click(`[data-tile="${(await tile()).i}"]`); await settle(300);
  let box = await ev(() => { const b = document.querySelector('.offask'); return b && b.textContent.replace(/\s+/g, ' ').trim(); });
  ok('tapping it asks: Sandra has sent you 2 contacts, with their names', box && /Sandra has sent you 2 contacts/.test(box)
    && /Pat Pretend/.test(box) && /Lou Lookalike/.test(box) && /Look at them now/.test(box), box);
  ok('  the box fits on a phone', await ev(() => { const r = document.querySelector('.offask .inner').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
  await p.click('#offAskLater'); await settle(300);
  ok('Later: the box goes, and Contacts is there as usual', !(await ev(() => !!document.querySelector('.offask'))) && !(await open('home')) && !(await open('offers')));
  await ev(() => showHome()); await settle(200);
  await p.click(`[data-tile="${(await tile()).i}"]`); await settle(300);
  await p.click('#offAskGo'); await settle(400);
  ok('Look now: Sent to you opens, with both waiting', await open('offers') && await ev(() =>
    /Pat Pretend/.test($('offBody').textContent) && /Lou Lookalike/.test($('offBody').textContent)));
  await closeAll();
  await ev(() => { showSheet('brief'); renderBrief(); lockBackground(); }); await settle(300);
  txt = await ev(() => $('briefBody').textContent.replace(/\s+/g, ' '));
  ok('Today lists them under Contacts sent to you, newest first, saying who from', /Contacts sent to you Lou Lookalike/.test(txt.replace(/\d+ Nov /g, ''))
    && /Lou Lookalike Sent to you by Sandra/.test(txt) && /Pat Pretend Sent to you by Sandra/.test(txt)
    && txt.indexOf('Lou Lookalike') < txt.indexOf('Pat Pretend'), txt.slice(0, 600));
  await p.click('[data-briefo="71"]'); await settle(400);
  ok('  tapping one opens Sent to you over Today', await open('offers') && await open('brief'));
  await ev(() => { window.__rows.contact_offers.forEach(o => { o.decided_at = '2026-11-20T11:00:00Z'; o.outcome = 'declined'; });
    OFFERS.forEach(o => { o.decided_at = '2026-11-20T11:00:00Z'; o.outcome = 'declined'; }); });
  await p.click('#offBack'); await settle(300);
  ok('  once dealt with, coming back to Today: they are off it', await open('brief')
    && !(await ev(() => /Contacts sent to you/.test($('briefBody').textContent))));
  ok('  and the red number has gone from the tile', await ev(() => tilePip('contacts') === 0));
  h = await help();
  ok('Help says so', /the Contacts tile has a red number too, and tapping it asks whether to look at them now/.test(h)
    && /Today lists them under Contacts sent to you/.test(h));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML321 Multi Select');
  ok('the tile is called Multi Select now', await ev(() => TILE_DEST.pick.label === 'Multi Select'));
  ok('  one called Tidy up, or Multi Delete as Barry named his, takes the new name; one of your own naming stays', await ev(() => {
    const was = MY_PROFILE, keep = TILES;
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'pick', label: 'Multi Delete' }, { dest: 'contacts', label: 'People' }], hidden: [] } };
    loadTiles(); const a = TILES.find(t => t.dest === 'pick').label, c = TILES.find(t => t.dest === 'contacts').label;
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'pick', label: 'Tidy up' }], hidden: [] } };
    loadTiles(); const b = TILES.find(t => t.dest === 'pick').label;
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'pick', label: 'Bin some' }], hidden: [] } };
    loadTiles(); const d = TILES.find(t => t.dest === 'pick').label;
    MY_PROFILE = was; TILES = keep; return a === 'Multi Select' && b === 'Multi Select' && c === 'People' && d === 'Bin some'; }));
  await ev(() => hideHome()); await settle(200);
  ok('a tick-box button at the top of Contacts, just left of refresh', await ev(() => { const b = $('pickBtn');
    return !!b && b.nextElementSibling && b.nextElementSibling.hasAttribute('data-barref') && !!b.closest('header.plate')
      && b.getAttribute('aria-pressed') === 'false' && !!b.querySelector('rect'); }));
  await p.click('#pickBtn'); await settle(300);
  ok('  pressing it starts Multi Select: the bar with Send and Delete, the button shown pressed', await ev(() => PICKING
    && !$('pickBar').classList.contains('hidden') && /Send/.test($('pickBar').textContent) && /Delete/.test($('pickBar').textContent)
    && $('pickBtn').getAttribute('aria-pressed') === 'true'));
  await p.click('#pickBtn'); await settle(300);
  ok('  pressing it again stops', await ev(() => !PICKING && $('pickBar').classList.contains('hidden') && $('pickBtn').getAttribute('aria-pressed') === 'false'));
  for (const w of [320, 360, 412]) {
    await p.setViewportSize({ width: w, height: 760 }); await settle(200);
    ok(`  the top of Contacts still fits at ${w} wide, the title showing`, await ev(() => { const h = document.querySelector('header.plate');
      const bs = [...h.querySelectorAll('button')]; const t = h.querySelector('.title');
      return bs.every(x => x.getBoundingClientRect().right <= innerWidth + 0.5 && x.getBoundingClientRect().width >= 34)
        && t.getBoundingClientRect().width > 60; }));
  }
  await p.setViewportSize({ width: 390, height: 844 });
  ok('the menu says Multi Select too', await ev(() => areaItems('contacts').some(x => /^Multi Select/.test(x.label))
    && !areaItems('contacts').some(x => /Delete several/.test(x.label))));
  h = await help();
  ok('Help says how', /Sending or deleting several at once ?Press the tick-box button at the top of Contacts, beside the refresh button \(or the Multi Select tile, or Menu › Multi Select\)/.test(h)
    && !/Delete several contacts/.test(h), h.slice(h.indexOf('Sending or deleting'), h.indexOf('Sending or deleting') + 200));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nML322 The phone\'s Back arrow');
  const url0 = p.url();
  const back = async () => { await ev(() => history.back()); await settle(450); };
  // A screen is opened by a tap, and Chrome only honours steps added after one (ML326).
  const touch = async () => { await p.keyboard.press('Shift'); await settle(650); };
  const still = async () => p.url() === url0 && await ev(() => typeof ME !== 'undefined' && !!ME);
  await touch();
  ok('a spare step is ready to go back to', await ev(() => history.state && history.state.myl === 'back' && history.state.n >= 2));
  await ev(() => { showHome(); openDiary(); }); await touch();
  await back();
  ok('Calendar, then Back: the home screen, and still in the app', !(await open('diary')) && await open('home') && await still());
  await back();
  ok('Back on the home screen: it stays put', await open('home') && await still());
  await back();
  ok('  and again: still there', await open('home') && await still());
  await ev(() => hideHome()); await touch();
  await back();
  ok('Contacts, then Back: the home screen', await open('home') && await still());
  await ev(() => { hideHome(); openDetail(1); }); await touch();
  await back();
  ok('a contact\'s page, then Back: back to Contacts', !(await open('detail')) && !(await open('home')) && await still());
  await ev(() => openEditor(CONTACTS.find(c => c.id === 1))); await touch();
  answer = false; asked.length = 0;
  await back();
  ok('editing, then Back: it asks before leaving, and No stays', asked.some(m => /Leave this without saving\?/.test(m)) && await open('editor') && await still(), asked.join(' | '));
  answer = true; asked.length = 0;
  await back();
  ok('  Yes leaves it unsaved', !(await open('editor')) && await still());
  await ev(() => startPicking()); await touch();
  await back();
  ok('Multi Select on, then Back: it stops', await ev(() => !PICKING) && await still());
  await ev(() => { window.__rows.contact_offers.push({ id: 73, from_user: 'sandra', to_user: 'me', name: 'Rob Ruse', payload: { first_name: 'Rob' },
    source_id: 7, created_at: '2026-11-20T12:00:00Z', decided_at: null, outcome: null }); });
  await ev(async () => { await loadAll(); offersAsk(); }); await touch();
  await back();
  ok('a box on top, then Back: just the box goes', !(await ev(() => !!document.querySelector('.offask'))) && await still());
  await ev(async () => { await openSettings(); }); await settle(300);
  await ev(() => openHelp('sld')); await touch();
  await back();
  ok('Help over Settings, then Back: Settings', !(await open('help')) && await open('settings') && await still());
  await back();
  ok('  and Back again straight away: out of Settings', !(await open('settings')) && await still());
  await ev(() => openSlides()); await settle(300);
  await p.click('#sldBody [data-sldgo]:not([data-sldgo="bsky"])'); await settle(800);
  await back();
  ok('a slideshow playing, then Back: it stops, the list of slideshows still there', await ev(() => !SLD && !$('sldPlay')) && await open('sld') && await still());
  await p.click('#sldBody [data-sldopen]'); await settle(300);
  await back();
  ok('  a slideshow\'s photos, then Back: the list', !(await open('sldTheme')) && await open('sld') && await still());
  await back();
  ok('  Back: home', !(await open('sld')) && await open('home') && await still());
  // Loxx
  await p.addScriptTag({ path: path.join(__dirname, 'lkfake.js') });
  await ev(async () => { window.__lkFake(); window.__rpc('new_game', { players: ['me', 'sandra'], first_seat: 0 }); await lkReload(); });
  const G = await ev(() => Math.max(...GAMES.map(g => g.id)));
  await ev(async id => { await openGames(); await lkOpen(id); }, G); await touch();
  await back();
  ok('a game of Loxx, then Back: MY Games, the game still there to go back to', !(await open('lkPlay')) && await open('games')
    && await ev(id => GAMES.some(g => g.id === id && g.status === 'playing'), G) && await still());
  await back(); await back(); await back();
  ok('Back several times over: the home screen, and the app still open', await open('home') && await still());

  // ---------------------------------------------------------------
  console.log('\nML323 Loxx: the words on the line of players');
  const LONG = 'Sandra is rolling.</b> White dice 12: yours too. Then Done. The yellow lock closes after this roll: you can still mark yellow now.';
  await ev(async () => { window.__rpc('new_loxx', { players: ['me', 'sandra'], first_seat: 1, real_dice: false }); await lkReload(); });
  const G2 = await ev(() => Math.max(...GAMES.map(g => g.id)));
  for (const [w, h] of [[360, 760], [412, 860], [844, 390]]) {
    await p.setViewportSize({ width: w, height: h }); await settle(200);
    await ev(async id => { await openGames(); await lkOpen(id); }, G2); await settle(400);
    await ev(async G => { const g = lkGame(G); if (!g.dice || !g.dice.v) { window.__who = 'sandra';
      window.__rpc('loxx_dice', { g: G, at_turn: g.turn_no, d: { v: [6, 6, 2, 5, 4, 4] } }); window.__who = null; }
      await lkReload(G); lkPaint(); }, G2); await settle(300);
    const short = await ev(() => ({ rows: document.querySelector('.lkrows').offsetHeight, who: document.querySelector('.lkwho').offsetHeight,
      inWho: !!$('lkStatus').closest('.lkwho'), inBar: !!document.querySelector('.lkbar .lkstatus') }));
    await ev(L => { $('lkStatus').innerHTML = '<b>' + L; }, LONG); await settle(100);
    const long = await ev(() => { const st = $('lkStatus'), lh = parseFloat(getComputedStyle(st).lineHeight);
      return { rows: document.querySelector('.lkrows').offsetHeight, lines: Math.round(st.offsetHeight / lh),
        fits: st.scrollWidth <= st.clientWidth + 2, undo: $('lkUndo').offsetHeight >= 40 && $('lkUndo').offsetWidth > 40,
        done: $('lkDone').offsetHeight >= 40, stop: $('lkStop').offsetWidth > 30 }; });
    ok(`${w}×${h}: the words are on the line of players, not in the bar`, short.inWho && !short.inBar, JSON.stringify(short));
    ok(`  a long message takes two lines at most, all showing`, long.lines <= 2 && long.fits, JSON.stringify(long));
    ok(`  the board hardly moves (${short.rows - long.rows}px)`, short.rows - long.rows <= 26, JSON.stringify({ short, long }));
    ok(`  Undo, Done and Stop game still full size`, long.undo && long.done && long.stop, JSON.stringify(long));
    await ev(() => lkBackToList()); await settle(200);
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await ev(id => { const s = window.__rows.game_players.find(x => x.game_id === id && x.user_id === 'sandra'); s.done_turn = 99; }, G2);
  await ev(async id => { await lkOpen(id); await lkReload(id); lkPaint(); }, G2); await settle(400);
  ok('Sandra waiting for you: the words turn gold where they now are, and Done still pulses', await ev(() =>
    getComputedStyle($('lkStatus')).backgroundColor === 'rgb(255, 231, 160)' && !!document.querySelector('.lkbar.lkwait #lkDone')
    && !!document.querySelector('.lkwho.lkwait')), await ev(() => $('lkStatus').textContent));

  // ---------------------------------------------------------------
  console.log('\nThe version');
  ok('2026.11.20.1 or later', await ev(() => APP_VERSION >= '2026.11.20.1'));

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
