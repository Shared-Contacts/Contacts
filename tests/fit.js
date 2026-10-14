// Does the page still fit the screen? The icons pushed every row off the side.
const { chromium } = require('playwright');
const path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
  let bad=0;
  for(const w of [320,360,390,414,768]){
    const p=await b.newPage({viewport:{width:w,height:844}});
    await p.goto('file://'+path.join(__dirname,'boot.html'));
    await p.waitForTimeout(800);
    await p.evaluate(()=>{
      CONTACTS.length=0;
      CONTACTS.push(
       {id:1,created_by:'me',first_name:'Heidi',last_name:'Manning',town:'Hartford, United Kingdom',
        boat_name:'The Jolly Roger',contact_groups:[],
        phones:[{label:'Mobile',value:'07700 900123'}],emails:[{label:'Home',value:'h@x.com'}],
        socials:[{label:'WhatsApp',value:'07700900123'},{label:'Facebook',value:'heidi'}]},
       {id:2,created_by:'me',first_name:'Barry',last_name:'Teutenberg',nickname:'Baz',
        town:'Malpas, United Kingdom',boat_name:'Areandare',contact_groups:[],
        phones:[{label:'Mobile',value:'07700 900999'}],emails:[{label:'Home',value:'b@x.com'}],
        socials:[{label:'WhatsApp',value:'07700900999'}]});
      TAGS={}; CONTACTS.forEach(c=>TAGS[c.id]=[]);
      VIEW='az'; applyView(); render(); hideHome();
    });
    await p.waitForTimeout(350);
    const m=await p.evaluate(()=>({
      doc:document.documentElement.scrollWidth,
      win:window.innerWidth,
      widest:Math.max(0,...[...document.querySelectorAll('ul.list li')]
        .map(e=>Math.round(e.getBoundingClientRect().right)))
    }));
    const over=m.doc>m.win+1 || m.widest>m.win+1;
    if(over) bad++;
    console.log(`  ${over?'✗':'✓'} ${w}px — page ${m.doc}px wide, widest row ends at ${m.widest}px`);
    if(w===390) await p.screenshot({path:path.join(__dirname,'fit.png')});
    await p.close();
  }
  await b.close();
  console.log(bad?`\n${bad} width(s) overflow`:'\nNothing spills off the side at any width.');
  process.exit(bad?1:0);
})();
