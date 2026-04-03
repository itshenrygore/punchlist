import { createClient } from '@supabase/supabase-js';
import { clientEnv, requireClientEnv } from './env';

requireClientEnv();

export const supabase = createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
