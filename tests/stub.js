// Enough of Supabase and Leaflet to let the page boot and draw itself.
window.__rows = {
  profiles:[{id:'me', display_name:'Barry', email:'b@example.com', theme:'ink'},
            {id:'sandra', display_name:'Sandra', email:'s@example.com'},
            {id:'other', display_name:'Someone Else', email:'e@example.com'}],
  contacts:[{id:1,created_by:'me',first_name:'Dickie',last_name:'Deal',town:'Botley',
             contact_groups:[]},
            {id:2,created_by:'me',first_name:'Sandra',last_name:'Walsh',
             death_date:null,contact_groups:[]}],
  groups:[{id:1,name:'Family',sort_order:10,owner_id:null}],
  statuses:[], link_kinds:[], relationships:[], contact_shares:[], pet_types:[],
  contact_favourites:[], items:[], item_shares:[], shopping:[],
  contact_offers:[],
  log_days:[], log_options:[], log_cats:[], log_fields:[],
  live_locations:[], location_shares:[], shopping_lists:[], shopping_list_shares:[],
  wishes:[], routines:[], devices:[],

  // ---- the cashbook ----
  finance_members:[{user_id:'me'},{user_id:'sandra'}],
  currencies:[{code:'GBP',name:'Pound sterling',symbol:'£',sort:1},
              {code:'NZD',name:'New Zealand dollar',symbol:'$',sort:2},
              {code:'USD',name:'US dollar',symbol:'$',sort:3},
              {code:'EUR',name:'Euro',symbol:'€',sort:4}],
  accounts:[
    {id:1,name:'Barclays',kind:'current',currency:'GBP',opening_balance:1000,
     opening_date:'2026-01-01',active:true,sort:10,created_by:'me'},
    {id:2,name:'Amex',kind:'credit card',currency:'GBP',opening_balance:0,
     opening_date:'2026-01-01',active:true,sort:20,created_by:'me'},
    {id:3,name:'ASB',kind:'current',currency:'NZD',opening_balance:500,
     opening_date:'2026-01-01',active:true,sort:30,created_by:'other'}],
  account_balances:[
    {account_id:1,balance:457.5,cleared:957.5,not_yet_reconciled:-500,transactions:3},
    {account_id:2,balance:-212.4,cleared:0,not_yet_reconciled:-212.4,transactions:2},
    {account_id:3,balance:1550,cleared:500,not_yet_reconciled:1050,transactions:1}],
  categories:[
    {id:1,code:null,name:'Groceries',kind:'expense',business:false,sort:90,active:true},
    {id:2,code:null,name:'Diesel',kind:'expense',business:false,sort:50,active:true},
    {id:3,code:'PH',name:'Photography sales',kind:'income',business:true,sort:310,active:true},
    {id:4,code:null,name:'Mooring',kind:'expense',business:false,sort:10,active:true}],
  payees:[{id:1,name:'Tesco',contact_id:null,category_id:1},
          {id:2,name:'Alamy',contact_id:null,category_id:3},
          {id:3,name:'Dickie Deal',contact_id:1,category_id:null}],
  transactions:[
    {id:1,account_id:1,tdate:'2026-02-03',kind:'expense',pay_method:'debit card',
     payee_id:1,total:-42.5,business:false,reconciled:true,statement_id:1,
     reconciled_on:'2026-02-28',photos:[]},
    {id:2,account_id:1,tdate:'2026-02-10',kind:'transfer',transfer_id:'t-1',
     total:-500,business:false,reconciled:false,photos:[]},
    {id:3,account_id:3,tdate:'2026-02-13',kind:'transfer',transfer_id:'t-1',
     total:1050,business:false,reconciled:false,photos:[]},
    {id:4,account_id:2,tdate:'2026-02-14',kind:'expense',pay_method:'credit card',
     payee_id:null,total:-212.4,business:true,reconciled:false,photos:[]},
    {id:5,account_id:1,tdate:'2026-02-20',kind:'income',payee_id:2,
     total:88.12,business:true,reconciled:false,photos:[]}],
  transaction_items:[
    {id:1,transaction_id:1,category_id:1,description:'Weekly shop',qty:1,
     amount:-42.5,line_total:-42.5,business:false,sort:0},
    {id:2,transaction_id:2,category_id:null,description:'To ASB',qty:1,
     amount:-500,line_total:-500,sort:0},
    {id:3,transaction_id:3,category_id:null,description:'From Barclays',qty:1,
     amount:1050,line_total:1050,sort:0},
    {id:4,transaction_id:4,category_id:2,description:'Lens hood',qty:2,
     amount:-106.2,line_total:-212.4,business:true,sort:0},
    {id:5,transaction_id:5,category_id:3,description:'February royalties',qty:1,
     amount:88.12,line_total:88.12,business:true,sort:0}],
  statements:[{id:1,account_id:1,ends_on:'2026-02-28',closing_balance:929.5,locked:false}],
  import_maps:[],
  // Barclays is mine alone; Amex is shared with Sandra, look-only; ASB belongs
  // to somebody else and is shared with me so I can change it.
  account_shares:[{account_id:2,viewer_id:'sandra',can_edit:false},
                  {account_id:3,viewer_id:'me',can_edit:true}],
  bank_files:[{id:1,account_id:1,name:'barclays-feb.csv',
    path:'fin/1/statements/aaa-barclays-feb.csv',bytes:4096,
    covers_from:'2026-02-01',covers_to:'2026-02-28',rows_seen:31,rows_taken:28,
    created_by:'me',created_at:'2026-03-01T09:00:00Z'}]
};

