import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'edge';

const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE!;
const DUITKU_API_KEY = process.env.DUITKU_API_KEY!;

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const { amount, paymentMethod, returnUrl } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Nominal top up tidak valid' }, { status: 400 });
    }

    const topupAmount = Number(amount);

    // Get limit settings
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('min_topup, max_topup, is_duitku_enabled, wallet_admin_fee')
      .single();

    const minTopup = Number(settings?.min_topup || 10000);
    const maxTopup = Number(settings?.max_topup || 2000000);
    const adminFee = Number(settings?.wallet_admin_fee || 0);

    if (topupAmount < minTopup) {
      return NextResponse.json({ error: `Minimal top up adalah Rp ${minTopup.toLocaleString('id-ID')}` }, { status: 400 });
    }

    if (topupAmount > maxTopup) {
      return NextResponse.json({ error: `Maksimal top up adalah Rp ${maxTopup.toLocaleString('id-ID')}` }, { status: 400 });
    }

    if (settings?.is_duitku_enabled === false) {
      return NextResponse.json({ error: 'Metode pembayaran online sedang dinonaktifkan oleh admin' }, { status: 400 });
    }

    // 1. Create a pending transaction record
    const { data: tx, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        customer_id: profile.id,
        amount: topupAmount,
        type: 'topup',
        status: 'pending',
        payment_method: paymentMethod || 'duitku',
        fee: adminFee,
        description: 'Top Up Saldo Dompetku'
      })
      .select()
      .single();

    if (txError || !tx) {
      console.error('Create topup transaction error:', txError);
      return NextResponse.json({ error: 'Gagal membuat transaksi top up' }, { status: 500 });
    }

    // 2. Call Duitku API
    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const timestampForUnique = String(Date.now());
    const finalOrderId = `WLT-${tx.id}-${timestampForUnique.substring(8)}`;

    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const payload = {
      paymentAmount: Math.floor(topupAmount + adminFee),
      merchantOrderId: finalOrderId,
      productDetails: 'Top Up Saldo Dompetku',
      email: profile.email || '',
      paymentMethod: paymentMethod || '',
      phoneNumber: profile.phone || '',
      itemDetails: [
        {
          name: 'Top Up Saldo Dompetku',
          price: Math.floor(topupAmount),
          quantity: 1
        }
      ],
      customerDetail: {
        firstName: profile.full_name?.split(' ')[0] || 'Pelanggan',
        lastName: profile.full_name?.split(' ').slice(1).join(' ') || '',
        email: profile.email || '',
        phoneNumber: profile.phone || ''
      },
      callbackUrl: `${baseUrl}/api/payment/callback`,
      returnUrl: returnUrl || `${baseUrl}/customer/wallet`,
      expiryPeriod: 1440
    };

    if (adminFee > 0) {
      payload.itemDetails.push({
        name: 'Biaya Layanan / Admin',
        price: Math.floor(adminFee),
        quantity: 1
      });
    }

    const reqTimestamp = String(Date.now());
    const signatureString = `${DUITKU_MERCHANT_CODE}${reqTimestamp}${DUITKU_API_KEY}`;
    const signature = await sha256(signatureString);

    const url = isSandbox 
      ? 'https://api-sandbox.duitku.com/api/merchant/createInvoice'
      : 'https://api-prod.duitku.com/api/merchant/createInvoice';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': reqTimestamp,
        'x-duitku-merchantcode': DUITKU_MERCHANT_CODE
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Duitku API Invalid Response Format:', responseText);
      return NextResponse.json({
        error: `Duitku Gateway Error (${response.status})`
      }, { status: 400 });
    }

    if (data.reference && data.paymentUrl) {
      // Update transaction with Duitku transaction info
      await supabaseAdmin
        .from('wallet_transactions')
        .update({
          duitku_tx_id: finalOrderId,
          payment_reference: data.reference
        })
        .eq('id', tx.id);

      return NextResponse.json({
        success: true,
        reference: data.reference,
        paymentUrl: data.paymentUrl,
        merchantOrderId: finalOrderId
      });
    } else {
      console.error('Duitku Invoice Creation Rejected:', data);
      const errorMsg = data.message || data.Message || data.statusMessage || 'Gagal menghubungi payment gateway';
      // Mark transaction as failed
      await supabaseAdmin
        .from('wallet_transactions')
        .update({ status: 'failed', description: `Ditolak Duitku: ${errorMsg}` })
        .eq('id', tx.id);

      return NextResponse.json({ error: `Duitku: ${errorMsg}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Topup API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
