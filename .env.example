# ═════════════════════════════════════════════════════════════════════════
# PUNCHLIST — Environment variables
# Copy this file to `.env` (local dev) and configure each var in your
# Vercel project dashboard for production. NEVER commit actual secrets.
#
# Vars prefixed with `VITE_` are exposed to the browser (client-side).
# All others are server-only (used by /api/* serverless functions).
# ═════════════════════════════════════════════════════════════════════════

# ── Supabase (REQUIRED) ──────────────────────────────────────────────────
# Both client- and server-side need the URL. Anon key for the browser,
# service role key for server functions (RPC, RLS-bypassing operations).
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# ── App URL (REQUIRED) ───────────────────────────────────────────────────
# Used to build absolute share links in SMS / email templates.
# In Vercel set both to your production URL (e.g. https://punchlist.ca).
VITE_APP_URL=https://punchlist.ca
APP_URL=https://punchlist.ca

# ── Twilio (REQUIRED for SMS sending and nudges) ─────────────────────────
# Without these, /api/send-sms and /api/send-followup return 503 with a
# clear "Text sending is not set up yet" error rather than silently failing.
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+16475551234

# ── Resend (REQUIRED for email sending) ──────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxx
EMAIL_FROM=notifications@punchlist.ca

# ── Stripe (REQUIRED for billing + customer payments) ────────────────────
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_MONTHLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_YEARLY=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_PORTAL_CONFIG_ID=bpc_xxxxxxxxxxxxxxxxxxxx

# ── Anthropic (REQUIRED for Foreman AI assistant + AI scope build) ───────
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx

# ── Web Push (OPTIONAL — for browser push notifications) ─────────────────
# Generate with: npx web-push generate-vapid-keys
VITE_VAPID_PUBLIC_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:you@yourdomain.com

# ── OpenAI (OPTIONAL — alternative AI backend, currently unused) ─────────
VITE_OPENAI_API_KEY=
