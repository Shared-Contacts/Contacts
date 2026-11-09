// The 6 Nov 2026 batch. Jigsaws: a landscape puzzle opens filling the phone
// on its side (ML210, Barry's choice: straight away). People: every box for
// choosing people fills the screen, with only the people scrolling, and every
// list of people has a search box once there are more than three (ML211).
// Loxx's Undo last move and the 12 or 2 without five marks (ML212, ML213)
// are in lockkeeper.test.js.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ERR_BLOCKED|ServiceWorker|signed\.test|font|Failed to fetch|gstatic|nominatim|bsky|open-meteo|set_person|PGRST202|^\[object Object\]$|JSHandle@object/i;
const ROOT = path.join(__dirname, '..');
const VJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

// Jigsaw Explorer will not play in a test browser, so a stand-in page takes
// its place: it says how big it is and where it was tapped.
const FAKE = `<!doctype html><html><body style="margin:0;background:#ddd">
<div style="position:fixed;inset:0"></div><script>
const say = k => parent.postMessage({ k, w: innerWidth, h: innerHeight, x: k.x, y: k.y }, '*');
addEventListener('load', () => say({}));
addEventListener('resize', () => say({}));
addEventListener('pointerdown', e => say({ x: e.clientX, y: e.clientY }));
</script></body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  let answer = true; const asked = [];
  p.on('dialog', d => { asked.push(d.message()); return answer ? d.accept() : d.dismiss(); });
  let puzzleLoads = 0;
  await p.route(/jigsawexplorer\.com/, r => { puzzleLoads++; return r.fulfill({ contentType: 'text/html', body: FAKE }); });
  await p.route(/i0\.wp\.com/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 400) => p.waitForTimeout(ms);
  const top = () => ev(() => SHEET_STACK[SHEET_STACK.length - 1]);
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); lockBackground(); });
  const toasts = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply();
    window.__said = []; addEventListener('message', e => { if (e.data && e.data.k) window.__said.push(e.data); });
    // What the app asks of the phone's screen, and the phone saying yes.
    window.__turns = []; window.__canTurn = true;
    screen.orientation.lock = o => { window.__turns.push(o); return window.__canTurn ? Promise.resolve() : Promise.reject(new Error('not allowed')); };
    screen.orientation.unlock = () => { window.__turns.push('unlock'); }; });
  const turns = () => ev(() => window.__turns.slice());
  const said = () => ev(() => window.__said.slice());
  const lastSize = () => ev(() => { const s = window.__said.filter(x => x.x == null); return s[s.length - 1] || null; });

  // ---------------------------------------------------------------
  console.log('\nThis version');
  const appVer = await ev(() => APP_VERSION);
  // A later version is on top now (batch1109.test.js checks that one); this
  // one stays in the list.
  const V6 = VJ.history.find(h => h.version === '2026.11.06.1');
  ok('2026.11.06.1 is in version.json, and the page is the newest', !!V6 && VJ.version === appVer && VJ.history[0].version === appVer, appVer + ' / ' + VJ.version);
  ok('  saying what changed: jigsaws, people, Loxx', V6 && /Jigsaws/.test(V6.changes.join(' ')) && /search/i.test(V6.changes.join(' '))
    && /Undo last move/.test(V6.changes.join(' ')), JSON.stringify(V6));

  // ---------------------------------------------------------------
  console.log('\nA landscape jigsaw, on a phone turned sideways (ML210)');
  const wideAt = await ev(() => JIGSAWS.findIndex(j => !j.v)), tallAt = await ev(() => JIGSAWS.findIndex(j => j.v));
  ok('there are landscape puzzles and upright ones', wideAt >= 0 && tallAt >= 0, wideAt + ' ' + tallAt);
  await ev(() => openJig()); await settle(300);
  await p.click(`[data-jig="${wideAt}"]`); await settle(700);
  // Since ML218 (9 Nov 2026) it opens on its page first, with the button.
  ok('tap a landscape picture: its page opens first, not full screen', await ev(() => !$('jigPlay').classList.contains('jigfull')
    && !!document.querySelector('.jigpic')) && await top() === 'jigPlay' && (await turns()).length === 0, (await turns()).join());
  await ev(() => $('jigGoFull').click()); await settle(500);
  ok('Play full screen, on its side: the puzzle fills the screen', await ev(() => $('jigPlay').classList.contains('jigfull')) && await top() === 'jigPlay');
  ok('  asking the phone to turn on its side', (await turns()).join() === 'landscape', (await turns()).join());
  const full = await ev(() => { const st = document.querySelector('.jigstage').getBoundingClientRect(), fr = document.querySelector('.jigframe').getBoundingClientRect(),
    x = $('jigAll').getBoundingClientRect(), i = $('jigAbout').getBoundingClientRect();
    return { st: st.toJSON(), fr: fr.toJSON(), x: x.toJSON(), i: i.toJSON(), iw: innerWidth, ih: innerHeight,
      tf: getComputedStyle(document.querySelector('.jigstage')).transform,
      atBar: document.elementFromPoint(20, 20).closest('.jigstage') !== null }; });
  ok('  it fills the whole screen, the right way up', full.tf === 'none' && Math.abs(full.st.left) < 1 && Math.abs(full.st.top) < 1
    && Math.abs(full.st.width - full.iw) < 1 && Math.abs(full.st.height - full.ih) < 1, JSON.stringify(full));
  ok('  the puzzle has all of it but a narrow strip down the side', full.fr.height >= full.ih - 1 && full.fr.width >= full.iw - 70 && full.fr.right >= full.iw - 1, JSON.stringify(full.fr));
  ok('  where an x and an i sit, big enough for a thumb, off the puzzle', full.x.width >= 44 && full.x.height >= 44 && full.i.width >= 44
    && full.x.right <= full.fr.left + 1 && full.i.right <= full.fr.left + 1, JSON.stringify([full.x, full.i]));
  ok('  nothing of the page shows round it: no top bar', full.atBar);
  ok('  and the bottom tiles and the new-version bar are out of the way', await ev(() => getComputedStyle($('tray')).display === 'none')
    && await ev(() => [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /#jigPlay\.jigfull:not\(\.hidden\)\)?\s*#verBar/.test(r.cssText)); } catch (e) { return false; } })));
  ok('the puzzle loads once', puzzleLoads === 1, puzzleLoads);
  await settle(300);
  let sz = await lastSize();
  ok('  and sees a landscape screen to lay itself out on', sz && sz.w > sz.h && sz.w >= full.iw - 70, JSON.stringify(sz));
  await ev(() => { window.__said.length = 0; });
  await p.mouse.click(full.fr.left + 200, full.fr.top + 100); await settle(300);
  let hit = (await said()).find(x => x.x != null);
  ok('a tap on the puzzle reaches it, in the right place', hit && Math.abs(hit.x - 200) < 3 && Math.abs(hit.y - 100) < 3, JSON.stringify(hit));

  await p.click('#jigAbout'); await settle(400);
  ok('the i: out of full screen, showing the picture and its words', await ev(() => !$('jigPlay').classList.contains('jigfull')
    && !$('jigPlay').classList.contains('hidden') && document.querySelector('.jigpic').getBoundingClientRect().top < 200));
  ok('  the phone may go back upright', (await turns()).join() === 'landscape,unlock', (await turns()).join());
  ok('  the puzzle is still the same one: not loaded again', puzzleLoads === 1, puzzleLoads);
  ok('  and the tiles come back', await ev(() => getComputedStyle($('tray')).display !== 'none'));
  ok('with a button above the puzzle to go back to it', await ev(() => !!$('jigGoFull') && /Play full screen, on its side/.test($('jigGoFull').textContent)));
  await ev(() => $('jigGoFull').click()); await settle(400);
  ok('  which fills the screen again, sideways', await ev(() => $('jigPlay').classList.contains('jigfull')) && (await turns()).join() === 'landscape,unlock,landscape'
    && puzzleLoads === 1, (await turns()).join() + ' ' + puzzleLoads);
  await p.click('#jigAll'); await settle(400);
  ok('the x: back to all the puzzles', await ev(() => $('jigPlay').classList.contains('hidden') && !$('jig').classList.contains('hidden'))
    && await top() === 'jig');
  ok('  the phone may go back upright', (await turns()).slice(-1)[0] === 'unlock');
  ok('  and the puzzle is put away', await ev(() => !document.querySelector('.jigframe') && !$('jigPlay').classList.contains('jigfull')));

  await ev(() => { window.__turns.length = 0; });
  await p.click(`[data-jig="${tallAt}"]`); await settle(500);
  ok('an upright picture opens as before: the words, then the puzzle in its frame', await ev(() => !$('jigPlay').classList.contains('jigfull')
    && document.querySelector('.jigpic') && document.querySelector('.jigframe').getBoundingClientRect().width < innerWidth));
  ok('  no turning, and no full screen button', (await turns()).length === 0 && !(await p.$('#jigGoFull')), (await turns()).join());
  await p.click('#jigBack'); await settle(300);

  await ev(() => { window.__turns.length = 0; });
  await p.click(`[data-jig="${wideAt}"]`); await settle(500);
  await ev(() => $('jigGoFull').click()); await settle(300);
  await ev(() => { $('jigPlay').classList.add('hidden'); lockBackground(); }); await settle(200);
  ok('put away by something else (Home, say): the phone goes back upright too', (await turns()).join() === 'landscape,unlock'
    && await ev(() => !JIG_TURNED), (await turns()).join());
  await closeAll();

  // ---------------------------------------------------------------
  console.log('\nHeld upright, with the screen kept upright');
  await p.setViewportSize({ width: 390, height: 844 }); await settle(300);
  await ev(() => { window.__canTurn = false; window.__said.length = 0; });
  await ev(() => openJig()); await settle(300);
  await ev(i => document.querySelector(`[data-jig="${i}"]`).click(), wideAt); await settle(500);
  await ev(() => $('jigGoFull').click()); await settle(500);
  const up = await ev(() => { const st = document.querySelector('.jigstage'), r = st.getBoundingClientRect();
    return { tf: getComputedStyle(st).transform, r: r.toJSON(), iw: innerWidth, ih: innerHeight,
      side: document.querySelector('.jigside').offsetWidth, x: $('jigAll').getBoundingClientRect().toJSON() }; });
  ok('the puzzle turns itself round to fill the screen', up.tf !== 'none' && Math.abs(up.r.left) < 1 && Math.abs(up.r.top) < 1
    && Math.abs(up.r.width - up.iw) < 1 && Math.abs(up.r.height - up.ih) < 1, JSON.stringify(up));
  ok('  the x and i along the top, to read with the phone turned left', up.x.top < 80 && up.x.right > up.iw - 80, JSON.stringify(up.x));
  sz = await lastSize();
  ok('  the puzzle still sees a landscape screen', sz && sz.w > sz.h && Math.abs(sz.h - up.iw) < 2, JSON.stringify(sz));
  await ev(() => { window.__said.length = 0; });
  // A spot 150 across and 60 down the turned puzzle is, on the upright screen,
  // 60 in from the right and 150 below the strip.
  await p.mouse.click(up.iw - 60, up.side + 150); await settle(300);
  hit = (await said()).find(x => x.x != null);
  ok('  and a tap still reaches the right spot on it', hit && Math.abs(hit.x - 150) < 3 && Math.abs(hit.y - 60) < 3, JSON.stringify(hit));
  await ev(() => $('jigAll').click()); await settle(300);
  ok('  the x goes back to all the puzzles', await top() === 'jig' && await ev(() => $('jigPlay').classList.contains('hidden')));
  await closeAll();
  await ev(() => { window.__canTurn = true; });

  // ---------------------------------------------------------------
  console.log('\nChoosing people: a short list (ML211)');
  ok('three or fewer people: no search box (the test page has two others)', await ev(() => USERS.length) <= 3
    && await (async () => { await ev(() => pickPeople('Who should get a copy?', () => {})); await settle(200);
      return !(await p.$('.daypick .pplfind')); })());
  await closeAll();

  // A dozen people, as there will be more to come.
  await ev(async () => { for (let i = 0; i < 12; i++) window.__rows.profiles.push({ id: 'many' + i,
    display_name: 'Person Number ' + i, email: 'person.number' + i + '@example.com', phone: '07700 9000' + (10 + i) });
    await loadAll(); });
  ok('a dozen people to choose from now', await ev(() => USERS.length) >= 12, await ev(() => USERS.length));

  console.log('\nSend to: the box fills the screen, only the people scroll');
  let got = null;
  await ev(() => { window.__got = null; pickPeople('Who should get a copy?', w => { window.__got = w; }); }); await settle(300);
  const box = await ev(() => { const d = document.querySelector('.daypick'), inner = d.querySelector('.inner').getBoundingClientRect(),
    list = d.querySelector('.checks.ppl'), h = d.querySelector('.dsec').getBoundingClientRect(), go = $('ppGo').getBoundingClientRect();
    return { cls: d.className, inner: inner.toJSON(), ih: innerHeight, iw: innerWidth, head: h.top, go: go.bottom,
      listScrolls: list.scrollHeight > list.clientHeight + 10, boxScrolls: d.scrollHeight > d.clientHeight + 1 }; });
  ok('it fills the screen', /pplbox/.test(box.cls) && Math.abs(box.inner.top) < 1 && Math.abs(box.inner.height - box.ih) < 1
    && Math.abs(box.inner.width - box.iw) < 1, JSON.stringify(box));
  ok('  the heading at the top and Send at the bottom, both in sight', box.head >= 0 && box.head < 60 && box.go <= box.ih, JSON.stringify(box));
  ok('  the people scroll; the box does not', box.listScrolls && !box.boxScrolls, JSON.stringify(box));
  const after = await ev(() => { const d = document.querySelector('.daypick'), list = d.querySelector('.checks.ppl');
    list.scrollTop = list.scrollHeight;
    return { head: d.querySelector('.dsec').getBoundingClientRect().top, go: $('ppGo').getBoundingClientRect().bottom,
      find: d.querySelector('.pplfind').getBoundingClientRect().top, list: list.getBoundingClientRect().top, ih: innerHeight }; });
  ok('  scrolled to the bottom: the heading, the search box and Send stay put', after.head >= 0 && after.head < 60 && after.go <= after.ih
    && Math.abs(after.find - after.list) < 2, JSON.stringify(after));

  console.log('\nThe search box');
  const shown = () => ev(() => [...document.querySelectorAll('.daypick .checks.ppl > label')].filter(l => !l.hidden && l.offsetParent).length);
  ok('a search box at the top of the list', !!(await p.$('.daypick .checks.ppl > .pplfind:first-child input[type=search]'))
    && await ev(() => document.querySelector('.pplfind input').placeholder === 'Search people'));
  ok('  no x until something is typed', await ev(() => document.querySelector('.pplfind .hx').hidden && getComputedStyle(document.querySelector('.pplfind .hx')).display === 'none'));
  const all = await shown();
  await p.fill('.daypick .pplfind input', 'number 3'); await settle(100);
  ok('type "number 3": only Person Number 3', await shown() === 1 && await ev(() =>
    [...document.querySelectorAll('.daypick .checks.ppl > label')].find(l => !l.hidden).textContent.includes('Person Number 3')), String(await shown()));
  await p.fill('.daypick .pplfind input', 'PERSON.NUMBER1'); await settle(100);
  ok('  part of an email, in capitals: 1, 10 and 11', await shown() === 3, String(await shown()));
  await p.fill('.daypick .pplfind input', '900020'); await settle(100);
  ok('  part of a phone number', await shown() === 1, String(await shown()));
  await p.fill('.daypick .pplfind input', 'sandra'); await settle(100);
  ok('  a name', await shown() === 1);
  await ev(() => document.querySelector('.daypick input[value="sandra"]').click());
  await p.fill('.daypick .pplfind input', 'zebra'); await settle(100);
  ok('nobody matching: it says so', await shown() === 0 && await ev(() => { const n = document.querySelector('.pplnone');
    return !n.hidden && /Nobody matches “zebra”/.test(n.textContent); }));
  await p.press('.daypick .pplfind input', 'Enter'); await settle(150);
  ok('  Enter does not send it', !!(await p.$('.daypick')) && await ev(() => window.__got === null));
  await p.click('.daypick .pplfind .hx'); await settle(100);
  ok('the x empties it: everyone back', await shown() === all && await ev(() => document.querySelector('.pplfind input').value === ''
    && document.querySelector('.pplnone').hidden));
  await p.fill('.daypick .pplfind input', 'number 5'); await settle(100);
  await ev(() => document.querySelector('.daypick input[value="many5"]').click());
  await p.fill('.daypick .pplfind input', 'number 7'); await settle(100);
  await p.click('#ppGo'); await settle(300);
  got = await ev(() => window.__got);
  ok('a tick on someone the search has hidden still counts: Send goes to Sandra and Person Number 5', JSON.stringify((got || []).slice().sort()) === '["many5","sandra"]', JSON.stringify(got));
  await closeAll();

  console.log('\nThe other boxes for choosing people');
  await ev(() => { lkPickPlayers(); }); await settle(300);
  ok('Loxx, Who is playing: full screen, with the search box', await ev(() => $('lkWho').classList.contains('pplbox')
    && !!$('lkWho').querySelector('.pplfind') && Math.abs($('lkWho').querySelector('.inner').getBoundingClientRect().height - innerHeight) < 1));
  await ev(() => $('lkwCancel').click()); await settle(200);
  await ev(() => { newChat(); }); await settle(300);
  ok('Messages, Who is it for: the same', await ev(() => { const d = document.querySelector('.daypick');
    return d.classList.contains('pplbox') && !!d.querySelector('.pplfind'); }));
  ok('  and the keyboard does not jump up on opening it', await ev(() => !document.activeElement || document.activeElement.type !== 'search'));
  await closeAll();
  const acc = await ev(() => ACCOUNTS.find(a => a.created_by === ME.id).id);
  await ev(id => { shareBox(id); }, acc); await settle(300);
  ok('Finances, Who can see an account: the same', await ev(() => { const d = document.querySelector('.daypick');
    return d.classList.contains('pplbox') && !!d.querySelector('.ppllist .pplfind'); }));
  await p.fill('.daypick .pplfind input', 'number 4'); await settle(100);
  ok('  the search works on its rows', await ev(() => [...document.querySelectorAll('.ppllist > .setrow')].filter(r => !r.hidden).length === 1));
  await ev(() => [...document.querySelectorAll('.ppllist > .setrow')].find(r => !r.hidden).querySelector('[data-lvl$=":look"]').click()); await settle(400);
  ok('  choosing Look only draws the box again, keeping the search', await ev(() => document.querySelector('.daypick .pplfind input').value === 'number 4'
    && [...document.querySelectorAll('.ppllist > .setrow')].filter(r => !r.hidden).length === 1));
  await closeAll();

  console.log('\nLists of people inside a page');
  await ev(() => { editLink(null); }); await settle(400);
  ok('URL Links, Who can see it, Just me: the people and their search box stay hidden', await ev(() => { const l = $('lePeople');
    return l.hidden && getComputedStyle(l).display === 'none' && !!l.querySelector('.pplfind') && !l.querySelector('.pplfind').offsetParent; }));
  await ev(() => document.querySelector('[data-lewho="some"]').click()); await settle(200);
  ok('  Choose people: the list, with its search box', await ev(() => !$('lePeople').hidden && !!$('lePeople').querySelector('.pplfind').offsetParent));
  ok('  and the box is not made full screen: it is not just for people', await ev(() => !document.querySelector('.daypick').classList.contains('pplbox')));
  await closeAll();
  await ev(() => { openWhere(); }); await settle(700);
  ok('Where we are, who may see: a search box too', await ev(() => !!document.querySelector('#where .checks.ppl .pplfind')
    || !!document.querySelector('.checks.ppl [name="shareWith"]') && !!document.querySelector('.checks.ppl .pplfind')));
  await closeAll();
  ok('any list of people drawn later gets one by itself', await ev(async () => {
    document.body.insertAdjacentHTML('beforeend', '<div class="checks ppl" id="tstList">' + USERS.map(u => `<label><input type="checkbox" value="${u.id}"> ${pplWho(u)}</label>`).join('') + '</div>');
    await new Promise(r => setTimeout(r, 50)); const ok = !!document.querySelector('#tstList > .pplfind'); $('tstList').remove(); return ok; }));
  ok('  and the search box is never sent as one of the people', await ev(() => !document.querySelector('.pplfind input[name], .pplfind input[value]')));

  // Every place people are chosen, as the page is written.
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  ok('the five boxes for choosing people are all full screen', (src.match(/pplbox/g) || []).length >= 5
    && /box\.className='daypick pplbox'; box\.id='lkWho'/.test(src));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
