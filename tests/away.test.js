// The month calendar's away colours, its Today button and + on a picked day,
// and the Today screen's greeting, birthday dates and today-first appointments.
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
  const page = await browser.newPage({ viewport:{ width:360, height:640 } });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  page.on('dialog', d => d.dismiss());
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  // ---------------------------------------------------------------
  console.log('\nThe greeting');
  const hello = await page.evaluate(() => ({
    morning: briefHello(new Date(2026,9,15,8,30)),
    noon:    briefHello(new Date(2026,9,15,12,0)),
    evening: briefHello(new Date(2026,9,15,18,5)),
    small:   briefHello(new Date(2026,9,1,0,7)),
    nths: [1,2,3,4,11,12,13,21,22,23,31].map(nthDay).join(' ')
  }));
  ok('Thursday morning reads as asked',
     hello.morning === "Good morning, it's Thursday 15th of October, 8:30 AM", hello.morning);
  ok('midday is the afternoon', hello.noon === "Good afternoon, it's Thursday 15th of October, 12:00 PM", hello.noon);
  ok('six o\'clock is the evening', /^Good evening.*6:05 PM$/.test(hello.evening), hello.evening);
  ok('just after midnight is 12:07 AM', /1st of October, 12:07 AM$/.test(hello.small), hello.small);
  ok('the day numbers end properly',
     hello.nths === '1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 31st', hello.nths);

  // ---------------------------------------------------------------
  console.log('\nThe Today screen');
  await page.evaluate(async () => {
    const at = (n, h) => { const x = new Date(); x.setDate(x.getDate() + n);
      x.setHours(h || 10, 0, 0, 0); return x.toISOString(); };
    const born = n => { const x = new Date(); x.setDate(x.getDate() + n);
      return '1960' + x.toISOString().slice(4,10); };
    window.__rows.contacts = [
      {id:1, created_by:'me', first_name:'Saturday', last_name:'Person',
       birth_date:born(2), contact_groups:[]}];
    window.__rows.items = [
      {id:1, created_by:'me', kind:'appointment', title:'Haircut today', starts_at:at(0,23)},
      {id:2, created_by:'me', kind:'appointment', title:'Dentist later', starts_at:at(3)},
      {id:3, created_by:'me', kind:'todo', title:'Long overdue', due_at:at(-20)},
      {id:4, created_by:'me', kind:'todo', title:'Bins later', due_at:at(5)}];
    await loadAll();
    openBrief();
  });
  await page.waitForTimeout(300);
  let body = await page.textContent('#briefBody');
  ok('the birthday heading is the one asked for', /Your Birthday Reminders for this Week/.test(body));
  const when = await page.textContent('[data-briefc] .bwhen');
  ok('the date sits under the day', /\d+(st|nd|rd|th) [A-Z][a-z]{2}/.test(when), when);
  ok('today\'s appointment is shown', /Haircut today/.test(body), body.slice(0,400));
  ok('and anything overdue, without a tap', /Long overdue/.test(body));
  ok('the rest of the week waits', !/Dentist later/.test(body) && !/Bins later/.test(body));
  const btn = await page.textContent('#briefWeek');
  ok('a button says how many more there are', /whole week \(2 more\)/.test(btn), btn);
  await page.click('#briefWeek');
  await page.waitForTimeout(200);
  body = await page.textContent('#briefBody');
  ok('tapping it shows the whole week', /Dentist later/.test(body) && /Bins later/.test(body));
  ok('and it can go back to just today', /Just show today/.test(await page.textContent('#briefWeek')));
  await page.evaluate(() => { shutBrief(); openBrief(); });
  ok('opening it again starts with just today',
     !/Dentist later/.test(await page.textContent('#briefBody')));
  await page.evaluate(() => shutBrief());

  // ---------------------------------------------------------------
  console.log('\nAway colours on the month calendar');
  await page.evaluate(async () => {
    const t = new Date();
    const day = n => { const x = new Date(t.getFullYear(), t.getMonth(), 1 + n, 9);
      return x.toISOString(); };
    window.__rows.items = [
      {id:10, created_by:'me', kind:'appointment', title:'Spain', away:'holiday',
       all_day:true, starts_at:day(2), ends_at:day(15)},
      {id:11, created_by:'me', kind:'appointment', title:'Ward', away:'hospital',
       starts_at:day(14), ends_at:day(16)},
      {id:12, created_by:'me', kind:'appointment', title:'Dentist', starts_at:day(20)}];
    await loadAll();
    openDiary(); DIARY_VIEW = 'month'; DIARY_DAY = null;
    DIARY_MONTH = dayKeyOf(t).slice(0,7);
    renderDiary();
  });
  await page.waitForTimeout(200);
  const cal = await page.evaluate(() => {
    const t = new Date();
    const k = n => dayKeyOf(new Date(t.getFullYear(), t.getMonth(), n));
    const st = n => document.querySelector(`[data-day="${k(n)}"]`).getAttribute('style') || '';
    return { first: st(1), holiday: st(5), both: st(15), ordinary: st(21),
             key: (document.querySelector('.awaykey') || {}).textContent || '' };
  });
  ok('a day before the trip is plain', cal.first === '', cal.first);
  ok('a holiday day is shaded in the holiday colour', /#F4D35E/i.test(cal.holiday), cal.holiday);
  ok('a day with two reasons is striped in both',
     /linear-gradient/.test(cal.both) && /#F4D35E/i.test(cal.both) && /#E8A0A0/i.test(cal.both), cal.both);
  ok('an ordinary appointment is not shaded', cal.ordinary === '', cal.ordinary);
  ok('the key names just the reasons in use',
     /Holiday/.test(cal.key) && /Hospital/.test(cal.key) && !/Work/.test(cal.key), cal.key);

  ok('the month bar fits a small phone', await page.evaluate(() => {
    const n = document.querySelector('.mnav');
    return n.scrollWidth <= n.clientWidth + 1 && n.getBoundingClientRect().height < 60;
  }));

  // ---------------------------------------------------------------
  console.log('\nThe Today button');
  const jumped = await page.evaluate(async () => {
    document.querySelector('[data-mshift="1"]').click();
    document.querySelector('[data-mshift="1"]').click();
    await new Promise(r => setTimeout(r, 100));
    const away = DIARY_MONTH;
    $('mToday').click();
    await new Promise(r => setTimeout(r, 100));
    return { away, month: DIARY_MONTH, day: DIARY_DAY, want: dayKeyOf(new Date()),
             picked: !!document.querySelector('.mcell.today.picked') };
  });
  ok('two months on, it is somewhere else', jumped.away !== jumped.want.slice(0,7));
  ok('Today brings back this month', jumped.month === jumped.want.slice(0,7), JSON.stringify(jumped));
  ok('with today picked', jumped.day === jumped.want && jumped.picked);

  // ---------------------------------------------------------------
  console.log('\n+ on a picked day');
  const preset = await page.evaluate(async () => {
    const t = new Date();
    const k = dayKeyOf(new Date(t.getFullYear(), t.getMonth() + 1, 9));
    DIARY_MONTH = k.slice(0,7); DIARY_DAY = k; renderDiary();
    $('diaryAdd').click();
    await new Promise(r => setTimeout(r, 200));
    const f = $('itForm');
    const out = { want: k, starts: f.elements['starts_at'].value,
                  due: f.elements['due_at'].value };
    $('itemEd').classList.add('hidden'); lockBackground();
    DIARY_VIEW = 'list'; renderDiary();
    $('diaryAdd').click();
    await new Promise(r => setTimeout(r, 200));
    out.listDue = $('itForm').elements['due_at'].value;
    $('itemEd').classList.add('hidden'); lockBackground();
    return out;
  });
  ok('the appointment starts on the picked day', preset.starts.startsWith(preset.want), JSON.stringify(preset));
  ok('and a to-do is due that day', preset.due.startsWith(preset.want));
  ok('from the list it still starts from now, not an old picked day',
     !preset.listDue.startsWith(preset.want), preset.listDue);

  // ---------------------------------------------------------------
  console.log('\nSetting it on an appointment');
  const form = await page.evaluate(async () => {
    openItem(ITEMS.find(x => x.id === 10));
    await new Promise(r => setTimeout(r, 150));
    const shown = $('itForm').elements['away'].value;
    $('itemEd').classList.add('hidden'); lockBackground();

    window.__writes.length = 0;
    openItem(null);
    document.querySelector('[data-kind="appointment"]').click();
    const f = $('itForm');
    f.elements['title'].value = 'Cornwall';
    f.elements['away'].value = 'visiting';
    await saveItem();
    const a = window.__writes.find(x => x.op === 'insert' && x.table === 'items');

    window.__writes.length = 0;
    openItem(null);
    $('itForm').elements['title'].value = 'Ordinary';
    await saveItem();
    const b = window.__writes.find(x => x.op === 'insert' && x.table === 'items');
    const row = r => r && (Array.isArray(r.rows) ? r.rows[0] : r.rows);
    return { shown, away: row(a) && row(a).away, plain: row(b) ? ('away' in row(b)) : 'none' };
  });
  ok('editing a holiday shows Holiday', form.shown === 'holiday', form.shown);
  ok('a new away appointment saves its reason', form.away === 'visiting', String(form.away));
  ok('an ordinary entry does not send it at all, so it saves before step 38',
     form.plain === false, String(form.plain));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
