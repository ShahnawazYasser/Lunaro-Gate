'use client';

import type { GenerateCodeResponse } from '@lunaro-gate/shared';

interface CodeModalProps {
  data: GenerateCodeResponse;
  onClose: () => void;
}

export function CodeModal({ data, onClose }: CodeModalProps) {
  const digits = data.code.split('');

  return (
    <>
      <style>{`
        .print-slip { display: none; }
        @media print {
          body > *:not(.print-slip) { display: none !important; }
          .print-slip { display: block !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 text-center shadow-2xl">
          <p className="text-lg text-textSec">Your code:</p>

          <p className="mt-4 flex justify-center gap-4 text-6xl font-bold tracking-widest text-gold">
            {digits.map((digit, index) => (
              <span key={`${digit}-${index}`}>{digit}</span>
            ))}
          </p>

          <p className="mt-6 text-textPri">Hand to customer</p>
          <p className="mt-1 text-textSec">Expires in 2 hours</p>

          <div className="mt-8 flex gap-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-16 flex-1 rounded-xl border border-gold text-lg font-bold uppercase tracking-wide text-gold transition hover:bg-gold hover:text-bg"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-16 flex-1 rounded-xl bg-gold text-lg font-bold uppercase tracking-wide text-bg transition hover:brightness-110"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <div className="print-slip">
        <div className="flex min-h-screen flex-col items-center justify-center text-center">
          <p className="text-2xl">Your code:</p>
          <p className="mt-4 text-8xl font-bold tracking-widest">{digits.join(' ')}</p>
          <p className="mt-6 text-xl">Hand to customer</p>
          <p className="mt-2 text-xl">Expires in 2 hours</p>
        </div>
      </div>
    </>
  );
}
