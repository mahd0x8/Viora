'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
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

// ── Icons ────────────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// ── Chat messages ─────────────────────────────────────────────────────────────

function Messages({ messages, userName, endRef }: {
  messages: ChatMessage[];
  userName: string | null;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
      {messages.length === 0 && (
        <p className="text-xs text-zinc-600 text-center pt-6">No messages yet. Say hello!</p>
      )}
      {messages.map((msg) => {
        if (msg.isSystem) {
          return (
            <div key={msg.id} className="flex justify-center">
              <span className="text-xs text-zinc-600 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
                {msg.text}
              </span>
            </div>
          );
        }
        const isOwn = msg.sender === userName;
        return (
          <div key={msg.id} className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
            <span className={`text-xs font-medium ${isOwn ? 'text-indigo-400' : 'text-zinc-400'}`}>
              {isOwn ? 'You' : msg.sender}
            </span>
            <div className={`px-3 py-2 rounded-2xl text-sm max-w-[78%] break-words leading-relaxed ${
              isOwn
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// ── Chat input ────────────────────────────────────────────────────────────────

function ChatInput({ value, onChange, onSend, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <div className="px-3 py-3 border-t border-zinc-800 shrink-0">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder={disabled ? 'Enter your name first' : 'Message…'}
          disabled={disabled}
          maxLength={500}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-zinc-600 disabled:opacity-40 transition-colors"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoomClient({ roomId }: { roomId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const desktopEndRef = useRef<HTMLDivElement>(null);
  const mobileEndRef = useRef<HTMLDivElement>(null);
  const joinAnnouncedRef = useRef(false);
  const chatOpenRef = useRef(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [viewers, setViewers] = useState(1);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'not-found'>('connecting');
  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const isRemoteAction = useRef(false);
  const pendingSync = useRef<{ currentTime: number; isPlaying: boolean } | null>(null);

  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);

  // Auto-scroll both panels
  useEffect(() => {
    desktopEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    mobileEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear unread badge when chat opens
  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  // Announce join once room + name are both ready
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

  // Socket wiring
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
      const v = videoRef.current;
      if (!v) return;
      socket.emit('sync-response', { targetId, currentTime: v.currentTime, isPlaying: !v.paused });
    });

    socket.on('sync-state', ({ currentTime, isPlaying, videoUrl: url }: { currentTime: number; isPlaying: boolean; videoUrl: string }) => {
      setVideoUrl(url);
      pendingSync.current = { currentTime, isPlaying };
      setStatus('ready');
    });

    socket.on('play', ({ currentTime }: { currentTime: number }) => {
      const v = videoRef.current; if (!v) return;
      isRemoteAction.current = true;
      v.currentTime = currentTime; v.play().catch(() => {});
    });
    socket.on('pause', ({ currentTime }: { currentTime: number }) => {
      const v = videoRef.current; if (!v) return;
      isRemoteAction.current = true;
      v.currentTime = currentTime; v.pause();
    });
    socket.on('seek', ({ currentTime }: { currentTime: number }) => {
      const v = videoRef.current; if (!v) return;
      isRemoteAction.current = true;
      v.currentTime = currentTime;
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!chatOpenRef.current) setUnread((n) => n + 1);
    });

    return () => {
      ['room-joined','room-not-found','viewer-count','sync-request',
       'sync-state','play','pause','seek','chat-message'].forEach((e) => socket.off(e));
    };
  }, [roomId]);

  const applySync = useCallback((currentTime: number, isPlaying: boolean) => {
    const v = videoRef.current; if (!v) return;
    isRemoteAction.current = true;
    v.currentTime = currentTime;
    if (isPlaying) v.play().catch(() => {}); else v.pause();
  }, []);

  const handleCanPlay = useCallback(() => {
    if (!pendingSync.current) return;
    const { currentTime, isPlaying } = pendingSync.current;
    pendingSync.current = null;
    applySync(currentTime, isPlaying);
  }, [applySync]);

  const handlePlay = useCallback(() => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    const v = videoRef.current;
    if (v) getSocket().emit('play', { roomId, currentTime: v.currentTime });
  }, [roomId]);

  const handlePause = useCallback(() => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    const v = videoRef.current;
    if (v) getSocket().emit('pause', { roomId, currentTime: v.currentTime });
  }, [roomId]);

  const handleSeeked = useCallback(() => {
    if (isRemoteAction.current) { isRemoteAction.current = false; return; }
    const v = videoRef.current;
    if (v) getSocket().emit('seek', { roomId, currentTime: v.currentTime });
  }, [roomId]);

  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    if (navigator.clipboard) { navigator.clipboard.writeText(url); }
    else {
      const el = document.createElement('textarea');
      el.value = url; el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleSetName = () => {
    const name = nameInput.trim(); if (!name) return;
    setUserName(name);
  };

  const handleSend = () => {
    const text = chatInput.trim(); if (!text || !userName) return;
    getSocket().emit('chat-message', { roomId, sender: userName, text });
    setChatInput('');
  };

  // ── Not found ──────────────────────────────────────────────────────────────
  if (status === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 bg-zinc-950">
        <Image src="/icon.png" alt="Viora" width={56} height={56} className="opacity-40 rounded-xl" />
        <p className="text-xl font-semibold">Room not found</p>
        <p className="text-zinc-500 text-sm text-center">This room may have expired.</p>
        <a href="/" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
          Go home
        </a>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">

      {/* ── Name prompt ─────────────────────────────────────────────────────── */}
      {!userName && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex flex-col items-center gap-3 text-center">
              <Image src="/icon.png" alt="Viora" width={48} height={48} className="rounded-xl" />
              <div>
                <h2 className="text-lg font-bold">What&apos;s your name?</h2>
                <p className="text-sm text-zinc-400 mt-1">Others in the room will see this in chat.</p>
              </div>
            </div>
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
              placeholder="Enter your name…"
              maxLength={24}
              className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-white placeholder-zinc-600 transition-colors"
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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 shrink-0 z-10">
        <a href="/" className="flex items-center gap-2 group">
          <Image src="/icon.png" alt="Viora" width={28} height={28} className="rounded-lg" />
          <span className="text-base font-bold tracking-tight text-indigo-400 group-hover:text-indigo-300 transition-colors">
            Viora
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          {userName && (
            <span className="hidden sm:block text-xs text-zinc-500 truncate max-w-[120px]">
              {userName}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <EyeIcon />
            {viewers}
          </span>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-xs font-semibold transition-colors"
          >
            <ShareIcon />
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">

        {/* Video */}
        <main className="bg-black flex items-center justify-center w-full shrink-0
          max-h-[42vh] sm:max-h-[48vh] md:max-h-none md:flex-1">
          {status === 'connecting' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-500 text-sm">Connecting…</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeeked}
              onCanPlay={handleCanPlay}
            />
          )}
        </main>

        {/* Chat — desktop sidebar + mobile panel */}
        <aside className="flex-1 flex flex-col min-h-0
          border-t border-zinc-800 md:border-t-0 md:border-l
          md:flex-none md:w-80 lg:w-96 bg-zinc-950">

          {/* Chat header — desktop only */}
          <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
            <h2 className="text-sm font-semibold text-zinc-300">Room Chat</h2>
            <span className="text-xs text-zinc-600">#{roomId}</span>
          </div>

          {/* Mobile: compact top bar with toggle */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0 w-full text-left"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <ChatIcon />
              Chat
              {unread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <span className={`text-zinc-500 transition-transform duration-200 ${chatOpen ? 'rotate-180' : ''}`}>
              <ChevronDownIcon />
            </span>
          </button>

          {/* Messages + input — always on desktop, toggle on mobile */}
          <div className={`flex-col flex-1 min-h-0 ${chatOpen ? 'flex' : 'hidden'} md:flex`}>
            <Messages messages={messages} userName={userName} endRef={desktopEndRef} />
            <ChatInput
              value={chatInput}
              onChange={setChatInput}
              onSend={handleSend}
              disabled={!userName}
            />
          </div>

        </aside>
      </div>

    </div>
  );
}
