import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compass — 韓国越境EC自動化',
  description: 'モックアップ — Compass 越境EC管理ツール',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
