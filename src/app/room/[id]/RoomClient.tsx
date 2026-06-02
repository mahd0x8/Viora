'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface RoomState {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
}

export default function RoomClient({ roomId }: { roomId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const joinAnnouncedRef = useRef(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [viewers, setViewers] = useState(1);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'not-found'>('connecting');
  const [copied, setCopied] = useState(false);

  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const isRemoteAction = useRef(false);
  const pendingSync = useRef<{ currentTime: number; isPlaying: boolean } | null>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Broadcast join message once name + room are both ready
  useEffect(() => {
    if (!userName || status !== 'ready' || joinAnnouncedRef.current) return;
    joinAnnouncedRef.current = true;
    getSocket().emit('chat-message', {
      roomId,
      sender: 'System',
      text: `${userName} joined the room`,
      isSystem: true,
    });
  }, [userName, status, roomId]);

  // Socket event wiring
  useEffect(() => {
    const socket = getSocket();
    const storedUrl = sessionStorage.getItem(`viora-${roomId}`);

    if (storedUrl) {
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

    socket.on('sync-request', (targetId: string) => {
      const video = videoRef.current;
      if (!video) return;
      socket.emit('sync-response', {
        targetId,
        currentTime: video.currentTime,
        isPlaying: !video.paused,
      });
    });

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

    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
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
      socket.off('chat-message');
    };
  }, [roomId]);

  const applySync = useCallback((currentTime: number, isPlaying: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    isRemoteAction.current = true;
    video.currentTime = currentTime;
    if (isPlaying) video.play().catch(() => {});
    else video.pause();
  }, []);

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
    const url = `${window.location.origin}/room/${roomId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetName = () => {
    const name = nameInput.trim();
    if (!name) return;
    setUserName(name);
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text || !userName) return;
    getSocket().emit('chat-message', { roomId, sender: userName, text });
    setChatInput('');
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
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Name prompt — full-screen overlay, video loads underneath */}
      {!userName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold mb-1">What&apos;s your name?</h2>
              <p className="text-sm text-gray-400">Others in the room will see this in chat.</p>
            </div>
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
              placeholder="Enter your name…"
              maxLength={24}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 focus:border-indigo-500 focus:outline-none text-white placeholder-gray-600 transition-colors"
            />
            <button
              onClick={handleSetName}
              disabled={!nameInput.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              Enter Room
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <a href="/" className="text-xl font-bold tracking-tight text-indigo-400 hover:text-indigo-300 transition-colors">
          Viora
        </a>
        <div className="flex items-center gap-4">
          {userName && (
            <span className="text-sm text-gray-500">
              Watching as <span className="text-gray-300 font-medium">{userName}</span>
            </span>
          )}
          <span className="text-sm text-gray-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
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

      {/* Body: video + chat */}
      <div className="flex flex-1 min-h-0">

        {/* Video */}
        <main className="flex-1 flex items-center justify-center p-4 md:p-6 min-w-0 bg-black">
          {status === 'connecting' ? (
            <p className="text-gray-500 animate-pulse">Connecting to room…</p>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full max-h-full rounded-xl shadow-2xl"
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeeked}
              onCanPlay={handleCanPlay}
            />
          )}
        </main>

        {/* Chat sidebar */}
        <aside className="w-72 lg:w-80 flex flex-col border-l border-gray-800 shrink-0 bg-gray-950">
          <div className="px-4 py-3 border-b border-gray-800 shrink-0">
            <h2 className="text-sm font-semibold text-gray-300">Room Chat</h2>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-xs text-gray-600 text-center pt-4">No messages yet. Say hello!</p>
            )}
            {messages.map((msg) =>
              msg.isSystem ? (
                <div key={msg.id} className="text-center">
                  <span className="text-xs text-gray-600">{msg.text}</span>
                </div>
              ) : (
                <div key={msg.id}>
                  <span className={`text-xs font-semibold ${msg.sender === userName ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {msg.sender === userName ? 'You' : msg.sender}
                  </span>
                  <p className="text-sm text-gray-200 mt-0.5 break-words leading-relaxed">{msg.text}</p>
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="p-3 border-t border-gray-800 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={userName ? 'Message…' : 'Enter your name first'}
                disabled={!userName}
                maxLength={500}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-gray-600 disabled:opacity-40 transition-colors"
              />
              <button
                onClick={handleSendMessage}
                disabled={!userName || !chatInput.trim()}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
