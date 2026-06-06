import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'
import { getSupabaseAdmin } from './lib/supabase/admin'
import { parseUserAgent, generateCSRFToken } from './lib/security'
import { 
  getSecureClientIP, 
  detectProxyOrVPN, 
  detectHeadlessBrowser, 
  detectSessionHijack, 
  getEmergencySettings, 
  logSecurityIncident,
  hasPathTraversal,
  generateSecurityFingerprint,
  trackAndDetectRotatingIP,
  checkImpossibleTravel,
  detectCoordinatedAsnSubnetAttack,
  calculateSecurityScore,
  extractSubnet
} from './lib/securityHardening'

// ── In-Memory Caches & Trackers ─────────────────────────────────────
const ipBlacklistCache = new Map<string, { blocked: boolean; expiresAt: number; reason?: string }>();
const roleCache = new Map<string, { role: string; expiresAt: number }>();
const blockRulesCache = new Map<string, { blocked: boolean; expiresAt: number; reason?: string }>();
const requestTracker = new Map<string, number[]>(); // DDoS tracking: ip -> timestamps
const generalRateLimiter = new Map<string, { count: number; resetAt: number }>();

// Jeda Waktu Cache
const CACHE_TTL_MS = 30_000; // 30 Detik cache untuk IP Blacklist & Role

// ── Helper: Ambil IP Klien ──────────────────────────────────────────
function getClientIP(request: NextRequest): string {
  return getSecureClientIP(request);
}

// ── Helper: Cek IP Blacklist dengan Cache ──────────────────────────
async function checkIPBlacklist(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  const now = Date.now();
  const cached = ipBlacklistCache.get(ip);
  
  if (cached && cached.expiresAt > now) {
    return { blocked: cached.blocked, reason: cached.reason };
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('security_ip_rules')
      .select('reason, expires_at')
      .eq('ip_address', ip)
      .eq('rule_type', 'blacklist')
      .or(`expires_at.gt.${nowIso},expires_at.is.null`)
      .maybeSingle();

    if (error) {
      // Jika error DB, fallback tidak blokir agar website tetap jalan
      return { blocked: false };
    }

    const blocked = !!data;
    const reason = data?.reason || undefined;

    ipBlacklistCache.set(ip, {
      blocked,
      reason,
      expiresAt: now + CACHE_TTL_MS
    });

    return { blocked, reason };
  } catch {
    return { blocked: false };
  }
}

// ── Helper: Cek Block Rules (Fingerprint / Browser) dengan Cache ────
async function checkBlockRules(fingerprint: string, browser: string): Promise<{ blocked: boolean; reason?: string }> {
  const now = Date.now();
  const cacheKey = `${fingerprint}:${browser}`;
  const cached = blockRulesCache.get(cacheKey);
  
  if (cached && cached.expiresAt > now) {
    return { blocked: cached.blocked, reason: cached.reason };
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Cek apakah ada record di security_block_rules yang memblokir fingerprint (device) atau browser
    const { data, error } = await supabase
      .from('security_block_rules')
      .select('reason, field_type, value')
      .in('field_type', ['device', 'browser'])
      .in('value', [fingerprint, browser])
      .limit(1)
      .maybeSingle();

    if (error) {
      return { blocked: false };
    }

    const blocked = !!data;
    const reason = data?.reason || undefined;

    blockRulesCache.set(cacheKey, {
      blocked,
      reason,
      expiresAt: now + CACHE_TTL_MS
    });

    return { blocked, reason };
  } catch {
    return { blocked: false };
  }
}

// ── Helper: Cek Peran Pengguna (Role) dengan Cache ──────────────────
async function getUserRole(userId: string): Promise<string> {
  const now = Date.now();
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) return 'customer';

    const role = data.role || 'customer';
    roleCache.set(userId, {
      role,
      expiresAt: now + (CACHE_TTL_MS * 10) // Cache 5 menit untuk role
    });
    return role;
  } catch {
    return 'customer';
  }
}

