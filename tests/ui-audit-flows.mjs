// Interactive sub-flow UI audit — the modals/sheets/overlays + stateful
// flows that a static route capture misses. Drives real clicks at iPhone
// 14 Pro and captures the resulting state + overflow detection.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE='http://localhost:4173';
const OUT=path.resolve('tests/audit-runs/ui-audit-flows');
fs.mkdirSync(OUT,{recursive:true});
const UID='00000000-0000-0000-0000-000000000001';
const SESSION={access_token:'mock',refresh_token:'m',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+30*86400,user:{id:UID,aud:'authenticated',role:'authenticated',email:'henry@sullivan.example',user_metadata:{full_name:'Henry Gore'},app_metadata:{provider:'email'},identities:[],created_at:new Date(Date.now()-90*86400e3).toISOString()}};
const PROFILE={id:UID,full_name:'Henry Gore',company_name:'Sullivan Contracting Services',trade:'Plumber',trades:['Plumber','HVAC'],province:'AB',country:'CA',default_city:'Calgary',phone:'+15875551234',default_labour_rate:145,default_expiry_days:14,stripe_connect_account_id:'acct_m',stripe_connect_onboarded:true};
const CUSTOMERS=[{id:'c1',user_id:UID,name:'Joe Blow',email:'joe@example.com',phone:'+15879502472',address:'1245 9 Ave SW, Calgary, AB'},{id:'c2',user_id:UID,name:'Maria Sanchez',email:'maria@example.com',phone:'+15875551111',address:'88 Macleod Tr S, Calgary'}];
const LI=[{id:'li1',quote_id:'q1',name:'Dispatch / diagnostic',quantity:1,unit_price:100,category:'Services',included:true},{id:'li2',quote_id:'q1',name:'Install kitchen faucet',quantity:1,unit_price:220,category:'Labour',included:true}];
const QUOTES=[{id:'q1',user_id:UID,title:'Kitchen faucet replacement',status:'draft',total:320,trade:'Plumber',province:'AB',customer_id:'c1',quote_number:1291,updated_at:new Date().toISOString(),created_at:new Date().toISOString(),line_items:LI,customer:CUSTOMERS[0],description:'Replace kitchen faucet customer supplied'}];
function tableFor(t){if(t==='profiles')return[PROFILE];if(t==='quotes')return QUOTES;if(t==='customers')return CUSTOMERS;if(t==='line_items')return LI;return[];}
async function mock(page){
  await page.addInitScript(o=>localStorage.setItem(o.k,JSON.stringify(o.v)),{k:'sb-placeholder-auth-token',v:SESSION});
  await page.route('**/rest/v1/**',async route=>{const url=new URL(route.request().url());const m=url.pathname.match(/\/rest\/v1\/([^?\/]+)/);let data=tableFor(m?m[1]:'');for(const[k,v]of url.searchParams){if(['select','order','limit','offset'].includes(k))continue;if(typeof v==='string'&&v.startsWith('eq.')){const w=v.slice(3);data=data.filter(r=>String(r[k])===w);}}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await page.route('**/auth/v1/**',async route=>{const u=route.request().url();if(/\/user/.test(u))await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SESSION.user)});else await route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.route('**/api/**',async route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
}
async function overflow(page){return await page.evaluate(()=>{const vw=innerWidth,out=[];if(document.documentElement.scrollWidth>vw+2)out.push('h-scroll '+document.documentElement.scrollWidth+'>'+vw);document.querySelectorAll('*').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&r.height>0&&r.right>vw+3&&r.left>=-1&&r.width<=vw&&getComputedStyle(el).position!=='fixed'){const c=(el.className&&el.className.toString().slice(0,30))||el.tagName;if(!/pl-tab|settings-tab|marquee/.test(c))out.push(c+' R='+Math.round(r.right));}});return [...new Set(out)].slice(0,8);});}

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({...devices['iPhone 14 Pro']});
const page=await ctx.newPage();
await mock(page);
const findings=[];
async function snap(name,note=''){await page.screenshot({path:path.join(OUT,name+'.png')}).catch(()=>{});const iss=await overflow(page);findings.push({name,note,issues:iss});console.log(`${name.padEnd(34)} ${iss.length?'⚠ '+iss.join(' | '):'ok'}${note?'  ['+note+']':''}`);}

