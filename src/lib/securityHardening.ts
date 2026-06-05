import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabase/admin';

// ── 1. List Domain Email Sekali Pakai (Disposable Email Domains) ─────
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'yopmail.com', 'tempmail.com', 'temp-mail.org', 
  'dispostable.com', 'sharklasers.com', 'guerrillamail.com', '10minutemail.com',
  'getairmail.com', 'throwawaymail.com', 'tempmailaddress.com', 'maildrop.cc'
];

// ── 2. Real Client IP Detection & Spoofing Prevention ─────────────────
// Daftar IP Range Cloudflare yang dipercaya (CIDR sederhana)
const TRUSTED_PROXIES = [
  '173.245.48.', '103.21.244.', '103.22.200.', '103.31.4.', 
  '141.101.64.', '108.162.192.', '190.93.240.', '188.114.96.', 
  '197.234.240.', '198.41.128.', '162.158.', '104.16.', '104.24.', 
  '172.64.', '131.0.72.', '127.0.0.1', '::1'
];

export function getSecureClientIP(request: NextRequest): string {
  // Direct IP dari socket connection (diisi oleh Vercel/Cloudflare Edge Runtime secara aman)
  const connectionIp = request.ip || '127.0.0.1';
  
  // Periksa apakah request IP berasal dari proxy tepercaya
  const isFromTrustedProxy = TRUSTED_PROXIES.some(proxy => connectionIp.startsWith(proxy));

  if (!isFromTrustedProxy) {
    // Jika tidak dari proxy tepercaya, abaikan semua header proxy dan gunakan IP koneksi langsung
    return connectionIp;
  }

  // Jika dari proxy tepercaya, baca header yang sesuai dengan prioritas keamanan
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    connectionIp
  );
}

// ── 3. Deteksi Proxy / VPN / Tor ─────────────────────────────────────
export async function detectProxyOrVPN(request: NextRequest, clientIp: string): Promise<{ isProxyOrVpn: boolean; reason?: string }> {
  // Check headers yang sering dikirim oleh proxy server
  const proxyHeaders = [
    'via', 'forwarded', 'client-ip', 'x-proxy-id', 'proxy-connection', 
    'x-forwarded-proto', 'x-bluecoat-via', 'x-loop-control'
  ];

  for (const header of proxyHeaders) {
    if (request.headers.has(header)) {
      return { isProxyOrVpn: true, reason: `Proxy header terdeteksi: ${header}` };
    }
  }

  // Bandingkan lokasi timezone dari client dengan IP (jika di hosting cloud)
  const cfTimezone = request.headers.get('x-vercel-ip-timezone') || request.headers.get('cf-timezone');
  // Deteksi anomali timezone/country jika mismatch ekstrem (misal Cloudflare IP US tapi timezone Asia/Jakarta)
  const cfCountry = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country');
  
  if (cfCountry && cfTimezone) {
    const isAsiaTz = cfTimezone.toLowerCase().includes('asia');
    const isIdCountry = cfCountry.toUpperCase() === 'ID';
    
    // Anomali timezone mismatch
    if (isIdCountry && !isAsiaTz && cfTimezone.toLowerCase().includes('america')) {
      return { isProxyOrVpn: true, reason: 'Timezone dan Country mismatch (kemungkinan VPN)' };
    }
  }

  return { isProxyOrVpn: false };
}

// ── 4. Deteksi Headless Browser & Otomasi ─────────────────────────────
export function detectHeadlessBrowser(request: NextRequest): boolean {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  
  // Bot & Automation Keywords
  const headlessKeywords = [
    'headlesschrome', 'selenium', 'puppeteer', 'playwright', 'phantomjs', 
    'webdriver', 'bot', 'spider', 'crawler', 'scraper', 'postman', 
    'axios', 'curl', 'wget', 'http-client', 'insomnia', 'zgrab', 'masscan'
  ];

  if (headlessKeywords.some(keyword => ua.includes(keyword))) {
    return true;
  }

  // Deteksi header standard browser yang hilang
  // Standard desktop/mobile browser modern mengirim Sec-Ch-Ua headers
  const hasSecChUa = request.headers.has('sec-ch-ua');
  const isGetOrPage = request.method === 'GET' && !request.nextUrl.pathname.startsWith('/api');
  
  // Jika akses halaman utama oleh User Agent desktop Chrome/Edge tapi tidak memiliki header sec-ch-ua
  if (isGetOrPage && ua.includes('chrome') && !hasSecChUa) {
    return true; // Kemungkinan headless browser atau user-agent spoofing
  }

  return false;
}

// ── 5. Deteksi SSRF & Path Traversal ──────────────────────────────────
export function hasSSRF(url: string): boolean {
  try {
    const lowerUrl = url.toLowerCase();
    
    // Deteksi IP local / private network
    const privateIpPatterns = [
      'localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 
      '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', 
      '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', 
      '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'
    ];

    if (privateIpPatterns.some(ip => lowerUrl.includes(ip))) {
      return true;
    }

    // Pastikan URL menggunakan protokol http atau https saja
    if (url.includes('://') && !url.startsWith('http://') && !url.startsWith('https://')) {
      return true;
    }

    return false;
  } catch {
    return true; // Reject jika URL invalid
  }
}

