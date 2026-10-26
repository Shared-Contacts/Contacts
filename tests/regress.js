// Opens every screen in the app and watches for anything breaking.
const { chromium } = require('playwright');
const path=require('path'); const DIR=__dirname;
const errs=[];
(async()=>{
  const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errs.push('PAGE ERROR: '+e.message));
  p.on('console',m=>{ const t=m.text();
    if(m.type()==='error' && !/ERR_FILE_NOT_FOUND|ERR_TUNNEL|ServiceWorker|geojson/i.test(t))
      errs.push('CONSOLE: '+t); });
  await p.goto('file://'+path.join(DIR,'boot.html'));
  await p.waitForTimeout(900);

  const screens=[
    ['home',       ()=>showHome&&showHome()],
    ['contacts',   ()=>hideHome()],
    ['daily log',  ()=>openLog()],
    ['calendar',   ()=>openDiary()],
    ['shopping',   ()=>openShop()],
    ['where',      ()=>openWhere()],
    ['wishlist',   ()=>openWish()],
    ['recipes',    ()=>openRecipes()],
    ['messages',   ()=>openChats()],
    ['sent to you',()=>openOffers()],
    ['import/export',()=>openIO()],
    ['finances',   ()=>openMoney()],
    ['reconcile',  ()=>openRecon()],
    ['bank import',()=>openImport()],
    ['settings',   ()=>openSettings()],
    ['help',       ()=>openHelp()]
  ];
  for(const [name,fn] of screens){
    const before=errs.length;
    try{ await p.evaluate(fn); }catch(e){ errs.push(name+': '+e.message); }
    await p.waitForTimeout(350);
    const got=errs.length-before;
    console.log((got?'  ✗ ':'  ✓ ')+name+(got?'  ('+got+' error'+(got>1?'s':'')+')':''));
  }
  // and every home-screen tile actually goes somewhere
  const bad=await p.evaluate(()=>Object.entries(TILE_DEST)
    .filter(([k,v])=>typeof v.go!=='function').map(([k])=>k));
  console.log(bad.length?'  ✗ tiles with no destination: '+bad.join(', ')
                        :'  ✓ every tile has somewhere to go');
  await b.close();
  console.log('\n'+(errs.length?errs.length+' problem(s):':'No errors across any screen.'));
  [...new Set(errs)].forEach(e=>console.log('  '+e));
  process.exit(errs.length?1:0);
})();
