// The 31 Oct 2026 second batch: the partner's name in the Jotter (ML118),
// Edit recipe on the top bar and I cooked this up top (ML119), the note under
// Add a regular job (ML120), and an ASAP job on Today opening itself (ML121).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const shown = id => ev(id => !document.getElementById(id).classList.contains('hidden'), id);

  console.log('\nRegular: a note under the add box (ML120)');
  const note = await ev(() => { const d = document.createElement('div'); ROUTINES = []; d.innerHTML = diaryRoutine();
    return d.querySelector('#rtAdd').parentElement.textContent.replace(/\s+/g, ' '); });
  ok('it says the heading can be anything', /Change the heading to whatever category you want/.test(note), note);

  console.log('\nToday: tapping an ASAP job opens it (ML121)');
  await ev(() => {
    ROUTINES = [{ id: 31, title: 'Grease the stern gland', heading: 'ASAP', done: false, sort_order: 1, photos: [] },
      { id: 32, title: 'Paint the roof', heading: 'Boat', done: false, sort_order: 2, photos: [] }];
    openBrief();
  });
  await settle();
  ok('the job is on Today', await ev(() => !!document.querySelector('[data-briefr="31"]')));
  await p.click('[data-briefr="31"]'); await settle(500);
  ok('its own screen opens', await shown('rtEd'));
  ok('on that job', await ev(() => $('rtForm').elements.title.value) === 'Grease the stern gland');
  ok('with the Regular list underneath', await shown('diary') && await ev(() => DIARY_VIEW === 'routine'));
  ok('Today is closed', !(await shown('brief')));
  await p.click('#rtCancel'); await settle(300);
  ok('Cancel leaves you on the Regular list', !(await shown('rtEd')) && await shown('diary'));
  await ev(() => document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')));

  console.log('\nRecipes: Edit recipe and I cooked this (ML119)');
  await ev(() => {
    window.__rows.recipes = [
      { id: 1, created_by: 'me', title: 'Soup', categories: ['Soups'], serves: 4,
        ingredients: [{ qty: '1', unit: '', name: 'leek' }], prep_steps: [], cook_steps: ['Boil.'], photos: [],
        to_try: false, share_all: true, created_at: '2026-10-20T10:00:00Z' },
      { id: 2, created_by: 'sandra', title: 'Pudding', categories: [], serves: 4,
        ingredients: [], prep_steps: [], cook_steps: ['Bake.'], photos: [],
        to_try: false, share_all: true, created_at: '2026-10-21T10:00:00Z' }];
    RCP_PREFS.cooked = {};
  });
  await ev(() => openRecipes()); await settle(500);
  await ev(() => openRecipe(1)); await settle(400);
  ok('your own recipe has Edit recipe on the top bar', await ev(() => $('rvBar').textContent.trim()) === 'Edit recipe');
  ok('Change this recipe has gone from the bottom', !/Change this recipe/.test(await ev(() => $('rcpView').textContent)));
  const pos = await ev(() => {
    const at = el => el ? el.getBoundingClientRect().top : -1;
    return { cooked: at($('rvCooked')), cook: at($('rvCook')),
      ings: at([...document.querySelectorAll('#rcpView .dsec')].find(d => /Ingredients/.test(d.textContent))) };
  });
  ok('I cooked this sits just under Cook mode', pos.cooked > pos.cook && pos.cooked < pos.ings, JSON.stringify(pos));
  const bg = await ev(() => getComputedStyle($('rvCooked')).backgroundColor);
  // The gold of the colour scheme in use (brass), not Cook mode's colour.
  const want = await ev(() => { const d = document.createElement('div'); d.style.color = 'var(--brass)';
    $('rcpView').appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  const cook = await ev(() => getComputedStyle($('rvCook')).backgroundColor);
  ok('as a coloured button, the gold', bg === want && bg !== cook, bg + ' / ' + want + ' / ' + cook);
  await p.click('#rvCooked'); await settle(400);
  ok('pressing it counts', await ev(() => RCP_PREFS.cooked[1] && RCP_PREFS.cooked[1].n === 1));
  ok('and says so on the button', /1 time, last/.test(await ev(() => $('rvCooked').textContent)));
  await p.click('#rvEdit'); await settle(500);
  ok('Edit recipe opens the recipe to change', await shown('recipeEd'));
  await ev(() => { $('recipeEd').classList.add('hidden'); openRecipe(2); }); await settle(400);
  ok('someone else\'s recipe has no Edit on the bar', await ev(() => $('rvBar').textContent.trim()) === '');
  ok('Make a copy of my own is still at the bottom', !!(await ev(() => $('rvCopy'))));
  ok('and Don\'t show me this one', !!(await ev(() => $('rvHide'))));
  ok('they can say they cooked it too', !!(await ev(() => $('rvCooked'))));
  await ev(() => { RECIPES.find(r => r.id === 1).to_try = true; openRecipe(1); }); await settle(300);
  ok('no I cooked this on one still in To try', !(await ev(() => $('rvCooked'))));
  ok('help points at Edit recipe', /with <strong>Edit recipe<\/strong> at the top right/.test(await ev(() => document.documentElement.innerHTML)));

  console.log('\nThe Jotter: a partner\'s name (ML118)');
  const j = await b.newPage({ viewport: { width: 390, height: 844 } });
  j.on('pageerror', e => errors.push('JOT PAGE ERROR: ' + e.message));
  j.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('JOT CONSOLE: ' + m.text()); });
  await j.addInitScript(() => { localStorage.removeItem('jot-recent'); localStorage.removeItem('jot-statuses'); });
  await j.goto('file://' + path.join(__dirname, 'jotboot.html'));
  await j.waitForTimeout(800);
  const jv = (f, a) => j.evaluate(f, a);
  await jv(() => {
    window.__rows.statuses = [{ id: 1, name: 'Married' }, { id: 2, name: 'Partner' }, { id: 3, name: 'Engaged' }, { id: 4, name: 'Single' }];
    window.__writes = [];
  });
  ok('the partner box is there', await j.isVisible('#fPartner'));
  ok('the three choices wait until a name is typed', !(await j.isVisible('#fKinds')));
  await j.fill('#fFirst', 'Mary'); await j.fill('#fLast', 'Smith'); await j.fill('#fPartner', 'John');
  ok('type one and they appear', await j.isVisible('#fKinds'));
  await j.click('#save'); await j.waitForTimeout(400);
  ok('saving without picking one asks which', /Married, partner or engaged/.test(await j.textContent('body')));
  ok('and nothing is sent', !(await jv(() => window.__writes.some(w => w.op === 'insert' && w.table === 'contacts'))));
  await j.click('[data-kind="Married"]');
  ok('Married is picked', await j.getAttribute('[data-kind="Married"]', 'aria-pressed') === 'true');
  await j.click('#save'); await j.waitForTimeout(600);
  const ins = await jv(() => window.__writes.filter(w => w.op === 'insert' && w.table === 'contacts').pop());
  const row = ins && (Array.isArray(ins.rows) ? ins.rows[0] : ins.rows);
  ok('it goes in with the partner', row && row.partner_name === 'John', JSON.stringify(row));
  ok('and as Married', row && row.status_id === 1, JSON.stringify(row));
  ok('the recent list reads Mary and John Smith', /Mary and John Smith/.test(await j.textContent('#recent')));
  ok('the form is cleared, choices hidden again', (await j.inputValue('#fPartner')) === '' && !(await j.isVisible('#fKinds')));

  await j.fill('#fFirst', 'Ann'); await j.fill('#fLast', 'Lee'); await j.fill('#fPartner', 'Bob Ray');
  await j.click('[data-kind="Engaged"]'); await jv(() => { window.__writes = []; });
  await j.click('#save'); await j.waitForTimeout(600);
  ok('engaged reads Ann Lee and Bob Ray', /Ann Lee and Bob Ray/.test(await j.textContent('#recent')));
  await j.fill('#fFirst', 'Tom'); await jv(() => { window.__writes = []; });
  await j.click('#save'); await j.waitForTimeout(600);
  const plain = await jv(() => { const w = window.__writes.filter(w => w.op === 'insert' && w.table === 'contacts').pop();
    return w && (Array.isArray(w.rows) ? w.rows[0] : w.rows); });
  ok('no partner: nothing extra is sent', plain && !('partner_name' in plain) && !('status_id' in plain), JSON.stringify(plain));

  await jv(() => {
    window.__offline = true;
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    window.__realFrom = sb.from.bind(sb);
    sb.from = t => t === 'contacts'
      ? { insert: () => ({ select: () => ({ single: () => Promise.reject(new Error('Failed to fetch')) }) }) }
      : window.__realFrom(t);
  });
  await j.fill('#fFirst', 'Sue'); await j.fill('#fPartner', 'Ed'); await j.click('[data-kind="Partner"]');
  await j.click('#save'); await j.waitForTimeout(600);
  const q = await jv(() => JSON.parse(localStorage.getItem('jot-waiting') || '[]').pop());
  ok('the waiting entry keeps the partner and the choice', q && q.partner_name === 'Ed' && q.partner_kind === 'Partner', JSON.stringify(q && { p: q.partner_name, k: q.partner_kind }));
  await jv(() => { window.__offline = false; sb.from = window.__realFrom;
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }); });

  await jv(() => { window.__rows.contacts = (window.__rows.contacts || []).concat(
    { id: 801, first_name: 'Jane', last_name: 'Doe', partner_name: 'Jim', status_id: 1, created_by: 'me' },
    { id: 802, first_name: 'Jake', last_name: 'Dove', partner_name: 'Kim', status_id: 4, created_by: 'me' }); });
  await j.click('#tabFind'); await j.fill('#q', 'Ja'); await j.waitForTimeout(700);
  const hits = (await j.textContent('#hits')).replace(/\s+/g, ' ');
  ok('the finder shows Jane and Jim Doe', /Jane and Jim Doe/.test(hits), hits.slice(0, 160));
  ok('but just Jake Dove when single', /Jake Dove/.test(hits) && !/Kim/.test(hits), hits.slice(0, 160));

  ok('no errors on either page', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
