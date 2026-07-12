'use client';

import { useEffect, useState } from 'react';
import type { CodeStatus, RecentCodesResponse } from '@lunaro-gate/shared';

const REFRESH_INTERVAL_MS = 30000;

const STATUS_LABEL: Record<CodeStatus, string> = {
  unused: 'unused',
  claimed: 'claimed',
  in_session: 'in session',
  used: 'used',
  expired: 'expired',
  voided: 'voided',
};

const STATUS_DOT_CLASS: Record<CodeStatus, string> = {
  unused: 'bg-textSec',
  claimed: 'bg-gold',
  in_session: 'bg-gold',
  used: 'bg-success',
  expired: 'bg-textSec',
  voided: 'bg-danger',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface RecentCodesTableProps {
  refreshSignal: number;
  onError: (message: string) => void;
}

export function RecentCodesTable({ refreshSignal, onError }: RecentCodesTableProps) {
  const [codes, setCodes] = useState<RecentCodesResponse['codes']>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/codes/recent');
        if (!res.ok) {
          if (!cancelled) {
            onError('Could not load recent codes.');
          }
          return;
        }
        const data = (await res.json()) as RecentCodesResponse;
        if (!cancelled) {
          setCodes(data.codes);
        }
      } catch {
        if (!cancelled) {
          onError('Network error while loading recent codes.');
        }
      }
    };

    void fetchRecent();
    const interval = setInterval(() => {
      void fetchRecent();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshSignal, onError]);

  return (
    <div className="w-full max-w-3xl">
      <h2 className="text-lg font-semibold text-textPri">Today&apos;s codes (last 20)</h2>

      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-sm text-textSec">
            <th className="py-2 pr-4 font-medium">Code</th>
            <th className="py-2 pr-4 font-medium">Prints</th>
            <th className="py-2 pr-4 font-medium">Time</th>
            <th className="py-2 pr-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {codes.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-textSec">
                No codes generated yet.
              </td>
            </tr>
          ) : (
            codes.map((entry) => (
              <tr key={entry.code} className="border-b border-border/50 text-textPri">
                <td className="py-3 pr-4 font-mono text-lg">{entry.code}</td>
                <td className="py-3 pr-4">{entry.prints_paid_for}</td>
                <td className="py-3 pr-4">{formatTime(entry.generated_at)}</td>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_CLASS[entry.status]}`} />
                    {STATUS_LABEL[entry.status]}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
