import { NextResponse } from 'next/server';

export const runtime = 'edge';

// This endpoint has been replaced by /api/payment/debug
export async function GET() {
  return NextResponse.json({ message: 'Moved to /api/payment/debug' });
}