// The Today screen greets you once a day. Every other suite would meet it
// before anything else, so it is marked as seen here; brief.test.js clears
// this and puts it through its paces properly.
try{
  const d=new Date(); d.setHours(d.getHours()-4);
  const p=n=>String(n).padStart(2,'0');
  localStorage.setItem('briefday',
    `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`);
}catch(e){}

window.__writes = [];           // everything the page tried to save
let nextId = 500;

// The filters are honoured, otherwise a test cannot tell a query that is
// scoped to one account from one that quietly returns everybody's.
function apply(rows, where){
  return rows.filter(r => where.every(([op,col,val]) => {
    const v = r[col];
    switch(op){
      case 'eq':  return String(v)===String(val);
      case 'neq': return String(v)!==String(val);
      case 'is':  return val===null ? (v===null||v===undefined) : v===val;
      case 'lte': return v<=val;
      case 'gte': return v>=val;
      case 'lt':  return v<val;
      case 'gt':  return v>val;
      case 'in':  return (val||[]).map(String).includes(String(v));
      case 'ilike': return new RegExp('^'+String(val).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
        .replace(/%/g,'.*')+'$','i').test(String(v??''));
      case '__or': return (val||[]).some(c=>{
        const cv=r[c.col];
        if(c.op==='ilike'){
          const rx=new RegExp('^'+String(c.val).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
            .replace(/%/g,'.*')+'$','i');
          return rx.test(String(cv??''));
        }
        return String(cv)===String(c.val);
      });
      default:    return true;
    }
  }));
}

function builder(table){
  const api={}, where=[];
  // Copies, not the stored objects themselves. The real thing sends fresh JSON
  // over the wire, and a test that hands back live references cannot tell
  // "nothing changed" from "the page is looking at the same object".
  const done=()=>Promise.resolve({
    data: apply((window.__rows[table]||[]).slice(), where)
            .map(r=>JSON.parse(JSON.stringify(r))), error:null });
  ['select','order','limit','filter','not','range'].forEach(m=>api[m]=()=>api);
  // or('a.ilike.%x%,b.ilike.%x%') — match any of the listed conditions.
  api.or=expr=>{
    const parts=String(expr).split(',').map(s=>{
      const m=s.match(/^([a-z_]+)\.(\w+)\.(.*)$/i);
      return m?{col:m[1],op:m[2],val:m[3]}:null;
    }).filter(Boolean);
    where.push(['__or',null,parts]);
    return api;
  };
  ['eq','is','gt','lt','lte','gte','neq','in','ilike'].forEach(m=>
    api[m]=(col,val)=>{ where.push([m,col,val]); return api; });
  api.single=()=>done().then(r=>({data:r.data[0]||null,error:null}));

  const made=rows=>{
    const arr=Array.isArray(rows)?rows:[rows];
    return arr.map(r=>Object.assign({id:nextId++}, r));
  };
  api.insert=rows=>{
    window.__writes.push({op:'insert',table,rows});
    const out=made(rows);
    const back={ data:Array.isArray(rows)?out:out[0], error:null };
    const sel=()=>({ single:()=>Promise.resolve({data:out[0],error:null}),
                     then:(f,r)=>Promise.resolve(back).then(f,r) });
    return { select:sel, single:()=>Promise.resolve({data:out[0],error:null}),
             then:(f,r)=>Promise.resolve({data:null,error:null}).then(f,r) };
  };
  // The filters that follow are kept with the write (the same list, filled in
  // as the page adds them), so a test can see WHOSE row was changed.
  api.update=patch=>{ window.__writes.push({op:'update',table,patch,where}); return api; };
  api.delete=()=>{ window.__writes.push({op:'delete',table,where}); return api; };
  api.upsert=rows=>{ window.__writes.push({op:'upsert',table,rows}); return done(); };
  api.then=(f,r)=>done().then(f,r);
  return api;
}
window.supabase={createClient:()=>({
  auth:{getUser:()=>Promise.resolve({data:{user:{id:'me',email:'b@example.com'}}}),
        signInWithPassword:()=>Promise.resolve({error:null}),
        signOut:()=>Promise.resolve({}), updateUser:()=>Promise.resolve({error:null}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:builder,
  channel:()=>({on(){return this;},subscribe(){return this;}}),
  removeChannel:()=>{},
  storage:{from:bucket=>({
    createSignedUrls:paths=>Promise.resolve({
      data:(paths||[]).map(p=>({path:p, signedUrl:'https://signed.test/'+p})),
      error:null}),
    upload:(path,body,opts)=>{
      window.__writes.push({op:'upload',bucket,path,
        size:(body&&body.size)||0, type:(opts&&opts.contentType)||''});
      return Promise.resolve({error:null});
    },
    remove:paths=>{ window.__writes.push({op:'rmfile',bucket,paths});
      return Promise.resolve({}); }})},
  functions:{invoke:()=>Promise.resolve({})}
})};
const noop=()=>({addTo(){return this;}, on(){return this;}, once(){return this;},
  setView(){return this;}, remove(){}, invalidateSize(){}, fitBounds(){},
  clearLayers(){}, bindTooltip(){return this;}, getElement(){return null;},
  setLatLng(){return this;}, enable(){}, disable(){}});
window.L={map:()=>Object.assign(noop(),{dragging:noop(),touchZoom:noop(),
  doubleClickZoom:noop(),tap:null}), tileLayer:noop, marker:noop, layerGroup:noop,
  geoJSON:noop, control:{layers:()=>noop()}, DomEvent:{stopPropagation(){}}};
