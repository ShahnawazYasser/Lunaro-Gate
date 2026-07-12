'use client';

import { useEffect, useState } from 'react';
import type { GenerateCodeResponse } from '@lunaro-gate/shared';
import type { PricingConfigResponse } from '@/app/api/config/pricing/route';

const DEFAULT_PRICING: PricingConfigResponse = {
  base_price_pkr: 500,
  additional_copy_price_pkr: 250,
  max_prints_per_code: 5,
};

function priceForCount(count: number, pricing: PricingConfigResponse): number {
  return pricing.base_price_pkr + (count - 1) * pricing.additional_copy_price_pkr;
}

interface CashierFormProps {
  onGenerated: (response: GenerateCodeResponse) => void;
  onError: (message: string) => void;
}

export function CashierForm({ onGenerated, onError }: CashierFormProps) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<PricingConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPricing = async () => {
      try {
        const res = await fetch('/api/config/pricing');
        if (!res.ok) {
          throw new Error(`unexpected status ${res.status}`);
        }
        const data = (await res.json()) as PricingConfigResponse;
        if (!cancelled) {
          setPricing(data);
        }
      } catch (error) {
        console.error('[CashierForm] failed to load pricing config, using defaults', error);
        if (!cancelled) {
          setPricing(DEFAULT_PRICING);
        }
      }
    };

    void loadPricing();

    return () => {
      cancelled = true;
    };
  }, []);

  const maxPrints = pricing?.max_prints_per_code ?? DEFAULT_PRICING.max_prints_per_code;
  const configLoading = pricing === null;

  const decrement = () => setCount((current) => Math.max(1, current - 1));
  const increment = () => setCount((current) => Math.min(maxPrints, current + 1));

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prints_paid_for: count }),
      });

      if (!res.ok) {
        onError('Could not generate a code. Please try again.');
        return;
      }

      const data = (await res.json()) as GenerateCodeResponse;
      onGenerated(data);
      setCount(1);
    } catch {
      onError('Network error while generating a code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 shadow-2xl">
      <p className="text-center text-lg text-textSec">How many prints?</p>

      <div className="mt-6 flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={decrement}
          disabled={configLoading || count <= 1}
          aria-label="Decrease prints"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-semibold text-textPri transition hover:border-gold hover:text-gold disabled:opacity-30"
        >
          &minus;
        </button>

        <span className="w-16 text-center text-5xl font-bold text-textPri">{count}</span>

        <button
          type="button"
          onClick={increment}
          disabled={configLoading || count >= maxPrints}
          aria-label="Increase prints"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-semibold text-textPri transition hover:border-gold hover:text-gold disabled:opacity-30"
        >
          +
        </button>
      </div>

      <p className="mt-8 text-center text-2xl font-semibold text-gold">
        Total: PKR {priceForCount(count, pricing ?? DEFAULT_PRICING)}
      </p>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={configLoading || loading}
        className="mt-8 h-16 w-full rounded-xl bg-gold text-lg font-bold uppercase tracking-wide text-bg transition hover:brightness-110 disabled:opacity-50"
      >
        {configLoading ? 'Loading…' : loading ? 'Generating…' : 'Generate Code'}
      </button>
    </div>
  );
}
