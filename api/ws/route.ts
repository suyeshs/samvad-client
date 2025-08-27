// /app/api/ws/route.ts
// This API route is now handled by a separate Cloudflare Worker (ekbachan). No logic needed here.

export async function GET() {
  return new Response('This endpoint is now handled by the external worker.', { status: 501 });
}