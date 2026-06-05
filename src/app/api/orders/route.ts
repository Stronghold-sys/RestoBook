export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkMaintenanceActive } from '@/utils/maintenanceHelper';
import { getPaidNotification } from '@/utils/notificationHelper';
import { updateOrderEstimation } from '@/lib/order-estimation';
import { consumeNonce, logSecurityIncident } from '../../../lib/securityHardening';

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function getStatusNotification(status: string, orderId: string, orderType: string, reason?: string) {
  const shortId = orderId.split('-')[0].toUpperCase();
  let title = 'Update Pesanan';
  let message = `Status No. Pesanan #${shortId} diperbarui ke: ${status}`;
  let statusBadge = status;

  if (status === 'pending') {
    title = 'Pesanan Menunggu Konfirmasi';
    message = orderType === 'delivery'
      ? `Pesanan delivery #${shortId} telah dibuat. Menunggu konfirmasi dan verifikasi dari kasir.`
      : `Pesanan Anda #${shortId} telah dibuat. Menunggu konfirmasi dari kasir.`;
    statusBadge = 'pending';
  } else if (status === 'confirmed') {
    title = 'Pesanan Diterima';
    message = orderType === 'delivery'
      ? `Pesanan delivery #${shortId} Anda telah diterima oleh restoran. Dapur akan segera menyiapkan hidangan Anda.`
      : `Pesanan Anda #${shortId} telah dikonfirmasi dan diterima oleh kasir.`;
    statusBadge = 'dikonfirmasi';
  } else if (status === 'processing') {
    title = 'Pesanan Sedang Diproses';
    message = orderType === 'delivery'
      ? `Hidangan pesanan delivery Anda sedang disiapkan dan dimasak oleh chef kami di dapur.`
      : `Chef sedang menyiapkan hidangan Anda di dapur. Mohon tunggu sebentar!`;
    statusBadge = 'proses';
  } else if (status === 'ready') {
    title = 'Pesanan Siap';
    message = orderType === 'takeaway'
      ? `Pesanan takeaway #${shortId} Anda sudah siap! Silakan ambil pesanan Anda di kasir.`
      : orderType === 'dine_in'
      ? `Hidangan pesanan dine-in #${shortId} Anda sudah siap disajikan di meja!`
      : `Pesanan Anda #${shortId} sudah siap disajikan!`;
    statusBadge = 'siap';
  } else if (status === 'shipping') {
    title = 'Pesanan Sedang Dikirim';
    message = `Kabar gembira! Pesanan delivery #${shortId} Anda sedang dalam perjalanan ke alamat Anda oleh kurir. Silakan bersiap-siap menerima pesanan!`;
    statusBadge = 'shipping';
  } else if (status === 'completed') {
    title = 'Pesanan Selesai';
    message = orderType === 'delivery'
      ? `Pesanan delivery #${shortId} telah sukses diantarkan ke alamat Anda. Selamat menikmati hidangan kami!`
      : `Pesanan Anda #${shortId} telah selesai diproses. Terima kasih atas kunjungan Anda!`;
    statusBadge = 'selesai';
  } else if (status === 'cancelled') {
    title = 'Pesanan Dibatalkan';
    message = `Pesanan Anda #${shortId} terpaksa dibatalkan. Alasan: ${reason || 'Tidak disebutkan'}`;
    statusBadge = 'dibatalkan';
  }

  return { title, message, statusBadge };
}

