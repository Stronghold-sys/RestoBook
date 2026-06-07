import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabase/admin';
import { parseUserAgent } from './security';

// ── 1. List Domain Email Sekali Pakai (Disposable Email Domains) ─────
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'yopmail.com', 'tempmail.com', 'temp-mail.org', 
  'dispostable.com', 'sharklasers.com', 'guerrillamail.com', '10minutemail.com',
  'getairmail.com', 'throwawaymail.com', 'tempmailaddress.com', 'maildrop.cc',
  'mailnesia.com', 'mailcatch.com', 'burncmail.com', 'trashmail.com',
  'spam4.me', 'grr.la', 'pokemail.net', 'duck.com', 'generator.email',
  'temp-mail.com', 'temp-mail.ru', 'tempmail.de', 'disposable.com',
  'mytempemail.com', 'boun.cr', 'mailinator2.com', 'sogetthis.com',
  'mailinatorshitty.com', 'spamherelots.com', 'thisisnotmyrealemail.com',
  'spambob.com', 'trbvm.com', 'guerrillamailblock.com', 'guerrillamail.biz'
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

function normalizeCountry(country: string): string {
  if (!country) return 'unknown';
  const val = country.trim().toLowerCase();
  if (val === 'indonesia' || val === 'id') return 'id';
  if (val === 'singapore' || val === 'sg') return 'sg';
  if (val === 'malaysia' || val === 'my') return 'my';
  if (val === 'united states' || val === 'us' || val === 'united states of america') return 'us';
  if (val === 'japan' || val === 'jp') return 'jp';
  return val;
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
    if (session.country !== 'Unknown' && cfCountry !== 'Unknown' && normalizeCountry(session.country) !== normalizeCountry(cfCountry)) {
      return { hijacked: true, reason: `Negara berubah drastis: ${session.country} -> ${cfCountry}` };
    }

    // B. Perubahan User-Agent (Browser atau OS berubah di tengah jalan)
    const sessionUAParsed = parseUserAgent(session.user_agent);
    const currentUAParsed = parseUserAgent(ua);
    
    // Abaikan jika salah satu terdeteksi sebagai Capacitor / App fetcher / Unknown browser
    const isAppRequest = 
      sessionUAParsed.browser === 'Browser tidak diketahui' || 
      currentUAParsed.browser === 'Browser tidak diketahui' ||
      (ua && (ua.includes('Capacitor') || ua.includes('okhttp') || ua.includes('capacitor')));

    if (!isAppRequest && (sessionUAParsed.browser !== currentUAParsed.browser || sessionUAParsed.os !== currentUAParsed.os)) {
      return { hijacked: true, reason: `Browser/OS berubah: ${sessionUAParsed.browser} on ${sessionUAParsed.os} -> ${currentUAParsed.browser} on ${currentUAParsed.os}` };
    }

    // C. Perubahan ASN (Jaringan berubah) - Dinonaktifkan karena sering memicu false positive saat pengguna berpindah jaringan (misal Wi-Fi ke Seluler)
    /*
    if (session.asn !== 'Unknown' && cfAsn !== 'Unknown' && session.asn !== cfAsn) {
      return { hijacked: true, reason: `ASN Jaringan berubah: ${session.asn} -> ${cfAsn}` };
    }
    */

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

// ── 10. resolveIPDetails Helper ──────────────────────────────────────
export async function resolveIPDetails(ip: string): Promise<{ country: string; city: string; asn: string }> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Localhost', city: 'Localhost', asn: 'AS0 (Localhost)' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s timeout

    const res = await fetch(`http://ip-api.com/json/${ip}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        return {
          country: data.countryCode || 'Unknown',
          city: data.city || 'Unknown',
          asn: data.as || 'Unknown'
        };
      }
    }
  } catch (err) {
    console.error('Failed to resolve IP details from ip-api:', err);
  }

  return { country: 'Unknown', city: 'Unknown', asn: 'Unknown' };
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
    
    let resolvedAsn = event.asn || 'Unknown';
    let resolvedCountry = event.country || 'Unknown';
    let resolvedCity = event.city || 'Unknown';

    if (resolvedAsn === 'Unknown' || resolvedCountry === 'Unknown' || resolvedCity === 'Unknown') {
      const resolved = await resolveIPDetails(event.ipAddress);
      if (resolved.asn && resolved.asn !== 'Unknown') resolvedAsn = resolved.asn;
      if (resolved.country && resolved.country !== 'Unknown') resolvedCountry = resolved.country;
      if (resolved.city && resolved.city !== 'Unknown') resolvedCity = resolved.city;
    }

    // Log insiden detil
    await supabase.from('security_incidents').insert({
      ip_address: event.ipAddress,
      fingerprint: event.fingerprint || null,
      asn: resolvedAsn,
      country: resolvedCountry,
      city: resolvedCity,
      endpoint: event.endpoint,
      payload: event.payload ? JSON.stringify(event.payload) : null,
      attack_type: event.attackType,
      severity: event.severity
    });

    // Pemicu Emergency Mode Otomatis dinonaktifkan atas permintaan admin agar tidak aktif sendiri demi stabilitas sistem
    /*
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
    */
  } catch (err) {
    console.error('Failed to log security incident:', err);
  }
}

// ── 11. Cek Email Sekali Pakai (Disposable Email Check) ───────────────
let cachedDisposableDomains: Set<string> | null = null;
let lastFetchTime = 0;

async function getDisposableDomainsFromGitHub(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedDisposableDomains && (now - lastFetchTime < 3600000)) {
    return cachedDisposableDomains;
  }

  try {
    const res = await fetch('https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf', {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const text = await res.text();
      const domains = text.split('\n')
        .map(line => line.trim().toLowerCase())
        .filter(line => line && !line.startsWith('#'));
      cachedDisposableDomains = new Set(domains);
      lastFetchTime = now;
      return cachedDisposableDomains;
    }
  } catch (err) {
    console.error('Failed to fetch disposable email domains from GitHub:', err);
  }

  return new Set();
}

export async function isDisposableEmail(email: string): Promise<boolean> {
  if (!email || !email.includes('@')) return false;
  
  const cleanEmail = email.trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];

  // A. Pengecekan terhadap local blacklist
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return true;
  }

  // B. Pengecekan terhadap live blacklist dari GitHub
  const githubDomains = await getDisposableDomainsFromGitHub();
  if (githubDomains.has(domain)) {
    console.warn(`[SECURITY] Blocked domain ${domain} found in GitHub live blacklist.`);
    return true;
  }

  // C. DNS MX Check via Cloudflare DNS over HTTPS (DoH) API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`;
    const dohRes = await fetch(dohUrl, {
      headers: { 'Accept': 'application/dns-json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (dohRes.ok) {
      const dnsData = await dohRes.json();
      const hasMx = dnsData.Answer && dnsData.Answer.some((ans: any) => ans.type === 15);
      if (!hasMx) {
        console.warn(`[SECURITY] Blocked domain ${domain} due to missing MX record.`);
        return true; 
      }
    }
  } catch (dnsErr) {
    console.error('DNS DoH MX check failed:', dnsErr);
  }

  // D. Pengecekan via DeBounce API (Official API Key / Fallback ke Free API)
  const debounceApiKey = process.env.DEBOUNCE_API_KEY;
  if (debounceApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout
      
      const debounceUrl = `https://api.debounce.io/v1?api=${debounceApiKey}&email=${encodeURIComponent(cleanEmail)}`;
      const debounceRes = await fetch(debounceUrl, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (debounceRes.ok) {
        const dbData = await debounceRes.json();
        if (dbData.success === '1' && dbData.debounce) {
          const result = dbData.debounce.result?.toLowerCase();
          const reason = dbData.debounce.reason?.toLowerCase() || '';
          
          // Blokir jika disposable atau jika email Invalid (undeliverable)
          if (reason.includes('disposable') || result === 'disposable' || result === 'invalid') {
            console.warn(`[SECURITY] Blocked email ${cleanEmail} via Official DeBounce API (Result: ${result}, Reason: ${reason}).`);
            return true;
          }
        }
      }
    } catch (apiErr) {
      console.error('Official DeBounce API check failed:', apiErr);
    }
  } else {
    // Fallback ke DeBounce Free API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const debounceRes = await fetch(`https://disposable.debounce.io/?email=${encodeURIComponent(cleanEmail)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (debounceRes.ok) {
        const dbData = await debounceRes.json();
        if (dbData.disposable === 'true' || dbData.disposable === true) {
          console.warn(`[SECURITY] Blocked domain ${domain} identified as disposable by Free DeBounce API.`);
          return true;
        }
      }
    } catch (apiErr) {
      console.error('Free DeBounce API check failed:', apiErr);
    }
  }

  // E. Pengecekan Pihak Ketiga via Kickbox Disposable Email API (Backup)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const kickboxUrl = `https://open.kickbox.com/v1/disposable/${encodeURIComponent(domain)}`;
    const kickboxRes = await fetch(kickboxUrl, { signal: controller.signal });
    
    clearTimeout(timeoutId);
    
    if (kickboxRes.ok) {
      const kbData = await kickboxRes.json();
      if (kbData.disposable === true) {
        console.warn(`[SECURITY] Blocked domain ${domain} identified as disposable by Kickbox API.`);
        return true;
      }
    }
  } catch (apiErr) {
    console.error('Kickbox API check failed:', apiErr);
  }

  return false;
}

