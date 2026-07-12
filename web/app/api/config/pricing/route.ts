import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'edge';

export interface PricingConfigResponse {
  base_price_pkr: number;
  additional_copy_price_pkr: number;
  max_prints_per_code: number;
}

export async function GET(): Promise<NextResponse> {
  const response: PricingConfigResponse = {
    base_price_pkr: env.GATE_BASE_PRICE_PKR,
    additional_copy_price_pkr: env.GATE_ADDITIONAL_COPY_PRICE_PKR,
    max_prints_per_code: env.GATE_MAX_PRINTS_PER_CODE,
  };

  return NextResponse.json(response, { status: 200 });
}
