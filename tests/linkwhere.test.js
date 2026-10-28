// URL Links: Show on (Laptop, Both or Phone) for each link (asked for
// 28 Oct 2026, ML71). Your own choice, kept with your link settings, so it
// works on links shared with you too and needs nothing new in the database.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const seed = () => {
  window.__rows.url_links = [
    { id:101, created_by:'me', url:'https://bank.barclays.co.uk/', title:'Barclays',
      description:null, level:'everyday', subjects:[], share_all:false, opens:5,
      last_opened:null, created_at:'2026-10-01T10:00:00Z' },
    { id:102, created_by:'me', url:'https://www.youtube.com/watch?v=abc', title:'Lock video',
      description:null, level:'everyday', subjects:[], share_all:false, opens:2,
      last_opened:null, created_at:'2026-10-02T10:00:00Z' },
    { id:103, created_by:'me', url:'https://www.metoffice.gov.uk/', title:'Met Office',
      description:null, level:'everyday', subjects:[], share_all:false, opens:1,
      last_opened:null, created_at:'2026-10-03T10:00:00Z' },
    { id:201, created_by:'sandra', url:'https://www.bbc.co.uk/food', title:'Her recipes',
      description:null, level:'maybe', subjects:[], share_all:true, opens:0,
      last_opened:null, created_at:'2026-10-05T10:00:00Z' }];
  window.__rows.url_link_shares = [];
  LINK_PREFS.where = { 101:'laptop', 102:'phone' };
  LNK.level = 'all'; LNK.elsewhere = false;
};

