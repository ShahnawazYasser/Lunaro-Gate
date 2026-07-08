import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { GenerateCodeResponse } from '@lunaro-gate/shared';
import { env } from '@/lib/env';
import { generateCode, query } from '@/lib/db';

export const runtime = 'edge';

const bodySchema = z.object({
  prints_paid_for: z.coerce.number().int().min(1).max(env.GATE_MAX_PRINTS_PER_CODE),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error('[POST /api/codes/generate] invalid JSON body', error);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    console.error('[POST /api/codes/generate] validation failed', parsed.error.issues);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const code = await generateCode(parsed.data.prints_paid_for);

    const rows = await query<{ expires_at: string }>(
      'select expires_at from public.codes where code = $1',
      [code],
    );
    const row = rows[0];

    if (!row) {
      console.error('[POST /api/codes/generate] generated code missing after insert', { code });
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const response: GenerateCodeResponse = {
      code,
      prints_paid_for: parsed.data.prints_paid_for,
      expires_at: row.expires_at,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[POST /api/codes/generate] failed', {
      prints_paid_for: parsed.data.prints_paid_for,
      error,
    });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
