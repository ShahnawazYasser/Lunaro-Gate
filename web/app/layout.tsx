import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lunaro Gate',
  description: 'Photobooth access gate for Lunaro venues',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-textPri font-sans">{children}</body>
    </html>
  );
}
