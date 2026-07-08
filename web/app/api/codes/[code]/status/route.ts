import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CodeStatus, CodeStatusResponse } from '@lunaro-gate/shared';
import { query } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  code: z.string().regex(/^\d{4}$/, 'code must be 4 digits'),
});

interface StatusRow {
  code: string;
  status: string;
  prints_paid_for: number;
  prints_completed: number;
  claimed_at: string | null;
  completed_at: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: { code: string } },
): Promise<NextResponse> {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    console.error('[GET /api/codes/[code]/status] invalid code param', {
      params,
      issues: parsed.error.issues,
    });
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const rows = await query<StatusRow>(
      `select code, status, prints_paid_for, prints_completed, claimed_at, completed_at
       from public.codes
       where code = $1`,
      [parsed.data.code],
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const response: CodeStatusResponse = {
      code: row.code,
      status: row.status as CodeStatus,
      prints_paid_for: row.prints_paid_for,
      prints_completed: row.prints_completed,
      claimed_at: row.claimed_at,
      completed_at: row.completed_at,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[GET /api/codes/[code]/status] failed', { code: parsed.data.code, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
