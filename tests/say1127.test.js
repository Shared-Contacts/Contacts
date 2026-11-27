// 27 Nov 2026 (version 2026.11.27.3), ML429: a microphone beside What is
// needed? on MY Shopping. Say "milk, bread and eggs" and each thing comes up
// on its own line to check and put right, then Add these puts them all on the
// list: not twice, back out of the trolley, each in its usual aisle.
// The phone's speech to text is played by a stand-in here, so the test says
// what was "heard". Run as an Android phone, as Barry's is.
// Also ML428: a Global Player link shared from LBC
// (share-lbc.globalplayer.com/...) is handed to the Global Player app as the
// www.globalplayer.com page it passes on to.
const { chromium } = require('playwright');
const path = require('path');
const { answerLkAsks } = require('./lkask');
const errors = []; let pass = 0, fail = 0;
const ok = (w, c, e = '') => { if (c) { pass++; console.log('  ✓ ' + w); }
  else { fail++; console.log('  ✗ ' + w + (e ? '  <- ' + e : '')); } };
const quiet = /ERR_FILE_NOT_FOUND|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_FAILED|ServiceWorker|signed\.test|font|Failed to fetch|Failed to load resource|gstatic|nominatim|bsky|open-meteo|PGRST202|does not exist|^\[object Object\]$/i;
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; CPH2649) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ANDROID });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !quiet.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.route(/gov\.uk|bsky\.app|bsky\.social|open-meteo|nominatim/, r => r.abort());
  // No speech to text until the test gives the page its stand-in.
  await p.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await p.goto('file://' + path.join(__dirname, 'boot.html'));
  await p.waitForTimeout(900);
  await answerLkAsks(p, () => true);
  if (await p.$('#noticeX')) { await p.click('#noticeX'); await p.waitForTimeout(300); }
  const ev = (f, a) => p.evaluate(f, a);
  const settle = (ms = 300) => p.waitForTimeout(ms);
  await ev(() => { WX_OFF = true; BSKY_OFF = true; if (typeof bskyApply === 'function') bskyApply(); });
  ok('running as an Android phone', await ev(() => ON_ANDROID && ON_PHONE));

  const toasts = () => ev(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent));
  const noToasts = () => ev(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
  const shown = id => ev(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  const lines = () => ev(() => [...document.querySelectorAll('#sHeard [data-sayi]')].map(i => i.value));
  const btns = () => ev(() => [...document.querySelectorAll('#sHeard .saybtns button')].map(b => b.textContent.trim()));

  await ev(() => {
    window.__rows.shopping_lists = [{ id: 1, owner_id: 'me', name: 'Supermarket',
      aisles: [{ id: 'a1', name: 'Dairy' }, { id: 'a2', name: 'Bakery' }] },
      { id: 2, owner_id: 'me', name: 'Chemist', aisles: [] }];
    window.__rows.shopping_list_shares = [];
    window.__rows.shopping = [
      { id: 1, list_id: 1, created_by: 'me', name: 'Apples', got: false, sort_order: 101 },
      { id: 2, list_id: 1, created_by: 'me', name: 'Milk', got: true, got_at: '2026-11-26T10:00:00Z', sort_order: 140 }];
    window.__rows.shopping_aisle_memory = [{ list_id: 1, name: 'eggs', aisle: 'a1' }];
  });

  // ---------------------------------------------------------------
  console.log('\nWhere the phone has no speech to text, nothing changes');
  await ev(() => openShop()); await settle(600);
  ok('no microphone', await ev(() => !$('sSay') && !document.querySelector('.sayrow')));
  ok('  and What is needed?, How much and Add it as before', await ev(() =>
    !!$('sName') && !!$('sQty') && !!$('sAdd') && !!$('sAisle')));

  // ---------------------------------------------------------------
  console.log('\nSplitting what was heard into things');
  const split = t => ev(t => sayItems(t), t);
  const cases = [
    ['milk, bread and eggs', 'Milk|Bread|Eggs'],
    ['add milk, bread and eggs to the shopping list please', 'Milk|Bread|Eggs'],
    ['salt and vinegar crisps and apples', 'Salt and vinegar crisps|Apples'],
    ['fish and chips', 'Fish and chips'],
    ['some bananas then a lemon also Heinz beans plus 6 eggs', 'Bananas|Lemon|Heinz beans|6 eggs'],
    ['toilet roll comma bin bags', 'Toilet roll|Bin bags'],
    ['milk and Milk', 'Milk'],
    ['', ''],
  ];
  for (const [said, want] of cases) {
    const got = (await split(said)).join('|');
    ok(`"${said}" is ${want ? want.split('|').length : 'no'} thing${want.split('|').length === 1 && want ? '' : 's'}: ${want || '(none)'}`, got === want, got);
  }

  // ---------------------------------------------------------------
  console.log('\nThe microphone');
  await ev(() => {
    window.__recs = [];
    window.webkitSpeechRecognition = class {
      constructor() { window.__recs.push(this); }
      start() { this.started = true; }
      stop() { this.stopped = true; setTimeout(() => this.onend && this.onend(), 0); }
      abort() { this.aborted = true; }
    };
    const cur = () => window.__recs[window.__recs.length - 1];
    window.__hear = (t, fin = true) => { const res = [{ transcript: t }]; res.isFinal = fin; cur().onresult({ results: [res], resultIndex: 0 }); };
    window.__end = () => cur().onend();
    window.__err = e => { cur().onerror({ error: e }); cur().onend(); };
  });
  await ev(() => openShop()); await settle(600);
  ok('a microphone beside What is needed?', await ev(() => {
    const m = $('sSay').getBoundingClientRect(), i = $('sName').getBoundingClientRect();
    return m.left >= i.right && Math.abs(m.top - i.top) < 4 && m.width === 46;
  }));
  ok('  it says what it is for', await ev(() => $('sSay').getAttribute('aria-label') === 'Say what is needed'));
  for (const w of [320, 412]) {
    await p.setViewportSize({ width: w, height: 844 }); await settle(200);
    ok(`  it fits at ${w} wide`, await ev(() => {
      const c = $('sSay').closest('.card').getBoundingClientRect(), m = $('sSay').getBoundingClientRect(),
        i = $('sName').getBoundingClientRect();
      return m.right <= c.right - 10 && i.width > 180 && document.documentElement.scrollWidth <= innerWidth;
    }));
  }
  await p.setViewportSize({ width: 390, height: 844 }); await settle(200);

  await p.click('#sSay'); await settle(100);
  ok('a tap starts it listening, in British English', await ev(() => {
    const r = window.__recs[0]; return window.__recs.length === 1 && r.started && r.lang === 'en-GB' && r.interimResults === true;
  }));
  ok('  the microphone turns red and says Stop listening', await ev(() =>
    $('sSay').getAttribute('aria-pressed') === 'true' && $('sSay').getAttribute('aria-label') === 'Stop listening'
    && (() => { const t = document.createElement('i'); t.style.background = 'var(--red)'; document.body.appendChild(t);
      const red = getComputedStyle(t).backgroundColor; t.remove(); const s = getComputedStyle($('sSay'));
      return s.backgroundColor === red && s.color === 'rgb(255, 255, 255)'; })()));
  ok('  it says it is listening, with an example', /Listening.*milk, bread and eggs/.test(await ev(() => $('sHeard').textContent)));
  ok('  How much, the aisle and Add it step aside meanwhile', !(await shown('sQty')) && !(await shown('sAisle')) && !(await shown('sAdd')));
  await ev(() => __hear('milk bread', false)); await settle(50);
  ok('words show as they are heard', /milk bread/.test(await ev(() => $('sHeard').textContent)) && (await lines()).length === 0);
  await ev(() => { __hear('milk, bread and eggs'); __end(); }); await settle(100);
  ok('then each thing on its own line', (await lines()).join('|') === 'Milk|Bread|Eggs', (await lines()).join('|'));
  ok('  with Add these 3, Say more and Cancel', (await btns()).join('|') === 'Add these 3|Say more|Cancel', (await btns()).join('|'));
  ok('  and the microphone back to white', await ev(() => $('sSay').getAttribute('aria-pressed') === 'false'));
  ok('  Add these is a full-width button, Say more and Cancel side by side below it', await ev(() => {
    const [a, m, c] = [...document.querySelectorAll('#sHeard .saybtns button')].map(x => x.getBoundingClientRect());
    return a.bottom <= m.top && Math.abs(m.top - c.top) < 2 && m.right <= c.left && a.width > m.width * 1.8;
  }));

  await p.fill('#sHeard [data-sayi="1"]', 'Brown bread');
  await p.click('#sHeard [data-sayx="2"]'); await settle(50);
  ok('a word can be put right and a thing left out', (await lines()).join('|') === 'Milk|Brown bread', (await lines()).join('|'));
  ok('  Add these 2', (await btns())[0] === 'Add these 2');

  await p.click('#sayMore'); await settle(50);
  ok('Say more listens again and keeps what was heard', await ev(() => window.__recs.length === 2 && window.__recs[1].started)
    && (await lines()).join('|') === 'Milk|Brown bread');
  ok('  "say what else is needed"', /say what else is needed/.test(await ev(() => $('sHeard').textContent)));
  ok('  no buttons while it listens', (await btns()).length === 0);
  await ev(() => { __hear('eggs and apples and milk'); __end(); }); await settle(100);
  ok('  the new ones are added below, and milk not twice', (await lines()).join('|') === 'Milk|Brown bread|Eggs|Apples', (await lines()).join('|'));

  // Switching to another list and back keeps what was heard.
  await ev(() => { CUR_LIST = 2; renderShop(); CUR_LIST = 1; renderShop(); });
  ok('what was heard stays while the screen is drawn again', (await lines()).length === 4);

  await ev(() => { window.__writes = []; }); await noToasts();
  await p.click('#sayAdd'); await settle(400);
  const w = await ev(() => window.__writes);
  const ins = w.filter(x => x.op === 'insert' && x.table === 'shopping').map(x => x.rows);
  ok('Add these puts the new ones on the list', ins.map(r => r.name).join('|') === 'Brown bread|Eggs', JSON.stringify(ins));
  ok('  eggs in Dairy, where they went last time; brown bread not sorted yet',
    ins[1] && ins[1].aisle === 'a1' && ins[0] && !('aisle' in ins[0]));
  ok('  on this list, as mine, after everything already on it', ins.every(r => r.list_id === 1 && r.created_by === 'me' && r.qty === null)
    && ins[0].sort_order === 141 && ins[1].sort_order === 142);
  ok('  milk comes back out of the trolley', w.some(x => x.op === 'update' && x.table === 'shopping'
    && x.patch.got === false && JSON.stringify(x.where) === '[["eq","id",2]]'));
  ok('  apples, already on it, are not added again', !ins.some(r => r.name === 'Apples'));
  ok('  it says so', (await toasts()).includes('Supermarket: 2 added, 1 put back on, 1 already on it'), (await toasts()).join(' / '));
  ok('  and the lines go, with How much and Add it back', (await lines()).length === 0 && await shown('sQty') && await shown('sAdd'));

  console.log('\nStopping, nothing heard, and saying no to the microphone');
  await noToasts();
  await p.click('#sSay'); await settle(50); await p.click('#sSay'); await settle(100);
  ok('a second tap stops it listening', await ev(() => window.__recs[window.__recs.length - 1].stopped === true
    && $('sSay').getAttribute('aria-pressed') === 'false'));
  ok('  nothing heard: it says so, and nothing is left open', (await toasts()).some(t => /Nothing heard/.test(t)) && (await lines()).length === 0
    && await shown('sAdd'));
  await noToasts();
  await p.click('#sSay'); await settle(50); await ev(() => __err('not-allowed')); await settle(100);
  ok('the microphone not allowed: it says where to allow it', (await toasts()).some(t => /isn’t allowed to use the microphone.*settings/.test(t)),
    (await toasts()).join(' / '));
  await noToasts();
  await p.click('#sSay'); await settle(50); await ev(() => __err('network')); await settle(100);
  ok('no signal: it says it needs one', (await toasts()).some(t => /needs a signal/.test(t)));

  console.log('\nCancel, and coming back to Shopping');
  await p.click('#sSay'); await settle(50); await ev(() => { __hear('bananas and pears'); __end(); }); await settle(100);
  await p.click('#sayCancel'); await settle(100);
  ok('Cancel forgets what was heard and adds nothing', (await lines()).length === 0
    && !(await ev(() => window.__writes.some(x => x.op === 'insert' && /Bananas|Pears/.test(JSON.stringify(x.rows))))));
  await p.click('#sSay'); await settle(50); await ev(() => { __hear('bananas'); });
  await ev(() => openShop()); await settle(500);
  ok('opening Shopping again starts afresh, not listening', (await lines()).length === 0
    && await ev(() => window.__recs[window.__recs.length - 1].aborted === true && $('sSay').getAttribute('aria-pressed') === 'false'));

  console.log('\nTyping still works as before');
  await ev(() => { window.__writes = []; });
  await p.fill('#sName', 'Bread'); await p.fill('#sQty', '2 loaves'); await p.selectOption('#sAisle', 'a2');
  await p.click('#sAdd'); await settle(400);
  const typed = await ev(() => window.__writes.filter(x => x.op === 'insert' && x.table === 'shopping').map(x => x.rows));
  ok('What is needed?, How much and the aisle, then Add it', typed.length === 1 && typed[0].name === 'Bread'
    && typed[0].qty === '2 loaves' && typed[0].aisle === 'a2', JSON.stringify(typed));

  console.log('\nML428: Global Player links shared from LBC');
  const SHARE = 'https://share-lbc.globalplayer.com/podcasts/42L26D/', WWW = 'https://www.globalplayer.com/podcasts/42L26D/';
  const gp = await ev(([s, w]) => ({
    app: linkAppFor(s),
    share: linkHref({ url: s, open_with: 'globalplayer' }),
    www: linkHref({ url: w, open_with: 'globalplayer' }),
    phone: linkHref({ url: s, open_with: '' }),
    lbc: linkHref({ url: s, open_with: 'lbc' }),
    ep: epHref({ url: s, open_with: 'globalplayer' }, { guid: 'x', link: '', t: 'An episode' }, 'A podcast').href,
  }), [SHARE, WWW]);
  const wantGp = 'intent://www.globalplayer.com/podcasts/42L26D/#Intent;scheme=https;package=com.global.player;S.browser_fallback_url='
    + encodeURIComponent(WWW) + ';end';
  ok('a share-lbc.globalplayer.com link gets Global Player by itself', gp.app === 'globalplayer', gp.app);
  ok('  and the app is handed the www.globalplayer.com page', gp.share === wantGp, gp.share);
  ok('  the same as a www.globalplayer.com link always was', gp.www === wantGp, gp.www);
  ok('  an episode of it opens the podcast the same way', gp.ep === wantGp, gp.ep);
  ok('  Phone decides still opens the link as it was saved', gp.phone === SHARE, gp.phone);
  ok('  and the LBC app is still handed the link itself', /^intent:\/\/share-lbc\.globalplayer\.com\/podcasts\/42L26D\/#Intent;scheme=https;package=com\.thisisglobal\.player\.lbc;/.test(gp.lbc), gp.lbc);

  console.log('\nHelp');
  // Help is drawn from the page when it is opened, so read it from index.html.
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const help = src.slice(src.indexOf('<h4 id="h-shop">'), src.indexOf('<h4 id="h-messages">'))
    .replace(/<[^>]+>/g, '').replace(/&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ');
  ok('Help > Shopping list explains Say it', /Say it\. Tap the microphone beside What is needed\?/.test(help)
    && /Add these/.test(help) && /needs a signal/.test(help), help.slice(0, 200));

  console.log('\nThe version');
  const vj = require('../version.json');
  const V = vj.history.find(h => h.version === '2026.11.27.3');
  ok('2026.11.27.3 is in version.json, and the page is the newest', !!V && await ev(() => APP_VERSION) === vj.version && vj.history[0].version === vj.version);
  ok('  two lines for What\'s new, each short enough', V && V.changes.length === 2 && V.changes.every(x => x.length < 160), V && V.changes.map(x => x.length).join());

  console.log('\nErrors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  ok('no page errors', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
