// What you buy for the boat: Diesel, Coal, Pump outs, Gas and Boat servicing
// in the Daily Log, plus the diary notes in a Notes section of their own.
// Only what is typed is stored; every sum is worked out from the log, so the
// checks here are figures worked out by hand from the days below.
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
  page.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  const ev = (f, a) => page.evaluate(f, a);
  const settle = () => page.waitForTimeout(350);
  const lastWrite = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op===op && w.table===table).pop() || null, [op, table]);
  const text = sel => ev(s => (document.querySelector(s)||{}).textContent || '', sel);
  const calc = kind => text(`[data-bcalc="${kind}"]`);
  const type = async (sel, v) => { await page.fill(sel, String(v)); await settle(); };

  // A run of days. Engine hours 1200 on the last diesel day, 1250 today.
  // Pump out 5 days ago, with 2, 2, 3, 2 and 2 aboard since (11 nights).
  await ev(() => {
    const d = n => { const x = new Date(); x.setDate(x.getDate()-n); return isoDay(x); };
    window.__D = d;
    window.__TODAY = d(0);
    window.__rows.groups = [{id:1,name:'Family',sort_order:10,owner_id:null},
                            {id:2,name:'Professional/Business',sort_order:20,owner_id:null}];
    window.__rows.contacts.push({id:3,created_by:'me',company:'Midway Boats',
      is_organisation:true,town:'Middlewich',contact_groups:[{group_id:2}]});
    window.__rows.log_days = [
      {id:1, created_by:'me', on_date:d(0), hours_start:1248, hours_end:1250, pob_tonight:2,
       diary_notes:'Quiet day at the moorings', regular_chores:'Washed the roof', buys:{}},
      {id:2, created_by:'me', on_date:d(1), pob_tonight:2, buys:{}},
      {id:3, created_by:'me', on_date:d(2), pob_tonight:2, buys:{}},
      {id:4, created_by:'me', on_date:d(3), pob_tonight:3, buys:{}},
      {id:5, created_by:'me', on_date:d(4), pob_tonight:2, buys:{}},
      {id:6, created_by:'me', on_date:d(5), pob_tonight:2, pump_out:true, buys:{}},
      // Ticked for diesel before step 41, with no record: it still counts.
      {id:7, created_by:'me', on_date:d(8), hours_end:1200, diesel:true, lpg_gas:true,
       buys:{}},
      {id:8, created_by:'me', on_date:d(20), diesel:true, hours_end:1100,
       buys:{diesel:{litres:90, ppl:1.1, prop_pct:70},
             coal:{type:'Excel', bag_kg:20, bags:2, per_bag:12}}},
    ];
    window.__rows.log_options = [];
    window.__rows.log_shares = [];
    window.__rows.profiles[0].log_sections = null;
  });
  await ev(() => loadAll()); await settle();

  // ---------------------------------------------------------------
  console.log('\nThe sections');
  const ids = await ev(() => LOG_SECTIONS.map(s => s.id).join(','));
  ok('five purchase sections after Boat and services, Notes after The day',
     ids === 'where,bp,medication,body,activity,boat,diesel,coal,pumpout,gas,service,aboard,photos,day,notes', ids);
  const placed = await ev(() => {
    MY_PROFILE.log_sections = [{id:'day',on:true},{id:'where',on:true},{id:'boat',on:false},
      {id:'bp',on:true},{id:'medication',on:true},{id:'body',on:true},{id:'activity',on:true},
      {id:'aboard',on:true},{id:'photos',on:true}];
    const out = mySections().map(x => x.id+(x.on?'':'-off')).join(',');
    MY_PROFILE.log_sections = null;
    return out;
  });
  ok('in a saved order, new ones go in after their neighbour, not at the bottom',
     placed === 'day,notes,where,boat-off,diesel,coal,pumpout,gas,service,bp,medication,body,activity,aboard,photos', placed);

  // ---------------------------------------------------------------
  console.log('\nNotes on their own');
  await ev(() => openLog()); await settle();
  const cards = await ev(() => [...document.querySelectorAll('#logBody .card')].map(c =>
    (c.querySelector('h3,summary')||{}).textContent));
  ok('a Notes card after The day', cards.indexOf('Notes') === cards.indexOf('The day')+1, JSON.stringify(cards));
  ok('the diary notes are in Notes', await ev(() => [...document.querySelectorAll('#logBody .card')]
    .find(c => /^Notes/.test(c.textContent.trim())).textContent.includes('Quiet day at the moorings')));
  ok('and not in The day, which keeps the chores', await ev(() => {
    const c = [...document.querySelectorAll('#logBody .card')].find(c => /^The day/.test(c.textContent.trim()));
    return c && !c.textContent.includes('Quiet day') && c.textContent.includes('Washed the roof'); }));
  ok('no purchase cards on a day with no purchases', await ev(() =>
    !['diesel','coal','pumpout','gas','service'].some(k => document.querySelector(`#logBody [data-sec="${k}"]`))));

  // ---------------------------------------------------------------
  console.log('\nThe form');
  await ev(() => editLog(window.__TODAY)); await settle();
  ok('Notes has its own box with the diary notes', await ev(() =>
    [...document.querySelectorAll('#logForm legend')].some(l => l.textContent==='Notes')
    && $('logForm').elements['diary_notes'].value === 'Quiet day at the moorings'));
  ok('all five purchases are there, folded away', await ev(() =>
    ['diesel','coal','pumpout','gas','service'].every(k => {
      const b = document.querySelector(`[data-bbox="${k}"]`); return b && !b.open; })));
  ok('the quick tick boxes are still in Boat and services', await ev(() =>
    ['diesel','coal','lpg_gas'].every(k => $('logForm').elements[k])
    && $('logForm').elements['diesel_pumpout_at'] && $('logForm').elements['coal_gas_at']));

  console.log('\nDiesel');
  await ev(() => document.querySelector('[data-bbox="diesel"]').open = true);
  ok('the split starts from the last one: 70% propulsion, 30% domestic', await ev(() =>
    document.querySelector('[data-b="diesel.prop_pct"]').value==='70'
    && document.querySelector('[data-bdom]').value==='30'));
  await type('[data-b="diesel.litres"]', 100);
  await type('[data-b="diesel.ppl"]', 1.25);
  ok('the total works itself out: 100 × £1.25 = 125.00', await ev(() =>
    document.querySelector('[data-b="diesel.total"]').value === '125.00'));
  let c = await calc('diesel');
  ok('70 L propulsion, 30 L domestic', /70\.0 L propulsion, 30\.0 L domestic/.test(c), c);
  ok('engine hours now come from Boat and services: 1250', /Engine hours now: 1250/.test(c), c);
  ok('last time is the old ticked day: 1200 hours', /Last diesel: 1200 hours/.test(c), c);
  ok('50 hours run, 2.00 litres an hour, £2.50 an hour',
     /Hours run since: 50\.0/.test(c) && /Litres per hour: 2\.00/.test(c) && /Cost per hour: £2\.50/.test(c), c);
  await type('[data-bdom]', 40);
  ok('changing domestic to 40 makes propulsion 60', await ev(() =>
    document.querySelector('[data-b="diesel.prop_pct"]').value === '60'));
  await type('[data-b="diesel.total"]', 124.37);
  await type('[data-b="diesel.litres"]', 101);
  ok('a total typed to match the receipt is left alone', await ev(() =>
    document.querySelector('[data-b="diesel.total"]').value === '124.37'));
  await type('[name="hours_end"]', 1260);
  c = await calc('diesel');
  ok('changing the engine hours on the form updates it: 60 hours', /Hours run since: 60\.0/.test(c), c);

  console.log('\nPurchased from');
  await type('[data-bfrom="diesel"]', 'midw');
  ok('finds the contact as you type', await ev(() =>
    /Midway Boats/.test(document.querySelector('[data-bhits="diesel"]').textContent)));
  await page.click('[data-bhits="diesel"] [data-bpick="3"]'); await settle();
  ok('tapping one fills it in', await ev(() => {
    const i = document.querySelector('[data-bfrom="diesel"]'); return i.value==='Midway Boats' && i.dataset.cid==='3'; }));

  await ev(() => { window.confirm = () => true; window.__writes.length = 0; });
  await ev(() => document.querySelector('[data-bbox="coal"]').open = true);
  await type('[data-bfrom="coal"]', 'Kings Lock Chandlery');
  await page.click('[data-bhits="coal"] [data-bnew]'); await page.waitForTimeout(500);
  const ins = await lastWrite('insert', 'contacts');
  ok('a new supplier goes into contacts as a business', ins && ins.rows.company==='Kings Lock Chandlery'
     && ins.rows.is_organisation===true && ins.rows.created_by==='me', JSON.stringify(ins && ins.rows));
  const cg = await lastWrite('insert', 'contact_groups');
  ok('in the Professional/Business group', cg && cg.rows.group_id===2, JSON.stringify(cg && cg.rows));
  ok('and is filled in on the form', await ev(() => {
    const i = document.querySelector('[data-bfrom="coal"]'); return i.value==='Kings Lock Chandlery' && i.dataset.cid!==''; }));
  ok('and can be found next time', await ev(() => CONTACTS.some(x => x.company==='Kings Lock Chandlery')));

  console.log('\nCoal');
  ok('the type and bag size carry from last time', await ev(() =>
    document.querySelector('[data-b="coal.type"]').value==='Excel'
    && document.querySelector('[data-b="coal.bag_kg"]').value==='20'));
  await type('[data-b="coal.bag_kg"]', 25);
  await type('[data-b="coal.bags"]', 4);
  await type('[data-b="coal.per_bag"]', 13.5);
  c = await calc('coal');
  ok('4 × 25 kg = 100 kg, £54.00, £0.54 a kg',
     /Total weight: 100 kg/.test(c) && /Total cost: £54\.00/.test(c) && /Cost per kg: £0\.54/.test(c), c);

  console.log('\nPump out');
  await ev(() => document.querySelector('[data-bbox="pumpout"]').open = true);
  await type('[data-b="pumpout.cost"]', 20);
  await page.check('[data-b="pumpout.blue"]'); await settle();
  c = await calc('pumpout');
  ok('5 days since the last one', /5 days ago/.test(c), c);
  ok('11 nights aboard since, about 2.2 a night', /11 nights aboard since, about 2\.2 a night/.test(c), c);

  console.log('\nGas');
  await ev(() => document.querySelector('[data-bbox="gas"]').open = true);
  ok('13 kg is the bottle on offer', await ev(() =>
    [...document.querySelectorAll('[data-b="gas.size"] option')].map(o => o.value).join()==='13 kg'));
  await type('[data-b="gas.cost"]', 39);
  c = await calc('gas');
  ok('£39 for 13 kg is £3.00 a kg', /Cost per kg: £3\.00/.test(c), c);
  ok('last bought on the old ticked day, 8 days before', /8 days before/.test(c), c);

  console.log('\nBoat servicing');
  await ev(() => document.querySelector('[data-bbox="service"]').open = true);
  ok('what was serviced: Engine, Heating, Plumbing, Electrics, Other', await ev(() =>
    [...document.querySelectorAll('[data-b="service.what"] option')].map(o => o.value).join()
      === ',Engine,Heating,Plumbing,Electrics,Other'));
  await page.selectOption('[data-b="service.what"]', 'Engine');
  await type('[data-b="service.desc"]', 'Annual service');
  await ev(() => { const r = document.querySelectorAll('[data-bpart]')[0];
    r.querySelector('[data-pp="name"]').value='Oil filter';
    r.querySelector('[data-pp="num"]').value='CH10929';
    r.querySelector('[data-pp="cost"]').value='12.50'; });
  await page.click('#partAdd'); await settle();
  await ev(() => { const r = document.querySelectorAll('[data-bpart]')[1];
    r.querySelector('[data-pp="name"]').value='Engine oil';
    r.querySelector('[data-pp="cost"]').value='30'; });
  await page.click('#partAdd'); await settle();
  ok('three part lines after two taps', (await page.$$('[data-bpart]')).length === 3);
  await page.click('[data-bpart]:last-child [data-partx]'); await settle();
  ok('and the empty one can be taken away', (await page.$$('[data-bpart]')).length === 2);
  await type('[data-b="service.labour"]', 80);
  await type('[data-b="service.vat"]', 24.5);
  c = await calc('service');
  ok('parts £42.50, total £147.00', /Parts: £42\.50/.test(c) && /Total: £147\.00/.test(c), c);

  console.log('\nSaving');
  await ev(() => { window.__writes.length = 0; });
  await ev(() => saveLog(window.__TODAY)); await settle();
  const up = await lastWrite('upsert', 'log_days');
  const b = up && up.rows.buys || {};
  ok('diesel saved as typed, nothing worked out stored', JSON.stringify(b.diesel) === JSON.stringify(
     {litres:101, ppl:1.25, prop_pct:60, total:124.37, from:'Midway Boats', from_id:3}), JSON.stringify(b.diesel));
  ok('coal saved', b.coal && b.coal.bags===4 && b.coal.bag_kg===25 && b.coal.per_bag===13.5
     && b.coal.type==='Excel' && b.coal.from==='Kings Lock Chandlery', JSON.stringify(b.coal));
  ok('pump out saved with Blue', b.pumpout && b.pumpout.cost===20 && b.pumpout.blue===true, JSON.stringify(b.pumpout));
  ok('gas saved', b.gas && b.gas.size==='13 kg' && b.gas.cost===39, JSON.stringify(b.gas));
  ok('servicing saved with both parts', b.service && b.service.what==='Engine'
     && b.service.parts.length===2 && b.service.parts[0].num==='CH10929'
     && b.service.labour===80 && b.service.vat===24.5, JSON.stringify(b.service));
  ok('each one ticks its box', up && up.rows.diesel===true && up.rows.coal===true
     && up.rows.pump_out===true && up.rows.lpg_gas===true, JSON.stringify(up && up.rows).slice(0,200));
  ok('the diary notes are still saved', up && up.rows.diary_notes==='Quiet day at the moorings');

  console.log('\nA carried-over split on its own is not a purchase');
  await ev(() => { window.__writes.length = 0; editLog(window.__D(1)); }); await settle();
  ok('the diesel split is filled in ready', await ev(() =>
    document.querySelector('[data-b="diesel.prop_pct"]').value === '70'));
  await ev(() => saveLog(window.__D(1))); await settle();
  const up2 = await lastWrite('upsert', 'log_days');
  ok('so nothing is saved as bought', up2 && JSON.stringify(up2.rows.buys) === '{}', JSON.stringify(up2 && up2.rows.buys));
  ok('and no box is ticked', up2 && !up2.rows.diesel && !up2.rows.pump_out);

  // ---------------------------------------------------------------
  console.log('\nOn the Daily Log');
  await ev(() => {
    const t = window.__rows.log_days.find(d => d.on_date===window.__TODAY);
    t.diesel = t.coal = t.pump_out = t.lpg_gas = true;
    t.buys = {diesel:{litres:100, ppl:1.25, prop_pct:60, from:'Midway Boats', from_id:3},
              coal:{type:'Excel', bag_kg:25, bags:4, per_bag:13.5},
              pumpout:{cost:20},
              gas:{size:'13 kg', cost:39},
              service:{what:'Engine', desc:'Annual service',
                       parts:[{name:'Oil filter', num:'CH10929', cost:12.5}, {name:'Engine oil', cost:30}],
                       labour:80, vat:24.5}};
  });
  await ev(async () => { await loadLog(); LOG_DATE = window.__TODAY; renderLog(); }); await settle();
  const sec = k => text(`#logBody [data-sec="${k}"]`);
  let s = await sec('diesel');
  ok('Diesel shows the supplier, the split and the total',
     /Midway Boats/.test(s) && /60% propulsion \(60\.0 L\), 40% domestic \(40\.0 L\)/.test(s) && /£125\.00/.test(s), s);
  ok('and 50 hours, 2.00 L an hour, £2.50 an hour',
     /Hours run since50\.0/.test(s) && /Litres per hour2\.00/.test(s) && /Cost per hour£2\.50/.test(s), s);
  s = await sec('coal');
  ok('Coal: 4 × 25 kg, 100 kg, £54.00, £0.54 a kg', /4 × 25 kg/.test(s) && /100 kg/.test(s)
     && /£54\.00/.test(s) && /£0\.54/.test(s), s);
  s = await sec('pumpout');
  ok('Pump out: £20.00, no Blue, 5 days, 11 nights', /£20\.00/.test(s) && /Blue includedNo/.test(s)
     && /Days since5/.test(s) && /11 nights aboard/.test(s), s);
  s = await sec('gas');
  ok('Gas: 13 kg, £3.00 a kg', /13 kg/.test(s) && /£3\.00/.test(s), s);
  s = await sec('service');
  ok('Servicing: both parts, labour, VAT and £147.00', /Oil filter · part no\. CH10929 · £12\.50/.test(s)
     && /Engine oil · £30\.00/.test(s) && /Parts£42\.50/.test(s) && /Total£147\.00/.test(s), s);
  ok('the purchases sit between Boat and services and Who\'s Aboard', await ev(() =>
    [...document.querySelectorAll('#logBody [data-sec]')].map(d => d.dataset.sec)
      .filter(k => ['diesel','coal','pumpout','gas','service','aboard'].includes(k)).join()
      === 'diesel,coal,pumpout,gas,service,aboard'));

  console.log('\nThe form opens what the day already has');
  await ev(() => editLog(window.__TODAY)); await settle();
  ok('every purchase box is open', await ev(() =>
    ['diesel','coal','pumpout','gas','service'].every(k => document.querySelector(`[data-bbox="${k}"]`).open)));
  ok('the total is worked out again, not stored', await ev(() =>
    document.querySelector('[data-b="diesel.total"]').value === '125.00'));
  await ev(() => { document.querySelector('[data-b="pumpout.cost"]').value='';
    window.__writes.length = 0; return saveLog(window.__TODAY); }); await settle();
  const up3 = await lastWrite('upsert', 'log_days');
  ok('emptying a purchase removes it, the rest stay', up3 && !up3.rows.buys.pumpout
     && up3.rows.buys.diesel && up3.rows.buys.service, JSON.stringify(up3 && Object.keys(up3.rows.buys)));

  // ---------------------------------------------------------------
  console.log('\nBefore step 41 has been run');
  await ev(() => { window.__rows.log_days.forEach(d => delete d.buys); });
  await ev(async () => { await loadLog(); editLog(window.__TODAY); }); await settle();
  ok('each purchase says to run step 41', await ev(() =>
    !document.querySelector('[data-bbox]') && /contacts-step41\.sql/.test($('logForm').textContent)));
  await ev(() => { window.__writes.length = 0; return saveLog(window.__TODAY); }); await settle();
  const up4 = await lastWrite('upsert', 'log_days');
  ok('and the day still saves, without the purchases', up4 && !('buys' in up4.rows), JSON.stringify(up4 && up4.rows).slice(0,120));

  // ---------------------------------------------------------------
  console.log('\nShared logs');
  await ev(() => {
    window.__rows.log_days.push({id:20, created_by:'sandra', on_date:window.__TODAY,
      diary_notes:'Sandra private note', regular_chores:'Hoovered', buys:{}});
    window.__rows.log_shares = [{owner_id:'sandra', viewer_id:'me', can_edit:true, can_delete:false, hidden:['day']}];
  });
  await ev(() => switchLog('sandra')); await settle();
  ok('a log that hid The day hides Notes too', await ev(() =>
    !/Sandra private note/.test($('logBody').textContent) && !/Hoovered/.test($('logBody').textContent)));
  await ev(() => { window.__rows.log_shares[0].hidden = ['notes']; });
  await ev(() => switchLog('sandra')); await settle();
  ok('Notes can be hidden on their own', await ev(() =>
    !/Sandra private note/.test($('logBody').textContent) && /Hoovered/.test($('logBody').textContent)));
  await ev(() => switchLog(null)); await settle();

  // ---------------------------------------------------------------
  console.log('\nSettings');
  ok('three new choice lists under Daily Log', await ev(() => {
    const g = SET_GROUPS.find(x => x.label==='Daily Log').cards;
    return ['coal_type','gas_bottle','service_kind'].every(k => g.includes(k) && SET_CARDS.includes(k) && SET_LABEL[k]);
  }));
  await ev(() => { window.__rows.log_days.forEach(d => { d.buys = d.buys || {}; });
    window.__rows.log_options = [
    {id:1, created_by:'me', kind:'gas_bottle', name:'6 kg', sort_order:1},
    {id:2, created_by:'me', kind:'gas_bottle', name:'13 kg', sort_order:2}]; });
  await ev(async () => { await loadLog(); editLog(window.__TODAY); }); await settle();
  ok('your own bottle sizes replace the 13 kg', await ev(() =>
    [...document.querySelectorAll('[data-b="gas.size"] option')].map(o => o.value).join()==='6 kg,13 kg'));

  ok('no errors on the page', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
