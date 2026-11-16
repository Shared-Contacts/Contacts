// Version 2026.11.16.3: Recipes, What can I make? (ML275). Type what you
// have in; your own recipes that use it come first, then ideas from
// TheMealDB, each with what it uses and what else it needs. TheMealDB is
// answered here, with made-up recipes, rather than over the internet.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|^\[object Object\]$|JSHandle@object/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

const R = (id, who, title, names, more = {}) => ({ id, created_by: who, title, categories: [], serves: 4,
  prep_mins: null, cook_mins: null, ingredients: names.map(n => typeof n === 'string' ? { qty: '', unit: '', name: n } : n),
  prep_steps: [], cook_steps: ['Cook it.'], notes: null, photos: [], video_url: null, source_url: null, source_name: null,
  to_try: false, share_all: true, created_at: '2026-11-01T10:00:00Z', ...more });

// TheMealDB's answers: one ingredient at a time, as its free version works.
const MEALS = {
  1: { strMeal: 'Leek pie', ings: [['Chicken', '400g'], ['Leek', '2 sliced'], ['Puff Pastry', '1 sheet'], ['Salt', 'pinch']] },
  2: { strMeal: 'Leek soup', ings: [['Leek', '3'], ['Potatoes', '500g'], ['Chicken Stock', '1 litre']] },
  3: { strMeal: 'Roast bird', ings: [['Chicken', '1 whole'], ['Lemon', '1']] },
  4: { strMeal: 'Tomato salad', ings: [['Tomato', '4'], ['Basil', 'handful']] },
  5: { strMeal: 'Tomatoes on toast', ings: [['Tomatoes', '2'], ['Bread', '2 slices']] } };
