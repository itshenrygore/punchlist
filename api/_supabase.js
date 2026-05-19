// Shared Supabase client factory for Vercel serverless functions.
//
// Why this exists: @supabase/supabase-js ^2.57 expects a native global
// WebSocket. Native WebSocket only became stable in Node 22, but Vercel
// can land on Node 20 depending on the project's runtime pin. Without
// the polyfill below, the RealtimeClient constructor inside supabase-js
// throws on the very first DB call with:
//
//   "Node.js 20 detected without native WebSocket support."
//
// …which the endpoint catch-all forwards to the browser as a generic 500.
// We don't use Realtime in serverless — but we still pay the constructor
// cost. Polyfilling globalThis.WebSocket and passing ws as the explicit
// transport eliminates the throw on any Node version.

import ws from 'ws';
import { createClient as _createClient } from '@supabase/supabase-js';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

export function createClient(url, key, opts = {}) {
  return _createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: { transport: ws },
    ...opts,
  });
}
