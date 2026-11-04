// The 4 Nov 2026 batch: Diary entries about someone else are tinted (ML176),
// hold and slide replaces the up and down arrows everywhere (ML177), My Stuff
// lets you pick the main photo (ML178), the weather on Today (ML179), and the
// week's menu in Recipes with Today's Menu on Today (ML180, step 55).
const { chromium } = require('playwright');
const path = require('path');
const { holdSlide } = require('./hold');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|meal_plan/i;

// Chesterfield Canal near Worksop, give or take.
const HERE = { latitude: 53.3015, longitude: -1.1240 };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
    permissions: ['geolocation'], geolocation: HERE });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  // The forecast and the place name, as the two services would send them.
  const asked = [];
  let forecast = { current: { temperature_2m: 10.6, weather_code: 61 },
    daily: { weather_code: [61], temperature_2m_max: [12.8], temperature_2m_min: [8.6],
      precipitation_probability_max: [70], wind_speed_10m_max: [12.3] } };
  await p.route('https://api.open-meteo.com/**', r => { asked.push(r.request().url());
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify(forecast) }); });
  await p.route('https://nominatim.openstreetmap.org/**', r => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ address: { town: 'Worksop', country: 'United Kingdom' } }) }));
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); lockBackground(); });
  const writes = (op, table) => ev(([op, table]) => window.__writes.filter(w => w.op === op && w.table === table), [op, table]);
  const clear = () => ev(() => { window.__writes.length = 0; });
  const today = await ev(() => briefDay());

  // ---------------------------------------------------------------
  console.log('\nDiary: entries about somebody else are tinted (ML176)');
  await ev(() => {
    const t = new Date(); t.setHours(t.getHours() + 3);
    const it = (id, title, contact_id) => ({ id, kind: 'appointment', title, created_by: 'me', contact_id,
      starts_at: t.toISOString(), ends_at: null, repeat_every: 'none', updated_at: '2026-01-01' });
    window.__rows.items = [it(801, 'To Kath’s', 2), it(802, 'Pumpkin tossing', 1), it(803, 'Bins out', null)];
    window.__rows.profiles[0].my_contact_id = 1; MY_PROFILE.my_contact_id = 1;
  });
  await ev(async () => { await loadAll(); MY_PROFILE.my_contact_id = 1; DIARY_VIEW = 'list'; DIARY_DONE = false; openDiary(); }); await settle(500);
  const tint = id => ev(id => { const b = document.querySelector(`[data-item="${id}"]`);
    return b ? b.closest('.item').classList.contains('forother') : null; }, id);
  ok('one about Sandra is tinted', await tint(801) === true);
  ok('one about you is not', await tint(802) === false);
  ok('one about nobody is not', await tint(803) === false);
  ok('the tint is a different background', await ev(() => {
    const a = getComputedStyle(document.querySelector('[data-item="801"]').closest('.item')).backgroundColor;
    const m = getComputedStyle(document.querySelector('[data-item="802"]').closest('.item')).backgroundColor;
    return a !== m && a !== 'rgba(0, 0, 0, 0)'; }));
  await ev(() => { DIARY_VIEW = 'week'; renderDiary(); }); await settle(200);
  ok('the week view tints it too', await tint(801) === true);
  await ev(() => { MY_PROFILE.my_contact_id = null; renderDiary(); }); await settle(200);
  ok('with nobody set as you, nothing is tinted', await tint(801) === false && await tint(802) === false);
  await ev(() => { window.__rows.profiles[0].my_contact_id = 1; MY_PROFILE.my_contact_id = 1; window.__rows.items = []; }); await closeAll();

  // ---------------------------------------------------------------
  console.log('\nMy Stuff: choose the main photo (ML178)');
  await ev(() => {
    window.__rows.stuff = [
      { id: 1, created_by: 'me', kind: 'item', name: 'Camera', details: {}, shared_with: [], reminders: {},
        photos: [{ path: 'stf/me/a.jpg' }, { path: 'stf/me/b.jpg' }, { path: 'stf/me/c.jpg' }], files: [] },
      { id: 2, created_by: 'sandra', kind: 'item', name: 'Her bike', details: {}, shared_with: ['me'], reminders: {},
        photos: [{ path: 'stf/sandra/x.jpg' }, { path: 'stf/sandra/y.jpg' }], files: [] }];
    window.__rows.stuff_service = [];
  });
  await ev(async () => { await loadStuff(); await openStuffThing(1); }); await settle(600);
  ok('the first photo is the big one', await ev(() => /a\.jpg$/.test(document.querySelector('.stfhero').src)));
  ok('each of the others has a star', (await p.$$('[data-stfmain]')).length === 2);
  ok('and it says what the star does', await ev(() => /Tap .* to make it the big photo/.test($('stfView').textContent)));
  await clear();
  await p.click('[data-stfmain="2"]'); await settle(500);
  let w = await writes('update', 'stuff');
  ok('tapping one makes it first, the rest keep their order',
    w.length === 1 && JSON.stringify(w[0].patch.photos.map(x => x.path)) === '["stf/me/c.jpg","stf/me/a.jpg","stf/me/b.jpg"]',
    JSON.stringify(w.map(x => x.patch)));
  ok('  on that thing only', w[0] && JSON.stringify(w[0].where) === JSON.stringify([['eq', 'id', 1]]));
  ok('  and it opens no photo', await ev(() => !document.querySelector('.lightbox,.lbox,#lightbox:not(.hidden)')));
  await ev(() => { window.__rows.stuff[0].photos = [{ path: 'stf/me/c.jpg' }, { path: 'stf/me/a.jpg' }, { path: 'stf/me/b.jpg' }]; });
  await ev(() => stfAfterChange(1)); await settle(400);
  ok('the new main photo is the big one', await ev(() => /c\.jpg$/.test(document.querySelector('.stfhero').src)));
  await ev(async () => { await loadStuff(); await openStuffThing(2); }); await settle(500);
  ok('somebody else’s thing has no stars', (await p.$$('[data-stfmain]')).length === 0);
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nToday: the weather (ML179)');
  await ev(() => { try { localStorage.removeItem('weather'); } catch (e) {} });
  await ev(() => openBrief()); await settle(1200);
  const wx = () => ev(() => { const a = document.querySelector('#briefWeather .wx');
    return a ? { text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.href, target: a.target } : null; });
  let x = await wx();
  ok('it shows on Today', !!x, JSON.stringify(await ev(() => $('briefWeather') && $('briefWeather').innerHTML)));
  ok('a short description with the day’s low and high', x && /Light rain, 9° to 13°/.test(x.text), x && x.text);
  ok('the temperature now, the wind and the chance of rain',
    x && /Now 11°/.test(x.text) && /wind up to 12 mph/.test(x.text) && /70% chance of rain/.test(x.text), x && x.text);
  ok('where it is for', x && /Worksop, United Kingdom/.test(x.text), x && x.text);
  ok('it sits under the Bluesky photo, above the birthdays', await ev(() => {
    const kids = [...$('briefBody').children]; const wi = kids.indexOf($('briefWeather'));
    const bi = kids.findIndex(k => /Birthday/.test(k.textContent) && k.matches('p.dsec'));
    const pi = kids.indexOf($('briefPhoto'));
    return wi > -1 && wi < bi && (pi === -1 || pi < wi); }));
  ok('the forecast is for the phone’s own position, in mph',
    asked.length >= 1 && /latitude=53\.30/.test(asked[0]) && /longitude=-1\.12/.test(asked[0]) && /wind_speed_unit=mph/.test(asked[0]), asked[0]);
  ok('the link opens the Met Office forecast for that spot, in a new tab',
    x && x.href === 'https://weather.metoffice.gov.uk/forecast/' + await ev(() => wxGeohash(53.3015, -1.1240, 9)) && x.target === '_blank',
    x && x.href);
  ok('the Met Office name for a spot is worked out right (Wikipedia’s example)',
    await ev(() => wxGeohash(57.64911, 10.40744, 11)) === 'u4pruydqqvj');
  ok('it is kept on this phone for next time', await ev(() => { const k = JSON.parse(localStorage.getItem('weather'));
    return k && k.place === 'Worksop, United Kingdom' && k.day === briefDay(); }));
  const n = asked.length;
  await ev(() => { shutBrief(); openBrief(); }); await settle(600);
  ok('opening Today again soon after does not ask again', asked.length === n);
  forecast = { daily: {} };
  await ev(() => { WX.at = 0; shutBrief(); openBrief(); }); await settle(1000);
  x = await wx();
  ok('a failed look keeps the last forecast, and says so', x && /Light rain/.test(x.text)
    && await ev(() => /Could not get a newer forecast/.test($('briefWeather').textContent)));
  ok('  with a Try again', (await p.$$('[data-wxagain]')).length === 1);
  forecast = { current: { temperature_2m: 3 }, daily: { weather_code: [0], temperature_2m_max: [6], temperature_2m_min: [-1],
    precipitation_probability_max: [0], wind_speed_10m_max: [4] } };
  await p.click('[data-wxagain]'); await settle(1000);
  x = await wx();
  ok('Try again fetches it afresh', x && /Clear sky, -1° to 6°/.test(x.text) && /0% chance of rain/.test(x.text), x && x.text);
  ok('  and the warning goes', await ev(() => !/Could not get/.test($('briefWeather').textContent)));
  await closeAll();
  // Switched off in Settings
  await ev(() => openSettings('Home screen')); await settle(400);
  await ev(() => document.querySelectorAll('[data-setcard="hometiles"]').forEach(d => d.open = true)); await settle(200);
  ok('Settings > Home screen has the switch, on', await ev(() => $('wxOn') && $('wxOn').checked));
  await clear();
  await p.click('#wxOn'); await settle(500);
  w = await writes('update', 'profiles');
  ok('switching it off is saved with your home screen choices', w.some(x => x.patch.home_tiles && x.patch.home_tiles.wxoff === true));
  await closeAll();
  await ev(() => openBrief()); await settle(500);
  ok('then Today has no weather', !(await p.$('#briefWeather')));
  await ev(() => { WX_OFF = false; }); await closeAll();
  // A phone that will not say where it is
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.route('https://api.open-meteo.com/**', r => r.abort());
  await p2.goto('file://' + path.join(__dirname, 'boot.html')); await p2.waitForTimeout(900);
  await p2.evaluate(() => { try { localStorage.removeItem('weather'); } catch (e) {} openBrief(); }); await p2.waitForTimeout(1200);
  ok('with location refused, it says how to allow it rather than going blank',
    await p2.evaluate(() => /needs this phone.s location/.test(($('briefWeather') || {}).textContent || '')),
    await p2.evaluate(() => ($('briefWeather') || {}).textContent));
  await ctx2.close();

  // ---------------------------------------------------------------
  console.log('\nHold and slide instead of arrows (ML177)');
  await ev(() => {
    window.__rows.groups = [{ id: 1, name: 'Family', sort_order: 10, owner_id: null },
      { id: 2, name: 'Friend', sort_order: 20, owner_id: null }, { id: 3, name: 'Marina', sort_order: 30, owner_id: 'me' }];
    window.__rows.statuses = [{ id: 1, name: 'Married', sort_order: 10 }, { id: 2, name: 'Partner', sort_order: 20 },
      { id: 3, name: 'Single', sort_order: 30 }];
    window.__rows.log_options = [{ id: 1, kind: 'medication', name: 'Aspirin', sort_order: 10, created_by: 'me' },
      { id: 2, kind: 'medication', name: 'Statin', sort_order: 20, created_by: 'me' },
      { id: 3, kind: 'medication', name: 'Vitamin D', sort_order: 30, created_by: 'me' }];
    window.__rows.log_cats = [{ id: 1, label: 'Garden', sort_order: 10, created_by: 'me' },
      { id: 2, label: 'Fishing', sort_order: 20, created_by: 'me' }];
    window.__rows.log_fields = [{ id: 1, cat_id: 1, label: 'Watered', kind: 'yesno', sort_order: 10, created_by: 'me' },
      { id: 2, cat_id: 1, label: 'Mown', kind: 'yesno', sort_order: 20, created_by: 'me' },
      { id: 3, cat_id: 1, label: 'Notes', kind: 'note', sort_order: 30, created_by: 'me' }];
    MY_PROFILE.group_order = null; MY_PROFILE.settings_order = null;
  });
  await ev(async () => { await loadAll(); await loadLog(); SET_OPEN = {}; await openSettings(); }); await settle(600);
  ok('no up and down arrows anywhere in Settings', await ev(() => !document.querySelector('#setBody .mv,[data-setmv],[data-mv],[data-secmv],[data-catmv],[data-optmv],[data-lvmv],[data-amv]')));
  ok('a grip on every card heading', await ev(() => [...document.querySelectorAll('#setBody [data-setcard]')]
    .every(d => d.querySelector(':scope > summary .grip'))));
  const open = k => ev(k => document.querySelectorAll(`[data-setcard="${k}"]`).forEach(d => d.open = true), k);
  await open('groups');
  ok('and on every group', (await p.$$('[data-hm^="row:groups:"] > .grip')).length === 3);
  ok('a long press will not select the words', await ev(() =>
    getComputedStyle(document.querySelector('[data-hm="row:groups:2"]')).userSelect === 'none'));
  ok('but the name box can still be typed and selected in', await ev(() =>
    getComputedStyle(document.querySelector('[data-hm="row:groups:2"] input')).userSelect !== 'none'));

  await clear();
  await holdSlide(p, '[data-hm="row:groups:1"]', '[data-hm="row:groups:2"]');
  w = await writes('update', 'profiles');
  ok('a group held and slid down is saved in your own order',
    w.some(x => JSON.stringify(x.patch.group_order) === '[2,1,3]'), JSON.stringify(w.map(x => x.patch)));
  ok('nothing is left lifted', await ev(() => !document.querySelector('.lifted') && !document.body.classList.contains('jobdrag')));
  await ev(() => { MY_PROFILE.group_order = [2, 1, 3]; });

  await open('statuses'); await clear();
  await holdSlide(p, '[data-hm="row:statuses:3"]', '[data-hm="row:statuses:1"]', { below: false });
  w = await writes('update', 'statuses');
  const num = ws => Object.fromEntries(ws.map(x => [x.where.find(c => c[1] === 'id')[2], x.patch.sort_order]));
  ok('a status slid to the top: the list is numbered afresh in tens',
    JSON.stringify(num(w)) === JSON.stringify({ 3: 10, 1: 20, 2: 30 }), JSON.stringify(num(w)));

  await open('medication'); await clear();
  await holdSlide(p, '[data-hm="opt:medication:1"]', '[data-hm="opt:medication:3"]');
  w = await writes('update', 'log_options');
  ok('medication choices move the same way', JSON.stringify(num(w)) === JSON.stringify({ 2: 10, 3: 20, 1: 30 }), JSON.stringify(num(w)));

  await open('logsections'); await clear();
  const secs = await ev(() => [...document.querySelectorAll('[data-hm^="sec:"]')].map(e => e.dataset.hm.slice(4)));
  await holdSlide(p, `[data-hm="sec:${secs[0]}"]`, `[data-hm="sec:${secs[1]}"]`);
  w = await writes('update', 'profiles');
  const ls = w.map(x => x.patch.log_sections).find(Boolean);
  ok('Daily Log sections too', ls && ls[0].id === secs[1] && ls[1].id === secs[0] && ls.length === secs.length,
    JSON.stringify(ls && ls.slice(0, 3)));

  await open('logcats'); await clear();
  await holdSlide(p, '[data-hm="cat:2"]', '[data-hm="cat:1"]', { below: false });
  w = await writes('update', 'log_cats');
  ok('your own sections too', JSON.stringify(num(w)) === JSON.stringify({ 2: 10, 1: 20 }), JSON.stringify(num(w)));

  // What to fill in under a heading, in its own box
  await open('logcats');
  await p.click('[data-catopen="1"]'); await settle(400); await clear();
  await holdSlide(p, '.daypick [data-hm="fld:3"]', '.daypick [data-hm="fld:1"]', { below: false });
  w = await writes('update', 'log_fields');
  ok('and the boxes to fill in under one', JSON.stringify(num(w)) === JSON.stringify({ 3: 10, 1: 20, 2: 30 }), JSON.stringify(num(w)));
  await ev(() => document.querySelectorAll('.daypick').forEach(d => d.remove()));

  // The cards themselves, by their headings
  await ev(async () => { await loadAll(); await loadLog(); SET_OPEN = {}; await openSettings(); }); await settle(500);
  await clear();
  await holdSlide(p, '[data-setcard="groups"]', '[data-setcard="statuses"]');
  w = await writes('update', 'profiles');
  const so = w.map(x => x.patch.settings_order).find(Boolean);
  ok('a card held by its heading and slid down is saved', so && so.indexOf('groups') === so.indexOf('statuses') + 1,
    JSON.stringify(so && so.slice(0, 5)));
  ok('  and letting go does not open it', await ev(() => !document.querySelector('[data-setcard="groups"]').open));
  await ev(o => { MY_PROFILE.settings_order = o; }, so);
  await ev(async () => openSettings()); await settle(400);
  await clear();
  // It cannot leave its own screen's heading
  await holdSlide(p, '[data-setcard="shareall"]', '[data-setcard="logsections"]');
  w = await writes('update', 'profiles');
  const so2 = w.map(x => x.patch.settings_order).find(Boolean);
  ok('a card stays under its own heading', !so2 || so2.indexOf('shareall') < so2.indexOf('logsections'),
    JSON.stringify(so2));
  await ev(async () => { MY_PROFILE.settings_order = null; await openSettings(); }); await settle(400);

  // A quick tap, a swipe and a typing box are left alone
  await clear();
  const g = await p.$eval('[data-setcard="statuses"] > summary', e => { e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; });
  await p.mouse.click(g.x, g.y); await settle(300);
  ok('a quick tap on a card heading still opens it', await ev(() => document.querySelector('[data-setcard="statuses"]').open));
  ok('  and moves nothing', (await writes('update', 'profiles')).length === 0);
  await open('groups'); await clear();
  const r2 = await p.$eval('[data-hm="row:groups:3"] > .grip', e => { e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height / 2 }; });
  await p.mouse.move(r2.x, r2.y); await p.mouse.down();
  await p.mouse.move(r2.x, r2.y - 80, { steps: 4 }); await settle(700);
  ok('moving straight away does not lift it', await ev(() => !document.querySelector('.lifted')));
  await p.mouse.up(); await settle(300);
  const r3 = await p.$eval('[data-hm="row:groups:3"] input', e => { const r = e.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  await p.mouse.move(r3.x, r3.y); await p.mouse.down(); await settle(700);
  ok('holding the name box does not lift it', await ev(() => !document.querySelector('.lifted')));
  await p.mouse.up(); await settle(300);
  ok('none of that saved anything', (await writes('update', 'profiles')).length === 0
    && (await writes('update', 'groups')).length === 0);
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nRecipes: the week’s menu (ML180)');
  const dayN = n => ev(n => menuDays()[n], n);
  await ev(() => {
    const r = (id, title, cats, by = 'me') => ({ id, created_by: by, title, categories: cats, ingredients: [],
      prep_steps: [], cook_steps: [], photos: [], share_all: true, to_try: false, created_at: '2026-10-0' + (id % 9) + 'T10:00:00Z' });
    window.__rows.recipes = [Object.assign(r(1, 'Shepherd’s pie', ['Mains']), { photos: [{ path: 'rec/me/pie.jpg' }], prep_mins: 20, cook_mins: 45 }),
      r(2, 'Porridge', ['Breakfast']),
      r(3, 'Leek and potato soup', ['Soups']), r(4, 'Apple crumble', ['Puddings'])];
    window.__rows.meal_plan = []; window.__rows.meal_shares = [];
    RCP_LOADED = false; MENU_LOADED = false; MENU_OF = '';
  });
  await ev(() => openRecipes()); await settle(600);
  ok('Recipes has a Week’s menu button', !!(await p.$('#rcpWeek')));
  await p.click('#rcpWeek'); await settle(600);
  ok('it opens the menu', await ev(() => !$('weekMenu').classList.contains('hidden')));
  ok('seven days, starting today', await ev(() => {
    const h = [...$('wmBody').querySelectorAll('p.dsec')].map(x => x.textContent);
    return h.length === 8 && /^Today/.test(h[0]) && /^Tomorrow/.test(h[1]) && /Who else/.test(h[7]); }));
  ok('breakfast, lunch and dinner each day, all empty', await ev(() =>
    $('wmBody').querySelectorAll('[data-wm]').length === 21
    && $('wmBody').querySelectorAll('.wmpick .wmnone').length === 21));
  ok('an empty meal row is a sensible height, the meal’s name just above', await ev(() => {
    const row = document.querySelector('.wmrow'), r = row.getBoundingClientRect();
    const n = row.querySelector('.wmmeal').getBoundingClientRect(), b = row.querySelector('.wmpick').getBoundingClientRect();
    return r.height < 90 && b.top - n.bottom < 12; }),
    JSON.stringify(await ev(() => document.querySelector('.wmrow').getBoundingClientRect().height)));
  ok('in that order', await ev(() => [...$('wmBody').querySelectorAll('.card')][0].textContent.replace(/\s+/g, ' ')
    .match(/Breakfast.*Lunch.*Dinner/)));
  ok('the day goes by Today’s day (turning over at four)', await dayN(0) === today);

  await p.click(`[data-wm="${today}|breakfast"]`); await settle(300);
  ok('tapping breakfast asks what it is', await ev(() => /^Breakfast, /.test(document.querySelector('.daypick p.dsec').textContent)));
  const listed = await ev(() => [...document.querySelectorAll('[data-wmpick]')].map(b => +b.dataset.wmpick));
  ok('every recipe, the breakfast ones first', listed[0] === 2 && listed.length === 4, JSON.stringify(listed));
  await p.fill('#wmQ', 'leek'); await settle(200);
  ok('the cookbook can be searched', JSON.stringify(await ev(() => [...document.querySelectorAll('[data-wmpick]')].map(b => +b.dataset.wmpick))) === '[3]');
  await p.fill('#wmQ', ''); await settle(100);
  await clear();
  await ev(() => { const f = window.supabase; });
  await p.click('[data-wmpick="2"]'); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.op === 'upsert' && x.table === 'meal_plan'));
  ok('picking one saves it for that day and meal, on your menu',
    w.length === 1 && w[0].rows.owner_id === 'me' && w[0].rows.on_date === today && w[0].rows.meal === 'breakfast'
    && w[0].rows.recipe_id === 2 && w[0].rows.title === 'Porridge', JSON.stringify(w.map(x => x.rows)));
  ok('  and the box closes', !(await p.$('.daypick')));

  const tom = await dayN(1);
  await p.click(`[data-wm="${tom}|lunch"]`); await settle(300); await clear();
  await p.fill('#wmWords', '  Out  '); await p.click('#wmUse'); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.op === 'upsert' && x.table === 'meal_plan'));
  ok('or a few words typed in', w.length === 1 && w[0].rows.title === 'Out' && w[0].rows.recipe_id === null
    && w[0].rows.on_date === tom && w[0].rows.meal === 'lunch', JSON.stringify(w.map(x => x.rows)));

  // What the database now holds
  await ev(([t, m]) => { window.__rows.meal_plan = [
    { owner_id: 'me', on_date: t, meal: 'breakfast', recipe_id: 2, title: 'Porridge' },
    { owner_id: 'me', on_date: t, meal: 'dinner', recipe_id: 1, title: 'Shepherd’s pie' },
    { owner_id: 'me', on_date: m, meal: 'lunch', recipe_id: null, title: 'Out' }]; }, [today, tom]);
  await ev(async () => { await loadMenu(); renderWeekMenu(); }); await settle(300);
  ok('the menu shows what is planned', await ev(t => document.querySelector(`[data-wm="${t}|breakfast"] .rcpwhat b`).textContent === 'Porridge', today));
  ok('a planned recipe shows its photo, categories and times, as on the Recipes list', await ev(t => {
    const b = document.querySelector(`[data-wm="${t}|dinner"]`);
    return /pie\.jpg$/.test(b.querySelector('img').src) && /Mains/.test(b.textContent) && /20|45|1 hr|65/.test(b.textContent); }, today));
  ok('one with no photo has the plate in its place', await ev(t =>
    !!document.querySelector(`[data-wm="${t}|breakfast"] .rcpnopic`), today));
  ok('words typed in show as they are, with no photo', await ev(t => {
    const b = document.querySelector(`[data-wm="${t}|lunch"]`);
    return b.textContent.trim() === 'Out' && !b.querySelector('img,.rcpnopic'); }, tom));
  ok('a meal with a photo is still a sensible height', await ev(t =>
    document.querySelector(`[data-wm="${t}|dinner"]`).closest('.wmrow').getBoundingClientRect().height < 120, today));
  ok('a planned recipe can be opened', !!(await p.$('[data-wmrec="2"]')) && !(await p.$('[data-wmrec="0"]')));
  await p.click(`[data-wm="${tom}|lunch"]`); await settle(300);
  ok('typed words come back in the box to change', await ev(() => $('wmWords').value === 'Out'));
  await clear();
  await p.click('#wmClear'); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.table === 'meal_plan'));
  ok('Leave it empty takes it off', w.length === 1 && w[0].op === 'delete'
    && JSON.stringify(w[0].where) === JSON.stringify([['eq', 'owner_id', 'me'], ['eq', 'on_date', tom], ['eq', 'meal', 'lunch']]),
    JSON.stringify(w));
  await ev(() => document.querySelectorAll('.daypick').forEach(d => d.remove()));

  // Sharing
  await clear();
  await p.check('[data-wmshare="sandra"]'); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.table === 'meal_shares'));
  ok('ticking Sandra shares your menu with her', w.length === 1 && w[0].op === 'insert'
    && w[0].rows.owner_id === 'me' && w[0].rows.viewer_id === 'sandra', JSON.stringify(w));
  await ev(() => { window.__rows.meal_shares = [{ owner_id: 'me', viewer_id: 'sandra' }]; });
  await ev(async () => { await loadMenu(); renderWeekMenu(); }); await settle(200);
  await clear();
  await p.uncheck('[data-wmshare="sandra"]'); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.table === 'meal_shares'));
  ok('unticking stops it', w.length === 1 && w[0].op === 'delete', JSON.stringify(w));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nToday’s Menu on Today (ML180)');
  await ev(() => { window.__rows.meal_shares = []; RCP_PREFS.today = true; MENU_AT = 0; });
  await ev(() => openBrief()); await settle(900);
  const tm = () => ev(() => { const s = $('briefRecipe'); return s ? s.textContent.replace(/\u{1F37D}/gu, ' ').replace(/\s+/g, ' ').trim() : ''; });
  let t = await tm();
  ok('Today’s Menu shows the meals planned', /Today’s Menu/.test(t) && /Breakfast Porridge/.test(t) && /Dinner Shepherd’s pie/.test(t), t);
  ok('no Lunch line when no lunch is planned', !/Lunch/.test(t), t);
  ok('no Tonight’s idea when dinner is planned', !/Tonight’s idea/.test(t), t);
  ok('it sits where Tonight’s idea was, after the ASAP list', await ev(() => {
    const kids = [...$('briefBody').children];
    return kids.indexOf($('briefRecipe')) > kids.findIndex(k => k.matches('p.dsec') && /ASAP/.test(k.textContent)); }));
  ok('a recipe on Today’s Menu looks as it does on the Recipes list: photo, name, categories and times',
    /Dinner Shepherd’s pie Mains · Prep 20 mins, Cook 45 mins/.test(t)
    && await ev(() => { const i = document.querySelector('#briefRecipe [data-briefmeal="1"] img'); return !!i && /pie\.jpg/.test(i.src); }), t);
  ok('  and one without a photo gets the plate', await ev(() => !!document.querySelector('#briefRecipe [data-briefmeal="2"] .rcpnopic')));
  ok('  each meal a neat row, the photo beside the name',
    await ev(() => [...document.querySelectorAll('#briefRecipe .wmrow')].every(row => {
      const h = row.getBoundingClientRect().height, im = row.querySelector('img,.rcpnopic'), w = row.querySelector('.rcpwhat');
      const a = im.getBoundingClientRect(), b = w.getBoundingClientRect();
      return h < 120 && a.width > 50 && a.width < 80 && b.left > a.right && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 20; })),
    JSON.stringify(await ev(() => [...document.querySelectorAll('#briefRecipe .wmrow')].map(r => r.getBoundingClientRect().height))));
  await p.click('[data-briefmeal="1"]'); await settle(800);
  ok('tapping a planned recipe opens it', await ev(() => !$('recipe').classList.contains('hidden') && RCP_CUR === 1));
  await closeAll();

  await ev(t => { window.__rows.meal_plan = [{ owner_id: 'me', on_date: t, meal: 'lunch', recipe_id: null, title: 'Sandwiches' }];
    MENU_AT = 0; }, today);
  await ev(() => openBrief()); await settle(900);
  t = await tm();
  ok('with no dinner planned, Tonight’s idea still shows under the menu',
    /Today’s Menu.*Lunch Sandwiches.*Tonight’s idea/.test(t), t);
  ok('  and words typed in are not a link', (await p.$$('#briefRecipe [data-briefmeal]')).length === 0);
  await closeAll();

  // Tonight's idea off and the cookbook not yet opened: the menu still fetches it for the photos.
  await ev(([t]) => { window.__rows.meal_plan = [{ owner_id: 'me', on_date: t, meal: 'dinner', recipe_id: 1, title: 'Shepherd’s pie' }];
    RCP_PREFS.today = false; RCP_LOADED = false; RECIPES = []; MENU_AT = 0; }, [today]);
  await ev(() => openBrief()); await settle(1200);
  t = await tm();
  ok('the photo and details show even before the Recipes screen has been opened',
    /Dinner Shepherd’s pie Mains · Prep 20 mins/.test(t) && !/Not in the cookbook/.test(t)
    && await ev(() => !!document.querySelector('#briefRecipe [data-briefmeal="1"] img')), t);
  await closeAll();
  await ev(() => { RCP_PREFS.today = true; });

  await ev(() => { window.__rows.meal_plan = []; MENU_AT = 0; });
  await ev(() => openBrief()); await settle(900);
  t = await tm();
  ok('nothing planned: no Today’s Menu heading, just Tonight’s idea', !/Today’s Menu/.test(t) && /Tonight’s idea/.test(t), t);
  await closeAll();

  // Somebody else's menu, shared with you
  await ev(t => { window.__rows.meal_shares = [{ owner_id: 'sandra', viewer_id: 'me' }];
    window.__rows.meal_plan = [{ owner_id: 'sandra', on_date: t, meal: 'dinner', recipe_id: 3, title: 'Leek and potato soup' }];
    MENU_AT = 0; MENU_OF = ''; }, today);
  await ev(() => openBrief()); await settle(900);
  t = await tm();
  ok('with nothing of your own, the menu shared with you shows on Today', /Dinner Leek and potato soup/.test(t), t);
  await closeAll();
  await ev(() => openWeekMenu()); await settle(600);
  ok('the menu has buttons for yours and hers', await ev(() =>
    [...document.querySelectorAll('[data-wmof]')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join('|') === 'Mine:false|Sandra’s:true'));
  ok('it says it is hers, shared with you', await ev(() => /This is Sandra’s menu, shared with you/.test($('wmBody').textContent.replace(/\s+/g, ' '))));
  ok('and only the owner chooses who sees it', !(await p.$('[data-wmshare]')));
  await p.click(`[data-wm="${today}|breakfast"]`); await settle(300); await clear();
  await p.click('[data-wmpick="2"]'); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.op === 'upsert' && x.table === 'meal_plan'));
  ok('what you plan on hers goes on hers', w.length === 1 && w[0].rows.owner_id === 'sandra' && w[0].rows.updated_by === 'me',
    JSON.stringify(w.map(x => x.rows)));
  await clear();
  await p.click('[data-wmof="me"]'); await settle(500);
  w = await writes('update', 'profiles');
  ok('choosing Mine is remembered with your home screen choices', w.some(x => x.patch.home_tiles && x.patch.home_tiles.menuof === 'me'));
  ok('  and shows your own', await ev(() => document.querySelector('[data-wmof="me"]').getAttribute('aria-pressed') === 'true'
    && !!document.querySelector('[data-wmshare]')));
  await closeAll();

  // Before step 55
  await ev(() => {
    window.__from = window.__from || sb.from.bind(sb);
    const from = window.__from;
    const no = { data: null, error: { message: 'relation "public.meal_plan" does not exist' } };
    sb.from = t => t === 'meal_plan' ? { select: () => ({ gte: () => ({ lte: () => Promise.resolve(no) }) }),
      upsert: () => Promise.resolve(no), delete: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve(no) }) }) }) } : from(t);
    MENU_AT = 0; MENU_LOADED = false;
  });
  await ev(() => openWeekMenu()); await settle(600);
  ok('before step 55 the menu says to run it, not an empty week', await ev(() =>
    /Run the step 55 file in Supabase/.test($('wmBody').textContent) && !document.querySelector('[data-wm]')));
  await closeAll();
  await ev(() => openBrief()); await settle(800);
  t = await tm();
  ok('  and Today just shows Tonight’s idea', /Tonight’s idea/.test(t) && !/Today’s Menu/.test(t), t);
  await ev(() => { sb.from = window.__from; }); await closeAll();

  // ---------------------------------------------------------------
  console.log('\nThe backup, the Help');
  ok('the backup inside the app takes both new tables', await ev(() =>
    /from meal_plan t/.test(BACKUP_SQL_1) && /from meal_shares t/.test(BACKUP_SQL_1)));
  await ev(() => openHelp()); await settle(300);
  const help = await ev(() => $('helpBody').textContent.replace(/\s+/g, ' '));
  ok('the Help explains the week’s menu', /Week’s menu, at the top of Recipes/.test(help));
  ok('the Help explains the weather', /the weather for wherever the phone is/.test(help));
  ok('the Help says to hold and slide, not arrows', /hold one still for a moment/.test(help)
    && !/small arrows to reorder/.test(help) && !/The arrows move an aisle/.test(help));
  await closeAll();

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo errors anywhere');
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
