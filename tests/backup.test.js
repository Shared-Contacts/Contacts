// The monthly backup card on Import and export. It is the only copy of
// everything there is, so the card had better work.
const { chromium } = require('playwright');
const path = require('path');

const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 },
    permissions:['clipboard-read','clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  // ---------------------------------------------------------------
  console.log('\nOnly Barry gets the card');
  const who = await page.evaluate(() => {
    const was = MY_PROFILE.display_name, mail = ME.email;
    const out = {};
    MY_PROFILE.display_name = 'Barry'; ME.email = 'barry@example.com';
    out.barry = isBarry();
    MY_PROFILE.display_name = 'barry teutenberg'; out.lower = isBarry();
    MY_PROFILE.display_name = 'Sandra'; ME.email = 'sandra@example.com';
    out.sandra = isBarry();
    MY_PROFILE.display_name = ''; ME.email = 'barry.teutenberg@gmail.com';
    out.byEmail = isBarry();
    MY_PROFILE.display_name = ''; ME.email = '';
    out.nobody = isBarry();
    MY_PROFILE.display_name = was; ME.email = mail;
    return out;
  });
  ok('by name', who.barry === true);
  ok('whatever the capitals', who.lower === true);
  ok('by the email when the name is not set', who.byEmail === true);
  ok('somebody else does not get it', who.sandra === false);
  ok('and neither does a profile with nothing in it', who.nobody === false);

  const hidden = await page.evaluate(async () => {
    MY_PROFILE.display_name = 'Sandra'; ME.email = 'sandra@example.com';
    openIO();
    await new Promise(r => setTimeout(r, 200));
    return { card: /Full backup/.test($('ioBody').textContent),
             buttons: document.querySelectorAll('#bkCopy1').length };
  });
  ok('the card is not on the screen for her', hidden.card === false);
  ok('nor are its buttons', hidden.buttons === 0);

  // ---------------------------------------------------------------
  console.log('\nFor Barry, the card and its four buttons');
  await page.evaluate(async () => {
    MY_PROFILE.display_name = 'Barry'; ME.email = 'barry.teutenberg@gmail.com';
    openIO();
    await new Promise(r => setTimeout(r, 200));
  });
  await page.waitForTimeout(300);
  const body = await page.textContent('#ioBody');
  ok('the card is there', /Full backup \(Barry only\)/.test(body));
  ok('it sits under Save a copy',
     body.indexOf('Save a copy') < body.indexOf('Full backup'));
  ok('it says why it matters', /no automatic backups/.test(body));
  ok('the steps are there', /New query/.test(body) && /Download CSV/.test(body));
  ok('with the file names to save as', /1-everything-\d{4}-\d{2}\.csv/.test(body)
     && /2-daily-log-\d{4}-\d{2}\.csv/.test(body), body.slice(0, 200));
  ok('and the warning about a zero row count',
     /contacts/.test(body) && /shows 0/.test(body));
  for (const id of ['bkCopy1', 'bkCopy2', 'bkOpen', 'bkDone']) {
    ok(id + ' is on the card', (await page.$$('#' + id)).length === 1);
  }

  console.log('\nThe buttons are wired to something');
  // They were written and left unconnected once. This is that check.
  ok('every one of them has a handler', await page.evaluate(() =>
    ['bkCopy1','bkCopy2','bkOpen','bkDone'].every(id => typeof $(id).onclick === 'function')));

  // ---------------------------------------------------------------
  console.log('\nCopying the queries');
  await page.click('#bkCopy1');
  await page.waitForTimeout(400);
  const one = await page.evaluate(() => navigator.clipboard.readText());
  ok('query 1 reaches the clipboard', /QUERY 1/.test(one), one.slice(0, 60));
  // 36 union alls = 37 selects = the 37 rows it returned when it was run
  // in Supabase. One row per table, so a missing table shows up here.
  ok('all 37 tables are in it', one.split('union all').length - 1 === 36,
     String(one.split('union all').length - 1) + ' union alls');
  ok('it ends at the photographs',
     /bucket_id = 'photos';$/.test(one.trim()), one.trim().slice(-50));
  ok('and the cashbook is in it', /transactions/.test(one) && /bank_files/.test(one));
  ok('the table that no longer exists is not', !/group_members/.test(one));

  await page.click('#bkCopy2');
  await page.waitForTimeout(400);
  const two = await page.evaluate(() => navigator.clipboard.readText());
  ok('query 2 reaches the clipboard', /QUERY 2/.test(two));
  ok('it is the daily log, on its own',
     /from log_days t;$/.test(two.trim()) && !/union all/.test(two), two.slice(-60));

  // ---------------------------------------------------------------
  console.log('\nOpening Supabase');
  const url = await page.evaluate(() => SQL_EDITOR);
  ok('the address is built from the project, not typed in',
     url === 'https://supabase.com/dashboard/project/uloptfmzydaxymhecuub/sql/new',
     url);
  ok('and it opens a new tab, safely', await page.evaluate(() => {
    let got = null;
    const real = window.open;
    window.open = (u, t, f) => { got = [u, t, f]; return null; };
    $('bkOpen').click();
    window.open = real;
    return got && got[0] === SQL_EDITOR && got[1] === '_blank'
        && /noopener/.test(got[2] || '');
  }));

  // ---------------------------------------------------------------
  console.log('\nWhen it was last done');
  const never = await page.evaluate(() => { BACKUP_DONE = ''; return backupWords(); });
  ok('never done says so, in red', never.words === 'Never backed up'
     && never.cls === 'late');

  const states = await page.evaluate(() => {
    const day = n => { const d = new Date(); d.setDate(d.getDate() - n);
      return d.toISOString().slice(0,10); };
    const at = n => { BACKUP_DONE = day(n); return backupWords(); };
    const out = { today: at(0), week: at(7), edge: at(35), over: at(36),
                  year: at(400) };
    BACKUP_DONE = '';
    return out;
  });
  ok('done today says today', /today/.test(states.today.words)
     && states.today.cls === 'ok', states.today.words);
  ok('a week ago is fine', states.week.cls === 'ok'
     && /7 days ago/.test(states.week.words), states.week.words);
  ok('thirty-five days is still fine, so a month is never nagged about',
     states.edge.cls === 'ok', states.edge.words);
  ok('thirty-six is overdue', states.over.cls === 'late', states.over.words);
  ok('and a year is plainly overdue', states.year.cls === 'late');
  ok('it names the date as well as the days', /\d+ \w+ \d{4}/.test(states.week.words),
     states.week.words);

  const done = await page.evaluate(async () => {
    BACKUP_DONE = '';
    openIO();
    await new Promise(r => setTimeout(r, 200));
    window.__writes.length = 0;
    $('bkDone').click();
    await new Promise(r => setTimeout(r, 500));
    const w = window.__writes.filter(x => x.table === 'profiles').pop();
    return { stamped: BACKUP_DONE, saved: w && w.patch.home_tiles,
             shown: $('ioBody').textContent };
  });
  ok('recording it stamps today', done.stamped === new Date().toISOString().slice(0,10),
     done.stamped);
  ok('and keeps it with the rest of the home screen settings',
     done.saved && done.saved.backup === done.stamped, JSON.stringify(done.saved));
  ok('the card says so straight away', /Backed up today/.test(done.shown));

  // The class it wore before only had colours inside an account row, so the
  // line was never actually green or red.
  const colours = await page.evaluate(async () => {
    const seen = {};
    for (const [key, days] of [['ok', 2], ['late', 90]]) {
      const d = new Date(); d.setDate(d.getDate() - days);
      BACKUP_DONE = d.toISOString().slice(0,10);
      openIO();
      await new Promise(r => setTimeout(r, 150));
      const el = document.querySelector('.bkwhen');
      seen[key] = el ? getComputedStyle(el).color : 'no element';
    }
    BACKUP_DONE = '';
    return seen;
  });
  ok('a recent backup really is green on the screen',
     colours.ok === 'rgb(29, 74, 58)', colours.ok);
  // Whatever red the chosen colour scheme uses, not one written in by hand.
  const themeRed = await page.evaluate(() => {
    const el = document.createElement('span');
    el.style.color = 'var(--red)';
    document.body.appendChild(el);
    const c = getComputedStyle(el).color; el.remove(); return c;
  });
  ok('and an overdue one really is red', colours.late === themeRed,
     colours.late + ' vs ' + themeRed);
  ok('the tiles are not lost when it saves',
     done.saved && Array.isArray(done.saved.tiles) && done.saved.tiles.length > 0);

  ok('it comes back after a reload', await page.evaluate(() => {
    MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[], backup:'2026-09-01' };
    loadTiles();
    return BACKUP_DONE === '2026-09-01';
  }));
  ok('and an old profile with no backup recorded is simply never',
     await page.evaluate(() => {
       MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[] };
       loadTiles();
       return BACKUP_DONE === '';
     }));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
