import { NextResponse } from 'next/server';
import { expireOldCodes } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  if (!request.headers.has('x-vercel-cron')) {
    console.error('[POST /api/codes/expire-old] missing x-vercel-cron header');
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
