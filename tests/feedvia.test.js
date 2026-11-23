// Episode lists the phone is not allowed to read (ML390, asked 23 Nov 2026).
// Acast, which hosts many UK podcasts, gives web pages no permission to read
// its feeds, so those go through the read-feed edge function instead.
// Part one runs the real database/read-feed.ts with a pretend Deno and a
// pretend web (it needs Node 23.6 or later, which reads .ts files). Part two
// runs the app as an Android phone, with read-feed answering from part one,
// and checks a list read that way gives the same tick codes as one read on
// the phone. The feeds and Apple's podcast directory are pretend ones.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const day = n => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toUTCString();
// Shaped like an Acast feed: CDATA, entities, an image title before the
// channel's own, itunes:title beside title, Windows line endings, and a few
// awkward items (no guid; no guid or audio; a BBC page; a self-closing guid).
const FEED = ['<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>',
  '<image><url>https://pics.example/x.png</url><title>Image title</title></image>',
  '<title><![CDATA[Pretend Half-Arsed History]]></title><itunes:title>Not this</itunes:title>',
  ...Array.from({ length:30 }, (_, k) => 30 - k).map(i => `<item><itunes:title>Short ${i}</itunes:title>` +
    `<title><![CDATA[Week ${i}: Tom & Jerry's <odd> trip]]></title><guid isPermaLink="false">acast-${i}</guid>` +
    `<pubDate>${day(i * 7)}</pubDate><itunes:duration>${i}:05</itunes:duration>` +
    `<enclosure url="https://audio.example/${i}.mp3?a=1&amp;b=2" length="1" type="audio/mpeg"/></item>`),
  `<item><title>Fish &amp; chips &#8217;n&#x2019; peas</title><pubDate>${day(300)}</pubDate>` +
    `<enclosure url='https://audio.example/fish.mp3' type="audio/mpeg"/><itunes:episode>31</itunes:episode><itunes:season>2</itunes:season></item>`,
  `<item><title>No audio either</title><link>https://example.org/ep/none</link><pubDate>${day(301)}</pubDate></item>`,
  `<item><title>A BBC one</title><guid>urn:bbc:podcast:m000zzzz</guid><link>https://www.bbc.co.uk/programmes/m000zzzz</link>` +
    `<pubDate>${day(302)}</pubDate></item>`,
  `<item><title>Empty guid</title><guid isPermaLink="false"/><enclosure url="https://audio.example/empty.mp3"/><pubDate>${day(303)}</pubDate></item>`,
  '</channel></rss>'].join('\r\n');
const FEED_URL = 'https://feeds.acast.example/public/shows/hah';