// ── Helper: Log Keamanan Otomatis dari Middleware ─────────────────────
async function logMiddlewareSecurity(event: {
  userId?: string;
  ipAddress: string;
  activity: string;
  endpoint: string;
  status: 'failed' | 'blocked' | 'success';
  userAgent: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { browser, device } = parseUserAgent(event.userAgent);
    
    await supabase.from('security_logs').insert({
      user_id: event.userId || null,
      ip_address: event.ipAddress,
      browser,
      device,
      user_agent: event.userAgent,
      activity: event.activity,
      endpoint: event.endpoint,
      status: event.status
    });
  } catch (err) {
    console.error('Failed to log security from middleware:', err);
  }
}

// ── Helper: Tulis Blacklist IP Langsung ke Database ────────────────────
async function addIPToBlacklist(ip: string, durationMinutes: number, reason: string) {
  try {
    const supabase = getSupabaseAdmin();
    const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();
    await supabase.from('security_ip_rules').upsert({
      ip_address: ip,
      rule_type: 'blacklist',
      reason,
      expires_at: expiresAt
    }, { onConflict: 'ip_address' });

    // Invalida cache local
    ipBlacklistCache.set(ip, {
      blocked: true,
      reason,
      expiresAt: Date.now() + durationMinutes * 60000
    });
  } catch (err) {
    console.error('Failed to blacklist IP:', err);
  }
}

// ── 1. Proteksi DDoS Ringan ──────────────────────────────────────────
async function handleDDoSProtection(ip: string, path: string, userAgent: string): Promise<{ action: 'allow' | 'block' | 'delay'; delayMs?: number }> {
  const now = Date.now();
  let timestamps = requestTracker.get(ip) || [];
  
  // Bersihkan request lebih lama dari 5 detik
  timestamps = timestamps.filter(t => now - t < 5000);
  timestamps.push(now);
  requestTracker.set(ip, timestamps);

  const reqsInLast1s = timestamps.filter(t => now - t < 1000).length;
  const reqsInLast2s = timestamps.filter(t => now - t < 2000).length;

  // Level 4: > 15 requests/detik -> Blokir IP 24 Jam
  if (reqsInLast1s > 15) {
    await addIPToBlacklist(ip, 1440, `Level 4 DDoS Protection: Burst request ${reqsInLast1s}/s`);
    await logMiddlewareSecurity({
      ipAddress: ip, activity: 'DDOS_ATTEMPT_LEVEL_4', endpoint: path, status: 'blocked', userAgent
    });
    return { action: 'block' };
  }

  // Level 3: > 20 requests dalam 2 detik -> Blokir IP 1 Jam
  if (reqsInLast2s > 20) {
    await addIPToBlacklist(ip, 60, `Level 3 DDoS Protection: Burst request ${reqsInLast2s}/2s`);
    await logMiddlewareSecurity({
      ipAddress: ip, activity: 'DDOS_ATTEMPT_LEVEL_3', endpoint: path, status: 'blocked', userAgent
    });
    return { action: 'block' };
  }

  // Level 2: > 6 requests/detik -> Delay response 5 detik
  if (reqsInLast1s > 6) {
    return { action: 'delay', delayMs: 5000 };
  }

  // Level 1: > 3 requests/detik -> Delay response 2 detik
  if (reqsInLast1s > 3) {
    return { action: 'delay', delayMs: 2000 };
  }

  return { action: 'allow' };
}

// ── 2. Rate Limiting Global API ──────────────────────────────────────
function checkApiRateLimit(key: string, limit: number, windowMs = 60_000): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = generalRateLimiter.get(key);

  if (!entry || entry.resetAt <= now) {
    generalRateLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  generalRateLimiter.set(key, entry);
  return { allowed: true, retryAfter: 0 };
}

