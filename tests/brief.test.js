// Today: what the day has in it, once a day.
const { chromium } = require('playwright');
const path = require('path');

const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  // ---------------------------------------------------------------
  console.log('\nThe day turns over at four in the morning');
  const days = await page.evaluate(() => {
    const at = s => briefDay(new Date(s).getTime());
    return {
      lateNight: at('2026-03-10T01:30:00'),
      justBefore: at('2026-03-10T03:59:00'),
      justAfter: at('2026-03-10T04:01:00'),
      teatime:   at('2026-03-10T17:00:00'),
      midnight:  at('2026-03-10T23:59:00')
    };
  });
  ok('half past one still belongs to the day before',
     days.lateNight === '2026-03-09', days.lateNight);
  ok('and so does one minute to four', days.justBefore === '2026-03-09');
  ok('a minute past four starts the new day', days.justAfter === '2026-03-10');
  ok('teatime is that same day', days.teatime === '2026-03-10');
  ok('and so is just before midnight', days.midnight === '2026-03-10');

  // ---------------------------------------------------------------
  console.log('\nBirthdays, yesterday to a week ahead');
  const seeded = await page.evaluate(async () => {
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n);
      return x.toISOString().slice(0,10); };
    const born = (n, year) => { const iso = d(n);
      return year + iso.slice(4); };
    window.__rows.contacts = [
      {id:1, created_by:'me', first_name:'Yesterday', last_name:'Jones',
       birth_date:born(-1,'1960'), contact_groups:[]},
      {id:2, created_by:'me', first_name:'Today', last_name:'Smith',
       birth_date:born(0,'1950'), contact_groups:[]},
      {id:3, created_by:'me', first_name:'Week', last_name:'Away',
       birth_date:born(7,'1970'), contact_groups:[]},
      {id:4, created_by:'me', first_name:'Too', last_name:'Far',
       birth_date:born(9,'1970'), contact_groups:[]},
      {id:5, created_by:'me', first_name:'Two', last_name:'Back',
       birth_date:born(-2,'1970'), contact_groups:[]},
      {id:6, created_by:'me', first_name:'Sadly', last_name:'Gone',
       birth_date:born(1,'1930'), death_date:'2020-01-01', contact_groups:[]},
      {id:7, created_by:'me', first_name:'No', last_name:'Birthday',
       contact_groups:[]}
    ];
    await loadAll();
    return briefBirthdays().map(x => ({ name: x.c.first_name, d: x.d }));
  });
  ok('yesterday is there', seeded.some(x => x.name === 'Yesterday' && x.d === -1),
     JSON.stringify(seeded));
  ok('today is there', seeded.some(x => x.name === 'Today' && x.d === 0));
  ok('a week away is there', seeded.some(x => x.name === 'Week' && x.d === 7));
  ok('eight days away is not', !seeded.some(x => x.name === 'Too'));
  ok('two days ago is not', !seeded.some(x => x.name === 'Two'));
  ok('somebody who has died is left in peace',
     !seeded.some(x => x.name === 'Sadly'));
  ok('and somebody with no birthday recorded is not invented',
     !seeded.some(x => x.name === 'No'));
  ok('they are in order, yesterday first',
     JSON.stringify(seeded.map(x => x.d)) === '[-1,0,7]', JSON.stringify(seeded));

  console.log('\nEven across the turn of the year');
  const newYear = await page.evaluate(() => ({
    hogmanay: bdayOffset({birth_date:'1960-01-01'}, new Date(2026,11,30).getTime()),
    backwards: bdayOffset({birth_date:'1960-12-31'}, new Date(2027,0,1).getTime()),
    away: bdayOffset({birth_date:'1960-06-01'}, new Date(2026,11,30).getTime())
  }));
  ok('a new year birthday is seen from December', newYear.hogmanay === 2,
     String(newYear.hogmanay));
  ok('and a December one from January', newYear.backwards === -1,
     String(newYear.backwards));
  ok('while one in June is not', newYear.away === null, String(newYear.away));

  // ---------------------------------------------------------------
  console.log('\nAppointments, to-dos and the ASAP list');
  const lists = await page.evaluate(async () => {
    const at = (n, h) => { const x = new Date(); x.setDate(x.getDate() + n);
      x.setHours(h || 10, 0, 0, 0); return x.toISOString(); };
    window.__rows.items = [
      {id:1, created_by:'me', kind:'appointment', title:'Dentist', starts_at:at(1)},
      {id:2, created_by:'me', kind:'todo', title:'Pay the licence', due_at:at(3)},
      {id:3, created_by:'me', kind:'todo', title:'Long overdue', due_at:at(-20)},
      {id:4, created_by:'me', kind:'todo', title:'Next month', due_at:at(40)},
      {id:5, created_by:'me', kind:'todo', title:'Already done', due_at:at(2),
       done_at:'2026-01-01T00:00:00Z'},
      {id:6, created_by:'me', kind:'todo', title:'No date at all'}
    ];
    window.__rows.routines = [
      {id:1, title:'Tax return 2025-26', heading:'ASAP', done:false, sort_order:1},
      {id:2, title:'Followup £35 HMRC', heading:'ASAP', done:false, sort_order:2},
      {id:3, title:'Done already', heading:'ASAP', done:true, sort_order:3},
      {id:4, title:'Paint the roof', heading:'Boat', done:false, sort_order:1}
    ];
    await loadAll();
    return { items: briefItems().map(x => x.title), asap: briefAsap().map(x => x.title) };
  });
  ok('the week ahead is there',
     lists.items.includes('Dentist') && lists.items.includes('Pay the licence'),
     JSON.stringify(lists.items));
  ok('something long overdue still gets said', lists.items.includes('Long overdue'));
  ok('next month does not', !lists.items.includes('Next month'));
  ok('nor does one already done', !lists.items.includes('Already done'));
  ok('nor one with no date', !lists.items.includes('No date at all'));
  ok('the overdue one leads, being the oldest', lists.items[0] === 'Long overdue',
     JSON.stringify(lists.items));
  ok('the ASAP list is just the ASAP ones',
     JSON.stringify(lists.asap) === '["Tax return 2025-26","Followup £35 HMRC"]',
     JSON.stringify(lists.asap));
  ok('with the done one left out and another heading left alone',
     !lists.asap.includes('Done already') && !lists.asap.includes('Paint the roof'));

  // ---------------------------------------------------------------
  console.log('\nOn the screen');
  await page.evaluate(() => openBrief());
  await page.waitForTimeout(400);
  ok('it opens', await page.isVisible('#brief'));
  const body = await page.textContent('#briefBody');
  ok('the three headings are there',
     /Your Birthday Reminders for this Week/.test(body) && /appointments/.test(body)
     && /ASAP/.test(body), body.slice(0,300));
  ok('a birthday says whose and when', /Yesterday Jones/.test(body));
  ok('and the age they are turning', /Turns \d+|Turned \d+/.test(body), body.slice(0,300));
  ok('an overdue job is marked', /overdue/.test(body));
  ok('the bar says simply Today',
     (await page.textContent('#briefTitle')).trim() === 'Today');
  ok('and a greeting with the day, date and time is underneath',
     /^Good (morning|afternoon|evening), it's \w+day \d+(st|nd|rd|th) of \w+, \d{1,2}:\d\d (AM|PM)$/
       .test(await page.textContent('.briefdate')),
     await page.textContent('.briefdate'));
  ok('it says it only comes once a day', /once a day/.test(body));

  ok('tapping a birthday opens that person', await page.evaluate(async () => {
    document.querySelector('[data-briefc]').click();
    await new Promise(r => setTimeout(r, 400));
    const out = !$('detail').classList.contains('hidden')
             && $('brief').classList.contains('hidden');
    $('detail').classList.add('hidden'); lockBackground();
    return out;
  }));

  // ---------------------------------------------------------------
  console.log('\nOnce a day, and no more');
  const once = await page.evaluate(async () => {
    localStorage.removeItem('briefday');
    BRIEF_ON = true;
    $('brief').classList.add('hidden'); lockBackground();
    maybeBrief();
    await new Promise(r => setTimeout(r, 200));
    const first = !$('brief').classList.contains('hidden');
    const stamped = localStorage.getItem('briefday');
    shutBrief();
    maybeBrief();
    await new Promise(r => setTimeout(r, 200));
    const second = !$('brief').classList.contains('hidden');
    return { first, second, stamped };
  });
  ok('it comes up the first time', once.first);
  ok('the day is written down', once.stamped === await page.evaluate(() => briefDay()));
  ok('and it does not come up again', once.second === false);

  const next = await page.evaluate(async () => {
    localStorage.setItem('briefday', '2020-01-01');   // as if a new day had come
    maybeBrief();
    await new Promise(r => setTimeout(r, 200));
    const up = !$('brief').classList.contains('hidden');
    shutBrief();
    return up;
  });
  ok('a new day brings it back', next);

  const busy = await page.evaluate(async () => {
    localStorage.setItem('briefday', '2020-01-01');
    showSheet('money');                     // in the middle of something
    maybeBrief();
    await new Promise(r => setTimeout(r, 200));
    const up = !$('brief').classList.contains('hidden');
    $('money').classList.add('hidden'); lockBackground();
    return up;
  });
  ok('but never on top of something you are doing', busy === false);

  const off = await page.evaluate(async () => {
    localStorage.setItem('briefday', '2020-01-01');
    BRIEF_ON = false;
    maybeBrief();
    await new Promise(r => setTimeout(r, 200));
    const up = !$('brief').classList.contains('hidden');
    BRIEF_ON = true;
    return up;
  });
  ok('and not at all when it is turned off', off === false);

  console.log('\nThe switch is in Settings');
  await page.evaluate(async () => {
    $('brief').classList.add('hidden');
    openSettings('Home screen');
    await new Promise(r => setTimeout(r, 400));
    document.querySelectorAll('.card.logsec').forEach(d => d.open = true);
  });
  await page.waitForTimeout(400);
  ok('there is a switch for it', (await page.$$('#briefOn')).length === 1);
  ok('on to begin with', await page.isChecked('#briefOn'));
  const saved = await page.evaluate(async () => {
    window.__writes.length = 0;
    const b = document.querySelector('#briefOn');
    b.checked = false; b.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 400));
    const w = window.__writes.filter(x => x.table === 'profiles').pop();
    return { on: BRIEF_ON, blob: w && w.patch.home_tiles };
  });
  ok('turning it off takes', saved.on === false);
  ok('and is kept with the rest of the home screen',
     saved.blob && saved.blob.brief === false, JSON.stringify(saved.blob));
  ok('and comes back off', await page.evaluate(() => {
    MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[], brief:false };
    loadTiles();
    return BRIEF_ON === false;
  }));
  ok('while somebody who has never touched it still gets it',
     await page.evaluate(() => {
       MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[] };
       loadTiles();
       return BRIEF_ON === true;
     }));

  // ---------------------------------------------------------------
  console.log('\nA load that comes back empty is not a book that emptied');
  const scare = await page.evaluate(async () => {
    localStorage.setItem('seen-contacts', '240');    // plenty, a moment ago
    window.__rows.contacts = [];
    await loadAll();
    await new Promise(r => setTimeout(r, 200));
    return { up: !$('loadBar').classList.contains('hidden'),
             words: $('loadBarText').textContent };
  });
  ok('it says so rather than drawing an empty list', scare.up);
  ok('and says nothing has been deleted', /nothing has been deleted/i.test(scare.words),
     scare.words);
  ok('with a way to try again', (await page.$$('#loadBarGo')).length === 1);

  const back = await page.evaluate(async () => {
    window.__rows.contacts = [{id:1, created_by:'me', first_name:'Back',
      last_name:'Again', contact_groups:[]}];
    await loadAll();
    await new Promise(r => setTimeout(r, 200));
    return { up: !$('loadBar').classList.contains('hidden'),
             known: localStorage.getItem('seen-contacts') };
  });
  ok('and it goes away when they come back', back.up === false);
  ok('the count is kept for next time', back.known === '1', back.known);

  const fresh = await page.evaluate(async () => {
    localStorage.removeItem('seen-contacts');
    window.__rows.contacts = [];
    await loadAll();
    await new Promise(r => setTimeout(r, 200));
    return !$('loadBar').classList.contains('hidden');
  });
  ok('somebody whose book really is empty is not alarmed', fresh === false);

  const broken = await page.evaluate(async () => {
    const real = sb.from;
    sb.from = table => table === 'contacts'
      ? { select: () => Promise.resolve({ data:null, error:{ message:'no signal' } }) }
      : real(table);
    await loadAll();
    sb.from = real;
    await new Promise(r => setTimeout(r, 200));
    const out = { up: !$('loadBar').classList.contains('hidden'),
                  words: $('loadBarText').textContent };
    return out;
  });
  ok('a fetch that fails outright says so too', broken.up, JSON.stringify(broken));
  ok('and says where the data really lives', /on the server/i.test(broken.words),
     broken.words);

  console.log('\nAnd it can be called up to look at');
  const again = await page.evaluate(async () => {
    window.__rows.contacts = [{id:1, created_by:'me', first_name:'Back',
      last_name:'Again', contact_groups:[]}];
    await loadAll();
    $('loadBar').classList.add('hidden');
    shutBrief();
    openSettings('Home screen');
    await new Promise(r => setTimeout(r, 400));
    document.querySelectorAll('.card.logsec').forEach(d => d.open = true);
    const b = document.querySelector('#briefAgain');
    if (!b) return { there:false };
    b.click();
    await new Promise(r => setTimeout(r, 300));
    return { there:true, up: !$('brief').classList.contains('hidden') };
  });
  ok('there is a button for it in Settings', again.there);
  ok('and it brings it straight up', again.up);

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
