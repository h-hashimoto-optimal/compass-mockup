import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div className="space-y-3">
        <div className="text-5xl font-bold tracking-tight">404</div>
        <p className="text-sm text-muted-foreground">
          お探しの画面は見つかりませんでした
        </p>
        <Link
          href="/"
          className="inline-block text-sm text-primary hover:underline"
        >
          HOME に戻る →
        </Link>
      </div>
    </main>
  );
}
