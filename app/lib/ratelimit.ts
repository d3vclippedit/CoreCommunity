/**
 * KV-backed sliding window rate limiter.
 * Key format: rl:<bucket>:<identifier>
 */
export async function checkRateLimit(
  kv: KVNamespace,
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = `rl:${bucket}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  const raw = await kv.get(key);
  const timestamps: number[] = raw ? JSON.parse(raw) : [];

  // Remove expired entries
  const valid = timestamps.filter((t) => t > windowStart);

  if (valid.length >= limit) {
    const oldest = valid[0];
    return { allowed: false, retryAfterSeconds: oldest + windowSeconds - now };
  }

  valid.push(now);
  await kv.put(key, JSON.stringify(valid), { expirationTtl: windowSeconds + 60 });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
    "unknown"
  );
}