(async () => {
  // ---------- Part one: read-feed itself ----------
  console.log('\nread-feed, the edge function (database/read-feed.ts)');
  let handler = null, web = [], answer = null;
  const realFetch = globalThis.fetch;
  try {
    globalThis.Deno = { serve: h => { handler = h; } };
    globalThis.fetch = async (u, o) => { web.push(String(u)); return answer(String(u), o); };
    await import(require('url').pathToFileURL(path.join(__dirname, '..', 'database', 'read-feed.ts')).href);
  } catch (e) { console.log('  Skipped part one: this Node cannot read .ts files (' + e.code + ')'); }
  let viaReply = null;
  if (handler) {
    const ask = (body, method = 'POST') => handler(new Request('https://x.supabase.co/functions/v1/read-feed',
      method === 'POST' ? { method, body:JSON.stringify(body) } : { method }));
    const json = async r => ({ status:r.status, cors:r.headers.get('access-control-allow-origin'), j:await r.json() });
    answer = () => new Response(FEED, { status:200, headers:{ 'content-type':'application/xml' } });
    let r = await handler(new Request('https://x/read-feed', { method:'OPTIONS' }));
    ok('answers the phone\'s "may I?" with permission for the app', r.status === 200
       && r.headers.get('access-control-allow-origin') === '*' && /apikey/.test(r.headers.get('access-control-allow-headers')));
    r = await json(await ask(null, 'GET'));
    ok('only takes a POST', r.status === 405);
    web = [];
    const refused = [];
    for (const u of ['', 'not a link', 'ftp://feeds.example/x', 'file:///etc/passwd', 'http://localhost/x', 'https://127.0.0.1/x',
      'http://[::1]/x', 'http://169.254.169.254/latest', 'https://intranet/x', 'https://db.internal/x', 'https://printer.local/x'])
      refused.push((await json(await ask({ url:u }))).status);
    ok('refuses anything but an ordinary public address, without fetching it', refused.every(s => s === 400) && web.length === 0, refused.join());
    answer = () => { const x = new Response('', { status:200 }); Object.defineProperty(x, 'url', { value:'http://10.0.0.1/x' }); return x; };
    r = await json(await ask({ url:FEED_URL }));
    ok('refuses a feed that sends it on to a private address', r.status === 400, JSON.stringify(r));
    answer = () => new Response('nope', { status:404 });
    r = await json(await ask({ url:FEED_URL }));
    ok('a website that says no is passed on as an error', r.status === 502 && /said no \(404\)/.test(r.j.error), JSON.stringify(r));
    answer = () => { throw new TypeError('no signal'); };
    r = await json(await ask({ url:FEED_URL }));
    ok('a website that can\'t be reached is an error', r.status === 502 && r.cors === '*', JSON.stringify(r));
    answer = () => new Response('<html><title>A page</title><item>x</item></html>', { status:200 });
    r = await json(await ask({ url:FEED_URL }));
    ok('a web page that isn\'t a list of episodes is refused, with nothing from it sent back', r.status === 422
       && !JSON.stringify(r.j).includes('A page'), JSON.stringify(r));
    answer = () => new Response(FEED, { status:200, headers:{ 'content-type':'application/xml' } });
    web = [];
    r = await json(await ask({ url:FEED_URL }));
    viaReply = r.j;
    const e = r.j.eps || [], by = t => e.find(x => x.t === t) || {};
    ok('reads the list it was asked for', r.status === 200 && web.length === 1 && web[0] === FEED_URL && e.length === 34, web.join() + ' ' + e.length);
    ok('the podcast\'s own title, not the picture\'s', r.j.title === 'Pretend Half-Arsed History', r.j.title);
    ok('titles from CDATA as they are, not the shorter itunes:title', e[0].t === 'Week 30: Tom & Jerry\'s <odd> trip', e[0].t);
    ok('the guid, date and length, with no audio address beside a guid', e[0].g === 'acast-30' && e[0].p === day(210)
       && e[0].dur === '30:05' && !('a' in e[0]) && !('l' in e[0]), JSON.stringify(e[0]));
    ok('entities turned back into letters', !!by('Fish & chips ’n’ peas').p);
    ok('no guid: the audio address instead, number and series kept', by('Fish & chips ’n’ peas').a === 'https://audio.example/fish.mp3'
       && by('Fish & chips ’n’ peas').n === '31' && by('Fish & chips ’n’ peas').s === '2', JSON.stringify(by('Fish & chips ’n’ peas')));
    ok('no guid or audio: the episode\'s page instead', by('No audio either').l === 'https://example.org/ep/none');
    ok('a BBC episode keeps its page, so it opens in BBC Sounds', by('A BBC one').l === 'https://www.bbc.co.uk/programmes/m000zzzz'
       && by('A BBC one').g === 'urn:bbc:podcast:m000zzzz');
    ok('an empty guid counts as none', by('Empty guid').g === '' && by('Empty guid').a === 'https://audio.example/empty.mp3');
    ok('nothing else from the feed is sent back', !JSON.stringify(r.j).includes('Image title') && !JSON.stringify(r.j).includes('Short 30')
       && !JSON.stringify(r.j).includes('pics.example'));
    ok('much smaller than the feed itself', JSON.stringify(r.j).length < FEED.length * 0.75, JSON.stringify(r.j).length + ' of ' + FEED.length);
  }
  globalThis.fetch = realFetch;

  // ---------- Part two: the app ----------
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 },
    userAgent:'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_FAILED|ServiceWorker|Failed to load resource|Failed to fetch|CORS|Access-Control|Functions|read-feed test|JSHandle@/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.route(/gov\.uk|bsky\.app|bsky\.social|open\.spotify\.com\/oembed/, r => r.abort());
  await p.route(/pics\.example/, r => r.fulfill({ status:200, contentType:'image/png', body:PNG }));
  const hits = { acast:0, open:0, bbc:0 };
  const cors = { 'access-control-allow-origin':'*' };
  // Acast's way: the list is there, but with no permission for a web page.
  await p.route(/feeds\.acast\.example/, r => { hits.acast++; r.abort(); });   // as the phone sees it: refused
  // The same list from a host that does allow it, to compare the tick codes.
  await p.route(/feeds\.example\/open\.rss/, r => { hits.open++; r.fulfill({ status:200, contentType:'application/rss+xml', headers:cors, body:FEED }); });
  await p.route(/podcasts\.files\.bbci\.co\.uk/, r => { hits.bbc++; r.fulfill({ status:200, contentType:'application/rss+xml', headers:cors,
    body:'<rss><channel><title>In Our Time</title><item><title>One</title><guid>urn:bbc:podcast:m0001</guid></item></channel></rss>' }); });
  await p.route(/itunes\.apple\.com\/search/, r => {
    const term = new URL(r.request().url()).searchParams.get('term');
    const results = term === 'Half Arsed' ? [{ collectionName:'Half Arsed', artistName:'Pretend', feedUrl:FEED_URL }]
      : term === 'Murders' ? [{ collectionName:'Murders', artistName:'Pretend', feedUrl:'https://feeds.acast.example/public/shows/bm' }] : [];
    r.fulfill({ status:200, contentType:'application/json', headers:cors, body:JSON.stringify({ resultCount:results.length, results }) });
  });
  await p.addInitScript(() => {
    document.addEventListener('click', ev => {
      const a = ev.target.closest && ev.target.closest('a[data-lopen],a[data-epgo],a[data-epopen]');
      if (a) ev.preventDefault();
    }, true);
  });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(200); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const bodyText = () => ev(() => $('podEpsBody').textContent.replace(/\s+/g, ' '));
  const invokes = () => ev(() => window.__writes.filter(w => w.op === 'invoke').map(w => w.name + ' ' + (w.body && w.body.url)));
  const clear = () => ev(() => { window.__writes = []; });
  const lastTune = id => ev(i => { const u = window.__writes.filter(w => w.op === 'update' && w.table === 'profiles').pop();
    return u ? u.patch.home_tiles.links.tune[i] : null; }, id);
  const open = async id => { await p.click('#podsBody [data-podopen="' + id + '"]'); await settle(900); };
  const back = async () => { await p.click('#podEpsBack'); await settle(300); };

  await ev(() => {
    const row = (id, url, title, extra) => Object.assign({ id, created_by:'me', url, title, description:null, level:'everyday',
      subjects:['Podcasts'], share_all:false, opens:9 - id % 10, last_opened:null, created_at:'2026-11-01T10:00:00Z' }, extra || {});
    window.__rows.url_links = [
      row(501, 'https://open.spotify.com/show/hah', 'Half Arsed', { open_with:'spotify' }),
      row(502, 'https://feeds.example/open.rss', 'Same list, allowed'),
      row(503, 'https://open.spotify.com/show/bm', 'Murders', { open_with:'spotify' }),
      row(504, 'https://www.bbc.co.uk/sounds/brand/b006qykl', 'In Our Time', { open_with:'sounds' })];
    window.__rows.url_link_shares = [];
    const pics = {};
    window.__rows.url_links.forEach(l => { pics[l.id] = { u:l.url, i:'https://pics.example/' + l.id + '.png', t:'' }; });
    LINK_PREFS.pics = pics; LINK_PREFS.tune = {}; LINK_PREFS.heard = {};
  });
  // read-feed answers with what part one's real function sent back.
  const viaOk = viaReply || { title:'Pretend Half-Arsed History', eps:[] };
  await ev(r => { window.__viaReply = r; window.__viaMode = 'ok';
    window.__invoke = (name, o) => name !== 'read-feed' ? {} : window.__viaMode === 'ok' ? { data:window.__viaReply, error:null }
      : window.__viaMode === 'none' ? { data:null, error:{ name:'FunctionsHttpError', message:'read-feed test: not found', context:{ status:404 } } }
      : window.__viaMode === 'offline' ? { data:null, error:{ name:'FunctionsFetchError', message:'read-feed test: no signal' } }
      : { data:null, error:{ name:'FunctionsHttpError', message:'read-feed test: said no', context:{ status:502 } } }; }, viaOk);
  await ev(() => openTunes('pods')); await settle(800);

  console.log('\nA list the phone may not read comes through read-feed');
  await clear();
  await open(501);
  let t = await bodyText();
  ok('the episodes show', /34 episodes/.test(t) && await ev(() => document.querySelectorAll('#epList .eprow').length) === 34, t.slice(0, 140));
  ok('the phone tried the list first, then asked read-feed for that same list', hits.acast === 1
     && JSON.stringify(await invokes()) === JSON.stringify(['read-feed ' + FEED_URL]), JSON.stringify(await invokes()) + ' ' + hits.acast);
  ok('the podcast remembers it needs read-feed', (await lastTune(501) || {}).fx === FEED_URL
     && (await lastTune(501)).f === FEED_URL, JSON.stringify(await lastTune(501)));
  ok('titles and numbers as the feed has them', /Week 30: Tom & Jerry's <odd> trip/.test(t) && /Series 2, Ep 31/.test(t), t.slice(0, 300));
  const viaEps = await ev(() => EP_DATA.eps);
  await back();
  await open(502);
  const directEps = await ev(() => EP_DATA.eps);
  ok('the same list read on the phone (control)', hits.open === 1 && directEps.length === 34);
  const same = JSON.stringify(viaEps) === JSON.stringify(directEps);
  ok('every episode has the same tick code, title, date, number and length either way', same,
     same ? '' : JSON.stringify(viaEps.find((x, i) => JSON.stringify(x) !== JSON.stringify(directEps[i]))) + ' vs '
       + JSON.stringify(directEps.find((x, i) => JSON.stringify(x) !== JSON.stringify(viaEps[i]))));
  await back();

  console.log('\nNext time, straight to read-feed');
  await ev(() => EP_FEEDS.clear()); await clear(); hits.acast = 0;
  await open(501);
  ok('reopened: no try from the phone first', hits.acast === 0 && (await invokes()).length === 1 && /34 episodes/.test(await bodyText()),
     hits.acast + ' ' + JSON.stringify(await invokes()));
  ok('nothing saved again just for opening it', !(await ev(() => window.__writes.some(w => w.op === 'update' && w.table === 'profiles'))));
  await clear();
  await p.click('#podEps [data-barref]'); await settle(1200);
  ok('refresh at the top asks read-feed again', (await invokes()).length === 1 && hits.acast === 0);
  await back();
  await ev(() => { EP_FEEDS.clear(); EP_VIA_HOSTS.clear(); LINK_PREFS.tune = {}; }); await clear(); hits.acast = 0;
  await open(501); await back();
  await clear(); hits.acast = 0;
  await open(503);
  ok('another podcast on the same host goes straight to read-feed', hits.acast === 0
     && JSON.stringify(await invokes()) === JSON.stringify(['read-feed https://feeds.acast.example/public/shows/bm']), JSON.stringify(await invokes()));
  await back();
  await clear();
  await open(504); await back(); await open(502); await back();
  ok('the BBC and lists the phone can read never use read-feed', !(await invokes()).length && hits.bbc === 1, JSON.stringify(await invokes()));

  console.log('\nWhen read-feed can\'t help');
  const tryWith = async mode => { await ev(m => { EP_FEEDS.clear(); EP_VIA_HOSTS.clear(); LINK_PREFS.tune = {}; window.__viaMode = m; }, mode);
    await open(501); const x = await bodyText(); await back(); return x; };
  t = await tryWith('none');
  ok('read-feed not set up in Supabase yet: says so', /isn.t set up in Supabase yet/.test(t) && /read-feed/.test(t), t);
  t = await tryWith('offline');
  ok('no signal: says so, and that nothing is lost', /check your signal/.test(t) && /Nothing has been lost/.test(t), t);
  t = await tryWith('no');
  ok('read-feed can\'t read it either: the same message as before, with a way to open it', /doesn.t let the app read its list of episodes/.test(t)
     && await ev(() => !!document.querySelector('#podEpsBody [data-epwrong]')), t);
  await ev(() => { window.__viaReply = { eps:'nonsense' }; });
  t = await tryWith('ok');
  ok('a muddled answer is treated as no list, not a crash', /doesn.t let the app read/.test(t), t);
  await ev(() => { window.__viaReply = { title:5, eps:[null, 7, { t:3, p:{}, n:[], g:null }, { t:'Fine', g:'x', p:'Mon, 02 Nov 2026 10:00:00 GMT' }] }; });
  t = await tryWith('ok');
  ok('odd entries in an answer are skipped or blanked, not shown as rubbish', /2 episodes/.test(t) && /Fine/.test(t) && /\(no title\)/.test(t), t.slice(0, 200));

  console.log('\nHelp and version');
  ok('Help explains Acast and the helper', await ev(() => /Acast/.test(document.body.innerHTML) && /helper fetches the list/.test(document.body.innerHTML)));
  ok('version 2026.11.23.2', await ev(() => APP_VERSION === '2026.11.23.2'));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
