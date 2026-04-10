import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, DAILY_API_LIMIT } from '$env/static/private';

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN
});

function todayKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `api:calls:${yyyy}-${mm}-${dd}`;
}

export async function isCircuitOpen(): Promise<boolean> {
  const limit = parseInt(DAILY_API_LIMIT, 10);
  const key = todayKey();
  const count = await redis.get<number>(key);
  return (count ?? 0) >= limit;
}

export async function incrementCallCount(): Promise<void> {
  const key = todayKey();
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 86400);
  await pipeline.exec();
}
