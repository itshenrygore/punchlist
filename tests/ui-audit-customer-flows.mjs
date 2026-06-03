// Customer-side interactive flows audit — drives the real action sheets
// (Approve & Sign, Decline, Ask question, Request changes), optional
// add-on toggle, and deposit checkout. Captures every state + runs
// overflow detection at iPhone 14 Pro.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE='http://localhost:4173';
const OUT=path.resolve('tests/audit-runs/customer-flows');
fs.mkdirSync(OUT,{recursive:true});

const QUOTE={
  id:'q1', title:'Furnace + AC Replacement — Full System',
  scope_summary:'Replace existing 96k BTU furnace and 3.5-ton AC. New 96% AFUE Lennox furnace + 16 SEER condenser. Includes new lineset, flue liner, Ecobee SmartThermostat, and city permit. Old equipment removed and recycled.',
  assumptions:'Existing gas line and 240V service in place. Indoor coil access via attic.',
  exclusions:'Excludes electrical service upgrades and duct modifications.',
  status:'sent', subtotal:10830, tax:542, total:11372,
  deposit_required:true, deposit_amount:1137, deposit_status:'pending',
  expires_at:new Date(Date.now()+7*864e5).toISOString(),
  revision_number:1, share_token:'st1', trade:'HVAC', province:'AB', country:'CA',
  created_at:new Date(Date.now()-2*864e5).toISOString(),
  line_items:[
    {id:'l1',name:'Remove & dispose of existing furnace + AC',description:'Disconnect, drain, haul to recycling depot',quantity:1,unit_price:475,included:true,item_type:'standard'},
    {id:'l2',name:'Supply & install gas furnace — 96% AFUE, 80k BTU',description:'Lennox EL296 with variable-speed blower',quantity:1,unit_price:4180,included:true,item_type:'standard'},
    {id:'l3',name:'Supply & install central AC — 3.5 ton, 16 SEER',description:'Outdoor condenser pad + lineset + start-up',quantity:1,unit_price:4625,included:true,item_type:'standard'},
    {id:'l4',name:'Lineset, flue liner, electrical & Ecobee thermostat',description:'Includes city permit + inspection',quantity:1,unit_price:1550,included:true,item_type:'standard'},
    {id:'l5',name:'Add humidifier — whole-home Aprilaire 600',description:'Mounted on supply plenum + bypass damper',quantity:1,unit_price:685,included:false,item_type:'optional'},
  ],
  customer:{name:'Jen Smith',email:'jen@example.com',phone:'+14035551234'},
  customer_name:'Jen Smith',
  contractor_name:'Mike Sullivan', contractor_company:'Comfort Air HVAC Ltd.',
  contractor_phone:'+14035550101', contractor_email:'mike@comfortair.example',
  contractor_logo:null,
  payment_methods:['stripe','etransfer'], stripe_connect_enabled:true,
  etransfer_email:'mike@comfortair.example',
  terms_conditions:'50% deposit due to schedule. Balance due on completion. Warranty: 1 year on labour, manufacturer warranty on equipment.',
  conversation:[], linked_invoice:null,
};

async function mock(page,quoteOverride={}){
  const q={...QUOTE,...quoteOverride};
  await page.route('**/api/public-quote*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({quote:q})}));
  await page.route('**/api/public-quote-action*',async r=>{
    // Mimic a successful approve/sign that the UI optimistically updates
    const post=r.request().postDataJSON?.();
    let body={ok:true};
    if(post?.action==='sign'){body={ok:true,quote:{...q,status:'approved',signed_at:new Date().toISOString(),signature_data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',signer_name:'Jen Smith'},signature_data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',signer_name:'Jen Smith',status:'approved',deposit_status:'pending'};}
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.route('**/api/create-checkout*',async r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:'https://checkout.stripe.com/mock/sess_123'})}));
}
async function overflow(page){return await page.evaluate(()=>{const vw=innerWidth,out=[];if(document.documentElement.scrollWidth>vw+2)out.push('h-scroll '+document.documentElement.scrollWidth+'>'+vw);document.querySelectorAll('*').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>0&&r.height>0&&r.right>vw+3&&r.left>=-1&&r.width<=vw&&getComputedStyle(el).position!=='fixed')out.push((el.className||el.tagName).toString().slice(0,30)+' R='+Math.round(r.right));});return [...new Set(out)].slice(0,6);});}

const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({...devices['iPhone 14 Pro']});
const page=await ctx.newPage();
await mock(page);
const findings=[];
async function snap(name,note=''){await page.screenshot({path:path.join(OUT,name+'.png')}).catch(()=>{});const o=await overflow(page);findings.push({name,note,issues:o});console.log(`${name.padEnd(34)} ${o.length?'⚠ '+o.join(' | '):'ok'}${note?'  ['+note+']':''}`);}

// ── 1. Land on quote — full page ──
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('01_quote_landed');