// ── Cleanup memory rate limiter periodically ──────────────────────────
let lastCleanup = Date.now();
function cleanupMemStore() {
  const now = Date.now();
  if (now - lastCleanup > 300_000) { // Setiap 5 menit
    Array.from(generalRateLimiter.entries()).forEach(([key, entry]) => {
      if (entry.resetAt <= now) generalRateLimiter.delete(key);
    });
    Array.from(requestTracker.entries()).forEach(([key, list]) => {
      const filtered = list.filter(t => now - t < 5000);
      if (filtered.length === 0) requestTracker.delete(key);
      else requestTracker.set(key, filtered);
    });
    Array.from(ipBlacklistCache.entries()).forEach(([key, entry]) => {
      if (entry.expiresAt <= now) ipBlacklistCache.delete(key);
    });
    Array.from(roleCache.entries()).forEach(([key, entry]) => {
      if (entry.expiresAt <= now) roleCache.delete(key);
    });
    Array.from(blockRulesCache.entries()).forEach(([key, entry]) => {
      if (entry.expiresAt <= now) blockRulesCache.delete(key);
    });
    lastCleanup = now;
  }
}

// Helper untuk mengecek apakah user agent berasal dari search engine crawler resmi
function isLegitimateSearchEngine(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const engines = [
    'googlebot',
    'bingbot',
    'baiduspider',
    'yandexbot',
    'duckduckbot',
    'facebot',
    'twitterbot',
    'pinterestbot',
    'google-co'
  ];
  return engines.some(engine => ua.includes(engine));
}

