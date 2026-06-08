# Punchlist Mobile Demo — Stitch Guide

30 frames × ~1 second each = **~30 second product reel**.

Captured at **iPhone 14 Pro × 3x DPI** so the screens stay crisp at any export
resolution you'd use (Instagram Reels 1080×1920, LinkedIn 1080×1080 crop, web hero).

## What to do with the frames

Drop the numbered PNGs into the editor of your choice. Set each frame to the
hold time below. No voiceover required — the story carries on text overlays
and momentum alone. If you want voiceover or music, the cuts are designed to
land on visual beats so a tight 28-32s VO fits cleanly.

**Suggested editors:** CapCut (free, has "make video from images"), Descript,
iMovie. Drag the folder in, set duration per frame, export. ~5 minutes.

---

## Story arc

| Act | Frames | What's happening |
|-----|--------|------------------|
| **1. A job lands** | 01–04 | Real water heater leak, contractor types it |
| **2. AI builds the scope** | 05–10 | Items + pricing appear, contractor sends the quote |
| **3. Customer approves in one tap** | 11–15 | Beautiful proposal, "Approve quote" → name → done |
| **4. Foreman coaches the job** | 16–22 | Contractor opens the approved quote, chip strip, "What to bring" → real materials list |
| **5. Get paid** | 23–30 | Create invoice → text customer → mark paid → revenue chip on dashboard |

---

## Per-frame timing + suggested overlay text

| # | File | Hold | On-screen text (optional) |
|---|------|-----:|---------------------------|
| 01 | `01_dashboard_morning.png`        | 1.2s | *Good morning, Mike* |
| 02 | `02_new_quote_empty.png`          | 0.8s | — |
| 03 | `03_typing_start.png`             | 0.5s | — |
| 04 | `04_typing_done.png`              | 1.4s | *Type the job in plain English* |
| 05 | `05_ai_building.png`              | 0.6s | — |
| 06 | `06_scope_filled.png`             | 1.4s | **Punchlist builds the scope** |
| 07 | `07_scope_pricing.png`            | 1.0s | *…with realistic pricing* |
| 08 | `08_review_ready_to_send.png`     | 0.8s | — |
| 09 | `09_send_sheet.png`               | 0.8s | *(holds the same frame — natural "settling" beat)* |
| 10 | `10_sent_to_joe.png`              | 1.5s | **One tap. Out the door.** |
| 11 | `11_cust_quote_hero.png`          | 1.4s | *Your customer sees a real proposal* |
| 12 | `12_cust_quote_items.png`         | 1.0s | — |
| 13 | `13_cust_approve_confirm.png`     | 1.2s | **One-tap approve** |
| 14 | `14_cust_approved.png`            | 0.8s | — |
| 15 | `15_cust_approved_state.png`      | 1.2s | *Approved by Joe Smith ✓* |
| 16 | `16_dashboard_approved_in.png`    | 1.0s | *You get a text. Approved.* |
| 17 | `17_contractor_approved_view.png` | 0.8s | — |
| 18 | `18_foreman_chip_strip.png`       | 1.5s | **Meet Foreman** |
| 19 | `19_foreman_opens_with_prefill.png`| 0.9s | — |
| 20 | `20_foreman_responds.png`         | 1.4s | *Knows your trade. Knows your job.* |
| 21 | `21_foreman_full_answer.png`      | 1.5s | *(extend the answer beat — same frame, gives readers time)* |
| 22 | `22_back_to_quote_after_foreman.png`| 0.8s | — |
| 23 | `23_create_invoice_sheet.png`     | 1.0s | **Invoice + text in one tap** |
| 24 | `24_invoice_sent.png`             | 0.9s | — |
| 25 | `25_invoice_actions.png`          | 0.6s | — |
| 26 | `26_log_payment_form.png`         | 0.8s | — |
| 27 | `27_invoice_paid.png`             | 1.4s | **Paid.** |
| 28 | `28_dashboard_after_paid.png`     | 1.2s | *Tracked. Closed. Caught up.* |
| 29 | `29_analytics_revenue.png`        | 1.4s | *Every job, every dollar* |
| 30 | `30_quotes_list_kicker.png`       | 1.5s | **Punchlist · the quote-to-paid pipeline for tradespeople** |

**Total run time:** ~29.8 seconds.

---

## Suggested voiceover script (28s)

> *"Mike's a plumber. A customer calls — leaking water heater.
> He opens Punchlist, types the job, and the scope, pricing, and proposal
> are ready in 60 seconds.
> One text to the customer. One tap to approve.
> When the deal's signed, Foreman tells him exactly what to bring
> and what to watch out for — every job.
> Invoice goes out by text. He marks it paid.
> Punchlist — the quote-to-paid pipeline for tradespeople."*

Cuts naturally on frames **04, 10, 13, 18, 23, 27, 30**.

---

## Export presets

| Platform | Resolution | Crop | Notes |
|----------|------------|------|-------|
| Instagram Reels / TikTok | 1080×1920 | full-frame iPhone, fits 9:19.5 with letterbox or background blur | Use a brand-color background for letterbox (warm orange `#b85128`) |
| LinkedIn / Web hero | 1080×1080 | center crop with title bar above | Pair with a static caption — no audio needed |
| Email / blog GIF | 720×1280, 15 fps | trim to acts 2 + 3 (frames 05–15) | Compresses to ~3MB |

---

## Notes on the captures

- All UI is the **live app** — not mockups. The data is realistic (Sullivan
  Plumbing, real water-heater scope, $2,210 invoice).
- The Foreman response in frames 20–21 is the real chip prefill firing
  through the assistant; the answer copy is a realistic plumber's checklist.
- The customer view (frames 11–15) is the actual public quote page —
  what real customers see when they open the SMS link.
- Frames are PNG (sharper than JPG for UI text); compress to WebP/MP4 at
  export time.

---

Generated by `tests/marketing-storyboard.mjs`. Re-run anytime to refresh
the frames against the current build:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/marketing-storyboard.mjs
```
