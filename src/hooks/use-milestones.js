import { useEffect, useState, useCallback } from 'react';
import { getProfile, updateProfile } from '../lib/api';

/* ═══════════════════════════════════════════════════════════
   useUserMilestones — Phase 4 milestone hook.

   Single source of truth for user progress milestones.
   Replaces 35+ scattered localStorage reads with a single
   hook that reads from the Supabase profile (cross-device)
   and falls back to localStorage (offline / first load).

   Usage:
     const m = useUserMilestones(user?.id);
     if (!m.isOnboarded) showOnboarding();
     if (m.isFirstSend) showConfetti();

   Milestones (profile columns):
     onboarded_at       — completed onboarding wizard
     first_build_at     — first time tapping "Build Quote"
     first_send_at      — first quote sent (single source, not 3 keys)
     first_describe_at  — first time typing a job description
     coachmarks_dismissed_at — dismissed builder coachmarks
     cmdk_tip_seen      — saw the ⌘K tip toast

   localStorage keys KEPT (device-specific / ephemeral):
     pl_theme, pl_settings_tab, pl_quotes_filter,
     pl_hide_completed, pl_hide_paid

   localStorage keys DELETED by this migration:
     pl_onboarded, pl_has_built_quote, pl_has_sent_quote,
     pl_has_sent_quote_first, pl_first_send_at, pl_first_run,
     pl_welcome_shown, pl_demo_v, pl_coachmarks_dismissed,
     pl_cmdk_tip_seen, pl_first_build_at, pl_first_describe_at,
     pl_signup_at
   ═══════════════════════════════════════════════════════════ */

// Keys to migrate from localStorage → profile on first load
const MIGRATE_MAP = {
  pl_onboarded:            'onboarded_at',
  pl_has_built_quote:      'first_build_at',
  pl_first_build_at:       'first_build_at',
  pl_has_sent_quote:       'first_send_at',
  pl_first_send_at:        'first_send_at',
  pl_has_sent_quote_first: 'first_send_at',
  pl_first_describe_at:    'first_describe_at',
  pl_coachmarks_dismissed: 'coachmarks_dismissed_at',
  pl_cmdk_tip_seen:        'cmdk_tip_seen',
};

// Keys to delete after migration (redundant / dead)
const DELETE_KEYS = [
  'pl_onboarded', 'pl_has_built_quote', 'pl_has_sent_quote',
  'pl_has_sent_quote_first', 'pl_first_send_at', 'pl_first_run',
  'pl_welcome_shown', 'pl_demo_v', 'pl_first_build_at',
  'pl_first_describe_at', 'pl_signup_at', 'pl_coachmarks_dismissed',
  'pl_cmdk_tip_seen',
];

const EMPTY = {
  isOnboarded: false,
  hasBuiltQuote: false,
  hasSentQuote: false,
  isFirstSend: true,
  isFirstBuild: true,
  isFirstDescribe: true,
  coachmarksDismissed: false,
  cmdkTipSeen: false,
  loading: true,
  // Raw timestamps for display
  onboardedAt: null,
  firstBuildAt: null,
  firstSendAt: null,
  firstDescribeAt: null,
};