const FILTER = { chicken: [1, 3], leek: [1, 2], tomato: [4], tomatoes: [5] };
const full = id => { const m = MEALS[id], o = { idMeal: String(id), strMeal: m.strMeal, strCategory: 'Chicken', strArea: 'British',
  strInstructions: 'Cook it.\r\nServe.', strMealThumb: 'https://www.themealdb.com/images/media/meals/' + id + '.jpg', strSource: '' };
  m.ings.forEach(([w, q], i) => { o['strIngredient' + (i + 1)] = w; o['strMeasure' + (i + 1)] = q; }); return o; };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  let asked = [], down = false;
  await p.route('https://www.themealdb.com/**', route => {
    const u = decodeURIComponent(route.request().url());
    if (/\.jpg/.test(u)) return route.abort();
    asked.push(u.replace(/^.*\/1\//, ''));
    if (down) return route.abort();
    let body = { meals: null };
    const f = u.match(/filter\.php\?i=(.*)$/), l = u.match(/lookup\.php\?i=(\d+)/);
    if (f) { const ids = FILTER[f[1].toLowerCase()]; if (ids) body = { meals: ids.map(i => ({ idMeal: String(i), strMeal: MEALS[i].strMeal,
      strMealThumb: 'https://www.themealdb.com/images/media/meals/' + i + '.jpg' })) }; }
    else if (l && MEALS[l[1]]) body = { meals: [full(Number(l[1]))] };
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  const V = VJ.history.find(h => h.version === '2026.11.16.3'), V4 = VJ.history.find(h => h.version === '2026.11.16.4');
  ok('2026.11.16.3 and 2026.11.16.4 are in version.json, and the page is the newest', !!V && !!V4 && VJ.version === appVer && VJ.history[0].version === appVer, appVer);
  ok('  saying what changed, in lines short enough', !!V && !!V4 && /What can I make\?/.test(V.changes.join(' ')) && /in gold/.test(V4.changes.join(' '))
    && V.changes.concat(V4.changes).every(c => c.length < 160));

  // ---------------------------------------------------------------
  console.log('\nReading what you typed, and matching it');
  ok('commas, "and" and new lines all split the list; the same thing twice counts once', await ev(() =>
    JSON.stringify(canItems('chicken, leeks and double cream\ntomatoes;  Leek , ')) === JSON.stringify(['chicken', 'leeks', 'double cream', 'tomatoes'])));
  ok('chicken finds chicken thighs, but not chickpeas', await ev(() => canUses('boneless chicken thighs', 'chicken')
    && !canUses('chickpeas', 'chicken') && !canUses('chickpea', 'chicken')));
  ok('leeks finds leek, tomato finds cherry tomatoes, eggs finds egg yolks', await ev(() => canUses('leek', 'leeks')
    && canUses('cherry tomatoes', 'tomato') && canUses('2 egg yolks', 'eggs') && canUses('potatoes, peeled', 'potato')));
  ok('nor something made from it: chicken stock, tomato purée, cream cheese', await ev(() => !canUses('chicken stock', 'chicken')
    && !canUses('2 chicken stock cubes', 'chicken') && !canUses('tomato puree', 'tomato') && !canUses('cream cheese', 'cream')
    && canUses('chicken breast', 'chicken') && canUses('lemon juice', 'lemon')));
  ok('two words must come together: double cream is not single cream', await ev(() => canUses('double cream', 'double cream')
    && !canUses('single cream', 'double cream') && canUses('cream', 'cream')));
  ok('TheMealDB is asked for each thing as typed, singular and plural', await ev(() =>
    canForms('tomato').includes('tomatoes') && canForms('leeks').includes('leek') && canForms('Cherry').includes('cherries')
    && canForms('Chicken Breast').includes('chicken breasts')));

  // ---------------------------------------------------------------
  console.log('\nWhat can I make?, in Recipes');
  await ev(r => { window.__rows.recipes = r; }, [
    R(501, 'me', 'Chicken and leek pie', ['chicken thighs', 'leeks, sliced', 'puff pastry', 'salt and pepper']),
    R(502, 'me', 'Leek and potato soup', ['leeks', 'potatoes', 'butter', { head: 'To finish' }, 'double cream']),
    R(503, 'me', 'Chickpea curry', ['chickpeas', 'onion']),
    R(504, 'sandra', 'Roast chicken', ['1 whole chicken', 'oil']),
    R(505, 'me', 'Leek tart', ['leek', 'eggs'], { to_try: true }),
    R(506, 'sandra', 'Hidden chicken', ['chicken'])]);
  await ev(async () => { await openRecipes(); RCP_PREFS.cupboard = ['salt', 'pepper', 'oil', 'water']; RCP_PREFS.hide = [506]; renderRecipes(); });
  await settle(400);
  ok('a What can I make? button, beside Week’s menu', await ev(() => !!$('rcpCan')
    && $('rcpCan').parentElement === $('rcpWeek').parentElement));
  ok('  the usual list has no extra lines in it', await ev(() => !document.querySelector('#rcpList .rcpcanfit')
    && document.querySelectorAll('#rcpList [data-ropen]').length > 0));
  await p.click('#rcpCan'); await settle(300);
  ok('it opens a box to type in, in place of the search and the list', await ev(() => !!$('rcpCanQ') && !$('rcpQ') && !$('rcpList')
    && document.activeElement === $('rcpCanQ')));
  asked = [];
  await p.click('#rcpCanGo'); await settle(200);
  ok('Find with nothing typed says what to do, and asks TheMealDB nothing', /Type one or more things you have/.test(await toasts()) && asked.length === 0, await toasts());
  await p.fill('#rcpCanQ', 'chicken, leeks');
  await p.press('#rcpCanQ', 'Enter'); await settle(800);
  const mine = await ev(() => [...document.querySelectorAll('#rcpCanList [data-ropen]')].map(x => ({ id: +x.dataset.ropen,
    fit: x.querySelector('.rcpcanfit') ? x.querySelector('.rcpcanfit').textContent.trim() : '' })));
  ok('your recipes, using both first, then least else needed: the pie, Roast chicken, Leek tart, then the soup',
    mine.map(x => x.id).join() === '501,504,505,502', JSON.stringify(mine));
  ok('  the pie uses both, and needs puff pastry (salt and pepper are in the cupboard)', mine[0] && mine[0].fit === 'Uses both chicken and leeks. Needs 1 more: puff pastry', mine[0] && mine[0].fit);
  ok('  Roast chicken: uses chicken, and you have everything (oil is in the cupboard)', mine[1] && mine[1].fit === 'Uses chicken. You have everything', mine[1] && mine[1].fit);
  ok('  the soup needs three more, the heading left out', mine[3] && mine[3].fit === 'Uses leeks. Needs 3 more: potatoes, butter, double cream', mine[3] && mine[3].fit);
  ok('  Leek tart, from To try, is there too', mine.some(x => x.id === 505));
  ok('  not Chickpea curry, nor a recipe you chose not to see', !mine.some(x => x.id === 503 || x.id === 506));
  ok('TheMealDB was asked for leek and leeks, chicken and chickens, then each recipe found', ['filter.php?i=leek', 'filter.php?i=leeks',
    'filter.php?i=chicken', 'filter.php?i=chickens', 'lookup.php?i=1', 'lookup.php?i=2', 'lookup.php?i=3'].every(u => asked.includes(u)), asked.join(' '));
  const ideas = await ev(() => [...document.querySelectorAll('#rcpCanList [data-canidea]')].map(x => ({ id: x.dataset.canidea,
    t: x.querySelector('span').textContent, fit: x.querySelector('small').textContent.trim() })));
  ok('its ideas, using both first, then least else needed: Leek pie, Roast bird, then Leek soup', ideas.map(x => x.t).join() === 'Leek pie,Roast bird,Leek soup', JSON.stringify(ideas));
  ok('  each saying what it uses and needs', ideas[0] && ideas[0].fit === 'Uses both chicken and leeks. Needs 1 more: Puff Pastry'
    && ideas[2] && ideas[2].fit === 'Uses leeks. Needs 2 more: Potatoes, Chicken Stock', JSON.stringify(ideas.map(x => x.fit)));
  const look = await ev(() => {
    const row = id => document.querySelector('#rcpCanList [data-ropen="' + id + '"]');
    const pie = row(501), probe = document.createElement('i'); probe.style.color = 'var(--brass)'; pie.appendChild(probe);
    const gold = getComputedStyle(probe).color; probe.remove();
    const hits = [...pie.querySelectorAll('strong.canhit')];
    return { allRows: [...document.querySelectorAll('#rcpCanList .rcprow.canall')].map(x => x.dataset.ropen).join(),
      allCards: [...document.querySelectorAll('#rcpCanList .idcard.canall')].map(x => x.dataset.canidea).join(),
      hits: hits.map(h => h.textContent).join(), bold: hits.every(h => +getComputedStyle(h).fontWeight >= 700),
      gold: hits.every(h => getComputedStyle(h).color === gold), notTitle: gold !== getComputedStyle(pie.querySelector('b')).color,
      tinted: getComputedStyle(pie).backgroundColor !== getComputedStyle(row(504)).backgroundColor,
      cardHits: [...document.querySelectorAll('[data-canidea="3"] strong.canhit')].map(h => h.textContent).join() };
  });
  ok('only the recipes using all of what you typed are picked out: the pie, and Leek pie', look.allRows === '501' && look.allCards === '1', JSON.stringify(look));
  ok('  picked out with a tint of their own', look.tinted);
  ok('  what you typed is in bold gold, a colour apart from the title; what else it needs is not', look.hits === 'chicken,leeks'
    && look.bold && look.gold && look.notTitle, JSON.stringify(look));
  ok('  the same in TheMealDB\'s ideas', look.cardHits === 'chicken');
  ok('  under their own headings, with how many', await ev(() => /Your recipes\s*4/.test($('rcpCanList').textContent)
    && /Ideas from TheMealDB\s*3/.test($('rcpCanList').textContent)));
  asked = [];
  await p.click('[data-canidea="1"]'); await settle(400);
  ok('tapping an idea shows it, with Add to To try, without fetching it again', await ev(() => {
    const d = document.querySelector('.daypick.lnked'); return !!d && /Leek pie/.test(d.textContent) && !!d.querySelector('#idAdd'); })
    && asked.filter(u => /lookup|filter/.test(u)).length === 0, asked.join(' '));
  await ev(() => document.querySelector('#idShut').click()); await settle(200);
  await p.click('#rcpCanList [data-ropen="501"]'); await settle(500);
  ok('tapping one of yours opens it', await ev(() => RCP_CUR != null && Number(RCP_CUR.id || RCP_CUR) === 501));
  await ev(() => { $('recipe') && $('recipe').classList.add('hidden'); renderRecipes(); }); await settle(200);
  ok('  and coming back, what you typed and found are still there', await ev(() => $('rcpCanQ').value === 'chicken, leeks'
    && document.querySelectorAll('#rcpCanList [data-ropen]').length === 4));

  await p.fill('#rcpCanQ', 'chicken, leeks, puff pastry'); await p.click('#rcpCanGo'); await settle(800);
  const three = await ev(() => ({ rows: [...document.querySelectorAll('#rcpCanList [data-ropen]')].map(x => x.dataset.ropen + (x.classList.contains('canall') ? '*' : '')).join(),
    pie: document.querySelector('#rcpCanList [data-ropen="501"] .rcpcanfit').textContent.trim(),
    card: (document.querySelector('#rcpCanList .idcard.canall small') || {}).textContent }));
  ok('three things: the pie uses all 3, so it is at the top and picked out', three.rows === '501*,504,505,502'
    && three.pie === 'Uses all 3: chicken, leeks and puff pastry. You have everything', JSON.stringify(three));
  ok('  and Leek pie the same', three.card === 'Uses all 3: chicken, leeks and puff pastry. You have everything', three.card);
  await p.fill('#rcpCanQ', 'chicken'); await p.click('#rcpCanGo'); await settle(800);
  ok('one thing typed: nothing picked out, as every one uses it', await ev(() => !document.querySelector('#rcpCanList .canall')
    && document.querySelector('#rcpCanList [data-ropen="504"] .rcpcanfit').textContent.trim() === 'Uses chicken. You have everything'
    && document.querySelectorAll('#rcpCanList strong.canhit').length > 0));

  console.log('\nNo signal, and nothing found');
  down = true;
  await p.fill('#rcpCanQ', 'tomatoes, leeks'); await p.click('#rcpCanGo'); await settle(600);
  ok('TheMealDB out of reach: your own recipes still show, with a word and try again', await ev(() =>
    document.querySelectorAll('#rcpCanList [data-ropen]').length === 3 && /Could not reach TheMealDB/.test($('rcpCanList').textContent)
    && !!$('rcpCanAgain')));
  down = false;
  await p.click('#rcpCanAgain'); await settle(800);
  ok('  try again: tomato and tomatoes both found, as TheMealDB keeps them apart', await ev(() =>
    [...document.querySelectorAll('#rcpCanList [data-canidea] span')].map(x => x.textContent).sort().join())
    === 'Leek pie,Leek soup,Tomato salad,Tomatoes on toast');
  await p.fill('#rcpCanQ', 'saffron'); await p.click('#rcpCanGo'); await settle(600);
  ok('nothing anywhere: says so for both, rather than an empty screen', await ev(() =>
    /None of your recipes use saffron/.test($('rcpCanList').textContent) && /TheMealDB has nothing with saffron/.test($('rcpCanList').textContent)));

  console.log('\nBack, Help, and a narrow phone');
  await p.setViewportSize({ width: 320, height: 700 }); await settle(300);
  ok('at 320 wide nothing spills off the side', await ev(() => document.documentElement.scrollWidth <= innerWidth
    && [...document.querySelectorAll('#rcpBody .rcptwo .btn, #rcpCanGo')].every(x => x.getBoundingClientRect().right <= innerWidth)));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('#rcpCanShut'); await settle(300);
  ok('Back to all recipes puts the search and the list back', await ev(() => !!$('rcpQ') && !!$('rcpList') && !$('rcpCanQ') && RCP.can === null));
  ok('Help explains What can I make?', await ev(() => /What can I make\?<\/strong> finds recipes for what you have in/.test(document.body.innerHTML)));

  console.log('\nErrors: ' + (errors.length ? errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
