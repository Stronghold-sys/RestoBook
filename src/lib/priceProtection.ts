import { supabaseAdmin } from './supabase/admin';

export interface PriceValidationRequest {
  customerId: string;
  itemsData: {
    menu_item_id: string;
    quantity: number;
    price?: number;       // Dari frontend (untuk verifikasi tampering)
    subtotal?: number;    // Dari frontend (untuk verifikasi tampering)
  }[];
  orderData: {
    total_amount: number; // Dari frontend (untuk verifikasi tampering)
    order_type: 'dine_in' | 'takeaway' | 'delivery';
    voucher_id?: string | null;
    distance_km?: number | null;
    shipping_fee?: number | null;
    shipping_discount?: number | null;
    discount?: number | null;
  };
  customerLat?: number | null;
  customerLng?: number | null;
  clientIp: string;
  userAgent: string;
  endpoint: string;
}

export interface PriceValidationResult {
  isValid: boolean;
  tamperingDetected: boolean;
  calculatedValues: {
    subtotal: number;
    discount: number;
    shippingFee: number;
    shippingDiscount: number;
    totalAmount: number;
    menuItems: any[];
  };
  error?: string;
  errorCode?: string;
}

/**
 * Hitung Jarak Haversine (batas bawah deteksi spoofing GPS)
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // radius bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Validasi Harga di Sisi Server (Price Tampering Protection)
 */