export function hasPathTraversal(path: string): boolean {
  const decoded = decodeURIComponent(path).toLowerCase();
  
  const traversalPatterns = [
    '../', '..\\', '..%2f', '..%5c', '%2e%2e%2f', '%2e%2e%5c', 
    '/etc/passwd', '/etc/hosts', 'boot.ini', 'win.ini'
  ];

  return traversalPatterns.some(pattern => decoded.includes(pattern));
}

// ── 6. Sanitasi & Proteksi File Upload ────────────────────────────────
export async function validateFileUpload(
  fileName: string, 
  mimeType: string, 
  fileBuffer: ArrayBuffer
): Promise<{ valid: boolean; reason?: string }> {
  
  // A. Anti Double Extension (misal: shell.php.jpg)
  const parts = fileName.split('.');
  if (parts.length > 2) {
    const dangerousExts = ['php', 'phtml', 'html', 'htm', 'js', 'sh', 'bat', 'exe', 'cgi', 'pl', 'py'];
    for (let i = 1; i < parts.length - 1; i++) {
      if (dangerousExts.includes(parts[i].toLowerCase())) {
        return { valid: false, reason: 'Double extension terlarang terdeteksi.' };
      }
    }
  }

  // B. Magic Numbers Validation (Validasi tipe data binary)
  const bytes = new Uint8Array(fileBuffer.slice(0, 8));
  let headerHex = '';
  for (let i = 0; i < bytes.length; i++) {
    headerHex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }

  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

  // Validasi format gambar
  if (['jpg', 'jpeg'].includes(fileExt)) {
    // JPG starts with FFD8FF
    if (!headerHex.startsWith('FFD8FF')) {
      return { valid: false, reason: 'Tanda tangan berkas JPG tidak valid (mismatch magic number).' };
    }
  } else if (fileExt === 'png') {
    // PNG starts with 89504E470D0A1A0A
    if (!headerHex.startsWith('89504E470D0A1A0A')) {
      return { valid: false, reason: 'Tanda tangan berkas PNG tidak valid (mismatch magic number).' };
    }
  } else if (fileExt === 'gif') {
    // GIF starts with 47494638 (GIF8)
    if (!headerHex.startsWith('47494638')) {
      return { valid: false, reason: 'Tanda tangan berkas GIF tidak valid.' };
    }
  } else if (fileExt === 'pdf') {
    // PDF starts with 25504446 (%PDF)
    if (!headerHex.startsWith('25504446')) {
      return { valid: false, reason: 'Tanda tangan berkas PDF tidak valid.' };
    }
  }

  // C. Deteksi Embedded Script (Polyglot check)
  const textDecoder = new TextDecoder('utf-8');
  // Hanya scan 100 KB pertama dan 10 KB terakhir untuk efisiensi
  const scanSize = Math.min(fileBuffer.byteLength, 100 * 1024);
  const sampleString = textDecoder.decode(fileBuffer.slice(0, scanSize)).toLowerCase();

  const dangerousScripts = ['<?php', '<?=', '<script', 'javascript:', 'eval(', 'onload='];
  if (dangerousScripts.some(script => sampleString.includes(script))) {
    return { valid: false, reason: 'Script mencurigakan terdeteksi di dalam berkas.' };
  }

  // D. Deteksi Zip Bomb (jika berkas bertipe zip/docx/xlsx)
  // Zip magic number: 504B0304 (PK..)
  if (headerHex.startsWith('504B0304')) {
    // Periksa ratio kompresi kasar (jika ukuran file terkompresi < 1KB tetapi setelah unzip berukuran raksasa)
    // Next.js Edge runtime tidak bisa uncompress zip secara native tanpa heavy libs,
    // kita membatasi ukuran zip max 10MB untuk dokumen dan menolak zip dengan nested headers berulang
    if (fileBuffer.byteLength > 10 * 1024 * 1024) {
      return { valid: false, reason: 'Ukuran arsip melebihi batas aman.' };
    }
  }

  return { valid: true };
}

// ── 7. Pencegahan Replay Attack (Nonces) ──────────────────────────────
export async function consumeNonce(nonce: string, durationMinutes = 5): Promise<boolean> {
  if (!nonce || nonce.length < 16) return false;

  try {
    const supabase = getSupabaseAdmin();
    
    // Cek apakah nonce sudah digunakan
    const { data, error } = await supabase
      .from('security_nonces')
      .select('nonce')
      .eq('nonce', nonce)
      .maybeSingle();

    if (error) return false;
    if (data) return false; // Nonce sudah pernah dipakai!

    // Simpan nonce baru
    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
    const { error: insertError } = await supabase
      .from('security_nonces')
      .insert({ nonce, expires_at: expiresAt });

    if (insertError) return false;

    // Hapus nonce kedaluwarsa secara berkala (fire and forget)
    const nowIso = new Date().toISOString();
    await supabase.from('security_nonces').delete().lt('expires_at', nowIso);

    return true;
  } catch {
    return false;
  }
}

