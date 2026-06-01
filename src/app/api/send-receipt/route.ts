import { NextResponse } from 'next/server';
import { sendReceiptEmail } from '@/lib/sendReceiptEmail';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const result = await sendReceiptEmail(orderId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[send-receipt route] Error:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
