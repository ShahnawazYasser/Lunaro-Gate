import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { query } from '@/lib/db';

export const runtime = 'edge';

const querySchema = z.object({
  booth_id: z.string().min(1).optional(),
});

interface InFlightRow {
  code: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    booth_id: url.searchParams.get('booth_id') ?? undefined,
  });

  if (!parsed.success) {
    console.error('[GET /api/codes/in-flight] validation failed', parsed.error.issues);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const boothId = parsed.data.booth_id ?? env.GATE_DEFAULT_BOOTH_ID;

  try {
    const rows = await query<InFlightRow>(
      `select code
       from public.codes
       where booth_id = $1
         and status in ('claimed', 'in_session')
       order by generated_at desc
       limit 1`,
      [boothId],
    );

    return NextResponse.json({ code: rows[0]?.code ?? null }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/codes/in-flight] failed', { boothId, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