export async function POST(req: NextRequest) {
  try {
    const maintenanceResponse = await checkMaintenanceActive();
    if (maintenanceResponse) {
      return maintenanceResponse;
    }
    
    const body = await req.json();
    const { orderId, action, paymentStatus, status, reason, orderData, itemsData } = body;

    // Anti Replay Attack: Nonce & Timestamp Verification
    const isSensitiveAction = ['create_walkin', 'create_customer_order', 'create_wallet_order', 'pay_order_via_wallet'].includes(action);
    if (isSensitiveAction) {
      const nonce = req.headers.get('x-nonce');
      const timestamp = req.headers.get('x-timestamp');
      
      const now = Date.now();
      const reqTime = Number(timestamp || 0);
      const isExpired = !reqTime || Math.abs(now - reqTime) > 5 * 60_000;
      
      let isValidNonce = false;
      if (nonce && !isExpired) {
        isValidNonce = await consumeNonce(nonce, 5);
      }
      
      if (!isValidNonce) {
        const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '127.0.0.1';
        await logSecurityIncident({
          ipAddress: clientIp,
          endpoint: '/api/orders',
          attackType: 'REPLAY_ATTEMPT',
          severity: 'high',
          payload: { action, nonce, timestamp }
        });
        return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 400 });
      }
    }

    if (action === 'create_walkin') {
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderData)
        .select()
        .single();
        
      if (orderError) throw orderError;
      
      const itemsToInsert = itemsData.map((item: any) => ({
        ...item,
        order_id: newOrder.id
      }));
      
      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(itemsToInsert);
        
      if (itemsError) throw itemsError;
      
      await updateOrderEstimation(newOrder.id, 'pending', supabaseAdmin);
      const { data: updatedOrder } = await supabaseAdmin.from('orders').select('*').eq('id', newOrder.id).single();
      
      return NextResponse.json({ success: true, order: updatedOrder || newOrder });
    }

    if (action === 'create_customer_order') {
      const { orderData, itemsData, paymentMethod, pin, customerLat, customerLng } = body;

      if (!orderData || !itemsData || !paymentMethod) {
        return NextResponse.json({ error: 'Data pesanan, item, dan metode pembayaran wajib diisi' }, { status: 400 });
      }

      // 1. Ambil pengaturan restoran
      const { data: settings, error: settingsErr } = await supabaseAdmin
        .from('restaurant_settings')
        .select('*')
        .single();
      if (settingsErr || !settings) {
        return NextResponse.json({ error: 'Pengaturan restoran tidak ditemukan' }, { status: 500 });
      }

      // 2. Validasi parameter pengiriman jika tipe pesanan delivery
      let calculatedShippingFee = 0;
      let calculatedShippingDiscount = 0;
      let shippingDistance = null;

      if (orderData.order_type === 'delivery') {
        if (!settings.is_shipping_enabled) {
          return NextResponse.json({ error: 'Layanan pengiriman saat ini sedang dinonaktifkan' }, { status: 400 });
        }

        const clientDistance = Number(orderData.distance_km || 0);
        const lat = Number(customerLat || 0);
        const lng = Number(customerLng || 0);

        // Hitung jarak lurus sebagai batas bawah
        const restoLat = Number(settings.resto_latitude || -7.7829);
        const restoLng = Number(settings.resto_longitude || 110.3323);
        const straightLineDistance = calculateHaversineDistance(restoLat, restoLng, lat, lng);

        // Jika jarak yang dikirim client lebih kecil dari 90% jarak lurus (margin error floating point), ada indikasi manipulasi
        if (clientDistance < straightLineDistance * 0.9) {
          return NextResponse.json({ error: 'Jarak pengiriman tidak valid' }, { status: 400 });
        }

        // Cek jarak maksimum pengiriman
        if (straightLineDistance > Number(settings.max_shipping_distance || 15)) {
          return NextResponse.json({ error: 'Alamat pengiriman di luar batas jangkauan layanan kami' }, { status: 400 });
        }

        shippingDistance = clientDistance;

        // Hitung ongkir
        const effectiveDistance = Math.max(clientDistance, Number(settings.min_shipping_distance || 1));
        calculatedShippingFee = Math.round(effectiveDistance * Number(settings.shipping_rate_per_km || 2500));
        calculatedShippingFee += Number(settings.additional_zone_charge || 0);

        // Bandingkan dengan ongkir dari client
        if (Math.abs(calculatedShippingFee - Number(orderData.shipping_fee || 0)) > 100) {
          return NextResponse.json({ error: 'Biaya pengiriman tidak cocok dengan perhitungan server' }, { status: 400 });
        }
      }

      // 3. Hitung subtotal dan periksa ketersediaan menu dari database
      let serverSubtotal = 0;
      const menuItemIds = itemsData.map((item: any) => item.menu_item_id);
      
      const { data: menuItems, error: menuItemsErr } = await supabaseAdmin
        .from('menu_items')
        .select('*')
        .in('id', menuItemIds);
        
      if (menuItemsErr || !menuItems) {
        return NextResponse.json({ error: 'Gagal mengambil data menu' }, { status: 500 });
      }

      for (const item of itemsData) {
        const menuItem = menuItems.find((m: any) => m.id === item.menu_item_id);
        if (!menuItem) {
          return NextResponse.json({ error: 'Menu tidak ditemukan' }, { status: 404 });
        }
        if (!menuItem.is_active) {
          return NextResponse.json({ error: `Menu ${menuItem.name} sedang tidak aktif` }, { status: 400 });
        }
        serverSubtotal += Number(menuItem.price) * Number(item.quantity);
      }

      // 4. Validasi voucher dan hitung diskon
      let serverDiscount = 0;
      if (orderData.voucher_id) {
        const { data: voucher, error: voucherErr } = await supabaseAdmin
          .from('vouchers')
          .select('*')
          .eq('id', orderData.voucher_id)
          .single();
          
        if (voucherErr || !voucher) {
          return NextResponse.json({ error: 'Voucher tidak valid' }, { status: 400 });
        }
        
        if (!voucher.is_active) {
          return NextResponse.json({ error: 'Voucher tidak aktif' }, { status: 400 });
        }
        if (new Date(voucher.expires_at) <= new Date()) {
          return NextResponse.json({ error: 'Voucher sudah kedaluwarsa' }, { status: 400 });
        }
        if (voucher.used_count >= voucher.usage_limit) {
          return NextResponse.json({ error: 'Kuota voucher sudah habis' }, { status: 400 });
        }
        if (voucher.min_transaction && serverSubtotal < Number(voucher.min_transaction)) {
          return NextResponse.json({ error: 'Minimal transaksi voucher tidak terpenuhi' }, { status: 400 });
        }

        const discountVal = voucher.discount_type === 'percent'
          ? Number(voucher.discount_percent || 0)
          : Number(voucher.discount_value || 0);

        if (voucher.voucher_type === 'shipping') {
          if (orderData.order_type !== 'delivery') {
            return NextResponse.json({ error: 'Voucher pengiriman hanya dapat digunakan untuk tipe pesanan Delivery!' }, { status: 400 });
          }
          if (voucher.discount_type === 'percent') {
            calculatedShippingDiscount = Math.round(calculatedShippingFee * discountVal / 100);
          } else {
            calculatedShippingDiscount = Math.min(calculatedShippingFee, discountVal);
          }
        } else {
          // General
          if (orderData.order_type && !['dine_in', 'takeaway', 'delivery'].includes(orderData.order_type)) {
            return NextResponse.json({ error: 'Voucher umum hanya dapat digunakan untuk tipe pesanan Dine In, Takeaway, dan Delivery!' }, { status: 400 });
          }
          if (voucher.discount_type === 'percent') {
            serverDiscount = Math.round(serverSubtotal * discountVal / 100);
          } else {
            serverDiscount = Math.min(serverSubtotal, discountVal);
          }
        }
      }

      // 5. Hitung total akhir
      const serverTotalAmount = Math.max(0, serverSubtotal - serverDiscount + calculatedShippingFee - calculatedShippingDiscount);

      if (Math.abs(serverTotalAmount - Number(orderData.total_amount)) > 100) {
        return NextResponse.json({ error: 'Total nominal transaksi tidak cocok dengan perhitungan server' }, { status: 400 });
      }

      // Get customer profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', orderData.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      // 6. Jalankan pemotongan saldo jika metode pembayaran e-wallet
      if (paymentMethod === 'wallet') {
        // Cek status aktivasi wallet
        const wStatus = profile.wallet_status || 'belum_aktif';
        if (!['diterima', 'selesai'].includes(wStatus)) {
          if (['diajukan', 'diajukan_ulang', 'diproses'].includes(wStatus)) {
            return NextResponse.json({ error: 'Pengajuan aktivasi Dompetku Anda sedang diproses. Mohon tunggu hasil verifikasi dari admin.', code: 'WALLET_INACTIVE' }, { status: 400 });
          } else if (wStatus === 'ditolak') {
            return NextResponse.json({ error: 'Pengajuan aktivasi Dompetku Anda ditolak. Silakan perbaiki data atau unggah ulang dokumen di halaman Dompetku.', code: 'WALLET_INACTIVE' }, { status: 400 });
          } else {
            return NextResponse.json({ error: 'Dompetku belum diaktifkan. Silakan lakukan aktivasi terlebih dahulu untuk menggunakan metode pembayaran ini.', code: 'WALLET_INACTIVE' }, { status: 400 });
          }
        }

        if (profile.is_wallet_blocked) {
          const blockReason = profile.wallet_block_reason || 'Dompetku Anda diblokir. Hubungi admin atau ajukan banding di halaman Dompetku.';
          return NextResponse.json({ error: blockReason, code: 'WALLET_BLOCKED' }, { status: 400 });
        }

        if (!profile.wallet_pin) {
          return NextResponse.json({ error: 'Anda belum membuat PIN Dompetku. Silakan buat PIN terlebih dahulu di halaman Dompetku.', code: 'NO_PIN' }, { status: 400 });
        }
        if (!pin) {
          return NextResponse.json({ error: 'Masukkan PIN Dompetku untuk melanjutkan pembayaran', code: 'PIN_REQUIRED' }, { status: 400 });
        }

        // Hash PIN dan cocokkan
        const encoder = new TextEncoder();
        const pinBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(pin)));
        const hashedPin = Array.from(new Uint8Array(pinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashedPin !== profile.wallet_pin) {
          const newCount = (profile.wrong_pin_count || 0) + 1;
          if (newCount >= 3) {
            await supabaseAdmin.from('profiles').update({
              wrong_pin_count: newCount,
              is_wallet_blocked: true,
              wallet_block_reason: 'Dompetku Anda diblokir secara otomatis karena PIN salah dimasukkan 3 kali berturut-turut. Ajukan banding di halaman Dompetku untuk membuka blokir.'
            }).eq('id', profile.id);
            await supabaseAdmin.from('notifications').insert({
              user_id: profile.id,
              title: 'Dompetku Diblokir Otomatis',
              message: 'PIN Dompetku Anda salah 3 kali berturut-turut. Dompetku Anda telah diblokir untuk keamanan. Ajukan banding di halaman Dompetku.',
              type: 'wallet_blocked',
            });
            return NextResponse.json({ error: 'PIN salah 3 kali berturut-turut. Dompetku Anda telah diblokir otomatis. Buka halaman Dompetku untuk mengajukan banding.', code: 'WALLET_BLOCKED_NOW' }, { status: 400 });
          }
          await supabaseAdmin.from('profiles').update({ wrong_pin_count: newCount }).eq('id', profile.id);
          return NextResponse.json({ error: `PIN salah. Sisa percobaan: ${3 - newCount} kali lagi.`, code: 'WRONG_PIN', remaining: 3 - newCount }, { status: 400 });
        }

        // PIN benar — reset hitungan
        await supabaseAdmin.from('profiles').update({ wrong_pin_count: 0 }).eq('id', profile.id);

        const balance = Number(profile.wallet_balance || 0);
        if (balance < serverTotalAmount) {
          return NextResponse.json({ error: 'Saldo dompet tidak mencukupi untuk melakukan pembayaran' }, { status: 400 });
        }

        // Deduct balance
        const { error: deductErr } = await supabaseAdmin
          .from('profiles')
          .update({ wallet_balance: balance - serverTotalAmount })
          .eq('id', profile.id);

        if (deductErr) throw deductErr;
      }

      // 7. Simpan pesanan ke database
      const dbPaymentStatus = (paymentMethod === 'wallet' || paymentMethod === 'free') ? 'paid' : 'unpaid';
      const dbPaymentMethodColumn = paymentMethod === 'free' ? 'voucher' : paymentMethod; // 'cash', 'non_cash', 'wallet', 'voucher'

      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          customer_id: orderData.customer_id,
          table_id: orderData.table_id,
          order_type: orderData.order_type,
          total_amount: serverTotalAmount,
          notes: orderData.notes,
          status: 'pending',
          payment_method: dbPaymentMethodColumn,
          payment_status: dbPaymentStatus,
          voucher_id: orderData.voucher_id,
          discount: serverDiscount,
          distance_km: shippingDistance,
          shipping_fee: calculatedShippingFee,
          shipping_discount: calculatedShippingDiscount,
          delivery_recipient_name: orderData.delivery_recipient_name,
          delivery_phone: orderData.delivery_phone,
          delivery_address: orderData.delivery_address,
          delivery_province: orderData.delivery_province,
          delivery_regency: orderData.delivery_regency,
          delivery_district: orderData.delivery_district,
          delivery_village: orderData.delivery_village,
          delivery_postal_code: orderData.delivery_postal_code
        })
        .select()
        .single();

      if (orderError) {
        // Rollback balance jika wallet
        if (paymentMethod === 'wallet') {
          const balanceObj = await supabaseAdmin.from('profiles').select('wallet_balance').eq('id', profile.id).single();
          const curBal = Number(balanceObj.data?.wallet_balance || 0);
          await supabaseAdmin.from('profiles').update({ wallet_balance: curBal + serverTotalAmount }).eq('id', profile.id);
        }
        throw orderError;
      }

      // 8. Simpan item pesanan
      const itemsToInsert = itemsData.map((item: any) => {
        const menuItem = menuItems.find((m: any) => m.id === item.menu_item_id)!;
        return {
          order_id: newOrder.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          price: menuItem.price,
          subtotal: Number(menuItem.price) * Number(item.quantity),
          notes: item.notes || null
        };
      });

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback order dan balance
        await supabaseAdmin.from('orders').delete().eq('id', newOrder.id);
        if (paymentMethod === 'wallet') {
          const balanceObj = await supabaseAdmin.from('profiles').select('wallet_balance').eq('id', profile.id).single();
          const curBal = Number(balanceObj.data?.wallet_balance || 0);
          await supabaseAdmin.from('profiles').update({ wallet_balance: curBal + serverTotalAmount }).eq('id', profile.id);
        }
        throw itemsError;
      }

      // 9. Catat transaksi dompet jika menggunakan wallet
      if (paymentMethod === 'wallet') {
        await supabaseAdmin.from('wallet_transactions').insert({
          customer_id: profile.id,
          amount: serverTotalAmount,
          type: 'payment',
          status: 'success',
          description: `Pembayaran pesanan #${newOrder.id.substring(0, 8).toUpperCase()}`
        });
      }

      // 10. Update status meja jika dine_in
      if (newOrder.table_id) {
        await supabaseAdmin.from("tables").update({ status: "occupied", occupied_at: new Date().toISOString() }).eq("id", newOrder.table_id);
      }

      // 11. Kirim notifikasi jika sudah lunas (wallet / free)
      if (dbPaymentStatus === 'paid') {
        const payMethodName = paymentMethod === 'free' ? 'Voucher' : 'Dompetku';
        const paidNotif = getPaidNotification(newOrder, payMethodName);
        await supabaseAdmin.from('notifications').insert({
          user_id: newOrder.customer_id,
          title: paidNotif.title,
          message: paidNotif.message,
          type: 'order',
          order_id: newOrder.id,
          status_badge: paidNotif.status_badge
        });
      }

      await updateOrderEstimation(newOrder.id, 'pending', supabaseAdmin);
      const { data: updatedOrder } = await supabaseAdmin.from('orders').select('*').eq('id', newOrder.id).single();

      return NextResponse.json({ success: true, order: updatedOrder || newOrder });
    }

    if (action === 'create_wallet_order') {
      const { orderData, itemsData } = body;
      if (!orderData || !itemsData) {
        return NextResponse.json({ error: 'Order data and items data are required' }, { status: 400 });
      }

      // Get customer profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance, is_wallet_blocked, wallet_block_reason, wallet_pin, wrong_pin_count, wallet_status')
        .eq('id', orderData.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      // Cek status aktivasi wallet
      const wStatus = profile.wallet_status || 'belum_aktif';
      if (!['diterima', 'selesai'].includes(wStatus)) {
        if (['diajukan', 'diajukan_ulang', 'diproses'].includes(wStatus)) {
          return NextResponse.json({ error: 'Pengajuan aktivasi Dompetku Anda sedang diproses. Mohon tunggu hasil verifikasi dari admin.', code: 'WALLET_INACTIVE' }, { status: 400 });
        } else if (wStatus === 'ditolak') {
          return NextResponse.json({ error: 'Pengajuan aktivasi Dompetku Anda ditolak. Silakan perbaiki data atau unggah ulang dokumen di halaman Dompetku.', code: 'WALLET_INACTIVE' }, { status: 400 });
        } else {
          return NextResponse.json({ error: 'Dompetku belum diaktifkan. Silakan lakukan aktivasi terlebih dahulu untuk menggunakan metode pembayaran ini.', code: 'WALLET_INACTIVE' }, { status: 400 });
        }
      }

      if (profile.is_wallet_blocked) {
        const reason = profile.wallet_block_reason || 'Dompetku Anda diblokir. Hubungi admin atau ajukan banding di halaman Dompetku.';
        return NextResponse.json({ error: reason, code: 'WALLET_BLOCKED' }, { status: 400 });
      }

      // Verifikasi PIN jika sudah diset
      const { pin } = body;
      if (!profile.wallet_pin) {
        return NextResponse.json({ error: 'Anda belum membuat PIN Dompetku. Silakan buat PIN terlebih dahulu di halaman Dompetku.', code: 'NO_PIN' }, { status: 400 });
      }
      if (!pin) {
        return NextResponse.json({ error: 'Masukkan PIN Dompetku untuk melanjutkan pembayaran', code: 'PIN_REQUIRED' }, { status: 400 });
      }

      // Hash PIN dan cocokkan
      const encoder = new TextEncoder();
      const pinBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(pin)));
      const hashedPin = Array.from(new Uint8Array(pinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashedPin !== profile.wallet_pin) {
        const newCount = (profile.wrong_pin_count || 0) + 1;
        if (newCount >= 3) {
          // Blokir dompet
          await supabaseAdmin.from('profiles').update({
            wrong_pin_count: newCount,
            is_wallet_blocked: true,
            wallet_block_reason: 'Dompetku Anda diblokir secara otomatis karena PIN salah dimasukkan 3 kali berturut-turut. Ajukan banding di halaman Dompetku untuk membuka blokir.'
          }).eq('id', profile.id);
          await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: 'Dompetku Diblokir Otomatis',
            message: 'PIN Dompetku Anda salah 3 kali berturut-turut. Dompetku Anda telah diblokir untuk keamanan. Ajukan banding di halaman Dompetku.',
            type: 'wallet_blocked',
          });
          return NextResponse.json({ error: 'PIN salah 3 kali berturut-turut. Dompetku Anda telah diblokir otomatis. Buka halaman Dompetku untuk mengajukan banding.', code: 'WALLET_BLOCKED_NOW' }, { status: 400 });
        }
        await supabaseAdmin.from('profiles').update({ wrong_pin_count: newCount }).eq('id', profile.id);
        return NextResponse.json({ error: `PIN salah. Sisa percobaan: ${3 - newCount} kali lagi.`, code: 'WRONG_PIN', remaining: 3 - newCount }, { status: 400 });
      }

      // PIN benar — reset hitungan
      await supabaseAdmin.from('profiles').update({ wrong_pin_count: 0 }).eq('id', profile.id);

      const balance = Number(profile.wallet_balance || 0);
      const total = Number(orderData.total_amount);

      if (balance < total) {
        return NextResponse.json({ error: 'Saldo dompet tidak mencukupi untuk melakukan pembayaran' }, { status: 400 });
      }

      // Deduct balance
      const { error: deductErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: balance - total })
        .eq('id', profile.id);

      if (deductErr) throw deductErr;

      // Create order
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          ...orderData,
          payment_method: 'wallet',
          payment_status: 'paid',
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        // Rollback balance
        await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', profile.id);
        throw orderError;
      }

      // Insert items
      const itemsToInsert = itemsData.map((item: any) => ({
        ...item,
        order_id: newOrder.id
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback order and balance
        await supabaseAdmin.from('orders').delete().eq('id', newOrder.id);
        await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', profile.id);
        throw itemsError;
      }

      // Log wallet transaction
      await supabaseAdmin.from('wallet_transactions').insert({
        customer_id: profile.id,
        amount: total,
        type: 'payment',
        status: 'success',
        description: `Pembayaran pesanan #${newOrder.id.substring(0, 8).toUpperCase()}`
      });

      // Update table if dine_in
      if (newOrder.table_id) {
        await supabaseAdmin.from("tables").update({ status: "occupied", occupied_at: new Date().toISOString() }).eq("id", newOrder.table_id);
      }

      // Notification
      const paidNotif = getPaidNotification(newOrder, 'Dompetku');
      await supabaseAdmin.from('notifications').insert({
        user_id: newOrder.customer_id,
        title: paidNotif.title,
        message: paidNotif.message,
        type: 'order',
        order_id: newOrder.id,
        status_badge: paidNotif.status_badge
      });

      await updateOrderEstimation(newOrder.id, 'pending', supabaseAdmin);
      const { data: updatedOrder } = await supabaseAdmin.from('orders').select('*').eq('id', newOrder.id).single();

      return NextResponse.json({ success: true, order: updatedOrder || newOrder });
    }

    if (action === 'pay_order_via_wallet') {
      if (!orderId) {
        return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
      }

      // Fetch order
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
      }

      if (order.payment_status === 'paid') {
        return NextResponse.json({ error: 'Pesanan ini sudah lunas' }, { status: 400 });
      }

      if (order.status === 'cancelled') {
        return NextResponse.json({ error: 'Pesanan ini sudah dibatalkan' }, { status: 400 });
      }

      // Fetch profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance, is_wallet_blocked, wallet_block_reason, wallet_pin, wrong_pin_count, wallet_status')
        .eq('id', order.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      // Cek status aktivasi wallet
      const wStatus = profile.wallet_status || 'belum_aktif';
      if (!['diterima', 'selesai'].includes(wStatus)) {
        if (['diajukan', 'diajukan_ulang', 'diproses'].includes(wStatus)) {
          return NextResponse.json({ error: 'Pengajuan aktivasi Dompetku Anda sedang diproses. Mohon tunggu hasil verifikasi dari admin.', code: 'WALLET_INACTIVE' }, { status: 400 });
        } else if (wStatus === 'ditolak') {
          return NextResponse.json({ error: 'Pengajuan aktivasi Dompetku Anda ditolak. Silakan perbaiki data atau unggah ulang dokumen di halaman Dompetku.', code: 'WALLET_INACTIVE' }, { status: 400 });
        } else {
          return NextResponse.json({ error: 'Dompetku belum diaktifkan. Silakan lakukan aktivasi terlebih dahulu untuk menggunakan metode pembayaran ini.', code: 'WALLET_INACTIVE' }, { status: 400 });
        }
      }

      if (profile.is_wallet_blocked) {
        const reason = profile.wallet_block_reason || 'Dompetku Anda diblokir. Hubungi admin atau ajukan banding di halaman Dompetku.';
        return NextResponse.json({ error: reason, code: 'WALLET_BLOCKED' }, { status: 400 });
      }

      // Verifikasi PIN jika sudah diset
      const { pin: payPin } = body;
      if (!profile.wallet_pin) {
        return NextResponse.json({ error: 'Anda belum membuat PIN Dompetku. Silakan buat PIN terlebih dahulu di halaman Dompetku.', code: 'NO_PIN' }, { status: 400 });
      }
      if (!payPin) {
        return NextResponse.json({ error: 'Masukkan PIN Dompetku untuk melanjutkan pembayaran', code: 'PIN_REQUIRED' }, { status: 400 });
      }

      // Hash PIN dan cocokkan
      const payEncoder = new TextEncoder();
      const payPinBuffer = await crypto.subtle.digest('SHA-256', payEncoder.encode(String(payPin)));
      const hashedPayPin = Array.from(new Uint8Array(payPinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashedPayPin !== profile.wallet_pin) {
        const newPayCount = (profile.wrong_pin_count || 0) + 1;
        if (newPayCount >= 3) {
          await supabaseAdmin.from('profiles').update({
            wrong_pin_count: newPayCount,
            is_wallet_blocked: true,
            wallet_block_reason: 'Dompetku Anda diblokir secara otomatis karena PIN salah dimasukkan 3 kali berturut-turut. Ajukan banding di halaman Dompetku untuk membuka blokir.'
          }).eq('id', profile.id);
          await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: 'Dompetku Diblokir Otomatis',
            message: 'PIN Dompetku Anda salah 3 kali berturut-turut. Dompetku Anda telah diblokir untuk keamanan. Ajukan banding di halaman Dompetku.',
            type: 'wallet_blocked',
          });
          return NextResponse.json({ error: 'PIN salah 3 kali berturut-turut. Dompetku Anda telah diblokir otomatis. Buka halaman Dompetku untuk mengajukan banding.', code: 'WALLET_BLOCKED_NOW' }, { status: 400 });
        }
        await supabaseAdmin.from('profiles').update({ wrong_pin_count: newPayCount }).eq('id', profile.id);
        return NextResponse.json({ error: `PIN salah. Sisa percobaan: ${3 - newPayCount} kali lagi.`, code: 'WRONG_PIN', remaining: 3 - newPayCount }, { status: 400 });
      }

      // PIN benar — reset hitungan
      await supabaseAdmin.from('profiles').update({ wrong_pin_count: 0 }).eq('id', profile.id);

      const balance = Number(profile.wallet_balance || 0);
      const total = Number(order.total_amount);

      if (balance < total) {
        return NextResponse.json({ error: 'Saldo dompet tidak mencukupi untuk melakukan pembayaran' }, { status: 400 });
      }

      // Deduct balance
      const { error: deductErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: balance - total })
        .eq('id', profile.id);

      if (deductErr) throw deductErr;

      // Update order
      const { error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({
          payment_method: 'wallet',
          payment_status: 'paid'
        })
        .eq('id', orderId);

      if (updateErr) {
        // Rollback balance
        await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', profile.id);
        throw updateErr;
      }

      // Log wallet transaction
      await supabaseAdmin.from('wallet_transactions').insert({
        customer_id: profile.id,
        amount: total,
        type: 'payment',
        status: 'success',
        description: `Pembayaran pesanan #${orderId.substring(0, 8).toUpperCase()}`
      });

      // Notification
      const paidNotif = getPaidNotification(order, 'Dompetku');
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: paidNotif.title,
        message: paidNotif.message,
        type: 'order',
        order_id: orderId,
        status_badge: paidNotif.status_badge
      });

      await updateOrderEstimation(orderId, order.status, supabaseAdmin);
      return NextResponse.json({ success: true, message: 'Pembayaran berhasil menggunakan Saldo Dompet' });
    }



    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Get current order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (action === 'cancel') {
      // Only allow cancel if status is pending (customer)
      if (order.status !== 'pending') {
        return NextResponse.json({ error: 'Pesanan sudah dikonfirmasi dan tidak dapat dibatalkan' }, { status: 400 });
      }

      const cancelReason = reason || 'Dibatalkan oleh pelanggan';
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', cancel_reason: cancelReason })
        .eq('id', orderId);

      if (error) throw error;

      await autoCloseOrderChat(orderId, supabaseAdmin, 'cancelled');

      // Add Notification
      if (order.customer_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: 'Pesanan Dibatalkan',
          message: `No. Pesanan #${orderId.split('-')[0].toUpperCase()} telah dibatalkan. Alasan: ${cancelReason}`,
          type: 'order',
          order_id: orderId,
          status_badge: 'dibatalkan'
        });
      }

      if (order.table_id) {
        await supabaseAdmin.from('tables').update({ status: 'available', occupied_at: null }).eq('id', order.table_id);
      }

      await updateOrderEstimation(orderId, 'cancelled', supabaseAdmin);
      return NextResponse.json({ success: true, message: 'Pesanan berhasil dibatalkan' });
    }

    if (action === 'update_status') {
      if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });

      const updateData: any = { status };
      if (status === 'cancelled' && reason) {
        updateData.cancel_reason = reason;
      }

      const { error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      if (['completed', 'shipping', 'cancelled'].includes(status)) {
        await autoCloseOrderChat(orderId, supabaseAdmin, status);
      }

      // Add Notification
      if (order.customer_id) {
        const { title, message, statusBadge } = getStatusNotification(status, orderId, order.order_type, reason);
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: title,
          message: message,
          type: 'order',
          order_id: orderId,
          status_badge: statusBadge
        });
      }

      if ((status === 'cancelled' || status === 'completed') && order.table_id) {
        await supabaseAdmin.from('tables').update({ status: 'available', occupied_at: null }).eq('id', order.table_id);
      }

      await updateOrderEstimation(orderId, status, supabaseAdmin);
      return NextResponse.json({ success: true, message: `Status pesanan diperbarui ke ${status}` });
    }

    if (action === 'process_pos_payment') {
      const pStatus = paymentStatus || 'paid';
      const oStatus = status || 'completed';
      const pMethod = body.paymentMethod || 'cash';
      
      const updateData: any = { 
        payment_status: pStatus,
        status: oStatus,
        cashier_id: body.cashierId || null,
        total_amount: body.totalAmount,
        notes: body.notes,
        payment_method: pMethod
      };

      if (body.voucherId !== undefined) {
        updateData.voucher_id = body.voucherId;
      }
      if (body.discount !== undefined) {
        updateData.discount = body.discount;
      }

      const { error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      if (['completed', 'shipping', 'cancelled'].includes(oStatus)) {
        await autoCloseOrderChat(orderId, supabaseAdmin, oStatus);
      }

      if (pStatus === 'paid') {
        const payMethodName = pMethod === 'cash' ? 'Tunai' : pMethod === 'wallet' ? 'Dompetku' : 'Pembayaran Online';
        const paidNotif = getPaidNotification(order, payMethodName);
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: paidNotif.title,
          message: paidNotif.message,
          type: 'order',
          order_id: orderId,
          status_badge: paidNotif.status_badge
        });

        // Also add status update notification if it changed
        if (oStatus !== order.status) {
          const { title, message, statusBadge } = getStatusNotification(oStatus, orderId, order.order_type);
          await supabaseAdmin.from('notifications').insert({
            user_id: order.customer_id,
            title,
            message,
            type: 'order',
            order_id: orderId,
            status_badge: statusBadge
          });
        }

        if (body.tableId) {
          await supabaseAdmin.from('tables').update({ status: 'occupied', occupied_at: new Date().toISOString() }).eq('id', body.tableId);
        }
      }

      await updateOrderEstimation(orderId, oStatus, supabaseAdmin);
      return NextResponse.json({ success: true, message: 'Payment processed' });
    }

    if (action === 'update_payment') {
      const pStatus = paymentStatus || 'paid';
      const cashierId = body.cashierId;

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: pStatus,
          cashier_id: cashierId || null 
        })
        .eq('id', orderId);

      if (error) throw error;

      if (pStatus === 'paid') {
        const payMethodName = order.payment_method === 'cash' ? 'Tunai' : order.payment_method === 'wallet' ? 'Dompetku' : 'Pembayaran Online';
        const paidNotif = getPaidNotification(order, payMethodName);
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: paidNotif.title,
          message: paidNotif.message,
          type: 'order',
          order_id: orderId,
          status_badge: paidNotif.status_badge
        });
      }

      return NextResponse.json({ success: true, message: 'Status pembayaran diperbarui' });
    }

    if (action === 'submit_refund') {
      const { refundDetails } = body;
      if (!refundDetails) return NextResponse.json({ error: 'Refund details are required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          status: 'cancelled',
          cancel_reason: JSON.stringify(refundDetails) 
        })
        .eq('id', orderId);

      if (error) throw error;

      const isWallet = refundDetails.refundMethod === 'wallet';
      const destText = isWallet ? 'Saldo Dompet Anda' : `rekening bank/e-wallet ${refundDetails.bankName}`;

      // Add Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Pengajuan Refund Dikirim',
        message: `Permohonan refund untuk pesanan #${orderId.split('-')[0]} sedang diajukan. Dana diajukan untuk dikembalikan ke ${destText}.`,
        type: 'order',
        status_badge: 'Pending'
      });

      return NextResponse.json({ success: true, message: 'Refund request submitted' });
    }

    if (action === 'process_refund') {
      const { refundDetails } = body;
      if (!refundDetails) return NextResponse.json({ error: 'Refund details are required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ cancel_reason: JSON.stringify(refundDetails) })
        .eq('id', orderId);

      if (error) throw error;

      const isApproved = refundDetails.refundStatus === 'approved';
      const isWallet = refundDetails.refundMethod === 'wallet';
      const isOnlineOrWalletPayment = order.payment_method === 'duitku' || order.payment_method === 'non_cash' || order.payment_method === 'wallet';

      if (isApproved) {
        // 1. Restore voucher if applicable (decrement usage counts so customer can reuse it)
        if (order.voucher_id) {
          const { data: vData } = await supabaseAdmin
            .from('vouchers')
            .select('code, used_count')
            .eq('id', order.voucher_id)
            .single();
          if (vData) {
            await supabaseAdmin
              .from('vouchers')
              .update({ used_count: Math.max(0, Number(vData.used_count || 0) - 1) })
              .eq('id', order.voucher_id);

            // Cari dan kembalikan reward_redemptions terkait agar muncul di Reward Saya
            const { data: rrData } = await supabaseAdmin
              .from('reward_redemptions')
              .select('id, rewards(title)')
              .eq('customer_id', order.customer_id)
              .eq('code', vData.code)
              .eq('status', 'used')
              .maybeSingle();

            if (rrData) {
              await supabaseAdmin
                .from('reward_redemptions')
                .update({
                  status: 'success',
                  refunded_at: new Date().toISOString(),
                  used_at: null
                })
                .eq('id', rrData.id);

              const rewardTitle = (rrData.rewards as any)?.title || 'Reward';

              // Tambahkan log point_transactions bertipe 'refunded' agar muncul badge "Dikembalikan"
              await supabaseAdmin
                .from('point_transactions')
                .insert({
                  customer_id: order.customer_id,
                  points: 0,
                  status: 'refunded',
                  description: `Voucher dikembalikan: ${rewardTitle} (${vData.code})`
                });
            }
          }

          const { data: cvData } = await supabaseAdmin
            .from('customer_vouchers')
            .select('used_count')
            .eq('customer_id', order.customer_id)
            .eq('voucher_id', order.voucher_id)
            .single();
          if (cvData) {
            await supabaseAdmin
              .from('customer_vouchers')
              .update({ used_count: Math.max(0, Number(cvData.used_count || 0) - 1) })
              .eq('customer_id', order.customer_id)
              .eq('voucher_id', order.voucher_id);
          }
        }

        // 2. Refund cash amount to e-wallet balance if chosen wallet or paid online/wallet
        const refundToWallet = isWallet || isOnlineOrWalletPayment;
        const refundAmount = Number(order.total_amount);

        if (refundToWallet && refundAmount > 0) {
          const { data: profile, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('wallet_balance')
            .eq('id', order.customer_id)
            .single();
          if (profErr || !profile) throw new Error('Profil pelanggan tidak ditemukan untuk pencairan saldo');
          
          const newBalance = Number(profile.wallet_balance || 0) + refundAmount;
          const { error: balErr } = await supabaseAdmin
            .from('profiles')
            .update({ wallet_balance: newBalance })
            .eq('id', order.customer_id);
          if (balErr) throw balErr;

          // Log wallet transaction
          await supabaseAdmin.from('wallet_transactions').insert({
            customer_id: order.customer_id,
            amount: refundAmount,
            type: 'refund',
            status: 'success',
            description: `Refund pesanan #${order.id.substring(0, 8).toUpperCase()}`
          });
        }
      }

      let notifMessage = '';
      if (isApproved) {
        const refundToWallet = isWallet || isOnlineOrWalletPayment;
        const refundAmount = Number(order.total_amount);
        const hasVoucher = !!order.voucher_id;

        if (refundToWallet && refundAmount > 0) {
          if (hasVoucher) {
            notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana cash sebesar Rp ${refundAmount.toLocaleString("id-ID")} telah dikreditkan ke Saldo Dompet Anda, dan voucher belanja Anda telah dikembalikan agar dapat digunakan kembali.`;
          } else {
            notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana sebesar Rp ${refundAmount.toLocaleString("id-ID")} telah dicairkan ke Saldo Dompet Anda.`;
          }
        } else if (hasVoucher && refundAmount === 0) {
          notifMessage = `Refund disetujui untuk pesanan gratis #${orderId.split('-')[0]}. Voucher belanja Anda telah dikembalikan dan dapat Anda gunakan kembali.`;
        } else {
          notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana sebesar Rp ${refundAmount.toLocaleString("id-ID")} telah berhasil ditransfer ke rekening bank/e-wallet pilihan Anda.`;
        }
      } else {
        notifMessage = `Refund ditolak untuk pesanan #${orderId.split('-')[0]}. Alasan: ${refundDetails.adminNotes || 'Tidak ada catatan'}.`;
      }

      // Add Notification for customer
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: isApproved ? 'Refund Disetujui' : 'Refund Ditolak',
        message: notifMessage,
        type: 'order',
        status_badge: isApproved ? 'Berhasil' : 'Gagal'
      });

      return NextResponse.json({ success: true, message: 'Refund request processed' });
    }

    // New action: notification for order created
    if (action === 'notify_created') {
      let title = 'Pesanan Menunggu Konfirmasi';
      let message = order.order_type === 'delivery'
        ? `Pesanan delivery #${orderId.split('-')[0].toUpperCase()} telah dibuat. Menunggu konfirmasi dan verifikasi dari kasir.`
        : `Pesanan Anda #${orderId.split('-')[0].toUpperCase()} telah dibuat. Menunggu konfirmasi dari kasir.`;
      let statusBadge = 'Menunggu dikonfirmasi';

      if (order.payment_method === 'non_cash' && order.payment_status === 'unpaid') {
        title = 'Menunggu Pembayaran';
        message = `Pesanan Anda #${orderId.split('-')[0].toUpperCase()} telah dibuat. Silakan lakukan pembayaran online agar pesanan dapat segera dikonfirmasi dan diproses.`;
        statusBadge = 'Menunggu untuk dibayar';
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title,
        message,
        type: 'order',
        order_id: orderId,
        status_badge: statusBadge
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'notify_duitku_closed') {
      const shortId = orderId.split('-')[0].toUpperCase();
      
      // Check for a recent notification to avoid duplicate spamming
      const { data: recentNotifs } = await supabaseAdmin
        .from('notifications')
        .select('id, created_at')
        .eq('user_id', order.customer_id)
        .eq('order_id', orderId)
        .eq('status_badge', 'Menunggu untuk dibayar ulang')
        .order('created_at', { ascending: false })
        .limit(1);

      let skipInsert = false;
      if (recentNotifs && recentNotifs.length > 0) {
        const timeDiff = new Date().getTime() - new Date(recentNotifs[0].created_at).getTime();
        if (timeDiff < 10000) {
          skipInsert = true;
        }
      }

      if (!skipInsert) {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: 'Pembayaran Belum Selesai',
          message: `Anda telah keluar dari halaman pembayaran online sebelum menyelesaikan transaksi untuk No. Pesanan #${shortId}. Silakan lakukan pembayaran ulang.`,
          type: 'order',
          order_id: orderId,
          status_badge: 'Menunggu untuk dibayar ulang'
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function autoCloseOrderChat(orderId: string, supabaseAdmin: any, newStatus: string) {
  try {
    const { data: chat } = await supabaseAdmin
      .from('order_chats')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (chat && chat.status !== 'completed' && chat.status !== 'expired') {
      const { data: settings } = await supabaseAdmin
        .from('support_settings')
        .select('*')
        .eq('id', '77777777-7777-7777-7777-777777777777')
        .single();

      const hours = settings?.order_chat_expiry_hours ?? 0;
      const minutes = settings?.order_chat_expiry_minutes ?? 30;
      const seconds = settings?.order_chat_expiry_seconds ?? 0;

      const now = new Date();
      const closedAt = now.toISOString();
      const deletedAt = new Date(now.getTime() + (hours * 3600 + minutes * 60 + seconds) * 1000).toISOString();

      await supabaseAdmin
        .from('order_chats')
        .update({
          status: 'completed',
          chat_closed_at: closedAt,
          chat_history_deleted_at: deletedAt,
          updated_at: now.toISOString()
        })
        .eq('id', chat.id);

      let wordingTime = '';
      if (hours > 0) wordingTime += `${hours} jam `;
      if (minutes > 0) wordingTime += `${minutes} menit `;
      if (seconds > 0) wordingTime += `${seconds} detik`;
      if (!wordingTime) wordingTime = 'beberapa saat';

      let statusMsgText = 'diperbarui';
      if (newStatus === 'completed') statusMsgText = 'selesai';
      else if (newStatus === 'shipping') statusMsgText = 'terkirim';
      else if (newStatus === 'cancelled') statusMsgText = 'dibatalkan';

      await supabaseAdmin.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: `Sesi obrolan ini ditutup otomatis karena status pesanan telah ${statusMsgText}. Seluruh riwayat pesan akan dihapus otomatis secara permanen dalam ${wordingTime.trim()}. Terima kasih!`,
        is_read: false
      });
    }
  } catch (e) {
    console.error("Gagal menutup obrolan order secara otomatis:", e);
  }
}
