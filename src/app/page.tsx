'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function Home() {
  const [driveUrl, setDriveUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = () => {
    const fileId = extractDriveFileId(driveUrl.trim());
    if (!fileId) {
      setError('Paste a valid Google Drive share link (drive.google.com/file/d/...)');
      return;
    }

    setLoading(true);
    const videoUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const roomId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sessionStorage.setItem(`viora-${roomId}`, videoUrl);
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-2">Viora</h1>
          <p className="text-gray-400">Watch videos together, perfectly in sync.</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google Drive share link
            </label>
            <input
              type="text"
              value={driveUrl}
              onChange={(e) => { setDriveUrl(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="https://drive.google.com/file/d/…"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-indigo-500 focus:outline-none text-white placeholder-gray-600 transition-colors"
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !driveUrl.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? 'Creating room…' : 'Create Room'}
          </button>

          <p className="text-xs text-center text-gray-600">
            File must be shared as{' '}
            <span className="text-gray-400">Anyone with the link</span>
            {' '}in Google Drive
          </p>
        </div>
      </div>
    </main>
  );
}
