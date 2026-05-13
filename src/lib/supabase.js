import { createClient } from '@supabase/supabase-js';
import { clientEnv, requireClientEnv } from './env';

requireClientEnv();

const url = clientEnv.supabaseUrl || 'https://placeholder.supabase.co';
const key = clientEnv.supabaseAnonKey || 'placeholder';

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