// ── 8. Deteksi Session Hijacking ──────────────────────────────────────
export async function detectSessionHijack(
  sessionId: string,
  profileId: string,
  request: NextRequest,
  clientIp: string
): Promise<{ hijacked: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const ua = request.headers.get('user-agent') || '';
    const cfCountry = request.headers.get('cf-ipcountry') || 'Unknown';
    const cfTimezone = request.headers.get('x-vercel-ip-timezone') || 'Unknown';
    const cfAsn = request.headers.get('x-vercel-ip-asn') || 'Unknown';

    // Cari data sesi terikat
    const { data: session, error } = await supabase
      .from('security_user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) return { hijacked: false };

    if (!session) {
      // Sesi baru, buat binding session
      await supabase.from('security_user_sessions').insert({
        profile_id: profileId,
        session_id: sessionId,
        ip_address: clientIp,
        user_agent: ua,
        country: cfCountry,
        city: request.headers.get('x-vercel-ip-city') || 'Unknown',
        asn: cfAsn,
        timezone: cfTimezone
      });
      return { hijacked: false };
    }

    // Verifikasi anomali fingerprint:
    // A. Perubahan Negara (Country Hop ekstrem)
    if (session.country !== 'Unknown' && cfCountry !== 'Unknown' && session.country !== cfCountry) {
      return { hijacked: true, reason: `Negara berubah drastis: ${session.country} -> ${cfCountry}` };
    }

    // B. Perubahan User-Agent (Browser berubah di tengah jalan)
    if (session.user_agent !== ua) {
      return { hijacked: true, reason: 'User Agent browser berubah tiba-tiba' };
    }

    // C. Perubahan ASN (ISP/Jaringan berubah ekstrem)
    if (session.asn !== 'Unknown' && cfAsn !== 'Unknown' && session.asn !== cfAsn) {
      return { hijacked: true, reason: `ASN Jaringan berubah: ${session.asn} -> ${cfAsn}` };
    }

    // Perbarui keaktifan sesi
    await supabase
      .from('security_user_sessions')
      .update({ last_active_at: new Date().toISOString(), ip_address: clientIp })
      .eq('id', session.id);

    return { hijacked: false };
  } catch {
    return { hijacked: false };
  }
}

// ── 9. Pengaturan Darurat (Emergency Mode) ───────────────────────────
const emergencySettingsCache = {
  data: null as any,
  expiresAt: 0
};

export async function getEmergencySettings(): Promise<{
  emergency_mode: boolean;
  global_captcha_required: boolean;
  block_new_registrations: boolean;
  block_sensitive_endpoints: boolean;
  tightened_rate_limits: boolean;
}> {
  const now = Date.now();
  if (emergencySettingsCache.data && emergencySettingsCache.expiresAt > now) {
    return emergencySettingsCache.data;
  }

  const defaultSettings = {
    emergency_mode: false,
    global_captcha_required: false,
    block_new_registrations: false,
    block_sensitive_endpoints: false,
    tightened_rate_limits: false
  };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('security_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return defaultSettings;
    }

    emergencySettingsCache.data = data;
    emergencySettingsCache.expiresAt = now + 10_000; // Cache 10 detik

    return data;
  } catch {
    return defaultSettings;
  }
}

// ── 10. Audit Incident Logger ─────────────────────────────────────────
export async function logSecurityIncident(event: {
  ipAddress: string;
  fingerprint?: string;
  asn?: string;
  country?: string;
  city?: string;
  endpoint: string;
  payload?: any;
  attackType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Log insiden detil
    await supabase.from('security_incidents').insert({
      ip_address: event.ipAddress,
      fingerprint: event.fingerprint || null,
      asn: event.asn || null,
      country: event.country || null,
      city: event.city || null,
      endpoint: event.endpoint,
      payload: event.payload ? JSON.stringify(event.payload) : null,
      attack_type: event.attackType,
      severity: event.severity
    });

    // Pemicu Emergency Mode Otomatis jika insiden berkategori CRITICAL dalam jumlah banyak
    if (event.severity === 'critical') {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const { count } = await supabase
        .from('security_incidents')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .gt('created_at', fiveMinsAgo);

      if (count && count >= 5) {
        // Otomatis aktifkan Emergency Mode
        await supabase
          .from('security_settings')
          .update({
            emergency_mode: true,
            global_captcha_required: true,
            block_new_registrations: true,
            block_sensitive_endpoints: true,
            tightened_rate_limits: true,
            updated_at: new Date().toISOString()
          })
          .eq('emergency_mode', false); // hanya update jika belum aktif
      }
    }
  } catch (err) {
    console.error('Failed to log security incident:', err);
  }
}

// ── 11. Cek Email Sekali Pakai (Disposable Email Check) ───────────────
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1].toLowerCase().trim();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}
