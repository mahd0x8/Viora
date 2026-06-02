import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viora — Watch Together',
  description: 'Synchronized video watch party',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen antialiased">{children}</body>
    </html>
  );
}
