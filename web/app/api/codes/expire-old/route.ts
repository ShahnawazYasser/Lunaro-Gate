import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { expireOldCodes } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

function isAuthorized(request: Request): boolean {
  const header = request.headers.get('authorization');
  if (!header) {
    return false;
  }

  const expected = `Bearer ${env.CRON_SECRET}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(header);

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    console.error('[POST /api/codes/expire-old] missing or invalid authorization header');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const expiredCount = await expireOldCodes();
    return NextResponse.json({ expired_count: expiredCount }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/codes/expire-old] failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
