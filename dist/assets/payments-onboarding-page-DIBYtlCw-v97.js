import{u as Y,b as q,j as e,an as j}from"./index-DWe3rtuo-v97.js";import{b as k,h as B,r as u,L as b}from"./react-vendor-BWz5ODu_-v97.js";import"./supabase-ClVc2H6D-v97.js";const I="2026-04-07",_={"individual.first_name":"Your first name","individual.last_name":"Your last name","individual.dob.day":"Date of birth","individual.dob.month":"Date of birth","individual.dob.year":"Date of birth","individual.address.line1":"Your address","individual.address.city":"Your city","individual.address.state":"Your province / state","individual.address.postal_code":"Your postal code","individual.id_number":"Government ID number","individual.ssn_last_4":"Last 4 of your SSN","individual.verification.document":"A photo of your government ID","individual.verification.additional_document":"An additional verification document","individual.phone":"Your phone number","individual.email":"Your email address","business_profile.url":"Your business website","business_profile.mcc":"Your business type","business_profile.product_description":"A description of your services",external_account:"Your bank account details","tos_acceptance.date":"Stripe terms acceptance","tos_acceptance.ip":"Stripe terms acceptance"};function T(t){return _[t]||t.replace(/[._]/g," ").replace(/\b\w/g,n=>n.toUpperCase())}function P(t){const n=new Set;return(t||[]).map(T).filter(s=>n.has(s)?!1:(n.add(s),!0))}function d({children:t,onBack:n,showBack:s=!1}){return e.jsxs("div",{style:{minHeight:"100dvh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px"},children:[s&&e.jsx("button",{onClick:n,style:{position:"fixed",top:"max(16px, env(safe-area-inset-top, 16px))",left:16,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:"8px 14px",fontSize:"var(--text-sm)",color:"var(--text-2)",cursor:"pointer",zIndex:10,display:"flex",alignItems:"center",gap:6},children:"← Back"}),e.jsx("div",{style:{width:"100%",maxWidth:440,animation:"onb-fade-in .4s var(--ease)"},children:t}),e.jsx("style",{children:`
        @keyframes onb-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes onb-check-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes onb-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes onb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }

        /* ── Payments-onboarding shared layout classes (UX-063) ── */
        .po-screen-icon {
          width: 60px; height: 60px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          font-size: var(--text-3xl);
        }
        .po-screen-icon--lg {
          width: 64px; height: 64px;
          font-size: var(--text-4xl);
        }
        .po-screen-heading {
          font-size: clamp(1.3rem, 4.5vw, 1.6rem);
          font-weight: 800;
          letter-spacing: -.04em;
          margin: 0 0 8px;
          color: var(--text);
        }
        .po-screen-heading--lg {
          font-size: clamp(1.5rem, 5vw, 1.85rem);
          margin: 0 0 10px;
          line-height: 1.15;
        }
        .po-screen-subtext {
          font-size: var(--text-sm);
          color: var(--muted);
          line-height: 1.6;
          margin: 0;
          max-width: 360px;
          margin-left: auto;
          margin-right: auto;
        }
        .po-screen-subtext--base {
          font-size: var(--text-base);
          line-height: 1.65;
          max-width: 340px;
        }
        .po-feature-row {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .po-feature-icon {
          font-size: var(--text-2xl);
          line-height: 1;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .po-feature-title {
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--text);
          margin-bottom: 2px;
        }
        .po-feature-sub {
          font-size: var(--text-xs);
          color: var(--muted);
          line-height: 1.45;
        }
        .po-timeline-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .po-timeline-num {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--brand-bg);
          border: 1px solid var(--brand-line);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs); font-weight: 800;
          color: var(--brand);
          flex-shrink: 0;
        }
        .po-timeline-title {
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--text);
        }
        .po-timeline-time {
          font-size: var(--text-2xs);
          color: var(--subtle);
          font-weight: 500;
          white-space: nowrap;
        }
        .po-timeline-desc {
          font-size: var(--text-xs);
          color: var(--muted);
          line-height: 1.45;
          margin-top: 2px;
        }
        .po-screen-center {
          text-align: center;
          margin-bottom: 28px;
        }
        .po-skip-link {
          display: block;
          text-align: center;
          margin-top: 12px;
          font-size: var(--text-sm);
          color: var(--muted);
          text-decoration: none;
        }
        .po-trust-grid {
          display: grid;
          gap: 8px;
          margin-top: 28px;
        }
        .po-footnote {
          text-align: center;
          margin-top: 16px;
          font-size: var(--text-2xs);
          color: var(--subtle);
          line-height: 1.5;
        }
        .po-panel-box {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 20px;
        }
        .po-req-label {
          font-size: var(--text-2xs);
          font-weight: 700;
          color: var(--subtle);
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 10px;
        }
        .po-req-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--amber);
          flex-shrink: 0;
        }
        .po-req-item {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: var(--text-sm);
          color: var(--text-2);
        }
        .po-actions-grid {
          display: grid;
          gap: 10px;
        }
        .po-spinner {
          border-radius: 50%;
          border: 3px solid var(--line);
          border-top-color: var(--brand);
          animation: onb-spin .8s linear infinite;
        }
        .po-screen-text-center {
          text-align: center;
        }
      `})]})}function p({children:t,onClick:n,disabled:s,loading:r,style:l}){return e.jsxs("button",{onClick:n,disabled:s||r,style:{width:"100%",padding:"15px 24px",background:s?"var(--line)":"var(--brand)",color:s?"var(--subtle)":"var(--always-white, #fff)",border:"none",borderRadius:12,fontSize:"var(--text-md)",fontWeight:700,cursor:s?"default":"pointer",transition:"all .2s var(--ease)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:"-.01em",fontFamily:"inherit",...l},children:[r&&e.jsx("div",{style:{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"var(--always-white, #fff)",borderRadius:"50%",animation:"onb-spin .6s linear infinite"}}),t]})}function A({children:t,onClick:n,style:s}){return e.jsx("button",{onClick:n,style:{width:"100%",padding:"13px 24px",background:"var(--panel)",color:"var(--text-2)",border:"1px solid var(--line)",borderRadius:12,fontSize:"var(--text-base)",fontWeight:600,cursor:"pointer",transition:"all .2s var(--ease)",fontFamily:"inherit",...s},children:t})}function y({icon:t,text:n}){return e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,fontSize:"var(--text-xs)",color:"var(--muted)",lineHeight:1.4},children:[e.jsx("span",{style:{fontSize:"var(--text-md)",flexShrink:0},children:t}),e.jsx("span",{children:n})]})}function L({onNext:t}){return e.jsxs(d,{children:[e.jsx(j,{current:0,total:4}),e.jsxs("div",{className:"po-screen-center",style:{marginBottom:32},children:[e.jsx("div",{className:"po-screen-icon po-screen-icon--lg",style:{background:"var(--brand-bg)",border:"1px solid var(--brand-line)"}}),e.jsx("h1",{className:"po-screen-heading po-screen-heading--lg",children:"Get paid faster"}),e.jsx("p",{className:"po-screen-subtext po-screen-subtext--base",children:"Let your customers pay directly from your quotes — by card or monthly installments on bigger jobs. You always get the full amount."})]}),e.jsx("div",{className:"po-actions-grid",style:{marginBottom:32},children:[{icon:"⚡",title:"Customers pay right from the quote",sub:"No chasing e-transfers or waiting for cheques"},{icon:"📱",title:"Monthly payments close bigger jobs",sub:"A $6K job becomes $250/mo — easier to say yes"},{icon:"✅",title:"You get the full amount",sub:"Deposited to your bank within 2 business days"}].map(({icon:n,title:s,sub:r})=>e.jsxs("div",{className:"po-feature-row",children:[e.jsx("span",{className:"po-feature-icon",children:n}),e.jsxs("div",{children:[e.jsx("div",{className:"po-feature-title",children:s}),e.jsx("div",{className:"po-feature-sub",children:r})]})]},s))}),e.jsx(p,{onClick:t,children:"Set up payments"}),e.jsx("div",{className:"po-skip-link",children:e.jsx(b,{to:"/app/settings",className:"po-skip-link",children:"Maybe later"})}),e.jsxs("div",{className:"po-trust-grid",children:[e.jsx(y,{icon:"🔒",text:"Powered by Stripe — trusted by millions of businesses"}),e.jsx(y,{icon:"🆓",text:"No monthly fees. You only pay a small processing fee when you get paid."})]})]})}function E({onNext:t,onBack:n}){return e.jsxs(d,{showBack:!0,onBack:n,children:[e.jsx(j,{current:1,total:4}),e.jsxs("div",{className:"po-screen-center",children:[e.jsx("div",{className:"po-screen-icon",style:{background:"var(--blue-bg)",border:"1px solid rgba(96,165,250,.2)",width:56,height:56,borderRadius:14,margin:"0 auto 18px"}}),e.jsx("h1",{className:"po-screen-heading",children:"This only takes about 2 minutes"}),e.jsx("p",{className:"po-screen-subtext",children:"Here's what you'll need:"})]}),e.jsx("div",{className:"po-feature-row",style:{flexDirection:"column",gap:0,padding:"20px",borderRadius:14,marginBottom:28},children:e.jsx("div",{style:{display:"grid",gap:18},children:[{num:"1",title:"Basic info",desc:"Your name, address, and date of birth",time:"30 sec"},{num:"2",title:"Bank details",desc:"Where you want payouts deposited",time:"30 sec"},{num:"3",title:"Quick verification",desc:"Stripe verifies your identity — usually instant",time:"~1 min"}].map(({num:s,title:r,desc:l,time:a})=>e.jsxs("div",{className:"po-timeline-row",children:[e.jsx("div",{className:"po-timeline-num",style:{borderRadius:8},children:s}),e.jsxs("div",{style:{flex:1},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8},children:[e.jsx("span",{className:"po-timeline-title",children:r}),e.jsx("span",{className:"po-timeline-time",children:a})]}),e.jsx("div",{className:"po-timeline-desc",children:l})]})]},s))})}),e.jsx(p,{onClick:t,children:"Continue"}),e.jsx("div",{className:"po-trust-grid",style:{marginTop:24},children:e.jsx(y,{icon:"🔒",text:"All information is encrypted and sent directly to Stripe"})})]})}function O({onNext:t,onBack:n,loading:s}){const[r,l]=u.useState(!1);return e.jsxs(d,{showBack:!0,onBack:n,children:[e.jsx(j,{current:2,total:4}),e.jsxs("div",{className:"po-screen-center",style:{marginBottom:24},children:[e.jsx("h1",{className:"po-screen-heading",children:"One quick thing"}),e.jsx("p",{className:"po-screen-subtext",children:"When customers pay through your quotes, you're the one doing the work and handling the relationship."})]}),e.jsx("div",{className:"po-feature-row",style:{flexDirection:"column",gap:0,padding:"20px",borderRadius:14,marginBottom:24},children:e.jsxs("div",{style:{display:"grid",gap:14,fontSize:"var(--text-sm)",color:"var(--text-2)",lineHeight:1.6},children:[e.jsxs("div",{className:"po-timeline-row",style:{gap:10},children:[e.jsx("span",{className:"po-feature-icon",style:{fontSize:"var(--text-md)"},children:"🤝"}),e.jsx("span",{children:"Payments go directly from your customer to you — Punchlist facilitates the technology but isn't a party to your agreements."})]}),e.jsxs("div",{className:"po-timeline-row",style:{gap:10},children:[e.jsx("span",{style:{flexShrink:0,display:"inline-flex",color:"var(--muted)",marginTop:1},children:e.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",width:"15",height:"15",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"})})}),e.jsx("span",{children:"You're responsible for job quality, customer disputes, refunds, and chargebacks — just like any other payment you'd accept."})]})]})}),e.jsxs("label",{style:{display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer",padding:"16px",background:r?"var(--brand-bg)":"var(--panel)",border:`1px solid ${r?"var(--brand-line)":"var(--line)"}`,borderRadius:12,marginBottom:24,transition:"all .2s var(--ease)"},children:[e.jsx("div",{style:{width:22,height:22,borderRadius:6,border:`2px solid ${r?"var(--brand)":"var(--line-2)"}`,background:r?"var(--brand)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all .2s var(--ease)",animation:r?"onb-check-pop .25s var(--ease)":"none"},children:r&&e.jsx("svg",{width:"12",height:"10",viewBox:"0 0 12 10",fill:"none",children:e.jsx("path",{d:"M1 5L4.5 8.5L11 1.5",stroke:"#fff",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})})}),e.jsx("input",{type:"checkbox",checked:r,onChange:a=>l(a.target.checked),style:{position:"absolute",opacity:0,pointerEvents:"none"}}),e.jsxs("span",{style:{fontSize:"var(--text-sm)",color:"var(--text-2)",lineHeight:1.55},children:["I understand that I'm responsible for the work I quote and any disputes with my customers. I agree to the"," ",e.jsx("a",{href:"/terms",target:"_blank",rel:"noopener",style:{color:"var(--brand)",textDecoration:"underline",textUnderlineOffset:2},children:"Terms of Service"})," ","and"," ",e.jsx("a",{href:"/terms#payments",target:"_blank",rel:"noopener",style:{color:"var(--brand)",textDecoration:"underline",textUnderlineOffset:2},children:"Payment Terms"}),"."]})]}),e.jsx(p,{onClick:()=>t(),disabled:!r,loading:s,children:"Continue to secure setup"}),e.jsx("p",{className:"po-footnote",children:"You'll be redirected to Stripe to enter your bank details and verify your identity. Punchlist never sees your banking information."})]})}function W(){return e.jsx(d,{children:e.jsxs("div",{className:"po-screen-text-center",children:[e.jsx("div",{className:"po-spinner",style:{width:48,height:48,margin:"0 auto 24px"}}),e.jsx("h2",{className:"po-screen-heading",style:{fontSize:"var(--text-xl)",fontWeight:700},children:"Taking you to Stripe…"}),e.jsx("p",{className:"po-screen-subtext",children:"You'll finish setup on Stripe's secure site, then come right back."})]})})}function D({returnTo:t}){const n=k();return e.jsx(d,{children:e.jsxs("div",{className:"po-screen-text-center",children:[e.jsx("div",{className:"po-screen-icon",style:{width:72,height:72,borderRadius:18,background:"var(--green-bg)",border:"1px solid var(--green-line)",margin:"0 auto 24px",fontSize:"var(--text-5xl)",animation:"onb-check-pop .4s var(--ease) .2s both"},children:"✅"}),e.jsx("h1",{className:"po-screen-heading po-screen-heading--lg",style:{margin:"0 0 10px"},children:"You're ready to get paid"}),e.jsxs("p",{className:"po-screen-subtext po-screen-subtext--base",style:{margin:"0 0 8px"},children:["Customers will see a ",e.jsx("strong",{style:{color:"var(--text)"},children:"Pay Now"})," button on every quote and invoice you send. Card payments and monthly installment options are now live."]}),e.jsx("p",{style:{fontSize:"var(--text-xs)",color:"var(--subtle)",lineHeight:1.5,margin:"0 0 32px"},children:"Funds are deposited to your bank within 2 business days."}),e.jsxs("div",{className:"po-actions-grid",children:[e.jsx(p,{onClick:()=>n(t||"/app/quotes/new"),children:t?"Back to your quote":"Create a quote"}),e.jsx(A,{onClick:()=>n("/app"),children:"Go to dashboard"})]})]})})}function F({onResume:t,loading:n}){return e.jsxs(d,{children:[e.jsxs("div",{className:"po-screen-center",children:[e.jsx("div",{className:"po-screen-icon",style:{background:"var(--amber-bg)",border:"1px solid rgba(245,158,11,.2)"},children:"🔄"}),e.jsx("h1",{className:"po-screen-heading",children:"Finish setting up payments"}),e.jsx("p",{className:"po-screen-subtext",style:{maxWidth:340},children:"You started the setup but didn't finish. Pick up right where you left off — it only takes a minute or two."})]}),e.jsx(p,{onClick:t,loading:n,children:"Resume secure setup"}),e.jsx(b,{to:"/app/settings",className:"po-skip-link",children:"I'll do this later"}),e.jsx("div",{className:"po-trust-grid",style:{marginTop:24,gap:0},children:e.jsx(y,{icon:"🔒",text:"Your progress is saved. You won't need to re-enter anything."})})]})}function M(){const t=k();return e.jsxs(d,{children:[e.jsxs("div",{className:"po-screen-center",children:[e.jsx("div",{className:"po-screen-icon",style:{background:"var(--blue-bg)",border:"1px solid rgba(96,165,250,.2)"},children:"🔍"}),e.jsx("h1",{className:"po-screen-heading",children:"Your account is being reviewed"}),e.jsx("p",{className:"po-screen-subtext",children:"Stripe is verifying your details. This usually takes a few minutes, but can sometimes take up to 24 hours. We'll let you know as soon as you're approved."})]}),e.jsx(p,{onClick:()=>t("/app"),children:"Back to dashboard"}),e.jsx("p",{className:"po-footnote",children:"You don't need to do anything — we'll email you when it's ready."})]})}function U({requirements:t,onFix:n,loading:s}){const r=P(t);return e.jsxs(d,{children:[e.jsxs("div",{className:"po-screen-center",style:{marginBottom:24},children:[e.jsx("div",{className:"po-screen-icon",style:{background:"var(--amber-bg)",border:"1px solid rgba(245,158,11,.2)"},children:"⚠"}),e.jsx("h1",{className:"po-screen-heading",children:"Stripe needs a few more details"}),e.jsx("p",{className:"po-screen-subtext",children:"Almost there — just a couple of things to finish up."})]}),r.length>0&&e.jsxs("div",{style:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,padding:"16px 18px",marginBottom:24},children:[e.jsx("div",{className:"po-req-label",children:"What's needed"}),e.jsx("div",{className:"po-actions-grid",style:{gap:8},children:r.map(l=>e.jsxs("div",{className:"po-req-item",children:[e.jsx("div",{className:"po-req-dot"}),l]},l))})]}),e.jsx(p,{onClick:n,loading:s,children:"Fix this now"}),e.jsx(b,{to:"/app/settings",className:"po-skip-link",children:"I'll do this later"})]})}function H({onFix:t,loading:n}){return e.jsxs(d,{children:[e.jsxs("div",{className:"po-screen-center",style:{marginBottom:24},children:[e.jsx("div",{className:"po-screen-icon",style:{background:"var(--red-bg)",border:"1px solid rgba(239,68,68,.2)"},children:"🚫"}),e.jsx("h1",{className:"po-screen-heading",children:"Your payment setup needs attention"}),e.jsx("p",{className:"po-screen-subtext",children:"Stripe has paused your account. This usually means they need an updated document or additional verification. Let's get it fixed."})]}),e.jsx(p,{onClick:t,loading:n,style:{background:"var(--red)"},children:"Fix payment setup"}),e.jsx(b,{to:"/app/settings",className:"po-skip-link",children:"Back to settings"})]})}function N(){return e.jsx(d,{children:e.jsxs("div",{className:"po-screen-text-center",children:[e.jsx("div",{className:"po-spinner",style:{width:40,height:40,margin:"0 auto 20px"}}),e.jsx("p",{style:{fontSize:"var(--text-base)",color:"var(--muted)"},children:"Checking your payment status…"})]})})}function V(){const{user:t}=Y();k();const{show:n}=q(),[s]=B(),r=s.get("return")||null,l=s.get("connect"),[a,i]=u.useState("loading"),[g,h]=u.useState(!1),[x,S]=u.useState(null),w=u.useRef(!1),f=u.useCallback(async()=>{if(!t)return null;try{const o=await(await fetch("/api/connect-onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",userId:t.id})})).json();return S(o),o.onboarded&&o.chargesEnabled?i("success"):o.paymentState==="action_required"?i("action_required"):o.paymentState==="restricted"?i("restricted"):o.paymentState==="pending_review"?i("pending"):o.connected&&!o.onboarded&&o.termsAccepted?i("resume"):i("intro"),o}catch{return i("intro"),null}},[t]);u.useEffect(()=>{w.current||!t||(w.current=!0,l==="complete"?f().then(()=>{window.history.replaceState({},"","/app/payments/setup"+(r?`?return=${encodeURIComponent(r)}`:""))}):l==="refresh"?f().then(c=>{c!=null&&c.connected?m(!0):i("intro")}):f())},[t,l,f,r]);async function m(c=!1){if(t){h(!0),i("redirect");try{const z=c||(x==null?void 0:x.connected)?"refresh":"create",R="/app/payments/setup"+(r?`?return=${encodeURIComponent(r)}`:""),v=await(await fetch("/api/connect-onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:z,userId:t.id,returnPath:R})})).json();v.url?window.location.href=v.url:(n(v.error||"Could not start Stripe setup. Try again.","error"),i("intro"),h(!1))}catch{n("Connection error. Check your internet and try again.","error"),i("intro"),h(!1)}}}async function C(){if(t){h(!0);try{const o=await(await fetch("/api/connect-onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"accept_terms",userId:t.id,termsVersion:I})})).json();if(!o.ok)throw new Error(o.error);await m()}catch(c){n((c==null?void 0:c.message)||"Something broke on our end. Try again in a moment.","error"),h(!1)}}}return a==="loading"?e.jsx(N,{}):a==="intro"?e.jsx(L,{onNext:()=>i("expect")}):a==="expect"?e.jsx(E,{onNext:()=>i("acknowledge"),onBack:()=>i("intro")}):a==="acknowledge"?e.jsx(O,{onNext:C,onBack:()=>i("expect"),loading:g}):a==="redirect"?e.jsx(W,{}):a==="success"?e.jsx(D,{returnTo:r}):a==="resume"?e.jsx(F,{onResume:m,loading:g}):a==="pending"?e.jsx(M,{}):a==="action_required"?e.jsx(U,{requirements:(x==null?void 0:x.requirements)||[],onFix:m,loading:g}):a==="restricted"?e.jsx(H,{onFix:m,loading:g}):e.jsx(N,{})}export{V as default};
