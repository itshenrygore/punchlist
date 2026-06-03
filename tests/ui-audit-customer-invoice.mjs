// Customer INVOICE interactive flows audit — payment paths, partial paid,
// overdue, mark-paid by e-transfer, retry-payment.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE='http://localhost:4173';
const OUT=path.resolve('tests/audit-runs/customer-invoice-flows');
fs.mkdirSync(OUT,{recursive:true});

const INV={
  id:'inv1', number:'INV-2026-001', invoice_number:'INV-2026-001',
  status:'sent', total:11372, amount_due:11372, amount_paid:0, currency:'CAD',
  due_at:new Date(Date.now()+14*864e5).toISOString(),
  issued_at:new Date(Date.now()-1*864e5).toISOString(),
  paid_at:null, share_token:'ist1', country:'CA',
  notes:'Thanks for your business — payment due in 14 days.',
  customer:{name:'Jen Smith', email:'jen@example.com', phone:'+14035551234'},
  customer_name:'Jen Smith',
  contractor_name:'Mike Sullivan', contractor_company:'Comfort Air HVAC Ltd.',
  contractor_phone:'+14035550101', contractor_email:'mike@comfortair.example',
  contractor_logo:null,
  line_items:[
    {id:'l1',name:'Remove & dispose of existing furnace + AC',description:'Disconnect, drain, haul to recycling depot',quantity:1,unit_price:475},
    {id:'l2',name:'Supply & install gas furnace — 96% AFUE, 80k BTU',description:'Lennox EL296 with variable-speed blower',quantity:1,unit_price:4180},
    {id:'l3',name:'Supply & install central AC — 3.5 ton, 16 SEER',description:'Outdoor condenser pad + lineset + start-up',quantity:1,unit_price:4625},
    {id:'l4',name:'Lineset, flue liner, electrical & Ecobee thermostat',description:'Includes city permit + inspection',quantity:1,unit_price:1550},
  ],
  subtotal:10830, tax:542,
  stripe_connect_enabled:true, payment_methods:['stripe','etransfer'],
  etransfer_email:'mike@comfortair.example',
};

async function mock(page,override={}){
  const inv={...INV,...override};
  await page.route('**/api/public-invoice*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({invoice:inv})}));
  await page.route('**/api/create-payment-session*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'https://checkout.stripe.com/mock/sess_xyz'})}));
}
async function overflow(page){return await page.evaluate(()=>{const vw=innerWidth,out=[];if(document.documentElement.scrollWidth>vw+2)out.push('h-scroll '+document.documentElement.scrollWidth+'>'+vw);document.querySelectorAll('*').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&r.height>0&&r.right>vw+3&&r.left>=-1&&r.width<=vw&&getComputedStyle(el).position!=='fixed')out.push((el.className||el.tagName).toString().slice(0,30)+' R='+Math.round(r.right));});return [...new Set(out)].slice(0,6);});}

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({...devices['iPhone 14 Pro']});
const page=await ctx.newPage();
const findings=[];
async function snap(name,note=''){await page.screenshot({path:path.join(OUT,name+'.png')}).catch(()=>{});const o=await overflow(page);findings.push({name,note,issues:o});console.log(`${name.padEnd(34)} ${o.length?'⚠ '+o.join(' | '):'ok'}${note?'  ['+note+']':''}`);}

// 1. Sent invoice, payment due
await mock(page);
await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('01_sent_payment_due');

// 2. Overdue invoice
await mock(page,{status:'overdue',due_at:new Date(Date.now()-7*864e5).toISOString()});
await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('02_overdue');

// 3. Partial paid
await mock(page,{status:'partially_paid',amount_paid:5000,amount_due:6372});
await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('03_partial_paid');

// 4. Fully paid
await mock(page,{status:'paid',amount_paid:11372,amount_due:0,paid_at:new Date(Date.now()-1*864e5).toISOString()});
await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('04_paid');

// 5. Pay via card — click "Pay now"
await mock(page);
await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
const pay=page.locator('button:has-text("Pay"), a:has-text("Pay")').first();
if(await pay.count()){await pay.click().catch(()=>{});await page.waitForTimeout(900);await snap('05_after_pay_tap','Stripe checkout kickoff');}

// 6. Card processing redirect-back (success polling state)
await mock(page);
await page.goto(BASE+'/i/ist1?payment=success',{waitUntil:'networkidle'});await page.waitForTimeout(2200);
await snap('06_payment_processing','polling banner');

// 7. E-transfer instructions toggle
await mock(page);
await page.goto(BASE+'/i/ist1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
const eTransfer=page.getByRole('button',{name:/e.?transfer|other payment/i}).first();
if(await eTransfer.count()){await eTransfer.click().catch(()=>{});await page.waitForTimeout(700);await snap('07_etransfer_instructions');}

// 8. Bad token — 404 / unavailable
await page.route('**/api/public-invoice*',async r=>r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'not found'})}));
await page.goto(BASE+'/i/bogus',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
await snap('08_invoice_404');

// 9. Server error
await page.route('**/api/public-invoice*',async r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'server'})}));
await page.goto(BASE+'/i/anything',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
await snap('09_invoice_500');

await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(findings,null,2));
console.log('\nArtifacts → '+OUT);
const probs=findings.filter(f=>f.issues.length);
if(probs.length)probs.forEach(p=>console.log('   '+p.name+': '+p.issues.join(' | ')));
else console.log('\n✓ No overflow issues across customer invoice flows.');
