import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

// ═══════════════════════════════════════════════════════════════════
// SISTEM KEAMANAN RESTOBOOK - Middleware Terpadu
// Perlindungan: Rate Limiting, Bot Detection, Auth Guard, RBAC
// ═══════════════════════════════════════════════════════════════════

// ── In-Memory Rate Limiter ──────────────────────────────────────────
// Catatan: Untuk produksi skala besar, gunakan Redis/Upstash
const rateLimitStore = new Map<string, { count: number; resetAt: number; blocked?: boolean }>();

interface RateLimitRule {
  windowMs: number;  // Jendela waktu dalam ms
  maxRequests: number;  // Maks request per jendela
  blockDurationMs?: number;  // Durasi blokir jika melebihi limit
}

const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  // Endpoint sensitif – limit ketat
  '/api/auth':          { windowMs: 60_000,  maxRequests: 10,  blockDurationMs: 300_000 },
  '/login':             { windowMs: 60_000,  maxRequests: 10,  blockDurationMs: 300_000 },
  '/register':          { windowMs: 60_000,  maxRequests: 5,   blockDurationMs: 600_000 },
  '/forgot-password':   { windowMs: 60_000,  maxRequests: 5,   blockDurationMs: 600_000 },
  '/api/otp':           { windowMs: 60_000,  maxRequests: 5,   blockDurationMs: 900_000 },
  '/api/customer/wallet/topup': { windowMs: 60_000, maxRequests: 5, blockDurationMs: 300_000 },
  // API umum – limit sedang
  '/api/orders':        { windowMs: 60_000,  maxRequests: 30 },
  '/api/reviews':       { windowMs: 60_000,  maxRequests: 20 },
  '/api/admin':         { windowMs: 60_000,  maxRequests: 60 },
  // Default – semua rute lainnya
  'default':            { windowMs: 60_000,  maxRequests: 120 },
};

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||  // Cloudflare
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; retryAfter?: number } {
  // Tentukan aturan yang berlaku
  let rule = RATE_LIMIT_RULES['default'];
  for (const [prefix, r] of Object.entries(RATE_LIMIT_RULES)) {
    if (path.startsWith(prefix)) {
      rule = r;
      break;
    }
  }

  const key = `${ip}:${Object.keys(RATE_LIMIT_RULES).find(p => path.startsWith(p)) || 'default'}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Cek apakah IP sedang diblokir
  if (entry?.blocked && entry.resetAt > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  // Reset window jika sudah expired
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true };
  }

  // Tambah counter
  entry.count++;

  // Cek apakah melebihi limit
  if (entry.count > rule.maxRequests) {
    if (rule.blockDurationMs) {
      entry.blocked = true;
      entry.resetAt = now + rule.blockDurationMs;
      rateLimitStore.set(key, entry);
      return { allowed: false, retryAfter: Math.ceil(rule.blockDurationMs / 1000) };
    }
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  rateLimitStore.set(key, entry);
  return { allowed: true };
}

// ── Bot & Threat Detection ──────────────────────────────────────────
const BLOCKED_USER_AGENT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /python-requests\/[0-1]\./i,  // Script lama
  /curl\/[0-6]\./i,
  /scrapy/i,
  /wget/i,
  /go-http-client\/1\./i,
  /libwww-perl/i,
];

const SUSPICIOUS_PATH_PATTERNS = [
  /\.\.\/|\.\.%2F/i,           // Path traversal
  /\.(php|asp|aspx|jsp|cgi)$/i, // Script injection probe
  /\/wp-(admin|login|config)/i, // WordPress probe
  /\/(etc|proc|sys)\//i,        // System file access
  /union.*select/i,             // SQL injection
  /<script/i,                   // XSS probe
  /javascript:/i,               // XSS probe
];

function isThreat(request: NextRequest): boolean {
  const ua = request.headers.get('user-agent') || '';
  const path = request.nextUrl.pathname + request.nextUrl.search;

  // Cek user agent mencurigakan
  if (BLOCKED_USER_AGENT_PATTERNS.some(p => p.test(ua))) return true;

  // Cek pola path berbahaya
  if (SUSPICIOUS_PATH_PATTERNS.some(p => p.test(path))) return true;

  return false;
}

// Bersihkan store lama setiap 5 menit untuk hemat memori
let lastCleanup = Date.now();
function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup > 300_000) {
    // Array.from() diperlukan agar kompatibel dengan target TypeScript lama
    Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
      if (entry.resetAt <= now) rateLimitStore.delete(key);
    });
    lastCleanup = now;
  }
}

// ── Helper: Response dengan Security Headers ────────────────────────
function secureResponse(response: NextResponse): NextResponse {
  // Header keamanan dasar yang selalu disertakan
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

function rateLimitedResponse(retryAfter: number): NextResponse {
  const res = NextResponse.json(
    {
      error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
      retryAfter
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Date.now() + retryAfter * 1000),
      }
    }
  );
  return secureResponse(res);
}

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE UTAMA
// ═══════════════════════════════════════════════════════════════════
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = getClientIP(request);

  // Bersihkan store lama
  cleanupStore();

  // ── 1. Deteksi ancaman langsung ──────────────────────────────────
  if (isThreat(request)) {
    return new NextResponse(null, { status: 403 });
  }

  // ── 2. Rate Limiting ─────────────────────────────────────────────
  // Jangan rate-limit aset statis
  const isStaticAsset = path.startsWith('/_next') || 
    /\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf)$/.test(path);

  if (!isStaticAsset) {
    const { allowed, retryAfter } = checkRateLimit(ip, path);
    if (!allowed) {
      return rateLimitedResponse(retryAfter!);
    }
  }

  // ── 3. Auth & RBAC (logika asli) ─────────────────────────────────
  const { supabase, user, supabaseResponse } = await updateSession(request)

  const isAuthPath = path === '/login' || path === '/register' || path === '/forgot-password'
  
  // Jika sudah login tapi mengakses halaman auth
  if (isAuthPath && user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    const role = profile?.role || 'customer'
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url))
  }

  // Proteksi rute berdasarkan role
  const isProtectedRoute = path.startsWith('/customer') || path.startsWith('/cashier') || path.startsWith('/admin')
  
  if (isProtectedRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: profile } = await supabase.from('profiles').select('id, role, status_karyawan, status').eq('user_id', user.id).single()
    const role = profile?.role
    const statusKaryawan = profile?.status_karyawan
    const status = profile?.status

    if (statusKaryawan && statusKaryawan !== 'aktif') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL(`/login?suspended=${statusKaryawan}&pid=${profile?.id || ''}`, request.url))
    }

    if (status && status !== 'active') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL(`/login?suspended=${status}&pid=${profile?.id || ''}`, request.url))
    }

    if (path.startsWith('/customer') && role !== 'customer') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if (path.startsWith('/cashier') && role !== 'cashier') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // ── 4. Tambahkan security headers ke semua response ──────────────
  return secureResponse(supabaseResponse);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
