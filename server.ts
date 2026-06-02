import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT ?? '3000');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface RoomState {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
}

const rooms = new Map<string, RoomState>();
// Tracks new joiners waiting for a sync response — prevents duplicate sync-states
const pendingSyncs = new Set<string>();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    socket.on('create-room', ({ roomId, videoUrl }: { roomId: string; videoUrl: string }) => {
      rooms.set(roomId, { videoUrl, currentTime: 0, isPlaying: false });
      socket.join(roomId);
      socket.emit('room-joined', rooms.get(roomId));
      io.to(roomId).emit('viewer-count', io.sockets.adapter.rooms.get(roomId)?.size ?? 1);
    });

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('room-not-found');
        return;
      }

      const count = io.sockets.adapter.rooms.get(roomId)?.size ?? 1;
      io.to(roomId).emit('viewer-count', count);

      if (count > 1) {
        pendingSyncs.add(socket.id);
        // Ask existing participants to send their current playback state
        socket.to(roomId).emit('sync-request', socket.id);
      } else {
        socket.emit('room-joined', room);
      }
    });

    socket.on('sync-response', ({ targetId, currentTime, isPlaying }: { targetId: string; currentTime: number; isPlaying: boolean }) => {
      if (!pendingSyncs.has(targetId)) return;
      pendingSyncs.delete(targetId);

      const roomId = [...socket.rooms].find((r) => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.currentTime = currentTime;
          room.isPlaying = isPlaying;
        }
        io.to(targetId).emit('sync-state', { currentTime, isPlaying, videoUrl: rooms.get(roomId)?.videoUrl });
      }
    });

    socket.on('play', ({ roomId, currentTime }: { roomId: string; currentTime: number }) => {
      const room = rooms.get(roomId);
      if (room) { room.isPlaying = true; room.currentTime = currentTime; }
      socket.to(roomId).emit('play', { currentTime });
    });

    socket.on('pause', ({ roomId, currentTime }: { roomId: string; currentTime: number }) => {
      const room = rooms.get(roomId);
      if (room) { room.isPlaying = false; room.currentTime = currentTime; }
      socket.to(roomId).emit('pause', { currentTime });
    });

    socket.on('seek', ({ roomId, currentTime }: { roomId: string; currentTime: number }) => {
      const room = rooms.get(roomId);
      if (room) { room.currentTime = currentTime; }
      socket.to(roomId).emit('seek', { currentTime });
    });

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        const size = (io.sockets.adapter.rooms.get(roomId)?.size ?? 1) - 1;
        socket.to(roomId).emit('viewer-count', Math.max(1, size));
      }
    });
  });

  expressApp.all('*', (req, res) => handle(req, res));

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
