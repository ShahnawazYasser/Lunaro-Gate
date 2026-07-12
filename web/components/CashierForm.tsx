'use client';

import { useState } from 'react';
import type { GenerateCodeResponse } from '@lunaro-gate/shared';

const MAX_PRINTS = 5;
const BASE_PRICE_PKR = 500;
const ADDITIONAL_COPY_PRICE_PKR = 250;

function priceForCount(count: number): number {
  return BASE_PRICE_PKR + (count - 1) * ADDITIONAL_COPY_PRICE_PKR;
}

interface CashierFormProps {
  onGenerated: (response: GenerateCodeResponse) => void;
  onError: (message: string) => void;
}

export function CashierForm({ onGenerated, onError }: CashierFormProps) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);

  const decrement = () => setCount((current) => Math.max(1, current - 1));
  const increment = () => setCount((current) => Math.min(MAX_PRINTS, current + 1));

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
          disabled={count <= 1}
          aria-label="Decrease prints"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-semibold text-textPri transition hover:border-gold hover:text-gold disabled:opacity-30"
        >
          &minus;
        </button>

        <span className="w-16 text-center text-5xl font-bold text-textPri">{count}</span>

        <button
          type="button"
          onClick={increment}
          disabled={count >= MAX_PRINTS}
          aria-label="Increase prints"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-2xl font-semibold text-textPri transition hover:border-gold hover:text-gold disabled:opacity-30"
        >
          +
        </button>
      </div>

      <p className="mt-8 text-center text-2xl font-semibold text-gold">
        Total: PKR {priceForCount(count)}
      </p>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="mt-8 h-16 w-full rounded-xl bg-gold text-lg font-bold uppercase tracking-wide text-bg transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate Code'}
      </button>
    </div>
  );
}
