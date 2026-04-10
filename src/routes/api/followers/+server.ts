import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Redis } from '@upstash/redis';
import {
  SCRAPER_API_KEY,
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  DAILY_API_LIMIT
} from '$env/static/private';

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN
});

const HANDLE_REGEX = /^[a-zA-Z0-9_.]{1,30}$/;
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 5;
const CACHE_TTL = 900; // 15 minutes
const SOCIAVAULT_PROFILE_URL = 'https://api.sociavault.com/v1/scrape/instagram/profile';

type SociaVaultResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  data?: {
    success?: boolean;
    error?: string;
    message?: string;
    data?: {
      user?: {
        is_private?: boolean;
        edge_followed_by?: {
          count?: number;
        };
      };
    };
  };
};

function getSociaVaultErrorMessage(data: SociaVaultResponse): string {
  const parts = [data.message, data.error, data.data?.message, data.data?.error];
  return parts.find((part): part is string => typeof part === 'string') ?? '';
}

function todayKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `api:calls:${yyyy}-${mm}-${dd}`;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export const GET: RequestHandler = async ({ request, url }) => {
  // 1. Validate handle
  const handle = url.searchParams.get('handle')?.trim() ?? '';
  if (!handle || !HANDLE_REGEX.test(handle)) {
    return json({ error: 'HANDLE_NOT_FOUND' }, { status: 400 });
  }

  // 2. Per-IP rate limit
  const ip = getClientIp(request);
  const rateLimitKey = `ratelimit:ip:${ip}`;

  try {
    const currentCount = await redis.get<number>(rateLimitKey);
    if (currentCount !== null && currentCount >= RATE_LIMIT_MAX) {
      return json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const pipeline = redis.pipeline();
    pipeline.incr(rateLimitKey);
    pipeline.expire(rateLimitKey, RATE_LIMIT_WINDOW);
    await pipeline.exec();
  } catch {
    // Fail closed on rate limiting — block with 503 if Redis is unavailable
    return json({ error: 'UPSTREAM_ERROR' }, { status: 503 });
  }

  // 3. Check cache
  const cacheKey = `cache:handle:${handle.toLowerCase()}`;
  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached !== null) {
      const followers = parseInt(String(cached), 10);
      if (!isNaN(followers)) {
        return json({ followers, cached: true });
      }
    }
  } catch {
    // Fail open on caching — skip and proceed
  }

  // 4. Check circuit breaker
  const dailyLimit = parseInt(DAILY_API_LIMIT, 10);
  const dailyKey = todayKey();

  try {
    const dailyCount = await redis.get<number>(dailyKey);
    if (dailyCount !== null && dailyCount >= dailyLimit) {
      return json({ error: 'CIRCUIT_BREAKER' }, { status: 503 });
    }
  } catch {
    // Fail closed on circuit breaker
    return json({ error: 'CIRCUIT_BREAKER' }, { status: 503 });
  }

  // 5. Call scraper API
  let followerCount: number;
  try {
    const requestUrl = new URL(SOCIAVAULT_PROFILE_URL);
    requestUrl.searchParams.set('handle', handle);
    requestUrl.searchParams.set('trim', 'true');
    const response = await fetch(requestUrl, {
      headers: {
        'X-API-Key': SCRAPER_API_KEY,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 422) {
        return json({ error: 'HANDLE_NOT_FOUND' }, { status: 404 });
      }
      return json({ error: 'UPSTREAM_ERROR' }, { status: 502 });
    }

    const data = (await response.json()) as SociaVaultResponse;
    const upstreamErrorMessage = getSociaVaultErrorMessage(data).toLowerCase();
    const isNotFoundMessage =
      upstreamErrorMessage.includes('not found') ||
      upstreamErrorMessage.includes('does not exist') ||
      upstreamErrorMessage.includes('invalid handle') ||
      upstreamErrorMessage.includes('invalid username') ||
      upstreamErrorMessage.includes('username not found');

    if (isNotFoundMessage) {
      return json({ error: 'HANDLE_NOT_FOUND' }, { status: 404 });
    }

    const user = data?.data?.data?.user;
    if (user?.is_private) {
      return json({ error: 'PRIVATE_ACCOUNT' }, { status: 403 });
    }

    followerCount = user?.edge_followed_by?.count ?? NaN;
    if (typeof followerCount !== 'number' || isNaN(followerCount)) {
      return json({ error: 'UPSTREAM_ERROR' }, { status: 502 });
    }
  } catch {
    return json({ error: 'UPSTREAM_ERROR' }, { status: 502 });
  }

  // 6. Increment daily call counter
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, 86400);
    await pipeline.exec();
  } catch {
    // Non-critical — proceed anyway
  }

  // 7. Write result to cache
  try {
    await redis.set(cacheKey, followerCount.toString(), { ex: CACHE_TTL });
  } catch {
    // Fail open on caching
  }

  // 8. Return
  return json({ followers: followerCount, cached: false });
};
