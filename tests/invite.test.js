// The welcome email: the form that writes the sign-in instructions for
// somebody new, and who is allowed to see it.
const { chromium } = require('playwright');
const path = require('path');

const errors = [];
let pass = 0, fail = 0;
const ok = (what, cond, extra='') => {
  if (cond) { pass++; console.log('  ✓ ' + what); }
  else { fail++; console.log('  ✗ ' + what + (extra ? '  <- ' + extra : '')); }
};

const beBarry = page => page.evaluate(() => {
  MY_PROFILE.display_name = 'Barry'; ME.email = 'barry.teutenberg@gmail.com'; });

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
  console.log('\nOnly the two who can make an account');
  const who = await page.evaluate(() => {
    const was = [MY_PROFILE.display_name, ME.email];
    const at = (n, m) => { MY_PROFILE.display_name = n; ME.email = m; return isOwner(); };
    const out = {
      barry: at('Barry', 'barry@x.com'),
      sandra: at('Sandra', 'sandra@x.com'),
      sandraLower: at('sandra walsh', ''),
      byEmail: at('', 'sandra@example.com'),
      other: at('Someone Else', 'else@x.com'),
      empty: at('', '')
    };
    MY_PROFILE.display_name = was[0]; ME.email = was[1];
    return out;
  });
  ok('Barry', who.barry === true);
  ok('Sandra', who.sandra === true);
  ok('whatever the capitals', who.sandraLower === true);
  ok('by the email when the name is not set', who.byEmail === true);
  ok('nobody else', who.other === false);
  ok('and not a profile with nothing in it', who.empty === false);

  const hidden = await page.evaluate(async () => {
    MY_PROFILE.display_name = 'Someone Else'; ME.email = 'else@x.com';
    openSettings('The app');
    await new Promise(r => setTimeout(r, 400));
    document.querySelectorAll('.card.logsec').forEach(d => d.open = true);
    const inMenu = () => { openMenu('home');
      const got = /Welcome email/.test($('menuBody').textContent); shutMenu(); return got; };
    return { button: document.querySelectorAll('#goInvite').length, menu: inMenu() };
  });
  ok('the way in is not on the settings card for them', hidden.button === 0);
  ok('nor in their menu', hidden.menu === false);

  const shown = await page.evaluate(async () => {
    MY_PROFILE.display_name = 'Barry'; ME.email = 'barry.teutenberg@gmail.com';
    openSettings('The app');
    await new Promise(r => setTimeout(r, 400));
    document.querySelectorAll('.card.logsec').forEach(d => d.open = true);
    openMenu('home');
    const menu = /Welcome email/.test($('menuBody').textContent);
    shutMenu();
    return { button: document.querySelectorAll('#goInvite').length, menu };
  });
  ok('but it is there for Barry, on the settings card', shown.button === 1);
  ok('and in his menu, for getting at it quickly', shown.menu === true);

  // ---------------------------------------------------------------
  console.log('\nThe form');
  await beBarry(page);
  await page.evaluate(() => { $('settings').classList.add('hidden');
    INVITE = {name:'', email:'', pw:''}; openInvite(); });
  await page.waitForTimeout(400);
  ok('it opens', await page.isVisible('#invite'));
  for (const id of ['invName', 'invMail', 'invPw']) {
    ok(id + ' is there', (await page.$$('#' + id)).length === 1);
  }
  ok('a password is made up before he asks',
     (await page.inputValue('#invPw')).length >= 8, await page.inputValue('#invPw'));
  ok('the email box asks for an email keyboard',
     (await page.getAttribute('#invMail', 'inputmode')) === 'email');
  ok('it says to set the same password in Supabase',
     /Authentication/.test(await page.textContent('#inviteBody')));
  ok('with a button that goes there', await page.evaluate(() => {
    let got = null; const real = window.open;
    window.open = u => { got = u; return null; };
    $('invUsers').click(); window.open = real;
    return got === 'https://supabase.com/dashboard/project/uloptfmzydaxymhecuub/auth/users';
  }));

  console.log('\nThe password it makes up');
  const pws = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 40; i++) out.push(madeUpPassword());
    return out;
  });
  ok('long enough for the app to accept it', pws.every(p => p.length >= 8),
     pws.find(p => p.length < 8) || '');
  ok('two words and a number, readable down the phone',
     pws.every(p => /^[a-z]+-[a-z]+-\d\d$/.test(p)), pws[0]);
  ok('never the same word twice', pws.every(p => {
    const bits = p.split('-'); return bits[0] !== bits[1]; }));
  // Real words, so an l is never mistaken for a 1. The number is what
  // needed watching: it never starts with a 0 or a 1.
  ok('lower case letters and digits, nothing else',
     pws.every(p => /^[a-z-]+\d\d$/.test(p)), pws[0]);
  ok('and the number never starts with a nought or a one',
     pws.every(p => { const n = +p.split('-')[2]; return n >= 23 && n <= 99; }),
     pws.map(p => p.split('-')[2]).sort()[0]);
  ok('and a different one each time', new Set(pws).size > 35,
     String(new Set(pws).size) + ' different out of 40');
  const another = await page.evaluate(async () => {
    const before = $('invPw').value;
    $('invNew').click();
    await new Promise(r => setTimeout(r, 100));
    return { before, after: $('invPw').value, inPreview: $('invPreview').textContent };
  });
  ok('Another makes a new one', another.after !== another.before);
  ok('and the message follows it', another.inPreview.includes(another.after));

  // ---------------------------------------------------------------
  console.log('\nThe message it writes');
  const msg = await page.evaluate(async () => {
    INVITE = { name:'Heidi Brown', email:'heidi@example.com', pw:'otter-canal-47' };
    renderInvite();
    await new Promise(r => setTimeout(r, 100));
    return $('invPreview').textContent;
  });
  ok('it greets them by their first name', msg.startsWith('Hello Heidi,'), msg.slice(0,30));
  ok('and signs off from whoever is sending it', msg.trim().endsWith('Barry'));
  ok('the address is the getting-started page, not the app itself',
     msg.includes('https://shared-contacts.github.io/Contacts/start.html'));
  ok('their email is in it', msg.includes('Email: heidi@example.com'));
  ok('so is the password', msg.includes('Password: otter-canal-47'));
  ok('it tells them to change it straight away',
     /change that password straight away/i.test(msg));
  ok('and says why', /not private until you do/i.test(msg));
  ok('it says where to do it', /three lines at the top left/i.test(msg)
     && /Your password/.test(msg));
  ok('the steps are numbered', /^1\. /m.test(msg) && /^2\. /m.test(msg)
     && /^3\. /m.test(msg));
  ok('nothing is hard-wrapped, so it reads on any screen',
     msg.split('\n').every(l => !/^\s+\S/.test(l)),
     msg.split('\n').find(l => /^\s+\S/.test(l)) || '');
  ok('somebody with no name typed in still gets a greeting',
     await page.evaluate(() => { const keep = INVITE.name; INVITE.name = '';
       const out = inviteBody().startsWith('Hello there,'); INVITE.name = keep;
       return out; }));

  console.log('\nSending it');
  await page.evaluate(() => { INVITE = { name:'Heidi Brown',
    email:'heidi@example.com', pw:'otter-canal-47' }; renderInvite(); });
  await page.waitForTimeout(200);
  await page.click('#invCopy');
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  ok('Copy puts the whole message on the clipboard',
     copied.startsWith('Hello Heidi,') && copied.includes('otter-canal-47'));

  await page.click('#invCopyPw');
  await page.waitForTimeout(400);
  ok('and the password can be copied on its own, for a text message',
     (await page.evaluate(() => navigator.clipboard.readText())) === 'otter-canal-47');

  await page.click('#invCopyNoPw');
  await page.waitForTimeout(400);
  const without = await page.evaluate(() => navigator.clipboard.readText());
  ok('the message can go without the password in it',
     !without.includes('otter-canal-47'), without.slice(0, 80));
  ok('saying where it has gone instead',
     /Password: sent to you separately/.test(without));
  ok('with everything else still there',
     without.includes('heidi@example.com') && without.includes('start.html'));

  const mailto = await page.evaluate(() => inviteMailto());
  ok('Open in email addresses it to them',
     (mailto || '').startsWith('mailto:heidi%40example.com'), mailto || 'nothing');
  ok('with the subject filled in', /subject=Your%20sign-in/.test(mailto || ''));
  ok('and the message as the body', /body=Hello%20Heidi/.test(mailto || ''));

  console.log('\nIt asks for what it needs');
  const nagged = await page.evaluate(async () => {
    INVITE = { name:'Nobody', email:'', pw:'otter-canal-47' };
    renderInvite();
    window.__toasts = []; const t = window.toast;
    window.toast = m => { window.__toasts.push(m); t(m); };
    $('invCopy').click();
    await new Promise(r => setTimeout(r, 200));
    window.toast = t;
    return window.__toasts.slice();
  });
  ok('no email address, no copy', nagged.some(m => /email address/i.test(m)),
     JSON.stringify(nagged));

  console.log('\n' + '='.repeat(52));
  console.log(pass + ' passed, ' + fail + ' failed');
  if (errors.length) { console.log('\nPage errors:'); errors.forEach(e => console.log('  ' + e)); }
  else console.log('No page errors.');
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
