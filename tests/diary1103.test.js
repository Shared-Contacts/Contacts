// Diary, 3 Nov 2026 (ML167 to ML172): appointment or to-do asked first, an
// appointment on a picked day at 8:00 for half an hour with the end following
// the start, no dot for an away appointment, birthdays on the month, a status
// on appointments (step 54), and the month's name choosing a month.
const { chromium } = require('playwright');
const path = require('path');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  const writes = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op === op && (!table || w.table === table)), [op, table]);
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  const closeAll = () => ev(() => { document.querySelectorAll('.sheet:not(#diary)').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.daypick').forEach(d => d.remove()); });
  // Next month, so nothing in it is overdue and the days are all to come.
  const mk = await ev(() => { const t = new Date(); return dayKeyOf(new Date(t.getFullYear(), t.getMonth() + 1, 1)).slice(0, 7); });
  const day = n => mk + '-' + String(n).padStart(2, '0');

  console.log('\nAppointment or to-do, first');
  await ev(() => openDiary()); await settle(400);
  await ev(() => { DIARY_VIEW = 'list'; renderDiary(); });
  await p.click('#diaryAdd'); await settle(200);
  ok('+ asks which it is before the form', await ev(() => !!$('itKinds')
    && $('itemEd').classList.contains('hidden')));
  ok('two big buttons, Appointment and To-do', await ev(() =>
    [...document.querySelectorAll('[data-newkind]')].map(x => x.dataset.newkind).join()) === 'appointment,todo');
  await p.click('[data-newkind="appointment"]'); await settle(200);
  ok('Appointment opens an appointment', await ev(() => !$('itKinds') && ITEM_KIND === 'appointment'
    && /New appointment/.test($('itTitle').textContent) && $('fsWhenAppt').style.display === ''));
  ok('the switch is still on the form', await ev(() => document.querySelectorAll('#itBody [data-kind]').length === 2));
  await closeAll();
  await p.click('#diaryAdd'); await settle(200);
  await p.click('[data-newkind="todo"]'); await settle(200);
  ok('To-do opens a to-do', await ev(() => ITEM_KIND === 'todo' && /New to-do/.test($('itTitle').textContent)));
  await closeAll();
  await p.click('#diaryAdd'); await settle(200);
  await p.click('#itKindNo'); await settle(150);
  ok('Cancel opens nothing', await ev(() => !$('itKinds') && $('itemEd').classList.contains('hidden')));
  ok('the menu and a contact page ask first too', await ev(() =>
    /newItem\(\)/.test(areaItems('diary').find(x => x.label === 'Add an entry').fn.toString())
    && /newItem\(c\.id\)/.test(openDetail.toString())));
  await closeAll();

  console.log('\nThe times');
  const t1 = await ev(async k => {
    DIARY_VIEW = 'month'; DIARY_MONTH = k.slice(0, 7); DIARY_DAY = k; renderDiary();
    $('diaryAdd').click(); document.querySelector('[data-newkind="appointment"]').click();
    await new Promise(r => setTimeout(r, 150));
    const f = $('itForm');
    return { s: f.elements.starts_at.value, e: f.elements.ends_at.value,
      btn: f.querySelectorAll('.whenbtn')[1].textContent };
  }, day(9));
  ok('a picked day starts at 8:00', t1.s === day(9) + 'T08:00', JSON.stringify(t1));
  ok('and ends at 8:30', t1.e === day(9) + 'T08:30', JSON.stringify(t1));
  ok('the end button says so', /08:30/.test(t1.btn), t1.btn);
  const t2 = await ev(() => { const f = $('itForm'), s = f.elements.starts_at;
    s.value = s.value.slice(0, 11) + '14:15'; s.dispatchEvent(new Event('input', { bubbles: true }));
    return { e: f.elements.ends_at.value, btn: f.querySelectorAll('.whenbtn')[1].textContent }; });
  ok('a new start moves the end to half an hour after it', t2.e === day(9) + 'T14:45', JSON.stringify(t2));
  ok('and the end button follows', /14:45/.test(t2.btn), t2.btn);
  const t3 = await ev(() => { const f = $('itForm'), s = f.elements.starts_at, e = f.elements.ends_at;
    e.value = e.value.slice(0, 11) + '17:00'; e.dispatchEvent(new Event('input', { bubbles: true }));
    s.value = s.value.slice(0, 11) + '15:00'; s.dispatchEvent(new Event('input', { bubbles: true }));
    return e.value; });
  ok('an end set by hand is left alone', t3 === day(9) + 'T17:00', t3);
  await closeAll();
  const t4 = await ev(async () => {
    DIARY_VIEW = 'list'; renderDiary();
    $('diaryAdd').click(); document.querySelector('[data-newkind="appointment"]').click();
    await new Promise(r => setTimeout(r, 150));
    const f = $('itForm'); return { s: f.elements.starts_at.value, e: f.elements.ends_at.value }; });
  const gap = (new Date(t4.e) - new Date(t4.s)) / 60000;
  ok('no day picked: the next whole hour, half an hour long', /T\d\d:00$/.test(t4.s) && gap === 30
    && new Date(t4.s) > new Date(), JSON.stringify(t4));
  await closeAll();
  const t5 = await ev(async k => {
    window.__rows.items.push({ id: 901, kind: 'appointment', title: 'Dentist', created_by: 'me',
      starts_at: new Date(k + 'T10:00').toISOString(), ends_at: new Date(k + 'T11:30').toISOString(),
      repeat_every: 'none', updated_at: '2026-01-01' });
    await loadAll(); openItem(ITEMS.find(x => x.id === 901));
    const f = $('itForm'), s = f.elements.starts_at;
    s.value = s.value.slice(0, 11) + '13:00'; s.dispatchEvent(new Event('input', { bubbles: true }));
    return f.elements.ends_at.value; }, day(12));
  ok('changing one already booked keeps its length', t5 === day(12) + 'T14:30', t5);
  await closeAll();

  console.log('\nAway appointments on the month');
  const cells2 = await ev(async m => {
    const k = n => m + '-' + String(n).padStart(2, '0');
    window.__rows.items.push(
      { id: 902, kind: 'appointment', title: 'Holiday', created_by: 'me', away: 'holiday',
        starts_at: new Date(k(3) + 'T09:00').toISOString(), ends_at: new Date(k(5) + 'T17:00').toISOString(),
        repeat_every: 'none', updated_at: '2026-01-01' },
      { id: 903, kind: 'appointment', title: 'Optician', created_by: 'me',
        starts_at: new Date(k(4) + 'T11:00').toISOString(), ends_at: new Date(k(4) + 'T11:30').toISOString(),
        repeat_every: 'none', updated_at: '2026-01-01' });
    await loadAll(); DIARY_VIEW = 'month'; DIARY_MONTH = m; DIARY_DAY = null; renderDiary();
    const c = n => document.querySelector(`[data-day="${k(n)}"]`);
    return { shade3: c(3).getAttribute('style') || '', dot3: !!c(3).querySelector('i.a'),
      shade4: c(4).getAttribute('style') || '', dot4: !!c(4).querySelector('i.a') };
  }, mk);
  ok('a holiday keeps its colour', /#F4D35E/i.test(cells2.shade3), JSON.stringify(cells2));
  ok('but has no appointment dot', !cells2.dot3, JSON.stringify(cells2));
  ok('an ordinary appointment on a holiday day still has its dot', cells2.dot4 && /#F4D35E/i.test(cells2.shade4), JSON.stringify(cells2));

  console.log('\nBirthdays on the month');
  const bd = await ev(async m => {
    const mo = m.slice(5, 7);
    CONTACTS.push({ id: 701, first_name: 'Mary', last_name: 'Smith', birth_date: `1956-${mo}-17`, contact_groups: [] },
      { id: 702, first_name: 'Old', last_name: 'Friend', birth_date: `1930-${mo}-17`, death_date: '2020-01-01', contact_groups: [] },
      { id: 703, first_name: 'Leap', last_name: 'Year', birth_date: '1996-02-29', contact_groups: [] });
    DIARY_MONTH = m; DIARY_DAY = null; renderDiary();
    const k = n => m + '-' + String(n).padStart(2, '0');
    const cake = n => !!document.querySelector(`[data-day="${k(n)}"] .bd`);
    const key = document.querySelector('#diaryBody .coords').textContent;
    DIARY_DAY = k(17); renderDiary();
    const list = $('diaryBody').innerText.replace(/\s+/g, ' ');
    const feb = monthBirthdays(2027, 2), febLeap = monthBirthdays(2028, 2);
    return { c17: cake(17), c16: cake(16), key, list, age: Number(m.slice(0, 4)) - 1956,
      feb: Object.keys(feb).join(), febLeap: Object.keys(febLeap).join() };
  }, mk);
  ok('a cake on the day of a birthday', bd.c17 && !bd.c16, JSON.stringify(bd).slice(0, 200));
  ok('and in the key', /birthday/.test(bd.key), bd.key);
  ok('the day lists who, and the age they turn', new RegExp(`Mary Smith Birthday · ${bd.age}`).test(bd.list), bd.list.slice(0, 300));
  ok('people who have died are left out', !/Old Friend/.test(bd.list));
  ok('a 29 February birthday shows on the 28th in other years', bd.feb === '28' && bd.febLeap === '29', bd.feb + ' / ' + bd.febLeap);
  await p.click('[data-bdc="701"]'); await settle(300);
  ok('tapping one opens the contact', await ev(() => !$('detail').classList.contains('hidden') && CURRENT && CURRENT.id === 701));
  await closeAll();

  console.log('\nStatus on an appointment');
  await clearWrites();
  const past = await ev(() => new Date(Date.now() - 3 * 864e5).toISOString());
  await ev(async past => {
    window.__rows.items.push({ id: 904, kind: 'appointment', title: 'Physio', created_by: 'me', starts_at: past,
      ends_at: past, repeat_every: 'none', remind_mins: 60, updated_at: '2026-01-01' });
    await loadAll(); }, past);
  ok('an appointment gone by shows overdue', await ev(() => isLate(ITEMS.find(x => x.id === 904))));
  await ev(() => openItem(ITEMS.find(x => x.id === 904))); await settle(150);
  ok('the form has Status: Booked, then the five', await ev(() =>
    [...$('itForm').elements.status.options].map(o => o.text).join() === 'Booked,Completed,Missed,Delayed,On hold,Cancelled'));
  ok('a to-do does not show it', await ev(() => { ITEM_KIND = 'todo';
    document.querySelector('#itBody [data-kind="todo"]').click();
    const hidden = $('fsWhenAppt').style.display === 'none';
    document.querySelector('#itBody [data-kind="appointment"]').click(); return hidden; }));
  await ev(() => { $('itForm').elements.status.value = 'missed'; });
  await p.click('#itSave'); await settle(500);
  let up = (await writes('update', 'items')).pop();
  ok('Missed is saved', up && up.patch.status === 'missed', JSON.stringify(up && up.patch));
  ok('and its reminder will not go', up && up.patch.remind_at === null);
  ok('but it is not ticked off', up && !('done_at' in up.patch) || (up && up.patch.done_at == null));
  await ev(async () => { Object.assign(window.__rows.items.find(x => x.id === 904), { status: 'missed' }); await loadAll(); });
  ok('a status stops it being overdue', await ev(() => !isLate(ITEMS.find(x => x.id === 904))));
  const row = await ev(() => { const d = document.createElement('div'); d.innerHTML = itemRow(ITEMS.find(x => x.id === 904));
    const s = d.querySelector('.ststat'); return s ? s.textContent + '|' + d.querySelector('.w').className : ''; });
  ok('the row says Missed, and is not red', /^Missed\|/.test(row) && !/late/.test(row), row);
  await closeAll();
  await clearWrites();
  await ev(() => openItem(ITEMS.find(x => x.id === 904))); await settle(150);
  ok('the form opens showing it', await ev(() => $('itForm').elements.status.value === 'missed'));
  await ev(() => { $('itForm').elements.status.value = 'done'; });
  await p.click('#itSave'); await settle(500);
  up = (await writes('update', 'items')).pop();
  ok('Completed ticks it off too', up && up.patch.status === 'done' && !!up.patch.done_at, JSON.stringify(up && up.patch));
  await ev(async () => { Object.assign(window.__rows.items.find(x => x.id === 904), { status: 'done', done_at: new Date().toISOString() }); await loadAll(); });
  await clearWrites();
  await ev(() => toggleDone(904)); await settle(300);
  up = (await writes('update', 'items')).pop();
  ok('unticking a Completed one makes it Booked again', up && up.patch.done_at === null && up.patch.status === null, JSON.stringify(up && up.patch));
  await ev(async () => { Object.assign(window.__rows.items.find(x => x.id === 904), { status: 'done', done_at: new Date().toISOString() }); await loadAll(); });
  await clearWrites();
  await ev(() => openItem(ITEMS.find(x => x.id === 904))); await settle(150);
  await ev(() => { $('itForm').elements.status.value = ''; });
  await p.click('#itSave'); await settle(500);
  up = (await writes('update', 'items')).pop();
  ok('back to Booked from the form unticks it and its reminder comes back', up && up.patch.status === null
    && up.patch.done_at === null && up.patch.remind_at !== null, JSON.stringify(up && up.patch));
  await closeAll();
  await clearWrites();
  await ev(() => { openItem(null, null, null, 'appointment'); $('itForm').elements.title.value = 'New one'; });
  await p.click('#itSave'); await settle(500);
  const ins = (await writes('insert', 'items')).pop();
  ok('a Booked one sends no status, so it saves before step 54', ins && !('status' in ins.rows), JSON.stringify(ins && ins.rows).slice(0, 160));
  await closeAll();
  const before54 = await ev(async () => {
    const real = sb.from, e0 = console.error; console.error = () => {};
    sb.from = t => t === 'items' ? { update: () => ({ eq: () => ({ eq: () => ({ select: () =>
      Promise.resolve({ data: null, error: { message: 'Could not find the \'status\' column of \'items\' in the schema cache' } }) }) }) }) } : real(t);
    openItem(ITEMS.find(x => x.id === 904)); $('itForm').elements.status.value = 'cancelled';
    window.__said = []; await saveItem(); sb.from = real; console.error = e0; return window.__said.join(' | ');
  });
  ok('before step 54 it says so', /status needs step 54/.test(before54), before54);
  await closeAll();

  console.log('\nThe month name chooses a month');
  await ev(m => { DIARY_VIEW = 'month'; DIARY_MONTH = m; DIARY_DAY = null; renderDiary(); }, mk);
  ok('the month name is a button', await ev(() => !!$('mPick') && /▾/.test($('mPick').textContent)));
  ok('the month bar still fits a small phone', await ev(() => {
    const n = document.querySelector('.mnav'); return n.scrollWidth <= n.clientWidth + 1 && n.getBoundingClientRect().height < 60; }));
  await p.click('#mPick'); await settle(150);
  const yr = Number(mk.slice(0, 4));
  ok('it shows the twelve months of that year', await ev(() => document.querySelectorAll('[data-mpk]').length === 12
    && document.querySelector('#mPickBox .pnav span').textContent) === String(yr));
  ok('the month showing is picked out, and this month is marked', await ev(m => {
    const on = document.querySelector('[data-mpk][aria-pressed="true"]');
    const now = dayKeyOf(new Date()).slice(0, 7), t = document.querySelector(`[data-mpk="${now}"]`);
    return on && on.dataset.mpk === m && (!t || t.classList.contains('mpicktoday')); }, mk));
  await p.click('[data-myr="1"]'); await settle(100);
  await p.click('[data-myr="1"]'); await settle(100);
  ok('the arrows go a year at a time, as far as you like', await ev(() =>
    document.querySelector('#mPickBox .pnav span').textContent) === String(yr + 2));
  await p.click(`[data-mpk="${yr + 2}-06"]`); await settle(200);
  ok('a month goes back to the calendar on that month', await ev(want => !$('mPickBox') && DIARY_MONTH === want
    && /June/.test($('mPick').textContent) && !!document.querySelector('.mgrid'), `${yr + 2}-06`));
  await p.click('#mPick'); await settle(100);
  await p.click('#mPickNo'); await settle(100);
  ok('Cancel leaves the month as it was', await ev(want => !$('mPickBox') && DIARY_MONTH === want, `${yr + 2}-06`));

  console.log('\nHelp');
  ok('says about all of it', await ev(() => { openHelp('diary');
    const h = document.getElementById('h-diary').parentElement.innerHTML; $('help').classList.add('hidden');
    return /first choose <em>Appointment<\/em>/.test(h) && /8:00 that day/.test(h) && /<strong>Status\.<\/strong>/.test(h)
      && /shades the days\s+instead of a dot/.test(h) && /marks a birthday/.test(h) && /month's name to choose/.test(h); }));

  console.log('\nErrors');
  ok('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
