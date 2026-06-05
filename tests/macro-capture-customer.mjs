import { chromium, devices } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const BASE='http://localhost:4173';
const OUT=path.resolve('tests/audit-runs/macro-polish'); fs.mkdirSync(OUT,{recursive:true});
const now=Date.now(), iso=ms=>new Date(ms).toISOString();

const QUOTE={
  id:'q1', title:'Furnace + AC Replacement', status:'sent', total:11372, subtotal:10830, tax:542,
  share_token:'st1', country:'CA', trade:'HVAC', province:'AB',
  deposit_required:true, deposit_amount:2274, deposit_status:'requested',
  expires_at:iso(now+9*864e5), created_at:iso(now-2*864e5),
  require_signature:false, // new default — one-tap approve
  line_items:[
    {id:'l1',name:'Remove & dispose of existing furnace + AC',description:'Disconnect, drain, haul to recycling depot',quantity:1,unit_price:475,included:true},
    {id:'l2',name:'Supply & install gas furnace — 96% AFUE, 80k BTU',description:'Lennox EL296 variable-speed blower',quantity:1,unit_price:4180,included:true},
    {id:'l3',name:'Supply & install central AC — 3.5 ton, 16 SEER',description:'Outdoor condenser pad + lineset + start-up',quantity:1,unit_price:4625,included:true},
    {id:'l4',name:'Lineset, flue liner, electrical & Ecobee thermostat',description:'Includes city permit + inspection',quantity:1,unit_price:1550,included:true},
  ],
  customer:{name:'Jen Smith',email:'jen@example.com',phone:'+14035551234'},
  customer_name:'Jen Smith', customer_email:'jen@example.com', customer_phone:'+14035551234',
  contractor_name:'Mike Sullivan', contractor_company:'Comfort Air HVAC Ltd.',
  contractor_phone:'+14035550101', contractor_email:'mike@comfortair.example',
  payment_methods:['E-Transfer'], etransfer_email:'mike@comfortair.example', stripe_connect_enabled:true,
  terms_conditions:'50% deposit due to schedule. Balance due on completion. 1 year labour warranty.',
};
const INV={
  id:'inv1', invoice_number:'INV-2026-001', status:'sent', total:11372, amount_due:11372, amount_paid:0, currency:'CAD',
  due_at:iso(now+14*864e5), issued_at:iso(now-864e5), paid_at:null, share_token:'ist1', country:'CA',
  notes:'Thanks for your business — payment due in 14 days.',
  customer:{name:'Jen Smith',email:'jen@example.com',phone:'+14035551234'}, customer_name:'Jen Smith',
  contractor_name:'Mike Sullivan', contractor_company:'Comfort Air HVAC Ltd.',
  contractor_phone:'+14035550101', contractor_email:'mike@comfortair.example',
  province:'AB', country:'CA',
  invoice_items:[
    {id:'l1',name:'Remove & dispose of existing furnace + AC',quantity:1,unit_price:475,included:true},
    {id:'l2',name:'Supply & install gas furnace — 96% AFUE',quantity:1,unit_price:4180,included:true},
    {id:'l3',name:'Supply & install central AC — 3.5 ton, 16 SEER',quantity:1,unit_price:4625,included:true},
    {id:'l4',name:'Lineset, flue liner, electrical & thermostat',quantity:1,unit_price:1550,included:true},
  ],
  subtotal:10830, tax:542, stripe_connect_enabled:true, payment_methods:['stripe','etransfer'], etransfer_email:'mike@comfortair.example',
};

async function mockQuote(page, override={}){ const q={...QUOTE,...override};
  await page.route('**/api/**',async r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.route('**/api/public-quote*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({quote:q})}));
  await page.route('**/api/public-quote-action*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'approved',deposit_status:'pending'})}));
}
async function mockInv(page, override={}){ const i={...INV,...override};
  await page.route('**/api/**',async r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.route('**/api/public-invoice*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({invoice:i})}));
}

async function run(label, deviceOpts){
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext(deviceOpts); const page=await ctx.newPage();
  await mockQuote(page);
  await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(OUT,`${label}_cust_quote_sent.png`),fullPage:true}).catch(()=>{});
  // approved view
  await page.unroute('**/api/public-quote*').catch(()=>{});
  await mockQuote(page,{status:'approved',signed_at:iso(now),signer_name:'Jen Smith',deposit_status:'requested'});
  await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(OUT,`${label}_cust_quote_approved.png`),fullPage:true}).catch(()=>{});
  // invoice sent
  await mockInv(page);
  await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(OUT,`${label}_cust_invoice_sent.png`),fullPage:true}).catch(()=>{});
  // invoice paid
  await page.unroute('**/api/public-invoice*').catch(()=>{});
  await mockInv(page,{status:'paid',amount_paid:11372,amount_due:0,paid_at:iso(now-864e5)});
  await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(OUT,`${label}_cust_invoice_paid.png`),fullPage:true}).catch(()=>{});
  await browser.close();
  console.log(label+' customer pages captured');
}
await run('mobile', {...devices['iPhone 14 Pro']});
await run('desktop', {viewport:{width:1440,height:900}});
console.log('Artifacts -> '+OUT);
