import { createContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { clearAllOfflineDrafts } from '../lib/offline';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the current session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('[Punchlist] Auth session check failed:', err.message);
      setSession(null);
      setLoading(false);
    });

    // Listen for all auth state changes (login, logout, token refresh, email confirm)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
      // When a user signs out, wipe IndexedDB drafts so the next account
      // that signs in on this device doesn't see phantom quotes from the
      // previous account.
      if (event === 'SIGNED_OUT') {
        clearAllOfflineDrafts().catch(e => console.warn('[Punchlist] offline draft cleanup', e?.message));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signOut: () => supabase.auth.signOut(),
  }), [session, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
