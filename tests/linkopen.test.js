// URL Links: Open with, chosen once when a link is added (asked for
// 27 Oct 2026, step 45). Run as an Android phone, since that is the only
// place the app is asked for by name. Chrome was taken off the list on
// 28 Oct 2026 (ML70): on the phone it only ever opened the window inside the app.
// Firefox was added the same day (ML82) to open pages as a browser of its own;
// without Firefox a link set to it goes to Firefox's Play Store page (ML86).
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const seed = () => {
  window.__rows.url_links = [
    { id:101, created_by:'me', url:'https://www.bbc.co.uk/news', title:'BBC News',
      description:null, level:'everyday', subjects:['News'], share_all:false, opens:3,
      last_opened:null, created_at:'2026-10-01T10:00:00Z' },
    { id:102, created_by:'me', url:'https://www.youtube.com/watch?v=abc123', title:'Lock video',
      description:null, level:'everyday', subjects:[], share_all:false, opens:1,
      last_opened:null, created_at:'2026-10-02T10:00:00Z', open_with:'youtube' },
    { id:103, created_by:'me', url:'https://www.metoffice.gov.uk/', title:'Met Office',
      description:null, level:'everyday', subjects:[], share_all:false, opens:0,
      last_opened:null, created_at:'2026-10-03T10:00:00Z', open_with:'chrome' },
    { id:104, created_by:'me', url:'https://example.org/page#part', title:'With a hash',
      description:null, level:'everyday', subjects:[], share_all:false, opens:0,
      last_opened:null, created_at:'2026-10-04T10:00:00Z', open_with:'youtube' },
    { id:105, created_by:'me', url:'https://www.sage.com/en-gb/', title:'Sage',
      description:null, level:'everyday', subjects:[], share_all:false, opens:0,
      last_opened:null, created_at:'2026-10-04T11:00:00Z', open_with:'firefox' },
    { id:201, created_by:'sandra', url:'https://www.youtube.com/watch?v=zzz', title:'Her video',
      description:null, level:'maybe', subjects:[], share_all:true, opens:0,
      last_opened:null, created_at:'2026-10-05T10:00:00Z', open_with:'youtube' }];
  window.__rows.url_link_shares = [];
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 },
    userAgent:'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|open_with/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  // A tap on a link would leave the page; the address is what is being tested.
  await p.addInitScript(() => {
    document.addEventListener('click', ev => {
      const a = ev.target.closest && ev.target.closest('a[data-lopen]');
      if (a) ev.preventDefault();
    }, true);
  });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  const ev = (f, a) => p.evaluate(f, a);
  const writes = () => ev(() => window.__writes);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const link = id => p.$eval(`[data-lopen="${id}"]`, e => ({ href:e.getAttribute('href'),
    target:e.getAttribute('target'), text:e.textContent }));

  console.log('\nThe guess');
  const g = await ev(() => ({ yt:linkAppFor('https://www.youtube.com/watch?v=1'), m:linkAppFor('https://m.youtube.com/x'),
    short:linkAppFor('https://youtu.be/abc'), bank:linkAppFor('https://www.barclays.co.uk/ways-to-bank/'),
    other:linkAppFor('https://www.bbc.co.uk/news'), notyt:linkAppFor('https://notyoutube.com/') }));
  ok('YouTube pages go to the YouTube app', g.yt === 'youtube' && g.m === 'youtube' && g.short === 'youtube', JSON.stringify(g));
  ok('Barclays pages go to the Barclays app', g.bank === 'barclays');
  ok('anything else gets your usual, which starts as Phone decides', g.other === '');
  ok('a look-alike site is not taken for YouTube', g.notyt === '');

  console.log('\nThe list');
  await ev(seed);
  await ev(() => openLinks()); await settle(700);
  let a = await link(101);
  ok('a link with no app opens the ordinary way, in its own window',
     a.href === 'https://www.bbc.co.uk/news' && a.target === '_blank', JSON.stringify(a));
  ok('and says nothing about an app', !/opens in/.test(a.text));
  a = await link(102);
  ok('a YouTube one asks for the YouTube app, falling back to the page',
     a.href === 'intent://www.youtube.com/watch?v=abc123#Intent;scheme=https;package=com.google.android.youtube;'
       + 'S.browser_fallback_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc123;end', a.href);
  ok('from the page itself, not a new window', a.target === null);
  ok('and the row says so', /opens in YouTube app/.test(a.text), a.text);
  a = await link(103);
  ok('a link still set to Chrome opens the ordinary way',
     a.href === 'https://www.metoffice.gov.uk/' && a.target === '_blank', JSON.stringify(a));
  ok('and says nothing about Chrome', !/opens in/.test(a.text), a.text);
  a = await link(105);
  ok('a Firefox one asks for Firefox, falling back to Firefox on the Play Store',
     a.href === 'intent://www.sage.com/en-gb/#Intent;scheme=https;package=org.mozilla.firefox;'
       + 'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dorg.mozilla.firefox;end', a.href);
  ok('and the row says Firefox', /opens in Firefox/.test(a.text), a.text);
  a = await link(104);
  ok('an address with a # in it opens the ordinary way rather than break', a.href === 'https://example.org/page#part', a.href);
  a = await link(201);
  ok('a shared link opens with the app its owner chose', /package=com\.google\.android\.youtube/.test(a.href));
  await ev(() => { window.__writes = []; });
  await p.click('[data-lopen="102"]'); await settle(300);
  ok('opening one is still counted', (await writes()).some(w => w.op === 'update' && w.table === 'url_links' && w.patch.opens === 2));

  console.log('\nAdding one');
  const pressed = () => ev(() => [...document.querySelectorAll('[data-leapp][aria-pressed="true"]')].map(b => b.dataset.leapp));
  await ev(() => editLink(null, { url:'https://www.youtube.com/watch?v=new' })); await settle();
  ok('Open with is in the box', await p.isVisible('#leApps'));
  ok('four choices, with Firefox and no Chrome', await ev(() => [...document.querySelectorAll('[data-leapp]')].map(b => b.textContent).join('|'))
     === 'Phone decides|Firefox|YouTube app|Barclays app');
  ok('a YouTube page starts on the YouTube app', JSON.stringify(await pressed()) === '["youtube"]', JSON.stringify(await pressed()));
  await p.fill('#leUrl', 'https://www.barclays.co.uk/'); await settle(100);
  ok('changing the address changes the guess', JSON.stringify(await pressed()) === '["barclays"]', JSON.stringify(await pressed()));
  await p.click('[data-leapp="firefox"]');
  await p.fill('#leUrl', 'https://www.youtube.com/watch?v=again'); await settle(100);
  ok('once you pick one yourself, it stays', JSON.stringify(await pressed()) === '["firefox"]', JSON.stringify(await pressed()));
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  let ins = (await writes()).find(w => w.op === 'insert' && w.table === 'url_links');
  ok('it is saved with the link', ins && ins.rows.open_with === 'firefox', JSON.stringify(ins && ins.rows));

  await ev(() => editLink(null, { url:'https://www.bbc.co.uk/sport' })); await settle();
  ok('an ordinary page starts on Phone decides', JSON.stringify(await pressed()) === '[""]', JSON.stringify(await pressed()));
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  ins = (await writes()).find(w => w.op === 'insert' && w.table === 'url_links');
  ok('which is saved as nothing chosen', ins && ins.rows.open_with === null, JSON.stringify(ins && ins.rows));

  console.log('\nChanging one');
  await ev(() => editLink(102)); await settle();
  ok('it shows what was chosen', JSON.stringify(await pressed()) === '["youtube"]');
  await p.click('[data-leapp=""]');
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  const up = (await writes()).find(w => w.op === 'update' && w.table === 'url_links');
  ok('and can be put back to Phone decides', up && up.patch.open_with === null, JSON.stringify(up));
  await ev(() => editLink(103)); await settle();
  ok('one still set to Chrome shows Phone decides', JSON.stringify(await pressed()) === '[""]', JSON.stringify(await pressed()));
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(600);
  const up2 = (await writes()).find(w => w.op === 'update' && w.table === 'url_links');
  ok('and saving it clears Chrome', up2 && up2.patch.open_with === null, JSON.stringify(up2));

  console.log('\nKeeping a copy of somebody else\'s');
  await ev(() => linkActions(201)); await settle();
  await p.click('#laKeep'); await settle();
  ok('the copy starts with their choice', JSON.stringify(await pressed()) === '["youtube"]');
  await p.click('#leCancel'); await settle();

  console.log('\nNo usual choice in Settings any more');
  await ev(() => openSettings('URL Links')); await settle(600);
  ok('the Open new links with card has gone', await ev(() => !/Open new links with/.test($('setBody').textContent)
     && !document.querySelector('[data-lodef]')));
  ok('Levels and Subjects are still there', await ev(() => /Levels/.test($('setBody').textContent)
     && /Subjects/.test($('setBody').textContent)));
  ok('someone who had chosen Chrome still loads without trouble', await ev(() =>
     Array.isArray(linkPrefsFrom({links:{openWith:'chrome'}}).levels)));
  ok('and a new ordinary page starts on Phone decides', await ev(() => {
     LINK_PREFS.openWith = 'chrome'; return linkAppFor('https://www.bbc.co.uk/') === ''; }));
  ok('but YouTube still goes to its own app', await ev(() => linkAppFor('https://www.youtube.com/') === 'youtube'));

  console.log('\nBefore step 45 has been run');
  const lost = await ev(async () => {
    const real = sb.from.bind(sb);
    sb.from = t => {
      const q = real(t);
      if (t !== 'url_links') return q;
      const ins = q.insert.bind(q);
      q.insert = row => row.open_with !== undefined
        ? { select:() => ({ single: async () => ({ data:null,
            error:{ message:'Could not find the \'open_with\' column of \'url_links\' in the schema cache' } }) }) }
        : ins(row);
      return q;
    };
    window.__writes = [];
    editLink(null, { url:'https://www.youtube.com/watch?v=early' });
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('#leGo').click();
    await new Promise(r => setTimeout(r, 600));
    sb.from = real;
    const w = window.__writes.find(x => x.op === 'insert' && x.table === 'url_links');
    return { saved: !!w && w.rows.open_with === undefined, toast: $('toasts') ? $('toasts').textContent : '' };
  });
  ok('the link is still saved, just without its app', lost.saved, JSON.stringify(lost));
  ok('and it says why', /step 45/.test(lost.toast), lost.toast);

  console.log('\nOn a computer');
  const pc = await b.newPage({ viewport:{ width:1200, height:800 } });
  pc.on('pageerror', e => errors.push('PC PAGE ERROR: ' + e.message));
  await pc.goto('file://' + path.join(__dirname, 'boot.html'));
  await pc.waitForTimeout(900);
  await pc.evaluate(seed);
  await pc.evaluate(() => openLinks()); await pc.waitForTimeout(700);
  const h = await pc.$eval('[data-lopen="102"]', e => ({ href:e.getAttribute('href'), target:e.getAttribute('target') }));
  ok('every link opens the ordinary way', h.href === 'https://www.youtube.com/watch?v=abc123' && h.target === '_blank', JSON.stringify(h));

  console.log('\n' + '='.repeat(52));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
