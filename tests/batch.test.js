// Swiping the Daily Log, typing a date, grouped accounts, the wording,
// the panel that starts open, and the background behind the tiles.
const { chromium } = require('playwright');
const path = require('path');

const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

// A one-finger swipe, as a thumb would make it.
const swipe = (page, sel, from, to) => page.evaluate(({sel, from, to}) => {
  const el = document.querySelector(sel);
  const mk = (type, x, y) => {
    const t = new Touch({ identifier:1, target:el, clientX:x, clientY:y });
    el.dispatchEvent(new TouchEvent(type, { touches: type==='touchend'?[]:[t],
      changedTouches:[t], bubbles:true, cancelable:true }));
  };
  mk('touchstart', from[0], from[1]);
  mk('touchmove', (from[0]+to[0])/2, (from[1]+to[1])/2);
  mk('touchmove', to[0], to[1]);
  mk('touchend', to[0], to[1]);
}, {sel, from, to});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport:{ width:390, height:844 },
    hasTouch:true });
  page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  // ---------------------------------------------------------------
  console.log('\nThe wording');
  ok('the refresh button says what it fetches', await page.evaluate(() =>
    [...document.querySelectorAll('[data-barref]')]
      .every(b => b.title === 'Refresh Data and Images')));
  ok('every bar has one', await page.evaluate(() =>
    document.querySelectorAll('[data-barref]').length >= 9));
  ok('and so does the menu', await page.evaluate(async () => {
    openMenu('home');
    await new Promise(r => setTimeout(r, 200));
    const b = document.querySelector('[data-mref]');
    const words = b.textContent.trim();
    shutMenu();
    return words === 'Refresh Data and Images';
  }));
  ok('Colours is a Colour Scheme now', await page.evaluate(() =>
    [...document.querySelectorAll('#menu summary')]
      .some(s => s.textContent.trim() === 'Colour Scheme')));

  console.log('\nReconciled, not agreed');
  const words = await page.evaluate(() => {
    const day = n => new Date(Date.now() - n*86400000).toISOString().slice(0,10);
    const keep = STATEMENTS.slice();
    STATEMENTS = [{account_id:1, ends_on:day(5)}];
    const good = reconState(1);
    STATEMENTS = [];
    const none = reconState(1);
    STATEMENTS = keep;
    return { good: good.words, none: none.words };
  });
  ok('it says reconciled to a date', /^reconciled to /.test(words.good), words.good);
  ok('and says so plainly when it never has been',
     /not reconciled yet/.test(words.none), words.none);

  // ---------------------------------------------------------------
  console.log('\nThe regular jobs panel starts open');
  await page.evaluate(() => { openDiary(); DIARY_VIEW='routine'; renderDiary(); });
  await page.waitForTimeout(600);
  ok('open without being asked', await page.evaluate(() => {
    const d = [...document.querySelectorAll('#diaryBody details, details')]
      .find(x => /Add a regular job/.test(x.querySelector('summary')?.textContent || ''));
    return !!d && d.open;
  }));

  // ---------------------------------------------------------------
  console.log('\nTyping a date, in whatever way comes naturally');
  const parsed = await page.evaluate(() => {
    const y = new Date().getFullYear();
    return {
      slashes:  readTypedDate('4/7/19'),
      full:     readTypedDate('04/07/2019'),
      dashes:   readTypedDate('4-7-2019'),
      dots:     readTypedDate('4.7.2019'),
      iso:      readTypedDate('2019-07-04'),
      noYear:   readTypedDate('4/7'),
      words:    readTypedDate('4 Jul 2019'),
      longWord: readTypedDate('4 July 2019'),
      monthFirst: readTypedDate('Jul 4 2019'),
      spaces:   readTypedDate('  4 jul 19  '),
      today:    readTypedDate('today'),
      thisYear: y,
      rubbish:  readTypedDate('next tuesday'),
      impossible: readTypedDate('31/2/2019'),
      empty:    readTypedDate('')
    };
  });
  ok('4/7/19 is the fourth of July, not the seventh of April',
     parsed.slashes === '2019-07-04', parsed.slashes);
  ok('04/07/2019 as well', parsed.full === '2019-07-04');
  ok('dashes work', parsed.dashes === '2019-07-04');
  ok('dots work', parsed.dots === '2019-07-04');
  ok('and the way a computer writes it', parsed.iso === '2019-07-04');
  ok('no year means this year', parsed.noYear === parsed.thisYear + '-07-04', parsed.noYear);
  ok('4 Jul 2019', parsed.words === '2019-07-04');
  ok('4 July 2019', parsed.longWord === '2019-07-04');
  ok('Jul 4 2019', parsed.monthFirst === '2019-07-04');
  ok('untidy spacing and lower case', parsed.spaces === '2019-07-04', parsed.spaces);
  ok('and the word today', parsed.today === new Date().toISOString().slice(0,10));
  ok('something that is not a date is refused', parsed.rubbish === null);
  ok('and so is a day that never happened', parsed.impossible === null);
  ok('an empty box asks for nothing', parsed.empty === null);

  console.log('\nIn the picker itself');
  await page.evaluate(async () => { $('diary').classList.add('hidden'); await openLog(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => openDayPick());
  await page.waitForTimeout(300);
  ok('there is a box to type in', (await page.$$('#pickGo')).length === 1);
  ok('it does not open a second calendar',
     (await page.getAttribute('#pickGo', 'type')) === null);
  ok('it says how to write it',
     /dd\/mm\/yyyy/.test(await page.getAttribute('#pickGo', 'placeholder')),
     await page.getAttribute('#pickGo', 'placeholder'));
  ok('with a Go button', (await page.$$('#pickGoBtn')).length === 1);
  ok('and Today still there', (await page.$$('#pickToday')).length === 1);

  const typed = await page.evaluate(async () => {
    const i = document.querySelector('#pickGo');
    i.value = '4/7/19';
    document.querySelector('#pickGoBtn').click();
    await new Promise(r => setTimeout(r, 300));
    return { date: LOG_DATE, shut: document.querySelectorAll('.daypick').length === 0 };
  });
  ok('typing one goes straight there', typed.date === '2019-07-04', typed.date);
  ok('and the picker closes', typed.shut);

  const bad = await page.evaluate(async () => {
    openDayPick();
    await new Promise(r => setTimeout(r, 200));
    const before = LOG_DATE;
    document.querySelector('#pickGo').value = 'sometime last summer';
    document.querySelector('#pickGoBtn').click();
    await new Promise(r => setTimeout(r, 200));
    const out = { same: LOG_DATE === before,
                  open: document.querySelectorAll('.daypick').length === 1 };
    document.querySelectorAll('.daypick').forEach(x => x.remove());
    return out;
  });
  ok('nonsense leaves the day alone', bad.same);
  ok('and the picker open to try again', bad.open);

  // ---------------------------------------------------------------
  console.log('\nSwiping from day to day');
  await page.evaluate(() => { LOG_DATE = '2026-03-10'; renderLog(); });
  await page.waitForTimeout(400);
  await swipe(page, '#logBody', [300, 400], [80, 405]);
  await page.waitForTimeout(300);
  ok('a swipe to the left goes forward a day',
     await page.evaluate(() => LOG_DATE) === '2026-03-11',
     await page.evaluate(() => LOG_DATE));
  await swipe(page, '#logBody', [80, 400], [320, 410]);
  await page.waitForTimeout(300);
  ok('and back the other way',
     await page.evaluate(() => LOG_DATE) === '2026-03-10',
     await page.evaluate(() => LOG_DATE));

  await swipe(page, '#logBody', [200, 600], [215, 180]);
  await page.waitForTimeout(300);
  ok('scrolling up the page does not flick the day over',
     await page.evaluate(() => LOG_DATE) === '2026-03-10');

  await swipe(page, '#logBody', [200, 400], [160, 405]);
  await page.waitForTimeout(300);
  ok('nor does a small movement', await page.evaluate(() => LOG_DATE) === '2026-03-10');

  ok('the arrows are still there', (await page.$$('#logPrev')).length === 1
     && (await page.$$('#logNext')).length === 1);

  // ---------------------------------------------------------------
  console.log('\nAccounts under the bank they belong to');
  const flat = await page.evaluate(async () => {
    $('log').classList.add('hidden');
    await openMoney();
    await new Promise(r => setTimeout(r, 300));
    return document.querySelectorAll('[data-accgrp]').length;
  });
  ok('with nothing grouped, the plain list stays', flat === 0);

  const grouped = await page.evaluate(async () => {
    const rows = window.__rows.accounts;
    rows.find(a => a.name === 'Barclays').group_name = 'Barclays';
    rows.find(a => a.name === 'Amex').group_name = 'American Express';
    rows.find(a => a.name === 'ASB').group_name = 'ASB';
    await loadMoney(); renderMoney();
    await new Promise(r => setTimeout(r, 300));
    return [...document.querySelectorAll('[data-accgrp]')].map(d => ({
      name: d.dataset.accgrp, open: d.open,
      total: d.querySelector('.gtot').textContent.trim(),
      accounts: d.querySelectorAll('.acct').length }));
  });
  ok('one group each', grouped.length === 3, JSON.stringify(grouped));
  ok('named as they were typed',
     grouped.map(g => g.name).join('|') === 'Barclays|American Express|ASB',
     JSON.stringify(grouped.map(g => g.name)));
  ok('each with its own total', grouped[0].total === '£457.50', grouped[0].total);
  // Two currencies share the dollar sign, so the code is shown instead:
  // $53.77 above $0.00 with no way to tell which is which is worse than
  // useless on a page of figures.
  ok('a group in another currency uses that currency',
     grouped[2].total === 'NZD\u00a01,550.00', JSON.stringify(grouped[2].total));
  ok('a symbol two currencies share gives way to the code',
     await page.evaluate(() => moneyTag(12.5,'NZD').replace(/\u00a0/g,' ')
       === 'NZD 12.50'));
  ok('and the dollars are told apart from each other',
     await page.evaluate(() => moneyTag(12.5,'USD').replace(/\u00a0/g,' ')
       === 'USD 12.50'));
  ok('while a symbol of its own is left alone',
     await page.evaluate(() => moneyTag(12.5,'GBP') === '£12.50'));
  ok('a negative keeps its sign in front',
     await page.evaluate(() => moneyTag(-12.5,'NZD').startsWith('\u2212')));
  ok('and they start open', grouped.every(g => g.open));
  ok('Everything is still above them all',
     (await page.$$('[data-acc="all"]')).length === 1);

  console.log('\nAnd it remembers what you folded away');
  const remembered = await page.evaluate(async () => {
    const d = document.querySelector('[data-accgrp="Barclays"]');
    d.open = false;
    d.dispatchEvent(new Event('toggle'));
    await new Promise(r => setTimeout(r, 200));
    const stored = JSON.parse(localStorage.getItem('accopen') || '{}');
    renderMoney();
    await new Promise(r => setTimeout(r, 200));
    return { stored, after: document.querySelector('[data-accgrp="Barclays"]').open,
             others: document.querySelector('[data-accgrp="ASB"]').open };
  });
  ok('closing one is written down', remembered.stored.Barclays === false,
     JSON.stringify(remembered.stored));
  ok('and it comes back closed', remembered.after === false);
  ok('while the others are left open', remembered.others === true);

  ok('tapping the group name folds it rather than choosing an account',
     await page.evaluate(async () => {
       const before = MONEY_ACC;
       document.querySelector('[data-accgrp="ASB"] summary').click();
       await new Promise(r => setTimeout(r, 200));
       return MONEY_ACC === before;
     }));

  ok('a group can be typed against an account in Settings',
     await page.evaluate(async () => {
       openSettings('Finances');
       await new Promise(r => setTimeout(r, 500));
       return document.querySelectorAll('[data-afield$=":group_name"]').length === 3;
     }));

  // ---------------------------------------------------------------
  console.log('\nSomething behind the tiles');
  ok('there are several to choose from', await page.evaluate(() => HOME_BGS.length >= 6));
  ok('plain is one of them', await page.evaluate(() => HOME_BGS[0].id === 'paper'));
  ok('none of them is dark', await page.evaluate(() =>
    HOME_BGS.every(b => {
      const hits = (b.css + b.dot).match(/#[0-9A-Fa-f]{6}/g) || [];
      return hits.every(h => {
        const n = parseInt(h.slice(1), 16);
        const lum = 0.2126*((n>>16)&255) + 0.7152*((n>>8)&255) + 0.0722*(n&255);
        return lum > 200;            // everything stays well up at the light end
      });
    })));
  const bg = await page.evaluate(async () => {
    await chooseHomeBg('water');
    const style = $('home').getAttribute('style') || '';
    const saved = window.__writes.filter(w => w.table === 'profiles').pop();
    return { style, saved: saved && saved.patch.home_tiles };
  });
  ok('choosing one paints the home screen', /background-image/.test(bg.style), bg.style);
  ok('and it is kept with the rest of the home screen',
     bg.saved && bg.saved.bg === 'water', JSON.stringify(bg.saved));
  const back = await page.evaluate(async () => {
    await chooseHomeBg('paper');
    return $('home').getAttribute('style') || '';
  });
  ok('and plain really is plain again', back === '', back);
  ok('it comes back the way you left it', await page.evaluate(() => {
    MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[], bg:'rope' };
    loadTiles();
    return HOME_BG === 'rope' && /background-image/.test($('home').getAttribute('style')||'');
  }));
  ok('and a background that no longer exists falls back to plain',
     await page.evaluate(() => {
       MY_PROFILE.home_tiles = { tiles:[{dest:'contacts'}], hidden:[], bg:'tartan' };
       loadTiles();
       return HOME_BG === 'paper';
     }));

  // ---------------------------------------------------------------
  console.log('\nThe date box types itself');
  await page.evaluate(async () => { openSettings; $('settings').classList.add('hidden');
    $('money').classList.add('hidden'); await openLog(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => openDayPick());
  await page.waitForTimeout(300);
  ok('it asks for the numbers',
     (await page.getAttribute('#pickGo', 'placeholder')) === 'dd/mm/yyyy');
  ok('and brings up the number keypad',
     (await page.getAttribute('#pickGo', 'inputmode')) === 'numeric');
  const masked = await page.evaluate(async () => {
    const i = document.querySelector('#pickGo');
    const type = s => { i.value = s; i.dispatchEvent(new Event('input', {bubbles:true}));
                        return i.value; };
    return { one:type('1'), two:type('10'), three:type('100'), four:type('1007'),
             full:type('10072026'), over:type('100720265555'),
             words:type('4 Jul 19'), pasted:type('10/07/2026') };
  });
  ok('one digit stays as it is', masked.one === '1');
  ok('the slash appears on the third', masked.three === '10/0', masked.three);
  ok('and the second on the fifth', masked.full === '10/07/2026', masked.full);
  ok('it stops at a whole date', masked.over === '10/07/2026', masked.over);
  ok('a date already written out is left alone', masked.pasted === '10/07/2026');
  ok('and so are words, for anyone who would rather', masked.words === '4 Jul 19',
     masked.words);
  ok('what it types is understood', await page.evaluate(() =>
     readTypedDate('10/07/2026') === '2026-07-10'));

  console.log('\nAnd it stays above the keyboard');
  const lifted = await page.evaluate(async () => {
    const box = document.querySelector('.daypick');
    const i = document.querySelector('#pickGo');
    i.dispatchEvent(new Event('focus'));
    const typing = box.classList.contains('typing');
    const align = getComputedStyle(box).alignItems;
    i.dispatchEvent(new Event('blur'));
    const after = box.classList.contains('typing');
    const top = document.querySelector('.daypick .inner').getBoundingClientRect().top;
    document.querySelectorAll('.daypick').forEach(x => x.remove());
    return { typing, align, after, top };
  });
  ok('typing lifts it to the top', lifted.typing && lifted.align === 'flex-start',
     JSON.stringify(lifted));
  ok('and it settles back when you are done', lifted.after === false);

  // ---------------------------------------------------------------
  console.log('\nOne total, and the account you are looking at');
  const totals = await page.evaluate(async () => {
    await openMoney(); renderMoney();
    await new Promise(r => setTimeout(r, 300));
    const row = document.querySelector('[data-acc="all"]');
    const box = row.querySelector('.ab');
    return { lines: [...box.querySelectorAll('span')].map(s => s.textContent.trim()),
             column: getComputedStyle(box).flexDirection,
             sub: row.querySelector('.an span').textContent.trim() };
  });
  // Barclays 457.50 less Amex 212.40. The dollars are totalled in their own
  // group, because adding them in would be a lie.
  // One figure per currency, one under another, biggest first.
  ok('every currency gets a line of its own',
     totals.lines.length === 2, JSON.stringify(totals.lines));
  ok('the pounds are there', totals.lines.includes('£245.10'),
     JSON.stringify(totals.lines));
  ok('and the dollars, unadded to them',
     totals.lines.some(x => /1,550\.00/.test(x)), JSON.stringify(totals.lines));
  // In the order the currencies are kept in under Settings, so the lines stay
  // put instead of reshuffling every time money moves.
  ok('sterling leads, as it does in the currency list',
     /£/.test(totals.lines[0]), JSON.stringify(totals.lines));
  ok('they are stacked, not strung along one line', totals.column === 'column');

  const chosen = await page.evaluate(async () => {
    const btn = document.querySelector('[data-acc="3"]');   // ASB, in its own group
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    const open = {};
    document.querySelectorAll('[data-accgrp]').forEach(d => open[d.dataset.accgrp] = d.open);
    const on = document.querySelector('.acct.on');
    return { open, picked: MONEY_ACC,
             marked: !!on && on.dataset.acc === '3',
             shadow: on ? getComputedStyle(on).boxShadow : '' };
  });
  ok('choosing one opens the group it is in', chosen.open.ASB === true,
     JSON.stringify(chosen.open));
  ok('and folds the others away',
     chosen.open.Barclays === false && chosen.open['American Express'] === false,
     JSON.stringify(chosen.open));
  ok('the one being looked at is marked', chosen.marked);
  ok('with a stripe you can see', /inset/.test(chosen.shadow), chosen.shadow);

  // ---------------------------------------------------------------
  console.log('\nFinances opens where you left it');
  const kept = await page.evaluate(() => localStorage.getItem('moneyacc'));
  ok('the account you chose is written down', kept === '3', kept);

  const reopened = await page.evaluate(async () => {
    // As though the app had been shut and started again.
    MONEY_ACC = 'all';
    const kept = localStorage.getItem('moneyacc');
    MONEY_ACC = kept === 'all' ? 'all' : Number(kept);
    await openMoney();
    await new Promise(r => setTimeout(r, 400));
    const open = {};
    document.querySelectorAll('[data-accgrp]').forEach(d => open[d.dataset.accgrp] = d.open);
    const on = document.querySelector('.acct.on');
    return { picked: MONEY_ACC, open,
             marked: !!on && on.dataset.acc === '3',
             heading: document.querySelector('#moneyBody .dsec').textContent.trim() };
  });
  ok('it opens on that account', reopened.picked === 3);
  ok('with it marked', reopened.marked);
  ok('its group open', reopened.open.ASB === true, JSON.stringify(reopened.open));
  ok('and the others folded away', reopened.open.Barclays === false);
  ok('the list underneath says whose it is', /ASB/.test(reopened.heading),
     reopened.heading);

  const vanished = await page.evaluate(async () => {
    // That account is removed, or stops being shared with you.
    window.__rows.accounts = window.__rows.accounts.filter(a => a.id !== 3);
    await loadMoney(); renderMoney();
    await new Promise(r => setTimeout(r, 300));
    const out = { picked: MONEY_ACC, kept: localStorage.getItem('moneyacc') };
    window.__rows.accounts.push({id:3,name:'ASB',kind:'current',currency:'NZD',
      opening_balance:500,opening_date:'2026-01-01',active:true,sort:30,
      created_by:'other',group_name:'ASB'});
    await loadMoney();
    return out;
  });
  ok('an account that has gone does not leave a blank screen',
     vanished.picked === 'all', String(vanished.picked));
  ok('and it stops being remembered', vanished.kept === 'all', vanished.kept);

  console.log('\nThe jobs fold away');
  const jobs = await page.evaluate(async () => {
    localStorage.removeItem('moneyjobs');
    MONEY_JOBS = false;
    await openMoney();
    await new Promise(r => setTimeout(r, 300));
    const d = document.querySelector('#moneyJobs');
    return { there: !!d, open: d && d.open,
             words: d && d.querySelector('summary').textContent.trim(),
             inside: d ? d.querySelectorAll('.menuitem').length : 0 };
  });
  ok('they are in a fold of their own', jobs.there);
  ok('closed to begin with', jobs.open === false);
  ok('saying what is inside', /Reconcile/.test(jobs.words || ''), jobs.words);
  ok('with all five still there', jobs.inside === 5, String(jobs.inside));

  const jobsKept = await page.evaluate(async () => {
    const d = document.querySelector('#moneyJobs');
    d.open = true; d.dispatchEvent(new Event('toggle'));
    await new Promise(r => setTimeout(r, 200));
    const stored = localStorage.getItem('moneyjobs');
    renderMoney();
    await new Promise(r => setTimeout(r, 200));
    return { stored, after: document.querySelector('#moneyJobs').open };
  });
  ok('opening them is remembered', jobsKept.stored === '1', jobsKept.stored);
  ok('and they come back open', jobsKept.after === true);

  // ---------------------------------------------------------------
  console.log('\nThe background stays on the main page');
  const stayed = await page.evaluate(async () => {
    MY_PROFILE.home_tiles = { tiles:TILES, hidden:TILES_HIDDEN, bg:'sage' };
    loadTiles(); showHome();
    await new Promise(r => setTimeout(r, 200));
    openSettings('Finances');
    await new Promise(r => setTimeout(r, 300));
    const g = el => getComputedStyle(el).backgroundColor;
    return { home: $('home').getAttribute('style'), settings: g($('settings')),
             body: g(document.body), bar: g(document.querySelector('.homebar')) };
  });
  ok('the home screen takes it', /background/.test(stayed.home || ''), stayed.home);
  ok('Settings is left alone', stayed.settings === 'rgb(255, 255, 255)', stayed.settings);
  ok('and so is everything behind it', stayed.body === 'rgb(255, 255, 255)', stayed.body);
  ok('the bar at the top matches the strip at the bottom',
     stayed.bar === 'rgb(255, 255, 255)', stayed.bar);
  ok('there are deeper ones to choose from now',
     await page.evaluate(() => HOME_BGS.length >= 14));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
