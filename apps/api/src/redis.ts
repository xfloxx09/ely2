import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(url);
  }
  return redis;
}

export async function checkRateLimit(userId: string, tier: string): Promise<{ allowed: boolean; remaining: number }> {
  if (tier !== "FREE") return { allowed: true, remaining: -1 };

  const r = getRedis();
  const today = new Date().toISOString().slice(0, 10);
  const key = `msg_limit:${userId}:${today}`;
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 86400);

  const limit = 20;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function incrementMessageCount(userId: string): Promise<void> {
  const r = getRedis();
  const today = new Date().toISOString().slice(0, 10);
  const key = `msg_count:${userId}:${today}`;
  await r.incr(key);
  await r.expire(key, 86400 * 7);
}
