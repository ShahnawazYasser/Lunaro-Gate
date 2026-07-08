import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold text-textPri">Lunaro Gate</h1>
      <Link href="/cashier" className="text-gold underline">
        Go to Cashier
      </Link>
    </main>
  );
}
