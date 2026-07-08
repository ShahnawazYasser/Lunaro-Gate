import { neon } from '@neondatabase/serverless';
import { env } from './env';

export const sql = neon(env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await sql(text, params);
  return rows as unknown as T[];
}

export async function generateCode(
  printsPaidFor: number,
  boothId: string = env.GATE_DEFAULT_BOOTH_ID,
  expiryHours: number = env.GATE_CODE_EXPIRY_HOURS,
): Promise<string> {
  const rows = await query<{ generate_code: string }>(
    'select public.generate_code($1, $2, $3) as generate_code',
    [printsPaidFor, boothId, expiryHours],
  );

  const row = rows[0];
  if (!row) {
    throw new Error('generate_code returned no rows');
  }

  return row.generate_code;
}

export interface ClaimedCode {
  code: string;
  prints_paid_for: number;
  expires_at: string;
}

export async function claimCode(
  code: string,
  boothId: string = env.GATE_DEFAULT_BOOTH_ID,
): Promise<ClaimedCode | null> {
  const rows = await query<ClaimedCode>('select * from public.claim_code($1, $2)', [code, boothId]);

  return rows[0] ?? null;
}

export async function expireOldCodes(): Promise<number> {
  const rows = await query<{ expire_old_codes: number }>(
    'select public.expire_old_codes() as expire_old_codes',
    [],
  );

  const row = rows[0];
  if (!row) {
    throw new Error('expire_old_codes returned no rows');
  }

  return row.expire_old_codes;
}
