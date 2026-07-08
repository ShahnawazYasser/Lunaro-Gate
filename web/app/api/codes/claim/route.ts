import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ClaimCodeResponse } from '@lunaro-gate/shared';
import { env } from '@/lib/env';
import { claimCode, query } from '@/lib/db';

export const runtime = 'edge';

const bodySchema = z.object({
  code: z.string().regex(/^\d{4}$/, 'code must be 4 digits'),
  booth_id: z.string().min(1).optional(),
});

interface CodeReasonRow {
  booth_id: string;
  status: string;
  expires_at: string;
}

async function determineReason(
  code: string,
  boothId: string,
): Promise<'not_found' | 'expired' | 'already_used'> {
  const rows = await query<CodeReasonRow>(
    'select booth_id, status, expires_at from public.codes where code = $1',
    [code],
  );
  const row = rows[0];

  if (!row || row.booth_id !== boothId) {
    return 'not_found';
  }

  if (row.status === 'expired') {
    return 'expired';
  }

  if (row.status === 'unused' && new Date(row.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }

  return 'already_used';
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error('[POST /api/codes/claim] invalid JSON body', error);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    console.error('[POST /api/codes/claim] validation failed', parsed.error.issues);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const boothId = parsed.data.booth_id ?? env.GATE_DEFAULT_BOOTH_ID;

  try {
    const claimed = await claimCode(parsed.data.code, boothId);

    if (!claimed) {
      const reason = await determineReason(parsed.data.code, boothId);
      const response: ClaimCodeResponse = { ok: false, reason };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ClaimCodeResponse = {
      ok: true,
      code: claimed.code,
      prints_paid_for: claimed.prints_paid_for,
      expires_at: claimed.expires_at,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[POST /api/codes/claim] failed', { code: parsed.data.code, boothId, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