// ── 1. Signup step 2 — trade picker ──
await page.route('**/auth/v1/signup**',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:UID,email:'henry@x.example'},session:{access_token:'t',user:{id:UID,email:'henry@x.example'}}})}));
await page.goto(BASE+'/signup',{waitUntil:'networkidle'});await page.waitForTimeout(800);
await page.fill('input[placeholder*="Mike Sullivan"]','Henry Gore').catch(()=>{});
await page.fill('input[type=email]','henry@x.example').catch(()=>{});
await page.fill('input[type=password]','SuperSafePass99').catch(()=>{});
await page.locator('input[type=checkbox]').first().check().catch(()=>{});
await page.locator('button:has-text("Continue")').first().click().catch(()=>{});
await page.waitForTimeout(1200);
await snap('01_signup_step2_tradepicker', page.url().includes('signup')?'still on signup':'advanced');

// ── 2. Quote builder → catalog sheet ──
await page.goto(BASE+'/app/quotes/q1/edit',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('02_quote_edit_with_items');
// open Browse catalog
const browse=page.locator('button:has-text("Browse catalog")').first();
if(await browse.count()){await browse.click().catch(()=>{});await page.waitForTimeout(900);await snap('03_catalog_sheet_open');
  // type a search
  const search=page.locator('.catalog-sheet input, [class*=catalog] input, input[placeholder*="Search"]').first();
  if(await search.count()){await search.fill('water heater').catch(()=>{});await page.waitForTimeout(700);await snap('04_catalog_search_results');}
  // close
  await page.keyboard.press('Escape').catch(()=>{});await page.waitForTimeout(400);
}

// ── 3. Custom item add ──
await page.goto(BASE+'/app/quotes/q1/edit',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const custom=page.locator('button:has-text("Custom item"), button:has-text("+ Custom")').first();
if(await custom.count()){await custom.click().catch(()=>{});await page.waitForTimeout(700);await snap('05_custom_item');}

// ── 4. Commonly-missed items expanded (smart) ──
const confToggle=page.locator('.qe-conf-toggle, .confBar, [class*=conf-toggle]').first();
if(await confToggle.count()){await confToggle.click().catch(()=>{});await page.waitForTimeout(500);await snap('06_commonly_missed_expanded','smart items?');}

// ── 5. Customer add modal ──
await page.goto(BASE+'/app/customers',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const addCust=page.locator('button:has-text("Add"), a:has-text("+ Add")').first();
if(await addCust.count()){await addCust.click().catch(()=>{});await page.waitForTimeout(700);await snap('07_customer_add_modal');await page.keyboard.press('Escape').catch(()=>{});}

// ── 6. Foreman panel — open + quick action ──
await page.goto(BASE+'/app',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const fmBtn=page.locator('.mobile-nav-foreman, [aria-label="Open Foreman"]').last();
if(await fmBtn.count()){await fmBtn.click().catch(()=>{});await page.waitForTimeout(900);await snap('08_foreman_open');
  // type in input
  const fmInput=page.locator('.fm-input').first();
  if(await fmInput.count()){await fmInput.fill('How much to replace a 50 gallon water heater?').catch(()=>{});await page.waitForTimeout(300);await snap('09_foreman_typed');}
}

// ── 7. Notification center ──
await page.goto(BASE+'/app',{waitUntil:'networkidle'});await page.waitForTimeout(1000);
const bell=page.locator('[aria-label*="otification"], .notification-bell, button:has(svg)').filter({hasText:''}).first();
const bellBtn=page.locator('button[aria-label*="otification"], button[title*="otification"]').first();
if(await bellBtn.count()){await bellBtn.click().catch(()=>{});await page.waitForTimeout(700);await snap('10_notifications');await page.keyboard.press('Escape').catch(()=>{});}

// ── 8. Search / command palette ──
const searchBtn=page.locator('button[aria-label="Search"], button[title*="Search"]').first();
if(await searchBtn.count()){await searchBtn.click().catch(()=>{});await page.waitForTimeout(600);await snap('11_search_palette');await page.keyboard.press('Escape').catch(()=>{});}

// ── 9. Mobile nav menu (hamburger) ──
await page.goto(BASE+'/app',{waitUntil:'networkidle'});await page.waitForTimeout(900);
const menu=page.locator('.mobile-menu-btn, button[aria-label*="menu"]').first();
if(await menu.count()){await menu.click().catch(()=>{});await page.waitForTimeout(600);await snap('12_mobile_menu');}

await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(findings,null,2));
console.log('\nArtifacts → '+OUT);
