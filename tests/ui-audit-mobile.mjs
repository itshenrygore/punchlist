// Deep mobile UI/UX audit — contractor perspective.
// Renders every contractor-facing screen at iPhone 14 Pro with realistic
// mock data + full-page screenshots, plus targeted overflow detection
// (elements wider than viewport, text clipping, off-screen content).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';
const OUT = path.resolve('tests/audit-runs/ui-audit-mobile');
fs.mkdirSync(OUT, { recursive: true });

const UID = '00000000-0000-0000-0000-000000000001';
const SESSION = {
  access_token: 'mock', refresh_token: 'm', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now()/1000) + 30*86400,
  user: { id: UID, aud: 'authenticated', role: 'authenticated',
    email: 'henry@sullivancontracting.example',
    user_metadata: { full_name: 'Henry Gore' }, app_metadata: { provider: 'email' },
    identities: [], created_at: new Date(Date.now()-90*86400e3).toISOString() },
};

const PROFILE = {
  id: UID, full_name: 'Henry Gore', company_name: 'Sullivan Contracting Services',
  trade: 'Plumber', trades: ['Plumber','HVAC'], province: 'AB', country: 'CA',
  default_city: 'Calgary', phone: '+15875551234', email: 'henry@sullivancontracting.example',
  default_labour_rate: 145, default_expiry_days: 14, sms_notifications_enabled: true,
  auto_followup_enabled: false, stripe_connect_account_id: 'acct_mock', stripe_connect_onboarded: true,
};
const CUSTOMERS = [
  { id:'c1', user_id:UID, name:'Joe Blow', email:'joe@example.com', phone:'+15879502472', address:'1245 9 Ave SW, Calgary, AB' },
  { id:'c2', user_id:UID, name:'Maria Sanchez', email:'maria@example.com', phone:'+15875551111', address:'88 Macleod Tr S, Calgary, AB' },
  { id:'c3', user_id:UID, name:'Dave Thompson', email:'dave@example.com', phone:'+15875552222', address:'210 8 Ave SW, Calgary, AB' },
];
const LINE_ITEMS = [
  { id:'li1', quote_id:'q1', name:'Dispatch / diagnostic', quantity:1, unit_price:100, category:'Services', included:true },
  { id:'li2', quote_id:'q1', name:'Install EV charger outlet', quantity:1, unit_price:490, category:'Labour', included:true },
  { id:'li3', quote_id:'q1', name:'Run 240V circuit for EV charger', quantity:1, unit_price:460, category:'Labour', included:true },
  { id:'li4', quote_id:'q1', name:'Wire and cable', quantity:1, unit_price:60, category:'Materials', included:true },
];
const QUOTES = [
  { id:'q1', user_id:UID, title:'EV Charger Install and Electrical Socket Upgrade', status:'sent', total:1607, view_count:4, trade:'Electrician', province:'AB', customer_id:'c1', share_token:'st1', quote_number:1291, sent_at:new Date(Date.now()-3*86400e3).toISOString(), updated_at:new Date(Date.now()-3*86400e3).toISOString(), created_at:new Date(Date.now()-4*86400e3).toISOString(), line_items:LINE_ITEMS, customer:CUSTOMERS[0] },
  { id:'q2', user_id:UID, title:'50 Gallon Hot Water Tank Replacement', status:'viewed', total:1318, view_count:6, trade:'Plumber', province:'AB', customer_id:'c2', share_token:'st2', quote_number:1288, sent_at:new Date(Date.now()-5*86400e3).toISOString(), updated_at:new Date(Date.now()-5*86400e3).toISOString(), created_at:new Date(Date.now()-6*86400e3).toISOString(), line_items:[], customer:CUSTOMERS[1] },
  { id:'q3', user_id:UID, title:'Bathroom Sink Replacement', status:'draft', total:0, view_count:0, trade:'Plumber', province:'AB', customer_id:null, share_token:'st3', quote_number:1287, updated_at:new Date(Date.now()-1*86400e3).toISOString(), created_at:new Date(Date.now()-1*86400e3).toISOString(), line_items:[] },
  { id:'q4', user_id:UID, title:'Furnace + AC Replacement — Full System', status:'approved', total:11372, view_count:12, trade:'HVAC', province:'AB', customer_id:'c3', share_token:'st4', quote_number:1280, sent_at:new Date(Date.now()-11*86400e3).toISOString(), approved_at:new Date(Date.now()-9*86400e3).toISOString(), updated_at:new Date(Date.now()-9*86400e3).toISOString(), created_at:new Date(Date.now()-12*86400e3).toISOString(), line_items:[], customer:CUSTOMERS[2] },
];
const INVOICES = [
  { id:'inv1', user_id:UID, invoice_number:'INV-2026-001', status:'paid', total:11372, amount_due:0, amount_paid:11372, issued_at:new Date(Date.now()-8*86400e3).toISOString(), paid_at:new Date(Date.now()-6*86400e3).toISOString(), due_at:new Date(Date.now()+6*86400e3).toISOString(), customer_id:'c3', quote_id:'q4', share_token:'ist1', currency:'CAD', customer:CUSTOMERS[2] },
  { id:'inv2', user_id:UID, invoice_number:'INV-2026-002', status:'sent', total:1607, amount_due:1607, amount_paid:0, issued_at:new Date(Date.now()-1*86400e3).toISOString(), due_at:new Date(Date.now()+13*86400e3).toISOString(), customer_id:'c1', quote_id:'q1', share_token:'ist2', currency:'CAD', customer:CUSTOMERS[0] },
];
const TEMPLATES = [
  { id:'t1', user_id:UID, name:'Standard furnace replacement', trade:'HVAC', province:'AB', use_count:7, description:'Replace existing gas furnace with new high-efficiency unit', line_items:[{name:'Remove & dispose old furnace',quantity:1,unit_price:250},{name:'Supply & install gas furnace',quantity:1,unit_price:3800}], created_at:new Date(Date.now()-40*86400e3).toISOString(), updated_at:new Date(Date.now()-20*86400e3).toISOString() },
];

