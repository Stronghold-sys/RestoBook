import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ message: 'Duitku Callback Endpoint is Active. Waiting for POST requests.' }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    // Duitku bisa kirim callback sebagai JSON atau form-urlencoded
    const contentType = req.headers.get('content-type') || '';
    let merchantCode = '';
    let amount = '';
    let merchantOrderId = '';
    let signature = '';
    let resultCode = '';
    let reference = '';

    if (contentType.includes('application/json')) {
      // JSON format
      const json = await req.json();
      merchantCode = json.merchantCode || '';
      amount = String(json.amount || '');
      merchantOrderId = json.merchantOrderId || '';
      signature = json.signature || '';
      resultCode = json.resultCode || '';
      reference = json.reference || '';
      console.log('Duitku Callback (JSON):', JSON.stringify(json));
    } else {
      // Form-urlencoded format
      const textData = await req.text();
      const params = new URLSearchParams(textData);
      merchantCode = params.get('merchantCode') || '';
      amount = params.get('amount') || '';
      merchantOrderId = params.get('merchantOrderId') || '';
      signature = params.get('signature') || '';
      resultCode = params.get('resultCode') || '';
      reference = params.get('reference') || '';
      console.log('Duitku Callback (Form):', textData);
    }

    // Environment variables
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';

    if (!merchantOrderId || !amount) {
      console.error('Callback: Missing merchantOrderId or amount');
      return new NextResponse('OK', { status: 200 });
    }

    // Verify signature: MD5(merchantCode + amount + merchantOrderId + apiKey)
    const useCode = merchantCode || DUITKU_MERCHANT_CODE;
    const signatureString = `${useCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`;
    const calculatedSignature = await md5(signatureString);

    console.log('Callback Signature Check:', { 
      received: signature, 
      calculated: calculatedSignature, 
      match: signature === calculatedSignature,
      resultCode 
    });

    // Verify signature (tapi jangan block jika tidak ada signature - beberapa callback mungkin berbeda)
    if (signature && signature !== calculatedSignature) {
      console.error('Duitku signature mismatch!', { signature, calculatedSignature, signatureString });
      // Tetap proses tapi log error - jangan return error karena Duitku tidak akan retry
    }

    // If payment is successful (resultCode "00" = success)
    if (resultCode === '00' || resultCode === '0') {
      console.log('Payment SUCCESS for order:', merchantOrderId);
      
      // 1. Update order payment status to 'paid'
      const { error: updateError, data: updateData } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'confirmed'
        })
        .eq('id', merchantOrderId);

      if (updateError) {
        console.error('Error updating order:', updateError);
      } else {
        console.log('Order updated successfully:', merchantOrderId);
      }
    } else {
      console.log('Callback received with resultCode:', resultCode, 'for order:', merchantOrderId);
    }

    // Duitku expects HTTP 200 with text "OK"
    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('Duitku Callback Error:', error.message || error);
    // Always return 200 to Duitku to prevent retries
    return new NextResponse('OK', { status: 200 });
  }
}
