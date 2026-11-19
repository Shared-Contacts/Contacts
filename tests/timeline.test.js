// Timeline (ML301, step 65): your life as coloured lines, today at the top
// and the day you were born at the bottom, a mark every five years. Where
// you lived is one line coloured by country, each move ending the place
// before; holidays a broken line in the same colours; then a column for
// each kind of your own, side by side when two overlap. No end runs on to
// today, one day is a dot. Tap for the details; the key hides and shows.
// Pretend people and dates only.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED|status of 500|status of 404/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 412, height: 860 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const shown = id => ev(id => !!document.getElementById(id) && !document.getElementById(id).classList.contains('hidden'), id);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && (!table || w.table === table)), [op, table]);
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  const text = sel => ev(sel => { const e = document.querySelector(sel); return !e ? '' : e.innerText !== undefined ? e.innerText : e.textContent; }, sel)
    .then(t => String(t || '').replace(/\s+/g, ' ').trim());
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); TML_EDIT = null; lockBackground(); });
  await ev(() => { WX_OFF = true; BSKY_OFF = true; });

  console.log('\nThe tile');
  ok('Timeline can go on the home screen, by that name', await ev(() =>
    TILE_DEST.tml && TILE_DEST.tml.label === 'Timeline' && TILE_DEST.tml.go === openTimeline));
  ok('a new person gets it after TV/Movies, with Settings still last', await ev(() =>
    TILE_DEFAULTS.indexOf('tml') === TILE_DEFAULTS.indexOf('tv') + 1 && TILE_DEFAULTS[TILE_DEFAULTS.length - 1] === 'settings'));
  ok('someone with tiles already set out gets it at the end, unless they took it off', await ev(() => {
    const was = MY_PROFILE, keep = TILES, kh = TILES_HIDDEN.slice();
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }, { dest: 'settings' }], hidden: [] } };
    loadTiles(); const got = TILES.map(t => t.dest);
    MY_PROFILE = { ...(was || {}), home_tiles: { tiles: [{ dest: 'contacts' }], hidden: ['tml'] } };
    loadTiles(); const binned = TILES.map(t => t.dest);
    MY_PROFILE = was; TILES = keep; TILES_HIDDEN = kh; WX_OFF = true; BSKY_OFF = true;
    return got.indexOf('tml') > got.indexOf('settings') && !binned.includes('tml');
  }));
  ok('it has a colour from the palette, not the same as TV/Movies beside it', await ev(() =>
    TILE_COLOURS.includes(TILE_DEFAULT_COLOUR.tml) && TILE_DEFAULT_COLOUR.tml !== TILE_DEFAULT_COLOUR.tv));
  ok('it is a place in the menu, with its own things to do', await ev(() => AREAS.tml && AREAS.tml.title === 'Timeline'
    && ['Add where you lived', 'Add a holiday', 'Add something else', 'Colours and kinds', 'Go to the day you were born']
      .every(l => areaItems('tml').some(x => x.label === l))));
  ok('its three screens wear the tile colour', await ev(() => TILE_SKIN.tml.join() === 'tml,tmlEd,tmlKeys'));
  ok('and it has its own Help', await ev(() => { openHelp('tml');
    const h = document.getElementById('h-tml'); $('help').classList.add('hidden');
    const all = h && h.parentElement.innerHTML;
    return !!h && HELP_AT.tml === 'h-tml' && /Where I lived/.test(all) && /Colours and kinds/.test(all) && /yours alone/.test(all); }));
  ok('Help knows where you are on each of its screens', await ev(() => {
    const at = id => { $(id).classList.remove('hidden'); SHEET_STACK.push(id); const s = currentScreen();
      $(id).classList.add('hidden'); return s; };
    return at('tml') === 'tml' && at('tmlEd') === 'tml' && at('tmlKeys') === 'tml'; }));
  ok('the backup in Settings takes both new tables', await ev(() =>
    /from timeline t\b/.test(BACKUP_SQL_1) && /from timeline_keys t\b/.test(BACKUP_SQL_1)));

  console.log('\nBefore step 65, and when it will not load');
  const whyText = msg => ev(async msg => {
    const real = sb.from, r = { data: null, error: { message: msg } };
    const chain = { eq: () => chain, order: () => Promise.resolve(r), then: (f, j) => Promise.resolve(r).then(f, j) };
    sb.from = t => (t === 'timeline' || t === 'timeline_keys') ? { select: () => chain } : real(t);
    const e0 = console.error; console.error = () => {};
    await openTimeline(); sb.from = real; console.error = e0;
    return $('tmlBody').textContent.replace(/\s+/g, ' ');
  }, msg);
  let why = await whyText('relation "public.timeline" does not exist');
  ok('no table yet: it says to run step 65', /Run the step 65 file in Supabase/.test(why), why.slice(0, 120));
  ok('and does not pretend there is nothing', !/Nothing on it yet/.test(why) && !(await ev(() => !!$('tmlSvg'))));
  why = await whyText('Failed to fetch');
  ok('a failed load says nothing has been lost', /Nothing has been lost/.test(why) && !/Nothing on it yet/.test(why), why.slice(0, 120));
  await closeAll();

  console.log('\nDrawing it');
  await ev(() => {
    const R = (id, kind, title, country, s, sp, e, ep, one, by) => ({ id, created_by: by || 'me', kind, title, country: country || null,
      start_on: s, start_prec: sp, end_on: e || null, end_prec: ep || 'day', one_day: !!one, notes: null });
    window.__rows.timeline = [
      R(1, 'place', 'Hamilton', 'New Zealand', '1950-03-04', 'day'),
      R(2, 'place', 'Bristol', 'United Kingdom', '1975-01-01', 'year'),
      R(3, 'place', 'Auckland', 'New Zealand', '1990-06-01', 'month'),
      R(4, 'place', 'Oxford', 'United Kingdom', '2003-01-01', 'year'),
      R(5, 'holiday', 'Paris', 'France', '1980-08-01', 'day', '1980-08-21', 'day'),
      R(6, 'holiday', 'Madrid', 'Spain', '2010-05-01', 'month', '2010-05-01', 'month'),
      R(7, 'rel', 'Marriage', null, '1978-01-01', 'year', '1995-01-01', 'year'),
      R(8, 'rel', 'Partner', null, '1997-01-01', 'year'),
      R(9, 'work', 'Newspaper', null, '1967-01-01', 'year', '1975-01-01', 'year'),
      R(10, 'work', 'Studio', null, '1976-01-01', 'year', '1990-01-01', 'year'),
      R(11, 'work', 'Teaching', null, '1985-01-01', 'year', '1988-01-01', 'year'),
      R(12, 'work', 'Freelance', null, '1990-01-01', 'year'),
      R(13, 'home', 'The boat', null, '2005-01-01', 'year'),
      R(14, 'school', 'Primary', null, '1955-01-01', 'year', '1961-01-01', 'year'),
      R(15, 'school', 'High school', null, '1961-01-01', 'year', '1967-01-01', 'year'),
      R(16, 'pets', 'Dog', null, '1995-01-01', 'year', '2008-01-01', 'year'),
      R(17, 'med', 'Knee operation', null, '2019-03-12', 'day', null, null, true),
      R(18, 'hi', 'Front cover', null, '2012-05-01', 'month', null, null, true),
      R(19, 'work', 'Someone else’s job', null, '1980-01-01', 'year', null, null, false, 'sandra')];
    window.__rows.timeline[9].notes = 'Darkroom work';
    window.__rows.timeline_keys = [{ created_by: 'me', born_on: '1950-03-04', kinds: [],
      countries: [{ name: 'New Zealand', colour: '#111111' }, { name: 'United Kingdom', colour: '#D7261E' },
        { name: 'France', colour: '#1F6FB2' }, { name: 'Spain', colour: '#E08A00' }] },
      { created_by: 'sandra', born_on: '1960-01-01', kinds: [], countries: [] }];
  });
  await clearWrites();
  await ev(() => openTimeline()); await settle();
  const hit = id => ev(id => { const q = TML_HITS.find(h => h.row.id === id); return q && { x: q.x, y0: q.y0, y1: q.y1, lane: q.lane,
    colour: q.colour, dot: !!q.dot, w: q.w, col: q.col, name: q.name }; }, id);
  const g = await ev(() => ({ top: TML_TOP, now: TML_GEO.y(TML_GEO.now), born: TML_GEO.y(TML_GEO.bornT), px: TML_GEO.px }));
  ok('it shows only your own Timeline', await ev(() => TML.length === 18 && !TML.some(r => r.created_by !== 'me')
    && TML_KEYS.born_on === '1950-03-04'));
  ok('today is at the top and the day you were born at the bottom', g.now === g.top && g.born > g.now + 500
    && /4 March 1950/.test(await text('#tmlSvg .tmlborn')));
  const marks = await ev(() => [...document.querySelectorAll('#tmlSvg text.tmly5')].map(t => [t.textContent, Number(t.getAttribute('y'))])
    .sort((a, b) => a[1] - b[1]));
  const years = marks.filter(m => /^\d{4}$/.test(m[0]));
  ok('a mark every five years, newest at the top', years.length >= 14 && years.every(m => Number(m[0]) % 5 === 0)
    && years.every((m, i) => !i || (Number(m[0]) < Number(years[i - 1][0]) && m[1] > years[i - 1][1])),
    marks.map(m => m[0]).join());
  ok('Today and Born are marked at the ends', marks[0][0] === 'Today' && marks[marks.length - 1][0] === 'Born', marks.map(m => m[0]).join());
  const [h1, h2, h3, h4] = [await hit(1), await hit(2), await hit(3), await hit(4)];
  ok('where you lived is one line, coloured by country', h1.colour === '#111111' && h2.colour === '#D7261E'
    && h3.colour === '#111111' && h4.colour === '#D7261E' && [h1, h2, h3, h4].every(h => h.x === h1.x && h.w === 10));
  ok('the first place starts the day you were born', Math.abs(h1.y1 - g.born) < 0.5);
  ok('each move ends the place before', Math.abs(h1.y0 - h2.y1) < 0.5 && Math.abs(h2.y0 - h3.y1) < 0.5 && Math.abs(h3.y0 - h4.y1) < 0.5);
  ok('the last place runs on to today', Math.abs(h4.y0 - g.now) < 0.5);
  ok('a move shows as a break in the line', await ev(() => document.querySelectorAll('#tmlSvg .tmlmove').length === 3));
  const [p5, p6] = [await hit(5), await hit(6)];
  ok('holidays are a broken line beside it, in the same country colours', p5.colour === '#1F6FB2' && p6.colour === '#E08A00'
    && p5.x === p6.x && p5.x > h1.x && p5.w === 8);
  ok('a short holiday still shows', p5.y1 - p5.y0 >= 6);
  const [p10, p11, p12, p14, p15] = [await hit(10), await hit(11), await hit(12), await hit(14), await hit(15)];
  ok('something with no end runs on to today', Math.abs(p12.y0 - g.now) < 0.5 && (await hit(8)).y0 === p12.y0);
  ok('the same kind at the same time sits side by side', p10.lane === 0 && p11.lane === 1 && p11.x > p10.x);
  ok('one ending as the next starts shares its lane', p14.lane === 0 && p15.lane === 0 && p14.x === p15.x);
  ok('each kind has its own column and colour', (await hit(7)).colour === '#993556' && p10.colour === '#3B6D11'
    && (await hit(13)).colour === '#854F0B' && p14.colour === '#534AB7' && (await hit(16)).colour === '#1D9E75');
  ok('one day is a dot', await ev(() => [...document.querySelectorAll('#tmlSvg circle')].map(c => c.getAttribute('fill')).sort().join())
    === '#7F77DD,#D4537E' && (await hit(17)).dot && (await hit(18)).dot);
  ok('names sit beside the lines where there is room', await ev(() => {
    const t = [...document.querySelectorAll('#tmlSvg .tmllab')].map(x => x.textContent);
    return ['Hamilton', 'Oxford', 'Studio', 'Primary', 'High school'].every(n => t.includes(n)); }));
  ok('the columns go left to right in the order of the kinds', await ev(() => {
    const xs = ['place', 'holiday', 'rel', 'work', 'home', 'school', 'pets', 'med', 'hi']
      .map(k => TML_HITS.filter(h => h.col === k).map(h => h.x)).map(a => Math.min(...a));
    return xs.every((x, i) => !i || x > xs[i - 1]); }));

  console.log('\nThe key');
  const keyText = await text('#tmlKey');
  ok('it names each country and kind', ['Where I lived', 'New Zealand', 'United Kingdom', 'France', 'Spain', 'Holidays',
    'Relationships', 'Work', 'Homes and boats', 'School', 'Pets', 'Medical', 'Highlights'].every(n => keyText.includes(n)), keyText);
  ok('it stays put as the lines scroll past', await ev(async () => {
    const body = $('tmlBody'), k = $('tmlKey'), k0 = k.getBoundingClientRect().top, s0 = $('tmlSvg').getBoundingClientRect().top;
    body.scrollTop = 900; await new Promise(r => setTimeout(r, 80));
    const kt = k.getBoundingClientRect().top, sv = $('tmlSvg').getBoundingClientRect().top; body.scrollTop = 0;
    return Math.abs(kt - k0) < 2 && sv < s0 - 800; }));
  await ev(() => document.querySelector('#tmlKey [data-tmlhide="work"]').click()); await settle(100);
  ok('tapping Work hides its lines', await ev(() => !TML_HITS.some(h => h.col === 'work')
    && document.querySelector('#tmlKey [data-tmlhide="work"]').getAttribute('aria-pressed') === 'false'
    && JSON.parse(localStorage.getItem('tmlHide')).includes('work')));
  await ev(() => document.querySelector('#tmlKey [data-tmlhide="work"]').click()); await settle(100);
  ok('and tapping it again brings them back', await ev(() => TML_HITS.filter(h => h.col === 'work').length === 4
    && !JSON.parse(localStorage.getItem('tmlHide')).includes('work')));
  await ev(() => document.querySelector('#tmlKey [data-tmlhide="place"]').click()); await settle(100);
  ok('Where I lived can be hidden too, and its countries go pale', await ev(() => !TML_HITS.some(h => h.col === 'place')
    && document.querySelector('#tmlKey .tmlkc').classList.contains('off')));
  await ev(() => document.querySelector('#tmlKey [data-tmlhide="place"]').click()); await settle(100);

  console.log('\nZooming');
  const tall = () => ev(() => Number($('tmlSvg').getAttribute('height')));
  const midYear = () => ev(() => { const body = $('tmlBody'), g = TML_GEO;
    const mid = body.scrollTop + body.clientHeight / 2 - tmlSvgTop(); return new Date(g.now - (mid - TML_TOP) / g.px * TML_YEAR).getUTCFullYear(); });
  await ev(() => { $('tmlBody').scrollTop = 600; });
  const h0 = await tall(), m0 = await midYear();
  await ev(() => $('tmlIn').click()); await settle(100);
  ok('the + glass spreads the years out', await tall() > h0 * 1.3 && await ev(() => localStorage.getItem('tmlZoom') === '4'));
  ok('and keeps the same years in the middle of the screen', Math.abs(await midYear() - m0) <= 1, `${m0} then ${await midYear()}`);
  ok('a mark every year once there is room', await ev(() => document.querySelectorAll('#tmlSvg .tmlg1').length > 40));
  await ev(() => { $('tmlOut').click(); $('tmlOut').click(); }); await settle(100);
  ok('the − glass closes them up again', await tall() < h0);
  await ev(() => { TML_Z = 0; renderTimeline(); });
  ok('and stops at the closest', await ev(() => $('tmlOut').disabled && !$('tmlIn').disabled));
  await ev(() => { TML_Z = 3; tmlStore('tmlZoom', 3); renderTimeline(); $('tmlBody').scrollTop = 0; });

  console.log('\nTapping one');
  const tap = async id => {
    const pt = await ev(id => { const q = TML_HITS.find(h => h.row.id === id), body = $('tmlBody');
      body.scrollTop = Math.max(0, tmlSvgTop() + (q.y0 + q.y1) / 2 - body.clientHeight / 2);
      const r = $('tmlSvg').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + (q.y0 + q.y1) / 2 }; }, id);
    await p.mouse.click(pt.x, pt.y); await settle(150);
    return text('#tmlViewBox');
  };
  let v = await tap(10);
  ok('a job shows its kind, name, dates, how long and notes', /Work/i.test(v) && /Studio/.test(v) && /1976 to 1990/.test(v)
    && /14 years/.test(v) && /Darkroom work/.test(v), v);
  await ev(() => $('tmlViewNo').click());
  v = await tap(1);
  ok('the first place runs from birth to the next move', /Hamilton, New Zealand/.test(v) && /From birth to 1975/.test(v) && /25 years/.test(v), v);
  await ev(() => $('tmlViewNo').click());
  v = await tap(4);
  ok('the place you live now says since when, so far', /Since 2003/.test(v) && /\d+ years so far/.test(v), v);
  await ev(() => $('tmlViewNo').click());
  v = await tap(12);
  ok('a job still going says so far', /Since 1990/.test(v) && /\d+ years so far/.test(v), v);
  await ev(() => $('tmlViewNo').click());
  v = await tap(5);
  ok('a holiday counts its days', /Holiday · France/i.test(v) && /Paris/.test(v) && /1 August 1980 to 21 August 1980/.test(v) && /21 days/.test(v), v);
  await ev(() => $('tmlViewNo').click());
  v = await tap(17);
  ok('a dot is its one day', /Medical/i.test(v) && /Knee operation/.test(v) && /12 March 2019/.test(v) && !/days|years|months/.test(v), v);
  await ev(() => $('tmlViewCh').click()); await settle(150);
  ok('Change opens it to change, filled in', await shown('tmlEd') && await ev(() => {
    const f = $('tmlForm'); return f.dataset.grp === 'other' && f.dataset.one === '1' && f.elements.title.value === 'Knee operation'
      && f.elements.start_d.value === '12' && f.elements.start_m.value === '3' && f.elements.start_y.value === '2019'
      && document.querySelector('[data-tmlkind="med"]').getAttribute('aria-pressed') === 'true'; }));
  await clearWrites();
  await ev(() => { const f = $('tmlForm'); f.elements.title.value = 'Knee replaced'; f.elements.notes.value = 'Left knee'; });
  await ev(() => $('tmlSave').click()); await settle(200);
  let up = (await writes('update', 'timeline'))[0];
  ok('saving changes that one', !!up && up.patch.title === 'Knee replaced' && up.patch.notes === 'Left knee' && up.patch.one_day === true
    && up.patch.end_on === null && up.where.some(x => x[1] === 'id' && x[2] === 17), JSON.stringify(up));
  ok('and the editor closes', !(await shown('tmlEd')) && /On your Timeline/.test(await said()));
  await clearWrites();
  v = await tap(16);
  await ev(() => $('tmlViewDel').click()); await settle(200);
  const del = (await writes('delete', 'timeline'))[0];
  ok('Delete asks, then takes it off', !!del && del.where.some(x => x[1] === 'id' && x[2] === 16) && !(await ev(() => !!$('tmlViewBox'))));

  console.log('\nAdding');
  await ev(() => $('tmlAdd').click()); await settle(100);
  const addText = await text('#tmlAddBox');
  ok('the red + asks what to add', ['Where you lived', 'A holiday', 'Relationships', 'Work', 'Pets', 'Medical', 'Colours and kinds']
    .every(n => addText.includes(n)), addText);
  await ev(() => document.querySelector('[data-tmladd="place"]').click()); await settle(150);
  ok('Where you lived asks for the country, the town and when you moved', await ev(() => {
    const f = $('tmlForm'), vis = e => !!e && e.offsetParent !== null;
    return f.dataset.grp === 'place' && vis(f.elements.country) && vis(f.elements.title) && vis(f.elements.start_y)
      && !vis(f.elements.end_y) && !vis(f.elements.one_day) && /Moved there/.test(f.innerText); }));
  await clearWrites();
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('it needs the country', /Which country was it\?/.test(await said()) && !(await writes('insert', 'timeline')).length);
  const fill = (vals) => ev(vals => { const f = $('tmlForm');
    Object.entries(vals).forEach(([k, v]) => { const e = f.elements[k]; if (e.type === 'checkbox') { e.checked = v; e.dispatchEvent(new Event('change')); } else e.value = v; }); }, vals);
  await fill({ country: 'nz', title: 'Napier', start_y: '2020', start_m: '', start_d: '' });
  await ev(() => $('tmlSave').click()); await settle(200);
  let ins = (await writes('insert', 'timeline'))[0];
  ok('NZ is saved as New Zealand, by the year', !!ins && ins.rows.kind === 'place' && ins.rows.country === 'New Zealand'
    && ins.rows.title === 'Napier' && ins.rows.start_on === '2020-01-01' && ins.rows.start_prec === 'year' && ins.rows.end_on === null,
    JSON.stringify(ins && ins.rows));
  ok('a country it already knows keeps its colour', !(await writes('upsert', 'timeline_keys')).length);

  await clearWrites();
  await ev(() => tmlEdit(null, 'place')); await fill({ country: 'Peru', start_y: '2021', start_m: '4' });
  await ev(() => $('tmlSave').click()); await settle(200);
  const ku = (await writes('upsert', 'timeline_keys'))[0];
  const peru = ku && ku.rows.countries.find(c => c.name === 'Peru');
  ok('a new country gets a colour none of the others has', !!peru && /^#[0-9A-F]{6}$/i.test(peru.colour)
    && ku.rows.countries.filter(c => c.colour.toLowerCase() === peru.colour.toLowerCase()).length === 1 && ku.rows.created_by === 'me',
    JSON.stringify(ku && ku.rows.countries));
  ok('a move by the month', (await writes('insert', 'timeline'))[0].rows.start_on === '2021-04-01'
    && (await writes('insert', 'timeline'))[0].rows.start_prec === 'month');

  await clearWrites();
  await ev(() => tmlEdit(null, 'holiday'));
  ok('a holiday asks where, the country, from and to', await ev(() => {
    const f = $('tmlForm'), vis = e => !!e && e.offsetParent !== null;
    return f.dataset.grp === 'holiday' && vis(f.elements.country) && vis(f.elements.end_y) && !vis(f.elements.one_day); }));
  await fill({ title: 'Rome', country: 'Italy', start_d: '3', start_m: '6', start_y: '2015' });
  await ev(() => $('tmlSave').click()); await settle(200);
  ins = (await writes('insert', 'timeline'))[0];
  ok('a day out is a holiday with no end: one day', !!ins && ins.rows.kind === 'holiday' && ins.rows.one_day === true
    && ins.rows.start_on === '2015-06-03' && ins.rows.start_prec === 'day' && ins.rows.end_on === null, JSON.stringify(ins && ins.rows));

  await clearWrites();
  await ev(() => tmlEdit(null, 'work'));
  ok('a job asks what, from and to, with Just the one day', await ev(() => {
    const f = $('tmlForm'), vis = e => !!e && e.offsetParent !== null;
    return f.dataset.grp === 'other' && !vis(f.elements.country) && vis(f.elements.end_y) && vis(f.elements.one_day)
      && !f.elements.one_day.checked; }));
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('it needs a name', /Say what it was/.test(await said()));
  await fill({ title: 'The pub', start_y: '2001', start_m: '3', end_y: '1999' });
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('an end before the start is refused', /ends before it starts/.test(await said()) && !(await writes('insert', 'timeline')).length);
  await fill({ end_y: '2001', end_m: '' });
  await ev(() => $('tmlSave').click()); await settle(200);
  ins = (await writes('insert', 'timeline'))[0];
  ok('March 2001 to 2001 is fine: a month, then a year', !!ins && ins.rows.start_on === '2001-03-01' && ins.rows.start_prec === 'month'
    && ins.rows.end_on === '2001-01-01' && ins.rows.end_prec === 'year' && ins.rows.one_day === false, JSON.stringify(ins && ins.rows));

  await clearWrites();
  await ev(() => tmlEdit(null, 'work')); await fill({ title: 'Odd job', start_d: '12', start_m: '', start_y: '1990' });
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('a day with no month is refused', /choose the month too/.test(await said()));
  await fill({ start_d: '30', start_m: '2', start_y: '1990' });
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('30 February is refused', /February 1990 has no 30th/.test(await said()));
  await fill({ start_d: '', start_m: '', start_y: String(new Date().getFullYear() + 1) });
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('a date still to come is refused', /has not come yet/.test(await said()));
  await fill({ start_y: '85' });
  await ev(() => $('tmlSave').click()); await settle(100);
  ok('a year needs all four figures', /needs a year, like 1985/.test(await said()) && !(await writes('insert', 'timeline')).length);
  await fill({ start_y: '1990', start_m: '7', start_d: '' , one_day: true });
  ok('Just the one day hides To', await ev(() => $('tmlForm').dataset.one === '1' && $('tmlForm').elements.end_y.offsetParent === null));
  await ev(() => $('tmlSave').click()); await settle(200);
  ins = (await writes('insert', 'timeline'))[0];
  ok('and saves it as a dot', !!ins && ins.rows.one_day === true && ins.rows.end_on === null && ins.rows.start_on === '1990-07-01');

  await ev(() => tmlEdit(null, 'med'));
  ok('Medical starts as the one day, as its kind is dots', await ev(() => $('tmlForm').elements.one_day.checked && $('tmlForm').dataset.one === '1'));
  await ev(() => document.querySelector('[data-tmlkind="pets"]').click());
  ok('changing the kind to Pets takes the tick off and shows To', await ev(() => !$('tmlForm').elements.one_day.checked
    && $('tmlForm').dataset.one === '0' && $('tmlForm').elements.end_y.offsetParent !== null));
  await ev(() => document.querySelector('[data-tmlkind="place"]').click());
  ok('and to Where I lived shows the country instead', await ev(() => $('tmlForm').dataset.grp === 'place'
    && $('tmlForm').elements.country.offsetParent !== null));
  await ev(() => $('tmlEdCancel').click());

  await clearWrites();
  await ev(() => { window.__realFrom = sb.from;
    sb.from = t => t === 'timeline' ? { insert: () => Promise.resolve({ error: { message: 'relation "public.timeline" does not exist' } }) } : window.__realFrom(t);
    window.__e0 = console.error; console.error = () => {}; });
  await ev(() => tmlEdit(null, 'pets')); await fill({ title: 'Cat', start_y: '2000' });
  await ev(() => $('tmlSave').click()); await settle(150);
  await ev(() => { sb.from = window.__realFrom; console.error = window.__e0; });
  ok('saving before step 65 says to run it, and keeps what you typed', /Timeline needs step 65 run in Supabase first/.test(await said())
    && await shown('tmlEd') && await ev(() => $('tmlForm').elements.title.value === 'Cat'));
  await ev(() => $('tmlEdCancel').click());

  console.log('\nThe day you were born');
  await ev(() => { MY_PROFILE.my_contact_id = 1; CONTACTS.find(c => c.id === 1).birth_date = '1948-07-01'; renderTimeline(); });
  ok('it comes from your own card in Contacts first', await ev(() => tmlBorn().from === 'card')
    && /1 July 1948/.test(await text('#tmlSvg .tmlborn')));
  await ev(() => openTmlKeys()); await settle(100);
  ok('and Colours and kinds says to change it there', /From your own card in Contacts/.test(await text('#tmlKeysBody'))
    && !(await ev(() => !!$('tmlBornForm'))));
  await ev(() => { $('tmlKeysBack').click(); MY_PROFILE.my_contact_id = null; CONTACTS.find(c => c.id === 1).birth_date = null;
    window.__rows.timeline_keys = []; });
  await ev(() => openTimeline()); await settle();
  ok('with no birthday anywhere, it asks', /When were you born\?/.test(await text('#tmlBody')) && await ev(() => !!$('tmlSvg')));
  ok('and starts from what it has', await ev(() => TML_GEO.low <= tmlT('1950-03-04', 'day')));
  await clearWrites();
  await ev(() => { const f = $('tmlAskBorn'); f.elements.born_y.value = '1950'; $('tmlAskGo').click(); }); await settle(150);
  ok('a year alone is not enough', /day and the month as well/.test(await said()) && !(await writes('upsert', 'timeline_keys')).length);
  await ev(() => { const f = $('tmlAskBorn'); f.elements.born_d.value = '4'; f.elements.born_m.value = '3'; $('tmlAskGo').click(); }); await settle(150);
  const bu = (await writes('upsert', 'timeline_keys'))[0];
  ok('the whole date is kept, just for you', !!bu && bu.rows.born_on === '1950-03-04' && bu.rows.created_by === 'me');
  ok('and the question goes', !/When were you born\?/.test(await text('#tmlBody')) && /4 March 1950/.test(await text('#tmlSvg .tmlborn')));

  console.log('\nColours and kinds');
  await ev(() => openTmlKeys()); await settle(100);
  const kt = await text('#tmlKeysBody');
  ok('it lists the countries and the kinds', ['New Zealand', 'United Kingdom', 'France', 'Spain'].every(n => kt.includes(n))
    && await ev(() => [...document.querySelectorAll('[data-tmlkn]')].map(i => i.value).join() ===
      'Relationships,Work,Homes and boats,School,Pets,Medical,Highlights'), kt);
  await clearWrites();
  await ev(() => document.querySelector('[data-tmlcc="0"]').click()); await settle(100);
  ok('a colour opens the colour box', await ev(() => !!$('tmlColBox') && $('tmlColBox').querySelectorAll('[data-col]').length >= 12));
  await ev(() => $('tmlColBox').querySelector('[data-col="#2E8B57"]').click()); await settle(150);
  let kw = (await writes('upsert', 'timeline_keys')).pop();
  ok('choosing one changes the country’s colour everywhere', !!kw && kw.rows.countries.find(c => c.name === 'New Zealand').colour === '#2E8B57'
    && await ev(() => TML_HITS.find(h => h.row.id === 1).colour === '#2E8B57'));
  await ev(() => { const i = document.querySelector('[data-tmlkn="work"]'); i.value = '  Jobs '; i.dispatchEvent(new Event('change')); }); await settle(150);
  kw = (await writes('upsert', 'timeline_keys')).pop();
  ok('a kind can be renamed', kw.rows.kinds.find(k => k.k === 'work').name === 'Jobs' && /Jobs/.test(await text('#tmlKey')));
  await ev(() => { const i = document.querySelector('[data-tmlkd="pets"]'); i.checked = true; i.dispatchEvent(new Event('change')); }); await settle(150);
  kw = (await writes('upsert', 'timeline_keys')).pop();
  ok('and made a kind of dots', kw.rows.kinds.find(k => k.k === 'pets').dot === true);
  await clearWrites();
  await ev(() => document.querySelector('[data-tmlkx="work"]').click()); await settle(100);
  ok('a kind in use cannot be deleted', /Change or delete them first/.test(await said()) && !(await writes('upsert', 'timeline_keys')).length);
  await ev(() => document.querySelector('[data-tmlkx="school"]').click()); await settle(100);
  await ev(() => { TML = TML.filter(r => r.kind !== 'school'); window.__rows.timeline = window.__rows.timeline.filter(r => r.kind !== 'school'); renderTmlKeys(); });
  await ev(() => document.querySelector('[data-tmlkx="school"]').click()); await settle(150);
  kw = (await writes('upsert', 'timeline_keys')).pop();
  ok('one with nothing in it can', !!kw && !kw.rows.kinds.some(k => k.k === 'school'));
  await ev(() => $('tmlKindAdd').click()); await settle(150);
  kw = (await writes('upsert', 'timeline_keys')).pop();
  const nk = kw.rows.kinds[kw.rows.kinds.length - 1];
  ok('+ Add a kind adds one, with a colour of its own, ready to name', nk.name === 'New kind' && /^k[a-z0-9]+$/.test(nk.k)
    && await ev(k => document.activeElement === document.querySelector(`[data-tmlkn="${k}"]`), nk.k));
  ok('every kind keeps its own key', new Set(kw.rows.kinds.map(k => k.k)).size === kw.rows.kinds.length);
  ok('the rows can be held and slid into order', await ev(() =>
    document.querySelectorAll('#tmlKindRows [data-hm^="tmlk:"]').length === TML_KEYS.kinds.length && typeof HM_SAVE.tmlk === 'function'));
  await ev(() => HM_SAVE.tmlk(['work', 'rel'])); await settle(150);
  kw = (await writes('upsert', 'timeline_keys')).pop();
  ok('sliding Work above Relationships saves the order', kw.rows.kinds[0].k === 'work' && kw.rows.kinds[1].k === 'rel'
    && kw.rows.kinds.length === await ev(() => TML_KEYS.kinds.length));
  ok('and the columns follow it', await ev(() => {
    const x = k => Math.min(...TML_HITS.filter(h => h.col === k).map(h => h.x)); return x('work') < x('rel'); }));
  await ev(() => $('tmlKeysBack').click());

  console.log('\nThe menu');
  await ev(() => areaItems('tml').find(x => x.label === 'Go to the day you were born').fn()); await settle(100);
  ok('Go to the day you were born goes to the bottom', await ev(() => { const b = $('tmlBody'); return b.scrollTop > 0 && b.scrollTop + b.clientHeight >= b.scrollHeight - 2; }));
  await ev(() => areaItems('tml').find(x => x.label === 'Add something else').fn()); await settle(100);
  ok('Add something else opens the choice', await ev(() => !!$('tmlAddBox')));
  await ev(() => document.querySelector('[data-home="tml"]').click()); await settle(150);
  ok('leaving puts it all away', !(await shown('tml')) && await ev(() => !$('tmlAddBox') && !$('tmlViewBox')));

  console.log('\nOn a phone');
  await closeAll();
  for (const w of [320, 360, 390, 412]) {
    await p.setViewportSize({ width: w, height: 800 });
    await ev(() => openTimeline()); await settle(250);
    const over = id => ev(id => { const e = $(id); return e.scrollWidth - e.clientWidth; }, id);
    ok(`the lines and the key fit side by side at ${w}`, await over('tmlBody') <= 0 && await over('tmlMap') <= 0
      && await ev(() => document.documentElement.scrollWidth <= innerWidth && $('tmlKey').getBoundingClientRect().right <= innerWidth));
    ok(`where you lived is still named at ${w}`, await ev(() => [...document.querySelectorAll('#tmlSvg .tmllab')].some(t => t.textContent === 'Hamilton')));
    ok(`the key reads whole words at ${w}`, await ev(() => [...document.querySelectorAll('#tmlKey .tmlki span:last-child')]
      .every(s => s.scrollWidth <= s.clientWidth + 1)));
    const pt = await ev(() => { const q = TML_HITS.find(h => h.row.id === 10), body = $('tmlBody');
      body.scrollTop = Math.max(0, tmlSvgTop() + (q.y0 + q.y1) / 2 - body.clientHeight / 2);
      const r = $('tmlSvg').getBoundingClientRect(); return { x: r.left + q.x, y: r.top + (q.y0 + q.y1) / 2 }; });
    await p.mouse.click(pt.x, pt.y); await settle(120);
    ok(`the details fit at ${w}`, await ev(() => { const i = document.querySelector('#tmlViewBox .inner');
      return !!i && i.scrollWidth <= i.clientWidth && i.getBoundingClientRect().right <= innerWidth; }));
    await ev(() => $('tmlViewNo').click());
    await ev(() => tmlEdit(TML.find(r => r.id === 10))); await settle(120);
    ok(`the editor and its dates fit at ${w}`, await over('tmlEdBody') <= 0 && await ev(() =>
      [...document.querySelectorAll('.tmldrow')].every(r => r.scrollWidth <= r.clientWidth + 1)));
    await ev(() => { $('tmlEdCancel').click(); openTmlKeys(); }); await settle(120);
    ok(`Colours and kinds fits at ${w}`, await over('tmlKeysBody') <= 0 && await ev(() =>
      [...document.querySelectorAll('.tmlkrow')].every(r => r.getBoundingClientRect().right <= $('tmlKeysBody').getBoundingClientRect().right)));
    await closeAll();
  }
  await p.setViewportSize({ width: 412, height: 860 });

  console.log('\nThe version');
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const vt = vj.history.find(h => h.version === '2026.11.17.4');
  ok('the app and version.json agree', await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version, vj.version);
  ok('What’s new mentions Timeline', !!vt && vt.changes.length > 0 && vt.changes.every(c => /^Timeline: /.test(c) && c.length < 160));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
