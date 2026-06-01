/**
 * RESTOBOOK SECURITY UTILITIES
 * Validasi input, sanitasi, dan proteksi API server-side
 * Digunakan di semua API Route handlers
 */

// ── Validasi & Sanitasi Input ───────────────────────────────────────

/**
 * Hapus karakter berbahaya dari string input
 * Mencegah XSS dan injeksi dasar
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .slice(0, maxLength)
    // Hapus karakter kontrol
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
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

// ── Rate Limiter Sisi Server (untuk API Route handlers) ─────────────

const apiRateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiter ringan untuk API Route handlers (Edge/Node)
 * Gunakan sebagai lapisan kedua setelah middleware
 */
export function apiRateLimit(
  key: string,
  maxRequests = 20,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = apiRateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    apiRateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  apiRateLimitStore.set(key, entry);
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// ── Standard API Error Responses ────────────────────────────────────

export const ApiErrors = {
  unauthorized: () => Response.json({ error: 'Tidak diizinkan. Silakan login kembali.' }, { status: 401 }),
  forbidden: () => Response.json({ error: 'Akses ditolak.' }, { status: 403 }),
  notFound: (resource = 'Data') => Response.json({ error: `${resource} tidak ditemukan.` }, { status: 404 }),
  badRequest: (message: string) => Response.json({ error: message }, { status: 400 }),
  tooManyRequests: (retryAfter = 60) => Response.json(
    { error: 'Terlalu banyak permintaan. Coba lagi nanti.', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  ),
  serverError: (detail?: string) => Response.json(
    { error: 'Terjadi kesalahan server. Tim kami telah diberitahu.' },
    { status: 500 }
  ),
};

// ── Input Validation Helpers ─────────────────────────────────────────

/**
 * Validasi body request JSON dengan schema sederhana
 */
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

// ── Audit Logger ─────────────────────────────────────────────────────

interface AuditEvent {
  action: string;
  userId?: string;
  ip?: string;
  resource?: string;
  details?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Log aktivitas penting untuk audit trail
 * Di produksi, kirim ke logging service (Sentry, DataDog, dll)
 */
export function auditLog(event: AuditEvent): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  if (event.severity === 'critical') {
    console.error('[AUDIT:CRITICAL]', JSON.stringify(logEntry));
  } else if (event.severity === 'warning') {
    console.warn('[AUDIT:WARNING]', JSON.stringify(logEntry));
  } else {
    console.log('[AUDIT:INFO]', JSON.stringify(logEntry));
  }
}
