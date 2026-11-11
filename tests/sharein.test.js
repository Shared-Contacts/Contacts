// Sharing to the app from another app's Share list (ML226, 9 Nov 2026).
// The share is a POST, which GitHub Pages cannot take, so the real sw.js is
// run here on a small local web server that refuses POSTs the same way, and
// shares are sent to it the way Android sends them: a form, posted to
// index.html?share-target. The page here carries the real sharedPicsFetch
// from index.html, so both halves of the hand-over are the ones that ship.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const ROOT = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const fetchFn = (app.match(/function sharedPicsFetch\(\)\{[\s\S]*?\r?\n\}\r?\n/) || [''])[0];
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><link rel="manifest" href="manifest.json"></head>
<body><p>stand-in page</p><script>
${fetchFn}
window.__ready = navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready);
</script></body></html>`;

const posts = [];
const server = http.createServer((req, res) => {
  if (req.method !== 'GET') { posts.push(req.url); res.writeHead(405); res.end('Method not allowed'); return; }
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/Contacts/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  if (u.pathname === '/Contacts/sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(fs.readFileSync(path.join(ROOT, 'sw.js'))); return; }
  if (u.pathname === '/Contacts/manifest.json') { res.writeHead(200, { 'content-type': 'application/json' });
    res.end(fs.readFileSync(path.join(ROOT, 'manifest.json'))); return; }
  res.writeHead(404); res.end('not here');
});

(async () => {
  ok('the page\'s sharedPicsFetch was found in index.html', /navigator\.serviceWorker/.test(fetchFn));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/Contacts/';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));

  console.log('\nThe manifest offers the app for pictures as well as links');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const st = man.share_target || {};
  const action = new URL(st.action || '', base + 'manifest.json');
  ok('a POST, as pictures need', st.method === 'POST' && st.enctype === 'multipart/form-data', JSON.stringify(st));
  ok('  to index.html?share-target, inside the app\'s scope', action.pathname === '/Contacts/index.html'
    && action.searchParams.has('share-target') && action.href.startsWith(new URL(man.scope, base + 'manifest.json').href), action.href);
  ok('  taking pictures as share_files', Array.isArray(st.params.files) && st.params.files[0].name === 'share_files'
    && st.params.files[0].accept.includes('image/*'));
  ok('  and the words with the names the page reads', st.params.url === 'share_url' && st.params.title === 'share_title' && st.params.text === 'share_text');
  ok('  and contacts (a .vcf file) as well (ML256)', ['text/vcard', 'text/x-vcard', '.vcf'].every(x => st.params.files[0].accept.includes(x)),
    JSON.stringify(st.params.files[0].accept));

  await p.goto(base + 'index.html');
  await p.evaluate(() => window.__ready);
  if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) { await p.reload(); await p.evaluate(() => window.__ready); }
  ok('the service worker is looking after the page', await p.evaluate(() => !!navigator.serviceWorker.controller));

  const share = async ({ files = [], words = {} }) => {
    await Promise.all([
      p.waitForNavigation(),
      p.evaluate(({ files, words }) => {
        const f = document.createElement('form');
        f.method = 'post'; f.enctype = 'multipart/form-data'; f.action = 'index.html?share-target';
        if (files.length) {
          const i = document.createElement('input'); i.type = 'file'; i.name = 'share_files'; i.multiple = true;
          const dt = new DataTransfer();
          files.forEach(([n, size, type]) => dt.items.add(new File([new Uint8Array(size)], n, { type })));
          i.files = dt.files; f.append(i);
        }
        // A text box, not a one-line input, so words over several lines keep them.
        Object.entries(words).forEach(([k, v]) => { const t = document.createElement('textarea'); t.name = k; t.value = v; f.append(t); });
        document.body.append(f); f.submit();
      }, { files, words })]);
    await p.evaluate(() => window.__ready);
    return new URL(p.url());
  };

  console.log('\nA screenshot shared to the app');
  let at = await share({ files: [['Screenshot_20261109.png', 1234, 'image/png'], ['two.jpg', 77, 'image/jpeg']], words: { share_text: 'Look at this' } });
  ok('the app opens at index.html, saying two pictures came', at.pathname === '/Contacts/index.html'
    && at.searchParams.get('share_pics') === '2' && !at.searchParams.has('share-target'), at.href);
  ok('  with the words in the address, as before', at.searchParams.get('share_text') === 'Look at this', at.href);
  const got = await p.evaluate(() => sharedPicsFetch().then(fs => fs.map(f => [f.name, f.size, f.type])));
  ok('the page collects the pictures from the service worker, whole', JSON.stringify(got)
    === JSON.stringify([['Screenshot_20261109.png', 1234, 'image/png'], ['two.jpg', 77, 'image/jpeg']]), JSON.stringify(got));
  ok('  only once: asking again gets nothing', (await p.evaluate(() => sharedPicsFetch().then(fs => fs.length))) === 0);
  ok('  and they were never kept in a cache', (await p.evaluate(() => caches.keys())).length === 0);

  console.log('\nA web page shared to the app, as before');
  at = await share({ words: { share_title: 'Canal & River Trust', share_url: 'https://canalrivertrust.org.uk/x?a=1' } });
  ok('it arrives at index.html?share_title=...&share_url=..., as it always has', at.pathname === '/Contacts/index.html'
    && at.searchParams.get('share_url') === 'https://canalrivertrust.org.uk/x?a=1' && at.searchParams.get('share_title') === 'Canal & River Trust', at.href);
  ok('  with no pictures', !at.searchParams.has('share_pics'));
  at = await share({ words: { share_text: 'see https://example.org/page', share_title: '   ' } });
  ok('words with nothing in them are left off', at.searchParams.get('share_text') === 'see https://example.org/page' && !at.searchParams.has('share_title'), at.href);

  console.log('\nA contact shared to the app (ML256)');
  at = await share({ files: [['Kate Lock.vcf', 120, 'text/x-vcard']] });
  ok('a contact file arrives the same way as a picture', at.searchParams.get('share_pics') === '1', at.href);
  let card = await p.evaluate(() => sharedPicsFetch().then(fs => fs.map(f => [f.name, f.size, f.type])));
  ok('  and the page collects it whole', JSON.stringify(card) === JSON.stringify([['Kate Lock.vcf', 120, 'text/x-vcard']]), JSON.stringify(card));
  const VC = 'BEGIN:VCARD\nVERSION:3.0\nN:Lock;Kate;;;\nTEL;TYPE=CELL:+44 7700 900111\nEND:VCARD';
  at = await share({ words: { share_text: VC, share_title: 'Kate Lock' } });
  ok('a contact shared as words is made into a .vcf file', at.searchParams.get('share_pics') === '1', at.href);
  ok('  so it never travels in the address', !at.searchParams.has('share_text') && !/VCARD/.test(at.href), at.href);
  card = await p.evaluate(() => sharedPicsFetch().then(fs => Promise.all(fs.map(async f => [f.name, f.type, await f.text()]))));
  ok('  and the page collects it, every word', card.length === 1 && card[0][0] === 'contact.vcf' && card[0][1] === 'text/vcard'
    && card[0][2].replace(/\r\n/g, '\n') === VC, JSON.stringify(card));

  console.log('\nEverything else still goes straight to the website');
  ok('no share ever reached the website (which cannot take one)', posts.length === 0, JSON.stringify(posts));
  const other = await p.evaluate(() => fetch('index.html', { method: 'POST', body: 'x' }).then(r => r.status));
  ok('a POST anywhere else is passed through untouched', other === 405 && posts.length === 1, other + ' ' + JSON.stringify(posts));
  ok('and pages load as normal', (await p.evaluate(() => fetch('index.html').then(r => r.status))) === 200);
  ok('no page errors', errors.length === 0, errors.join(' | '));

  await b.close();
  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
