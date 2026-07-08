import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { query } from '@/lib/db';

export const runtime = 'edge';

async function correlateSessionStart(boothId: string): Promise<string | null> {
  const rows = await query<{ code: string }>(
    `update public.codes
     set status = 'in_session'
     where code = (
       select code from public.codes
       where booth_id = $1 and status = 'claimed'
       order by claimed_at desc nulls last
       limit 1
     )
     returning code`,
    [boothId],
  );

  return rows[0]?.code ?? null;
}

async function correlatePrinting(boothId: string, printCount: number): Promise<string | null> {
  const rows = await query<{ code: string }>(
    `update public.codes
     set prints_completed = prints_completed + $2
     where code = (
       select code from public.codes
       where booth_id = $1 and status = 'in_session'
       order by claimed_at desc nulls last
       limit 1
     )
     returning code`,
    [boothId, printCount],
  );

  return rows[0]?.code ?? null;
}

async function correlateSessionEnd(boothId: string): Promise<string | null> {
  const rows = await query<{ code: string }>(
    `update public.codes
     set status = 'used', completed_at = now()
     where code = (
       select code from public.codes
       where booth_id = $1 and status = 'in_session'
       order by claimed_at desc nulls last
       limit 1
     )
     returning code`,
    [boothId],
  );

  return rows[0]?.code ?? null;
}

interface WebhookEventRow {
  code: string | null;
  eventType: string;
  param1: string | null;
  param2: string | null;
  param3: string | null;
  param4: string | null;
  boothId: string;
  raw: Record<string, string>;
}

async function recordWebhookEvent(row: WebhookEventRow): Promise<void> {
  await query(
    `insert into public.webhook_events (code, event_type, param1, param2, param3, param4, booth_id, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      row.code,
      row.eventType,
      row.param1,
      row.param2,
      row.param3,
      row.param4,
      row.boothId,
      JSON.stringify(row.raw),
    ],
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const eventType = url.searchParams.get('event_type') ?? 'unknown';
  const boothId = url.searchParams.get('booth_id') || env.GATE_DEFAULT_BOOTH_ID;
  const param1 = url.searchParams.get('param1');
  const param2 = url.searchParams.get('param2');
  const param3 = url.searchParams.get('param3');
  const param4 = url.searchParams.get('param4');

  let code: string | null = null;

  try {
    if (eventType === 'session_start') {
      code = await correlateSessionStart(boothId);
    } else if (eventType === 'printing') {
      const parsedCount = param2 !== null ? parseInt(param2, 10) : NaN;
      const printCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
      code = await correlatePrinting(boothId, printCount);
    } else if (eventType === 'session_end') {
      code = await correlateSessionEnd(boothId);
    }
  } catch (error) {
    console.error('[GET /api/webhook] correlation failed', { eventType, boothId, error });
  }

  try {
    await recordWebhookEvent({ code, eventType, param1, param2, param3, param4, boothId, raw });
  } catch (error) {
    console.error('[GET /api/webhook] failed to insert webhook_events row', {
      eventType,
      boothId,
      error,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
