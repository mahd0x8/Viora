import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const rangeHeader = request.headers.get('range') ?? undefined;

  // Google Drive redirects uc?export=download through a confirm page for large files.
  // confirm=t bypasses the virus-scan gate.
  const upstreamUrl = `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    },
    // fetch follows redirects by default; this lands us on the real CDN URL
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
  }

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', upstream.headers.get('content-type') ?? 'video/mp4');
  responseHeaders.set('Accept-Ranges', 'bytes');
  responseHeaders.set('Cache-Control', 'private, max-age=3600');

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);

  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  return new Response(upstream.body, {
    status: rangeHeader && contentRange ? 206 : upstream.status,
    headers: responseHeaders,
  });
}
