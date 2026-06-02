'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

const steps = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    title: 'Upload to Drive',
    desc: 'Share your MP4 as "Anyone with the link"',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Paste the link',
    desc: 'Drop your Drive share URL below',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    title: 'Invite & watch',
    desc: 'Share the room link — play, pause, seek in sync',
  },
];

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
    const videoUrl = `/api/video?id=${fileId}`;
    const roomId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    sessionStorage.setItem(`viora-${roomId}`, videoUrl);
    router.push(`/room/${roomId}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-zinc-950">

      {/* Hero */}
      <div className="flex flex-col items-center gap-4 mb-10 text-center">
        <Image src="/icon.png" alt="Viora" width={72} height={72} className="rounded-2xl shadow-lg" />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Viora</h1>
          <p className="text-gray-400 mt-2 text-base sm:text-lg">Watch together, perfectly in sync.</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Google Drive share link
          </label>
          <input
            type="url"
            value={driveUrl}
            onChange={(e) => { setDriveUrl(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="https://drive.google.com/file/d/…"
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-white placeholder-zinc-500 transition-colors text-sm"
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !driveUrl.trim()}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating room…
            </span>
          ) : 'Create Room'}
        </button>

        <p className="text-xs text-center text-zinc-600">
          Set Drive sharing to{' '}
          <span className="text-zinc-400 font-medium">Anyone with the link</span>
        </p>
      </div>

      {/* How it works */}
      <div className="w-full max-w-md mt-8 grid grid-cols-3 gap-3">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-2 text-center p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="w-9 h-9 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              {step.icon}
            </div>
            <p className="text-xs font-semibold text-gray-300">{step.title}</p>
            <p className="text-xs text-zinc-500 leading-snug">{step.desc}</p>
          </div>
        ))}
      </div>

    </main>
  );
}
