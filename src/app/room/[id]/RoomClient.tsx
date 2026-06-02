'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

interface RoomState {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
}

export default function RoomClient({ roomId }: { roomId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [viewers, setViewers] = useState(1);
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'ready' | 'not-found'>('connecting');
  const [copied, setCopied] = useState(false);

  // Prevents re-broadcasting events that were triggered by remote actions
  const isRemoteAction = useRef(false);
  // Holds sync state received before the video element is ready to seek
  const pendingSync = useRef<{ currentTime: number; isPlaying: boolean } | null>(null);

  const applySync = useCallback((currentTime: number, isPlaying: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    isRemoteAction.current = true;
    video.currentTime = currentTime;
    if (isPlaying) video.play().catch(() => {});
    else video.pause();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const storedUrl = sessionStorage.getItem(`viora-${roomId}`);
    const isHost = Boolean(storedUrl);

    if (isHost) {
      socket.emit('create-room', { roomId, videoUrl: storedUrl });
    } else {
      socket.emit('join-room', roomId);
    }

    socket.on('room-joined', (state: RoomState) => {
      setVideoUrl(state.videoUrl);
      pendingSync.current = { currentTime: state.currentTime, isPlaying: state.isPlaying };
      setStatus('ready');
    });

    socket.on('room-not-found', () => setStatus('not-found'));

    socket.on('viewer-count', (count: number) => setViewers(count));

    // Another participant asked us to broadcast our current state to a new joiner
    socket.on('sync-request', (targetId: string) => {
      const video = videoRef.current;
      if (!video) return;
      socket.emit('sync-response', {
        targetId,
        currentTime: video.currentTime,
        isPlaying: !video.paused,
      });
    });

    // We are the new joiner receiving the current state
    socket.on('sync-state', ({ currentTime, isPlaying, videoUrl: url }: { currentTime: number; isPlaying: boolean; videoUrl: string }) => {
      setVideoUrl(url);
      pendingSync.current = { currentTime, isPlaying };
      setStatus('ready');
    });

    socket.on('play', ({ currentTime }: { currentTime: number }) => {
      const video = videoRef.current;
      if (!video) return;
      isRemoteAction.current = true;
      video.currentTime = currentTime;
      video.play().catch(() => {});
    });

    socket.on('pause', ({ currentTime }: { currentTime: number }) => {
      const video = videoRef.current;
      if (!video) return;
      isRemoteAction.current = true;
      video.currentTime = currentTime;
      video.pause();
    });

    socket.on('seek', ({ currentTime }: { currentTime: number }) => {
      const video = videoRef.current;
      if (!video) return;
      isRemoteAction.current = true;
      video.currentTime = currentTime;
    });

    return () => {
      socket.off('room-joined');
      socket.off('room-not-found');
      socket.off('viewer-count');
      socket.off('sync-request');
      socket.off('sync-state');
      socket.off('play');
      socket.off('pause');
      socket.off('seek');
    };
  }, [roomId, applySync]);

  // Apply pending sync state as soon as the video has enough data to seek
  const handleCanPlay = useCallback(() => {
    if (!pendingSync.current) return;
    const { currentTime, isPlaying } = pendingSync.current;
    pendingSync.current = null;
    applySync(currentTime, isPlaying);
  }, [applySync]);

  const handlePlay = useCallback(() => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    const video = videoRef.current;
    if (video) getSocket().emit('play', { roomId, currentTime: video.currentTime });
  }, [roomId]);

  const handlePause = useCallback(() => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    const video = videoRef.current;
    if (video) getSocket().emit('pause', { roomId, currentTime: video.currentTime });
  }, [roomId]);

  const handleSeeked = useCallback(() => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    const video = videoRef.current;
    if (video) getSocket().emit('seek', { roomId, currentTime: video.currentTime });
  }, [roomId]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-xl font-semibold">Room not found</p>
        <p className="text-gray-400 text-sm">This room may have expired. Create a new one.</p>
        <a href="/" className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
          Go home
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <a href="/" className="text-xl font-bold tracking-tight text-indigo-400 hover:text-indigo-300 transition-colors">
          Viora
        </a>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 align-middle" />
            {viewers} {viewers === 1 ? 'viewer' : 'viewers'}
          </span>
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
          >
            {copied ? 'Copied!' : 'Share Room'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        {status === 'connecting' || status === 'waiting' ? (
          <p className="text-gray-500 animate-pulse">
            {status === 'connecting' ? 'Connecting to room…' : 'Waiting for video…'}
          </p>
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full max-w-5xl rounded-2xl shadow-2xl"
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={handleSeeked}
            onCanPlay={handleCanPlay}
          />
        )}
      </main>

      <footer className="px-6 py-3 border-t border-gray-900 shrink-0">
        <p className="text-xs text-center text-gray-700">Room · {roomId}</p>
      </footer>
    </div>
  );
}
