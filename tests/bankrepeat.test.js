// A Barclays-shaped export with the same thing bought twice on one day (two
// £5.60 rounds at the same pub, 29 Oct 2026, ML88). Both rows made the same
// reference, so the database refused the whole file with "Some of those are
// already in". Here the database's rule - one reference per account - is
// copied into the stand-in, so the old code fails this test as it did for real.
// Then (ML91): a row brought in before is recognised by its reference even if
// its amount or date has changed since, and the preview lists every row.
const { chromium } = require('playwright');
const path = require('path');
const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

// The tabs and padding are as Barclays writes them.
const CSV = [
  'Number,Date,Account,Amount,Subcategory,Memo',
  '"\t0",04/09/2026,20-00-00 12345678,-11.7,Debit,"THE KINGS ARMS        \tON 03 SEP CPM\t"',
  '"\t0",03/09/2026,20-00-00 12345678,-5.6,Debit,"THE RED LION INN      \tON 02 SEP CPM\t"',
  '"\t0",03/09/2026,20-00-00 12345678,-5.6,Debit,"THE RED LION INN      \tON 02 SEP CPM\t"',
  '"\t0",03/09/2026,20-00-00 12345678,-5.6,Debit,"THE RED LION INN      \tON 02 SEP CPM\t"',
  '"\t0",01/09/2026,20-00-00 12345678,-2.25,Debit,"GREGGS PLC            \tON 28 AUG CPM\t"',
  '"\t"'
].join('\n');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{ width:390, height:844 } });
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|duplicate key/i.test(t))
      errors.push('CONSOLE: ' + t); });

  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.__rows.accounts.push(
      {id:9,name:'Barclays BBA Overdraft',kind:'current',currency:'GBP',opening_balance:0,
       opening_date:'2026-01-01',active:true,sort:40});
    // An earlier import: the Greggs row is already in the books.
    window.__rows.transactions = (window.__rows.transactions||[]).concat([
      {id:5001, account_id:9, tdate:'2026-09-01', total:-2.25, kind:'expense',
       reference:'GREGGS PLC ON 28 AUG CPM', payee_id:null,
       bank_ref:'2026-09-01|-2.25|GREGGS PLC            \tON 28 AUG CPM'}]);
    // The database's rule: one reference per account, across the books and
    // within the batch. Anything else refuses the whole insert.
    const real = sb.from.bind(sb);
    window.__refused = 0;
    sb.from = t => {
      const q = real(t);
      if (t !== 'transactions') return q;
      const ins = q.insert.bind(q);
      q.insert = rows => {
        const arr = [].concat(rows).filter(r => r.bank_ref);
        const keys = arr.map(r => r.account_id + '#' + r.bank_ref);
        const have = (window.__rows.transactions||[]).filter(r => r.bank_ref)
          .map(r => r.account_id + '#' + r.bank_ref);
        if (new Set(keys).size !== keys.length || keys.some(k => have.includes(k))) {
          window.__refused++;
          const no = { data:null, error:{ message:'duplicate key value violates unique constraint "transactions_bank_ref_idx"' } };
          return { select:() => Promise.resolve(no), then:(f,r) => Promise.resolve(no).then(f,r) };
        }
        return ins(rows);
      };
      return q;
    };
  });
  await p.evaluate(() => openMoney());
  await p.waitForTimeout(500);
  await p.evaluate(() => openImport());
  await p.waitForTimeout(300);

  console.log('\nReading the file');
  await p.selectOption('#impAcc', { label:'Barclays BBA Overdraft (GBP)' });
  await p.evaluate(() => { IMPORT.acc = 9; });
  await p.fill('#impPaste', CSV);
  await p.click('#impRead');
  await p.waitForTimeout(400);
  await p.click('#impPreview');
  await p.waitForTimeout(500);
  const out = (await p.textContent('#impOut')).replace(/\s+/g,' ');
  ok('five rows for this account, the blank last line left out', /5 rows for this account/.test(out), out.slice(0,90));
  ok('the Greggs already in the books is spotted', /1 already in your books/.test(out), out.slice(0,120));
  ok('the three identical rounds are all ticked, as separate payments',
     await p.evaluate(() => IMPORT.ready.filter(x => /RED LION/.test(x.desc) && x.take).length) === 3);
  ok('four to bring in', /Import 4 transactions/.test(out), out.slice(-200));

  console.log('\nImporting');
  await p.evaluate(() => { window.__writes = []; });
  await p.click('#impGo');
  await p.waitForTimeout(800);
  const refused = await p.evaluate(() => window.__refused);
  const toasts = await p.evaluate(() => $('toasts') ? $('toasts').textContent : '');
  ok('the database takes them', refused === 0, 'refused ' + refused + ' time(s); ' + toasts);
  ok('no "already in" message', !/already in/.test(toasts), toasts);
  const w = await p.evaluate(() => window.__writes);
  const heads = (w.find(x => x.op==='insert' && x.table==='transactions')||{}).rows || [];
  ok('four transactions written', heads.length === 4, 'got ' + heads.length);
  const refs = heads.map(h => h.bank_ref);
  ok('every one with a reference of its own', new Set(refs).size === refs.length, JSON.stringify(refs));
  const sun = refs.filter(r => /RED LION/.test(r));
  ok('the first round keeps the plain reference, the others get |2 and |3',
     sun.length === 3 && !/\|\d$/.test(sun[0]) && sun[1] === sun[0] + '|2' && sun[2] === sun[0] + '|3',
     JSON.stringify(sun));
  ok('a row that is not repeated is unchanged',
     refs.some(r => /^2026-09-04\|-11\.70\|THE KINGS ARMS/.test(r) && !/\|\d$/.test(r)), JSON.stringify(refs));
  const lines = (w.find(x => x.op==='insert' && x.table==='transaction_items')||{}).rows || [];
  ok('each round has its own £5.60 line', lines.filter(l => l.amount === -5.6).length === 3,
     JSON.stringify(lines.map(l => l.amount)));

  // What a fresh preview of the same file, into another account, looks like.
  const again = async (acc, books) => {
    await p.evaluate(([acc, books]) => {
      window.__rows.accounts.push({id:acc,name:'Test '+acc,kind:'current',currency:'GBP',
        opening_balance:0,opening_date:'2026-01-01',active:true,sort:60+acc});
      window.__rows.transactions = window.__rows.transactions.concat(books);
      IMPORT.acc = acc; IMPORT.ready = null; window.__writes = []; window.__refused = 0;
      $('moneyImp').classList.remove('hidden');   // a finished import closes it
    }, [acc, books]);
    await p.evaluate(async () => { await scanBooks(); importPreview(); });
    await p.waitForTimeout(300);
    return (await p.textContent('#impOut')).replace(/\s+/g,' ');
  };
  const refOf = (date, amt, desc) => date + '|' + amt.toFixed(2) + '|' + desc;
  const KINGS = 'THE KINGS ARMS        \tON 03 SEP CPM';
  const LION = 'THE RED LION INN      \tON 02 SEP CPM';
  const written = () => p.evaluate(() =>
    ((window.__writes.find(x => x.op==='insert' && x.table==='transactions')||{}).rows||[]));

  console.log('\nThe same file again');
  const imported = [
    {tdate:'2026-09-04', total:-11.7, bank_ref:refOf('2026-09-04',-11.7,KINGS)},
    {tdate:'2026-09-03', total:-5.6, bank_ref:refOf('2026-09-03',-5.6,LION)},
    {tdate:'2026-09-03', total:-5.6, bank_ref:refOf('2026-09-03',-5.6,LION)+'|2'},
    {tdate:'2026-09-03', total:-5.6, bank_ref:refOf('2026-09-03',-5.6,LION)+'|3'},
    {tdate:'2026-09-01', total:-2.25, bank_ref:refOf('2026-09-01',-2.25,'GREGGS PLC            \tON 28 AUG CPM')}];
  const mk = (acc, base) => imported.map((t,i) => Object.assign({id:base+i, account_id:acc,
    kind:'expense', reference:'already in', payee_id:null}, t));
  let o = await again(10, mk(10, 7000));
  ok('every row is seen as already in', /5 rows for this account, 5 already in your books/.test(o), o.slice(0,90));
  ok('so nothing is ticked', await p.evaluate(() => IMPORT.ready.filter(x => x.take).length) === 0);
  const kings = await p.evaluate(() => IMPORT.ready.find(x => /KINGS/.test(x.desc)).key);
  await p.click(`[data-imp="${kings.replace(/"/g,'\\"')}"]`); await p.waitForTimeout(300);
  await p.click('#impGo'); await p.waitForTimeout(700);
  let wr = await written();
  ok('one ticked back on by hand still comes in, as a separate payment',
     wr.length === 1 && /KINGS/.test(wr[0].reference) && await p.evaluate(() => window.__refused) === 0,
     JSON.stringify(wr.map(r => r.bank_ref)));
  ok('with a reference of its own', wr.length === 1 && wr[0].bank_ref !== refOf('2026-09-04',-11.7,KINGS)
     && wr[0].bank_ref.startsWith(refOf('2026-09-04',-11.7,KINGS) + '|'), wr[0] && wr[0].bank_ref);

  console.log('\nOne brought in before, its amount changed since');
  // Split or edited afterwards, so its amount no longer matches the statement.
  const changed = mk(11, 7100).filter(t => /KINGS/.test(t.bank_ref)).map(t => Object.assign(t, {total:-20}));
  o = await again(11, changed);
  ok('it is still recognised, by its reference', /1 already in your books/.test(o), o.slice(0,90));
  ok('and left unticked', await p.evaluate(() => IMPORT.ready.find(x => /KINGS/.test(x.desc)).take) === false);
  await p.click('#impGo'); await p.waitForTimeout(700);
  wr = await written();
  ok('the other four come in without a refusal',
     wr.length === 4 && await p.evaluate(() => window.__refused) === 0, 'wrote ' + wr.length);

  console.log('\nOne brought in before, since moved to another date');
  // Outside the dates the preview fetches, so only the last check can see it.
  const moved = mk(12, 7200).filter(t => /KINGS/.test(t.bank_ref)).map(t => Object.assign(t, {tdate:'2026-08-01'}));
  o = await again(12, moved);
  ok('the preview cannot see it, so all five are ticked', /Import 5 transactions/.test(o), o.slice(-200));
  await p.evaluate(() => { const t = $('toasts'); if (t) t.textContent = ''; });
  await p.click('#impGo'); await p.waitForTimeout(700);
  wr = await written();
  const t1 = await p.evaluate(() => $('toasts') ? $('toasts').textContent : '');
  ok('the last check stops before anything is written', wr.length === 0 && await p.evaluate(() => window.__refused) === 0);
  ok('and says one came in before', /1 of those came in before/.test(t1), t1);
  o = (await p.textContent('#impOut')).replace(/\s+/g,' ');
  ok('that row is now unticked and shown as already here',
     /Import 4 transactions/.test(o) && /already here as/.test(o), o.slice(-220));
  await p.click('#impGo'); await p.waitForTimeout(700);
  wr = await written();
  ok('pressing Import again brings in the other four', wr.length === 4 && await p.evaluate(() => window.__refused) === 0,
     'wrote ' + wr.length);

  console.log('\nA long file shows every row');
  const long = ['Number,Date,Account,Amount,Subcategory,Memo'];
  for (let i = 0; i < 75; i++)
    long.push(`"\t0",${String(1 + (i % 28)).padStart(2,'0')}/10/2026,20-00-00 12345678,-${(i + 1).toFixed(2)},Debit,"SHOP ${i}\tON 01 OCT CPM\t"`);
  await p.evaluate(acc => { IMPORT.acc = acc; $('moneyImp').classList.remove('hidden'); }, 12);
  await p.fill('#impPaste', long.join('\n'));
  await p.click('#impRead'); await p.waitForTimeout(400);
  await p.click('#impPreview'); await p.waitForTimeout(500);
  o = (await p.textContent('#impOut')).replace(/\s+/g,' ');
  ok('all 75 rows are listed', await p.evaluate(() => document.querySelectorAll('#impOut [data-imp]').length) === 75,
     await p.evaluate(() => document.querySelectorAll('#impOut [data-imp]').length));
  ok('with no "…and more, all ticked" line', !/more, all ticked/.test(o));
  ok('and the button agrees with the ticks', /Import 75 transactions/.test(o), o.slice(-200));

  await b.close();
  console.log('\n' + '='.repeat(52));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
