/**
 * RESTOBOOK SECURITY UTILITIES
 * Validasi input, sanitasi, proteksi CSRF, deteksi bot, dan audit logging.
 */
import { getSupabaseAdmin } from './supabase/admin';

// ── 1. CSRF Protection ───────────────────────────────────────────────

/**
 * Generate cryptographically secure random token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback if crypto not available (unlikely in modern runtime)
    for (let i = 0; i < 24; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ── 2. Validasi & Sanitasi Input ───────────────────────────────────────

/**
 * Hapus karakter berbahaya dari string input
 * Mencegah XSS dan injeksi dasar
 */
export function sanitizeString(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  let sanitized = input
    .trim()
    .slice(0, maxLength)
    // Hapus karakter kontrol null bytes
    .replace(/\0/g, '')
    // Escape HTML entities dasar
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * HTML Purifier Sederhana untuk input Chat/Komentar yang lebih aman
 */
export function purifyHTML(html: string): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Hapus tag script
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')              // Hapus event listener inline
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:\s*[^"']*/gi, '')             // Hapus link javascript
    .replace(/<iframe[^>]*>([\s\S]*?)<\/iframe>/gi, ''); // Hapus iframe
}

/**
 * Validasi format email
 */
export function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email) && email.length <= 254;
}

/**
 * Validasi UUID v4
 */
export function isValidUUID(id: string): boolean {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(id);
}

/**
 * Validasi nominal rupiah (positif, tidak lebih dari 100 juta)
 */
export function isValidAmount(amount: unknown, min = 100, max = 100_000_000): boolean {
  const n = Number(amount);
  return Number.isFinite(n) && n >= min && n <= max && Number.isInteger(n);
}

/**
 * Validasi rating (1-5)
 */
export function isValidRating(rating: unknown): boolean {
  const n = Number(rating);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * Cegah path traversal di nama file/folder
 */
export function isSafePath(input: string): boolean {
  return !/(\.\.[\\/]|[\\/]\.\.|\.\.|%2e%2e|%252e)/i.test(input);
}

// ── 3. User Agent Parser & Bot Detection ────────────────────────────

export interface ParsedUA {
  browser: string;
  os: string;
  device: string;
  isBot: boolean;
}

/**
 * Mengubah User Agent menjadi informasi perangkat & mendeteksi bot
 */
export function parseUserAgent(ua: string | null): ParsedUA {
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown', isBot: true };
  }

  let browser = 'Browser tidak diketahui';
  let os = 'OS tidak diketahui';
  let device = 'Desktop';
  let isBot = false;

  // Bot User Agent Signatures
  const botKeywords = [
    'bot', 'spider', 'crawler', 'headless', 'scraper', 'curl', 'wget', 'python-requests',
    'postman', 'insomnia', 'http-client', 'playwright', 'puppeteer', 'selenium',
    'axios', 'go-http-client', 'nikto', 'sqlmap', 'nmap', 'masscan', 'zgrab'
  ];
  if (botKeywords.some(keyword => ua.toLowerCase().includes(keyword))) {
    isBot = true;
  }

  // Detect OS
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) {
    os = 'Android';
    device = 'Mobile';
  } else if (/iphone|ipad/i.test(ua)) {
    os = 'iOS';
    device = /ipad/i.test(ua) ? 'Tablet' : 'Mobile';
  } else if (/linux/i.test(ua)) os = 'Linux';

  // Detect Browser
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/chrome/i.test(ua)) browser = 'Google Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';

  return { browser, os, device, isBot };
}

// ── 4. IP reputation check ──────────────────────────────────────────

/**
 * Cek apakah IP Address diblokir di database (blacklist)
 */
export async function isIPBlacklisted(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('security_ip_rules')
      .select('reason, expires_at')
      .eq('ip_address', ip)
      .eq('rule_type', 'blacklist')
      .or(`expires_at.gt.${now},expires_at.is.null`)
      .maybeSingle();

    if (error) {
      console.error('Error checking IP blacklist:', error.message);
      return { blocked: false };
    }

    if (data) {
      return { blocked: true, reason: data.reason || 'IP masuk daftar cekal admin.' };
    }

    return { blocked: false };
  } catch (err) {
    console.error('IP Blacklist exception:', err);
    return { blocked: false };
  }
}

// ── 5. Standard API Error Responses ────────────────────────────────────

export const ApiErrors = {
  unauthorized: () => Response.json({ status: false, error: 'Tidak diizinkan. Silakan login kembali.' }, { status: 401 }),
  forbidden: (msg = 'Akses ditolak.') => Response.json({ status: false, error: msg }, { status: 403 }),
  notFound: (resource = 'Data') => Response.json({ status: false, error: `${resource} tidak ditemukan.` }, { status: 404 }),
  badRequest: (message: string) => Response.json({ status: false, error: message }, { status: 400 }),
  tooManyRequests: (retryAfter = 60, message = 'Rate limit exceeded') => Response.json(
    { status: false, message: message, retry_after: retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  ),
  serverError: () => Response.json(
    { status: false, error: 'Terjadi kesalahan server. Tim kami telah diberitahu.' },
    { status: 500 }
  ),
};

// ── 6. Input Validation Helpers ─────────────────────────────────────────

export function validateBody<T extends Record<string, unknown>>(
  body: unknown,
  requiredFields: (keyof T)[]
): { valid: boolean; missing?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, missing: 'body' };
  }
  for (const field of requiredFields) {
    if ((body as any)[field] === undefined || (body as any)[field] === null || (body as any)[field] === '') {
      return { valid: false, missing: String(field) };
    }
  }
  return { valid: true };
}

/**
 * Deteksi pola SQL injection sederhana
 */
export function hasSQLInjection(input: string): boolean {
  const patterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/,
    /(\bor\b.*=.*|and.*=.*\b)/i,
  ];
  return patterns.some(p => p.test(input));
}

/**
 * Deteksi pola XSS sederhana
 */
export function hasXSS(input: string): boolean {
  const patterns = [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick=, onerror=, dll
    /<iframe/i,
    /document\.cookie/i,
    /\.innerHTML/i,
  ];
  return patterns.some(p => p.test(input));
}

// ── 7. Security Log & Audit Logger ───────────────────────────────────

interface SecurityLogEvent {
  userId?: string;
  fullName?: string;
  ipAddress: string;
  browser?: string;
  device?: string;
  userAgent?: string;
  activity: string;
  endpoint?: string;
  status: 'success' | 'failed' | 'blocked';
}

/**
 * Menyimpan aktivitas keamanan penting ke tabel security_logs
 */
export async function logSecurity(event: SecurityLogEvent): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('security_logs').insert({
      user_id: event.userId || null,
      full_name: event.fullName || null,
      ip_address: event.ipAddress,
      browser: event.browser || null,
      device: event.device || null,
      user_agent: event.userAgent || null,
      activity: event.activity,
      endpoint: event.endpoint || null,
      status: event.status
    });

    if (error) {
      console.error('[SECURITY LOG ERROR]:', error.message);
    }
  } catch (err) {
    console.error('[SECURITY LOG EXCEPTION]:', err);
  }
}

/**
 * Broadcast keamanan realtime via Supabase Realtime Channel
 */
export async function broadcastSecurityAlert(channel: string, event: string, data: any) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.channel(channel).send({
      type: 'broadcast',
      event: event,
      payload: data
    });
  } catch (e) {
    console.error('Failed to broadcast security alert:', e);
  }
}
