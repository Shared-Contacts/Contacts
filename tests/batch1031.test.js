// The 31 Oct 2026 batch (asked 30 Oct): hiding those who have died from the
// pickers (ML98), finished headings on Regular dropping down (ML107), the
// partner's name (ML108, step 49), opening an accepted contact (ML109), the
// iPhone keyboard sheet (ML110) and favourite recipes (ML111).
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
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);

  await ev(() => {
    STATUSES.splice(0, STATUSES.length,
      { id: 1, name: 'Married' }, { id: 2, name: 'Partner' }, { id: 3, name: 'Engaged' },
      { id: 4, name: 'Single' }, { id: 9, name: 'Died' });
  });

  console.log('\nRegular: finished headings go to the bottom (ML107)');
  const heads = await ev(() => {
    ROUTINES = [
      { id: 1, title: 'Oil', heading: 'Boat', done: true, done_at: '2026-10-01', sort_order: 1 },
      { id: 2, title: 'Tax', heading: 'Admin', done: false, sort_order: 2 },
      { id: 3, title: 'Shower', heading: 'Cleaning', done: true, done_at: '2026-10-02', sort_order: 3 },
      { id: 4, title: 'Gas', heading: 'Boat', done: true, done_at: '2026-10-03', sort_order: 4 },
      { id: 5, title: 'Bin', heading: '', done: false, sort_order: 5 },
      { id: 6, title: 'Post', heading: 'ASAP', done: false, sort_order: 6 }];
    const d = document.createElement('div'); d.innerHTML = diaryRoutine();
    return [...d.querySelectorAll('[data-rthead]')].map(x => x.dataset.rthead || '(none)');
  });
  ok('headings with jobs to do come first, A to Z, then none', heads.slice(0, 3).join() === 'Admin,ASAP,(none)', heads.join());
  ok('all-ticked headings drop below them', heads.slice(3).join() === 'Boat,Cleaning', heads.join());

  console.log('\nHiding those who have died (ML98)');
  await ev(() => {
    CONTACTS.push({ id: 9001, first_name: 'Albert', last_name: 'Gone', death_date: '2020-01-01', status_id: null },
      { id: 9002, first_name: 'Alberta', last_name: 'Here', status_id: 4 },
      { id: 9003, first_name: 'Alfred', last_name: 'Late', status_id: 9 });
  });
  const hitsFor = async () => {
    const pr = ev(() => { window.__pk = pickContact('Who?', null); });
    await settle(150);
    await p.fill('#pkQ', 'Alb'); await p.dispatchEvent('#pkQ', 'input'); await settle(150);
    await p.fill('#pkQ', 'Al'); await p.dispatchEvent('#pkQ', 'input'); await settle(150);
    const t = await ev(() => [...document.querySelectorAll('#pkHits [data-pk]')].map(x => x.textContent.trim()));
    await p.click('#pkCancel'); await pr; return t;
  };
  ok('it starts off', await ev(() => HIDE_GONE === false));
  let names = await hitsFor();
  ok('with it off, the picker finds them', names.includes('Albert Gone') && names.includes('Alfred Late'), names.join());
  await ev(() => { HIDE_GONE = true; });
  names = await hitsFor();
  ok('with it on, a date in Died keeps them out', !names.includes('Albert Gone'), names.join());
  ok('and so does the status Died', !names.includes('Alfred Late'), names.join());
  ok('the living still show', names.includes('Alberta Here'), names.join());
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const linkCode = (src.match(/const box=\$\('linkSearch'\)[\s\S]{0,700}/) || [''])[0];
  ok('Link to another person is not filtered', linkCode && !/pickable/.test(linkCode));
  await ev(() => { window.__writes = []; });
  await ev(() => openSettings()); await settle();
  const hasBox = await ev(() => !!document.getElementById('hideGone'));
  ok('Settings has the tick box', hasBox);
  if (hasBox) {
    await ev(() => { const h = document.getElementById('hideGone'); h.checked = false; h.dispatchEvent(new Event('change', { bubbles: true })); });
    await settle();
    ok('unticking it turns it off', await ev(() => HIDE_GONE === false));
    const w = await ev(() => window.__writes.filter(x => x.table === 'profiles').pop());
    ok('and saves it with your own settings', !!w && JSON.stringify(w).includes('"hidegone":false'), JSON.stringify(w || {}).slice(0, 200));
    ok('the label reads right', /Hide people who have died from searches/.test(await ev(() => document.getElementById('hideGone').closest('label').textContent)));
  }
  await ev(() => $('settings') && $('settings').classList.add('hidden'));

  console.log('\nPartner\'s name on the card (ML108)');
  const hn = await ev(() => [
    headName({ first_name: 'Mary', last_name: 'Smith', partner_name: 'John', status_id: 1 }),
    headName({ first_name: 'Mary', last_name: 'Smith', partner_name: 'John', status_id: 2 }),
    headName({ first_name: 'Mary', last_name: 'Smith', partner_name: 'John Brown', status_id: 3 }),
    headName({ first_name: 'Mary', last_name: 'Smith', partner_name: 'John', status_id: 4 }),
    headName({ first_name: 'Mary', last_name: 'Smith', partner_name: '', status_id: 1 }),
    headName({ first_name: 'Mary', last_name: '', partner_name: 'John', status_id: 1 }),
    listName({ first_name: 'Mary', last_name: 'Smith', partner_name: 'John', status_id: 1 })]);
  ok('married: Mary and John Smith', hn[0] === 'Mary and John Smith', hn[0]);
  ok('partner: Mary Smith and John', hn[1] === 'Mary Smith and John', hn[1]);
  ok('engaged, own surname: Mary Smith and John Brown', hn[2] === 'Mary Smith and John Brown', hn[2]);
  ok('single: just Mary Smith', hn[3] === 'Mary Smith', hn[3]);
  ok('no partner given: just Mary Smith', hn[4] === 'Mary Smith', hn[4]);
  ok('no surname, married: Mary and John', hn[5] === 'Mary and John', hn[5]);
  ok('the list still reads Smith, Mary', hn[6] === 'Smith, Mary', hn[6]);

  await ev(() => CONTACTS.push({ id: 9010, first_name: 'Mary', last_name: 'Smith', partner_name: 'John',
    status_id: 1, updated_at: '2026-10-30T10:00:00Z', created_by: ME.id }));
  await ev(() => openDetail(9010)); await settle();
  ok('the card heading shows both', await ev(() => document.querySelector('h2.detname').textContent) === 'Mary and John Smith');
  ok('and so does the top bar', await ev(() => $('detTitle').textContent) === 'Mary and John Smith');

  await ev(() => openEditor(CONTACTS.find(c => c.id === 9010))); await settle(500);
  const order = await ev(() => [...$('edForm').querySelectorAll('legend')].map(l => l.textContent.trim()));
  ok('Status and dates comes straight after Name', order.indexOf('Status and dates') === order.indexOf('Name') + 1, order.join(' | '));
  ok('and Groups after it', order.indexOf('Groups') > order.indexOf('Status and dates'), order.join(' | '));
  ok('the partner box is filled in', await ev(() => $('edForm').elements.partner_name.value) === 'John');
  ok('and showing, as they are married', await ev(() => $('partnerRow').style.display !== 'none'));
  ok('the line under it shows how it reads', /Mary and John Smith/.test(await ev(() => $('partnerHint').textContent)));
  await ev(() => { const s = $('edForm').elements.status_id; s.value = '4'; s.dispatchEvent(new Event('change')); });
  ok('change to Single and it hides', await ev(() => $('partnerRow').style.display === 'none'));
  await ev(() => { const s = $('edForm').elements.status_id; s.value = '2'; s.dispatchEvent(new Event('change')); });
  ok('change to Partner and it is back', await ev(() => $('partnerRow').style.display !== 'none'));
  ok('reading Mary Smith and John', /Mary Smith and John/.test(await ev(() => $('partnerHint').textContent)));
  await ev(() => { window.__writes = []; $('edForm').querySelector('input[name="grp"]').checked = true; $('edForm').elements.partner_name.value = 'john brown'; });
  await ev(() => saveContact(CONTACTS.find(c => c.id === 9010))); await settle(500);
  const up = await ev(() => window.__writes.filter(w => w.table === 'contacts' && w.op === 'update').pop());
  ok('saving sends the partner, tidied to John Brown', up && up.patch.partner_name === 'John Brown', String(JSON.stringify(up && up.patch)).slice(0, 300) + ' ' + JSON.stringify(await ev(() => window.__writes.map(w => w.op + ':' + w.table))));

  await ev(() => { $('editor') && $('editor').classList.add('hidden'); });
  await ev(() => openEditor(null)); await settle(500);
  ok('a new contact has the partner box hidden till a status is picked', await ev(() => $('partnerRow').style.display === 'none'));
  await ev(() => { window.__writes = []; const f = $('edForm');
    f.elements.first_name.value = 'Tom'; f.querySelector('input[name="grp"]').checked = true; });
  await ev(() => saveContact(null)); await settle(500);
  const ins = await ev(() => window.__writes.filter(w => w.table === 'contacts' && w.op === 'insert').pop());
  ok('one saved without a partner does not send the column (safe before step 49)',
    ins && !('partner_name' in (Array.isArray(ins.rows) ? ins.rows[0] : ins.rows)), JSON.stringify(ins && ins.rows).slice(0, 200));
  ok('the partner\'s name goes in exports, imports and sharing', await ev(() => IO_COLS.includes('partner_name')));
  await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); });

  console.log('\nAccepting a shared contact opens it (ML109)');
  const next = await ev(async () => (await sb.from('zz').insert({}).select().single()).data.id + 1);
  await ev(n => {
    if (!GROUPS.some(g => g.name === 'Shared with me' && g.owner_id === ME.id))
      GROUPS.push({ id: 880, name: 'Shared with me', owner_id: ME.id, sort_order: 900 });
    window.__rows.contacts.push({ id: n, first_name: 'Ann', last_name: 'Lee', created_by: ME.id, updated_at: '2026-10-31T09:00:00Z' });
    OFFERS = [{ id: 71, to_user: ME.id, from_user: 'sandra', name: 'Ann Lee', payload: { first_name: 'Ann', last_name: 'Lee' } },
      { id: 72, to_user: ME.id, from_user: 'sandra', name: 'Bob Ray', payload: { first_name: 'Bob', last_name: 'Ray' } }];
  }, next);
  await ev(() => acceptOffers([71, 72])); await settle(700);
  ok('the editor opens', await ev(() => !!$('edForm') && $('edForm').offsetParent !== null));
  ok('on the first one accepted', await ev(() => $('edForm').elements.first_name.value) === 'Ann',
    await ev(() => $('edForm') && $('edForm').elements.first_name.value));
  await ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); });

  console.log('\niPhone keyboard: the sheet moves down with the page (ML110)');
  const vt = await ev(() => {
    const vv = window.visualViewport; const fire = () => vv.dispatchEvent(new Event('scroll'));
    const real = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'offsetTop');
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 260 });
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 420 });
    fire();
    const r = document.documentElement.style;
    const a = [r.getPropertyValue('--vtop'), r.getPropertyValue('--vh')];
    const s = document.querySelector('.sheet'); s.classList.remove('hidden');
    const top = getComputedStyle(s).top, h = getComputedStyle(s).height;
    s.classList.add('hidden');
    delete vv.offsetTop; delete vv.height; fire();
    return a.concat([top, h, r.getPropertyValue('--vtop')]);
  });
  ok('the slide is measured', vt[0] === '260px', vt.join());
  ok('the sheet starts where the visible part does', vt[2] === '260px', vt.join());
  ok('and is the visible height', vt[3] === '420px', vt.join());
  ok('with the keyboard gone it is back at the top', vt[4] === '0px', vt.join());

  console.log('\nRecipes: favourites and categories (ML111)');
  await ev(() => {
    window.__rows.recipes = [
      { id: 1, created_by: 'me', title: 'Soup', categories: ['Soups'], ingredients: [], prep_steps: [], cook_steps: [], photos: [], to_try: false, share_all: true, created_at: '2026-10-20T10:00:00Z' },
      { id: 2, created_by: 'me', title: 'Bread', categories: ['Baking', 'Sides'], ingredients: [], prep_steps: [], cook_steps: [], photos: [], to_try: false, share_all: true, created_at: '2026-10-21T10:00:00Z' },
      { id: 3, created_by: 'me', title: 'Pie', categories: [], ingredients: [], prep_steps: [], cook_steps: [], photos: [], to_try: false, share_all: true, created_at: '2026-10-22T10:00:00Z' },
      { id: 4, created_by: 'me', title: 'Chilli', categories: ['Mains'], ingredients: [], prep_steps: [], cook_steps: [], photos: [], to_try: false, share_all: true, created_at: '2026-10-23T10:00:00Z' }];
    RCP_PREFS.cats = ['Sides', 'Soups']; RCP_PREFS.fav = [];
  });
  await ev(() => openRecipes()); await settle(600);
  const groups = () => ev(() => [...document.querySelectorAll('#rcpList .dsec')].map(d => d.childNodes[0].textContent.trim()));
  const under = t => ev(t => { const d = [...document.querySelectorAll('#rcpList .dsec')].find(x => x.childNodes[0].textContent.trim() === t);
    return d ? [...d.nextElementSibling.querySelectorAll('[data-ropen]')].map(r => Number(r.dataset.ropen)) : null; }, t);
  let g = await groups();
  ok('grouped: your category order, then the rest A to Z, then none', g.join() === 'Sides,Soups,Baking,Mains,Not in a category', g.join());
  ok('a recipe in two categories shows under both', (await under('Sides')).includes(2) && (await under('Baking')).includes(2));
  ok('no favourites heading while there are none', !g.some(x => /favourites/.test(x)));
  await ev(() => openRecipe(4)); await settle(400);
  ok('a recipe has the star', await ev(() => $('rvFav') && $('rvFav').textContent.trim() === '☆'));
  await ev(() => { window.__writes = []; $('rvFav').click(); }); await settle(500);
  ok('pressing it fills the star', await ev(() => $('rvFav').textContent.trim() === '★'));
  ok('it is remembered as yours', await ev(() => RCP_PREFS.fav.includes(4)));
  ok('and saved', await ev(() => window.__writes.some(w => w.table === 'profiles' && JSON.stringify(w).includes('"fav":[4]'))));
  await ev(() => $('recipe').classList.add('hidden')); await ev(() => renderRecipes()); await settle(300);
  g = await groups();
  ok('My favourites sits at the top', g[0] === '★ My favourites', g.join());
  ok('with the chilli in it', (await under('★ My favourites')).join() === '4');
  ok('and not under Mains as well', !g.includes('Mains'), g.join());
  ok('the row has a star', await ev(() => !!document.querySelector('#rcpList [data-ropen="4"] .rcpstar')));
  await ev(() => { RCP.q = 'bread'; paintRecipeList(); });
  ok('searching gives a plain list', await ev(() => !document.querySelector('#rcpList .dsec')
    && [...document.querySelectorAll('#rcpList [data-ropen]')].length === 1));
  await ev(() => { RCP.q = ''; RCP.cat = 'Sides'; paintRecipeList(); });
  ok('so does a category chip', await ev(() => !document.querySelector('#rcpList .dsec')));
  await ev(() => { RCP.cat = ''; openRecipe(4); }); await settle(300);
  await ev(() => $('rvFav').click()); await settle(400);
  ok('pressing again takes it off', await ev(() => !RCP_PREFS.fav.includes(4) && $('rvFav').textContent.trim() === '☆'));
  await ev(() => { RECIPES.find(r => r.id === 1).to_try = true; openRecipe(1); }); await settle(300);
  ok('no star on one still in To try', await ev(() => !$('rvFav')));
  ok('favourites survive a reload of settings', await ev(() => rcpPrefsFrom({ recipes: { fav: [1, '2', 'x'] } }).fav.join() === '1,2'));

  console.log('\nHelp');
  const help = await ev(() => document.documentElement.innerHTML.replace(/\s+/g, ' '));
  ok('mentions the tick box', /Hide people who have died from searches<\/strong> under Settings/.test(help));
  ok('mentions the partner\'s name', /Partner&rsquo;s name\.<\/strong>|Partner’s name\.<\/strong>/.test(help));
  ok('mentions favourites', /My favourites<\/strong>, which sit at the top/.test(help));

  ok('no errors on the page', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
