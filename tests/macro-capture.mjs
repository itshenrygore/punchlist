// Macro-polish audit: capture every contractor page at BOTH desktop (1440)
// and mobile (iPhone 14 Pro), signed in with realistic data, so we can
// review each page through a "premium / intuitive / minimal friction" lens.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE='http://localhost:4173';
const OUT=path.resolve('tests/audit-runs/macro-polish');
fs.mkdirSync(OUT,{recursive:true});

const UID='00000000-0000-0000-0000-000000000001';
const now=Date.now(); const iso=ms=>new Date(ms).toISOString();
const SESSION={access_token:'mock',refresh_token:'m',token_type:'bearer',expires_in:3600,expires_at:Math.floor(now/1000)+30*86400,user:{id:UID,aud:'authenticated',role:'authenticated',email:'henry@x.example',user_metadata:{full_name:'Henry Gore'},app_metadata:{provider:'email'},identities:[],created_at:iso(now)}};
const PROFILE={id:UID,full_name:'Henry Gore',company_name:'Sullivan Contracting',trade:'Plumber',trades:['Plumber','HVAC'],province:'AB',country:'CA',default_city:'Calgary',phone:'+15875551234',default_labour_rate:145,default_expiry_days:14,stripe_connect_account_id:'acct_m',stripe_connect_onboarded:true,plan:'pro',is_pro:true,payment_methods:['E-Transfer'],etransfer_email:'billing@sullivan.example',require_signature:false};
const CUSTOMERS=[
  {id:'c1',user_id:UID,name:'Joe Blow',email:'joe@example.com',phone:'+15879502472',address:'123 Elm St, Calgary',created_at:iso(now-60*864e5)},
  {id:'c2',user_id:UID,name:'Maria Sanchez',email:'maria@example.com',phone:'+15875551111',address:'45 Oak Ave, Calgary',created_at:iso(now-30*864e5)},
];
const LI=[
  {id:'li-1',quote_id:'q1',name:'Remove & dispose old furnace',quantity:1,unit_price:475,category:'Services',included:true},
  {id:'li-2',quote_id:'q1',name:'Supply & install furnace 96% AFUE',quantity:1,unit_price:4180,category:'Labour',included:true},
  {id:'li-3',quote_id:'q1',name:'New thermostat + permit',quantity:1,unit_price:340,category:'Materials',included:true},
];
const QUOTES=[
  {id:'q1',user_id:UID,title:'Furnace + AC Replacement',status:'approved',total:4995,subtotal:4995,tax:0,trade:'HVAC',province:'AB',customer_id:'c1',quote_number:1280,sent_at:iso(now-3*864e5),approved_at:iso(now-864e5),signed_at:iso(now-864e5),signer_name:'Joe Blow',updated_at:iso(now),created_at:iso(now-5*864e5),line_items:LI,customer:CUSTOMERS[0],share_token:'qst1'},
  {id:'q2',user_id:UID,title:'Kitchen faucet swap',status:'sent',total:340,subtotal:340,tax:0,trade:'Plumber',province:'AB',customer_id:'c1',quote_number:1295,sent_at:iso(now),view_count:2,updated_at:iso(now),created_at:iso(now),line_items:[{id:'lx',quote_id:'q2',name:'Replace kitchen faucet',quantity:1,unit_price:340,included:true}],customer:CUSTOMERS[0],share_token:'qst2'},
  {id:'q3',user_id:UID,title:'Basement bathroom rough-in',status:'draft',total:0,subtotal:0,tax:0,trade:'Plumber',province:'AB',customer_id:'c2',quote_number:null,updated_at:iso(now-2*864e5),created_at:iso(now-2*864e5),line_items:[],customer:CUSTOMERS[1]},
];
const INVOICES=[
  {id:'inv1',user_id:UID,quote_id:'q1',invoice_number:'INV-2026-001',status:'sent',total:4995,amount_due:4995,amount_paid:0,currency:'CAD',share_token:'ist1',due_at:iso(now+14*864e5),issued_at:iso(now-864e5),customer_id:'c1',customer:CUSTOMERS[0],line_items:LI.map(l=>({...l,invoice_id:'inv1'})),created_at:iso(now-864e5),updated_at:iso(now)},
];
const TEMPLATES=[{id:'t1',user_id:UID,name:'Standard furnace replacement',trade:'HVAC',province:'AB',use_count:7,description:'Replace existing gas furnace with new high-efficiency unit',line_items:[{name:'Remove & dispose old furnace',quantity:1,unit_price:250},{name:'Supply & install gas furnace',quantity:1,unit_price:3800},{name:'New thermostat + permit',quantity:1,unit_price:340}],created_at:iso(now-40*864e5),updated_at:iso(now-20*864e5)}];

function tableFor(t){if(t==='profiles')return[PROFILE];if(t==='quotes')return QUOTES;if(t==='customers')return CUSTOMERS;if(t==='invoices')return INVOICES;if(t==='job_templates')return TEMPLATES;if(t==='message_templates')return[];if(t==='line_items')return[...LI,...QUOTES.flatMap(q=>q.line_items||[])];return[];}

async function mock(page){
  await page.addInitScript(o=>{localStorage.setItem(o.k,JSON.stringify(o.v));localStorage.setItem('pl_onboarded','1');},{k:'sb-placeholder-auth-token',v:SESSION});
  await page.route('**/rest/v1/**',async route=>{const url=new URL(route.request().url());const m=url.pathname.match(/\/rest\/v1\/([^?\/]+)/);let data=tableFor(m?m[1]:'');for(const[k,v]of url.searchParams){if(['select','order','limit','offset'].includes(k))continue;if(typeof v==='string'&&v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await page.route('**/auth/v1/**',async route=>{const u=route.request().url();if(/\/user/.test(u))await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SESSION.user)});else await route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.route('**/api/**',async route=>{const u=route.request().url();if(/connect|payments-status|stripe/i.test(u))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({connected:true,onboarded:true,chargesEnabled:true,paymentState:'active'})});return route.fulfill({status:200,contentType:'application/json',body:'{}'});});
}

const PAGES=[
  ['dashboard','/app'],
  ['quotes_list','/app/quotes'],
  ['quote_detail_approved','/app/quotes/q1'],
  ['quote_detail_sent','/app/quotes/q2'],
  ['quote_builder_new','/app/quotes/new'],
  ['customers','/app/customers'],
  ['invoices_list','/app/invoices'],
  ['invoice_detail','/app/invoices/inv1'],
  ['templates','/app/templates'],
  ['schedule','/app/schedule'],
  ['analytics','/app/analytics'],
  ['settings','/app/settings'],
  ['billing','/app/billing'],
];

async function run(label, deviceOpts, viewport){
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext(deviceOpts);
  const page=await ctx.newPage(); await mock(page);
  for(const [name,route] of PAGES){
    try{
      await page.goto(BASE+route,{waitUntil:'networkidle'});
      await page.waitForTimeout(1300);
      await page.screenshot({path:path.join(OUT,`${label}_${name}.png`),fullPage:true}).catch(()=>{});
      console.log(`${label.padEnd(8)} ${name}`);
    }catch(e){ console.log(`${label} ${name} ERR ${e.message.slice(0,60)}`); }
  }
  await browser.close();
}

await run('mobile', {...devices['iPhone 14 Pro']});
await run('desktop', {viewport:{width:1440,height:900}, deviceScaleFactor:1});
console.log('\nArtifacts -> '+OUT);