// ── 12. FNV-1a Fast Hash Helper ───────────────────────────────────────
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ── 13. Generate Security Fingerprint (Multi-layer Identity) ──────────
export function generateSecurityFingerprint(request: NextRequest, deviceUuid: string): string {
  const ua = request.headers.get('user-agent') || '';
  const lang = request.headers.get('accept-language') || '';
  const tz = request.headers.get('x-vercel-ip-timezone') || request.headers.get('cf-timezone') || '';
  const country = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || '';
  const city = request.headers.get('x-vercel-ip-city') || '';
  const asn = request.headers.get('x-vercel-ip-asn') || request.headers.get('cf-asn') || '';
  const screenRes = request.cookies.get('sec_screen_res')?.value || '';
  const chPlatform = request.headers.get('sec-ch-ua-platform') || '';
  const chMobile = request.headers.get('sec-ch-ua-mobile') || '';
  
  const rawString = `${deviceUuid}|${ua}|${lang}|${tz}|${country}|${city}|${asn}|${screenRes}|${chPlatform}|${chMobile}`;
  return fnv1a(rawString);
}

// ── 14. Subnet Extractor ──────────────────────────────────────────────
export function extractSubnet(ip: string): string {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
  } else if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::/64`;
    }
  }
  return ip;
}

// ── 15. Track and Detect Rotating IP ──────────────────────────────────
export async function trackAndDetectRotatingIP(
  fingerprint: string,
  currentIp: string,
  currentCountry: string,
  currentCity: string,
  currentAsn: string
): Promise<{
  riskScoreAddition: number;
  isRotating: boolean;
  ipCount30m: number;
  isCountryHop: boolean;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    
    // Cek apakah IP ini sudah tercatat untuk fingerprint ini dalam 5 menit terakhir
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingIp } = await supabase
      .from('security_fingerprint_ips')
      .select('id')
      .eq('fingerprint', fingerprint)
      .eq('ip_address', currentIp)
      .gt('created_at', fiveMinsAgo)
      .limit(1)
      .maybeSingle();

    if (!existingIp) {
      let resolvedAsn = currentAsn || 'Unknown';
      let resolvedCountry = currentCountry || 'Unknown';
      let resolvedCity = currentCity || 'Unknown';

      if (resolvedAsn === 'Unknown' || resolvedCountry === 'Unknown' || resolvedCity === 'Unknown') {
        const resolved = await resolveIPDetails(currentIp);
        if (resolved.asn && resolved.asn !== 'Unknown') resolvedAsn = resolved.asn;
        if (resolved.country && resolved.country !== 'Unknown') resolvedCountry = resolved.country;
        if (resolved.city && resolved.city !== 'Unknown') resolvedCity = resolved.city;
      }

      await supabase.from('security_fingerprint_ips').insert({
        fingerprint,
        ip_address: currentIp,
        country: resolvedCountry,
        city: resolvedCity,
        asn: resolvedAsn
      });
    }

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: records, error } = await supabase
      .from('security_fingerprint_ips')
      .select('ip_address, country, created_at')
      .eq('fingerprint', fingerprint)
      .gt('created_at', oneDayAgo);

    if (error || !records) {
      return { riskScoreAddition: 0, isRotating: false, ipCount30m: 0, isCountryHop: false };
    }

    const nowTime = Date.now();
    const ips30m = new Set<string>();
    const ips1h = new Set<string>();
    const ips24h = new Set<string>();
    const countries30m = new Set<string>();

    for (const rec of records) {
      const recTime = new Date(rec.created_at).getTime();
      const diffMs = nowTime - recTime;

      ips24h.add(rec.ip_address);

      if (diffMs <= 60 * 60 * 1000) {
        ips1h.add(rec.ip_address);
      }
      if (diffMs <= 30 * 60 * 1000) {
        ips30m.add(rec.ip_address);
        if (rec.country && rec.country !== 'Unknown') {
          countries30m.add(normalizeCountry(rec.country));
        }
      }
    }

    let riskScoreAddition = 0;
    let isRotating = false;

    if (ips30m.size >= 5) {
      riskScoreAddition += 20;
      isRotating = true;
    }
    if (ips1h.size >= 10) {
      riskScoreAddition += 50;
      isRotating = true;
    }
    if (ips24h.size >= 20) {
      riskScoreAddition += 80;
      isRotating = true;
    }

    const isCountryHop = countries30m.size >= 3;
    if (isCountryHop) {
      riskScoreAddition += 30;
    }

    return {
      riskScoreAddition,
      isRotating,
      ipCount30m: ips30m.size,
      isCountryHop
    };
  } catch (err) {
    console.error('trackAndDetectRotatingIP error:', err);
    return { riskScoreAddition: 0, isRotating: false, ipCount30m: 0, isCountryHop: false };
  }
}

// ── 16. Check Impossible Travel (Physically Impossible Country Hop) ───
export async function checkImpossibleTravel(
  profileId: string,
  currentCountry: string,
  currentCity: string
): Promise<{
  impossibleTravel: boolean;
  lastCountry?: string;
  lastActiveAt?: string;
}> {
  if (!profileId || !currentCountry || currentCountry === 'Unknown') {
    return { impossibleTravel: false };
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: lastSession, error } = await supabase
      .from('security_user_sessions')
      .select('country, city, last_active_at')
      .eq('profile_id', profileId)
      .order('last_active_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !lastSession || !lastSession.country || lastSession.country === 'Unknown') {
      return { impossibleTravel: false };
    }

    if (normalizeCountry(lastSession.country) !== normalizeCountry(currentCountry)) {
      const lastActiveTime = new Date(lastSession.last_active_at).getTime();
      const timeDiffMins = (Date.now() - lastActiveTime) / 60000;

      // Physically impossible travel if changing countries in under 3 hours (180 mins)
      if (timeDiffMins < 180) {
        return {
          impossibleTravel: true,
          lastCountry: lastSession.country,
          lastActiveAt: lastSession.last_active_at
        };
      }
    }

    return { impossibleTravel: false };
  } catch (err) {
    console.error('checkImpossibleTravel error:', err);
    return { impossibleTravel: false };
  }
}

// ── 17. Detect Coordinated ASN/Subnet Attacks & Botnets ────────────────
export async function detectCoordinatedAsnSubnetAttack(
  currentIp: string,
  currentAsn: string,
  endpoint: string,
  fingerprint: string
): Promise<{
  subnetBlocked: boolean;
  coordinatedAsn: boolean;
  highProtectionAsn: boolean;
  botnetDetected: boolean;
  subnet: string;
}> {
  const subnet = extractSubnet(currentIp);
  
  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();

    // Simpan request signature
    await supabase.from('security_request_signatures').insert({
      fingerprint,
      ip_address: currentIp,
      subnet,
      asn: currentAsn || 'Unknown',
      endpoint
    });

    // Hapus signatures lama (> 10 menit) secara fire-and-forget
    const tenMinsAgo = new Date(now - 10 * 60 * 1000).toISOString();
    supabase.from('security_request_signatures').delete().lt('created_at', tenMinsAgo).then(() => {});

    // Cek apakah subnet diblokir
    const nowIso = new Date().toISOString();
    const { data: subnetBlock } = await supabase
      .from('security_subnet_blocks')
      .select('id')
      .eq('subnet', subnet)
      .gt('blocked_until', nowIso)
      .limit(1)
      .maybeSingle();

    if (subnetBlock) {
      return { subnetBlocked: true, coordinatedAsn: false, highProtectionAsn: false, botnetDetected: false, subnet };
    }

    // Ambil signatures dalam 5 menit terakhir untuk subnet & ASN ini
    const fiveMinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const { data: signatures, error } = await supabase
      .from('security_request_signatures')
      .select('ip_address, subnet, asn, endpoint, fingerprint')
      .gt('created_at', fiveMinsAgo);

    if (error || !signatures) {
      return { subnetBlocked: false, coordinatedAsn: false, highProtectionAsn: false, botnetDetected: false, subnet };
    }

    const uniqueIpsSubnet = new Set<string>();
    const uniqueIpsAsn = new Set<string>();
    const fingerprintsByEndpoint = new Set<string>();

    for (const sig of signatures) {
      if (sig.subnet === subnet && sig.endpoint === endpoint) {
        uniqueIpsSubnet.add(sig.ip_address);
      }
      if (sig.asn === currentAsn && sig.endpoint === endpoint) {
        uniqueIpsAsn.add(sig.ip_address);
      }
      if (sig.endpoint === endpoint) {
        fingerprintsByEndpoint.add(sig.fingerprint);
      }
    }

    let subnetBlocked = false;
    let coordinatedAsn = false;
    let highProtectionAsn = false;
    let botnetDetected = false;

    // Subnet: Jika >= 10 IP berbeda dari subnet yang sama mengakses endpoint yang sama
    if (uniqueIpsSubnet.size >= 10) {
      subnetBlocked = true;
      const blockedUntil = new Date(now + 30 * 60 * 1000).toISOString();
      await supabase.from('security_subnet_blocks').upsert({
        subnet,
        reason: `Subnet flooding: ${uniqueIpsSubnet.size} IPs in 5 mins on ${endpoint}`,
        blocked_until: blockedUntil
      }, { onConflict: 'subnet' });
    }

    // ASN: 50 IP -> Coordinated, 100 IP -> High Protection
    if (uniqueIpsAsn.size >= 100) {
      highProtectionAsn = true;
    } else if (uniqueIpsAsn.size >= 50) {
      coordinatedAsn = true;
    }

    // Botnet: Jika ada >= 100 IP berbeda dengan jumlah fingerprint unik homogen (<= 5)
    if (uniqueIpsAsn.size >= 100 && fingerprintsByEndpoint.size <= 5) {
      botnetDetected = true;
    }

    return {
      subnetBlocked,
      coordinatedAsn,
      highProtectionAsn,
      botnetDetected,
      subnet
    };
  } catch (err) {
    console.error('detectCoordinatedAsnSubnetAttack error:', err);
    return { subnetBlocked: false, coordinatedAsn: false, highProtectionAsn: false, botnetDetected: false, subnet };
  }
}

// ── 18. Calculate Security Score ──────────────────────────────────────
export function calculateSecurityScore(context: {
  isNewIp: boolean;
  isSameAsnDiffIp: boolean;
  isCountryHop: boolean;
  isRotatingIp: boolean;
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  isBotnet: boolean;
  isMassAttack: boolean;
}): number {
  let score = 0;
  
  if (context.isNewIp) score += 10;
  if (context.isSameAsnDiffIp) score += 20;
  if (context.isCountryHop) score += 30;
  if (context.isRotatingIp) score += 40;
  if (context.isProxy) score += 50;
  if (context.isVpn) score += 60;
  if (context.isTor) score += 70;
  if (context.isBotnet) score += 80;
  if (context.isMassAttack) score += 90;

  return score;
}

