// The two apps must be plainly different things to a phone. This is the exact
// mistake that made Chrome say "already installed" and reuse the wrong icon.
const fs=require('fs'), path=require('path');
const R=path.join(__dirname,'..');   // the repository, whatever it is checked out as
let pass=0,fail=0;
const ok=(w,c,e='')=>{ if(c){pass++;console.log('  ✓ '+w);}else{fail++;console.log('  ✗ '+w+(e?'  <- '+e:''));} };

const main=JSON.parse(fs.readFileSync(path.join(R,'manifest.json'),'utf8'));
const jot =JSON.parse(fs.readFileSync(path.join(R,'jot/manifest.json'),'utf8'));

// how a browser works them out, given the site sits at /Contacts/
const ORIGIN='https://shared-contacts.github.io';
const abs=(base,v)=>new URL(v,base).href;
const mainBase=ORIGIN+'/manifest.json'.replace('/manifest.json','/Contacts/manifest.json');
const jotBase =ORIGIN+'/Contacts/jot/manifest.json';

console.log('\nThe two apps are different apps');
const mainId=abs(ORIGIN+'/',main.id), jotId=abs(ORIGIN+'/',jot.id);
ok('they have different identities', mainId!==jotId, mainId+' vs '+jotId);
ok('the main app keeps the identity it already had',
   mainId===ORIGIN+'/Contacts/', mainId);
ok('the jotter has its own', jotId===ORIGIN+'/Contacts/jot/', jotId);

const jotStartHref=()=>abs(jotBase,jot.start_url);
const mainScope=abs(mainBase,main.scope), jotScope=abs(jotBase,jot.scope);
ok('they have different scopes', mainScope!==jotScope, mainScope+' vs '+jotScope);
// This is the whole point. Android refuses to install a second app at an
// address inside an existing app's scope, so neither may contain the other.
ok('the main app does not claim the jotter\'s address',
   !jotStartHref().startsWith(mainScope), mainScope+' vs '+jotStartHref());
ok('and the jotter does not claim the main app\'s',
   !abs(mainBase,main.start_url).startsWith(jotScope), jotScope);
ok('neither scope contains the other',
   !jotScope.startsWith(mainScope) && !mainScope.startsWith(jotScope),
   mainScope+' / '+jotScope);

const mainStart=abs(mainBase,main.start_url), jotStart=abs(jotBase,jot.start_url);
ok('they open at different addresses', mainStart!==jotStart, mainStart+' vs '+jotStart);
ok('each starts inside its own scope',
   mainStart.startsWith(mainScope) && jotStart.startsWith(jotScope),
   mainStart+' in '+mainScope+' | '+jotStart+' in '+jotScope);

console.log('\nDifferent names and colours, so they read differently too');
ok('different names', main.name!==jot.name, main.name+' / '+jot.name);
ok('different short names', main.short_name!==jot.short_name);
ok('different theme colours', main.theme_color!==jot.theme_color,
   main.theme_color+' / '+jot.theme_color);

console.log('\nEvery icon a manifest names is actually there');
const check=(m,dir,label)=>{
  m.icons.forEach(i=>{
    const f=path.join(R,dir,i.src);
    ok(label+' icon '+i.src+' exists', fs.existsSync(f), f);
  });
  ok(label+' has a maskable one',
     m.icons.some(i=>/maskable/.test(i.purpose||'')));
  ok(label+' has both 192 and 512',
     m.icons.some(i=>i.sizes==='192x192') && m.icons.some(i=>i.sizes==='512x512'));
};
check(main,'.','main app');
check(jot,'jot','jotter');

console.log('\nThe icons are not the same pictures');
const read=f=>fs.readFileSync(path.join(R,f));
ok('the 192s differ', !read('icon-192-v2.png').equals(read('jot/icon-192.png')));
ok('the 512s differ', !read('icon-512-v2.png').equals(read('jot/icon-512.png')));

console.log('\nThe jotter can look after itself');
ok('it has its own service worker', fs.existsSync(path.join(R,'jot/sw.js')));
const jotHtml=fs.readFileSync(path.join(R,'jot/index.html'),'utf8');
ok('and registers that one, not the one a level up',
   /navigator\.serviceWorker\.register\('sw\.js'\)/.test(jotHtml));
ok('it points at its own manifest',
   /<link rel="manifest" href="manifest\.json">/.test(jotHtml));
ok('and its own apple icon',
   /<link rel="apple-touch-icon" href="apple-touch-icon\.png">/.test(jotHtml));

console.log('\nNothing is left pointing at the old address');
const idx=fs.readFileSync(path.join(R,'index.html'),'utf8');
ok('the main app links to the folder, not the old page',
   !/href='jot\.html'|jot\.html['"]/.test(idx), (idx.match(/jot\.html/g)||[]).join(','));
ok('the old address still redirects, for anything that remembers it',
   /location\.replace\('jot\/'\)/.test(fs.readFileSync(path.join(R,'jot.html'),'utf8')));

console.log('\nLinks out of the jotter go up a level');
ok('the full app', /href="\.\.\/index\.html"/.test(jotHtml));
ok('and a contact within it', /\.\.\/index\.html#contact=/.test(jotHtml));

console.log('\n'+'='.repeat(52));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
