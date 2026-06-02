import { Suspense } from 'react';
import RoomClient from './RoomClient';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Connecting…</div>}>
      <RoomClient roomId={id} />
    </Suspense>
  );
}
