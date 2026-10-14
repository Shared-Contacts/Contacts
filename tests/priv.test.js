// The five things in this batch, driven through the real page:
// accounts that belong to somebody, reordering them, the reconciliation date
// in colour, receipts on a transaction, and keeping the bank's own CSV.
const { chromium } = require('playwright');
const path = require('path');
const DIR = __dirname;

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
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto('file://' + path.join(DIR, 'boot.html'));
  await page.waitForTimeout(900);

  // ---------------------------------------------------------------
  console.log('\nThe two imports are no longer the same function');
  // They shared the name doImport. The later declaration won, so the Contacts
  // import button was running the money import.
  const kinds = await page.evaluate(() => ({
    contacts: typeof doImport === 'function' && doImport.toString().includes('IMPORT_ROWS'),
    money: typeof doMoneyImport === 'function' && doMoneyImport.toString().includes('IMPORT.ready'),
    distinct: doImport !== doMoneyImport
  }));
  ok('the Contacts import is still the contacts one', kinds.contacts);
  ok('the money import has a name of its own', kinds.money);
  ok('they are two different functions', kinds.distinct);

  // ---------------------------------------------------------------
  console.log('\nFinances is open to everyone now');
  ok('no ticket is needed to open it', await page.evaluate(() => MONEY_ON === true));
  await page.evaluate(() => openMoney());
  await page.waitForTimeout(500);
  ok('the Finances screen opens', await page.isVisible('#money'));

  // ---------------------------------------------------------------
  console.log('\nThe reconciliation date, in colour');
  const states = await page.evaluate(() => {
    const day = n => new Date(Date.now() - n*86400000).toISOString().slice(0,10);
    const keep = STATEMENTS.slice();
    const run = rows => { STATEMENTS = rows; return reconState(1); };
    const out = {
      none:   run([]),
      recent: run([{account_id:1, ends_on:day(10)}]),
      edge:   run([{account_id:1, ends_on:day(38)}]),
      stale:  run([{account_id:1, ends_on:day(70)}]),
      other:  run([{account_id:2, ends_on:day(1)}]),
      latest: run([{account_id:1, ends_on:day(90)},{account_id:1, ends_on:day(3)}])
    };
    STATEMENTS = keep;
    return out;
  });
  ok('never reconciled says so, quietly', states.none.cls === 'never'
     && /not reconciled yet/.test(states.none.words), JSON.stringify(states.none));
  ok('agreed last week is green', states.recent.cls === 'ok');
  ok('five weeks and a few days is still green', states.edge.cls === 'ok');
  ok('ten weeks goes amber', states.stale.cls === 'late');
  ok('another account\'s statement does not count', states.other.cls === 'never');
  ok('the latest statement is the one that counts', states.latest.cls === 'ok',
     JSON.stringify(states.latest));
  ok('it says which date it was reconciled to',
     /^reconciled to /.test(states.recent.words), states.recent.words);

  const cardHtml = await page.innerHTML('#moneyBody');
  ok('the date is shown on the account itself', /class="recon /.test(cardHtml));
  ok('Barclays has a statement, long ago, so it is amber',
     /recon late">reconciled to/.test(cardHtml), cardHtml.match(/recon \w+">[^<]*/g));
  ok('Amex has never been reconciled', /recon never">not reconciled yet/.test(cardHtml));
  const css = await page.evaluate(() => {
    const el = document.querySelector('.acct .recon.late');
    return el ? getComputedStyle(el).color : '';
  });
  ok('amber is actually amber on the screen', css === 'rgb(138, 109, 18)', css);

  // ---------------------------------------------------------------
  console.log('\nAn account belongs to somebody');
  await page.evaluate(() => { $('money').classList.add('hidden'); openSettings('Finances'); });
  await page.waitForTimeout(600);
  const set = await page.textContent('#setBody');
  ok('an account of mine says it is mine alone', /Yours alone/.test(set));
  ok('one I have shared says who with', /Shared with Sandra/.test(set), set.slice(0,400));
  ok('one somebody shares with me says so',
     /Someone Else shares this with you/.test(set));
  ok('and I can walk away from that one', (await page.$$('[data-aleave]')).length === 1);
  ok('I am only offered sharing on my own accounts',
     (await page.$$('[data-ashare]')).length === 2);

  console.log('\nSaying who can see one');
  await page.evaluate(() => { window.__writes.length = 0; shareBox(1); });
  await page.waitForTimeout(300);
  const box = await page.textContent('.daypick');
  ok('the panel names the account', /Who can see Barclays/.test(box));
  ok('it lists the other people', /Sandra/.test(box) && /Someone Else/.test(box));
  ok('three levels are offered',
     /Not at all/.test(box) && /Look only/.test(box) && /Look and change/.test(box));
  ok('nobody is set to begin with', await page.evaluate(() =>
     document.querySelector('[data-lvl="sandra:no"]').getAttribute('aria-pressed') === 'true'));

  await page.click('[data-lvl="sandra:edit"]');
  await page.waitForTimeout(300);
  let w = await page.evaluate(() => window.__writes.slice());
  const up = w.find(x => x.table === 'account_shares' && x.op === 'upsert');
  ok('sharing it writes a share', !!up, JSON.stringify(w));
  ok('for that account and that person',
     up && up.rows.account_id === 1 && up.rows.viewer_id === 'sandra');
  ok('look and change means can_edit', up && up.rows.can_edit === true);

  await page.evaluate(() => { window.__writes.length = 0; });
  await page.click('[data-lvl="sandra:look"]');
  await page.waitForTimeout(300);
  w = await page.evaluate(() => window.__writes.slice());
  ok('look only means it cannot be changed',
     w.some(x => x.table === 'account_shares' && x.op === 'upsert' && x.rows.can_edit === false));

  await page.evaluate(() => { window.__writes.length = 0; });
  await page.click('[data-lvl="sandra:no"]');
  await page.waitForTimeout(300);
  w = await page.evaluate(() => window.__writes.slice());
  ok('taking it back deletes the share',
     w.some(x => x.table === 'account_shares' && x.op === 'delete'));
  await page.evaluate(() => { const b = document.querySelector('.daypick'); if (b) b.remove(); });

  // ---------------------------------------------------------------
  console.log('\nPutting the accounts in your own order');
  await page.evaluate(() => { openSettings('Finances'); });
  await page.waitForTimeout(500);
  // The settings cards start folded up, as they do for him.
  const unfold = () => page.evaluate(() =>
    document.querySelectorAll('.card.logsec').forEach(d => d.open = true));
  await unfold();
  ok('every account has arrows', (await page.$$('[data-amv]')).length === 6);
  ok('the first cannot go up further',
     await page.isDisabled('[data-amv="1:up"]'));
  ok('the last cannot go down further',
     await page.isDisabled('[data-amv="3:down"]'));
  await page.evaluate(() => { window.__writes.length = 0; });
  await page.click('[data-amv="1:down"]');
  await page.waitForTimeout(500);
  w = await page.evaluate(() => window.__writes.filter(x => x.table === 'accounts'));
  ok('moving one down renumbers the whole list', w.length === 3, JSON.stringify(w));
  ok('in tens, so there is room to drop one in between',
     w.every(x => x.patch && x.patch.sort % 10 === 0));
  ok('and the numbers are 10, 20, 30',
     JSON.stringify(w.map(x => x.patch.sort)) === '[10,20,30]');

  // ---------------------------------------------------------------
  console.log('\nA receipt against a transaction');
  await page.evaluate(() => { $('settings').classList.add('hidden'); openMoney(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => editTxn(1));
  await page.waitForTimeout(500);
  const ed = await page.textContent('#moneyEdBody');
  ok('there is somewhere for receipts', /Receipts/.test(ed));
  ok('the camera can be used', (await page.$$('#txShotCam')).length === 1);
  ok('or one already taken', (await page.$$('#txShotPick')).length === 1);
  ok('and it says why you would bother', /tax time/.test(ed));

  const shot = await page.evaluate(async () => {
    window.__writes.length = 0;
    // A real little PNG, so the shrinking is exercised rather than stubbed out.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNM'
      + 's+9AAAAFUlEQVR42mNk+M+ACzDhlBmVGQwyAAAhgwQBtfYvjAAAAABJRU5ErkJggg==';
    const blob = await (await fetch(png)).blob();
    const f = new File([blob], 'till.png', { type:'image/png' });
    await addReceipts([f]);
    return { writes: window.__writes.slice(), kept: (TX.photos||[]).length };
  });
  const upl = shot.writes.find(x => x.op === 'upload');
  ok('the photo is uploaded', !!upl, JSON.stringify(shot.writes));
  ok('into the account\'s own folder, which is what the rules check',
     upl && /^fin\/1\/[0-9a-f-]+\.jpg$/.test(upl.path), upl && upl.path);
  ok('as a jpeg, whatever came in', upl && upl.type === 'image/jpeg');
  ok('and it is recorded against the transaction',
     shot.writes.some(x => x.table === 'transactions' && x.op === 'update'
                        && Array.isArray(x.patch.photos) && x.patch.photos.length === 1));
  ok('the editor now shows one receipt', shot.kept === 1);
  await page.waitForTimeout(300);
  ok('and it is on the screen', (await page.$$('#txShots .shotwrap')).length === 1);

  const gone = await page.evaluate(async () => {
    window.__writes.length = 0;
    await dropReceipt(0);
    return { writes: window.__writes.slice(), left: (TX.photos||[]).length };
  });
  ok('removing one takes the file with it',
     gone.writes.some(x => x.op === 'rmfile'), JSON.stringify(gone.writes));
  ok('and the transaction forgets it', gone.left === 0);

  // ---------------------------------------------------------------
  console.log('\nKeeping the bank\'s own file');
  await page.evaluate(() => { $('moneyEd').classList.add('hidden'); openSettings('Finances'); });
  await page.waitForTimeout(600);
  await unfold();
  const set2 = await page.textContent('#setBody');
  ok('an account with a file kept says so', /1 statement file kept/.test(set2), set2.slice(0,600));
  ok('one without says that too', /No statement files kept/.test(set2));
  ok('every account offers the list', (await page.$$('[data-afiles]')).length === 3);

  await page.click('[data-afiles="1"]');
  await page.waitForTimeout(400);
  const fbox = await page.textContent('.daypick');
  ok('the panel names the account', /Statement files for Barclays/.test(fbox));
  ok('the file is listed by its own name', /barclays-feb\.csv/.test(fbox));
  // The year only appears once it is not the current one, as everywhere else.
  ok('with the span it covers', /1 Feb( 26)? to 28 Feb( 26)?/.test(fbox), fbox.slice(0,500));
  ok('and how much of it was brought in', /28 of 31 brought in/.test(fbox));
  ok('and how big it is', /4 kB/.test(fbox));
  const href = await page.getAttribute('.daypick a.get', 'href');
  ok('it can be fetched back', href === 'https://signed.test/fin/1/statements/aaa-barclays-feb.csv',
     href);
  ok('as a download, under its own name',
     (await page.getAttribute('.daypick a.get', 'download')) === 'barclays-feb.csv');

  const hand = await page.evaluate(async () => {
    window.__writes.length = 0;
    const f = new File(['Date,Description,Amount\n'], 'asb march.csv', { type:'text/csv' });
    const inp = document.querySelector('#bfPick');
    const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles:true }));
    await new Promise(r => setTimeout(r, 400));
    return window.__writes.slice();
  });
  const hu = hand.find(x => x.op === 'upload');
  const hi = hand.find(x => x.table === 'bank_files' && x.op === 'insert');
  ok('a file can be kept without importing it', !!hu && !!hi, JSON.stringify(hand));
  ok('it goes under the account, in a statements folder',
     hu && /^fin\/1\/statements\/[0-9a-f-]+-asb-march\.csv$/.test(hu.path), hu && hu.path);
  ok('an awkward name is tidied but still recognisable',
     hi && hi.rows.name === 'asb march.csv');
  ok('and it is marked as one you kept yourself',
     hi && hi.rows.note === 'kept by hand');
  ok('with nothing claimed about what it brought in',
     hi && hi.rows.rows_taken === undefined);

  const rm = await page.evaluate(async () => {
    window.__writes.length = 0;
    const b = document.querySelector('[data-fdrop]');
    b.click();
    await new Promise(r => setTimeout(r, 400));
    return window.__writes.slice();
  });
  ok('a kept file can be removed', rm.some(x => x.op === 'rmfile'), JSON.stringify(rm));
  ok('from storage and from the list both',
     rm.some(x => x.table === 'bank_files' && x.op === 'delete'));
  await page.evaluate(() => { const b = document.querySelector('.daypick'); if (b) b.remove(); });

  console.log('\nAnd kept automatically when a statement is imported');
  const imp = await page.evaluate(async () => {
    window.__writes.length = 0;
    IMPORT = { acc:1, rows:[], head:[], map:null, name:'',
      file: new File(['Date,Description,Amount\n'], 'feb.csv', { type:'text/csv' }),
      ready:[ {take:true,  date:'2026-03-01', amount:-12.5, desc:'Coal'},
              {take:true,  date:'2026-03-09', amount:-40,   desc:'Diesel'},
              {take:false, date:'2026-03-14', amount:-9.99, desc:'Still pending'} ] };
    await doMoneyImport();
    return window.__writes.slice();
  });
  const iu = imp.find(x => x.op === 'upload');
  const ii = imp.find(x => x.table === 'bank_files' && x.op === 'insert');
  ok('the file is kept as part of the import', !!iu && !!ii, JSON.stringify(imp).slice(0,400));
  ok('against the account it was imported into', ii && ii.rows.account_id === 1);
  ok('with the span the file covers',
     ii && ii.rows.covers_from === '2026-03-01' && ii.rows.covers_to === '2026-03-14',
     ii && ii.rows.covers_from + ' to ' + ii.rows.covers_to);
  ok('and how many of its rows were taken',
     ii && ii.rows.rows_seen === 3 && ii.rows.rows_taken === 2,
     ii && ii.rows.rows_taken + ' of ' + ii.rows.rows_seen);
  ok('the transactions still went in',
     imp.some(x => x.table === 'transactions' && x.op === 'insert'));

  // A file that will not upload must not make the import look like it failed.
  const sad = await page.evaluate(async () => {
    const real = sb.storage.from;
    sb.storage.from = () => ({ upload:() => Promise.resolve({ error:{ message:'no' } }),
      createSignedUrls:() => Promise.resolve({ data:[], error:null }),
      remove:() => Promise.resolve({}) });
    window.__toasts = [];
    const t = window.toast; window.toast = m => { window.__toasts.push(m); t(m); };
    IMPORT = { acc:1, file:new File(['x'], 'x.csv', { type:'text/csv' }),
               ready:[{take:true, date:'2026-03-01', amount:-1, desc:'x'}], name:'' };
    await doMoneyImport();
    sb.storage.from = real; window.toast = t;
    return window.__toasts.slice();
  });
  ok('if the file cannot be kept, the figures still are',
     sad.some(m => /Figures are in/.test(m)), JSON.stringify(sad));
  ok('and the import is not reported as a failure',
     sad.some(m => /brought in/.test(m)), JSON.stringify(sad));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.filter(e => /PAGE ERROR/.test(e)).length ? 1 : 0);
})();