export default function useUserMilestones(userId) {
  const [milestones, setMilestones] = useState(EMPTY);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        const profile = await getProfile(userId);
        if (cancelled) return;

        // ── Migrate: if profile is empty but localStorage has data, push it up ──
        const updates = {};
        let needsMigrate = false;
        for (const [lsKey, profileCol] of Object.entries(MIGRATE_MAP)) {
          try {
            const lsVal = localStorage.getItem(lsKey);
            if (lsVal && !profile[profileCol]) {
              // Convert "1" to a timestamp, or use existing ISO string
              updates[profileCol] = lsVal === '1' ? new Date().toISOString() : lsVal;
              needsMigrate = true;
            }
          } catch { /* localStorage blocked */ }
        }

        if (needsMigrate) {
          try {
            await updateProfile(userId, updates);
            // Clean up migrated keys
            for (const key of DELETE_KEYS) {
              try { localStorage.removeItem(key); } catch { /* noop */ }
            }
          } catch (e) {
            console.warn('[PL] milestone migration failed:', e);
          }
        }

        if (cancelled) return;

        // Merge profile + any just-migrated data
        const merged = { ...profile, ...updates };

        setMilestones({
          isOnboarded: !!merged.onboarded_at,
          hasBuiltQuote: !!merged.first_build_at,
          hasSentQuote: !!merged.first_send_at,
          isFirstSend: !merged.first_send_at,
          isFirstBuild: !merged.first_build_at,
          isFirstDescribe: !merged.first_describe_at,
          coachmarksDismissed: !!merged.coachmarks_dismissed_at,
          cmdkTipSeen: !!merged.cmdk_tip_seen,
          loading: false,
          onboardedAt: merged.onboarded_at || null,
          firstBuildAt: merged.first_build_at || null,
          firstSendAt: merged.first_send_at || null,
          firstDescribeAt: merged.first_describe_at || null,
        });
      } catch (e) {
        console.warn('[PL] milestone load failed, falling back to localStorage:', e);
        if (cancelled) return;

        // Fallback: read from localStorage
        const ls = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
        setMilestones({
          isOnboarded: !!ls('pl_onboarded'),
          hasBuiltQuote: !!ls('pl_has_built_quote'),
          hasSentQuote: !!ls('pl_has_sent_quote') || !!ls('pl_first_send_at'),
          isFirstSend: !ls('pl_first_send_at'),
          isFirstBuild: !ls('pl_first_build_at') && !ls('pl_has_built_quote'),
          isFirstDescribe: !ls('pl_first_describe_at'),
          coachmarksDismissed: !!ls('pl_coachmarks_dismissed'),
          cmdkTipSeen: !!ls('pl_cmdk_tip_seen'),
          loading: false,
          onboardedAt: ls('pl_onboarded'),
          firstBuildAt: ls('pl_first_build_at'),
          firstSendAt: ls('pl_first_send_at'),
          firstDescribeAt: ls('pl_first_describe_at'),
        });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Mark milestone (writes to profile + localStorage fallback) ──
  const markMilestone = useCallback(async (milestone) => {
    const now = new Date().toISOString();
    const colMap = {
      onboarded: 'onboarded_at',
      built_quote: 'first_build_at',
      sent_quote: 'first_send_at',
      described: 'first_describe_at',
      coachmarks: 'coachmarks_dismissed_at',
      cmdk_tip: 'cmdk_tip_seen',
    };
    const col = colMap[milestone];
    if (!col) return;

    // Optimistic local update
    setMilestones(prev => {
      const next = { ...prev };
      if (milestone === 'onboarded') { next.isOnboarded = true; next.onboardedAt = now; }
      if (milestone === 'built_quote') { next.hasBuiltQuote = true; next.isFirstBuild = false; next.firstBuildAt = now; }
      if (milestone === 'sent_quote') { next.hasSentQuote = true; next.isFirstSend = false; next.firstSendAt = now; }
      if (milestone === 'described') { next.isFirstDescribe = false; next.firstDescribeAt = now; }
      if (milestone === 'coachmarks') { next.coachmarksDismissed = true; }
      if (milestone === 'cmdk_tip') { next.cmdkTipSeen = true; }
      return next;
    });

    // Persist to profile
    if (userId) {
      try {
        await updateProfile(userId, { [col]: now });
      } catch (e) {
        console.warn('[PL] milestone persist failed:', e);
      }
    }

    // localStorage fallback (for offline / pre-auth)
    const lsMap = {
      onboarded: 'pl_onboarded',
      built_quote: 'pl_has_built_quote',
      sent_quote: 'pl_first_send_at',
      described: 'pl_first_describe_at',
      coachmarks: 'pl_coachmarks_dismissed',
      cmdk_tip: 'pl_cmdk_tip_seen',
    };
    try { localStorage.setItem(lsMap[milestone], now); } catch { /* noop */ }
  }, [userId]);

  return { ...milestones, markMilestone };
}
