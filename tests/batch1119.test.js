// 19 Nov 2026 (version 2026.11.19.1):
//   ML305  Diary: a Completed button on appointments and a Done button on
//          to-dos, beside +1 hr, +8 hr and +1 day. A completed appointment
//          stays on the Week and Month calendars, ticked; a done to-do comes
//          off them. Birthdays stay.
// Pretend people and entries only; nothing goes online.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ServiceWorker|signed\.test|font|Failed to fetch|ERR_INTERNET_DISCONNECTED/i;

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
  const updates = () => ev(() => window.__writes.filter(w => w.op === 'update' && w.table === 'items'));
  const clearWrites = () => ev(() => { window.__writes.length = 0; window.__said = [];
    if (!window.__toastKept) { window.__toastKept = toast; toast = s => { window.__said.push(s); window.__toastKept(s); }; } });
  const said = () => ev(() => window.__said.join(' | '));
  // The stub only notes a write, so put the last one into the pretend table
  // and load again, as the real database would.
  const applyLast = id => ev(async id => {
    const w = window.__writes.filter(x => x.op === 'update' && x.table === 'items').pop();
    Object.assign(window.__rows.items.find(x => x.id === id), w.patch);
    await loadAll(); renderDiary(); }, id);
  const show = (view, dayKey) => ev(([v, k]) => { DIARY_VIEW = v; DIARY_DONE = false;
    if (k) { DIARY_MONTH = k.slice(0, 7); DIARY_DAY = k; } renderDiary(); }, [view, dayKey]);
  const rowOf = id => ev(id => {
    const t = document.querySelector(`#diaryBody [data-done="${id}"]`); if (!t) return null;
    const r = t.closest('.item');
    return { on: t.classList.contains('on'), text: r.innerText.replace(/\s+/g, ' '),
      btns: [...r.querySelectorAll('.pickrow.dly button')].map(x => x.textContent.trim()) }; }, id);

  // Next month, so nothing in it is overdue.
  const mk = await ev(() => { const t = new Date(); return dayKeyOf(new Date(t.getFullYear(), t.getMonth() + 1, 1)).slice(0, 7); });
  const day = n => mk + '-' + String(n).padStart(2, '0');
  const soon = await ev(() => { const t = new Date(); return dayKeyOf(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2)); });
  await ev(async ([k10, k11, soon]) => {
    const at = (k, h) => new Date(k + 'T' + h).toISOString();
    window.__rows.items.push(
      { id: 951, kind: 'appointment', title: 'Dentist', created_by: 'me', starts_at: at(k10, '10:00'),
        ends_at: at(k10, '10:30'), repeat_every: 'none', remind_mins: 60, updated_at: '2026-01-01' },
      { id: 952, kind: 'todo', title: 'Ring the garage', created_by: 'me', due_at: at(k10, '12:00'),
        repeat_every: 'none', updated_at: '2026-01-01' },
      { id: 953, kind: 'appointment', title: 'Choir', created_by: 'me', starts_at: at(k11, '19:00'),
        ends_at: at(k11, '21:00'), repeat_every: 'weekly', updated_at: '2026-01-01' },
      { id: 954, kind: 'todo', title: 'Paint the shed', created_by: 'me', repeat_every: 'none', updated_at: '2026-01-01' },
      { id: 955, kind: 'appointment', title: 'Optician', created_by: 'me', starts_at: at(soon, '09:00'),
        ends_at: at(soon, '09:30'), repeat_every: 'none', updated_at: '2026-01-01' },
      { id: 956, kind: 'appointment', title: 'Physio', created_by: 'me', starts_at: at(k11, '15:00'),
        ends_at: at(k11, '15:30'), repeat_every: 'none', status: 'missed', updated_at: '2026-01-01' },
      { id: 957, kind: 'appointment', title: 'Old haircut', created_by: 'me', starts_at: at(k11, '09:00'),
        ends_at: at(k11, '09:30'), repeat_every: 'none', done_at: at(k11, '10:00'), updated_at: '2026-01-01' });
    window.__rows.contacts.push({ id: 771, created_by: 'me', first_name: 'Mary', last_name: 'Smith',
      birth_date: '1956-' + k10.slice(5, 7) + '-10', contact_groups: [] });
    await loadAll();
  }, [day(10), day(11), soon]);
  await ev(() => openDiary()); await settle(400);

  console.log('\nThe buttons');
  await show('month', day(10));
  let r = await rowOf(951);
  ok('an appointment has Completed after +1 hr, +8 hr and +1 day', r && r.btns.join() === '+1 hr,+8 hr,+1 day,Completed', JSON.stringify(r));
  r = await rowOf(952);
  ok('a to-do with a date has Done', r && r.btns.join() === '+1 hr,+8 hr,+1 day,Done', JSON.stringify(r));
  await show('list');
  r = await rowOf(954);
  ok('so does a to-do with no date, in the List', r && r.btns.join() === '+1 hr,+8 hr,+1 day,Done', JSON.stringify(r));
  const look = await ev(() => { const x = document.querySelector('#diaryBody [data-fin]'), s = getComputedStyle(x);
    return { c: s.color, w: s.fontWeight, cls: x.className }; });
  ok('it stands out in green', look.c === 'rgb(46, 125, 79)' && Number(look.w) >= 700, JSON.stringify(look));

  console.log('\nCompleted on an appointment');
  await show('month', day(10));
  await clearWrites();
  await p.click('[data-fin="951"]'); await settle(400);
  let ups = await updates();
  ok('one tap saves it as Completed and ticked off', ups.length === 1 && ups[0].patch.status === 'done' && !!ups[0].patch.done_at,
    JSON.stringify(ups));
  ok('and says it stays on the calendar', /Completed\. It stays on the calendar/.test(await said()), await said());
  ok('the reminder is left alone, so unticking brings it back', !('remind_at' in ups[0].patch));
  await applyLast(951); await show('month', day(10));
  r = await rowOf(951);
  ok('it stays on the day, ticked', r && r.on, JSON.stringify(r));
  ok('marked Completed, with no buttons now', r && /Completed/.test(r.text) && r.btns.length === 0, JSON.stringify(r));
  ok('the day keeps its appointment dot', await ev(k => !!document.querySelector(`[data-day="${k}"] .dots i.a`), day(10)));
  ok('and its birthday', await ev(() => /Mary Smith/.test($('diaryBody').innerText)));

  console.log('\nDone on a to-do');
  await clearWrites();
  await p.click('[data-fin="952"]'); await settle(400);
  ups = await updates();
  ok('one tap ticks it off, with no status', ups.length === 1 && !!ups[0].patch.done_at && !('status' in ups[0].patch), JSON.stringify(ups));
  ok('and says where it went', /Done\. It is under Finished in the List/.test(await said()), await said());
  await applyLast(952); await show('month', day(10));
  ok('it comes off the day', !(await rowOf(952)));
  ok('the day loses its to-do dot', await ev(k => !document.querySelector(`[data-day="${k}"] .dots i.t`), day(10)));
  ok('the completed appointment and the birthday are still there', !!(await rowOf(951))
    && await ev(() => /Mary Smith/.test($('diaryBody').innerText)));

  console.log('\nThe other views');
  await clearWrites();
  await show('week');
  await p.click('[data-fin="955"]'); await settle(400);
  await applyLast(955); await show('week');
  r = await rowOf(955);
  ok('the Week keeps a completed appointment, ticked', r && r.on && /Completed/.test(r.text), JSON.stringify(r));
  await show('list');
  ok('the List, To come, has neither', !(await rowOf(951)) && !(await rowOf(952)) && !(await rowOf(955)));
  await ev(() => { DIARY_DONE = true; renderDiary(); });
  ok('Finished has both', !!(await rowOf(951)) && !!(await rowOf(952)));
  await ev(() => { DIARY_DONE = false; DIARY_VIEW = 'days'; DAYS_FROM = null; renderDiary(); });
  const days = await ev(k => { DAYS_FROM = k; DAYS_TO = k; DAYS_OPEN.add(k); renderDiary();
    const d = document.querySelector(`[data-dkey="${k}"]`);
    return { t: d.innerText.replace(/\s+/g, ' '), ticked: d.querySelectorAll('.dfull .done, .dfull .tick.on').length }; }, day(10));
  ok('Days, opened out, still shows both and the birthday, as before', /Dentist/.test(days.t) && /Ring the garage/.test(days.t)
    && /Mary Smith/.test(days.t) && days.ticked >= 2, JSON.stringify(days));
  await ev(() => { daysReset(); });

  console.log('\nThe circle');
  await show('month', day(10));
  await clearWrites();
  await ev(() => toggleDone(951)); await settle(300);
  ups = await updates();
  ok('unticking a completed one makes it Booked again', ups.length === 1 && ups[0].patch.done_at === null && ups[0].patch.status === null,
    JSON.stringify(ups));
  await applyLast(951); await show('month', day(10));
  r = await rowOf(951);
  ok('with its buttons back', r && !r.on && r.btns.join() === '+1 hr,+8 hr,+1 day,Completed', JSON.stringify(r));
  await clearWrites();
  await p.click('[data-done="951"]'); await settle(400);
  ups = await updates();
  ok('ticking an appointment with the circle makes it Completed too', ups.length === 1 && ups[0].patch.status === 'done'
    && !!ups[0].patch.done_at, JSON.stringify(ups));
  await clearWrites();
  await ev(() => toggleDone(956)); await settle(300);
  ups = await updates();
  ok('a Missed one ticked off stays Missed', ups.length === 1 && !!ups[0].patch.done_at && !('status' in ups[0].patch), JSON.stringify(ups));
  await show('month', day(11));
  r = await rowOf(957);
  ok('one ticked before today shows on its day as Completed', r && r.on && /Completed/.test(r.text), JSON.stringify(r));

  console.log('\nA repeating appointment');
  await clearWrites();
  await p.click('[data-fin="953"]'); await settle(400);
  ups = await updates();
  const moved = ups.length === 1 && ups[0].patch.starts_at
    && (new Date(ups[0].patch.starts_at) - new Date(day(11) + 'T19:00')) === 7 * 864e5;
  ok('Completed rolls it on a week, as the circle does', moved && !('done_at' in ups[0].patch), JSON.stringify(ups));
  ok('and says when the next one is', /Completed — the next one is/.test(await said()), await said());

  console.log('\nTwo quick taps');
  await ev(async () => { Object.assign(window.__rows.items.find(x => x.id === 951), { done_at: null, status: null }); await loadAll(); });
  await show('month', day(10));
  await clearWrites();
  await ev(() => { const x = document.querySelector('[data-fin="951"]'); x.click(); x.click(); });
  await settle(400);
  ups = await updates();
  ok('save once, and never untick it', ups.length === 1 && ups[0].patch.status === 'done', JSON.stringify(ups));
  await ev(async () => { Object.assign(window.__rows.items.find(x => x.id === 951), { done_at: null, status: null }); await loadAll(); });

  console.log('\nOn a phone');
  for (const w of [320, 360, 390, 412]) {
    await p.setViewportSize({ width: w, height: 800 }); await settle(150);
    await show('month', day(10));
    const f = await ev(() => {
      const row = document.querySelector('[data-fin="951"]').closest('.item'), rr = row.getBoundingClientRect();
      const bs = [...row.querySelectorAll('.pickrow.dly button')].map(x => x.getBoundingClientRect());
      return { inside: bs.every(x => x.left >= rr.left - 0.5 && x.right <= rr.right + 0.5),
        lines: new Set(bs.map(x => Math.round(x.top))).size, scroll: document.documentElement.scrollWidth - innerWidth,
        word: document.querySelector('[data-fin="951"]').getBoundingClientRect().height }; });
    ok(`${w} wide: the four buttons fit the row, nothing scrolls sideways`, f.inside && f.scroll <= 0, JSON.stringify(f));
    ok(`${w} wide: Completed is on one line`, f.word < 40, JSON.stringify(f));
    if (w >= 390) ok(`${w} wide: all four on one line`, f.lines === 1, JSON.stringify(f));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(150);

  console.log('\nHelp and the version');
  const help = await ev(() => { openHelp(); const t = $('helpBody').textContent.replace(/\s+/g, ' ');
    document.querySelectorAll('.sheet:not(#diary)').forEach(s => s.classList.add('hidden')); return t; });
  ok('Help says what Completed and Done do', /an appointment has Completed and a to-do has Done/.test(help)
    && /completed appointment stays on the Week and Month calendars/.test(help) && /Birthdays always stay/.test(help));
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  const appVer = await ev(() => APP_VERSION), V = vj.history.find(h => h.version === '2026.11.19.1');
  ok('2026.11.19.1 is in version.json, and the page is the newest', !!V && V.changes.length === 2
    && vj.version === appVer && vj.history[0].version === appVer, appVer + ' / ' + vj.version);

  ok('no page errors', errors.length === 0, errors.join(' / '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
