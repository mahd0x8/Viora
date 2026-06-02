import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viora — Watch Together',
  description: 'Synchronized video watch party',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen antialiased flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="py-2 text-center">
          <a
            href="https://www.flaticon.com/free-icons/movies"
            title="movies icons"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-700 hover:text-gray-500 transition-colors"
          >
            Movies icons created by Freepik — Flaticon
          </a>
        </footer>
      </body>
    </html>
  );
}
