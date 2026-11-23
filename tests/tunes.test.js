// MY Music and MY Podcasts (asked for 22 Nov 2026, ML380 and ML381): links in
// URL Links under the subject Music or Podcasts, drawn as big pictures that
// open in their own app. The picture and name come from Spotify's oEmbed, or
// from the read-recipe edge function for anything else, and are kept with the
// person's own settings so each is fetched once. Run as an Android phone.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const seed = () => {
  const row = (id, by, url, title, subjects, extra) => Object.assign({ id, created_by:by, url, title,
    description:null, level:'everyday', subjects, share_all:false, opens:0, last_opened:null,
    created_at:'2026-11-0' + (id % 9 + 1) + 'T10:00:00Z' }, extra || {});
  window.__rows.url_links = [
    row(301, 'me', 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'open.spotify.com', ['Music'],
      { open_with:'spotify', opens:5 }),
    row(302, 'me', 'https://www.bbc.co.uk/sounds/play/live:bbc_radio_three', 'Radio 3', ['Music'],
      { open_with:'sounds', opens:2 }),
    row(303, 'me', 'https://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL', 'open.spotify.com', ['Podcasts'],
      { open_with:'spotify' }),
    row(304, 'sandra', 'https://www.bbc.co.uk/sounds/brand/b006qykl', 'In Our Time', ['Podcasts', 'Music'],
      { share_all:true, open_with:'sounds' }),
    row(305, 'me', 'https://www.bbc.co.uk/news', 'BBC News', ['News']),
    row(306, 'me', 'https://example.org/broken', 'Broken one', ['music'], { opens:1 }),
    row(307, 'me', 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy', 'Laptop album', ['Music'],
      { open_with:'spotify' }),
    row(308, 'me', 'https://nowhere.example/fails', 'Fails to fetch', ['Music'])];
  window.__rows.url_link_shares = [];
  LINK_PREFS.where = { 307:'laptop' };
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 },
    userAgent:'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_FAILED|ServiceWorker|pretend failure|Failed to load resource/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.route(/gov\.uk|bsky\.app|bsky\.social/, r => r.abort());
  // Spotify's oEmbed, as tested from a web page on 22 Nov 2026.
  let oembeds = [];
  await p.route(/open\.spotify\.com\/oembed/, r => {
    const u = decodeURIComponent(r.request().url().split('url=')[1] || '');
    oembeds.push(u);
    const name = /playlist/.test(u) ? 'Pretend Playlist' : /show/.test(u) ? 'Pretend Podcast' : 'Pretend Album';
    r.fulfill({ status:200, contentType:'application/json', headers:{ 'access-control-allow-origin':'*' },
      body:JSON.stringify({ title:name, thumbnail_url:'https://i.scdn.co/image/' + name.replace(/ /g, '') }) });
  });
  // The pictures themselves: all fine, but one that will not load.
  let picHits = [];
  await p.route(/i\.scdn\.co|ichef\.bbci\.co\.uk|pics\.example/, r => {
    picHits.push(r.request().url());
    if (/broken/.test(r.request().url())) return r.abort();
    r.fulfill({ status:200, contentType:'image/png', body:PNG });
  });
  // A tap on a card would leave the page; the address is what is being tested.
  await p.addInitScript(() => {
    document.addEventListener('click', ev => {
      const a = ev.target.closest && ev.target.closest('a[data-lopen]');
      if (a) ev.preventDefault();
    }, true);
  });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(200); }
  const ev = (f, a) => p.evaluate(f, a);
  const writes = () => ev(() => window.__writes);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const invokes = () => ev(() => window.__writes.filter(w => w.op === 'invoke' && w.name === 'read-recipe').map(w => w.body.url));

  console.log('\nTwo new tiles');
  ok('Music and Podcasts are places a tile can go', await ev(() =>
     TILE_DEST.music.label === 'Music' && TILE_DEST.pods.label === 'Podcasts'));
  ok('someone new gets them after the Slideshow, with Settings still last', await ev(() => {
     const d = defaultTiles().map(t => t.dest); return d.indexOf('music') === d.indexOf('sld') + 1
       && d.indexOf('pods') === d.indexOf('sld') + 2 && d[d.length - 1] === 'settings'; }));
  ok('an arrangement saved before gets them at the end', await ev(() => {
     const keep = MY_PROFILE; MY_PROFILE = { home_tiles:{ tiles:[{ dest:'contacts', label:'Contacts', colour:'#2F4858' }], hidden:['pods'] } };
     loadTiles(); const d = TILES.map(t => t.dest); MY_PROFILE = keep; loadTiles();
     return d.includes('music') && !d.includes('pods'); }));
  ok('the home screen draws them', await ev(() => { showHome(); renderHome();
     return [...document.querySelectorAll('.tile .tname')].some(x => x.textContent === 'Music')
       && [...document.querySelectorAll('.tile .tname')].some(x => x.textContent === 'Podcasts'); }));

  console.log('\nWhich app');
  const g = await ev(() => ({
    sp:linkAppFor('https://open.spotify.com/playlist/abc?si=1'), spl:linkAppFor('https://spotify.link/xyz'),
    snd:linkAppFor('https://www.bbc.co.uk/sounds/brand/b006qykl'), ipl:linkAppFor('https://www.bbc.co.uk/iplayer/episode/m001'),
    news:linkAppFor('https://www.bbc.co.uk/news'), soundsish:linkAppFor('https://www.bbc.co.uk/soundsgood'),
    ytm:linkAppFor('https://music.youtube.com/playlist?list=1'), yt:linkAppFor('https://www.youtube.com/watch?v=1'),
    amz:linkAppFor('https://music.amazon.co.uk/albums/B01'), shop:linkAppFor('https://www.amazon.co.uk/dp/B01'),
    fake:linkAppFor('https://notspotify.com/x'), bank:linkAppFor('https://www.barclays.co.uk/') }));
  ok('Spotify links go to Spotify, short ones too', g.sp === 'spotify' && g.spl === 'spotify', JSON.stringify(g));
  ok('BBC Sounds and BBC iPlayer each get their own app', g.snd === 'sounds' && g.ipl === 'iplayer');
  ok('the rest of the BBC still gets Phone decides', g.news === '' && g.soundsish === '');
  ok('YouTube Music is not taken for YouTube', g.ytm === 'ytmusic' && g.yt === 'youtube');
  ok('Amazon Music, but not the Amazon shop', g.amz === 'amazonmusic' && g.shop === '');
  ok('a look-alike is not taken for Spotify, and Barclays is as it was', g.fake === '' && g.bank === 'barclays');

  console.log('\nMY Music');
  await ev(seed);
  await ev(() => { window.__writes = [];
    window.__invoke = (name, opts) => {
      const u = opts.body.url;
      if (/nowhere/.test(u)) return { data:null, error:{ message:'pretend failure' } };
      if (/broken/.test(u)) return { data:{ found:false, title:'Broken one', image:'https://pics.example/broken.png' }, error:null };
      if (/b006qykl/.test(u)) return { data:{ found:false, title:'BBC Sounds - In Our Time - Available Episodes',
        image:'https://ichef.bbci.co.uk/images/ic/1024x576/p0p7k696.jpg' }, error:null };
      return { data:{ found:false, title:'BBC Radio 3 - BBC Sounds', image:'https://ichef.bbci.co.uk/r3.jpg' }, error:null };
    }; });
  await ev(() => openTunes('music')); await settle(900);
  ok('the screen opens', await ev(() => !$('music').classList.contains('hidden') && currentScreen() === 'music'));
  ok('with its own title', await ev(() => $('music').querySelector('.title').textContent === 'MY Music'));
  const ids = await ev(() => [...document.querySelectorAll('#musicBody .mucard [data-lopen]')].map(a => +a.dataset.lopen));
  ok('only the Music ones, most played first, the subject in any case',
     JSON.stringify(ids) === '[301,302,306,308,304]', JSON.stringify(ids));
  ok('no news and no podcast-only one', !ids.includes(305) && !ids.includes(303));
  ok('a Spotify card asks for Spotify, falling back to the page', await ev(() =>
     document.querySelector('#musicBody [data-lopen="301"]').getAttribute('href') ===
       'intent://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M#Intent;scheme=https;package=com.spotify.music;'
       + 'S.browser_fallback_url=https%3A%2F%2Fopen.spotify.com%2Fplaylist%2F37i9dQZF1DXcBWIGoYBM5M;end'));
  ok('a BBC Sounds card asks for BBC Sounds', await ev(() =>
     /package=com\.bbc\.sounds;/.test(document.querySelector('#musicBody [data-lopen="302"]').getAttribute('href'))));
  ok('Spotify was asked for its own name and picture', oembeds.some(u => /playlist\/37i9/.test(u)), JSON.stringify(oembeds));
  const inv = await invokes();
  ok('anything else went through read-recipe', inv.some(u => /bbc_radio_three/.test(u)), JSON.stringify(inv));
  ok('Spotify ones did not', !inv.some(u => /spotify/.test(u)), JSON.stringify(inv));
  const c301 = await ev(() => { const c = document.querySelector('#musicBody [data-lopen="301"]').closest('.mucard');
    const im = c.querySelector('img'); return { t:c.querySelector('b').textContent, src:im && im.getAttribute('src'),
      ref:im && im.getAttribute('referrerpolicy'), meta:c.querySelector('.mumeta').textContent }; });
  ok('the card shows the playlist name, not the site', c301.t === 'Pretend Playlist', JSON.stringify(c301));
  ok('and its picture, sent no referrer', c301.src === 'https://i.scdn.co/image/PretendPlaylist' && c301.ref === 'no-referrer', JSON.stringify(c301));
  ok('and the app it opens in', c301.meta === 'Spotify', c301.meta);
  ok('a title of your own is kept', await ev(() =>
     document.querySelector('#musicBody [data-lopen="302"]').closest('.mucard').querySelector('b').textContent === 'Radio 3'));
  let w = await writes();
  ok('your own link saved with only the site name takes the real name',
     w.some(x => x.op === 'update' && x.table === 'url_links' && x.patch.title === 'Pretend Playlist'
       && x.where.some(c => c[1] === 'id' && c[2] === 301)), JSON.stringify(w.filter(x => x.table === 'url_links')));
  ok('a link with a title of its own is left alone', !w.some(x => x.op === 'update' && x.table === 'url_links'
       && x.where.some(c => c[1] === 'id' && c[2] === 302)));
  const saved = w.filter(x => x.op === 'update' && x.table === 'profiles').pop();
  const pics = saved && saved.patch.home_tiles.links.pics;
  ok('the pictures are kept with your own settings', !!pics && pics[301] && pics[301].i === 'https://i.scdn.co/image/PretendPlaylist', JSON.stringify(pics));
  ok('BBC names lose the site\'s words around them', pics && pics[304] && pics[304].t === 'In Our Time', JSON.stringify(pics && pics[304]));
  ok('one that could not be fetched is not kept', pics && !pics[308], JSON.stringify(pics));
  ok('saved once, not once a picture', w.filter(x => x.op === 'update' && x.table === 'profiles').length === 1);
  const keys = await ev(() => Object.keys(localStorage));
  ok('nothing went into the phone\'s own storage', !keys.some(k => /pic|tune|music|pod/i.test(k)), keys.join(','));
  const c304 = await ev(() => { const c = document.querySelector('#musicBody [data-lopen="304"]').closest('.mucard');
    return { meta:c.querySelector('.mumeta').textContent, btn:c.querySelector('.muedit').textContent }; });
  ok('somebody else\'s says whose it is, with the three dots', /from Sandra/.test(c304.meta) && c304.btn === '⋮', JSON.stringify(c304));
  ok('one kept for the laptop is said, not just missing', await ev(() =>
     /1 more kept for the laptop only/.test($('musicBody').textContent)));
  ok('the picture that would not load shows its letter', await ev(() => {
     const c = document.querySelector('#musicBody [data-lopen="306"]').closest('.mucard');
     return !c.querySelector('img') && c.querySelector('.mupic').textContent === 'B'; }));
  ok('a card with no picture yet shows its letter', await ev(() =>
     document.querySelector('#musicBody [data-lopen="308"]').closest('.mucard').querySelector('.mupic').textContent === 'F'));
  const fitsNow = await ev(() => { const b = $('musicBody'); return b.scrollWidth <= b.clientWidth + 1; });
  ok('nothing spills off the side at 390 wide', fitsNow);

  console.log('\nDrawn again, and opened again');
  oembeds = []; await ev(() => { window.__writes = []; });
  await ev(() => renderTunes()); await settle(500);
  ok('drawing it again fetches nothing', oembeds.length === 0 && (await invokes()).length === 0);
  await ev(() => backHome('music')); await settle(200);
  ok('Home shuts it', await ev(() => $('music').classList.contains('hidden')));
  await ev(() => openTunes('music')); await settle(900);
  const again = await invokes();
  ok('opened again: the one that failed is tried again', again.some(u => /nowhere/.test(u)), JSON.stringify(again));
  ok('the broken picture is fetched once more', again.some(u => /broken/.test(u)), JSON.stringify(again));
  ok('and nothing else', oembeds.length === 0 && !again.some(u => /bbc|spotify/.test(u)), JSON.stringify([oembeds, again]));
  ok('the fetched name still shows', await ev(() =>
     document.querySelector('#musicBody [data-lopen="301"]').closest('.mucard').querySelector('b').textContent === 'Pretend Playlist'));
  await ev(() => { window.__writes = []; });
  await ev(() => backHome('music')); await ev(() => openTunes('music')); await settle(900);
  ok('a picture that still will not load is not chased again', !(await invokes()).some(u => /broken/.test(u)), JSON.stringify(await invokes()));

  console.log('\nPlaying one');
  await ev(() => { window.__writes = []; });
  await p.click('#musicBody [data-lopen="302"]'); await settle(300);
  ok('it is counted, as in URL Links', (await writes()).some(x => x.op === 'update' && x.table === 'url_links' && x.patch.opens === 3));

  console.log('\nAdding one');
  await ev(() => { Object.defineProperty(navigator, 'clipboard', { configurable:true,
    value:{ readText:async () => 'Listen to this https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX?si=abc' } }); });
  await p.click('#musicBody [data-tuneadd]'); await settle(400);
  const box = await ev(() => ({ url:$('leUrl') && $('leUrl').value,
    subs:[...document.querySelectorAll('[data-lesub]')].length, lv:[...document.querySelectorAll('[data-lelv]')].length,
    ty:[...document.querySelectorAll('[data-lety][aria-pressed="true"]')].map(b => b.dataset.lety),
    app:[...document.querySelectorAll('[data-leapp][aria-pressed="true"]')].map(b => b.dataset.leapp) }));
  ok('+ Add opens the link box with what was copied', box.url === 'https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX?si=abc', JSON.stringify(box));
  ok('no Level or Subjects to choose, and its Type filled in from the link (ML384)',
     box.subs === 0 && box.lv === 0 && JSON.stringify(box.ty) === '["album"]', JSON.stringify(box));
  ok('and set to open in Spotify', JSON.stringify(box.app) === '["spotify"]', JSON.stringify(box.app));
  await ev(() => { window.__writes = []; });
  await p.click('#leGo'); await settle(700);
  w = await writes();
  const ins = w.find(x => x.op === 'insert' && x.table === 'url_links');
  ok('saving adds it to URL Links, under Music, opening in Spotify', ins && JSON.stringify(ins.rows.subjects) === '["Music"]'
     && ins.rows.open_with === 'spotify', JSON.stringify(ins));
  ok('the screen is drawn again afterwards', await ev(() => !!document.querySelector('#musicBody .mugrid')));
  ok('the menu has Paste a link, in MY Music', await ev(() => { openMenu('music');
     const t = $('menuBody').textContent; shutMenu(); return /In MY Music/.test(t) && /Paste a link/.test(t); }));
  ok('its help is there', await ev(() => { openHelp('music'); const there = !!document.getElementById('h-music');
     $('help').classList.add('hidden'); lockBackground(); return there; }));

  console.log('\nMY Podcasts');
  await ev(() => { backHome('music'); window.__writes = []; }); oembeds = [];
  await ev(() => openTunes('pods')); await settle(900);
  const pids = await ev(() => [...document.querySelectorAll('#podsBody .mucard [data-podopen]')].map(a => +a.dataset.podopen));
  ok('only the Podcasts ones', JSON.stringify(pids.slice().sort()) === '[303,304]', JSON.stringify(pids));
  ok('with its own title', await ev(() => $('pods').querySelector('.title').textContent === 'MY Podcasts'));
  ok('the Spotify show gets its name', await ev(() =>
     document.querySelector('#podsBody [data-podopen="303"]').closest('.mucard').querySelector('b').textContent === 'Pretend Podcast'));
  ok('the one already fetched for Music is not fetched again', !(await invokes()).some(u => /b006qykl/.test(u)));
  ok('the help button finds the same help', await ev(() => HELP_AT.pods === 'h-music' && HELP_AT[currentScreen()] === 'h-music'));

  console.log('\nShared in from another app');
  await ev(() => backHome('pods'));
  await ev(() => sharedIn({ url:'https://www.bbc.co.uk/sounds/brand/b006qykl', title:'', text:'' })); await settle(300);
  ok('Save this as offers Music and A podcast', await ev(() => !!$('siMusic') && !!$('siPod')));
  await p.click('#siPod'); await settle(900);
  const sbox = await ev(() => ({ open:!$('pods').classList.contains('hidden'),
    st:[...document.querySelectorAll('[data-lest][aria-pressed="true"]')].map(b => b.dataset.lest),
    app:[...document.querySelectorAll('[data-leapp][aria-pressed="true"]')].map(b => b.dataset.leapp) }));
  ok('A podcast opens MY Podcasts with the link box over it, starting as Interesting',
     sbox.open && JSON.stringify(sbox.st) === '["interesting"]', JSON.stringify(sbox));
  ok('set to open in BBC Sounds', JSON.stringify(sbox.app) === '["sounds"]', JSON.stringify(sbox.app));
  await p.click('#leCancel'); await settle(200);
  await ev(() => sharedIn({ url:'', title:'The Hobbit', text:'' })); await settle(200);
  ok('a share with no web address does not offer them', await ev(() => !$('siMusic') && !$('siPod')));
  await ev(() => $('siShut').click());

  console.log('\nDeleting one');
  await ev(() => { window.__writes = []; });
  await ev(() => editLink(302)); await settle(300);
  await p.click('#leDel'); await settle(700);
  w = await writes();
  const after = w.filter(x => x.op === 'update' && x.table === 'profiles').pop();
  ok('its picture goes from your settings too', after && after.patch.home_tiles.links.pics && !after.patch.home_tiles.links.pics[302],
     JSON.stringify(after && Object.keys(after.patch.home_tiles.links.pics)));

  console.log('\nURL Links still has them all');
  await ev(() => backHome('pods')); await ev(() => openLinks()); await settle(700);
  ok('the Music and Podcasts ones are in URL Links as before', await ev(() =>
     [301, 303, 306].every(id => !!document.querySelector('#linksBody [data-lopen="' + id + '"]'))));

  console.log('\nAt 320 wide');
  await p.setViewportSize({ width:320, height:700 });
  await ev(() => { backHome('links'); }); await ev(() => openTunes('music')); await settle(700);
  ok('nothing spills off the side', await ev(() => { const b = $('musicBody'); return b.scrollWidth <= b.clientWidth + 1; }));
  ok('two to a row', await ev(() => { const g = [...document.querySelectorAll('#musicBody .mugrid')]
       .find(x => x.querySelectorAll('.mucard').length > 1); if (!g) return false;
     const c = [...g.querySelectorAll('.mucard')];
     return Math.abs(c[0].getBoundingClientRect().top - c[1].getBoundingClientRect().top) < 2; }));

  console.log('\n' + '='.repeat(52));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
