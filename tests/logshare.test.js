// Sharing a Daily Log: one person shares theirs with another, on their terms.
// The thing being protected above all is that two logs never get mixed up:
// once a log is shared the database hands back both, so every fetch and every
// save has to say whose log it means.
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
  // A real, tiny picture, for the signed photo links and for uploading.
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8v379fwAJcAPZx0cKRAAAAABJRU5ErkJggg==';
  await page.route('https://signed.test/**', r => r.fulfill({ status:200, contentType:'image/png',
    body: Buffer.from(PNG, 'base64') }));
  page.on('console', m => { const t = m.text();
    if (m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker/i.test(t))
      errors.push('CONSOLE: ' + t); });
  await page.goto('file://' + path.join(__dirname, 'boot.html'));
  await page.waitForTimeout(900);

  const ev = (f, a) => page.evaluate(f, a);
  const settle = () => page.waitForTimeout(350);
  const lastWrite = (op, table) => ev(([op, table]) =>
    window.__writes.filter(w => w.op===op && w.table===table).pop() || null, [op, table]);
  const whereOf = w => Object.fromEntries((w && w.where || [])
    .filter(x => x[0]==='eq').map(x => [x[1], x[2]]));

  // Two logs side by side in the same table, as the database will return them
  // once Sandra's is shared with me.
  await ev(() => {
    const today = isoDay(new Date());
    window.__TODAY = today;
    window.__rows.log_days = [
      {id:1, created_by:'me',     on_date:today, diary_notes:'My own day', am_sys:120, am_dia:80,
       photos:[{path:'log/me/a.jpg'}]},
      {id:2, created_by:'sandra', on_date:today, diary_notes:'Sandra’s day', am_sys:131, am_dia:85,
       photos:[{path:'log/sandra/b.jpg'},{path:'log/sandra/c.jpg'}]},
    ];
    window.__rows.log_cats = [{id:7, created_by:'sandra', label:'Sewing', sort_order:100},
                              {id:8, created_by:'me', label:'Fishing', sort_order:100}];
    window.__rows.log_fields = [{id:70, created_by:'sandra', cat_id:7, label:'Stitches', kind:'number', choices:[], sort_order:1}];
    window.__rows.log_options = [];
    window.__rows.log_shares = [];
  });

  // ---------------------------------------------------------------
  console.log('\nNothing shared');
  await ev(() => openLog()); await settle();
  ok('my log shows my day', await ev(() => /My own day/.test($('logBody').textContent)));
  ok('and nothing of Sandra’s, though the table holds it', await ev(() =>
    !/Sandra’s day/.test($('logBody').textContent) && LOGDAYS.every(d => d.created_by==='me')));
  ok('only my own sections are loaded', await ev(() => LOGCATS.length===1 && LOGCATS[0].label==='Fishing'));
  ok('no choice of log at the top', (await page.$$('[data-logwho]')).length === 0);

  // ---------------------------------------------------------------
  console.log('\nSandra shares hers with me: can change it, cannot remove photos, blood pressure hidden');
  await ev(() => { window.__rows.log_shares = [
    {owner_id:'sandra', viewer_id:'me', can_edit:true, can_delete:false, hidden:['bp']}]; });
  await ev(() => openLog()); await settle();
  ok('it still opens on my own log', await ev(() => logIsMine() && /My own day/.test($('logBody').textContent)));
  const btns = await ev(() => [...document.querySelectorAll('[data-logwho]')].map(b => b.textContent.trim()));
  ok('buttons for my log and hers', JSON.stringify(btns) === JSON.stringify(['My log','Sandra’s']), JSON.stringify(btns));

  await page.click('[data-logwho="sandra"]'); await settle();
  ok('tapping hers shows her day', await ev(() => /Sandra’s day/.test($('logBody').textContent)));
  ok('and only her days are loaded', await ev(() => LOGDAYS.length && LOGDAYS.every(d => d.created_by==='sandra')));
  ok('with her own sections', await ev(() => LOGCATS.length===1 && LOGCATS[0].label==='Sewing'));
  ok('it says whose log it is', await ev(() => /Sandra’s\s+log, shared with you/.test($('logBody').textContent)));
  ok('the blood pressure she hid is not shown', await ev(() =>
    !document.querySelector('#logBody [data-sec="bp"]') && !/131/.test($('logBody').textContent)));
  ok('Edit is there, because she lets me change it', await ev(() => !$('logEditTop').classList.contains('hidden')));
  ok('photos can be added', (await page.$$('#logAddPhoto')).length === 1);
  ok('but not removed', (await page.$$('[data-rmlogphoto]')).length === 0);
  ok('the star to choose the main photo is there', (await page.$$('[data-mainphoto]')).length === 1);

  console.log('\nFilling in her day');
  await ev(() => editLog(window.__TODAY)); await settle();
  ok('the form has no blood pressure either', await ev(() => !$('logForm').elements['am_sys']));
  ok('the title says whose day it is', await ev(() => /^Sandra/.test($('logEdTitle').textContent)));
  await ev(() => { window.__writes.length = 0;
    $('logForm').elements['diary_notes'].value = 'Added by Barry'; });
  await ev(() => saveLog(window.__TODAY)); await settle();
  const up = await lastWrite('upsert', 'log_days');
  ok('it is saved to HER log, not mine', up && up.rows.created_by==='sandra'
     && up.rows.diary_notes==='Added by Barry', JSON.stringify(up && up.rows).slice(0,160));
  ok('and the hidden blood pressure is left alone', up && !('am_sys' in up.rows) && !('am_dia' in up.rows));

  console.log('\nPhotos');
  await ev(() => { window.__writes.length = 0; });
  await ev(png => {
    const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
    return addLogPhotos([new File([bytes], 'x.png', {type:'image/png'})]);
  }, PNG);
  await page.waitForTimeout(900);
  const upl = await ev(() => window.__writes.find(w => w.op==='upload') || null);
  ok('a photo goes into her folder', upl && /^log\/sandra\//.test(upl.path), JSON.stringify(upl));
  const pu = await lastWrite('update', 'log_days');
  ok('and onto her day', pu && whereOf(pu).created_by==='sandra', JSON.stringify(pu && pu.where));
  await ev(() => { window.__writes.length = 0; window.confirm = () => true; });
  await ev(() => removeLogPhoto('log/sandra/b.jpg')); await settle();
  ok('removing one is refused, as she has not allowed it', await ev(() =>
    !window.__writes.some(w => w.op==='rmfile' || w.op==='update')));

  // ---------------------------------------------------------------
  console.log('\nLook only, and photos hidden too');
  await ev(() => { window.__rows.log_shares = [
    {owner_id:'sandra', viewer_id:'me', can_edit:false, can_delete:false, hidden:['bp','photos']}]; });
  await ev(async () => { await loadLog(); renderLog(); }); await settle();
  ok('no Edit button', await ev(() => $('logEditTop').classList.contains('hidden')));
  ok('it says I can only look', await ev(() => /You can look, but not change it/.test($('logBody').textContent)));
  ok('no photo section and no big photo at the top', await ev(() =>
    !document.querySelector('#logBody [data-sec="photos"]') && !document.querySelector('#logBody .hero')));
  await ev(() => { window.__writes.length = 0; $('logEd').classList.add('hidden'); });
  await ev(() => editLog(window.__TODAY)); await settle();
  ok('opening the editor is refused', await ev(() => $('logEd').classList.contains('hidden')));
  await ev(() => { LOG_DATE = '2020-01-01'; renderLog(); });
  ok('a blank day offers no Start button', (await page.$$('#logStart')).length === 0);
  await ev(async () => { window.__writes.length = 0; await ensureToday(); });
  ok('and nothing is started in her log just by looking', await ev(() =>
    !window.__writes.some(w => w.op==='insert' && w.table==='log_days')));

  // ---------------------------------------------------------------
  console.log('\nSettings is always about my own log');
  await ev(() => { LOG_DATE = window.__TODAY; renderLog(); });
  await ev(() => openSettings('Daily Log')); await settle();
  ok('opening Settings puts my own log back', await ev(() => logIsMine()
    && LOGDAYS.every(d => d.created_by==='me') && LOGCATS[0].label==='Fishing'));
  ok('and the Daily Log underneath shows mine again', await ev(() => /My own day/.test($('logBody').textContent)));

  console.log('\nSharing my own log');
  await ev(() => { document.querySelectorAll('[data-setcard="logshare"]').forEach(d => d.open = true); });
  ok('there is a Share my log card', (await page.$$('[data-setcard="logshare"]')).length === 1);
  const people = await ev(() => [...document.querySelectorAll('[data-lshare]')].map(b => b.dataset.lshare));
  ok('everybody else is listed, one at a time', JSON.stringify(people) === JSON.stringify(['sandra','other']), JSON.stringify(people));
  ok('and nobody is shared with yet', await ev(() =>
    [...document.querySelectorAll('[data-lshare]')].every(b => b.getAttribute('aria-pressed')==='false')));
  await ev(() => { window.__writes.length = 0; });
  await page.click('[data-lshare="sandra"]'); await settle();
  const ins = await lastWrite('insert', 'log_shares');
  ok('ticking Sandra shares it with her and nobody else', ins && ins.rows.owner_id==='me'
     && ins.rows.viewer_id==='sandra', JSON.stringify(ins && ins.rows));

  await ev(() => { window.__rows.log_shares.push(
    {owner_id:'me', viewer_id:'sandra', can_edit:true, can_delete:false, hidden:[]}); });
  await ev(async () => { await loadLog(); await openSettings('Daily Log'); }); await settle();
  await ev(() => { document.querySelectorAll('[data-setcard="logshare"]').forEach(d => d.open = true); });
  ok('she now shows as shared', await ev(() =>
    document.querySelector('[data-lshare="sandra"]').getAttribute('aria-pressed')==='true'));
  ok('with her choices: change on, remove photos off', await ev(() =>
    document.querySelector('[data-lsedit="sandra"]').checked && !document.querySelector('[data-lsdel="sandra"]').checked));
  ok('my own section is among those I can hide', await ev(() =>
    !!document.querySelector('[data-lshide="sandra"][value="c8"]')));
  ok('nothing to set for somebody I have not shared with', (await page.$$('[data-lsedit="other"]')).length === 0);

  await ev(() => { window.__writes.length = 0;
    const b = document.querySelector('[data-lshide="sandra"][value="medication"]');
    b.checked = true; b.dispatchEvent(new Event('change')); });
  await settle();
  let w = await lastWrite('update', 'log_shares');
  ok('hiding Medication from her saves just that', w && JSON.stringify(w.patch)==='{"hidden":["medication"]}'
     && whereOf(w).owner_id==='me' && whereOf(w).viewer_id==='sandra', JSON.stringify(w));
  await ev(() => { window.__writes.length = 0;
    const b = document.querySelector('[data-lsdel="sandra"]');
    b.checked = true; b.dispatchEvent(new Event('change')); });
  await settle();
  w = await lastWrite('update', 'log_shares');
  ok('letting her remove photos', w && w.patch.can_delete===true && whereOf(w).viewer_id==='sandra', JSON.stringify(w));

  await ev(() => { window.__writes.length = 0; window.confirm = () => true; });
  await page.click('[data-lshare="sandra"]'); await settle();
  w = await lastWrite('delete', 'log_shares');
  ok('tapping Shared again stops it, for her only', w && whereOf(w).owner_id==='me'
     && whereOf(w).viewer_id==='sandra', JSON.stringify(w));

  // ---------------------------------------------------------------
  console.log('\nShe stops sharing while I am looking');
  await ev(() => { $('settings').classList.add('hidden');
    window.__rows.log_shares = [{owner_id:'sandra', viewer_id:'me', can_edit:true, can_delete:false, hidden:[]}]; });
  await ev(() => switchLog('sandra')); await settle();
  ok('I am on hers', await ev(() => !logIsMine()));
  await ev(() => { window.__rows.log_shares = []; });
  await ev(async () => { await loadLog(); renderLog(); }); await settle();
  ok('next time it loads, I am back on my own', await ev(() => logIsMine()
    && LOGDAYS.every(d => d.created_by==='me') && /My own day/.test($('logBody').textContent)));
  ok('and the choice of log has gone', (await page.$$('[data-logwho]')).length === 0);

  console.log('\nBefore step 39 has been run');
  await ev(() => { delete window.__rows.log_shares; });
  await ev(() => {
    const real = window.supabase; // the table is missing: the stub answers with an error
    const from = sb.from.bind(sb);
    sb.from = t => t==='log_shares'
      ? { select: () => Promise.resolve({ data:null, error:{ message:'relation "log_shares" does not exist' } }) }
      : from(t);
  });
  await ev(async () => { await loadLog(); await openSettings('Daily Log'); }); await settle();
  ok('the Daily Log carries on as before', await ev(() => /My own day/.test($('logBody').textContent)));
  ok('and Settings says which step to run', await ev(() =>
    /contacts-step39\.sql/.test(document.querySelector('[data-setcard="logshare"]').textContent)));

  await browser.close();
  console.log('\n' + '='.repeat(52));
  console.log(`${pass} passed, ${fail} failed`);
  console.log(errors.length ? errors.length + ' page error(s):' : 'No page errors.');
  [...new Set(errors)].slice(0, 8).forEach(e => console.log('  ' + e));
  process.exit(fail || errors.length ? 1 : 0);
})();
