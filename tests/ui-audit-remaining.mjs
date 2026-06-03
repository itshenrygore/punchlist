// Final coverage pass — the contractor flows not yet driven:
// new-quote builder progression, send-quote modal, invoice from quote,
// templates with line items, Foreman with active quote context,
// multi-trade picker (now that migrations are run).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE='http://localhost:4173';
const OUT=path.resolve('tests/audit-runs/ui-audit-remaining');
fs.mkdirSync(OUT,{recursive:true});

const UID='00000000-0000-0000-0000-000000000001';
const SESSION={access_token:'mock',refresh_token:'m',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+30*86400,user:{id:UID,aud:'authenticated',role:'authenticated',email:'henry@x.example',user_metadata:{full_name:'Henry Gore'},app_metadata:{provider:'email'},identities:[],created_at:new Date().toISOString()}};
const PROFILE={id:UID,full_name:'Henry Gore',company_name:'Sullivan Contracting',trade:'Plumber',trades:['Plumber','HVAC'],province:'AB',country:'CA',default_city:'Calgary',phone:'+15875551234',default_labour_rate:145,default_expiry_days:14,stripe_connect_account_id:'acct_m',stripe_connect_onboarded:true};
const CUSTOMERS=[{id:'c1',user_id:UID,name:'Joe Blow',email:'joe@example.com',phone:'+15879502472'},{id:'c2',user_id:UID,name:'Maria Sanchez',email:'maria@example.com',phone:'+15875551111'}];
const LI_Q4=[{id:'li-a',quote_id:'q4',name:'Remove & dispose old furnace',quantity:1,unit_price:475,category:'Services',included:true},{id:'li-b',quote_id:'q4',name:'Supply & install furnace',quantity:1,unit_price:4180,category:'Labour',included:true}];
const QUOTES=[{id:'q4',user_id:UID,title:'Furnace + AC Replacement',status:'approved',total:4655,trade:'HVAC',province:'AB',customer_id:'c1',quote_number:1280,sent_at:new Date(Date.now()-3*864e5).toISOString(),approved_at:new Date(Date.now()-1*864e5).toISOString(),updated_at:new Date().toISOString(),created_at:new Date(Date.now()-5*864e5).toISOString(),line_items:LI_Q4,customer:CUSTOMERS[0]},{id:'q5',user_id:UID,title:'Kitchen faucet swap',status:'sent',total:340,trade:'Plumber',province:'AB',customer_id:'c1',quote_number:1295,sent_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_at:new Date().toISOString(),line_items:[],customer:CUSTOMERS[0]}];
const TEMPLATES=[{id:'t1',user_id:UID,name:'Standard furnace replacement',trade:'HVAC',province:'AB',use_count:7,description:'Replace existing gas furnace with new high-efficiency unit',line_items:[{name:'Remove & dispose old furnace',quantity:1,unit_price:250},{name:'Supply & install gas furnace',quantity:1,unit_price:3800},{name:'New thermostat + permit',quantity:1,unit_price:340}],created_at:new Date(Date.now()-40*864e5).toISOString(),updated_at:new Date(Date.now()-20*864e5).toISOString()}];
function tableFor(t){if(t==='profiles')return [PROFILE];if(t==='quotes')return QUOTES;if(t==='customers')return CUSTOMERS;if(t==='job_templates')return TEMPLATES;if(t==='message_templates')return [];if(t==='line_items')return LI_Q4;return [];}

async function mock(page){
  await page.addInitScript(o=>{localStorage.setItem(o.k,JSON.stringify(o.v));localStorage.setItem('pl_onboarded','1');},{k:'sb-placeholder-auth-token',v:SESSION});
  await page.route('**/rest/v1/**',async route=>{const url=new URL(route.request().url());const m=url.pathname.match(/\/rest\/v1\/([^?\/]+)/);let data=tableFor(m?m[1]:'');for(const[k,v]of url.searchParams){if(['select','order','limit','offset'].includes(k))continue;if(typeof v==='string'&&v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await page.route('**/auth/v1/**',async route=>{const u=route.request().url();if(/\/user/.test(u))await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SESSION.user)});else await route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.route('**/api/**',async route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
}
async function overflow(page){return await page.evaluate(()=>{const vw=innerWidth,out=[];if(document.documentElement.scrollWidth>vw+2)out.push('h-scroll '+document.documentElement.scrollWidth+'>'+vw);document.querySelectorAll('*').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&r.height>0&&r.right>vw+3&&r.left>=-1&&r.width<=vw&&getComputedStyle(el).position!=='fixed'){const c=(el.className||el.tagName).toString().slice(0,30);if(!/pl-tab|settings-tab|marquee/.test(c))out.push(c+' R='+Math.round(r.right));}});return [...new Set(out)].slice(0,6);});}

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({...devices['iPhone 14 Pro']});
const page=await ctx.newPage();
await mock(page);
const findings=[];
async function snap(name,note=''){await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true}).catch(()=>{});const o=await overflow(page);findings.push({name,note,issues:o});console.log(`${name.padEnd(34)} ${o.length?'⚠ '+o.join(' | '):'ok'}${note?'  ['+note+']':''}`);}