export async function validateAndCalculatePrice(
  request: PriceValidationRequest
): Promise<PriceValidationResult> {
  const {
    customerId,
    itemsData,
    orderData,
    customerLat,
    customerLng,
    clientIp,
    userAgent,
    endpoint
  } = request;

  try {
    // 1. Ambil Profil Pelanggan & Cek Status Pemblokiran
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, is_active, is_blocked, status, locked_until, price_tampering_attempts')
      .eq('id', customerId)
      .single();

    if (profileErr || !profile) {
      return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Profil pelanggan tidak ditemukan.', errorCode: 'USER_NOT_FOUND' };
    }

    if (!profile.is_active || profile.is_blocked || profile.status === 'suspended') {
      return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Akun Anda sedang ditangguhkan.', errorCode: 'USER_SUSPENDED' };
    }

    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      const lockExpiry = new Date(profile.locked_until).toLocaleTimeString('id-ID');
      return { 
        isValid: false, 
        tamperingDetected: false, 
        calculatedValues: {} as any, 
        error: `Akun Anda diblokir sementara karena aktivitas mencurigakan berulang. Silakan coba lagi setelah pukul ${lockExpiry}.`,
        errorCode: 'USER_TEMPORARILY_LOCKED' 
      };
    }

    // 2. Ambil Aturan & Setelan Restoran
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('restaurant_settings')
      .select('*')
      .single();

    if (settingsErr || !settings) {
      return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Pengaturan restoran tidak ditemukan.', errorCode: 'SETTINGS_NOT_FOUND' };
    }

    // 3. Ambil Item Produk dari Database (Terapkan SELECT FOR UPDATE di Transaksi jika menggunakan postgres langsung)
    // Next.js Edge Runtime memvalidasi data langsung dari database
    const menuItemIds = itemsData.map(item => item.menu_item_id);
    const { data: menuItems, error: menuItemsErr } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .in('id', menuItemIds);

    if (menuItemsErr || !menuItems || menuItems.length === 0) {
      return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Produk tidak ditemukan di database.', errorCode: 'PRODUCTS_NOT_FOUND' };
    }

    // 4. Validasi Stok, Status Aktif, dan Hitung Subtotal Resmi Server
    let serverSubtotal = 0;
    let itemPriceTampered = false;
    const itemsMap = new Map();

    for (const item of itemsData) {
      const menuItem = menuItems.find((m: any) => m.id === item.menu_item_id);
      if (!menuItem || menuItem.is_deleted) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Salah satu produk di keranjang Anda sudah tidak tersedia.', errorCode: 'PRODUCT_DELETED' };
      }
      if (!menuItem.is_active) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: `Produk ${menuItem.name} sedang tidak aktif.`, errorCode: 'PRODUCT_INACTIVE' };
      }

      // Validasi Stok (Mencegah Overselling)
      const requestedQty = Number(item.quantity || 0);
      if (requestedQty <= 0) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Jumlah produk harus lebih besar dari nol.', errorCode: 'INVALID_QUANTITY' };
      }
      if (menuItem.stock !== null && menuItem.stock < requestedQty) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: `Stok produk ${menuItem.name} tidak mencukupi. Tersisa ${menuItem.stock} porsi.`, errorCode: 'INSUFFICIENT_STOCK' };
      }

      // Deteksi manipulasi harga per item
      const dbPrice = Number(menuItem.price);
      if (item.price !== undefined && Math.abs(Number(item.price) - dbPrice) > 0.01) {
        itemPriceTampered = true;
      }
      if (item.subtotal !== undefined && Math.abs(Number(item.subtotal) - (dbPrice * requestedQty)) > 0.01) {
        itemPriceTampered = true;
      }

      serverSubtotal += dbPrice * requestedQty;
      itemsMap.set(menuItem.id, menuItem);
    }

    // 5. Validasi Wilayah dan Biaya Pengiriman (Shipping Validation)
    let calculatedShippingFee = 0;
    let calculatedShippingDiscount = 0;
    let shippingDistance = null;

    if (orderData.order_type === 'delivery') {
      if (!settings.is_shipping_enabled) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Layanan pengiriman sedang dinonaktifkan.', errorCode: 'SHIPPING_DISABLED' };
      }

      const clientDistance = Number(orderData.distance_km || 0);
      const lat = Number(customerLat || 0);
      const lng = Number(customerLng || 0);

      const restoLat = Number(settings.resto_latitude || -7.7829);
      const restoLng = Number(settings.resto_longitude || 110.3323);
      const straightLineDistance = calculateHaversineDistance(restoLat, restoLng, lat, lng);

      // Verifikasi manipulasi GPS / Jarak (toleransi 90% dari jarak lurus udara)
      if (clientDistance < straightLineDistance * 0.9) {
        return { isValid: false, tamperingDetected: true, calculatedValues: {} as any, error: 'Deteksi GPS spoofing / Jarak pengiriman tidak valid.', errorCode: 'INVALID_DISTANCE' };
      }

      // Cek jarak jangkauan maksimal
      if (straightLineDistance > Number(settings.max_shipping_distance || 15)) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Alamat pengiriman di luar batas jangkauan layanan kami.', errorCode: 'OUT_OF_RANGE' };
      }

      shippingDistance = clientDistance;
      const effectiveDistance = Math.max(clientDistance, Number(settings.min_shipping_distance || 1));
      calculatedShippingFee = Math.round(effectiveDistance * Number(settings.shipping_rate_per_km || 2500));
      calculatedShippingFee += Number(settings.additional_zone_charge || 0);
    }

    // 6. Validasi Voucher/Kupon di Server (Coupon Validation)
    let serverDiscount = 0;
    if (orderData.voucher_id) {
      const { data: voucher, error: voucherErr } = await supabaseAdmin
        .from('vouchers')
        .select('*')
        .eq('id', orderData.voucher_id)
        .single();

      if (voucherErr || !voucher) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Kupon belanja tidak ditemukan.', errorCode: 'INVALID_COUPON' };
      }

      // Validasi Syarat Kupon
      if (!voucher.is_active) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Kupon belanja sedang tidak aktif.', errorCode: 'COUPON_INACTIVE' };
      }
      if (new Date(voucher.expires_at) <= new Date()) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Kupon belanja sudah kedaluwarsa.', errorCode: 'COUPON_EXPIRED' };
      }
      if (Number(voucher.used_count || 0) >= Number(voucher.usage_limit)) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Kuota penggunaan kupon telah habis.', errorCode: 'COUPON_LIMIT_REACHED' };
      }
      if (voucher.min_transaction && serverSubtotal < Number(voucher.min_transaction)) {
        return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: `Kupon memerlukan minimum transaksi sebesar Rp ${Number(voucher.min_transaction).toLocaleString('id-ID')}.`, errorCode: 'MIN_TRANSACTION_NOT_MET' };
      }

      const discountVal = voucher.discount_type === 'percent'
        ? Number(voucher.discount_percent || 0)
        : Number(voucher.discount_value || 0);

      if (voucher.voucher_type === 'shipping') {
        if (orderData.order_type !== 'delivery') {
          return { isValid: false, tamperingDetected: false, calculatedValues: {} as any, error: 'Kupon gratis ongkir hanya berlaku untuk tipe pesanan Delivery.', errorCode: 'COUPON_TYPE_MISMATCH' };
        }
        if (voucher.discount_type === 'percent') {
          calculatedShippingDiscount = Math.round(calculatedShippingFee * discountVal / 100);
        } else {
          calculatedShippingDiscount = Math.min(calculatedShippingFee, discountVal);
        }
      } else {
        if (voucher.discount_type === 'percent') {
          serverDiscount = Math.round(serverSubtotal * discountVal / 100);
        } else {
          serverDiscount = Math.min(serverSubtotal, discountVal);
        }
      }
    }

    // 7. Hitung Grand Total Akhir yang Sah di Server
    const serverTotalAmount = Math.max(0, serverSubtotal - serverDiscount + calculatedShippingFee - calculatedShippingDiscount);

    // 8. Deteksi Price Tampering Terhadap Input Client
    let totalAmountTampered = false;
    if (Math.abs(serverTotalAmount - Number(orderData.total_amount)) > 100) {
      totalAmountTampered = true;
    }

    const isTampered = itemPriceTampered || totalAmountTampered;

    if (isTampered) {
      // PROSES PERLINDUNGAN OTOMATIS & PENCEKALAN
      const nextAttemptCount = (profile.price_tampering_attempts || 0) + 1;
      let lockedUntil = null;
      let isSuspended = false;
      let actionTaken = 'warning';

      if (nextAttemptCount >= 10) {
        isSuspended = true;
        actionTaken = 'suspended_and_ip_blacklisted';
      } else if (nextAttemptCount >= 5) {
        lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Suspend 24 jam
        actionTaken = 'block_24h';
      } else if (nextAttemptCount >= 3) {
        lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Suspend 1 jam
        actionTaken = 'block_1h';
      }

      // Update Database Profil Pelanggan
      const updatePayload: any = {
        price_tampering_attempts: nextAttemptCount
      };

      if (lockedUntil) {
        updatePayload.locked_until = lockedUntil;
      }
      if (isSuspended) {
        updatePayload.is_active = false;
        updatePayload.status = 'suspended';
      }

      await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', customerId);

      // Jika disuspend, masukkan IP ke blacklist reputasi sistem secara permanen
      if (isSuspended) {
        await supabaseAdmin.from('security_ip_rules').upsert({
          ip_address: clientIp,
          rule_type: 'blacklist',
          reason: `Auto IP Ban: Percobaan manipulasi harga 10x berturut-turut pada user ${customerId}.`,
          expires_at: null
        }, { onConflict: 'ip_address' });
      }

      // Simpan Catatan Insiden Keamanan (HIGH RISK SECURITY EVENT)
      await supabaseAdmin.from('security_price_tampering_logs').insert({
        user_id: customerId,
        ip_address: clientIp,
        user_agent: userAgent,
        original_price_database: serverTotalAmount,
        manipulated_price: Number(orderData.total_amount),
        endpoint: endpoint,
        payload: {
          itemsData,
          orderData,
          attempt_count: nextAttemptCount,
          action_taken: actionTaken
        }
      });

      // Simpan ke Security Logs Global
      await supabaseAdmin.from('security_logs').insert({
        user_id: customerId,
        ip_address: clientIp,
        user_agent: userAgent,
        activity: 'PRICE_TAMPERING_ATTEMPT',
        endpoint: endpoint,
        status: 'blocked'
      });

      // Kirim Notifikasi Darurat Keamanan ke Admin via Channel Alert Realtime
      await supabaseAdmin.from('notifications').insert({
        title: '⚠️ MANIPULASI HARGA TERDETEKSI',
        message: `Terjadi upaya manipulasi harga oleh Pelanggan ID ${customerId.substring(0,8)} dari IP ${clientIp}. Jumlah percobaan: ${nextAttemptCount}. Tindakan: ${actionTaken.toUpperCase()}.`,
        type: 'security_alert',
        is_read: false
      });

      return {
        isValid: false,
        tamperingDetected: true,
        calculatedValues: {} as any,
        error: `Transaksi ditolak demi keamanan. Manipulasi harga terdeteksi dan dicatat di audit log (Percobaan ke-${nextAttemptCount}).`,
        errorCode: 'PRICE_TAMPERING_DETECTED'
      };
    }

    // Jika valid, kembalikan nilai perhitungan resmi server
    return {
      isValid: true,
      tamperingDetected: false,
      calculatedValues: {
        subtotal: serverSubtotal,
        discount: serverDiscount,
        shippingFee: calculatedShippingFee,
        shippingDiscount: calculatedShippingDiscount,
        totalAmount: serverTotalAmount,
        menuItems
      }
    };

  } catch (err: any) {
    console.error('Price validation exception:', err);
    return {
      isValid: false,
      tamperingDetected: false,
      calculatedValues: {} as any,
      error: 'Terjadi kesalahan validasi harga di server. Silakan coba lagi.',
      errorCode: 'INTERNAL_SERVER_ERROR'
    };
  }
}
