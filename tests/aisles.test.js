// Aisles on shopping lists (asked for 30 Oct 2026, ML103, step 48): a list
// can have aisles in the order you walk round the shop, things sit in an
// aisle, the list reads in shop order, and an aisle is remembered for next
// time. The stand-in database records writes without applying them, so after
// each save the test puts the saved state into __rows itself.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('Bakery') : d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const writes = () => ev(() => window.__writes);
  const clear = () => ev(() => { window.__writes = []; });
  const last = async (op, table) => (await writes()).filter(w => w.op === op && (!table || w.table === table)).pop();
  const redraw = () => ev(() => loadShopping().then(renderShop));
  const heads = () => ev(() => [...document.querySelectorAll('#shopBody .aislehd')].map(h => h.textContent));
  const order = () => ev(() => [...document.querySelectorAll('#shopBody .rtlist')][0]
    .querySelectorAll('[data-sedit] .t').length && [...[...document.querySelectorAll('#shopBody .rtlist')][0]
    .querySelectorAll('[data-sedit] .t')].map(t => t.textContent.split(' — ')[0]));

  await ev(() => {
    window.__rows.shopping_lists = [{ id: 1, owner_id: 'me', name: 'Supermarket', aisles: [] },
      { id: 2, owner_id: 'sandra', name: 'Butcher', aisles: [{ id: 'b1', name: 'Counter' }, { id: 'b2', name: 'Freezer' }] }];
    window.__rows.shopping_list_shares = [{ list_id: 2, user_id: 'me' }];
    window.__rows.shopping = [
      { id: 1, list_id: 1, created_by: 'me', name: 'Ice cream', got: false, sort_order: 101 },
      { id: 2, list_id: 1, created_by: 'me', name: 'Apples', got: false, sort_order: 102 },
      { id: 3, list_id: 1, created_by: 'me', name: 'Batteries', got: false, sort_order: 103 },
      { id: 4, list_id: 1, created_by: 'me', name: 'Milk', got: true, got_at: '2026-10-30T10:00:00Z', sort_order: 104 },
      { id: 5, list_id: 2, created_by: 'sandra', name: 'Sausages', got: false, sort_order: 101, aisle: 'b1' }];
    window.__rows.shopping_aisle_memory = [];
  });

  // ---------------------------------------------------------------
  console.log('\nA list with no aisles yet');
  await ev(() => openShop()); await settle(600);
  ok('reads as before, with no aisle headings', (await heads()).length === 0);
  ok('and no aisle box when adding', await ev(() => !$('sAisle')));
  ok('the owner has "Aisles, in shop order" at the bottom', await ev(() =>
    /Aisles, in shop order/.test($('sAisles').textContent)));
  await clear();
  await p.fill('#sName', 'Bread'); await p.click('#sAdd'); await settle();
  let w = await last('insert', 'shopping');
  ok('adding sends no aisle (works before step 48)', w && !('aisle' in w.rows), JSON.stringify(w && w.rows));
  ok('and remembers nothing', !(await last('upsert', 'shopping_aisle_memory')));

  console.log('\nStarting with supermarket aisles');
  await clear();
  await ev(() => { $('sAisles').open = true; });
  await p.click('#sAisleStart'); await settle();
  w = await last('update', 'shopping_lists');
  const names = w && w.patch.aisles.map(a => a.name);
  ok('saves the 12 supermarket aisles on this list', names && names.length === 12
     && names[0] === 'Fruit & Veg' && names[3] === 'Frozen & Ice Cream' && names[11] === 'Health, Beauty & Baby',
     JSON.stringify(names));
  ok('each with its own id', w && new Set(w.patch.aisles.map(a => a.id)).size === 12);
  ok('on the right list', w && JSON.stringify(w.where) === JSON.stringify([['eq', 'id', 1]]));
  const A = w.patch.aisles;
  const id = n => A.find(a => a.name === n).id;
  await ev(a => { window.__rows.shopping_lists[0].aisles = a; }, A);
  await redraw(); await settle();
  ok('the aisles panel stays open after saving', await ev(() => $('sAisles').open));
  ok('and lists them in order', await ev(() => [...document.querySelectorAll('.aislerow span')].map(s => s.textContent).join('|'))
     === A.map(a => a.name).join('|'));

  console.log('\nThe list in shop order');
  ok('with nothing sorted, everything is under Not sorted yet', JSON.stringify(await heads()) === '["Not sorted yet"]');
  await ev(([f, v]) => { const s = window.__rows.shopping;
    s.find(x => x.id === 1).aisle = f; s.find(x => x.id === 2).aisle = v; }, [id('Frozen & Ice Cream'), id('Fruit & Veg')]);
  await redraw(); await settle();
  ok('sorted things sit under their aisle, in shop order, unsorted first',
     JSON.stringify(await heads()) === JSON.stringify(['Not sorted yet', 'Fruit & Veg', 'Frozen & Ice Cream']),
     JSON.stringify(await heads()));
  ok('and the things follow', JSON.stringify(await order()) === JSON.stringify(['Batteries', 'Apples', 'Ice cream']),
     JSON.stringify(await order()));
  ok('empty aisles are left out', !(await heads()).includes('Meat & Fish'));
  ok('the trolley is not split into aisles', await ev(() =>
    !document.querySelectorAll('#shopBody .rtlist')[1].querySelector('.aislehd')));

  console.log('\nAdding with an aisle');
  ok('the add box now has an aisle choice', await ev(() =>
    $('sAisle') && $('sAisle').options.length === 13 && $('sAisle').value === ''));
  await clear();
  await p.fill('#sName', 'Cheddar'); await p.selectOption('#sAisle', id('Dairy, Juice & Ready Meals'));
  await p.click('#sAdd'); await settle();
  w = await last('insert', 'shopping');
  ok('the thing goes in with its aisle', w && w.rows.aisle === id('Dairy, Juice & Ready Meals'), JSON.stringify(w && w.rows));
  let m = await last('upsert', 'shopping_aisle_memory');
  ok('and the aisle is remembered for this list, by name in lower case', m && m.rows.list_id === 1
     && m.rows.name === 'cheddar' && m.rows.aisle === id('Dairy, Juice & Ready Meals'), JSON.stringify(m && m.rows));
  await ev(r => { window.__rows.shopping_aisle_memory.push({ list_id: 1, name: 'cheddar', aisle: r }); }, id('Dairy, Juice & Ready Meals'));
  await redraw(); await settle();
  await p.fill('#sName', 'Chedd'); await settle(100);
  ok('typing part of it picks nothing', await ev(() => $('sAisle').value) === '');
  await p.fill('#sName', ' CHEDDAR'); await ev(() => $('sName').dispatchEvent(new Event('input'))); await settle(100);
  ok('typing it again picks its aisle by itself', await ev(() => $('sAisle').value) === id('Dairy, Juice & Ready Meals'));

  console.log('\nSorting something already on the list');
  await clear();
  await p.click('[data-sedit="3"]'); await settle();
  ok('the box has an aisle choice, set to not sorted', await ev(() => $('seAisle') && $('seAisle').value === ''));
  await p.selectOption('#seAisle', id('Pet Food & Household'));
  await p.click('#seGo'); await settle();
  w = await last('update', 'shopping');
  ok('Save puts it in that aisle', w && w.patch.aisle === id('Pet Food & Household'), JSON.stringify(w && w.patch));
  m = await last('upsert', 'shopping_aisle_memory');
  ok('and remembers it', m && m.rows.name === 'batteries' && m.rows.aisle === id('Pet Food & Household'));
  await clear();
  await p.click('[data-sedit="2"]'); await settle();
  ok('one already sorted shows its aisle', await ev(() => $('seAisle').value) === id('Fruit & Veg'));
  await p.selectOption('#seAisle', ''); await p.click('#seGo'); await settle();
  w = await last('update', 'shopping');
  ok('it can be put back to not sorted', w && w.patch.aisle === null, JSON.stringify(w && w.patch));
  ok('which forgets nothing', !(await last('upsert', 'shopping_aisle_memory')));

  console.log('\nChanging the aisles');
  await clear();
  await p.click('[data-adown="0"]'); await settle();
  w = await last('update', 'shopping_lists');
  ok('the down arrow moves an aisle later', w && w.patch.aisles[0].name === 'Meat & Fish' && w.patch.aisles[1].name === 'Fruit & Veg');
  ok('the first cannot go up, the last cannot go down', await ev(() =>
    document.querySelector('[data-aup="0"]').disabled && document.querySelector('[data-adown="11"]').disabled));
  await clear();
  await p.click('[data-aup="5"]'); await settle();
  w = await last('update', 'shopping_lists');
  ok('the up arrow moves one earlier', w && w.patch.aisles[4].name === 'Home Baking, Eggs & Bread');
  await clear();
  await p.click('[data-aname="5"]'); await settle();
  w = await last('update', 'shopping_lists');
  ok('the pencil renames it, keeping its id', w && w.patch.aisles[5].name === 'Bakery' && w.patch.aisles[5].id === A[5].id);
  await clear();
  await p.fill('#sAisleNew', 'Click and collect'); await p.click('#sAisleAdd'); await settle();
  w = await last('update', 'shopping_lists');
  ok('another aisle goes on the end', w && w.patch.aisles.length === 13 && w.patch.aisles[12].name === 'Click and collect');
  await clear();
  await p.click('[data-adel="3"]'); await settle();
  w = await last('update', 'shopping_lists');
  ok('the × takes one off', w && w.patch.aisles.length === 11 && !w.patch.aisles.some(a => a.name === 'Frozen & Ice Cream'));
  await ev(a => { window.__rows.shopping_lists[0].aisles = a; }, A.filter(a => a.name !== 'Frozen & Ice Cream'));
  await redraw(); await settle();
  ok('what was in it goes to Not sorted yet', JSON.stringify(await order()).includes('Ice cream')
     && (await heads())[0] === 'Not sorted yet');
  ok('and a thing remembered there is not put back in it', await ev(([fr]) => {
    SHOP_MEM.push({ list_id: 1, name: 'ice cream', aisle: fr }); return aisleFor(1, 'Ice cream'); },
    [id('Frozen & Ice Cream')]) === null);
  ok('a thing remembered in an aisle still there is', await ev(() => aisleFor(1, 'cheddar')) === id('Dairy, Juice & Ready Meals'));
  ok('memory is per list', await ev(() => aisleFor(2, 'cheddar')) === null);

  console.log('\nSomebody else\'s list shared with you');
  await ev(() => { CUR_LIST = 2; renderShop(); }); await settle();
  ok('reads in their aisle order', JSON.stringify(await heads()) === '["Counter"]');
  ok('you can pick an aisle when adding', await ev(() => !!$('sAisle')));
  ok('but only the owner can change the aisles', await ev(() => !$('sAisles')));

  console.log('\nBefore step 48 has been run');
  await ev(() => { CUR_LIST = 1; renderShop(); }); await settle();
  ok('saving aisles that fail says to run step 48', await ev(async () => {
    const real = sb.from; let said = '';
    sb.from = t => t === 'shopping_lists' ? { update: () => ({ eq: () =>
      Promise.resolve({ error: { message: 'column "aisles" of relation "shopping_lists" does not exist' } }) }) } : real(t);
    const t0 = toast, e0 = console.error; toast = s => { said = s; }; console.error = () => {};
    await saveAisles([]); sb.from = real; toast = t0; console.error = e0; return said; }) === 'Aisles need step 48 run in Supabase first');

  console.log('\nHelp');
  await ev(() => openHelp && openHelp()); await settle();
  ok('Help explains aisles', /Start with supermarket aisles/.test(await ev(() => $('helpBody').textContent)));

  console.log(errors.length ? '\nErrors:\n' + errors.join('\n') : '\nNo page errors.');
  if (errors.length) fail++;
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
