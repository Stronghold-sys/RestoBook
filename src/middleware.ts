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

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE UTAMA
// ═══════════════════════════════════════════════════════════════════
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
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
    return new NextResponse(
      JSON.stringify({ error: 'Permintaan tidak dapat diproses (Akses Subnet Ditangguhkan).' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // D. Cek IP Blacklist
  const { blocked, reason } = await checkIPBlacklist(ip);
  if (blocked) {
    return new NextResponse(
      JSON.stringify({ error: `Akses IP ditolak oleh sistem keamanan: ${reason}` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // D.2. Cek Fingerprint & Browser Blacklist
  const { browser: clientBrowser } = parseUserAgent(userAgent);
  const { blocked: isFpBlocked, reason: fpBlockReason } = await checkBlockRules(fingerprint, clientBrowser);
  if (isFpBlocked) {
    return new NextResponse(
      JSON.stringify({ error: `Akses perangkat/browser Anda ditangguhkan oleh sistem keamanan: ${fpBlockReason || 'Pencekalan perangkat'}` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // E. Load Emergency Settings & Terapkan Proteksi Global
  const emergency = await getEmergencySettings();
  if (emergency.emergency_mode) {
    if (path === '/register' || path === '/api/register') {
      if (emergency.block_new_registrations) {
        return new NextResponse(
          JSON.stringify({ error: 'Permintaan tidak dapat diproses (Registrasi Baru Ditutup).' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    const isSensitive = path.startsWith('/api/send-otp') || path.startsWith('/api/verify-otp') || path.startsWith('/api/reset-password');
    if (isSensitive && emergency.block_sensitive_endpoints) {
      return new NextResponse(
        JSON.stringify({ error: 'Permintaan tidak dapat diproses (Layanan Ditangguhkan).' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // F. Deteksi Headless Browser & Otomasi
  const isHeadless = detectHeadlessBrowser(request);
  if (isHeadless && (path.startsWith('/api') || path === '/login' || path === '/register')) {
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
    return new NextResponse(
      JSON.stringify({ error: 'Aktivitas bot diblokir.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
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

  // 1. Abaikan aset statis dan media
  const isStaticAsset = path.startsWith('/_next') || 
    /\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|mp3)$/.test(path);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  // 3. Deteksi Bot Palsu / Headless Browser
  const { isBot } = parseUserAgent(userAgent);
  if (isBot && (path.startsWith('/api') || path === '/login' || path === '/register')) {
    await logMiddlewareSecurity({
      ipAddress: ip, activity: 'BOT_BLOCKED', endpoint: path, status: 'blocked', userAgent
    });
    return new NextResponse(
      JSON.stringify({ error: 'Aktivitas bot diblokir.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Proteksi DDoS Ringan
  const ddosCheck = await handleDDoSProtection(ip, path, userAgent);
  if (ddosCheck.action === 'block') {
    return new NextResponse(
      JSON.stringify({ error: 'Terdeteksi aktivitas DDoS. IP Anda telah diblokir.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
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
    return new NextResponse(
      JSON.stringify({ error: 'Permintaan tidak dapat diproses (Akses ditangguhkan sementara karena terindikasi serangan).' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 6.5. Deteksi Session Hijacking & Sesi Terikat (Log only to prevent false-positive logouts)
  if (user) {
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

  // 9. API Rate Limiting Multi-Layer
  if (path.startsWith('/api')) {
    let limit = 60; // Public API rate limit (60/min)
    let rateLimitKey = `rate:pub:${ip}`;

    if (user) {
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
  finalResponse.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  finalResponse.headers.set('X-XSS-Protection', '1; mode=block');
  finalResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return finalResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
