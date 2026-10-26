// URL Links: a library of web links with levels, subjects, search and
// sharing (ML48, step 42, asked for 26 Oct 2026).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const seed = () => {
  window.__rows.url_links = [
    { id:101, created_by:'me', url:'https://www.metservice.com/national', title:'NZ weather',
      description:'MetService forecast', level:'everyday', subjects:['Weather','New Zealand'],
      share_all:false, opens:9, last_opened:'2026-10-25T08:00:00Z', created_at:'2026-10-01T10:00:00Z' },
    { id:102, created_by:'me', url:'https://www.bbc.co.uk/news', title:'BBC News',
      description:null, level:'everyday', subjects:['News'],
      share_all:false, opens:20, last_opened:'2026-10-26T07:00:00Z', created_at:'2026-09-01T10:00:00Z' },
    { id:103, created_by:'me', url:'https://canalrivertrust.org.uk/notices', title:'Stoppages',
      description:'Closures on the canals', level:'favourites', subjects:['Canals','Mapping'],
      share_all:false, opens:2, last_opened:null, created_at:'2026-10-20T10:00:00Z' },
    { id:104, created_by:'me', url:'https://example.org/odd', title:'Odd one',
      description:null, level:'gone-level', subjects:[], share_all:false, opens:0,
      last_opened:null, created_at:'2026-10-21T10:00:00Z' },
    { id:201, created_by:'sandra', url:'https://www.stuff.co.nz', title:'Stuff',
      description:'NZ news', level:'maybe', subjects:['News','New Zealand'],
      share_all:false, opens:5, last_opened:null, created_at:'2026-10-02T10:00:00Z' },
    { id:202, created_by:'sandra', url:'https://www.windy.com', title:'Windy',
      description:null, level:'everyday', subjects:['Weather'],
      share_all:true, opens:0, last_opened:null, created_at:'2026-10-03T10:00:00Z' }];
  window.__rows.url_link_shares = [
    { link_id:103, viewer_id:'sandra' },
    { link_id:201, viewer_id:'me' }];
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|url_links\" does not exist/i.test(t)) errors.push('CONSOLE: ' + t); });
  const dialogs = [];
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  // A tap on a link would open a new window; the count is what is being tested.
  await p.addInitScript(() => {
    document.addEventListener('click', ev => {
      const a = ev.target.closest && ev.target.closest('a[target="_blank"]');
      if (a) ev.preventDefault();
    }, true);
  });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = f => p.evaluate(f);
  const writes = () => ev(() => window.__writes);
  const settle = (ms = 400) => p.waitForTimeout(ms);

  console.log('\nFinding a web address in whatever was pasted');
  const found = await ev(() => ({
    plain: findUrl('https://www.bbc.co.uk/news'),
    words: findUrl('Look at this https://www.metoffice.gov.uk/weather/forecast. Good'),
    bare:  findUrl('bbc.co.uk/news'),
    www:   findUrl('www.windy.com'),
    none:  findUrl('just some words'),
    js:    findUrl('javascript:alert(1)'),
    host:  linkHost('https://www.metoffice.gov.uk/weather'),
    same:  sameUrl('https://www.bbc.co.uk/news/', 'http://bbc.co.uk/news') }));
  ok('a plain address', found.plain === 'https://www.bbc.co.uk/news', found.plain);
  ok('one inside other words, without the full stop after it',
     found.words === 'https://www.metoffice.gov.uk/weather/forecast', found.words);
  ok('one without https:// gets it', found.bare === 'https://bbc.co.uk/news' && found.www === 'https://www.windy.com',
     found.bare + ' ' + found.www);
  ok('words alone are not an address', found.none === '');
  ok('a script is never taken for an address', found.js === '');
  ok('the title guess is the site name', found.host === 'metoffice.gov.uk', found.host);
  ok('www. and a closing slash do not make it a different page', found.same === true);

  console.log('\nThe tile');
  ok('URL Links can go on the home screen', await ev(() => TILE_DEST.links && TILE_DEST.links.label === 'URL Links'));
  ok('and arrives on everyone\'s home screen', await ev(() => TILES.some(t => t.dest === 'links')));
  await ev(seed);
  await ev(() => { const i = TILES.findIndex(t => t.dest === 'links');
    document.querySelector(`[data-tile="${i}"]`).click(); });
  await settle(700);
  ok('the tile opens URL Links', await p.isVisible('#links'));
  ok('the bar says URL Links', /URL Links/.test(await p.textContent('#links .title')));

  console.log('\nThe list');
  const heads = await p.$$eval('#lnkList .dsec', els => els.map(e => e.childNodes[0].textContent.trim()));
  ok('grouped by level, in order, then Unsorted, then shared',
     JSON.stringify(heads) === JSON.stringify(['Everyday', 'Favourites', 'Unsorted', 'Shared with you']),
     JSON.stringify(heads));
  const everyday = await p.$$eval('#lnkList .card:first-of-type .lnk b', els => els.map(e => e.textContent));
  ok('most used first', JSON.stringify(everyday.slice(0, 2)) === '["BBC News","NZ weather"]', JSON.stringify(everyday));
  const a = await p.$eval('[data-lopen="101"]', e => ({ href: e.getAttribute('href'), target: e.target, rel: e.rel }));
  ok('each one is a real link that opens in its own window',
     a.href === 'https://www.metservice.com/national' && a.target === '_blank' && /noopener/.test(a.rel), JSON.stringify(a));
  const row101 = await p.textContent('[data-lopen="101"]');
  ok('it shows the site and the subjects', /metservice\.com/.test(row101) && /Weather/.test(row101) && /New Zealand/.test(row101), row101);
  ok('and how often it has been opened', /opened 9 times/.test(row101));
  ok('a link shared with you says who from', /from Sandra/.test(await p.textContent('[data-lopen="201"]')));
  ok('so does one shared with everyone', /from Sandra/.test(await p.textContent('[data-lopen="202"]')));
  ok('one of yours shared by name says with whom', /shared with Sandra/.test(await p.textContent('[data-lopen="103"]')));
  ok('your own have a pencil, other people\'s have the other button',
     await p.textContent('[data-ledit="101"]') === '✎' && await p.textContent('[data-ledit="201"]') === '⋮');

  console.log('\nOpening one');
  await ev(() => { window.__writes = []; });
  await p.click('[data-lopen="101"]'); await settle(300);
  const opened = (await writes()).find(w => w.op === 'update' && w.table === 'url_links');
  ok('opening your own counts it', opened && opened.patch.opens === 10 && opened.patch.last_opened, JSON.stringify(opened));
  await ev(() => { window.__writes = []; });
  await p.click('[data-lopen="201"]'); await settle(300);
  ok('opening somebody else\'s changes nothing of theirs',
     !(await writes()).some(w => w.table === 'url_links'));

  console.log('\nSearching');
  await p.fill('#lnkQ', 'nz weather'); await settle(300);
  let shown = await p.$$eval('#lnkList [data-lopen]', els => els.map(e => +e.dataset.lopen));
  ok('every word has to match, in any order', JSON.stringify(shown) === '[101]', JSON.stringify(shown));
  ok('the search box keeps the keyboard while you type', await ev(() => document.activeElement.id === 'lnkQ'));
  await p.fill('#lnkQ', 'closures'); await settle(300);
  shown = await p.$$eval('#lnkList [data-lopen]', els => els.map(e => +e.dataset.lopen));
  ok('the description is searched', JSON.stringify(shown) === '[103]', JSON.stringify(shown));
  await p.fill('#lnkQ', 'sandra'); await settle(300);
  shown = await p.$$eval('#lnkList [data-lopen]', els => els.map(e => +e.dataset.lopen).sort());
  ok('so is who shared it', JSON.stringify(shown) === '[201,202]', JSON.stringify(shown));
  await p.fill('#lnkQ', 'zzzz'); await settle(300);
  ok('nothing found says so', /Nothing matches that/.test(await p.textContent('#lnkList')));
  await p.fill('#lnkQ', ''); await settle(300);

  console.log('\nNarrowing it down');
  await p.click('[data-llevel="favourites"]'); await settle();
  shown = await p.$$eval('#lnkList [data-lopen]', els => els.map(e => +e.dataset.lopen));
  ok('one level', JSON.stringify(shown) === '[103]', JSON.stringify(shown));
  await p.click('[data-llevel="all"]'); await settle();
  await p.click('[data-lsubj="News"]'); await settle();
  shown = await p.$$eval('#lnkList [data-lopen]', els => els.map(e => +e.dataset.lopen).sort());
  ok('one subject, yours and shared', JSON.stringify(shown) === '[102,201]', JSON.stringify(shown));
  const subjChips = await p.$$eval('[data-lsubj]', els => els.map(e => e.dataset.lsubj));
  ok('only subjects in use are offered', !subjChips.includes('Photography') && subjChips.includes('Canals'), JSON.stringify(subjChips));
  await p.click('[data-lsubj=""]'); await settle();
  await p.click('[data-llevel="shared"]'); await settle();
  shown = await p.$$eval('#lnkList [data-lopen]', els => els.map(e => +e.dataset.lopen).sort());
  ok('shared with you', JSON.stringify(shown) === '[201,202]', JSON.stringify(shown));
  await p.click('[data-llevel="all"]'); await settle();
  await p.click('[data-lsort="az"]'); await settle();
  const allTitles = await p.$$eval('#lnkList .card:first-of-type .lnk b', els => els.map(e => e.textContent));
  ok('A to Z', JSON.stringify(allTitles) === '["BBC News","NZ weather"]', JSON.stringify(allTitles));
  await p.click('[data-lsort="used"]'); await settle();

  console.log('\nPasting a new one');
  await ev(() => { Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{
    readText: async () => 'Have a look https://www.metoffice.gov.uk/weather/forecast. Good',
    writeText: async t => { window.__copied = t; } } }); });
  await p.click('#lnkPaste'); await settle();
  ok('the box opens', await p.isVisible('.lnked'));
  ok('with the address from the clipboard',
     await p.inputValue('#leUrl') === 'https://www.metoffice.gov.uk/weather/forecast', await p.inputValue('#leUrl'));
  ok('and a title from it', await p.inputValue('#leTitle') === 'metoffice.gov.uk', await p.inputValue('#leTitle'));
  ok('on your first level unless you choose', await ev(() =>
     document.querySelector('[data-lelv="everyday"]').getAttribute('aria-pressed') === 'true'));
  const fits = await ev(() => { const r = document.querySelector('.lnked .inner').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth; });
  ok('the box fits a phone screen', fits);
  await p.fill('#leTitle', 'Met Office');
  await p.click('[data-lelv="favourites"]');
  await p.click('[data-lesub="Weather"]');
  await p.fill('#leNewSub', 'Boating'); await p.click('#leAddSub');
  await p.click('[data-lewho="some"]');
  ok('choosing people shows the people', await p.isVisible('#lePeople'));
  await p.check('[data-leppl="sandra"]');
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(700);
  let w = await writes();
  const ins = w.find(x => x.op === 'insert' && x.table === 'url_links');
  const r = ins && ins.rows;
  ok('it is added', r && r.url === 'https://www.metoffice.gov.uk/weather/forecast' && r.title === 'Met Office'
     && r.level === 'favourites' && r.created_by === 'me' && r.share_all === false, JSON.stringify(r));
  ok('with both subjects', r && JSON.stringify(r.subjects) === '["Weather","Boating"]', r && JSON.stringify(r.subjects));
  const sh = w.find(x => x.op === 'insert' && x.table === 'url_link_shares');
  ok('and shared with Sandra', sh && sh.rows.length === 1 && sh.rows[0].viewer_id === 'sandra', JSON.stringify(sh));
  const pr = w.find(x => x.op === 'update' && x.table === 'profiles');
  ok('a new subject joins your list for next time',
     pr && pr.patch.home_tiles.links.subjects.includes('Boating'), JSON.stringify(pr && pr.patch.home_tiles.links));
  ok('the box closes', !(await p.isVisible('.lnked')));

  console.log('\nThe same page twice');
  await ev(() => { navigator.clipboard.readText = async () => 'http://bbc.co.uk/news/'; });
  dialogs.length = 0;
  await p.click('#lnkPaste'); await settle();
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(500);
  ok('you are asked first', dialogs.some(d => /already have this one, as "BBC News"/.test(d)), JSON.stringify(dialogs));

  console.log('\nWhen the phone will not hand over the clipboard');
  await ev(() => { navigator.clipboard.readText = async () => { throw new Error('denied'); }; });
  await p.click('#lnkPaste'); await settle();
  ok('the box still opens, empty, for you to paste into',
     await p.isVisible('.lnked') && await p.inputValue('#leUrl') === '');
  await p.fill('#leUrl', 'www.windy.com/?52,-1,8'); await settle(100);
  ok('the title follows what you paste', await p.inputValue('#leTitle') === 'windy.com', await p.inputValue('#leTitle'));
  await p.fill('#leUrl', 'not an address');
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(300);
  ok('something that is not an address is refused',
     !(await writes()).some(x => x.table === 'url_links') && await p.isVisible('.lnked'));
  await p.click('#leCancel'); await settle(200);

  console.log('\nChanging one of yours');
  await p.click('[data-ledit="103"]'); await settle();
  ok('it opens with what it has', await p.inputValue('#leTitle') === 'Stoppages'
     && await ev(() => document.querySelector('[data-lesub="Canals"]').getAttribute('aria-pressed') === 'true')
     && await ev(() => document.querySelector('[data-lewho="some"]').getAttribute('aria-pressed') === 'true'));
  await p.click('#leCopy'); await settle(200);
  ok('the address can be copied', await ev(() => window.__copied) === 'https://canalrivertrust.org.uk/notices');
  await p.click('[data-lewho="all"]');
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  w = await writes();
  const up = w.find(x => x.op === 'update' && x.table === 'url_links');
  ok('shared with everyone', up && up.patch.share_all === true, JSON.stringify(up && up.patch));
  ok('so the names come off', w.some(x => x.op === 'delete' && x.table === 'url_link_shares'
     && x.where.some(c => c[1] === 'viewer_id' && JSON.stringify(c[2]) === '["sandra"]')), JSON.stringify(w));
  await p.click('[data-ledit="104"]'); await settle();
  await ev(() => { window.__writes = []; });
  dialogs.length = 0;
  await p.click('#leDel'); await settle(500);
  ok('one can be deleted, after asking', dialogs.some(d => /Delete "Odd one"/.test(d))
     && (await writes()).some(x => x.op === 'delete' && x.table === 'url_links'));

  console.log('\nSomebody else\'s');
  await p.click('[data-ledit="201"]'); await settle();
  ok('their button offers what you can do', /Keep a copy of my own/.test(await p.textContent('.daypick'))
     && /Stop seeing it/.test(await p.textContent('.daypick')));
  await p.click('#laKeep'); await settle();
  ok('keeping a copy opens it as a new one of yours', await p.isVisible('.lnked')
     && await p.inputValue('#leTitle') === 'Stuff' && /Add a link/.test(await p.textContent('.lnked')));
  await p.click('#leCancel'); await settle(200);
  await p.click('[data-ledit="201"]'); await settle();
  await ev(() => { window.__writes = []; });
  await p.click('#laHide'); await settle(500);
  ok('stop seeing one shared by name takes your name off it', (await writes()).some(x =>
     x.op === 'delete' && x.table === 'url_link_shares' && x.where.some(c => c[1] === 'viewer_id' && c[2] === 'me')));
  await p.click('[data-ledit="202"]'); await settle();
  await ev(() => { window.__writes = []; });
  await p.click('#laHide'); await settle(500);
  const hid = (await writes()).find(x => x.op === 'update' && x.table === 'profiles');
  ok('one shared with everyone is put out of sight on your side',
     hid && hid.patch.home_tiles.links.hide.includes(202), JSON.stringify(hid && hid.patch.home_tiles.links));
  ok('and it goes from the list', (await p.$$('[data-lopen="202"]')).length === 0);

  console.log('\nSettings');
  await ev(() => openSettings('URL Links')); await settle(600);
  ok('URL Links has its own heading in Settings', await ev(() =>
     [...document.querySelectorAll('#setBody p.dsec')].some(x => x.textContent.trim() === 'URL Links')));
  await ev(() => document.querySelectorAll('[data-setcard="linklevels"],[data-setcard="linksubjects"]')
     .forEach(d => d.open = true)); await settle(200);
  const lvNames = await p.$$eval('[data-lvname]', els => els.map(e => e.value));
  ok('the four levels', JSON.stringify(lvNames) === '["Everyday","Favourites","Interesting","Maybe"]', JSON.stringify(lvNames));
  await ev(() => { window.__writes = []; });
  await p.fill('[data-lvname="maybe"]', 'Someday');
  await p.dispatchEvent('[data-lvname="maybe"]', 'change'); await settle(500);
  let pw = (await writes()).find(x => x.op === 'update' && x.table === 'profiles');
  ok('a level can be renamed', pw && pw.patch.home_tiles.links.levels.find(x => x.id === 'maybe').name === 'Someday');
  await ev(() => { window.__writes = []; });
  await p.click('[data-lvmv="favourites:up"]'); await settle(500);
  pw = (await writes()).find(x => x.op === 'update' && x.table === 'profiles');
  ok('and moved', pw && pw.patch.home_tiles.links.levels[0].id === 'favourites',
     JSON.stringify(pw && pw.patch.home_tiles.links.levels));
  await ev(() => { window.__writes = []; });
  dialogs.length = 0;
  await ev(() => document.querySelectorAll('[data-setcard="linksubjects"]').forEach(d => d.open = true));
  await p.click('[data-sjdrop="Canals"]'); await settle(600);
  w = await writes();
  ok('removing a subject says how many links have it', dialogs.some(d => /comes off 1 of your links/.test(d)), JSON.stringify(dialogs));
  ok('and takes it off them', w.some(x => x.op === 'update' && x.table === 'url_links'
     && JSON.stringify(x.patch.subjects) === '["Mapping"]'), JSON.stringify(w.filter(x => x.table === 'url_links')));
  await ev(() => { $('settings').classList.add('hidden'); lockBackground(); });

  console.log('\nBefore step 42 has been run');
  await ev(() => {
    const from = sb.from.bind(sb);
    sb.from = t => t === 'url_links'
      ? { select: () => ({ order: () => Promise.resolve({ data:null,
          error:{ message:'relation "url_links" does not exist' } }) }) }
      : from(t);
  });
  await ev(() => openLinks()); await settle(500);
  const notset = await p.textContent('#linksBody');
  ok('it says to run step 42, not that there are no links', /step 42/.test(notset) && !/No links yet/.test(notset), notset);
  await ev(() => { delete sb.from; });

  console.log('\nThe backup, the menu and Help');
  const sql = await ev(() => BACKUP_SQL_1);
  ok('the backup in the app includes the links', /from url_links t/.test(sql) && /from url_link_shares t/.test(sql));
  ok('and the Daily Log sharing it had missed', /from log_shares t/.test(sql));
  ok('the menu offers Paste a link', await ev(() => areaItems('links').some(i => i.label === 'Paste a link')));
  await ev(() => openHelp('links')); await settle(300);
  ok('Help has a section on it, and Help from URL Links goes there', await ev(() =>
     HELP_AT.links === 'h-urllinks' && /URL Links/.test((document.getElementById('h-urllinks')||{}).textContent||'')));
  await ev(() => { $('help').classList.add('hidden'); lockBackground(); });
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
  ok('Chrome\'s Share menu can send a page to the app', man.share_target && man.share_target.method === 'GET'
     && man.share_target.action === man.scope && man.share_target.params.url === 'share_url', JSON.stringify(man.share_target));

  console.log('\nArriving from Chrome\'s Share menu');
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push('PAGE ERROR (share): ' + e.message));
  await p2.goto('file://' + path.join(__dirname, 'boot.html')
    + '?share_title=' + encodeURIComponent('Met Office forecast')
    + '&share_text=' + encodeURIComponent('Look https://www.metoffice.gov.uk/weather/forecast'));
  await p2.waitForTimeout(1300);
  // Since Recipes (step 43) the app first asks which it is.
  ok('it asks whether it is a recipe or a link',
     await p2.isVisible('#siLink') && await p2.isVisible('#siRecipe'));
  await p2.click('#siLink');
  await p2.waitForTimeout(500);
  ok('URL Links opens', await p2.isVisible('#links'));
  ok('with the page ready to save', await p2.isVisible('.lnked')
     && await p2.inputValue('#leUrl') === 'https://www.metoffice.gov.uk/weather/forecast', await p2.inputValue('#leUrl').catch(() => ''));
  ok('under the title Chrome sent', await p2.inputValue('#leTitle') === 'Met Office forecast');
  ok('Today waits, rather than covering it', !(await p2.isVisible('#brief')));

  console.log('\nNo errors anywhere');
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
