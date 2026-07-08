import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';

export const config = {
  matcher: ['/api/codes/generate'],
};

interface RateBucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const buckets = new Map<string, RateBucket>();

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return request.ip ?? 'unknown';
}

export function middleware(request: NextRequest): NextResponse {
  const ip = getClientIp(request);
  const now = Date.now();

  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (bucket.count >= env.GATE_RATE_LIMIT_PER_MIN) {
    console.error('[middleware] rate limit exceeded', { ip, count: bucket.count });
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  bucket.count += 1;
  return NextResponse.next();
}