// Helper untuk menghasilkan respons blokir keamanan yang indah (HTML untuk halaman biasa, JSON untuk API)
function createBlockResponse(request: NextRequest, message: string, status: number = 403): NextResponse {
  const path = request.nextUrl.pathname;
  
  if (path.startsWith('/api')) {
    return new NextResponse(
      JSON.stringify({ error: message }),
      { status, headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' } }
    );
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Akses Ditangguhkan - RestoBook</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #0b0f19;
      color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
      position: relative;
    }
    body::before {
      content: "";
      position: absolute;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(234, 88, 12, 0.15) 0%, rgba(234, 88, 12, 0) 70%);
      top: 10%;
      left: 10%;
      z-index: 0;
      pointer-events: none;
    }
    body::after {
      content: "";
      position: absolute;
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0) 70%);
      bottom: 10%;
      right: 10%;
      z-index: 0;
      pointer-events: none;
    }
    .card {
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      width: 100%;
      max-width: 480px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      z-index: 10;
      animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-container {
      position: relative;
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: rgba(234, 88, 12, 0.1);
      border: 1px solid rgba(234, 88, 12, 0.2);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-container::after {
      content: "";
      position: absolute;
      inset: -4px;
      border-radius: 24px;
      background: radial-gradient(circle, rgba(234, 88, 12, 0.2) 0%, rgba(234, 88, 12, 0) 80%);
      z-index: -1;
    }
    .icon {
      width: 36px;
      height: 36px;
      color: #ea580c;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 900;
      line-height: 1.25;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    .highlight {
      background: linear-gradient(to right, #f97316, #ea580c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      border-radius: 16px;
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 10px 15px -3px rgba(234, 88, 12, 0.3);
      border: none;
      cursor: pointer;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(234, 88, 12, 0.4);
    }
    .btn:active { transform: translateY(0); }
    .footer {
      margin-top: 24px;
      font-size: 11px;
      color: #4b5563;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Keamanan Sistem</div>
    <div class="icon-container">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>
    <h1>Akses <span class="highlight">Ditangguhkan</span></h1>
    <p>${message}</p>
    <a href="/login" class="btn">Kembali ke Halaman Utama</a>
    <div class="footer">RestoBook Security Shield Protection</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html', 'X-Content-Type-Options': 'nosniff' }
  });
}

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE UTAMA
// ═══════════════════════════════════════════════════════════════════
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 0. Force HTTPS redirect (except for localhost)
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host') || '';
  if (proto === 'http' && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 301);
  }

  // 1. Abaikan aset statis, media, sitemap, dan robots.txt di awal untuk performa & aksesibilitas bot SEO
  const isStaticAsset = path.startsWith('/_next') || 
    path === '/sitemap.xml' ||
    path === '/robots.txt' ||
    /\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|mp3|json)$/.test(path);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  cleanupMemStore();

  // A. Deteksi Path Traversal
  if (hasPathTraversal(path)) {
    await logSecurityIncident({
      ipAddress: ip,
      endpoint: path,
      attackType: 'TRAVERSAL',
      severity: 'high',
      payload: { path }
    });
    return new NextResponse(
      JSON.stringify({ error: 'Permintaan tidak dapat diproses.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // B. Inisialisasi Cookie UUID Sidik Jari Klien
  let deviceUuid = request.cookies.get('sec_device_uuid')?.value;
  let isNewDevice = false;
  if (!deviceUuid) {
    deviceUuid = crypto.randomUUID();
    isNewDevice = true;
  }

  // Hitung Unique Security Fingerprint (Multi-layer Identity)
  const fingerprint = generateSecurityFingerprint(request, deviceUuid);
  const cfCountry = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || 'Unknown';
  const cfCity = request.headers.get('x-vercel-ip-city') || 'Unknown';
  const cfAsn = request.headers.get('x-vercel-ip-asn') || request.headers.get('cf-asn') || 'Unknown';
  const subnet = extractSubnet(ip);

  // C. Deteksi Coordinated ASN/Subnet Attacks & Botnets
  const { subnetBlocked, coordinatedAsn, highProtectionAsn, botnetDetected } = await detectCoordinatedAsnSubnetAttack(ip, cfAsn, path, fingerprint);
  if (subnetBlocked) {
    return createBlockResponse(request, 'Permintaan tidak dapat diproses (Akses Subnet Anda ditangguhkan sementara).', 403);
  }

  // D. Cek IP Blacklist
  const { blocked, reason } = await checkIPBlacklist(ip);
  if (blocked) {
    return createBlockResponse(request, `Akses IP ditolak oleh sistem keamanan: ${reason}`, 403);
  }

  // D.2. Cek Fingerprint & Browser Blacklist
  const { browser: clientBrowser } = parseUserAgent(userAgent);
  const { blocked: isFpBlocked, reason: fpBlockReason } = await checkBlockRules(fingerprint, clientBrowser);
  if (isFpBlocked) {
    return createBlockResponse(request, `Akses perangkat/browser Anda ditangguhkan oleh sistem keamanan: ${fpBlockReason || 'Pencekalan perangkat'}`, 403);
  }

  // E. Load Emergency Settings & Terapkan Proteksi Global
  const emergency = await getEmergencySettings();
  if (emergency.emergency_mode) {
    if (path === '/register' || path === '/api/register') {
      if (emergency.block_new_registrations) {
        return createBlockResponse(request, 'Pendaftaran akun baru saat ini sedang ditutup oleh administrator sistem (Registrasi Baru Ditutup).', 403);
      }
    }
    const isSensitive = path.startsWith('/api/send-otp') || path.startsWith('/api/verify-otp') || path.startsWith('/api/reset-password');
    if (isSensitive && emergency.block_sensitive_endpoints) {
      return createBlockResponse(request, 'Permintaan tidak dapat diproses karena layanan ini sedang ditangguhkan sementara.', 403);
    }
  }

  // F. Deteksi Headless Browser & Otomasi (Kecuali Search Engine resmi untuk optimasi SEO)
  const isHeadless = detectHeadlessBrowser(request);
  const isSearchEngine = isLegitimateSearchEngine(userAgent);
  if (isHeadless && !isSearchEngine && (path.startsWith('/api') || path === '/login' || path === '/register')) {
    await logSecurityIncident({
      ipAddress: ip,
      fingerprint,
      asn: cfAsn,
      country: cfCountry,
      city: cfCity,
      endpoint: path,
      attackType: 'HEADLESS_BROWSER',
      severity: 'medium',
      payload: { userAgent }
    });
    return createBlockResponse(request, 'Aktivitas bot otomatis/headless browser diblokir untuk keamanan sistem.', 403);
  }

  // G. Deteksi VPN / Proxy / Tor
  const { isProxyOrVpn, reason: proxyReason } = await detectProxyOrVPN(request, ip);
  let rateLimitFactor = 1;
  if (isProxyOrVpn) {
    rateLimitFactor = 3;
    if (path.startsWith('/api/auth') || path.startsWith('/api/send-otp')) {
      await logSecurityIncident({
        ipAddress: ip,
        fingerprint,
        asn: cfAsn,
        country: cfCountry,
        city: cfCity,
        endpoint: path,
        attackType: 'VPN_ACCESS',
        severity: 'low',
        payload: { reason: proxyReason }
      });
    }
  }

  // H. Track & Detect Rotating IP / Country Hop
  const { riskScoreAddition, isRotating, ipCount30m, isCountryHop } = await trackAndDetectRotatingIP(fingerprint, ip, cfCountry, cfCity, cfAsn);

  // (Aset statis dan media sudah diproses & diabaikan di awal middleware)

  // 3. Deteksi Bot Palsu / Headless Browser (Kecuali Search Engine resmi)
  const { isBot } = parseUserAgent(userAgent);
  if (isBot && !isSearchEngine && (path.startsWith('/api') || path === '/login' || path === '/register')) {
    await logMiddlewareSecurity({
      ipAddress: ip, activity: 'BOT_BLOCKED', endpoint: path, status: 'blocked', userAgent
    });
    return createBlockResponse(request, 'Aktivitas agen bot otomatis diblokir.', 403);
  }

  // 4. Proteksi DDoS Ringan
  const ddosCheck = await handleDDoSProtection(ip, path, userAgent);
  if (ddosCheck.action === 'block') {
    return createBlockResponse(request, 'Terdeteksi aktivitas permintaan berlebih (DDoS). IP Anda telah diblokir demi keamanan.', 403);
  }

  // 5. Verifikasi CSRF Token
  const method = request.method;
  const isMutation = ['POST', 'PUT', 'DELETE'].includes(method);
  const isBypassedPath = 
    path.startsWith('/api/payment') || 
    path === '/api/auth/callback' ||
    path === '/api/auth/login' ||
    path === '/api/register' ||
    path === '/api/send-otp' ||
    path === '/api/verify-otp' ||
    path === '/api/reset-password';

  if (isMutation && !isBypassedPath) {
    const csrfCookie = request.cookies.get('csrf-token')?.value;
    const csrfHeader = request.headers.get('x-csrf-token');
    
    const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-'));

    if (hasSession && (!csrfCookie || csrfCookie !== csrfHeader)) {
      await logMiddlewareSecurity({
        ipAddress: ip, activity: 'CSRF_VIOLATION', endpoint: path, status: 'blocked', userAgent
      });
      return new NextResponse(
        JSON.stringify({ error: 'CSRF token tidak valid atau kedaluwarsa.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 6. Supabase Session Sync
  const { supabase, user, supabaseResponse } = await updateSession(request);
  let finalResponse = supabaseResponse;

  if (user && finalResponse) {
    const metaLang = user.user_metadata?.lang || 'id';
    const clientLang = request.cookies.get('rb_i18n_lang')?.value;
    if (metaLang !== clientLang) {
      finalResponse.cookies.set('rb_i18n_lang', metaLang, {
        path: '/',
        secure: true,
        httpOnly: false, // Client needs to read/write it
        sameSite: 'lax',
        maxAge: 31536000 // 1 year
      });
    }
  }

  // Set Cookie UUID Sidik Jari Klien ke response utama jika baru
  if (isNewDevice && finalResponse) {
    finalResponse.cookies.set('sec_device_uuid', deviceUuid, {
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 // 1 year
    });
  }

  // 6.2. Deteksi Impossible Travel & Account Sharing (Server-Side - Log only to prevent false-positive logouts)
  if (user) {
    // A. Impossible Travel
    const travelCheck = await checkImpossibleTravel(user.id, cfCountry, cfCity);
    if (travelCheck.impossibleTravel) {
      await logSecurityIncident({
        ipAddress: ip,
        fingerprint,
        asn: cfAsn,
        country: cfCountry,
        city: cfCity,
        endpoint: path,
        attackType: 'IMPOSSIBLE_TRAVEL',
        severity: 'critical',
        payload: { lastCountry: travelCheck.lastCountry, currentCountry: cfCountry, lastActive: travelCheck.lastActiveAt }
      });
    }

    // B. Account Sharing Detection (Aktif dari 2+ negara atau 3+ IP bersamaan dalam 15 menit)
    const { data: activeSessions } = await supabase
      .from('security_user_sessions')
      .select('ip_address, country, last_active_at')
      .eq('profile_id', user.id)
      .gt('last_active_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (activeSessions && activeSessions.length > 1) {
      const uniqueCountries = new Set(activeSessions.map(s => s.country));
      const uniqueIps = new Set(activeSessions.map(s => s.ip_address));
      
      if (uniqueCountries.size >= 2 || uniqueIps.size >= 3) {
        await logSecurityIncident({
          ipAddress: ip,
          fingerprint,
          asn: cfAsn,
          country: cfCountry,
          city: cfCity,
          endpoint: path,
          attackType: 'ACCOUNT_SHARING',
          severity: 'high',
          payload: { activeSessions }
        });
      }
    }
  }

  // 6.3. Kalkulasi Security Score & Blacklist Otomatis (> 100)
  // Cek apakah IP baru untuk fingerprint ini
  const { data: prevIpRecord } = await supabase
    .from('security_fingerprint_ips')
    .select('id')
    .eq('fingerprint', fingerprint)
    .neq('ip_address', ip)
    .limit(1)
    .maybeSingle();
  const isNewIp = !prevIpRecord;

  // Cek IP berbeda dalam ASN sama
  const { data: prevAsnRecord } = await supabase
    .from('security_fingerprint_ips')
    .select('id')
    .eq('fingerprint', fingerprint)
    .eq('asn', cfAsn)
    .neq('ip_address', ip)
    .limit(1)
    .maybeSingle();
  const isSameAsnDiffIp = !!prevAsnRecord;

  const scoreContext = {
    isNewIp,
    isSameAsnDiffIp,
    isCountryHop,
    isRotatingIp: isRotating,
    isProxy: isProxyOrVpn && (proxyReason?.toLowerCase().includes('proxy') || false),
    isVpn: isProxyOrVpn && (proxyReason?.toLowerCase().includes('vpn') || false),
    isTor: cfCountry === 'T1' || cfCountry === 'TOR',
    isBotnet: botnetDetected,
    isMassAttack: highProtectionAsn
  };

  const securityScore = calculateSecurityScore(scoreContext);

  if (securityScore > 100) {
    await addIPToBlacklist(ip, 1440, `Security Score Exceeded: ${securityScore}`);
    await logSecurityIncident({
      ipAddress: ip,
      fingerprint,
      asn: cfAsn,
      country: cfCountry,
      city: cfCity,
      endpoint: path,
      attackType: 'SECURITY_SCORE_EXCEEDED',
      severity: 'critical',
      payload: { scoreContext, securityScore }
    });
    return createBlockResponse(request, 'Akses Anda ditangguhkan sementara karena sistem mendeteksi aktivitas mencurigakan yang terindikasi serangan.', 403);
  }

  // 6.5. Deteksi Session Hijacking & Sesi Terikat (Log only to prevent false-positive logouts)
  if (user && path !== '/api/ping') {
    const authCookie = request.cookies.getAll().find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    const sessionId = authCookie ? authCookie.value.slice(0, 100) : null;
    
    if (sessionId) {
      const hijackCheck = await detectSessionHijack(sessionId, user.id, request, ip);
      if (hijackCheck.hijacked) {
        await logSecurityIncident({
          ipAddress: ip,
          endpoint: path,
          attackType: 'SESSION_HIJACK',
          severity: 'critical',
          payload: { reason: hijackCheck.reason, userId: user.id }
        });
      }
    }
  }

  // 7. Auto Logout Inactivity (Server-Side)
  if (user) {
    const lastActiveStr = request.cookies.get('last_active_timestamp')?.value;
    const userRole = await getUserRole(user.id);
    const now = Date.now();

    const inactivityLimits: Record<string, number> = {
      customer: 30 * 60_000,
      cashier: 20 * 60_000,
      admin: 15 * 60_000
    };
    const limit = inactivityLimits[userRole] || 30 * 60_000;

    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (now - lastActive > limit) {
        await supabase.auth.signOut();
        const res = NextResponse.redirect(new URL('/login?session_expired=true', request.url));
        res.cookies.delete('last_active_timestamp');
        res.cookies.delete('csrf-token');
        return res;
      }
    }
    
    finalResponse.cookies.set('last_active_timestamp', String(now), {
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'strict'
    });
  }

  // 8. Tambahkan CSRF Cookie ke GET Request baru
  if (method === 'GET' && !request.cookies.get('csrf-token')?.value) {
    const newToken = generateCSRFToken();
    finalResponse.cookies.set('csrf-token', newToken, {
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'strict'
    });
  }

  // 9. API Rate Limiting Multi-Layer (Bypass /api/ping to prevent false connection loss alerts)
  if (path.startsWith('/api') && path !== '/api/ping') {
    let limit = 60; // Public API rate limit (60/min)
    let rateLimitKey = `rate:pub:${ip}`;

    // Tighten rate limits for sensitive endpoints
    if (path === '/api/auth/login') {
      limit = 5;
      rateLimitKey = `rate:login:${ip}`;
    } else if (path.startsWith('/api/restobot')) {
      limit = 10;
      rateLimitKey = `rate:bot:${ip}`;
    } else if (path.includes('/reservations')) {
      limit = 5;
      rateLimitKey = `rate:resv:${ip}`;
    } else if (user) {
      const role = await getUserRole(user.id);
      if (role === 'admin') {
        limit = 1000;
        rateLimitKey = `rate:admin:${user.id}`;
      } else {
        limit = 300;
        rateLimitKey = `rate:user:${user.id}`;
      }
    }

    if (emergency.tightened_rate_limits) {
      limit = Math.max(2, Math.floor(limit / 10)); // Emergency Level 1: perketat 10x
    } else if (isProxyOrVpn) {
      limit = Math.max(10, Math.floor(limit / 3));
    }

    // Multi-layer rate checks
    const ipCheck = checkApiRateLimit(`rate:ip:${ip}`, limit);
    const fpCheck = checkApiRateLimit(`rate:fp:${fingerprint}`, limit);
    const subnetCheck = checkApiRateLimit(`rate:subnet:${subnet}`, limit * 5);
    const asnCheck = checkApiRateLimit(`rate:asn:${cfAsn}`, limit * 15);

    if (!ipCheck.allowed || !fpCheck.allowed || !subnetCheck.allowed || !asnCheck.allowed) {
      const activeKey = !ipCheck.allowed ? 'IP' : (!fpCheck.allowed ? 'Fingerprint' : (!subnetCheck.allowed ? 'Subnet' : 'ASN'));
      
      await logMiddlewareSecurity({
        userId: user?.id,
        ipAddress: ip,
        activity: 'RATE_LIMIT_EXCEEDED',
        endpoint: path,
        status: 'blocked',
        userAgent
      });

      const retryAfter = Math.max(ipCheck.retryAfter, fpCheck.retryAfter, subnetCheck.retryAfter, asnCheck.retryAfter);
      const rateLimitRes = new NextResponse(
        JSON.stringify({
          status: false,
          message: `Rate limit exceeded (Layer: ${activeKey})`,
          retry_after: retryAfter
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter)
          } 
        }
      );
      
      rateLimitRes.headers.set('X-Content-Type-Options', 'nosniff');
      rateLimitRes.headers.set('X-Frame-Options', 'DENY');
      return rateLimitRes;
    }
  }

  // 10. DDoS Delay Execution (jika anomali level 1 atau 2 terdeteksi)
  if (ddosCheck.action === 'delay' && ddosCheck.delayMs) {
    await new Promise(resolve => setTimeout(resolve, ddosCheck.delayMs));
  }

  // 11. Proteksi Halaman Berdasarkan Peran (Auth Guard & RBAC)
  const isAuthPath = path === '/login' || path === '/register' || path === '/forgot-password';
  
  if (isAuthPath && user) {
    const role = await getUserRole(user.id);
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
  }

  const isProtectedRoute = path.startsWith('/customer') || path.startsWith('/cashier') || path.startsWith('/admin');
  
  if (isProtectedRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Ambil profile status untuk pemblokiran manual
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, status_karyawan, status')
      .eq('user_id', user.id)
      .single();

    const role = profile?.role;
    const statusKaryawan = profile?.status_karyawan;
    const status = profile?.status;

    if (statusKaryawan && statusKaryawan !== 'aktif') {
      const res = NextResponse.redirect(new URL(`/login?suspended=${statusKaryawan}&pid=${profile?.id || ''}`, request.url));
      res.cookies.delete('last_active_timestamp');
      res.cookies.delete('csrf-token');
      request.cookies.getAll().forEach(c => {
        if (c.name.startsWith('sb-')) {
          res.cookies.delete(c.name);
        }
      });
      return res;
    }

    if (status && status !== 'active') {
      const res = NextResponse.redirect(new URL(`/login?suspended=${status}&pid=${profile?.id || ''}`, request.url));
      res.cookies.delete('last_active_timestamp');
      res.cookies.delete('csrf-token');
      request.cookies.getAll().forEach(c => {
        if (c.name.startsWith('sb-')) {
          res.cookies.delete(c.name);
        }
      });
      return res;
    }

    if (path.startsWith('/customer') && role !== 'customer') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    if (path.startsWith('/cashier') && role !== 'cashier') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Tambahkan Header Keamanan Dasar
  finalResponse.headers.set('X-Content-Type-Options', 'nosniff');
  finalResponse.headers.set('X-Frame-Options', 'DENY');
  finalResponse.headers.set('X-XSS-Protection', '1; mode=block');
  finalResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS Header (Strict HTTPS)
  finalResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Content Security Policy (CSP) dengan upgrade-insecure-requests dan source yang diijinkan
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://apis.google.com https://hcaptcha.com https://*.hcaptcha.com https://js.duitku.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://*.supabase.co https://lh3.googleusercontent.com https://*.googleusercontent.com https://vantage.csw.lenovo.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://api.duitku.com https://sandbox.duitku.com https://hcaptcha.com https://*.hcaptcha.com",
    "frame-src 'self' https://*.google.com https://hcaptcha.com https://*.hcaptcha.com https://sandbox.duitku.com https://api.duitku.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  finalResponse.headers.set('Content-Security-Policy', cspHeader);

  return finalResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