const boot = async (b, phone) => {
  const ctx = await b.newContext(phone
    ? { viewport:{ width:390, height:844 },
        userAgent:'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' }
    : { viewport:{ width:1200, height:800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  return p;
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await boot(b, true);
  const ev = (f, a) => p.evaluate(f, a);
  const writes = () => ev(() => window.__writes);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const shown = () => ev(() => [...document.querySelectorAll('#lnkList [data-lopen]')].map(a => Number(a.dataset.lopen)).sort());
  const foot = () => ev(() => { const f = document.querySelector('#lnkList .lhid'); return f ? f.textContent.replace(/\s+/g, ' ').trim() : ''; });
  const prefsSaved = async () => { const w = (await writes()).filter(x => x.op === 'update' && x.table === 'profiles').pop();
    return w && w.patch.home_tiles.links.where; };

  console.log('\nOn the phone');
  ok('the phone knows it is a phone', await ev(() => ON_PHONE === true));
  await ev(seed);
  await ev(() => openLinks()); await settle(700);
  ok('a laptop-only link is left out', JSON.stringify(await shown()) === '[102,103,201]', JSON.stringify(await shown()));
  ok('a phone-only link shows, and says so', await ev(() => /phone only/.test(document.querySelector('[data-lopen="102"]').textContent)));
  ok('a link for both says nothing', await ev(() => !/only/.test(document.querySelector('[data-lopen="103"] .lmeta').textContent)));
  ok('the line under the list says one is hidden', /^1 laptop-only link hidden ?Show them$/.test(await foot()), await foot());
  ok('the All count leaves it out too', await ev(() => /All · 3/.test(document.querySelector('[data-llevel="all"]').textContent.replace(/·/, '·'))),
     await ev(() => document.querySelector('[data-llevel="all"]').textContent));
  await p.click('[data-lelse]'); await settle(200);
  ok('Show them brings it back', JSON.stringify(await shown()) === '[101,102,103,201]', JSON.stringify(await shown()));
  ok('marked laptop only', await ev(() => /laptop only/.test(document.querySelector('[data-lopen="101"]').textContent)));
  ok('and the line now offers to hide them', /showing ?Hide them$/.test(await foot()), await foot());
  await p.click('[data-lelse]'); await settle(200);
  ok('Hide them puts it away again', JSON.stringify(await shown()) === '[102,103,201]');
  await p.click('[data-llevel="everyday"]'); await settle(200);
  ok('the line is there on a single level too', /1 laptop-only link hidden/.test(await foot()), await foot());
  await p.click('[data-llevel="all"]'); await settle(200);

  console.log('\nChanging one of your own');
  await ev(() => editLink(103)); await settle();
  const choices = () => ev(() => [...document.querySelectorAll('[data-lewhere]')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join('|'));
  ok('Show on is in the box, on Both', await choices() === 'Laptop|Both*|Phone', await choices());
  await p.click('[data-lewhere="laptop"]');
  ok('only one can be chosen', await choices() === 'Laptop*|Both|Phone', await choices());
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  let w = await prefsSaved();
  ok('it is kept with your link settings', w && w[103] === 'laptop' && w[101] === 'laptop' && w[102] === 'phone', JSON.stringify(w));
  ok('the link row itself is not touched by it', (await writes()).some(x => x.op === 'update' && x.table === 'url_links' && x.patch.where === undefined && !('show_on' in x.patch)));
  ok('it goes from the phone list', JSON.stringify(await shown()) === '[102,201]', JSON.stringify(await shown()));
  ok('and you are told where it went', await ev(() => /laptop only/.test($('toasts').textContent)), await ev(() => $('toasts').textContent));
  ok('the line now counts two', /^2 laptop-only links hidden/.test(await foot()), await foot());

  await ev(() => editLink(102)); await settle();
  ok('a phone-only one opens on Phone', await choices() === 'Laptop|Both|Phone*', await choices());
  await p.click('[data-lewhere=""]');
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  w = await prefsSaved();
  ok('putting it back to Both takes it off the list', w && !(102 in w) && w[103] === 'laptop', JSON.stringify(w));
  await ev(() => editLink(102)); await settle();
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  ok('saving with nothing changed does not save the settings again', !(await writes()).some(x => x.table === 'profiles'));

  console.log('\nAdding one');
  await ev(() => editLink(null, { url:'https://www.example.org/' })); await settle();
  ok('a new link starts on Both', await choices() === 'Laptop|Both*|Phone', await choices());
  await p.click('[data-lewhere="phone"]');
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  const ins = (await writes()).find(x => x.op === 'insert' && x.table === 'url_links');
  w = await prefsSaved();
  ok('its choice is kept under its new number', ins && w && Object.entries(w).some(([k, v]) => v === 'phone'), JSON.stringify(w));
  ok('a phone-only one added on the phone just says Added', await ev(() => /Added$/.test($('toasts').textContent.trim())), await ev(() => $('toasts').textContent));

  console.log('\nSomebody else\'s link');
  await ev(() => linkActions(201)); await settle();
  ok('Show on is offered for a shared link too', await ev(() => [...document.querySelectorAll('[data-lawhere]')].map(b => b.textContent).join('|')) === 'Laptop|Both|Phone');
  await ev(() => { window.__writes = []; });
  await p.click('[data-lawhere="laptop"]'); await settle(500);
  w = await prefsSaved();
  ok('choosing one saves it straight away', w && w[201] === 'laptop', JSON.stringify(w));
  ok('nothing of theirs is changed', !(await writes()).some(x => x.table === 'url_links' || x.table === 'url_link_shares'));
  await ev(() => document.querySelector('#laShut').click()); await settle(200);
  ok('it goes from the phone list as well', !(await shown()).includes(201), JSON.stringify(await shown()));

  console.log('\nEverything kept for the laptop');
  await ev(() => { LINK_PREFS.where = { 101:'laptop', 102:'laptop', 103:'laptop', 201:'laptop' }; renderLinks(); });
  await settle(200);
  ok('it says so rather than look empty', await ev(() => /All your links are kept for the laptop/.test($('lnkList').textContent)));
  ok('not that there are no links', await ev(() => !/No links yet/.test($('lnkList').textContent)));
  ok('with the way to see them', /4 laptop-only links hidden ?Show them/.test(await foot()), await foot());

  console.log('\nDeleting one');
  await ev(() => { LINK_PREFS.where = { 101:'laptop', 103:'laptop' }; LNK.elsewhere = true; renderLinks(); });
  await ev(() => editLink(101)); await settle();
  await ev(() => { window.__writes = []; });
  await p.click('#leDel'); await settle(600);
  w = await prefsSaved();
  ok('its Show on goes with it', w && !(101 in w) && w[103] === 'laptop', JSON.stringify(w));

  console.log('\nAfter a reload');
  ok('the choices come back', await ev(() => { const x = linkPrefsFrom({ links:{ where:{ 5:'laptop', 6:'phone' } } }).where;
    return x[5] === 'laptop' && x[6] === 'phone'; }));
  ok('and settings from before this change still load', await ev(() => JSON.stringify(linkPrefsFrom({ links:{ openWith:'chrome' } }).where) === '{}'
    && JSON.stringify(linkPrefsFrom(null).where) === '{}'));

  console.log('\nOn the laptop');
  const pc = await boot(b, false);
  ok('the laptop knows it is not a phone', await pc.evaluate(() => ON_PHONE === false));
  await pc.evaluate(seed);
  await pc.evaluate(() => openLinks()); await pc.waitForTimeout(700);
  const pcShown = await pc.evaluate(() => [...document.querySelectorAll('#lnkList [data-lopen]')].map(a => Number(a.dataset.lopen)).sort());
  ok('the laptop-only link shows, the phone-only one does not', JSON.stringify(pcShown) === '[101,103,201]', JSON.stringify(pcShown));
  const pcFoot = await pc.evaluate(() => { const f = document.querySelector('#lnkList .lhid'); return f ? f.textContent.replace(/\s+/g, ' ').trim() : ''; });
  ok('and the line says one phone-only link is hidden', /^1 phone-only link hidden ?Show them$/.test(pcFoot), pcFoot);

  console.log('\n' + '='.repeat(52));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
