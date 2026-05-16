# Punchlist — Email Deliverability Audit & Fix Guide

## Current Status

Your emails send from two `from` addresses:
- `notifications@punchlist.ca` — system notifications (bookings, invoices, reminders, receipts)
- `quotes@punchlist.ca` — quote emails (the most important customer-facing email)

Both send from the **root domain** `punchlist.ca` via Resend.

## Why emails are landing in junk

Based on the code audit, here are the most likely causes, ranked by impact:

### 1. SENDING FROM ROOT DOMAIN (high impact)

**Problem:** You're sending from `punchlist.ca` directly. Resend explicitly recommends sending from a **subdomain** (e.g. `mail.punchlist.ca`). If any deliverability issue damages your root domain's reputation, it affects everything — your website's SEO reputation, future email campaigns, all of it.

**Fix:**
1. Go to Resend Dashboard → Domains → Add Domain
2. Add `mail.punchlist.ca` (or `notify.punchlist.ca`)
3. Resend will give you 3 DNS records to add (SPF, DKIM, MX)
4. Add them in your DNS provider (Vercel/Namecheap/Cloudflare — wherever punchlist.ca is managed)
5. Wait for verification (usually <1 hour)
6. Set your Vercel env var: `EMAIL_FROM=Punchlist <notifications@mail.punchlist.ca>`
7. For quotes, the `from` in the code should become:
   `${contractorName} via Punchlist <quotes@mail.punchlist.ca>`

### 2. MISSING OR WEAK DMARC RECORD (high impact)

**Problem:** Without a DMARC record (or with only `p=none`), Gmail/Outlook have no policy to trust your emails. Since May 2025, Microsoft **rejects** emails from domains without DMARC at scale.

**Fix:** Add this TXT record to your DNS:

```
Host: _dmarc.punchlist.ca
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@punchlist.ca; pct=100
```

Start with `p=quarantine`. Once you confirm no legitimate emails fail (check the reports at the `rua` address), upgrade to `p=reject`.

If you set up a subdomain (Step 1), also add:
```
Host: _dmarc.mail.punchlist.ca
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@punchlist.ca; pct=100
```

### 3. SPF RECORD CHECK (high impact)

**Problem:** Your SPF record must include Resend's servers. If it's missing or misconfigured, Gmail/Outlook will soft-fail or reject your emails.

**Fix:** Ensure your SPF TXT record looks like:
```
Host: punchlist.ca (or @)
Type: TXT
Value: v=spf1 include:_spf.resend.com -all
```

Use `-all` (hard fail), not `~all` (soft fail). If you have other email providers (Google Workspace, etc.), include them too:
```
v=spf1 include:_spf.google.com include:_spf.resend.com -all
```

Keep it under 10 DNS lookups total.

### 4. DKIM VERIFICATION (high impact)

**Problem:** Resend handles DKIM automatically when you verify your domain, but if you added the domain before Resend required DNS verification, your DKIM might not be set up.

**Fix:** Go to Resend Dashboard → Domains → click your domain → check that all 3 DNS records show green checkmarks. If any are red, re-add the records.

### 5. MISMATCHED LINK DOMAINS (medium impact)

**Problem:** Your emails are sent from `notifications@punchlist.ca` but some links point to `https://www.punchlist.ca`. This mismatch triggers spam filters.

**Fix (in code — already applied in this build):** Ensure `APP_URL` env var is set to `https://punchlist.ca` (no `www`). If you use `www`, then your email `from` domain should also be `www.punchlist.ca` — but it's easier to standardize on the bare domain.

### 6. DISABLE CLICK TRACKING (medium impact)

**Fix:** In Resend Dashboard → Domains → your domain → disable "Click Tracking" and "Open Tracking". Resend's own docs say:

> "Click tracking modifies links, sometimes causing spam filters to flag emails as suspicious or phishing attempts. Disabling click tracking can help with email deliverability."

For transactional emails (which is ALL of Punchlist's emails), tracking pixels and rewritten links hurt more than they help.

### 7. EMAIL SIZE — KEEP UNDER 102KB (low impact)

Gmail clips emails over 102KB. Your quote emails with many line items could exceed this. The current template is well-structured but if a quote has 30+ items, the HTML could get large.

**Fix (already fine for most quotes):** No action needed unless contractors report clipped emails. If so, truncate the line items list at 20 and add "View all items →" link.

### 8. PLAIN TEXT FALLBACK (low impact)

Your emails are HTML-only. Some spam filters score HTML-only emails slightly higher.

**Fix:** Add a `text` field to every Resend API call alongside `html`. Example:
```js
body: JSON.stringify({
  from: '...',
  to: ['...'],
  subject: '...',
  html: emailHtml,
  text: `Quote from ${contractorName}: ${quote.title}\n\nView and approve: ${shareUrl}`,
})
```

This is a low-priority improvement — it helps marginally with older/corporate email filters.

---

## DNS Checklist (do these in order)

Run each check at https://mxtoolbox.com after adding records.

| # | Record | Host | Type | Value | Check |
|---|--------|------|------|-------|-------|
| 1 | SPF | `punchlist.ca` | TXT | `v=spf1 include:_spf.resend.com -all` | mxtoolbox.com/spf.aspx |
| 2 | DKIM | (from Resend dashboard) | CNAME | (from Resend dashboard) | mxtoolbox.com/dkim.aspx |
| 3 | DMARC | `_dmarc.punchlist.ca` | TXT | `v=DMARC1; p=quarantine; rua=mailto:dmarc@punchlist.ca; pct=100` | mxtoolbox.com/dmarc.aspx |
| 4 | Subdomain | `mail.punchlist.ca` | (add in Resend) | Resend gives you the records | Resend dashboard |

## Resend Dashboard Checklist

- [ ] Domain verified with all 3 DNS records green
- [ ] Click tracking **OFF**
- [ ] Open tracking **OFF**
- [ ] Sending subdomain set up (`mail.punchlist.ca`)
- [ ] API key has correct permissions for the subdomain

## Vercel Env Var Update

After setting up the subdomain:
```
EMAIL_FROM=Punchlist <notifications@mail.punchlist.ca>
```

The quote emails will need one code change (line ~722 in send-quote-email.js):
```js
from: process.env.EMAIL_FROM || 'quotes@mail.punchlist.ca',
```

## Test After Setup

1. Send yourself a test quote to a Gmail address
2. Open the email → click the three dots → "Show original"
3. Check that SPF, DKIM, and DMARC all say **PASS**
4. Send to an Outlook/Hotmail address — confirm it lands in Inbox
5. Use https://mail-tester.com — aim for 9/10 or higher

## Your Architecture Is Actually Strong

Your SMS-first approach for the most critical touchpoint (first quote send) is the right call. Email is the backup channel, not the primary one. The fixes above are about making sure that backup channel actually works — because some customers prefer email, and the quote email serves as a paper trail.

Priority order:
1. **DNS records** (SPF, DKIM, DMARC) — 80% of the fix
2. **Subdomain** — protects your root domain reputation
3. **Disable click/open tracking** — quick win in Resend dashboard
4. **Plain text fallback** — nice-to-have
