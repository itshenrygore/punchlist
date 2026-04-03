# Punchlist v61

Multi-trade quote management SaaS for Canadian and US small trades businesses.

## Serverless Functions (12 total, at Vercel Hobby 12 limit)

| Function | Purpose | Duration |
|----------|---------|----------|
| `ai-scope.js` | AI-powered scope generation (Claude) | 10s |
| `ai-assist.js` | Foreman chat assistant (Claude) | 10s |
| `export-pdf.js` | PDF quote export (Puppeteer) | 10s |
| `send-quote-email.js` | Email delivery (Resend) | 10s |
| `public-quote.js` | Public quote page data | 5s |
| `public-quote-action.js` | Quote approve/decline actions | 10s |
| `public-additional-work.js` | Additional work approval | 10s |
| `public-amendment.js` | Change order / amendment flow | 10s |
| `public-invoice.js` | Public invoice page data | 5s |
| `push-subscribe.js` | Push notification subscription | 5s |
| `create-checkout-session.js` | Stripe checkout | 10s |
| `stripe-webhook.js` | Stripe payment webhooks | 10s |

Helper files (not counted as functions):
- `_tradeBrain.js` — Trade baseline pricing logic
- `_rate-limit.js` — In-memory rate limiting

## Environment Variables (Vercel)

**Required:**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

**Optional (for full features):**
```
RESEND_API_KEY=re_...
EMAIL_FROM=notifications@punchlist.ca
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_APP_URL=https://punchlist.ca
```

## Deployment

1. **Run schema** — Paste `supabase/schema.sql` into Supabase SQL Editor → Run
2. **Wait 15 seconds** — Let PostgREST cache reload
3. **Deploy to Vercel:**
   ```bash
   npx vercel --prod
   ```
   Or drag-and-drop to Vercel dashboard.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind
- **Backend:** Supabase (Postgres + Auth + Storage)
- **AI:** Claude (Haiku 4.5 for text, Sonnet 4 for photos)
- **Payments:** Stripe
- **Email:** Resend
- **PDF:** Puppeteer + @sparticuz/chromium
