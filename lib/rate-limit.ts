const cache = new Map<string, { count: number; expiresAt: number }>();

export function getRateLimit(key: string, limit: number, windowMs: number): { success: boolean; limit: number; remaining: number } {
  const now = Date.now();
  const record = cache.get(key);

  if (!record || now > record.expiresAt) {
    cache.set(key, { count: 1, expiresAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, limit, remaining: 0 };
  }

  record.count += 1;
  cache.set(key, record);
  
  return { success: true, limit, remaining: limit - record.count };
}

// Clean up old entries periodically to prevent memory leaks in long-lived serverless isolates
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiresAt) {
      cache.delete(key);
    }
  }
}, 60000);