function tableFor(t){
  if(t==='profiles')return [PROFILE];
  if(t==='quotes')return QUOTES;
  if(t==='customers')return CUSTOMERS;
  if(t==='invoices')return INVOICES;
  if(t==='job_templates')return TEMPLATES;
  if(t==='message_templates')return [];
  if(t==='line_items')return LINE_ITEMS;
  if(t==='notifications')return [];
  return [];
}

async function mock(page){
  await page.addInitScript(o=>localStorage.setItem(o.k,JSON.stringify(o.v)),{k:'sb-placeholder-auth-token',v:SESSION});
  await page.route('**/rest/v1/**', async route=>{
    const url=new URL(route.request().url());
    const m=url.pathname.match(/\/rest\/v1\/([^?\/]+)/);
    let data=tableFor(m?m[1]:'');
    for(const [k,v] of url.searchParams){
      if(['select','order','limit','offset'].includes(k))continue;
      if(typeof v==='string'&&v.startsWith('eq.')){const want=v.slice(3);data=data.filter(r=>String(r[k])===want);}
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.route('**/auth/v1/**', async route=>{
    const u=route.request().url();
    if(/\/user/.test(u))await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SESSION.user)});
    else await route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  await page.route('**/api/**', async route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
}

// Overflow / clipping detector — flags elements wider than the viewport
// (horizontal scroll = bad on mobile) and text that is visually clipped.
async function findIssues(page){
  return await page.evaluate(()=>{
    const vw=window.innerWidth, issues=[];
    const docW=document.documentElement.scrollWidth;
    if(docW>vw+2)issues.push({type:'h-scroll',detail:`page scrollWidth ${docW} > viewport ${vw}`});
    document.querySelectorAll('*').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width===0||r.height===0)return;
      // element pushing past right edge
      if(r.right>vw+3 && r.left>=0 && r.width<=vw){
        const cls=(el.className&&el.className.toString().slice(0,30))||el.tagName;
        if(getComputedStyle(el).position!=='fixed')issues.push({type:'overflow-right',detail:`${el.tagName}.${cls} right=${Math.round(r.right)}`});
      }
    });
    // de-dup
    const seen=new Set(); return issues.filter(i=>{const k=i.type+i.detail;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,12);
  });
}

const ROUTES=[
  ['01_dashboard','/app'],
  ['02_quotes_list','/app/quotes'],
  ['03_quote_new','/app/quotes/new'],
  ['04_quote_detail_sent','/app/quotes/q1'],
  ['05_quote_detail_approved','/app/quotes/q4'],
  ['06_quote_edit_draft','/app/quotes/q3/edit'],
  ['07_schedule','/app/schedule'],
  ['08_customers','/app/customers'],
  ['09_invoices','/app/invoices'],
  ['10_invoice_new','/app/invoices/new'],
  ['11_invoice_detail','/app/invoices/inv1'],
  ['12_templates','/app/templates'],
  ['13_analytics','/app/analytics'],
  ['14_settings_profile','/app/settings'],
  ['15_billing','/app/billing'],
  ['16_payments_setup','/app/payments/setup'],
];

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({...devices['iPhone 14 Pro']});
const page=await ctx.newPage();
await mock(page);
const report={};
for(const [name,route] of ROUTES){
  await page.goto(BASE+route,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1400);
  // scroll to trigger lazy content then back to top
  try{const h=await page.evaluate(()=>document.body.scrollHeight);for(let y=0;y<=h;y+=600){await page.evaluate(yy=>scrollTo(0,yy),y);await page.waitForTimeout(80);}await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);}catch{}
  const issues=await findIssues(page);
  const meta=await page.evaluate(()=>({h:document.body.scrollHeight,title:document.title,onLogin:location.pathname.includes('login')}));
  await page.screenshot({path:path.join(OUT,`${name}.png`),fullPage:true}).catch(()=>{});
  report[name]={route,...meta,issues};
  const flag=issues.length?`⚠ ${issues.length}`:'ok';
  console.log(`${name.padEnd(28)} ${String(meta.h).padStart(5)}px  ${flag}${meta.onLogin?'  BOUNCED-TO-LOGIN':''}`);
  if(issues.length)issues.forEach(i=>console.log(`     ${i.type}: ${i.detail}`));
}
await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('\nArtifacts → '+OUT);
