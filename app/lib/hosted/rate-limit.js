export function createRateLimiter({ max, windowMs }) {
  const hits = new Map();

  function prune(now) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  return {
    take(ip) {
      if (!ip) return { ok: true, remaining: max };
      const now = Date.now();
      prune(now);
      const entry = hits.get(ip) ?? { count: 0, resetAt: now + windowMs };
      if (entry.count >= max) {
        return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
      }
      entry.count += 1;
      hits.set(ip, entry);
      return { ok: true, remaining: max - entry.count };
    },
  };
}
