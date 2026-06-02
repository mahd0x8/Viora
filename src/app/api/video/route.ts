import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DRIVE_URL = (id: string) =>
  `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const rangeHeader = request.headers.get('range');

  const upstream = await fetch(DRIVE_URL(id), {
    headers: {
      // Full UA string — some CDNs reject minimal UAs
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    },
  });

  // Google Drive returned an HTML confirmation page instead of the file
  const upstreamType = upstream.headers.get('content-type') ?? '';
  if (upstreamType.includes('text/html')) {
    return new Response(
      'Video unavailable. Make sure the Drive file is shared as "Anyone with the link".',
      { status: 403, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
  }

  const headers = new Headers();

  // Force video/mp4 — Google Drive sometimes returns application/octet-stream
  // which Safari refuses to play
  headers.set('Content-Type', 'video/mp4');

  // Mobile browsers (Safari especially) require these for inline playback + seeking
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=3600');

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);

  const contentRange = upstream.headers.get('content-range');
  if (contentRange) headers.set('Content-Range', contentRange);

  // Return 206 when responding to a range request that got a Content-Range back
  const status = rangeHeader && contentRange ? 206 : 200;

  return new Response(upstream.body, { status, headers });
}
