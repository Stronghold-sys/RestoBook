export const runtime = 'edge';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { status: 'ok', ts: Date.now() },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Ping': 'pong',
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Ping': 'pong',
    },
  });
}