// ── 2. Toggle the optional humidifier on ──
const optToggle=page.locator('input[type=checkbox], .toggle, [role=switch]').filter({hasText:''}).first();
const humidifierRow=page.locator('text=Add humidifier').first();
if(await humidifierRow.count()){
  // The toggle is in the same row — click the row's toggle
  const rowToggle=humidifierRow.locator('xpath=ancestor::*[contains(@class,"row") or contains(@class,"opt")][1]').locator('input[type=checkbox], [role=switch], button').first();
  await rowToggle.click().catch(()=>{});
  await page.waitForTimeout(700);
  await snap('02_optional_humidifier_on','total should now be 12,057');
}

// ── 3. Open the terms checkbox + tap Accept → signature pad ──
await page.evaluate(()=>scrollTo(0,document.body.scrollHeight*0.55));await page.waitForTimeout(400);
const termsCb=page.locator('input[type=checkbox]').filter({hasNot:page.locator('[disabled]')}).last();
await termsCb.check().catch(()=>{});
await page.waitForTimeout(400);
await snap('03_terms_accepted');
const acceptBtn=page.locator('button:has-text("Accept Terms to Approve"), button:has-text("Approve"), .doc-cta-primary').first();
if(await acceptBtn.count()){
  await acceptBtn.click().catch(()=>{});
  await page.waitForTimeout(900);
  await snap('04_signature_pad');
  // try to draw something on the canvas by simulating pointer events
  const canvas=page.locator('canvas').first();
  if(await canvas.count()){
    const box=await canvas.boundingBox();
    if(box){
      // draw a fake squiggle
      await page.mouse.move(box.x+30,box.y+30);
      await page.mouse.down();
      for(let x=40;x<box.width-30;x+=10){await page.mouse.move(box.x+x,box.y+40+Math.sin(x/15)*15);}
      await page.mouse.up();
      await page.waitForTimeout(300);
      // Type signer name if present
      const nameField=page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
      if(await nameField.count())await nameField.fill('Jen Smith').catch(()=>{});
      await page.waitForTimeout(400);
      await snap('05_signature_drawn');
      // Submit
      const submitSig=page.locator('button:has-text("Approve & Sign"), button:has-text("Sign and approve"), button:has-text("Approve"), button:has-text("Sign"), .doc-cta-primary').last();
      if(await submitSig.count()){await submitSig.click().catch(()=>{});await page.waitForTimeout(1200);await snap('06_after_sign','should be approved + show signature');}
    }
  }
}

// ── 4. Reset for decline / ask / changes — reload to a fresh sent quote ──
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
// "Not the right fit — decline this quote"
const declineLink=page.locator('text=Not the right fit, text=decline this quote').first();
if(await declineLink.count()){await declineLink.click().catch(()=>{});await page.waitForTimeout(700);await snap('07_decline_sheet');await page.keyboard.press('Escape').catch(()=>{});}

// ── 5. Ask a question ──
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const askBtn=page.locator('button:has-text("Ask a question"), button:has-text("Ask question")').first();
if(await askBtn.count()){await askBtn.click().catch(()=>{});await page.waitForTimeout(700);await snap('08_ask_question_sheet');
  // Type in the textarea
  const ta=page.locator('textarea').first();
  if(await ta.count()){await ta.fill('Can the install start next Tuesday?').catch(()=>{});await page.waitForTimeout(300);await snap('09_question_typed');}
  await page.keyboard.press('Escape').catch(()=>{});
}

// ── 6. Request changes ──
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1200);
const reqChanges=page.locator('button:has-text("Request changes")').first();
if(await reqChanges.count()){await reqChanges.click().catch(()=>{});await page.waitForTimeout(700);await snap('10_request_changes_sheet');await page.keyboard.press('Escape').catch(()=>{});}

// ── 7. Expired quote ──
await mock(page,{status:'sent',expires_at:new Date(Date.now()-2*864e5).toISOString()});
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('11_expired');

// ── 8. Declined state ──
await mock(page,{status:'declined',declined_at:new Date().toISOString()});
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('12_declined_state');

// ── 9. Approved + deposit pending (deposit CTA) ──
await mock(page,{status:'approved',signed_at:new Date().toISOString(),signer_name:'Jen Smith',signature_data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',deposit_status:'pending'});
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('13_approved_deposit_pending');
const payBtn=page.locator('button:has-text("Pay"), a:has-text("Pay")').first();
if(await payBtn.count()){await payBtn.click().catch(()=>{});await page.waitForTimeout(1000);await snap('14_after_pay_tap','should kick off Stripe checkout');}

// ── 10. Deposit paid ──
await mock(page,{status:'deposit_paid',signed_at:new Date().toISOString(),signer_name:'Jen Smith',signature_data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',deposit_status:'paid',deposit_paid_at:new Date().toISOString()});
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('15_deposit_paid');

// ── 11. Linked invoice banner ──
await mock(page,{status:'converted_to_invoice',linked_invoice:{share_token:'ist1',status:'sent',total:11372,due_at:new Date(Date.now()+13*864e5).toISOString()}});
await page.goto(BASE+'/q/st1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
await snap('16_linked_invoice_banner');

await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(findings,null,2));
console.log('\nArtifacts → '+OUT);
const problems=findings.filter(f=>f.issues.length);
if(problems.length){console.log('\n⚠ overflow issues:'); problems.forEach(p=>console.log('   '+p.name+': '+p.issues.join(' | ')));} else console.log('\n✓ No overflow issues detected.');
