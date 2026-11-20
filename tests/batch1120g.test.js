// 20 Nov 2026 (version 2026.11.20.7), Barry's choices that evening:
//   ML318  Share a slideshow: through the app, with a tick for Everyone or
//          for each person, and ticks for who can change it. Every slideshow
//          on all your own phones and computers by itself. Only the names
//          and the list of photos go online (step 67), never the photos:
//          another phone picks out its own copies with Find the photos,
//          by name and size, then the time taken, then the name.
//   ML350  Made with It's MY life at the top of the opening page.
// Pretend people and photos only; nothing goes online. The pretend database
// here keeps what the app writes to the two new tables, as the real one does.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|open-meteo|PGRST202|PGRST205|does not exist|schema cache|bank-holidays/i;
const SHOTS = process.env.SHOTS;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  const asked = [], answers = [];
  p.on('dialog', d => { asked.push(d.message()); return d.type() === 'prompt' ? d.accept(answers.shift() || '') : d.accept(); });
  p.on('popup', pop => pop.close().catch(() => {}));
  await p.route(/gov\.uk|bsky\.app|bsky\.social/, r => r.abort());

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  await ev(() => { WX_OFF = true; BSKY_OFF = true; window.__said = []; const t = toast; toast = s => { window.__said.push(s); t(s); };
    Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async () => {} });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release() {}, addEventListener() {} }) } }); });
  const said = () => ev(() => window.__said.join(' | '));
  const clearSaid = () => ev(() => { window.__said.length = 0; });
  const lastAsked = () => asked[asked.length - 1] || '';

  // The pretend database: the two new tables keep what is written to them.
  // A write's filters are added just after it is noted, so it is applied a
  // moment later.
  await ev(() => {
    window.__rows.slideshows = []; window.__rows.slideshow_photos = [];
    const push = window.__writes.push.bind(window.__writes);
    const fits = (r, where) => where.every(([op, col, val]) => op === 'eq' ? String(r[col]) === String(val)
      : op === 'in' ? (val || []).map(String).includes(String(r[col])) : true);
    window.__writes.push = w => {
      const T = w.table;
      if (T === 'slideshows' || T === 'slideshow_photos') queueMicrotask(() => {
        const rows = window.__rows[T];
        if (w.op === 'insert' || w.op === 'upsert') [].concat(w.rows).forEach(r => { if (!rows.some(x => x.id === r.id))
          rows.push(T === 'slideshows' ? { shared_with: [], share_all: false, editors: [], edit_all: false, made_at: new Date().toISOString(), ...r }
            : { added_at: new Date().toISOString(), ...r }); });
        if (w.op === 'update') rows.filter(r => fits(r, w.where)).forEach(r => Object.assign(r, JSON.parse(JSON.stringify(w.patch))));
        if (w.op === 'delete') { const gone = rows.filter(r => fits(r, w.where)).map(r => r.id);
          window.__rows[T] = rows.filter(r => !gone.includes(r.id));
          if (T === 'slideshows') window.__rows.slideshow_photos = window.__rows.slideshow_photos.filter(r => !gone.includes(r.slideshow_id)); }
      });
      return push(w);
    };
    // Step 67 not run yet, or no signal: the two tables answer with an error.
    const real = sb.from;
    sb.from = t => { if (!window.__fail || !/^slideshow/.test(t)) return real(t);
      const api = {}, e = window.__fail;
      ['select', 'order', 'range', 'eq', 'in', 'insert', 'upsert', 'update', 'delete'].forEach(m => api[m] = () => api);
      api.then = (f, r) => Promise.resolve({ data: null, error: e }).then(f, r); return api; };
  });
  const noTable = { code: 'PGRST205', message: "Could not find the table 'public.slideshows' in the schema cache" };
  const noSignal = { message: 'TypeError: Failed to fetch' };
  const db = () => ev(() => ({ shows: JSON.parse(JSON.stringify(window.__rows.slideshows)), photos: JSON.parse(JSON.stringify(window.__rows.slideshow_photos)) }));
  const open = async () => { await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); return openSlides(); }); await settle(300); };
  const page = async id => { await ev(i => openSlideTheme(i), id); await settle(250); };
  const text = sel => ev(s => (document.querySelector(s) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(), sel);
  // Another phone: the same person, nothing kept on it yet.
  const otherPhone = () => ev(async () => { await sldTx(['themes', 'photos'], 'readwrite', (a, b) => { a.clear(); b.clear(); });
    SLD_THEMES = []; SLD_PHOTOS = []; SLD_SHOWS = new Map(); SLD_ROWS = new Map(); SLD_NET = ''; });

  // Pretend photos: JPEGs with the time taken in their camera note, and a PNG without.
  await ev(() => {
    window.__jpeg = async (w, h, colour, date) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, w, h);
      const j = new Uint8Array(await (await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .8))).arrayBuffer());
      if (!date) return j;
      const le = true, t = new DataView(new ArrayBuffer(64));
      t.setUint16(0, 0x4949); t.setUint16(2, 42, le); t.setUint32(4, 8, le);
      t.setUint16(8, 1, le); t.setUint16(10, 0x8769, le); t.setUint16(12, 4, le); t.setUint32(14, 1, le); t.setUint32(18, 26, le);
      t.setUint32(22, 0, le); t.setUint16(26, 1, le); t.setUint16(28, 0x9003, le); t.setUint16(30, 2, le); t.setUint32(32, 20, le);
      t.setUint32(36, 44, le); t.setUint32(40, 0, le);
      for (let i = 0; i < 19; i++) t.setUint8(44 + i, date.charCodeAt(i));
      const tiff = new Uint8Array(t.buffer), L = 2 + 6 + tiff.length, app1 = new Uint8Array(2 + L);
      app1.set([0xFF, 0xE1, L >> 8, L & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]); app1.set(tiff, 10);
      const out = new Uint8Array(j.length + app1.length);
      out.set(j.subarray(0, 2)); out.set(app1, 2); out.set(j.subarray(2), 2 + app1.length);
      return out;
    };
    window.__png = async (name, w, h, c, mod) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').fillStyle = c; cv.getContext('2d').fillRect(0, 0, w, h);
      return new File([await new Promise(ok => cv.toBlob(ok, 'image/png'))], name, { type: 'image/png', lastModified: mod }); };
    window.__jf = async (name, w, h, c, date) => new File([await window.__jpeg(w, h, c, date)], name, { type: 'image/jpeg', lastModified: Date.UTC(2025, 0, 1) });
  });
  await ev(async () => { window.__orig = [await window.__jf('a.jpg', 300, 200, '#468', '2019:06:14 09:30:00'),
    await window.__jf('b.jpg', 200, 300, '#846', '2015:03:02 12:00:00'),
    await window.__png('c.png', 300, 200, '#684', Date.UTC(2021, 4, 1))]; });

  // ---------------------------------------------------------------
  console.log('\nBefore step 67: as it was, on this phone only');
  await ev(e => { window.__fail = e; }, noTable);
  await open();
  answers.push('Canals');
  await ev(() => sldNew()); await settle(400);
  await ev(async () => { await sldAddFiles(window.__orig); }); await settle(300);
  ok('a slideshow made and three photos added, with nothing online', /3 added/.test(await said())
    && (await db()).shows.length === 0 && await ev(() => SLD_NET) === 'none');
  ok('  no Share with, and Delete says from this phone', await ev(() => !$('sldAll') && $('sldDrop').textContent === 'Delete this slideshow'));
  ok('  the list says nothing about other phones', !/every phone and computer/.test(await text('#sldBody .sldnote')));
  const canals = await ev(() => SLD_CUR);

  console.log('\nStep 67 run: it goes online, the photos stay here');
  await ev(() => { window.__fail = null; });
  await open();
  let d = await db();
  ok('the slideshow\'s name goes online, as yours', d.shows.length === 1 && d.shows[0].id === canals && d.shows[0].name === 'Canals'
    && d.shows[0].created_by === 'me', JSON.stringify(d.shows));
  const ph = Object.fromEntries(d.photos.map(r => [r.name, r]));
  const R = (y, mo, dd, h, mi) => new Date(y, mo, dd, h, mi).getTime();
  ok('  and its list of photos: name, size, time taken, shape, nothing else', d.photos.length === 3
    && ph['a.jpg'].taken === R(2019, 5, 14, 9, 30) && ph['a.jpg'].taken_by === 'camera' && ph['a.jpg'].w === 300 && ph['a.jpg'].h === 200
    && ph['b.jpg'].w === 200 && ph['c.png'].taken_by === 'file' && ph['a.jpg'].size > 0 && ph['a.jpg'].added_by === 'me'
    && d.photos.every(r => r.slideshow_id === canals && !('img' in r) && !('thumb' in r)), JSON.stringify(d.photos));
  ok('  marked as online here', await ev(id => SLD_THEMES.find(t => t.id === id).synced && sldOf(id).every(p => p.synced), canals));
  ok('  the list says so', /Your slideshows are on every phone and computer you sign in on: only their names and lists of photos go online/
    .test(await text('#sldBody .sldnote')));
  await open();
  ok('opened again: nothing sent twice', (await db()).photos.length === 3 && (await db()).shows.length === 1);

  console.log('\nA new one goes online at once');
  answers.push('Scenic');
  await ev(() => sldNew()); await settle(400);
  const scenic = await ev(() => SLD_CUR);
  ok('Scenic goes online as soon as it is made', (await db()).shows.some(r => r.id === scenic && r.name === 'Scenic'));
  await ev(async () => { await sldAddFiles([await window.__jf('s1.jpg', 300, 200, '#555', '2020:01:01 10:00:00')]); }); await settle(300);
  ok('  and a photo added to it, at once', (await db()).photos.some(r => r.slideshow_id === scenic && r.name === 's1.jpg'));

  // ---------------------------------------------------------------
  console.log('\nShare with, and who can change it');
  await page(canals);
  ok('your own: Share with, Everyone and each person, none ticked', await ev(() => !!$('sldAll') && !$('sldAll').checked
    && [...document.querySelectorAll('[data-sldwho]')].map(x => x.dataset.sldwho + ':' + x.checked).join() === 'sandra:false,other:false'));
  ok('  shared with nobody yet: only you see it', /Only you see it, on each phone or computer you sign in on/.test(await text('#sldThemeBody .sldshare'))
    && await ev(() => !$('sldCan')));
  await ev(() => $('sldThemeBody').scrollTop = 99999); await shot('g-share-none');
  await p.check('[data-sldwho="sandra"]'); await settle(300);
  ok('ticking Sandra shares it with her', (await db()).shows[0].shared_with.join() === 'sandra' && /Saved/.test(await said()));
  ok('  and Who can change it comes up, with her in it, not ticked', await ev(() => !!$('sldCan')
    && [...document.querySelectorAll('[data-sldedit]')].map(x => x.dataset.sldedit + ':' + x.checked).join() === 'sandra:false'));
  await p.check('[data-sldedit="sandra"]'); await settle(300);
  ok('ticking her there lets her change it', (await db()).shows[0].editors.join() === 'sandra');
  await p.check('#sldAll'); await settle(300);
  d = await db();
  ok('Everyone: shared with everyone, the people ticked and greyed', d.shows[0].share_all === true
    && await ev(() => [...document.querySelectorAll('[data-sldwho]')].every(x => x.checked && x.disabled)));
  ok('  Who can change it now lists everyone', await ev(() => [...document.querySelectorAll('[data-sldedit]')].map(x => x.dataset.sldedit + ':' + x.checked).join())
    === 'sandra:true,other:false');
  await p.check('#sldEditAll'); await settle(300);
  ok('Everyone it\'s shared with can change it', (await db()).shows[0].edit_all === true
    && await ev(() => [...document.querySelectorAll('[data-sldedit]')].every(x => x.checked && x.disabled)));
  await ev(() => $('sldThemeBody').scrollTop = 99999); await shot('g-share-all');
  await p.uncheck('#sldEditAll'); await p.waitForTimeout(250); await p.uncheck('#sldAll'); await settle(300);
  d = await db();
  ok('unticked again: back to Sandra alone, who can still change it', !d.shows[0].share_all && !d.shows[0].edit_all
    && d.shows[0].shared_with.join() === 'sandra' && d.shows[0].editors.join() === 'sandra');
  await p.uncheck('[data-sldwho="sandra"]'); await settle(300);
  d = await db();
  ok('unticking Sandra stops sharing it with her, and her say in it', d.shows[0].shared_with.length === 0 && d.shows[0].editors.length === 0);
  await p.check('[data-sldwho="sandra"]'); await settle(300);
  ok('Help says how', await ev(() => { openHelp('sld'); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    $('help').classList.add('hidden'); lockBackground();
    return /Sharing a slideshow: on its page, under Share with, tick Everyone \(anyone who joins later too\) or the people you want/.test(t)
      && /Find the photos on the slideshow’s page/.test(t) && /Made with It’s MY life at the top/.test(t)
      && /kept on each phone or computer, not online/.test(t); }));

  // ---------------------------------------------------------------
  console.log('\nYour other phone');
  await otherPhone();
  await open();
  ok('Canals and Scenic come up on it by themselves', await ev(() => SLD_THEMES.map(t => t.name).join()) === 'Canals,Scenic');
  ok('  Canals: 3 photos, none on this phone yet', /Canals3 photos, none on this phone yet/.test(await text('#sldBody .sldmain')));
  await ev(id => sldPlay(id), canals); await settle(300);
  ok('  playing it says to find the photos first', /None of the photos in Canals are on this phone yet\. Tap Photos beside it, then Find the photos/.test(await said())
    && await ev(() => !SLD));
  await page(canals);
  ok('its page: 3 not on this phone yet, with Find the photos', /3 of its photos are not on this phone yet\. Copy them here first, by Google Drive or a memory stick \(not WhatsApp/
    .test(await text('#sldThemeBody .sldmiss')) && await ev(() => !!$('sldFind')));
  await shot('g-missing');
  await clearSaid();
  // The copies: one renamed by the phone (matched by the time taken), one
  // the same, one saved again under a different case (matched by name), and
  // one that is not in it.
  const before = await ev(() => window.__writes.length);
  await ev(async () => { const o = window.__orig;
    await sldFindFiles([new File([o[0]], '1000001234.jpg', { type: 'image/jpeg' }), o[1],
      await window.__png('C.PNG', 300, 200, '#684', Date.UTC(2021, 4, 1)),
      await window.__jf('x.jpg', 300, 200, '#111', '2001:01:01 01:01:01')]); }); await settle(300);
  ok('Find the photos: all three found, one not in it', /3 found, 1 not in this slideshow; all of them here now/.test(await said()), await said());
  const here = await ev(id => sldOf(id).map(p => p.id).sort().join(), canals);
  ok('  each kept as the same photo as in the list', here === (await db()).photos.filter(r => r.slideshow_id === canals).map(r => r.id).sort().join());
  ok('  with its time taken', await ev(id => sldOf(id).find(p => p.name === '1000001234.jpg').taken, canals) === R(2019, 5, 14, 9, 30));
  ok('  and nothing new sent online', await ev(n => !window.__writes.slice(n).some(w => /^slideshow/.test(w.table || '')), before));
  ok('  the page now plays: no more to find', await ev(() => !$('sldFind') && document.querySelectorAll('#sldThemeBody .sldth').length === 3));

  console.log('\nChanges made on the first phone');
  await ev(id => { const ps = window.__rows.slideshow_photos; const i = ps.findIndex(r => r.slideshow_id === id && r.name === 'b.jpg');
    ps.splice(i, 1); window.__rows.slideshows.find(r => r.id === id).name = 'Canals and locks'; }, canals);
  await open();
  ok('a photo taken out there goes from here too', await ev(id => sldOf(id).length, canals) === 2);
  ok('  and the new name comes across', await ev(id => SLD_THEMES.find(t => t.id === id).name, canals) === 'Canals and locks');
  await ev(id => { window.__rows.slideshow_photos.push({ id: 'pnewphoto1', slideshow_id: id, name: 'd.jpg', size: 1, taken: null, taken_by: '',
    w: 300, h: 200, added_by: 'me', added_at: new Date().toISOString() }); }, canals);
  await open();
  const listed = await text('#sldBody .sldmain');
  ok('one added there shows as 1 more not on this phone yet', /Canals and locks\s*2 photos: 0 upright, 2 sideways\s*1 more not on this phone yet/.test(listed), listed);
  await clearSaid();
  await page(canals);
  await ev(async () => { await sldAddFiles([await window.__jf('d.jpg', 300, 200, '#777')]); }); await settle(300);
  ok('Add photos fills in a missing one rather than adding it twice', /0 added, 1 of the missing ones found/.test(await said())
    && (await db()).photos.filter(r => r.slideshow_id === canals).length === 3 && await ev(id => sldOf(id).some(p => p.id === 'pnewphoto1'), canals), await said());

  console.log('\nTaking out, renaming and deleting, online');
  await clearSaid();
  const pid = await ev(id => sldOf(id).find(p => p.name === 'd.jpg').id, canals);
  await ev(id => sldDropPhoto(id), pid); await settle(300);
  ok('taking a photo out asks, saying it goes everywhere', /Take this photo out of Canals and locks\? It goes from it on every phone and computer, and for everyone it is shared with\. The original stays where it is\./.test(lastAsked()), lastAsked());
  ok('  and takes it out of the list online too', !(await db()).photos.some(r => r.id === pid) && await ev(i => !SLD_PHOTOS.some(p => p.id === i), pid));
  answers.push('Canals');
  await ev(() => sldRename()); await settle(300);
  ok('renaming changes it online', (await db()).shows.find(r => r.id === canals).name === 'Canals');
  await page(scenic);
  await ev(() => sldDropTheme()); await settle(400);
  ok('deleting asks, saying it goes from every phone and computer', /^Delete Scenic\? It goes from every phone and computer you use\. The originals stay where they are\.$/.test(lastAsked()), lastAsked());
  ok('  and it goes online, with its list of photos', !(await db()).shows.some(r => r.id === scenic) && !(await db()).photos.some(r => r.slideshow_id === scenic)
    && await ev(i => !SLD_THEMES.some(t => t.id === i), scenic));

  console.log('\nWith no signal');
  await ev(e => { window.__fail = e; }, noSignal);
  await open();
  ok('it still opens, with what is on this phone', await ev(() => SLD_NET) === 'off' && /Canals/.test(await text('#sldBody .sldmain')));
  await clearSaid();
  const pid2 = await ev(id => sldOf(id)[0].id, canals);
  await ev(id => sldDropPhoto(id), pid2); await settle(200);
  ok('  taking a photo out waits for a signal, and nothing goes', /Taking it out needs a signal/.test(await said()) && await ev(i => SLD_PHOTOS.some(p => p.id === i), pid2));
  await ev(() => { window.__fail = null; });
  await ev(() => { window.__rows.slideshows.length = 0; });
  const kept = await ev(() => SLD_THEMES.length);
  await open();
  ok('nothing at all coming back is not taken to mean everything was deleted', await ev(() => SLD_THEMES.length) === kept && kept > 0);
  await ev(r => { window.__rows.slideshows.push(r); }, d.shows[0]);
  await open();

  // ---------------------------------------------------------------
  console.log('\nOne shared with you');
  await ev(() => {
    window.__rows.slideshows.push({ id: 'tsandrashow1', created_by: 'sandra', name: 'Family', shared_with: ['me'], share_all: false,
      editors: [], edit_all: false, made_at: '2026-11-01T10:00:00Z' });
    window.__rows.slideshow_photos.push(
      { id: 'pfam00000001', slideshow_id: 'tsandrashow1', name: 'f1.jpg', size: 10, taken: null, taken_by: '', w: 300, h: 200, added_by: 'sandra', added_at: '2026-11-01T10:00:00Z' },
      { id: 'pfam00000002', slideshow_id: 'tsandrashow1', name: 'f2.jpg', size: 10, taken: null, taken_by: '', w: 200, h: 300, added_by: 'sandra', added_at: '2026-11-01T10:00:00Z' });
  });
  await open();
  const sm = await text('#sldBody .sldmain');
  ok('it comes up under Shared with you, from Sandra', /Shared with you[^A-Za-z]*Family\s*From Sandra\s*2 photos, none on this phone yet/.test(sm), sm);
  await ev(() => $('sldBody').scrollTop = 0); await shot('g-list');
  await page('tsandrashow1');
  ok('its page: from Sandra, only she can change it', /From Sandra\. Only Sandra can change it\./.test(await text('#sldThemeBody .sldfrom')));
  ok('  so no Add photos, no Rename, no Share with', await ev(() => !$('sldPick') && $('sldThemeName').hidden && !$('sldAll')));
  ok('  and at the bottom, Take it off my list', await text('#sldDrop') === 'Take it off my list');
  await ev(async () => { await sldFindFiles([await window.__jf('f1.jpg', 300, 200, '#123')]); }); await settle(300);
  ok('  you can still find its photos on your phone', await ev(() => sldOf('tsandrashow1').length) === 1
    && await ev(() => !document.querySelector('#sldThemeBody [data-sldph]')));
  await shot('g-theirs');
  await ev(() => { window.__rows.slideshows.find(r => r.id === 'tsandrashow1').editors = ['me']; });
  await open(); await page('tsandrashow1');
  ok('once she lets you change it: Add photos, Rename, and tap to take out', /You can change it too/.test(await text('#sldThemeBody .sldfrom'))
    && await ev(() => !!$('sldPick') && !$('sldThemeName').hidden && !!document.querySelector('#sldThemeBody [data-sldph]') && !$('sldAll')));
  await clearSaid();
  await ev(() => { window.__writes.length = 0; });
  await ev(() => sldDropTheme()); await settle(400);
  ok('Take it off my list asks, and says Sandra still has it', /^Take Family off your list\? Its copies of the photos go from this phone too\. Sandra still has it\.$/.test(lastAsked()), lastAsked());
  ok('  it goes from your list, not from Sandra', await ev(() => !SLD_THEMES.some(t => t.id === 'tsandrashow1'))
    && (await db()).shows.some(r => r.id === 'tsandrashow1'));
  ok('  remembered with your settings', await ev(() => SLD_HIDE.includes('tsandrashow1')
    && window.__writes.some(w => w.op === 'update' && w.table === 'profiles' && arr(w.patch.home_tiles.sldhide).includes('tsandrashow1'))));
  await open();
  ok('  and it stays off when the Slideshow opens again', await ev(() => !SLD_THEMES.some(t => t.id === 'tsandrashow1')) && !/Shared with you/.test(await text('#sldBody .sldmain')));
  await ev(() => { SLD_HIDE = []; window.__rows.slideshows.push({ id: 'tsandrashow2', created_by: 'sandra', name: 'Holiday', shared_with: ['me'],
    share_all: false, editors: [], edit_all: false, made_at: '2026-11-01T10:00:00Z' }); });
  await open();
  ok('another shared with you comes up', await ev(() => SLD_THEMES.some(t => t.id === 'tsandrashow2')));
  await ev(() => { window.__rows.slideshows = window.__rows.slideshows.filter(r => r.id !== 'tsandrashow2'); });
  await open();
  ok('  and goes again when she stops sharing it', await ev(() => !SLD_THEMES.some(t => t.id === 'tsandrashow2')));
  await ev(() => { window.__rows.slideshows.push({ id: 'tnotforme01', created_by: 'other', name: 'Private', shared_with: ['sandra'],
    share_all: false, editors: [], edit_all: false, made_at: '2026-11-01T10:00:00Z' }); });
  await open();
  ok('one shared with someone else never shows here', await ev(() => !SLD_THEMES.some(t => t.id === 'tnotforme01')));

  // ---------------------------------------------------------------
  console.log('\nML350 The opening page');
  await ev(id => sldPlay(id, 'both'), canals); await settle(500);
  const intro = await ev(() => { const m = document.querySelector('#sldIntro .sldimade'), i = $('sldIpic'), top = document.querySelector('.sldtop');
    return m && { t: m.textContent, above: m.getBoundingClientRect().bottom <= i.getBoundingClientRect().top + 1,
      clear: m.getBoundingClientRect().top >= top.getBoundingClientRect().bottom }; });
  ok('Made with It’s MY life, at the top, above the photo', intro && intro.t === 'Made with It’s MY life' && intro.above, JSON.stringify(intro));
  ok('  clear of the buttons over the title', intro && intro.clear, JSON.stringify(intro));
  await shot('g-intro');
  await ev(() => sldStop()); await settle(200);
  await p.setViewportSize({ width: 844, height: 390 }); await settle(300);
  await ev(id => sldPlay(id, 'both'), canals); await settle(500);
  // Sideways the line is up in the strip the buttons use, so it must miss
  // whatever in that strip can be seen (the close button).
  const side = await ev(() => { const m = document.querySelector('#sldIntro .sldimade'), i = $('sldIpic'), h = document.querySelector('#sldIntro .sldihow');
    const a = m.getBoundingClientRect(), hit = x => { const r = x.getBoundingClientRect(), c = getComputedStyle(x);
      return r.width && r.height && c.visibility !== 'hidden' && Number(c.opacity) > 0.05
        && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top; };
    return { above: a.bottom <= i.getBoundingClientRect().top + 1,
      clear: ![...document.querySelectorAll('.sldtop > *')].some(hit), fits: h.getBoundingClientRect().bottom <= innerHeight }; });
  ok('  on a phone on its side too', side.above && side.clear && side.fits, JSON.stringify(side));
  await shot('g-intro-side');
  await ev(() => sldStop()); await settle(200);
  await p.setViewportSize({ width: 320, height: 640 }); await settle(200);
  await open(); await page(canals);
  ok('at 320 wide the page fits, Share with and all', await ev(() => document.documentElement.scrollWidth <= 320
    && $('sldThemeBody').scrollWidth <= $('sldThemeBody').clientWidth + 1));
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);

  console.log('\nStep 67 and the version');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'contacts-step67.sql'), 'utf8');
  ok('step 67 makes the two tables, the eight rules and the guard', /create table if not exists slideshows \(/.test(sql)
    && /create table if not exists slideshow_photos \(/.test(sql) && (sql.match(/^create policy /gm) || []).length === 8
    && /create trigger slideshows_guard before update on slideshows/.test(sql) && /Safe to run more than once/.test(sql));
  ok('  with no email addresses or keys in it', !/@[a-z0-9-]+\.[a-z]/i.test(sql) && !/eyJ|service_role|secret/i.test(sql));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const V = vj.history.find(x => x.version === '2026.11.20.7');
  ok('2026.11.20.7 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  what\'s new says so', !!V && /share one with everyone/.test(V.changes.join(' ')) && /Made with It’s MY life/.test(V.changes.join(' ')));

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail += errors.length;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
