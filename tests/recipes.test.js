// Recipes: the family cookbook, To try, Ideas, shopping, Cook mode and the
// idea on Today (ML17, step 43, asked for 26 Oct 2026).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const seed = () => {
  window.__rows.recipes = [
    { id:301, created_by:'me', title:'Leek and potato soup', categories:['Soups'], serves:4,
      prep_mins:20, cook_mins:25,
      ingredients:[{qty:'50',unit:'g',name:'butter'},{qty:'450',unit:'g',name:'potatoes, peeled and diced'},
        {qty:'1',unit:'',name:'small onion'},{head:'To finish'},{qty:'',unit:'',name:'salt and pepper'},
        {qty:'150',unit:'ml',name:'double cream'}],
      prep_steps:['Peel and dice the potatoes.'],
      cook_steps:['Melt the butter.','Simmer for 20 mins until soft.','Blend:','Blend until smooth.'],
      notes:'Less pepper for Sandra', photos:[{path:'rec/me/a.jpg'}], video_url:'https://www.youtube.com/watch?v=abc',
      source_url:null, source_name:null, to_try:false, share_all:true, created_at:'2026-10-20T10:00:00Z' },
    { id:302, created_by:'me', title:'Barry’s chilli', categories:['Mains'], serves:null,
      prep_mins:null, cook_mins:null,
      ingredients:[{qty:'500',unit:'g',name:'beef mince'},{qty:'2 x 400',unit:'g',name:'tins chopped tomatoes'}],
      prep_steps:[], cook_steps:['Brown the mince.'], notes:null, photos:[], video_url:null,
      source_url:null, source_name:null, to_try:false, share_all:false, created_at:'2026-10-22T10:00:00Z' },
    { id:303, created_by:'me', title:'Chicken pie', categories:[], serves:4, prep_mins:null, cook_mins:null,
      ingredients:[{qty:'2',unit:'',name:'chicken breasts'}], prep_steps:[], cook_steps:['Bake it.'],
      notes:null, photos:[], video_url:null, source_url:'https://www.bbcgoodfood.com/recipes/chicken-pie',
      source_name:'Good Food', to_try:true, share_all:true, created_at:'2026-10-25T10:00:00Z' },
    { id:401, created_by:'sandra', title:'Sticky toffee pudding', categories:['Puddings'], serves:6,
      prep_mins:15, cook_mins:40, ingredients:[{qty:'200',unit:'g',name:'dates'}], prep_steps:[],
      cook_steps:['Bake for 40 minutes.'], notes:null, photos:[{path:'rec/sandra/p.jpg'}], video_url:null,
      source_url:null, source_name:null, to_try:false, share_all:true, created_at:'2026-10-21T10:00:00Z' },
    { id:402, created_by:'sandra', title:'Kale smoothie', categories:['Drinks'], serves:1,
      prep_mins:null, cook_mins:null, ingredients:[{qty:'1',unit:'handful',name:'kale'}], prep_steps:[],
      cook_steps:['Whizz it.'], notes:null, photos:[], video_url:null, source_url:null, source_name:null,
      to_try:false, share_all:true, created_at:'2026-10-19T10:00:00Z' },
    { id:403, created_by:'sandra', title:'Sandra’s secret pile', categories:[], serves:null,
      prep_mins:null, cook_mins:null, ingredients:[], prep_steps:[], cook_steps:[], notes:null, photos:[],
      video_url:null, source_url:'https://example.org/x', source_name:'Example', to_try:true, share_all:true,
      created_at:'2026-10-24T10:00:00Z' }];
  window.__rows.shopping_lists = [{ id:1, owner_id:'me', name:'Supermarket' },
                                  { id:2, owner_id:'sandra', name:'Boat' }];
  window.__rows.shopping = [
    { id:1, list_id:1, created_by:'me', name:'Butter', qty:null, got:false, sort_order:101 },
    { id:2, list_id:1, created_by:'me', name:'Small onion', qty:null, got:true, sort_order:102 }];
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|recipes\" does not exist|signed\.test|read-recipe test/i.test(t))
      errors.push('CONSOLE: ' + t); });
  const dialogs = [];
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  // Speech, keeping the screen on and new windows are all the phone's; here
  // they are stood in for, so the test can see what was asked of them.
  await p.addInitScript(() => {
    window.__said = []; window.__wake = 0; window.__opened = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable:true, value:{
      speak:u => window.__said.push(u.text), cancel(){},
      getVoices:() => [{ lang:'en-US', name:'US' }, { lang:'en-GB', name:'Google UK English Female' }] } });
    Object.defineProperty(navigator, 'wakeLock', { configurable:true, value:{
      request:async () => { window.__wake++; return { release:async () => {}, addEventListener(){} }; } } });
    window.open = (u) => { window.__opened.push(u); return null; };
    document.addEventListener('click', ev => {
      const a = ev.target.closest && ev.target.closest('a[target="_blank"]');
      if (a) ev.preventDefault();
    }, true);
  });
  // TheMealDB, answered here rather than over the internet.
  const meal = { idMeal:'52875', strMeal:'Chicken Ham and Leek Pie', strCategory:'Chicken', strArea:'British',
    strInstructions:'STEP 1\r\nHeat the stock.\r\n\r\n2. Simmer for 10 minutes.\r\nServe.',
    strMealThumb:'https://www.themealdb.com/images/media/meals/pie.jpg',
    strYoutube:'https://www.youtube.com/watch?v=pie', strSource:'',
    strIngredient1:'Chicken Stock', strMeasure1:'450ml', strIngredient2:'Leek', strMeasure2:'2 sliced',
    strIngredient3:'', strMeasure3:' ' };
  let mealCalls = 0;
  await p.route('https://www.themealdb.com/**', route => {
    mealCalls++;
    const u = route.request().url();
    const body = /categories\.php/.test(u) ? { categories:[{ strCategory:'Chicken' }, { strCategory:'Dessert' }] }
      : /search\.php\?s=zzz/.test(u) ? { meals:null }
      : { meals:[meal] };
    route.fulfill({ status:200, contentType:'application/json', headers:{ 'Access-Control-Allow-Origin':'*' },
      body:JSON.stringify(body) });
  });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a);
  const writes = () => ev(() => window.__writes);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const clearWrites = () => ev(() => { window.__writes.length = 0; });

  console.log('\nReading an ingredient');
  const parsed = await ev(() => ({
    flour: parseIng('200g plain flour'), oil: parseIng('2 tbsp olive oil'),
    onion: parseIng('1 large onion, finely chopped'), twice: parseIng('450g/1lb potatoes'),
    half: parseIng('½ tsp salt'), cups: parseIng('1 1/2 cups milk'),
    tins: parseIng('2 x 400g tins chopped tomatoes'), head: parseIng('For the sauce:'),
    plain: parseIng('salt and pepper'), eggs: parseIng('3 eggs'), lemon: parseIng('1 lemon'),
    litre: parseIng('1 litre stock'), dash: parseIng('- 100ml milk'), blank: parseIng('   ') }));
  const is = (x, q, u, n) => x && x.qty === q && x.unit === u && x.name === n;
  ok('200g plain flour', is(parsed.flour, '200', 'g', 'plain flour'), JSON.stringify(parsed.flour));
  ok('2 tbsp olive oil', is(parsed.oil, '2', 'tbsp', 'olive oil'), JSON.stringify(parsed.oil));
  ok('a size is part of the name, not a unit', is(parsed.onion, '1', '', 'large onion, finely chopped'), JSON.stringify(parsed.onion));
  ok('450g/1lb keeps one amount', is(parsed.twice, '450', 'g', 'potatoes'), JSON.stringify(parsed.twice));
  ok('½ tsp', is(parsed.half, '½', 'tsp', 'salt'), JSON.stringify(parsed.half));
  ok('1 1/2 cups', is(parsed.cups, '1 1/2', 'cups', 'milk'), JSON.stringify(parsed.cups));
  ok('2 x 400g tins', is(parsed.tins, '2 x 400', 'g', 'tins chopped tomatoes'), JSON.stringify(parsed.tins));
  ok('a line ending in a colon is a heading', parsed.head && parsed.head.head === 'For the sauce');
  ok('no amount at all', is(parsed.plain, '', '', 'salt and pepper'));
  ok('3 eggs', is(parsed.eggs, '3', '', 'eggs'));
  ok('the l of lemon is not litres', is(parsed.lemon, '1', '', 'lemon'), JSON.stringify(parsed.lemon));
  ok('1 litre stock', is(parsed.litre, '1', 'litre', 'stock'));
  ok('a pasted bullet is dropped', is(parsed.dash, '100', 'ml', 'milk'), JSON.stringify(parsed.dash));
  ok('an empty line is nothing', parsed.blank === null);

  console.log('\nScaling the amounts');
  const sc = await ev(() => ({
    a: scaleQty('1 1/2', 2), b: scaleQty('½', 3), c: scaleQty('2-3', 2), d: scaleQty('2 x 400', 1.5),
    e: scaleQty('200', .5), f: scaleQty('1', 1/3), g: scaleQty('450', 2), h: scaleQty('3', 1),
    t1: ingText(parseIng('2 x 400g tins chopped tomatoes'), 1), t2: ingText(parseIng('2 tbsp oil'), 2),
    t3: ingText(parseIng('200g plain flour'), 1) }));
  ok('1 1/2 doubled is 3', sc.a === '3', sc.a);
  ok('½ trebled is 1½', sc.b === '1½', sc.b);
  ok('a range scales at both ends', sc.c === '4-6', sc.c);
  ok('2 x 400 scales how many tins, not their size', sc.d === '3 x 400', sc.d);
  ok('halving 200', sc.e === '100', sc.e);
  ok('a third of 1 is ⅓', sc.f === '⅓', sc.f);
  ok('900 stays a plain number', sc.g === '900', sc.g);
  ok('no change, no change', sc.h === '3');
  ok('written back the way it was typed', sc.t1 === '2 x 400g tins chopped tomatoes' && sc.t3 === '200g plain flour', sc.t1);
  ok('and doubled', sc.t2 === '4 tbsp oil', sc.t2);

  console.log('\nThe cupboard, timers and pasted steps');
  const misc = await ev(() => ({
    sp: inCupboard(parseIng('salt and pepper')), oo: inCupboard(parseIng('2 tbsp olive oil')),
    bp: inCupboard(parseIng('freshly ground black pepper')), wc: inCupboard(parseIng('1 tin water chestnuts')),
    bu: inCupboard(parseIng('50g butter')),
    m1: stepMins('Simmer for 20 mins until soft.'), m2: stepMins('Bake for 1 hour 15 minutes.'),
    m3: stepMins('Cook for 10-12 minutes'), m4: stepMins('Stir well.'), m5: stepMins('Roast for 1.5 hours'),
    lines: stepLines('1. Do this\n2) Then that\n\nStep 3\nServe.'),
    shop: shopName(parseIng('450g potatoes (Maris Piper), peeled')) }));
  ok('salt and pepper are in the cupboard', misc.sp && misc.bp);
  ok('so is olive oil', misc.oo);
  ok('but not water chestnuts, or butter', !misc.wc && !misc.bu);
  ok('a step’s time is found', misc.m1 === 20 && misc.m2 === 75 && misc.m3 === 10 && misc.m5 === 90,
     [misc.m1, misc.m2, misc.m3, misc.m5].join(','));
  ok('no time, no timer', misc.m4 === 0);
  ok('numbers pasted with the steps are taken off', JSON.stringify(misc.lines) === '["Do this","Then that","Serve."]',
     JSON.stringify(misc.lines));
  ok('the shopping list gets just the thing itself', misc.shop === 'potatoes', misc.shop);

  console.log('\nBefore step 43 is run');
  await ev(() => { window.__realFrom = sb.from; sb.from = t => t === 'recipes'
    ? { select:() => ({ order:() => Promise.resolve({ data:null,
        error:{ message:'relation "recipes" does not exist' } }) }) } : window.__realFrom(t); });
  await ev(() => openRecipes()); await settle();
  const notset = await p.textContent('#rcpBody');
  ok('it says to run step 43, not that there are no recipes', /step 43/.test(notset) && !/No recipes yet/.test(notset), notset);
  await ev(() => { sb.from = window.__realFrom; RCP_LOADED = false; $('recipes').classList.add('hidden'); });

  console.log('\nThe tile and the list');
  ok('the tile opens Recipes now', await ev(() => TILE_DEST.recipes.go === openRecipes));
  await ev(seed);
  await ev(() => openRecipes()); await settle();
  const rows = await ev(() => [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen));
  ok('everyone’s recipes are there, A to Z', JSON.stringify(rows) === '[302,402,301,401]', JSON.stringify(rows));
  ok('somebody else’s To try pile is never shown', !/secret pile/.test(await p.textContent('#rcpBody')));
  const pile = await ev(() => [...document.querySelectorAll('#rcpBody .card')][0].textContent);
  ok('your own To try pile is at the top', /To try/.test(await p.textContent('#rcpBody')) && /Chicken pie/.test(pile)
     && /from Good Food/.test(pile), pile.trim().slice(0, 80));
  const rowText = await p.textContent('[data-ropen="401"]');
  ok('other people’s say whose they are', /from Sandra/.test(rowText), rowText);
  ok('a just-me one says so', /just you/.test(await p.textContent('[data-ropen="302"]')));
  ok('photos show on the list', await ev(() => /signed\.test\/rec\/me\/a\.jpg/.test(
     document.querySelector('[data-ropen="301"] img').src)));
  ok('the categories in use are buttons', await ev(() =>
     [...document.querySelectorAll('[data-rcat]')].map(b => b.dataset.rcat).join('|')) === '|Soups|Mains|Puddings|Drinks');

  await p.click('[data-rcat="Puddings"]'); await settle(200);
  ok('a category narrows the list', await ev(() =>
     [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen).join()) === '401');
  await p.click('[data-rcat=""]'); await settle(200);
  await p.fill('#rcpQ', 'cream leek'); await settle(200);
  ok('search looks through the ingredients too, every word', await ev(() =>
     [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen).join()) === '301');
  ok('and the search box keeps the keyboard', await ev(() => document.activeElement.id === 'rcpQ'));
  await p.fill('#rcpQ', 'sandra'); await settle(200);
  ok('who added it counts too, and the notes', await ev(() =>
     [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen).join()) === '402,301,401');
  await p.fill('#rcpQ', ''); await settle(200);
  await p.click('[data-rsort="newest"]'); await settle(200);
  ok('Newest first', await ev(() =>
     [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen).join()) === '302,401,301,402');
  await p.click('[data-rsort="az"]'); await settle(200);

  console.log('\nOne recipe');
  await p.click('[data-ropen="301"]'); await settle();
  ok('it opens', await p.isVisible('#recipe') && await p.textContent('#rvTitle') === 'Leek and potato soup');
  const view = await p.textContent('#rcpView');
  ok('with the times, categories, video and notes', /Prep 20 mins/.test(view) && /Soups/.test(view)
     && /Watch the video/.test(view) && /Less pepper for Sandra/.test(view));
  ok('the steps are numbered on through a heading', await ev(() =>
     [...document.querySelectorAll('#rcpView ol.rcpsteps')].map(o => o.start).join()) === '1,1,3',
     await ev(() => [...document.querySelectorAll('#rcpView ol.rcpsteps')].map(o => o.start).join()));
  const ticks = await ev(() => [...document.querySelectorAll('[data-ring]')].map(b => b.dataset.ring + (b.checked ? '+' : '-')).join());
  ok('everything ticked but the salt and pepper', ticks === '0+,1+,2+,4-,5+', ticks);
  ok('the button counts them', /Add 4 to Shopping/.test(await p.textContent('#rvShop')));
  await p.click('#rvMore'); await p.click('#rvMore'); await p.click('#rvMore'); await p.click('#rvMore'); await settle(200);
  const doubled = await p.textContent('#rcpView .card');
  ok('serves 8 doubles everything', /Serves 8/.test(doubled) && /written for 4/.test(doubled)
     && /100g butter/.test(doubled) && /900g potatoes/.test(doubled) && /300ml double cream/.test(doubled), doubled.slice(0, 200));

  console.log('\nOnto the shopping list');
  await clearWrites();
  await p.click('#rvShop'); await settle(500);
  ok('it asks which list, when there is more than one', await p.isVisible('[data-pickl="1"]')
     && /Boat/.test(await p.textContent('.daypick')) && /Sandra/.test(await p.textContent('.daypick')));
  await p.click('[data-pickl="1"]'); await settle(700);
  const sw = await writes();
  const ins = sw.filter(w => w.op === 'insert' && w.table === 'shopping').map(w => w.rows);
  ok('the new ones go on, with the doubled amounts', ins.length === 2
     && ins.some(r => r.name === 'Potatoes' && r.qty === '900g' && r.list_id === 1)
     && ins.some(r => r.name === 'Double cream' && r.qty === '300ml'), JSON.stringify(ins));
  ok('butter, already on the list, is not doubled up', !ins.some(r => /butter/i.test(r.name)));
  ok('the onion in the trolley goes back on the list', sw.some(w => w.op === 'update' && w.table === 'shopping'
     && w.patch.got === false && w.where.some(x => x[1] === 'id' && x[2] === 2)));
  ok('nothing about the salt and pepper', !ins.some(r => /salt/i.test(r.name)));

  console.log('\nCooked it, and Cook mode');
  await clearWrites();
  await p.click('#rvCooked'); await settle(300);
  const prof = (await writes()).find(w => w.table === 'profiles');
  ok('I cooked this is remembered with your own settings', prof && prof.patch.home_tiles.recipes.cooked['301']
     && prof.patch.home_tiles.recipes.cooked['301'].n === 1, JSON.stringify(prof && prof.patch.home_tiles.recipes));
  ok('and the recipe says so', /1 time/.test(await p.textContent('#rvCooked')));

  await p.click('#rvCook'); await settle(300);
  ok('Cook mode opens over it', await p.isVisible('#cook') && await p.textContent('#cookTitle') === 'Leek and potato soup');
  ok('the screen is kept on', await ev(() => window.__wake) === 1);
  ok('first the ingredients, at the amounts chosen', /Ingredients/.test(await p.textContent('.cooklabel'))
     && /100g butter/.test(await p.textContent('.cooklist')));
  ok('the tray is out of the way', await ev(() => $('tray').style.display === 'none'));
  ok('nothing read out until asked', (await ev(() => window.__said)).length === 0);
  await p.click('#cookSay'); await settle(200);
  let said = await ev(() => window.__said);
  ok('Read aloud reads the page', said.length === 1 && /^Ingredients\. 100g butter/.test(said[0]), said[0]);
  await p.click('#cookNext'); await settle(200);
  said = await ev(() => window.__said);
  ok('and Next reads the next step by itself', /^Preparing, step 1\. Peel and dice/.test(said[said.length - 1]), said[said.length - 1]);
  await p.click('#cookNext'); await p.click('#cookNext'); await settle(200);
  ok('a step with a time has a timer', /Start the timer: 20 mins/.test(await p.textContent('#cookBody')));
  await p.click('[data-cooktimer]'); await settle(300);
  ok('which counts down', /20:00|19:5\d/.test(await p.textContent('#cookTimers')), await p.textContent('#cookTimers'));
  await p.click('#cookNext'); await settle(200);
  ok('a heading is named with its step', /Cooking · step 3 · Blend/.test(await p.textContent('.cooklabel')),
     await p.textContent('.cooklabel'));
  ok('the timer stays on screen from step to step', /20 mins/.test(await p.textContent('#cookTimers')));
  await ev(() => { COOK.timers[0].ends = Date.now() - 10; }); await settle(1300);
  ok('when it is up it says so', /Done/.test(await p.textContent('#cookTimers')) && await p.isVisible('.ctimer.ring'));
  said = await ev(() => window.__said);
  await settle(800);
  said = await ev(() => window.__said);
  ok('out loud as well, when reading aloud', said.some(s => /timer has finished/.test(s)), said.slice(-2).join(' | '));
  await p.click('[data-cookstop]'); await settle(200);
  await p.click('#cookNext'); await settle(200);
  ok('the end, with I cooked this', /All done/.test(await p.textContent('.cooklabel')) && await p.isVisible('#cookCooked'));
  ok('Next stops at the end', await p.isDisabled('#cookNext'));
  await p.click('#cookSay'); await settle(100);
  await ev(() => openCook(RECIPES.find(r => r.id === 302))); await settle(200);
  await ev(() => { COOK.timers.push({ id:1, label:'test', ends:Date.now() + 60000 }); });
  dialogs.length = 0;
  await ev(() => shutCook()); await settle(200);
  ok('closing with a timer running asks first', /timer is still running/.test(dialogs.join()) && !await p.isVisible('#cook'));
  ok('Read aloud stays as you left it', await ev(() => COOK_SAY === false));

  console.log('\nSomebody else’s recipe');
  await ev(() => openRecipe(401)); await settle(300);
  const theirs = await p.textContent('#rcpView');
  ok('you cannot change it, but can copy it or not see it', !/Change this recipe/.test(theirs)
     && /Make a copy of my own/.test(theirs) && /Don.t show me this one/.test(theirs));
  await clearWrites();
  await p.click('#rvCopy'); await settle(300);
  ok('a copy opens in the editor as Just me', await p.isVisible('#recipeEd') && await p.textContent('#reTitleBar') === 'Your copy'
     && await ev(() => document.querySelector('[data-rewho="me"]').getAttribute('aria-pressed')) === 'true');
  ok('the editor tidies the tray away too', await ev(() => $('tray').style.display === 'none'));
  await p.fill('#reTitle', 'My toffee pudding');
  await p.click('#reSave'); await settle(700);
  const cw = await writes();
  const copyIns = cw.find(w => w.op === 'insert' && w.table === 'recipes');
  const copied = cw.find(w => w.op === 'copyfile');
  ok('her photo is copied into your own folder', copied && copied.from === 'rec/sandra/p.jpg'
     && /^rec\/me\/.+\.jpg$/.test(copied.to), JSON.stringify(copied));
  ok('and the copy is yours, just you', copyIns && copyIns.rows.created_by === 'me' && copyIns.rows.share_all === false
     && copyIns.rows.title === 'My toffee pudding' && copyIns.rows.photos[0].path === copied.to
     && copyIns.rows.ingredients[0].name === 'dates', JSON.stringify(copyIns && copyIns.rows).slice(0, 200));
  ok('hers is left alone', !cw.some(w => w.op === 'update' && w.table === 'recipes'));

  await ev(() => openRecipe(402)); await settle(300);
  await clearWrites(); dialogs.length = 0;
  await p.click('#rvHide'); await settle(500);
  const hp = (await writes()).find(w => w.table === 'profiles');
  ok('Don’t show me this one is kept with your settings', hp && hp.patch.home_tiles.recipes.hide.includes(402));
  ok('and it goes from your list', !await p.isVisible('#recipe')
     && !(await ev(() => [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen))).includes(402));
  ok('a line at the bottom offers to show it', /Show the 1\s+you chose not to see/.test(await p.textContent('#rcpBody')));
  await p.click('#rcpShowHid'); await settle(200);
  ok('which brings it back into view', (await ev(() =>
     [...document.querySelectorAll('#rcpList [data-ropen]')].map(b => +b.dataset.ropen))).includes(402));
  await p.click('#rcpShowHid'); await settle(200);

  console.log('\nAdding one of your own');
  await clearWrites();
  await p.click('#rcpAdd'); await settle(300);
  ok('the editor opens empty, in the family cookbook', await p.textContent('#reTitleBar') === 'New recipe'
     && await ev(() => document.querySelector('[data-rewho="all"]').getAttribute('aria-pressed')) === 'true');
  await p.click('#reSave'); await settle(200);
  ok('it needs a title', await p.isVisible('#recipeEd') && !(await writes()).some(w => w.table === 'recipes'));
  await p.fill('#reTitle', 'Flapjack');
  await p.click('[data-recat="Baking"]');
  await p.fill('#reNewCat', 'Boat food'); await p.click('#reAddCat');
  await p.fill('#reServes', '12'); await p.fill('#reCook', '25');
  await p.fill('#reIngs', '250g oats\n125g butter\nFor the top:\n1 tbsp golden syrup');
  await p.fill('#rePrepSteps', '1. Heat the oven to 180C\n2. Line a tin');
  await p.fill('#reCookSteps', 'Melt the butter and syrup\nBake for 25 minutes');
  await p.fill('#reVideo', 'not a link');
  await p.click('#reSave'); await settle(200);
  ok('a video link has to be a web address', await p.isVisible('#recipeEd'));
  await p.fill('#reVideo', 'youtube.com/watch?v=flap');
  // A photo from the phone, as Camera or Choose would hand it over.
  await p.setInputFiles('#rePick', { name:'flap.png', mimeType:'image/png', buffer:Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await settle(900);
  const up = (await writes()).find(w => w.op === 'upload');
  ok('a photo goes straight up into your own folder', up && /^rec\/me\/.+\.jpg$/.test(up.path) && up.type === 'image/jpeg',
     JSON.stringify(up));
  ok('and shows as the cover', /Cover/.test(await p.textContent('#rePics')));
  await p.click('#reSave'); await settle(700);
  const add = (await writes()).find(w => w.op === 'insert' && w.table === 'recipes');
  const r = add && add.rows;
  ok('saved with everything split up properly', r && r.title === 'Flapjack' && r.serves === 12 && r.cook_mins === 25
     && r.prep_mins === null && r.ingredients.length === 4 && r.ingredients[2].head === 'For the top'
     && r.ingredients[3].unit === 'tbsp', JSON.stringify(r).slice(0, 300));
  ok('with both categories, the new one included', r && JSON.stringify(r.categories) === '["Baking","Boat food"]');
  ok('the steps without their numbers', r && JSON.stringify(r.prep_steps) === '["Heat the oven to 180C","Line a tin"]');
  ok('the video given its https://', r && r.video_url === 'https://youtube.com/watch?v=flap');
  ok('the photo', r && r.photos.length === 1 && r.photos[0].path === up.path);
  ok('in the family cookbook, as yours', r && r.share_all === true && r.created_by === 'me');
  ok('the new category joins your list', await ev(() => RCP_PREFS.cats.includes('Boat food')));

  console.log('\nChanging and deleting your own');
  await ev(() => openRecipe(301)); await settle(300);
  await p.click('#rvEdit'); await settle(300);
  ok('the editor has it as it was', await p.inputValue('#reTitle') === 'Leek and potato soup'
     && /To finish:/.test(await p.inputValue('#reIngs')) && /450g potatoes, peeled and diced/.test(await p.inputValue('#reIngs'))
     && /^Melt the butter\.\nSimmer/.test(await p.inputValue('#reCookSteps')));
  await clearWrites();
  await p.click('[data-repicx="0"]'); await settle(200);
  ok('removing a saved photo waits for Save', !(await writes()).some(w => w.op === 'rmfile'));
  await p.click('[data-rewho="me"]');
  await p.click('#reSave'); await settle(700);
  const ew = await writes();
  const upd = ew.find(w => w.op === 'update' && w.table === 'recipes');
  ok('saved over the same one', upd && upd.where.some(x => x[1] === 'id' && x[2] === 301)
     && upd.patch.share_all === false && upd.patch.photos.length === 0, JSON.stringify(upd && upd.patch).slice(0, 120));
  ok('and then the photo file goes', ew.some(w => w.op === 'rmfile' && w.paths.includes('rec/me/a.jpg')));
  await ev(() => openRecipe(301)); await settle(200);
  await p.click('#rvEdit'); await settle(300);
  await clearWrites(); dialogs.length = 0;
  await p.click('#reDel'); await settle(600);
  ok('Delete asks first, warning it goes for everyone', /for everyone/.test(dialogs.join()));
  ok('and deletes it', (await writes()).some(w => w.op === 'delete' && w.table === 'recipes'
     && w.where.some(x => x[1] === 'id' && x[2] === 301)));
  ok('back to the list', !await p.isVisible('#recipeEd') && !await p.isVisible('#recipe'));

  console.log('\nTo try: Keep and Reject');
  await ev(() => { window.__rows.recipes = window.__rows.recipes.filter(r => r.id !== 301); });
  await p.click('[data-ropen="303"]'); await settle(300);
  ok('a found one asks Keep or Reject at the top', await p.isVisible('#rvKeep') && await p.isVisible('#rvReject')
     && /Found on Good Food/.test(await p.textContent('.rcptry')));
  await clearWrites();
  await p.click('#rvKeep'); await settle(500);
  const kept = (await writes()).find(w => w.op === 'update' && w.table === 'recipes');
  ok('Keep moves it out of To try', kept && kept.patch.to_try === false && kept.where.some(x => x[2] === 303));
  await ev(() => { window.__rows.recipes.push({ id:304, created_by:'me', title:'Odd soup', categories:[],
    serves:null, ingredients:[], prep_steps:[], cook_steps:[], photos:[{url:'https://example.org/odd.jpg'}],
    to_try:true, share_all:true, source_url:'https://example.org/odd', source_name:'Example', created_at:'2026-10-26T10:00:00Z' }); });
  await ev(async () => { await loadRecipes(); RCP_CUR = null; openRecipe(304); }); await settle(300);
  ok('a picture from the web shows as it is', await ev(() => document.querySelector('.rcpcover').src) === 'https://example.org/odd.jpg');
  await clearWrites(); dialogs.length = 0;
  await p.click('#rvReject'); await settle(500);
  ok('Reject asks, then deletes it', /Reject "Odd soup"/.test(dialogs.join())
     && (await writes()).some(w => w.op === 'delete' && w.table === 'recipes' && w.where.some(x => x[2] === 304)));
  ok('without touching the photo store for a web picture', !(await writes()).some(w => w.op === 'rmfile'));

  console.log('\nFinding a recipe on the web');
  await p.click('#rcpFind'); await settle(300);
  await p.click('#frGoogle'); await settle(100);
  ok('it wants something to look for first', (await ev(() => window.__opened)).length === 0);
  await p.fill('#frQ', 'leek and potato soup');
  await p.click('#frGoogle'); await p.click('#frBbc'); await settle(100);
  const opened = await ev(() => window.__opened);
  ok('Google and BBC Good Food open in Chrome', opened[0] === 'https://www.google.com/search?q=recipe+leek%20and%20potato%20soup'
     && opened[1] === 'https://www.bbcgoodfood.com/search?q=leek%20and%20potato%20soup', opened.join(' '));
  await ev(() => { window.__invoke = (name, o) => ({ data:{ found:true, url:o.body.url, site:'Good Food',
    title:'Leek & potato soup', description:'A winter classic', image:'https://images.example/soup.jpg',
    ingredients:['50g butter', '450g potatoes'], steps:[{ text:'Melt the butter.' }, { head:'To serve:' },
    { text:'Simmer for 10 mins.' }], serves:8, prep_mins:20, cook_mins:25, video_url:'',
    categories:['Dinner', 'Soup', 'British'] }, error:null }); });
  await p.fill('#frUrl', 'https://www.bbcgoodfood.com/recipes/leek-potato-soup');
  await clearWrites();
  await p.click('#frRead'); await settle(900);
  const fw = await writes();
  ok('the reader is asked to read the page', fw.some(w => w.op === 'invoke' && w.name === 'read-recipe'
     && w.body.url === 'https://www.bbcgoodfood.com/recipes/leek-potato-soup'));
  const web = (fw.find(w => w.op === 'insert' && w.table === 'recipes') || {}).rows;
  ok('and what it found waits in To try', web && web.to_try === true && web.created_by === 'me'
     && web.title === 'Leek & potato soup' && web.serves === 8, JSON.stringify(web).slice(0, 200));
  ok('the ingredients are split up and the steps kept, heading and all', web && web.ingredients[1].qty === '450'
     && JSON.stringify(web.cook_steps) === '["Melt the butter.","To serve:","Simmer for 10 mins."]');
  ok('only the site’s categories that match yours: Soup is your Soups', web && JSON.stringify(web.categories) === '["Soups"]',
     JSON.stringify(web && web.categories));
  ok('its picture and where it came from', web && web.photos[0].url === 'https://images.example/soup.jpg'
     && web.source_name === 'Good Food' && web.notes === 'A winter classic');
  ok('and it opens, with Keep and Reject', await p.isVisible('#recipe') && await p.isVisible('#rvKeep'));

  await ev(() => { window.__invoke = () => ({ data:null, error:{ message:'read-recipe test: the website said no' } }); });
  await clearWrites();
  await ev(() => readRecipe('https://www.allrecipes.com/recipe/1/soup/', 'Soup from Allrecipes')); await settle(900);
  const nope = ((await writes()).find(w => w.op === 'insert' && w.table === 'recipes') || {}).rows;
  ok('a page that cannot be read still keeps its title and link', nope && nope.title === 'Soup from Allrecipes'
     && nope.source_url === 'https://www.allrecipes.com/recipe/1/soup/' && nope.to_try === true
     && nope.ingredients.length === 0 && nope.source_name === 'allrecipes.com', JSON.stringify(nope));
  await ev(() => { window.__rows.recipes.push({ id:305, created_by:'me', title:'Already here', categories:[],
    ingredients:[], prep_steps:[], cook_steps:[], photos:[], to_try:false, share_all:true,
    source_url:'https://www.bbc.co.uk/food/recipes/x', created_at:'2026-10-26T10:00:00Z' }); });
  await clearWrites(); dialogs.length = 0;
  p.removeAllListeners('dialog'); p.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  await ev(() => readRecipe('http://bbc.co.uk/food/recipes/x/', '')); await settle(600);
  ok('one you already have is caught before reading it again', /already have this one, as "Already here"/.test(dialogs.join())
     && !(await writes()).some(w => w.op === 'invoke'));
  p.removeAllListeners('dialog'); p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await ev(() => { delete window.__invoke; });

  console.log('\nArriving from Chrome’s Share menu');
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push('PAGE ERROR (share): ' + e.message));
  await p2.goto('file://' + path.join(__dirname, 'boot.html')
    + '?share_title=' + encodeURIComponent('Fish pie | BBC Good Food')
    + '&share_text=' + encodeURIComponent('https://www.bbcgoodfood.com/recipes/fish-pie'));
  await p2.waitForTimeout(1300);
  ok('it asks: a recipe or a link?', await p2.isVisible('#siRecipe') && /Fish pie/.test(await p2.textContent('.daypick')));
  await p2.evaluate(() => { window.__writes.length = 0; });
  await p2.click('#siRecipe'); await p2.waitForTimeout(1200);
  const sh = await p2.evaluate(() => window.__writes);
  ok('A recipe sends it to the reader and into To try', sh.some(w => w.op === 'invoke' && w.body.url === 'https://www.bbcgoodfood.com/recipes/fish-pie')
     && sh.some(w => w.op === 'insert' && w.table === 'recipes' && w.rows.to_try && w.rows.title === 'Fish pie | BBC Good Food'));
  ok('Recipes is open behind it', await p2.isVisible('#recipes'));
  ok('Today waits, rather than covering it', !(await p2.isVisible('#brief')));
  await p2.close();

  console.log('\nIdeas');
  await ev(() => { $('recipe').classList.add('hidden'); lockBackground(); });
  await p.click('#rcpIdeas'); await settle(800);
  ok('Ideas opens with some to look at', await p.isVisible('#ideas') && await ev(() => document.querySelectorAll('[data-idea]').length) >= 1);
  ok('it says where they come from', /TheMealDB/.test(await p.textContent('#ideasBody')));
  ok('with the collection’s own categories', await ev(() => [...document.querySelectorAll('[data-idcat]')].map(b => b.dataset.idcat).join('|')) === '|Chicken|Dessert');
  await p.fill('#idQ', 'zzz'); await p.press('#idQ', 'Enter'); await settle(500);
  ok('a search with nothing found says so', /Nothing there/.test(await p.textContent('#idList')));
  await p.click('[data-idcat="Chicken"]'); await settle(500);
  await p.click('[data-idea="52875"]'); await settle(500);
  ok('tapping one shows it first', /Chicken Ham and Leek Pie/.test(await p.textContent('.daypick'))
     && /450ml Chicken Stock/.test(await p.textContent('.idings')));
  await clearWrites();
  await p.click('#idAdd'); await settle(800);
  const idea = ((await writes()).find(w => w.op === 'insert' && w.table === 'recipes') || {}).rows;
  ok('Add to To try saves it there', idea && idea.to_try && idea.title === 'Chicken Ham and Leek Pie'
     && idea.source_name === 'TheMealDB' && idea.video_url === 'https://www.youtube.com/watch?v=pie'
     && idea.source_url === 'https://www.themealdb.com/meal/52875', JSON.stringify(idea).slice(0, 200));
  ok('with its ingredients and steps, the STEP lines dropped', idea && idea.ingredients.length === 2
     && idea.ingredients[0].qty === '450' && JSON.stringify(idea.cook_steps) === '["Heat the stock.","Simmer for 10 minutes.","Serve."]',
     JSON.stringify(idea && idea.cook_steps));
  ok('and opens it', await p.isVisible('#recipe') && !await p.isVisible('#ideas'));
  await ev(() => { $('recipe').classList.add('hidden'); lockBackground(); });

  console.log('\nTonight’s idea on Today');
  await ev(async () => { await loadRecipes(); RCP_PREFS.hide = []; openBrief(); }); await settle(500);
  const idea1 = await ev(() => { const b = document.querySelector('#briefRecipe [data-ropen]'); return b && +b.dataset.ropen; });
  ok('Today suggests one of the cookbook', !!idea1 && /Tonight.s idea/.test(await p.textContent('#briefBody')));
  ok('never one waiting in To try', await ev(id => !RECIPES.find(r => r.id === id).to_try, idea1));
  const again = await ev(() => { const r = rcpTodayPick(); return r && r.id; });
  ok('the same one all day', again === idea1);
  await p.click('[data-briefspin]'); await settle(200);
  const idea2 = await ev(() => +document.querySelector('#briefRecipe [data-ropen]').dataset.ropen);
  ok('↻ shows another', idea2 !== idea1);
  await p.click('#briefRecipe [data-ropen]'); await settle(500);
  ok('tapping it opens the recipe, with Recipes behind', await p.isVisible('#recipe') && await p.isVisible('#recipes')
     && !await p.isVisible('#brief'));
  await ev(() => { RCP_PREFS.today = false; openBrief(); }); await settle(300);
  ok('switched off in Settings, it is not there', !/Tonight.s idea/.test(await p.textContent('#briefBody')));
  await ev(() => { RCP_PREFS.today = true; shutBrief(); });

  console.log('\nSettings');
  await ev(() => openSettings('Recipes')); await settle(500);
  const st = await p.textContent('#setBody');
  ok('Recipes has its own heading in Settings', /Recipes/.test(st) && await ev(() =>
     !!document.querySelector('[data-setcard="rcpcats"]') && !!document.querySelector('[data-setcard="rcpcupboard"]')
     && !!document.querySelector('[data-setcard="rcphidden"]')));
  ok('the Today switch is under Home screen', await ev(() => !!$('rcpTodayOn') && $('rcpTodayOn').checked));
  await ev(() => { document.querySelector('[data-setcard="rcpcupboard"]').open = true; });
  await p.fill('#cupNew', 'Stock cubes'); await clearWrites(); await p.click('#cupAdd'); await settle(400);
  ok('the cupboard list takes a new one', await ev(() => RCP_PREFS.cupboard.includes('stock cubes'))
     && (await writes()).some(w => w.table === 'profiles'));
  await ev(async () => { RCP_PREFS.hide = [402]; await openSettings(); document.querySelector('[data-setcard="rcphidden"]').open = true; });
  await settle(300);
  ok('hidden recipes are listed with See again', /Kale smoothie/.test(await p.textContent('[data-setcard="rcphidden"]')));
  await p.click('[data-unhide="402"]'); await settle(400);
  ok('and See again brings one back', await ev(() => !RCP_PREFS.hide.includes(402)));
  await ev(() => { window.__rows.recipes.push({ id:306, created_by:'me', title:'Bread', categories:['Baking','Sides'],
    ingredients:[], prep_steps:[], cook_steps:[], photos:[], to_try:false, share_all:true, created_at:'2026-10-26T11:00:00Z' }); });
  await ev(async () => { await loadRecipes(); await openSettings(); document.querySelector('[data-setcard="rcpcats"]').open = true; });
  await settle(300);
  await clearWrites();
  await p.fill('[data-rcname="Baking"]', 'Bakes'); await p.dispatchEvent('[data-rcname="Baking"]', 'change'); await settle(600);
  const rn = (await writes()).filter(w => w.op === 'update' && w.table === 'recipes');
  ok('renaming a category changes your recipes to match', rn.some(w => w.where.some(x => x[2] === 306)
     && JSON.stringify(w.patch.categories) === '["Bakes","Sides"]'), JSON.stringify(rn.map(w => w.patch)));
  ok('but never anybody else’s', !rn.some(w => w.where.some(x => x[2] === 401 || x[2] === 402)));
  await ev(() => { $('settings').classList.add('hidden'); lockBackground(); });

  console.log('\nThe saved choices');
  const pf = await ev(() => rcpPrefsFrom({ recipes:{ cats:['A'], cupboard:[], hide:['7'], cooked:{ 5:{ n:2, last:'2026-10-01' } }, today:false } }));
  ok('come back as they were saved', JSON.stringify(pf) === JSON.stringify({ cats:['A'], cupboard:[], hide:[7],
     cooked:{ 5:{ n:2, last:'2026-10-01' } }, today:false }), JSON.stringify(pf));
  const pd = await ev(() => rcpPrefsFrom(null));
  ok('and anyone new gets the starting lists', pd.cats.includes('Soups') && pd.cupboard.includes('salt') && pd.today === true);

  console.log('\nThe backup, the menu and Help');
  ok('the backup in the app includes recipes', await ev(() => /from recipes t/.test(BACKUP_SQL_1)));
  ok('the menu offers Add, Find and Ideas', await ev(() => areaItems('recipes').map(i => i.label).join('|')) === 'Add a recipe|Find new recipes|Ideas');
  await ev(() => openHelp('recipes')); await settle(300);
  ok('Help has a section on it, and Help from Recipes goes there', await ev(() =>
     HELP_AT.recipes === 'h-recipes' && !!document.getElementById('h-recipes')
     && /Cook mode/.test($('helpBody').textContent) && /To try/.test($('helpBody').textContent)));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });
  await ev(() => { MENU_AREA = 'recipes'; goArea('home'); }); await settle(300);
  ok('leaving for the home screen puts Recipes away', !await p.isVisible('#recipes') && !await p.isVisible('#recipe'));

  console.log('\nFits a small phone');
  await p.setViewportSize({ width:320, height:640 });
  for (const [name, fn] of [['the list', () => openRecipes()], ['a recipe', () => { RCP_CUR = null; openRecipe(401); }],
                            ['the editor', () => editRecipe(306)], ['Cook mode', () => openCook(RECIPES.find(r => r.id === 401))]]) {
    await ev(fn); await settle(400);
    const w = await ev(() => document.documentElement.scrollWidth);
    ok(name + ' does not spill off the side at 320px', w <= 321, w + 'px');
  }
  await p.screenshot({ path:path.join(__dirname, 'recipes-cook.png') });
  await ev(() => shutCook());

  console.log('\nNo errors anywhere');
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
