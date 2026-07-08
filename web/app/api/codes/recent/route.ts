import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CodeStatus, RecentCodesResponse } from '@lunaro-gate/shared';
import { env } from '@/lib/env';
import { query } from '@/lib/db';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  booth_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

interface RecentCodeRow {
  code: string;
  prints_paid_for: number;
  status: string;
  generated_at: string;
  prints_completed: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    booth_id: url.searchParams.get('booth_id') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    console.error('[GET /api/codes/recent] validation failed', parsed.error.issues);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const boothId = parsed.data.booth_id ?? env.GATE_DEFAULT_BOOTH_ID;
  const limit = parsed.data.limit ?? 20;

  try {
    const rows = await query<RecentCodeRow>(
      `select code, prints_paid_for, status, generated_at, prints_completed
       from public.codes
       where booth_id = $1
       order by generated_at desc
       limit $2`,
      [boothId, limit],
    );

    const response: RecentCodesResponse = {
      codes: rows.map((row) => ({
        code: row.code,
        prints_paid_for: row.prints_paid_for,
        status: row.status as CodeStatus,
        generated_at: row.generated_at,
        prints_completed: row.prints_completed,
      })),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[GET /api/codes/recent] failed', { boothId, limit, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
