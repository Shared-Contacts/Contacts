// MY Music sorted by Type with genres and no Level (ML384), MY Podcasts sorted
// by Ongoing, Interesting and Finished with genres (ML385), and a podcast's
// episodes from its public feed, ticked as listened by hand (ML386). Asked for
// 23 Nov 2026. All kept with the person's own settings, so no table change.
// The feeds and Apple's podcast directory are pretend ones. Run as an Android phone.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const day = n => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toUTCString();
const rss = (title, items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>${title}</title>${items.slice().reverse().join('')}</channel></rss>`;
// A BBC feed: no episode numbers, its guids name the programme (as checked on 23 Nov 2026).
const BBC = rss('In Our Time', [1, 2, 3, 4].map(i => `<item><title>Pretend topic ${i}</title>
  <guid isPermaLink="false">urn:bbc:podcast:m000aaa${i}</guid><link>https://www.bbc.co.uk/programmes/m000aaa${i}</link>
  <pubDate>${day(i * 7)}</pubDate><itunes:duration>2700</itunes:duration>
  <enclosure url="https://open.live.bbc.co.uk/pretend/${i}.mp3" type="audio/mpeg"/></item>`));
// Any other: numbered, in two series, 120 of them.
const CRIME = rss('Pretend Crime', Array.from({ length:120 }, (_, k) => k + 1).map(i => `<item><title>Case ${i}</title>
  <guid>crime-${i}</guid><pubDate>${day(i)}</pubDate><itunes:episode>${i}</itunes:episode>
  <itunes:season>${i > 60 ? 2 : 1}</itunes:season><itunes:duration>45:00</itunes:duration>
  <enclosure url="https://feeds.example/audio/${i}.mp3" type="audio/mpeg"/></item>`));
const EXTRA = rss('Pretend Crime Extra', ['First', 'Second'].map((t, i) => `<item><title>${t} extra</title>
  <guid>extra-${i}</guid><pubDate>${day(i + 200)}</pubDate></item>`));

const seed = () => {
  const row = (id, by, url, title, subjects, extra) => Object.assign({ id, created_by:by, url, title,
    description:null, level:'everyday', subjects, share_all:false, opens:0, last_opened:null,
    created_at:'2026-11-0' + (id % 9 + 1) + 'T10:00:00Z' }, extra || {});
  window.__rows.url_links = [
    row(401, 'me', 'https://open.spotify.com/playlist/37i9dQZF1DX', 'A playlist', ['Music'], { open_with:'spotify', opens:6 }),
    row(402, 'me', 'https://music.youtube.com/watch?v=abc', 'A song', ['Music'], { open_with:'ytmusic', opens:5 }),
    row(403, 'me', 'https://music.apple.com/gb/album/pretend/123', 'An album', ['Music'], { opens:4 }),
    row(404, 'me', 'https://music.apple.com/gb/album/pretend/123?i=456', 'Another song', ['Music'], { opens:3 }),
    row(405, 'me', 'https://example.org/mix', 'A mix', ['Music', 'Fun'], { opens:2 }),
    row(406, 'me', 'https://music.amazon.co.uk/stations/abc', 'A station', ['Music'], { open_with:'amazonmusic', opens:1 }),
    row(410, 'me', 'https://www.bbc.co.uk/sounds/brand/b006qykl', 'In Our Time', ['Podcasts'], { open_with:'sounds', opens:9 }),
    row(411, 'me', 'https://open.spotify.com/show/2MAi0BvDc6', 'Pretend Crime', ['Podcasts'], { open_with:'spotify', opens:8 }),
    row(412, 'me', 'https://feeds.example/blocked.rss', 'Blocked Pod', ['Podcasts'], { opens:3 }),
    row(413, 'me', 'https://open.spotify.com/show/none', 'Nothing Found', ['Podcasts'], { open_with:'spotify', opens:2 }),
    row(415, 'me', 'https://open.spotify.com/show/off', 'Offline Pod', ['Podcasts'], { open_with:'spotify', opens:1 }),
    row(414, 'sandra', 'https://open.spotify.com/show/sandra', 'Sandra\'s pod', ['Podcasts'], { share_all:true, open_with:'spotify' })];
  window.__rows.url_link_shares = [];
  // Pictures already fetched, so nothing else is asked for.
  const pics = {};
  window.__rows.url_links.forEach(l => { pics[l.id] = { u:l.url, i:'https://pics.example/' + l.id + '.png', t:'' }; });
  LINK_PREFS.pics = pics;
  LINK_PREFS.tune = { 414:{ st:'finished' } };
  LINK_PREFS.heard = {};
};

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 },
    userAgent:'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_FAILED|ServiceWorker|pretend failure|Failed to load resource|Failed to fetch/i.test(t)) errors.push('CONSOLE: ' + t); });
  p.on('dialog', d => d.accept());
  await p.route(/gov\.uk|bsky\.app|bsky\.social|open\.spotify\.com\/oembed/, r => r.abort());
  await p.route(/pics\.example/, r => r.fulfill({ status:200, contentType:'image/png', body:PNG }));
  const hits = { bbc:0, crime:0, extra:0, apple:[] };
  const cors = { 'access-control-allow-origin':'*' };
  await p.route(/podcasts\.files\.bbci\.co\.uk\/b006qykl\.rss/, r => { hits.bbc++;
    r.fulfill({ status:200, contentType:'application/rss+xml', headers:cors, body:BBC }); });
  await p.route(/feeds\.example\/crime\.rss/, r => { hits.crime++;
    r.fulfill({ status:200, contentType:'application/rss+xml', headers:cors, body:CRIME }); });
  await p.route(/feeds\.example\/extra\.rss/, r => { hits.extra++;
    r.fulfill({ status:200, contentType:'application/rss+xml', headers:cors, body:EXTRA }); });
  await p.route(/feeds\.example\/blocked\.rss/, r => r.abort());
  // Apple's podcast directory, as tested from a web page on 23 Nov 2026.
  await p.route(/itunes\.apple\.com\/search/, r => {
    const term = new URL(r.request().url()).searchParams.get('term');
    hits.apple.push(term);
    if (term === 'Offline Pod') return r.fulfill({ status:500, headers:cors, body:'' });
    const results = term === 'Pretend Crime' ? [
      { collectionName:'Pretend Crime', artistName:'Pretend Studio', feedUrl:'https://feeds.example/crime.rss' },
      { collectionName:'Pretend Crime Extra', artistName:'Other Studio', feedUrl:'http://feeds.example/extra.rss' }] : [];
    r.fulfill({ status:200, contentType:'application/json', headers:cors, body:JSON.stringify({ resultCount:results.length, results }) });
  });
  // A tap on a link would leave the page; the address is what is being tested.
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
  const clear = () => ev(() => { window.__writes = []; });
  const profs = () => ev(() => window.__writes.filter(w => w.op === 'update' && w.table === 'profiles')
    .map(w => JSON.parse(JSON.stringify(w.patch.home_tiles.links))));
  const lastProf = async () => (await profs()).pop();
  const heads = sel => ev(s => [...document.querySelectorAll(s + ' > .dsec')].map(h => h.firstChild.textContent.trim()), sel);
  const cardsIn = (body, attr) => ev(([b, a]) => [...document.querySelectorAll('#' + b + ' .mugrid')].map(g =>
    [...g.querySelectorAll('[data-' + a + ']')].map(x => +x.getAttribute('data-' + a))), [body, attr]);
  const rows = () => ev(() => [...document.querySelectorAll('#epList .eprow')].map(r => ({
    t:r.querySelector('b').textContent, m:r.querySelector('.epmeta').textContent,
    on:r.querySelector('.eptick').getAttribute('aria-pressed') === 'true', id:r.querySelector('.eptick').dataset.eptick })));
  const bodyText = () => ev(() => $('podEpsBody').textContent.replace(/\s+/g, ' '));
  await ev(seed);

  console.log('\nWhat a music link is, from its address (ML384)');
  const ty = await ev(() => [
    'https://open.spotify.com/playlist/x', 'https://open.spotify.com/album/x', 'https://open.spotify.com/track/x',
    'https://open.spotify.com/artist/x', 'https://open.spotify.com/show/x',
    'https://music.youtube.com/watch?v=1', 'https://music.youtube.com/playlist?list=OLAK5uy_abc',
    'https://music.youtube.com/playlist?list=PL123', 'https://music.youtube.com/browse/MPREb_x',
    'https://music.youtube.com/channel/UC1', 'https://music.amazon.co.uk/user-playlists/x',
    'https://music.amazon.co.uk/albums/B01', 'https://music.amazon.co.uk/albums/B01?trackAsin=B02',
    'https://music.amazon.com/artists/x', 'https://music.apple.com/gb/song/x/1', 'https://music.apple.com/gb/station/x',
    'https://www.deezer.com/en/album/1', 'https://www.bbc.co.uk/sounds/play/live:bbc_radio_two',
    'https://www.bbc.co.uk/sounds/play/m000abc', 'https://notspotify.com/album/x', 'not a link'].map(tuneTypeFor));
  ok('Spotify playlists, albums, songs and artists', ty.slice(0, 5).join() === 'playlist,album,song,artist,', ty.join());
  ok('YouTube Music songs, albums, playlists and artists', ty.slice(5, 10).join() === 'song,album,playlist,album,artist', ty.join());
  ok('Amazon Music, a song inside an album too', ty.slice(10, 14).join() === 'playlist,album,song,artist', ty.join());
  ok('Apple Music and Deezer', ty.slice(14, 17).join() === 'song,station,album', ty.join());
  ok('BBC Sounds live radio is a station, an episode is not', ty[17] === 'station' && ty[18] === '', ty.join());
  ok('a look-alike or nonsense is left for you to choose', ty[19] === '' && ty[20] === '', ty.join());

  console.log('\nMY Music, sorted by Type as it opens');
  await clear();
  await ev(() => openTunes('music')); await settle(800);
  ok('headings in order, only those with something in', JSON.stringify(await heads('#musicBody'))
     === '["Playlists","Albums","Songs","Stations","Other"]', JSON.stringify(await heads('#musicBody')));
  ok('each heading counts its own', await ev(() => [...document.querySelectorAll('#musicBody > .dsec .lcount')]
     .map(x => x.textContent).join() === '1,1,2,1,1'));
  ok('the two songs together, most played first', JSON.stringify(await cardsIn('musicBody', 'lopen'))
     === '[[401],[403],[402,404],[406],[405]]', JSON.stringify(await cardsIn('musicBody', 'lopen')));
  ok('no genre buttons while nothing has a genre', await ev(() => !document.querySelector('#musicBody [data-tgen]')));
  ok('music still opens in its own app', await ev(() =>
     /^intent:\/\/music\.youtube\.com\/watch\?v=abc#Intent;.*package=com\.google\.android\.apps\.youtube\.music;/
       .test(document.querySelector('#musicBody [data-lopen="402"]').getAttribute('href'))));

  console.log('\nChanging one: Type and genres, no Level');
  await ev(() => editLink(405, undefined, 'music')); await settle(300);
  const mb = await ev(() => ({ lv:document.querySelectorAll('[data-lelv]').length, sub:document.querySelectorAll('[data-lesub]').length,
    ty:[...document.querySelectorAll('[data-lety]')].map(x => x.textContent), on:document.querySelectorAll('[data-lety][aria-pressed="true"]').length,
    gen:[...document.querySelectorAll('[data-legen]')].map(x => x.textContent), head:document.querySelector('.lnked .dsec').textContent }));
  ok('no Level and no Subjects in the box', mb.lv === 0 && mb.sub === 0, JSON.stringify(mb));
  ok('a Type to choose: Playlist, Album, Song, Artist, Station', mb.ty.join() === 'Playlist,Album,Song,Artist,Station' && mb.on === 0, JSON.stringify(mb));
  ok('the genres offered: Rock, Motown, Blues and the rest, with Mixed', ['Rock', 'Motown', 'Blues', 'Jazz', 'Mixed'].every(g => mb.gen.includes(g)), mb.gen.join());
  ok('it says Change this one', mb.head === 'Change this one', mb.head);
  await p.click('[data-lety="artist"]'); await p.click('[data-lety="song"]');
  ok('only one Type at a time', await ev(() => [...document.querySelectorAll('[data-lety][aria-pressed="true"]')].map(x => x.dataset.lety).join() === 'song'));
  await p.click('[data-lety="artist"]');
  await p.click('[data-legen="Rock"]'); await p.click('[data-legen="Blues"]');
  await p.fill('#leNewGen', 'Skiffle'); await p.press('#leNewGen', 'Enter');
  await p.fill('#leNewGen', 'rock'); await p.click('#leAddGen');
  ok('a new genre is added and chosen; one you have already is just chosen', await ev(() =>
     [...document.querySelectorAll('[data-legen][aria-pressed="true"]')].map(x => x.dataset.legen).join() === 'Rock,Blues,Skiffle'
     && document.querySelectorAll('[data-legen="rock"]').length === 0));
  await clear(); await p.click('#leGo'); await settle(700);
  let w = await ev(() => window.__writes);
  const up = w.find(x => x.op === 'update' && x.table === 'url_links');
  ok('the link keeps its subjects and its Level', up && JSON.stringify(up.patch.subjects) === '["Music","Fun"]' && up.patch.level === 'everyday', JSON.stringify(up && up.patch));
  let lp = await lastProf();
  ok('the Type and genres are kept with your own settings', lp && lp.tune[405] && lp.tune[405].ty === 'artist'
     && lp.tune[405].g.join() === 'Rock,Blues,Skiffle', JSON.stringify(lp && lp.tune));
  ok('and the new genre joins your list', lp && lp.genres.music[lp.genres.music.length - 1] === 'Skiffle', JSON.stringify(lp && lp.genres));
  ok('it moves under Artists', JSON.stringify(await heads('#musicBody')) === '["Playlists","Albums","Songs","Artists","Stations"]',
     JSON.stringify(await heads('#musicBody')));
  ok('the genre buttons appear, your own order first', await ev(() => [...document.querySelectorAll('#musicBody [data-tgen]')]
     .map(x => x.textContent.replace(/\s+/g, ' ')).join('|') === 'All · 6|Rock · 1|Blues · 1|Skiffle · 1'));
  await p.click('#musicBody [data-tgen="Blues"]'); await settle(200);
  ok('pressing Blues shows only the blues', JSON.stringify(await cardsIn('musicBody', 'lopen')) === '[[405]]'
     && await ev(() => document.querySelector('#musicBody [data-tgen="Blues"]').getAttribute('aria-pressed') === 'true'));
  await p.click('#musicBody [data-tgen=""]'); await settle(200);
  ok('All shows them all again', (await cardsIn('musicBody', 'lopen')).flat().length === 6);
  // A Type taken off by hand stays off.
  await ev(() => editLink(401, undefined, 'music')); await settle(300);
  ok('a Spotify playlist starts as Playlist', await ev(() => document.querySelector('[data-lety="playlist"]').getAttribute('aria-pressed') === 'true'));
  await p.click('[data-lety="playlist"]'); await p.click('#leGo'); await settle(700);
  lp = await lastProf();
  ok('taken off, it goes under Other and stays there', lp.tune[401] && lp.tune[401].ty === ''
     && JSON.stringify(await heads('#musicBody')) === '["Albums","Songs","Artists","Stations","Other"]', JSON.stringify(await heads('#musicBody')));

  console.log('\nAdding from MY Music');
  await ev(() => { Object.defineProperty(navigator, 'clipboard', { configurable:true,
    value:{ readText:async () => 'https://music.youtube.com/playlist?list=OLAK5uy_zzz' } }); });
  await p.click('#musicBody [data-tuneadd]'); await settle(400);
  ok('the box says Add to MY Music, with its Type found from the link', await ev(() =>
     document.querySelector('.lnked .dsec').textContent === 'Add to MY Music'
     && document.querySelector('[data-lety][aria-pressed="true"]').dataset.lety === 'album'));
  await p.fill('#leUrl', 'https://open.spotify.com/track/abc'); await p.dispatchEvent('#leUrl', 'input'); await settle(100);
  ok('a different link changes the Type to match', await ev(() =>
     document.querySelector('[data-lety][aria-pressed="true"]').dataset.lety === 'song'));
  await p.click('[data-lety="album"]');
  await p.fill('#leUrl', 'https://open.spotify.com/playlist/abc'); await p.dispatchEvent('#leUrl', 'input'); await settle(100);
  ok('but not once you have chosen one yourself', await ev(() =>
     document.querySelector('[data-lety][aria-pressed="true"]').dataset.lety === 'album'));
  await clear(); await p.click('#leGo'); await settle(700);
  w = await ev(() => window.__writes);
  const ins = w.find(x => x.op === 'insert' && x.table === 'url_links');
  ok('it is saved under Music, at your first Level', ins && JSON.stringify(ins.rows.subjects) === '["Music"]' && ins.rows.level === 'everyday', JSON.stringify(ins && ins.rows));
  await ev(() => backHome('music'));

  console.log('\nSettings > URL Links: the genre lists');
  await ev(async () => { SET_OPEN = {}; await openSettings('URL Links'); }); await settle(500);
  await ev(() => document.querySelectorAll('[data-setcard="musicgenres"],[data-setcard="podgenres"]').forEach(d => d.open = true));
  ok('MY Music genres and MY Podcasts genres are there', await ev(() =>
     !!document.querySelector('[data-gnname="music:Motown"]') && !!document.querySelector('[data-gnname="pods:True crime"]')
     && /MY Music genres/.test($('setBody').textContent) && /MY Podcasts genres/.test($('setBody').textContent)));
  await clear();
  await p.fill('[data-gnname="music:Rock"]', 'Rock and roll'); await p.dispatchEvent('[data-gnname="music:Rock"]', 'change'); await settle(600);
  lp = await lastProf();
  ok('renaming Rock renames it on the list and on your music', lp && lp.genres.music.includes('Rock and roll') && !lp.genres.music.includes('Rock')
     && lp.tune[405].g.join() === 'Rock and roll,Blues,Skiffle', JSON.stringify(lp && [lp.genres.music, lp.tune[405]]));
  ok('the podcast genres are left alone', lp && lp.genres.pods.join() === 'True crime,History,Comedy,Science,News,Documentary,Sport,Arts,Mixed');
  await ev(() => document.querySelectorAll('[data-setcard="musicgenres"]').forEach(d => d.open = true));
  await clear(); await p.click('[data-gndrop="music:Blues"]'); await settle(600);
  lp = await lastProf();
  ok('removing Blues takes it off the list and off your music', lp && !lp.genres.music.includes('Blues') && lp.tune[405].g.join() === 'Rock and roll,Skiffle',
     JSON.stringify(lp && lp.tune[405]));
  await ev(() => document.querySelectorAll('[data-setcard="podgenres"]').forEach(d => d.open = true));
  await p.fill('#gnNew-pods', 'Nature'); await clear(); await p.click('[data-gnadd="pods"]'); await settle(600);
  lp = await lastProf();
  ok('a new podcast genre is added', lp && lp.genres.pods[lp.genres.pods.length - 1] === 'Nature', JSON.stringify(lp && lp.genres.pods));
  await ev(() => document.querySelectorAll('[data-setcard="podgenres"]').forEach(d => d.open = true));
  await p.fill('#gnNew-pods', 'history'); await clear(); await p.click('[data-gnadd="pods"]'); await settle(300);
  ok('one you have already is not added twice', (await profs()).length === 0
     && await ev(() => [...document.querySelectorAll('.toast')].some(t => t.textContent === 'You already have that one')));
  await ev(() => { $('settings').classList.add('hidden'); lockBackground(); });

  console.log('\nMY Podcasts, sorted as it opens (ML385)');
  await ev(() => openTunes('pods')); await settle(800);
  ok('Interesting and Finished, with no empty Ongoing', JSON.stringify(await heads('#podsBody')) === '["Interesting","Finished"]',
     JSON.stringify(await heads('#podsBody')));
  ok('a new one is Interesting; Finished is your own choice, even on somebody else\'s',
     JSON.stringify(await cardsIn('podsBody', 'podopen')) === '[[410,411,412,413,415],[414]]', JSON.stringify(await cardsIn('podsBody', 'podopen')));
  ok('a podcast card is a button, not a link out', await ev(() => document.querySelector('#podsBody [data-podopen="410"]').tagName === 'BUTTON'));
  await ev(() => editLink(411, undefined, 'pods')); await settle(300);
  const pb = await ev(() => ({ st:[...document.querySelectorAll('[data-lest]')].map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')),
    gen:[...document.querySelectorAll('[data-legen]')].map(x => x.textContent), lv:document.querySelectorAll('[data-lelv]').length }));
  ok('its box has where you are with it, Interesting to start', pb.st.join() === 'Ongoing,Interesting*,Finished' && pb.lv === 0, JSON.stringify(pb));
  ok('and podcast genres: True crime, History, Comedy and the new one', ['True crime', 'History', 'Comedy', 'Nature'].every(g => pb.gen.includes(g)), pb.gen.join());
  await p.click('[data-lest="interesting"]');
  ok('one is always chosen', await ev(() => document.querySelectorAll('[data-lest][aria-pressed="true"]').length === 1));
  await p.click('[data-legen="True crime"]'); await p.click('#leGo'); await settle(700);
  ok('its genre button appears', await ev(() => [...document.querySelectorAll('#podsBody [data-tgen]')].map(x => x.textContent.replace(/\s+/g, ' ')).join('|')
     === 'All · 6|True crime · 1'));

  console.log('\nA BBC podcast\'s episodes (ML386)');
  await clear();
  await p.click('#podsBody [data-podopen="410"]'); await settle(900);
  ok('tapping it opens its episodes, on its own screen', await ev(() => !$('podEps').classList.contains('hidden')
     && $('podEpsTitle').textContent === 'In Our Time' && currentScreen() === 'pods'));
  ok('the BBC\'s own feed was read', hits.bbc === 1 && hits.apple.length === 0, JSON.stringify(hits));
  ok('the tap is counted, as in URL Links', (await ev(() => window.__writes)).some(x => x.op === 'update' && x.table === 'url_links' && x.patch.opens === 10));
  let r = await rows();
  ok('newest first, numbered from the oldest where the feed has no numbers', r.length === 4 && r[0].t === 'Pretend topic 4'
     && /^Ep 4 · 29 Jan 2026 · 45 min$/.test(r[0].m) && /^Ep 1 ·/.test(r[3].m), JSON.stringify(r.map(x => x.m)));
  ok('an episode opens at that episode in BBC Sounds', await ev(() =>
     /^intent:\/\/www\.bbc\.co\.uk\/sounds\/play\/m000aaa4#Intent;scheme=https;package=com\.bbc\.sounds;/
       .test(document.querySelector('#epList [data-epgo]').getAttribute('href'))));
  let t = await bodyText();
  ok('the top says how many, none listened, where they came from', /4 episodes · 0 listened · In Our Time/.test(t), t.slice(0, 120));
  ok('no "choose the episode there" note for the BBC', !/choose the episode there/.test(t));
  ok('no Next up before anything is ticked', !/Next up/.test(t));
  await p.click('#epList [data-eptick="' + r[1].id + '"]'); await settle(300);
  ok('the first tick partway through asks about the earlier ones', await ev(() =>
     !!$('epAll') && /There are 2 episodes before this one/.test(document.querySelector('body > .daypick').textContent)));
  await p.click('#epAll'); await settle(500);
  r = await rows();
  ok('Tick all: that one and the two before it are ticked', r.map(x => x.on).join() === 'false,true,true,true', JSON.stringify(r.map(x => x.on)));
  lp = await lastProf();
  ok('kept with your own settings, three short codes', lp && lp.heard[410] && lp.heard[410].length === 3
     && lp.heard[410].every(x => /^[0-9a-z]{1,8}$/.test(x)), JSON.stringify(lp && lp.heard));
  ok('and the podcast is now Ongoing', lp && lp.tune[410] && lp.tune[410].st === 'ongoing', JSON.stringify(lp && lp.tune[410]));
  t = await bodyText();
  ok('Next up is the one after the last ticked', /Next up\s*Pretend topic 4/.test(t) && /3 listened/.test(t), t.slice(0, 260));
  ok('the status buttons show Ongoing', await ev(() => document.querySelector('[data-epst][aria-pressed="true"]').dataset.epst === 'ongoing'));
  await clear();
  await p.click('#epList [data-eptick="' + r[2].id + '"]'); await settle(300);
  ok('untick one: no question this time', await ev(() => !$('epAll')));
  r = await rows();
  ok('it comes off', r.map(x => x.on).join() === 'false,true,false,true', JSON.stringify(r.map(x => x.on)));
  await p.click('#epList [data-eptick="' + r[0].id + '"]'); await settle(300);
  t = await bodyText();
  ok('the newest ticked: caught up', /listened to every episode so far/.test(t) && !/Next up/.test(t), t.slice(0, 300));
  await p.click('[data-epshow="todo"]'); await settle(200);
  r = await rows();
  ok('Not listened shows only the one left', r.length === 1 && r[0].t === 'Pretend topic 2', JSON.stringify(r));
  ok('the buttons are All, Not listened and Listened, each on one line at 390 wide', await ev(() => {
     const b = [...document.querySelectorAll('[data-epshow]')];
     return b.map(x => x.textContent.trim()).join('|') === 'All|Not listened|Listened'
       && b.every(x => x.getBoundingClientRect().height < 50); }));
  await p.click('[data-epshow="done"]'); await settle(200);
  ok('Listened shows the three', (await rows()).length === 3);
  await p.click('[data-epshow="all"]'); await p.click('[data-eporder]'); await settle(200);
  r = await rows();
  ok('Oldest first turns it round', r[0].t === 'Pretend topic 1' && await ev(() => /Oldest first/.test(document.querySelector('[data-eporder]').textContent)));
  await p.click('[data-eporder]');
  await p.fill('#epNum', '2'); await settle(200);
  r = await rows();
  ok('the number box finds episode 2 and keeps the keyboard', r.length === 1 && r[0].t === 'Pretend topic 2'
     && await ev(() => document.activeElement && document.activeElement.id === 'epNum'), JSON.stringify(r));
  await p.fill('#epNum', '9'); await settle(200);
  ok('no such episode says so', await ev(() => /No episode 9\./.test($('epList').textContent)));
  await p.fill('#epNum', '');
  await clear(); await p.click('#podEpsBack'); await settle(500);
  ok('Back goes to MY Podcasts, now with Ongoing first', await ev(() => $('podEps').classList.contains('hidden') && !$('pods').classList.contains('hidden'))
     && JSON.stringify(await heads('#podsBody')) === '["Ongoing","Interesting","Finished"]', JSON.stringify(await heads('#podsBody')));
  ok('its card says how many listened', await ev(() =>
     /3 listened/.test(document.querySelector('#podsBody [data-podopen="410"] .mumeta').textContent)));
  await p.click('#podsBody [data-podopen="410"]'); await settle(500);
  ok('opened again in the same session: the feed is not fetched again', hits.bbc === 1, JSON.stringify(hits));
  await ev(() => backStep()); await settle(300);
  ok('the phone\'s own Back also goes to MY Podcasts', await ev(() => $('podEps').classList.contains('hidden') && !$('pods').classList.contains('hidden')));

  console.log('\nAnother podcast, found by name in Apple\'s directory');
  await clear();
  await p.click('#podsBody [data-podopen="411"]'); await settle(1200);
  ok('looked up by its name, then its feed read', JSON.stringify(hits.apple) === '["Pretend Crime"]' && hits.crime === 1, JSON.stringify(hits));
  lp = await lastProf();
  ok('the feed it found is kept, so it is not looked up again', lp && lp.tune[411] && lp.tune[411].f === 'https://feeds.example/crime.rss'
     && lp.tune[411].fn === 'Pretend Crime', JSON.stringify(lp && lp.tune[411]));
  t = await bodyText();
  ok('120 episodes, and a note that Spotify opens a search for the episode (ML391)',
     /120 episodes · 0 listened/.test(t) && /An episode opens Spotify searching for it: it is usually the top result\./.test(t)
     && !/choose the episode there/.test(t), t.slice(0, 300));
  r = await rows();
  ok('the feed\'s own numbers and series are shown', r.length === 100 && /^Series 2, Ep 120 · /.test(r[0].m), r[0] && r[0].m);
  ok('an episode opens Spotify searching for its title and the podcast\'s name', await ev(() =>
     document.querySelector('#epList [data-epgo]').getAttribute('href')
       .startsWith('intent://open.spotify.com/search/Case%20120%20Pretend%20Crime#Intent;scheme=https;package=com.spotify.music;')),
     await ev(() => document.querySelector('#epList [data-epgo]').getAttribute('href')));
  ok('the button at the top still opens the podcast in Spotify', await ev(() =>
     /^intent:\/\/open\.spotify\.com\/show\/2MAi0BvDc6#Intent;.*package=com\.spotify\.music;/
       .test(document.querySelector('[data-epopen]').getAttribute('href'))));
  ok('the search: a title with the podcast\'s name in it, a slash, and no title at all', await ev(() => {
    const l = { url:'https://open.spotify.com/show/x', open_with:'spotify' }, e = t => ({ t, guid:'', link:'' });
    return epHref(l, e('Pretend Crime: Case 1'), 'Pretend Crime').url === 'https://open.spotify.com/search/Pretend%20Crime%3A%20Case%201'
      && epHref(l, e('AC/DC  and me'), 'Pod').url === 'https://open.spotify.com/search/AC%20DC%20and%20me%20Pod'
      && epHref(l, e('(no title)'), 'Pod').url === 'https://open.spotify.com/show/x'; }));
  ok('a Spotify podcast left to Phone decides searches the same way, as an ordinary link', await ev(() => {
    const g = epHref({ url:'https://open.spotify.com/show/x', open_with:'' }, { t:'One', guid:'', link:'' }, 'Pod');
    return g.find && g.href === g.url && g.url === 'https://open.spotify.com/search/One%20Pod'; }));
  ok('a podcast that opens somewhere else still opens the podcast', await ev(() => {
    const g = epHref({ url:'https://podcasts.apple.com/gb/podcast/x/id1', open_with:'' }, { t:'One', guid:'', link:'' }, 'Pod');
    return !g.find && g.url === 'https://podcasts.apple.com/gb/podcast/x/id1'; }));
  ok('100 at a time, with a button for the rest', await ev(() => /Show 20 more of 20/.test(document.querySelector('[data-epmore]').textContent)));
  await p.click('[data-epmore]'); await settle(200);
  ok('which shows them all', (await rows()).length === 120 && !(await p.$('[data-epmore]')));
  await p.fill('#epNum', '57'); await settle(200);
  r = await rows();
  ok('the number box finds episode 57', r.length === 1 && r[0].t === 'Case 57' && /^Series 1, Ep 57 · /.test(r[0].m), JSON.stringify(r));
  await clear();
  await p.click('#epList [data-eptick="' + r[0].id + '"]'); await settle(300);
  await p.click('#epShut'); await settle(300);
  ok('Cancel on the question ticks nothing and saves nothing', !(await rows())[0].on && (await profs()).length === 0);
  await p.click('#epList [data-eptick="' + r[0].id + '"]'); await settle(300);
  await p.click('#epOne'); await settle(400);
  await p.fill('#epNum', '');
  r = await rows();
  ok('Just this one ticks only episode 57', r.filter(x => x.on).map(x => x.t).join() === 'Case 57', JSON.stringify(r.filter(x => x.on)));
  t = await bodyText();
  ok('Next up is episode 58', /Next up\s*Case 58/.test(t), t.slice(0, 400));
  // Ticked quickly, one after another: the last saving has every tick.
  await clear();
  await ev(() => ['Case 58', 'Case 59', 'Case 60'].forEach(n => [...document.querySelectorAll('#epList .eprow')]
    .find(r => r.querySelector('b').textContent === n).querySelector('.eptick').click()));
  await settle(800);
  const ps = await profs();
  ok('ticked quickly, the last saving has all four, in no more than two savings', ps.length >= 1 && ps.length <= 2
     && ps[ps.length - 1].heard[411].length === 4, JSON.stringify(ps.map(x => x.heard[411] && x.heard[411].length)));
  await p.click('[data-epst="finished"]'); await settle(400);
  lp = await lastProf();
  ok('Finished pressed at the top is kept', lp && lp.tune[411].st === 'finished' && lp.tune[411].f === 'https://feeds.example/crime.rss', JSON.stringify(lp && lp.tune[411]));
  await p.click('#podEpsBack'); await settle(300);
  await p.click('#podsBody [data-podopen="411"]'); await settle(600);
  ok('opened again: no looking up, no fetching', hits.apple.length === 1 && hits.crime === 1, JSON.stringify(hits));
  await p.click('#podEps [data-barref]'); await settle(1500);
  ok('refresh at the top fetches the list again', hits.crime === 2 && (await rows()).length === 100, JSON.stringify(hits));

  console.log('\nNot the right podcast?');
  await p.click('[data-epwrong]'); await settle(700);
  const found = await ev(() => [...document.querySelectorAll('[data-epf]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok('it offers what Apple found under that name, with who makes each', found.length === 2 && /Pretend Crime Extra \(Other Studio\)/.test(found[1]), JSON.stringify(found));
  await clear(); await p.click('[data-epf="1"]'); await settle(900);
  ok('choosing another reads its feed instead, made safe as https', hits.extra === 1 && /2 episodes/.test(await bodyText()), JSON.stringify(hits));
  lp = await lastProf();
  ok('and keeps it', lp && lp.tune[411].f === 'https://feeds.example/extra.rss' && lp.tune[411].fn === 'Pretend Crime Extra', JSON.stringify(lp && lp.tune[411]));
  await p.click('[data-epwrong]'); await settle(700);
  await p.fill('#epFeed', 'no address here'); await p.click('#epFeedGo'); await settle(200);
  ok('pasting something that is not an address says so', await ev(() =>
     [...document.querySelectorAll('.toast')].some(t => t.textContent === 'That does not look like a web address') && !!$('epFeed')));
  await p.fill('#epFeed', 'feeds.example/crime.rss'); await p.click('#epFeedGo'); await settle(900);
  t = await bodyText();
  ok('pasting its feed puts it right, with the ticks still there', /120 episodes · 4 listened/.test(t), t.slice(0, 120));
  await p.click('#podEpsBack'); await settle(300);

  console.log('\nWhen there is no list');
  await p.click('#podsBody [data-podopen="412"]'); await settle(800);
  t = await bodyText();
  ok('a feed that will not let the app read it says so, with a way to open it', /doesn.t let the app read its list of episodes/.test(t)
     && await ev(() => !!document.querySelector('#podEpsBody [data-epopen]') && !!document.querySelector('#podEpsBody [data-epwrong]')), t);
  await p.click('#podEpsBack'); await settle(300);
  await p.click('#podsBody [data-podopen="413"]'); await settle(800);
  t = await bodyText();
  ok('nothing found under its name says so, mentioning Spotify-only ones', /No list of episodes was found/.test(t) && /only on Spotify/.test(t)
     && await ev(() => /Open in Spotify/.test($('podEpsBody').textContent)), t);
  await p.click('#podEpsBack'); await settle(300);
  await p.click('#podsBody [data-podopen="415"]'); await settle(800);
  t = await bodyText();
  ok('no signal says try again, and that nothing is lost', /Could not look for the episodes just now/.test(t) && /Nothing has been lost/.test(t), t);
  ok('none of these is kept as a feed', await ev(() => !(LINK_PREFS.tune[412] || {}).f && !(LINK_PREFS.tune[413] || {}).f && !(LINK_PREFS.tune[415] || {}).f));

  console.log('\nHome, help and deleting');
  await ev(() => backHome('pods')); await settle(200);
  ok('Home shuts the episodes too', await ev(() => $('podEps').classList.contains('hidden') && $('pods').classList.contains('hidden') && EP_CUR === null));
  ok('the help covers Types, ticks, Next up and genres', await ev(() => { openHelp('music'); const h = $('h-music'); let s = ''; let n = h.nextElementSibling;
     while (n && n.tagName !== 'H4') { s += n.textContent; n = n.nextElementSibling; }
     $('help').classList.add('hidden'); lockBackground();
     return /Playlists/.test(s) && /Ongoing/.test(s) && /Tick the circle/.test(s) && /Next up/.test(s) && /Not the right podcast/.test(s) && /Settings/.test(s); }));
  await ev(() => openTunes('pods')); await settle(600);
  await clear(); await ev(() => editLink(410, undefined, 'pods')); await settle(300);
  await p.click('#leDel'); await settle(700);
  lp = await lastProf();
  ok('deleting a podcast takes its ticks and status from your settings too', lp && !(410 in lp.heard) && !(410 in lp.tune) && !(410 in lp.pics),
     JSON.stringify(lp && [Object.keys(lp.heard), Object.keys(lp.tune)]));
  const keys = await ev(() => Object.keys(localStorage));
  ok('nothing went into the phone\'s own storage', !keys.some(k => /tune|heard|genre|ep|feed|pod/i.test(k)), keys.join(','));

  console.log('\nA slow signal');
  // Going Home while a tick is still being saved must not undo it (found 23 Nov 2026).
  const race = await ev(async () => {
    const from = sb.from;
    sb.from = function (t) { const q = from.call(sb, t); if (t !== 'profiles') return q;
      const up = q.update.bind(q); q.update = patch => { up(patch);
        return { eq: () => new Promise(r => setTimeout(() => r({ error:null }), 1200)) }; }; return q; };
    LINK_PREFS.heard = { ...LINK_PREFS.heard, 999:['slow'] }; const s = tuneSave();
    showHome(); const atOnce = JSON.stringify((LINK_PREFS.heard || {})[999]);
    await s; sb.from = from; showHome();
    return { atOnce, after:JSON.stringify((LINK_PREFS.heard || {})[999]) };
  });
  ok('a tick still being saved survives going Home', race.atOnce === '["slow"]' && race.after === '["slow"]', JSON.stringify(race));
  await ev(() => { const h = { ...LINK_PREFS.heard }; delete h[999]; LINK_PREFS.heard = h; });
  await ev(() => openTunes('pods')); await settle(600);

  console.log('\nAt 320 wide');
  await p.setViewportSize({ width:320, height:700 });
  await p.click('#podsBody [data-podopen="411"]'); await settle(900);
  ok('the episodes fit: nothing spills off the side', await ev(() => { const b = $('podEpsBody'); return b.scrollWidth <= b.clientWidth + 1; }));
  ok('the tick circles stay round and on the left', await ev(() => { const t = document.querySelector('#epList .eptick').getBoundingClientRect();
     const g = document.querySelector('#epList .epgo').getBoundingClientRect(); return Math.abs(t.width - t.height) < 1 && t.right <= g.left + 1; }));
  await p.click('[data-epwrong]'); await settle(700);
  ok('the Which podcast box fits too', await ev(() => { const i = document.querySelector('body > .daypick .inner');
     return i.scrollWidth <= i.clientWidth + 1; }));
  await p.click('#epPickShut');
  await ev(() => { $('podEps').classList.add('hidden'); EP_CUR = null; openTunes('music'); }); await settle(600);
  ok('MY Music with its headings and genre buttons fits', await ev(() => { const b = $('musicBody'); return b.scrollWidth <= b.clientWidth + 1; }));

  console.log('\n' + '='.repeat(52));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
