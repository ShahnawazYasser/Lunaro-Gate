'use client';

import { useState } from 'react';
import type { GenerateCodeResponse } from '@lunaro-gate/shared';
import { CashierForm } from '@/components/CashierForm';
import { CodeModal } from '@/components/CodeModal';
import { RecentCodesTable } from '@/components/RecentCodesTable';

export default function CashierPage() {
  const [modalData, setModalData] = useState<GenerateCodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const handleGenerated = (response: GenerateCodeResponse) => {
    setError(null);
    setModalData(response);
    setRefreshSignal((current) => current + 1);
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center gap-12 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-wide text-textPri">Lunaro Booth</h1>

        {error && (
          <div className="w-full max-w-md rounded-lg border border-danger bg-danger/10 px-4 py-3 text-center text-danger">
            {error}
          </div>
        )}

        <CashierForm onGenerated={handleGenerated} onError={setError} />

        <RecentCodesTable refreshSignal={refreshSignal} onError={setError} />
      </main>

      {modalData && <CodeModal data={modalData} onClose={() => setModalData(null)} />}
    </>
  );
}