// 1. New-quote step 1 (job) — fill description, choose trade
await page.goto(BASE+'/app/quotes/new',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
const desc=page.locator('textarea').first();
if(await desc.count()){await desc.fill('Replace 50 gallon gas water heater with new unit, expansion tank, and shutoff. Customer supplied the heater.').catch(()=>{});await page.waitForTimeout(400);}
await snap('01_new_quote_described');

// 2. Build button intercept fails (no AI in mock) → fall back to manual
const build=page.locator('button:has-text(/Build|Generate|Start/i), button.qb-build-btn').first();
const manual=page.locator('button:has-text(/start.*blank|build.*manual|skip|build it/i), a:has-text(/blank|manual/i)').first();
// Try the most common: "or start from blank"
const start=page.locator('text=/start from blank|build it manually/i').first();
if(await start.count()){await start.click().catch(()=>{});await page.waitForTimeout(1500);}
await snap('02_new_quote_scope_view');

// 3. Templates list with items
await page.goto(BASE+'/app/templates',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
await snap('03_templates_with_items');

// 4. Use a template — should drop into quote builder with items pre-loaded
const useTpl=page.locator('button:has-text("Use template"), a:has-text("Use template")').first();
if(await useTpl.count()){await useTpl.click().catch(()=>{});await page.waitForTimeout(1500);await snap('04_template_used','should have items pre-loaded');}

// 5. Quote detail for approved → "Create invoice" path
await page.goto(BASE+'/app/quotes/q4',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('05_approved_quote_detail');
const createInvBtn=page.locator('button:has-text("Create invoice"), a:has-text("Create invoice")').first();
if(await createInvBtn.count()){await createInvBtn.click().catch(()=>{});await page.waitForTimeout(900);await snap('06_create_invoice_sheet');await page.keyboard.press('Escape').catch(()=>{});}

// 6. Sent quote detail → Send follow-up
await page.goto(BASE+'/app/quotes/q5',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('07_sent_quote_detail');
const fu=page.locator('button:has-text("Follow up"), button:has-text("Send follow-up")').first();
if(await fu.count()){await fu.click().catch(()=>{});await page.waitForTimeout(700);await snap('08_followup_sheet');await page.keyboard.press('Escape').catch(()=>{});}

// 7. Foreman with active quote context (quote builder open + open Foreman)
await page.goto(BASE+'/app/quotes/q4',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
const fmBtn=page.locator('.mobile-nav-foreman, [aria-label="Open Foreman"]').last();
if(await fmBtn.count()){await fmBtn.click().catch(()=>{});await page.waitForTimeout(900);await snap('09_foreman_with_quote_context','should show drafting / item count + total');}

// 8. Settings → Messages tab (now that auto_followup migration ran)
await page.goto(BASE+'/app/settings',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const msgTab=page.locator('button:has-text("Messages"), .settings-tab').filter({hasText:'Messages'}).first();
if(await msgTab.count()){await msgTab.click().catch(()=>{});await page.waitForTimeout(700);await snap('10_settings_messages_tab','auto-followup toggle');}

// 9. Account tab — delete-my-account
await page.goto(BASE+'/app/settings',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const acctTab=page.locator('.settings-tab').filter({hasText:'Account'}).first();
if(await acctTab.count()){await acctTab.click().catch(()=>{});await page.waitForTimeout(700);await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(400);await snap('11_settings_account_delete');
  const del=page.locator('button:has-text("Delete my account")').first();
  if(await del.count()){await del.click().catch(()=>{});await page.waitForTimeout(500);await snap('12_delete_confirm_1');
    const yes=page.locator('button:has-text("Yes, I understand")').first();
    if(await yes.count()){await yes.click().catch(()=>{});await page.waitForTimeout(500);await snap('13_delete_confirm_2_final');}
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(findings,null,2));
console.log('\nArtifacts → '+OUT);
const probs=findings.filter(f=>f.issues.length);
if(probs.length){console.log('\n⚠ overflow:'); probs.forEach(p=>console.log('   '+p.name+': '+p.issues.join(' | ')));} else console.log('\n✓ No overflow.');
