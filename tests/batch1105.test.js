// The 5 Nov 2026 batch: Help in boxes with a search (ML188), an × to take a
// meal off the week's menu (ML189), a ★ for the menu Today shows, also in
// Settings > Home screen (ML190), the Bluesky name box back under its words
// (ML191), and anything tapped on Today opening over it, so Back comes back
// to Today (ML192).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo/i;

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
  const shown = id => ev(id => !document.getElementById(id).classList.contains('hidden'), id);
  const top = () => ev(() => SHEET_STACK[SHEET_STACK.length - 1]);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); lockBackground(); });
  const writes = (op, table) => ev(([op, table]) => window.__writes.filter(w => w.op === op && w.table === table), [op, table]);
  const clear = () => ev(() => { window.__writes.length = 0; });
  const today = await ev(() => briefDay());
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nHelp: a box for each part, and a search (ML188)');
  await ev(() => openHelp('home')); await settle(400);
  const heads = await ev(() => $('helpBody').querySelectorAll('h4').length);
  ok('every heading sits in a box of its own', heads > 30 && await ev(() =>
    [...$('helpBody').querySelectorAll('h4')].every(h => h.parentElement.classList.contains('helpbox')
      && h.parentElement.firstElementChild === h)) && await ev(() => $('helpBody').querySelectorAll('.helpbox').length) === heads, heads);
  ok('the words stay with their heading', await ev(() => /Every part of the app has a tile/.test(document.getElementById('h-home').parentElement.textContent)));
  ok('the opening line is not in a box', await ev(() => !document.querySelector('.helpsec > .lead').closest('.helpbox')));
  const look = await ev(() => { const x = document.querySelector('.helpbox'), h = x.querySelector('h4');
    const cs = getComputedStyle(x), hs = getComputedStyle(h), page = getComputedStyle($('helpBody')).backgroundColor;
    const pg = getComputedStyle($('help')).backgroundColor;
    return { bg: cs.backgroundColor, page: pg, border: cs.borderTopWidth + ' ' + cs.borderTopStyle,
      radius: cs.borderTopLeftRadius, weight: hs.fontWeight, size: parseFloat(hs.fontSize),
      lum: [cs.backgroundColor, pg].map(c => c.match(/\d+/g).slice(0, 3).reduce((a, n) => a + Number(n), 0)) }; });
  // 1.5px is drawn as 1px on a laptop screen and in full on a phone's.
  ok('each box has a border and round corners', /^1(\.5)?px solid$/.test(look.border) && parseFloat(look.radius) > 0, JSON.stringify(look));
  ok('the phone’s own × in the search box is hidden (there is ours)', await ev(() =>
    [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /helpfind input::-webkit-search-cancel-button/.test(r.cssText) && /display: none/.test(r.cssText)); } catch (e) { return false; } })));
  ok('  and a background a shade darker than the page', look.lum[0] < look.lum[1] && look.lum[1] - look.lum[0] < 60, JSON.stringify(look));
  ok('the headings are bolder and bigger', Number(look.weight) >= 700 && look.size >= 18, JSON.stringify(look));
  ok('opened from somewhere, it goes to that part’s box', await ev(() => {
    const bx = document.getElementById('h-home').closest('.helpbox').getBoundingClientRect();
    const f = document.querySelector('.helpfind').getBoundingClientRect();
    return bx.top >= f.bottom - 2 && bx.top < f.bottom + 40; }),
    JSON.stringify(await ev(() => [document.getElementById('h-home').closest('.helpbox').getBoundingClientRect().top,
      document.querySelector('.helpfind').getBoundingClientRect().bottom])));
  ok('the search box is at the top', !!(await p.$('#helpQ')) && await ev(() =>
    $('helpBody').firstElementChild.classList.contains('helpfind')));
  ok('  and it stays in view when you scroll', await ev(() => {
    $('helpBody').scrollTop = 4000; const f = document.querySelector('.helpfind').getBoundingClientRect();
    const bar = document.querySelector('#help .sheetbar').getBoundingClientRect();
    return f.top >= bar.bottom - 1 && f.top < bar.bottom + 4; }));
  ok('no × until something is typed', await ev(() => $('helpX').classList.contains('hidden')));

  await p.fill('#helpQ', 'firefox'); await settle(200);
  const vis = () => ev(() => [...document.querySelectorAll('.helpbox')].filter(x => !x.classList.contains('hidden'))
    .map(x => x.querySelector('h4').textContent.trim()));
  let v = await vis();
  ok('typing keeps only the parts that mention it', v.length >= 1 && v.length < 5 && v.includes('URL Links'), v.join(' | '));
  ok('  every one left does mention it', await ev(() => [...document.querySelectorAll('.helpbox:not(.hidden)')]
    .every(x => /firefox/i.test(x.textContent))));
  ok('  the word is marked in yellow', await ev(() => {
    const m = document.querySelectorAll('.helpbox:not(.hidden) mark.hm');
    return m.length > 0 && [...m].every(x => /^firefox$/i.test(x.textContent)); }));
  ok('  it says how many', await ev(() => /parts? of Help mentions? that/.test($('helpSaid').textContent)), await ev(() => $('helpSaid').textContent));
  ok('  the × shows', await ev(() => !$('helpX').classList.contains('hidden')));
  ok('  the opening line steps aside', await ev(() => document.querySelector('.helpsec > .lead').classList.contains('hidden')));

  await p.fill('#helpQ', 'week’s menu'); await settle(200);
  v = await vis();
  ok('two words: both must be there', v.includes('Recipes') && v.includes('Today'), v.join(' | '));
  await p.fill('#helpQ', "week's menu"); await settle(200);
  ok('  an ordinary apostrophe finds the curly one', (await vis()).includes('Recipes'), (await vis()).join(' | '));
  ok('  and marks it', await ev(() => [...document.querySelectorAll('mark.hm')].some(m => /^week[’']s$/i.test(m.textContent))));
  await p.fill('#helpQ', 'Firefox'); await settle(200);
  ok('changing the search moves the marks with it', await ev(() =>
    ![...document.querySelectorAll('mark.hm')].some(m => /week|menu/i.test(m.textContent))));

  await p.fill('#helpQ', 'zzqx'); await settle(200);
  ok('nothing found: says so, and no boxes', (await vis()).length === 0
    && await ev(() => /Nothing in Help mentions that/.test($('helpSaid').textContent)));
  await p.click('#helpX'); await settle(200);
  ok('the × empties it and every part comes back', (await vis()).length === heads
    && await ev(() => $('helpQ').value === '' && $('helpSaid').classList.contains('hidden')
      && !document.querySelector('.helpsec > .lead').classList.contains('hidden')));
  ok('  with no marks left behind', await ev(() => !document.querySelector('mark.hm')));
  ok('  and the words just as they were', await ev(() =>
    /the arrow at the left of the top bar brings you straight back here/.test(document.getElementById('h-home').parentElement.textContent.replace(/\s+/g, ' '))));
  await p.fill('#helpQ', 'start link'); await settle(200);
  ok('buttons inside Help still work after a search', await ev(() => { const c = $('copyStart'); return !c || typeof c.onclick === 'function'; }));
  ok('Help explains the new things', await ev(() => { const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    return /Today stays open underneath, so Back, Cancel or the arrow brings you back to Today/.test(t)
      && /on a planned meal takes it off the menu \(it asks first\)/.test(t)
      && /marks the one Today shows/.test(t); }));
  await closeAll();
  await ev(() => openHelp('recipes')); await settle(300);
  ok('opening Help again starts with an empty search', await ev(() => $('helpQ').value === '' && !document.querySelector('.helpbox.hidden')));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nSettings > Home screen: the Bluesky name with its words (ML191)');
  await ev(() => { window.__rows.meal_shares = []; window.__rows.meal_plan = []; MENU_LOADED = false; MENU_OF = ''; });
  await ev(() => openSettings('Home screen')); await settle(500);
  await ev(() => document.querySelectorAll('[data-setcard="hometiles"]').forEach(d => d.open = true)); await settle(200);
  const order = await ev(() => {
    const card = document.querySelector('[data-setcard="hometiles"]');
    const at = sel => { const el = card.querySelector(sel); return el ? [...card.querySelectorAll('*')].indexOf(el) : -1; };
    const words = re => { const d = [...card.querySelectorAll('.field dd')].find(x => re.test(x.textContent)); return d ? [...card.querySelectorAll('*')].indexOf(d) : -1; };
    return { bskyWords: words(/A Bluesky photo/), bskyOn: at('#bskyOn'), name: at('#bskyName'), save: at('#bskySave'),
      wxWords: words(/The weather/), wxOn: at('#wxOn'), menuWords: words(/Today’s Menu/), idea: words(/Tonight’s idea/), rcp: at('#rcpTodayOn') }; });
  ok('Bluesky words, its tick box, then the name box and Save, together',
    order.bskyWords > -1 && order.bskyWords < order.bskyOn && order.bskyOn < order.name && order.name < order.save
    && order.save < order.wxWords, JSON.stringify(order));
  ok('then the weather', order.wxWords < order.wxOn, JSON.stringify(order));
  ok('then Today’s Menu and Tonight’s idea, last', order.wxOn < order.menuWords && order.menuWords < order.idea && order.idea < order.rcp, JSON.stringify(order));
  ok('nothing about recipes between the Bluesky words and the name box', await ev(() => {
    const card = document.querySelector('[data-setcard="hometiles"]');
    const all = [...card.querySelectorAll('*')], a = all.indexOf(card.querySelector('#bskyOn')), z = all.indexOf(card.querySelector('#bskyName'));
    return !all.slice(a, z).some(e => /recipe|Tonight/i.test(e.textContent) && e.children.length === 0); }));

  // ---------------------------------------------------------------
  console.log('\nWhose menu Today shows, and the ★ (ML190)');
  ok('with no menu shared with you, it says one can be chosen once there is', await ev(() =>
    /When someone shares their week’s menu with you/.test(document.querySelector('[data-setcard="hometiles"]').textContent)
    && !document.querySelector('[data-menustar]')));
  await closeAll();

  await ev(() => {
    const r = (id, title, cats) => ({ id, created_by: 'me', title, categories: cats, ingredients: [],
      prep_steps: [], cook_steps: [], photos: [], share_all: true, to_try: false, created_at: '2026-10-0' + id + 'T10:00:00Z' });
    window.__rows.recipes = [r(1, 'Shepherd’s pie', ['Mains']), r(2, 'Porridge', ['Breakfast']), r(3, 'Leek and potato soup', ['Soups'])];
    window.__rows.meal_shares = [{ owner_id: 'sandra', viewer_id: 'me' }];
    window.__rows.meal_plan = [
      { owner_id: 'me', on_date: briefDay(), meal: 'breakfast', recipe_id: 2, title: 'Porridge' },
      { owner_id: 'sandra', on_date: briefDay(), meal: 'dinner', recipe_id: 3, title: 'Leek and potato soup' }];
    RCP_LOADED = false; MENU_LOADED = false; MENU_AT = 0; MENU_OF = '';
  });
  await ev(() => openSettings('Home screen')); await settle(500);
  await ev(() => document.querySelectorAll('[data-setcard="hometiles"]').forEach(d => d.open = true)); await settle(200);
  const stars = () => ev(() => [...document.querySelectorAll('[data-menustar]')].map(b => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')).join('|'));
  ok('Settings lists yours and hers, the ★ on the one Today shows', await stars() === '★ Mine:true|☆ Sandra’s:false', await stars());
  await clear();
  await p.click('[data-menustar="sandra"]'); await settle(600);
  let w = await writes('update', 'profiles');
  ok('tapping hers makes it Today’s, kept with your home screen choices',
    w.some(x => x.patch.home_tiles && x.patch.home_tiles.menuof === 'sandra'), JSON.stringify(w.map(x => x.patch.home_tiles && x.patch.home_tiles.menuof)));
  ok('  and the ★ moves', await stars() === '☆ Mine:false|★ Sandra’s:true', await stars());
  ok('  Settings stays open where it was', await shown('settings') && await ev(() =>
    document.querySelector('[data-setcard="hometiles"]').open));
  await closeAll();
  await ev(() => { MENU_AT = 0; openBrief(); }); await settle(900);
  const tm = () => ev(() => { const s = $('briefRecipe'); return s ? s.textContent.replace(/\u{1F37D}/gu, ' ').replace(/\s+/g, ' ').trim() : ''; });
  ok('Today shows her menu', /Dinner Leek and potato soup/.test(await tm()) && !/Porridge/.test(await tm()), await tm());
  await closeAll();

  await ev(() => openWeekMenu()); await settle(600);
  const chips = () => ev(() => [...document.querySelectorAll('.wmone')].map(o =>
    o.querySelector('[data-wmof]').textContent + (o.querySelector('[data-wmof]').getAttribute('aria-pressed') === 'true' ? '(seen)' : '')
    + o.querySelector('.wmstar').textContent).join('|'));
  ok('the Week’s menu opens on the starred one, a ★ beside it and a ☆ beside yours', await chips() === 'Mine☆|Sandra’s(seen)★', await chips());
  ok('  and says what the star is for', await ev(() => /★ is the menu Today shows/.test($('wmBody').textContent)));
  await clear();
  await p.click('[data-wmof="me"]'); await settle(400);
  ok('tapping Mine shows yours', await chips() === 'Mine(seen)☆|Sandra’s★', await chips());
  ok('  without moving the star or saving anything', (await writes('update', 'profiles')).length === 0);
  await p.click('[data-wmstar="me"]'); await settle(600);
  w = await writes('update', 'profiles');
  ok('tapping the ☆ by Mine makes yours Today’s', w.some(x => x.patch.home_tiles && x.patch.home_tiles.menuof === 'me')
    && await chips() === 'Mine(seen)★|Sandra’s☆', await chips());
  await clear();
  await p.click('[data-wmstar="me"]'); await settle(300);
  ok('  tapping the ★ again changes nothing', (await writes('update', 'profiles')).length === 0);
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nThe week’s menu: × takes a meal off (ML189)');
  await ev(() => { MENU_OF = 'me'; }); await ev(() => openWeekMenu()); await settle(600);
  ok('a planned meal has an ×', !!(await p.$(`[data-wmdrop="${today}|breakfast"]`)));
  ok('an empty one has none', !(await p.$(`[data-wmdrop="${today}|lunch"]`)) && await ev(() =>
    document.querySelectorAll('[data-wmdrop]').length === 1));
  ok('the line above the days mentions it', await ev(() => /tap × to take one off/.test($('wmBody').textContent)));
  ok('the × sits at the right of the row, not over the recipe', await ev(t => {
    const x = document.querySelector(`[data-wmdrop="${t}|breakfast"]`).getBoundingClientRect();
    const pk = document.querySelector(`[data-wm="${t}|breakfast"]`).getBoundingClientRect();
    const row = document.querySelector(`[data-wm="${t}|breakfast"]`).closest('.wmrow').getBoundingClientRect();
    return x.left >= pk.right && x.right <= row.right && x.width >= 30; }, today));
  answer = false; asked.length = 0; await clear();
  await p.click(`[data-wmdrop="${today}|breakfast"]`); await settle(400);
  ok('it asks first, naming the meal and the day', asked.length === 1 && asked[0] === 'Take Porridge off today’s breakfast?', asked.join(' / '));
  ok('  Cancel leaves it', (await ev(() => window.__writes.filter(x => x.table === 'meal_plan'))).length === 0
    && !!(await p.$(`[data-wmdrop="${today}|breakfast"]`)));
  answer = true; await clear();
  await p.click(`[data-wmdrop="${today}|breakfast"]`); await settle(500);
  w = await ev(() => window.__writes.filter(x => x.table === 'meal_plan'));
  ok('  OK takes it off', w.length === 1 && w[0].op === 'delete'
    && JSON.stringify(w[0].where) === JSON.stringify([['eq', 'owner_id', 'me'], ['eq', 'on_date', today], ['eq', 'meal', 'breakfast']]),
    JSON.stringify(w));
  await ev(() => { window.__rows.meal_plan = window.__rows.meal_plan.filter(x => !(x.owner_id === 'me' && x.meal === 'breakfast')); });
  await ev(async () => { await loadMenu(); renderWeekMenu(); }); await settle(300);
  ok('  and the meal is empty again', await ev(t => !!document.querySelector(`[data-wm="${t}|breakfast"] .wmnone`), today));
  await ev(t => { window.__rows.meal_plan.push({ owner_id: 'me', on_date: t, meal: 'lunch', recipe_id: null, title: 'Out' }); }, await ev(() => menuDays()[2]));
  await ev(async () => { await loadMenu(); renderWeekMenu(); }); await settle(300);
  asked.length = 0; answer = false;
  await p.click(`[data-wmdrop="${await ev(() => menuDays()[2])}|lunch"]`); await settle(300);
  const wd = await ev(() => { const [y, m, d] = menuDays()[2].split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long' }); });
  ok('  words typed in can be taken off too, the day named', asked[0] === `Take Out off ${wd}’s lunch?`, asked.join(' / '));
  answer = true;
  await p.click(`[data-wm="${await ev(() => menuDays()[2])}|lunch"]`); await settle(300);
  ok('the button in the meal’s box now says Take it off the menu', await ev(() => $('wmClear') && $('wmClear').textContent === 'Take it off the menu'));
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nBack from something tapped on Today comes back to Today (ML192)');
  const soon = new Date(Date.now() - 60 * 60 * 1000);   // an hour overdue: always on Today
  await ev(([t, s]) => {
    window.__rows.meal_plan = [{ owner_id: 'me', on_date: t, meal: 'dinner', recipe_id: 1, title: 'Shepherd’s pie' }];
    window.__rows.meal_shares = [];
    ITEMS = [{ id: 901, kind: 'todo', title: 'Ring the boatyard', created_by: 'me', due_at: s, remind_at: null,
      repeat_every: 'none', done_at: null, photos: [], updated_at: '2026-01-01' }];
    ROUTINES = [{ id: 31, title: 'Grease the stern gland', heading: 'ASAP', done: false, sort_order: 1, photos: [] }];
    MENU_OF = 'me'; MENU_AT = 0; RCP_PREFS.today = true;
    const n = new Date(); n.setDate(n.getDate() + 2);   // a birthday the day after tomorrow
    CONTACTS[0].birth_date = (n.getFullYear() - 40) + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    CONTACTS[0].death_date = null;
  }, [today, soon.toISOString()]);
  await ev(() => openBrief()); await settle(900);
  ok('Today shows the to-do, the ASAP job and the menu', !!(await p.$('[data-briefi="901"]')) && !!(await p.$('[data-briefr="31"]'))
    && !!(await p.$('[data-briefmeal="1"]')));

  // A birthday, or anyone
  const c1 = await ev(() => { const x = document.querySelector('[data-briefc]'); return x ? Number(x.dataset.briefc) : null; });
  if (c1 != null) {
    await ev(() => { $('briefBody').scrollTop = 0; });
    await p.click(`[data-briefc="${c1}"]`); await settle(500);
    ok('a birthday opens the person over Today', await top() === 'detail' && await shown('brief'));
    ok('  where you are counts as Contacts, not Today', await ev(() => currentScreen()) === 'contacts');
    await p.click('#detBack'); await settle(400);
    ok('  Back comes back to Today', await top() === 'brief' && await shown('brief') && !(await shown('detail')));
  } else ok('a birthday to tap', false, 'none on Today');

  // A to-do: opening it, and Today drawn again on the way back
  const y0 = await ev(() => { const b = $('briefBody'); b.scrollTop = 60; return b.scrollTop; });
  await p.click('[data-briefi="901"]'); await settle(500);
  ok('a to-do opens over Today', await top() === 'itemEd' && await shown('brief'));
  await ev(() => { ITEMS[0].done_at = new Date().toISOString(); });
  const cancel = await ev(() => { const b = document.querySelector('#itemEd .sheetbar button'); return b ? b.id : ''; });
  await p.click('#' + cancel); await settle(500);
  ok('  Cancel comes back to Today', await top() === 'brief' && !(await shown('itemEd')), cancel);
  ok('  and Today is drawn again: the ticked-off to-do has gone', !(await p.$('[data-briefi="901"]')));
  ok('  in the same place on the page', Math.abs(await ev(() => $('briefBody').scrollTop) - y0) <= 2, y0 + ' then ' + await ev(() => $('briefBody').scrollTop));

  // An ASAP job: its own screen, the Regular list, then the arrow home
  await p.click('[data-briefr="31"]'); await settle(500);
  ok('an ASAP job opens its own screen over the Regular list, Today underneath',
    await top() === 'rtEd' && await shown('diary') && await shown('brief'));
  await p.click('#rtCancel'); await settle(300);
  ok('  Cancel lands on the Regular list, as before', await top() === 'diary' && !(await shown('rtEd')));
  await p.click('#diary [data-home="diary"]'); await settle(500);
  ok('  and the arrow from there comes back to Today', await top() === 'brief' && await shown('brief') && !(await shown('diary')));

  // A recipe from Today's Menu, and from Tonight's idea
  await p.click('[data-briefmeal="1"]'); await settle(800);
  ok('a recipe on Today’s Menu opens on its own over Today', await top() === 'recipe' && await ev(() => RCP_CUR === 1)
    && !(await shown('recipes')) && await shown('brief'));
  await p.click('#rvBack'); await settle(400);
  ok('  one Back comes straight back to Today', await top() === 'brief' && !(await shown('recipe')));
  await ev(() => { window.__rows.meal_plan = []; MENU_AT = 0; }); await ev(() => loadMenu().then(paintBriefRecipe)); await settle(500);
  const idea = await ev(() => { const o = document.querySelector('#briefRecipe [data-ropen]'); return o ? Number(o.dataset.ropen) : null; });
  ok('Tonight’s idea is there', idea != null);
  await p.click(`#briefRecipe [data-ropen="${idea}"]`); await settle(800);
  ok('  tapping it opens the recipe over Today', await top() === 'recipe' && await ev(i => RCP_CUR === i, idea) && !(await shown('recipes')));
  await p.click('#rvBack'); await settle(400);
  ok('  and Back comes back to Today', await top() === 'brief');
  await ev(async () => { const saved = RECIPES; RECIPES = []; await briefOpenRecipe(99); RECIPES = saved; }); await settle(300);
  ok('a recipe no longer in the cookbook says so and stays on Today', await top() === 'brief' && !(await shown('recipe')));

  // The menu takes you somewhere else: Today goes too
  await p.click('[data-briefr="31"]'); await settle(500);
  await p.click('#rtCancel'); await settle(300);
  await ev(() => { openMenu('diary'); }); await settle(300);
  await ev(() => goArea('shop')); await settle(600);
  ok('going somewhere else from the menu puts Today away too', await shown('shop') && !(await shown('brief')) && !(await shown('diary')));
  await closeAll();
  await ev(() => openBrief()); await settle(500);
  await p.click('#briefClose'); await settle(300);
  ok('Close on Today still closes it', !(await shown('brief')));
  await closeAll();

  console.log(errors.length ? '\n' + errors.join('\n') : '\nNo errors anywhere');
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
