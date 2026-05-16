export const clientEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  appUrl: import.meta.env.VITE_APP_URL,
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};

export function requireClientEnv() {
  const missing = [];
  if (!clientEnv.supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!clientEnv.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length) {
    console.error(`[Punchlist] Missing client env vars: ${missing.join(', ')}. Auth will not work.`);
  }
}
