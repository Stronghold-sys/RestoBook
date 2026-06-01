export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

export async function GET() {
  try {
    const doc = new jsPDF();
    doc.text("Server PDF Test", 10, 10);
    const out = doc.output('arraybuffer');
    return new NextResponse(out, {
      headers: {
        'Content-Type': 'application/pdf'
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
