// The towpath test: two names and a boat, with and without a signal.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (w, c, e='') => {
  if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); }
};
const URL = 'file://' + path.join(__dirname, 'jotboot.html');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 },
    permissions:['geolocation'], geolocation:{ latitude:52.28, longitude:-1.63 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|font|Failed to fetch/i.test(t))
      errors.push('CONSOLE: ' + t); });

  await p.goto(URL);
  await p.waitForTimeout(800);

  console.log('\nIt opens ready to type');
  ok('the form is the first thing you see', await p.isVisible('#fFirst'));
  ok('the cursor is already in First name',
     await p.evaluate(() => document.activeElement.id === 'fFirst'));
  ok('today is filled in', (await p.inputValue('#fDate')) === new Date().toISOString().slice(0,10),
     await p.inputValue('#fDate'));
  ok('it is signed in through the shared session',
     !/not signed in/i.test(await p.textContent('#status')),
     await p.textContent('#status'));
  ok('your position is picked up quietly',
     await p.evaluate(() => GPS !== null));

  console.log('\nIt will not save nothing');
  await p.click('#save');
  await p.waitForTimeout(400);
  ok('an empty form is refused',
     /name or a boat name/i.test((await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' | ')).catch(()=>''))),
     (await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' | ')).catch(()=>'(none)')));
  ok('nothing was written', await p.evaluate(() =>
     (window.__writes||[]).filter(x=>x.table==='contacts').length === 0));

  console.log('\nA boat name on its own is enough');
  await p.fill('#fBoat', 'Kingfisher');
  await p.evaluate(() => { window.__writes = []; });
  await p.click('#save');
  await p.waitForTimeout(700);
  const w1 = await p.evaluate(() => window.__writes.find(x =>
     x.op==='insert' && x.table==='contacts'));
  ok('it saved', !!w1, JSON.stringify(await p.evaluate(()=>window.__writes)));
  ok('the boat name went in', w1 && w1.rows.boat_name === 'Kingfisher');
  ok('your position went with them',
     w1 && w1.rows.latitude !== null && w1.rows.longitude !== null,
     JSON.stringify(w1 && [w1.rows.latitude, w1.rows.longitude]));
  ok('the form cleared itself ready for the next',
     (await p.inputValue('#fBoat')) === '');
  ok('and it is listed as added from this phone',
     /Kingfisher/.test(await p.textContent('#recent')));

  console.log('\nThe full set of details');
  await p.fill('#fFirst','Gavin'); await p.fill('#fLast','Rafferty');
  await p.fill('#fBoat','Nellie'); await p.fill('#fPhone','07700 900321');
  await p.fill('#fWhere','Hatton flight'); await p.fill('#fNotes','Heading north, two spaniels');
  await p.evaluate(() => { window.__writes = []; });
  await p.click('#save');
  await p.waitForTimeout(700);
  const w2 = await p.evaluate(() => window.__writes.find(x =>
     x.op==='insert' && x.table==='contacts'));
  ok('names, boat, where and notes all went in',
     w2 && w2.rows.first_name==='Gavin' && w2.rows.last_name==='Rafferty'
     && w2.rows.boat_name==='Nellie' && w2.rows.met_where==='Hatton flight'
     && /spaniels/.test(w2.rows.notes), JSON.stringify(w2 && w2.rows));
  ok('the phone number went in as a proper phone entry',
     w2 && Array.isArray(w2.rows.phones) && w2.rows.phones[0].value==='07700 900321',
     JSON.stringify(w2 && w2.rows.phones));
  ok('it recorded the date you met', !!(w2 && w2.rows.met_date));

  console.log('\nWith no signal it keeps it on the phone');
  await p.evaluate(() => {
    window.__offline = true;
    Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});
    window.__realFrom = sb.from.bind(sb);
    sb.from = (t) => t==='contacts'
      ? { insert:()=>({ select:()=>({ single:()=>
            Promise.reject(new Error('Failed to fetch')) }) }) }
      : window.__realFrom(t);
  });
  await p.fill('#fFirst','Heidi'); await p.fill('#fBoat','Jolly Roger');
  await p.click('#save');
  await p.waitForTimeout(800);
  ok('it says it has kept it',
     /kept on the phone/i.test((await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' | ')).catch(()=>''))),
     (await p.$$eval('.toast',e=>e.map(x=>x.textContent).join(' | ')).catch(()=>'(none)')));
  const q = await p.evaluate(() => JSON.parse(localStorage.getItem('jot-waiting')||'[]'));
  ok('it is in the queue', q.length === 1, JSON.stringify(q.map(x=>x.first_name)));
  ok('with everything it needs to go later',
     q[0] && q[0].first_name==='Heidi' && q[0].boat_name==='Jolly Roger');
  ok('the strip tells you how many are waiting',
     /1[\s\S]{0,40}waiting to be sent/.test(await p.textContent('#status')),
     (await p.textContent('#status')).replace(/\s+/g,' ').slice(0,120));

  console.log('\nAnd sends it when the signal comes back');
  await p.evaluate(() => {
    Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true});
    sb.from = window.__realFrom;
    window.__writes = [];
  });
  await p.click('#retry');
  await p.waitForTimeout(900);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('jot-waiting')||'[]'));
  ok('the queue is empty again', after.length === 0, JSON.stringify(after));
  const sent = await p.evaluate(() => window.__writes.find(x =>
     x.op==='insert' && x.table==='contacts'));
  ok('Heidi went up', sent && sent.rows.first_name==='Heidi',
     JSON.stringify(sent && sent.rows));
  ok('the waiting strip has gone',
     !/waiting to be sent/.test(await p.textContent('#status')));

  console.log('\nLooking somebody up');
  await p.click('#tabFind');
  await p.waitForTimeout(300);
  ok('the finder opens', await p.isVisible('#q'));
  ok('the form is out of the way', !(await p.isVisible('#fFirst')));
  await p.fill('#q','dick');
  await p.waitForTimeout(700);
  const hits = await p.textContent('#hits');
  ok('it finds somebody', /Dickie/.test(hits), hits.replace(/\s+/g,' ').slice(0,140));
  ok('there is a way straight into the full app',
     /index\.html#contact=/.test(await p.innerHTML('#hits')));

  console.log('\nIt is installable in its own right');
  const man = await p.evaluate(() =>
    document.querySelector('link[rel=manifest]').getAttribute('href'));
  ok('it points at its own manifest', man === 'manifest.json', man);
  ok('and its own icon', await p.evaluate(() =>
    document.querySelector('link[rel=apple-touch-icon]').getAttribute('href')
      === 'apple-touch-icon.png'));

  console.log('\nChanging your mind about one');
  p.on('dialog', d => d.accept());
  await p.click('#tabAdd');          // the list of what this phone put in lives here
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    // One that went up, one still waiting on the phone.
    localStorage.setItem('jot-recent', JSON.stringify([
      {name:'Nell Gwynn', boat:'Orange', at:Date.now(), waiting:false, cid:901, qid:null},
      {name:'Tom Waiting', boat:'Later',  at:Date.now(), waiting:true,  cid:null, qid:'q-1'}
    ]));
    localStorage.setItem('jot-waiting', JSON.stringify([
      {id:'q-1', first_name:'Tom', last_name:'Waiting'}
    ]));
    paintRecent(); paintStatus();
  });
  await p.waitForTimeout(300);
  ok('each entry offers a way out', (await p.$$('[data-drop]')).length === 2);
  ok('and says what tapping it does',
     /out of the contacts book/.test(await p.textContent('#recent')));

  await p.evaluate(() => { window.__writes = []; });
  await p.click('[data-drop="0"]');
  await p.waitForTimeout(500);
  const gone = await p.evaluate(() => ({
    writes: window.__writes.slice(),
    recent: JSON.parse(localStorage.getItem('jot-recent') || '[]')
  }));
  ok('one that went up is taken out of the book',
     gone.writes.some(x => x.table === 'contacts' && x.op === 'delete'),
     JSON.stringify(gone.writes));
  ok('and off this phone\'s list', gone.recent.length === 1, JSON.stringify(gone.recent));
  ok('the other one is untouched', gone.recent[0].name === 'Tom Waiting');

  await p.evaluate(() => { window.__writes = []; });
  await p.click('[data-drop="0"]');
  await p.waitForTimeout(500);
  const waited = await p.evaluate(() => ({
    writes: window.__writes.slice(),
    recent: JSON.parse(localStorage.getItem('jot-recent') || '[]'),
    queue: JSON.parse(localStorage.getItem('jot-waiting') || '[]')
  }));
  ok('one still waiting needs nothing of the book',
     !waited.writes.some(x => x.table === 'contacts'), JSON.stringify(waited.writes));
  ok('it comes off the queue, so it never goes up', waited.queue.length === 0,
     JSON.stringify(waited.queue));
  ok('and the list is empty again', waited.recent.length === 0);

  console.log('\nIt fits a phone');
  for (const wdt of [320, 390, 414]) {
    await p.setViewportSize({ width:wdt, height:844 });
    await p.waitForTimeout(200);
    const over = await p.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1);
    ok('nothing spills off the side at ' + wdt + 'px', !over);
  }

  await p.setViewportSize({ width:390, height:844 });
  await p.click('#tabAdd'); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname,'jot.png') });
  await b.close();

  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0,10).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
