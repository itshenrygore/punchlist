/**
 * Simple in-memory rate limiter for Vercel serverless functions.
 * 
 * Each serverless function instance has its own memory, so this limits
 * per-instance. Good enough for beta (prevents abuse spikes).
 * For multi-region production, swap store for Vercel KV / Upstash Redis.
 */

const store = new Map();

// Purge expired entries every 1000 calls to prevent memory growth
let callCount = 0;
function maybePurge() {
  if (++callCount % 1000 !== 0) return;
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * @param {string} key      - Unique identifier (IP, token, etc.)
 * @param {number} max      - Max requests allowed in the window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {{ limited: boolean, remaining: number, retryAfter: number }}
 */
export function checkRateLimit(key, max, windowMs) {
  maybePurge();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1, retryAfter: 0 };
  }

  entry.count += 1;
  const remaining = Math.max(0, max - entry.count);
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

  return {
    limited: entry.count > max,
    remaining,
    retryAfter,
  };
}

/**
 * Extract the real client IP from Vercel request headers.
 */
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'
  );
}

/**
 * Apply rate limit and send 429 if exceeded.
 * Returns true if the request was blocked (caller should return immediately).
 * 
 * Usage:
 *   if (blocked(res, key, 20, 60_000)) return;
 */
export function blocked(res, key, max, windowMs) {
  const { limited, remaining, retryAfter } = checkRateLimit(key, max, windowMs);

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));

  if (limited) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.',
      retryAfter,
    });
    return true;
  }
  return false;
}
