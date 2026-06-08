import { NextRequest, NextResponse } from 'next/server';

// Daftar origin yang diperbolehkan di lingkungan Development
const DEV_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'capacitor://localhost', // Untuk Capacitor Android/iOS App
  'http://localhost',      // Untuk webview emulator Android
];

// Daftar origin yang diperbolehkan di lingkungan Production
const PROD_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL || '',
  'https://restobook.com',
  'https://www.restobook.com',
].filter(Boolean);

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-CSRF-Token',
  'X-Requested-With',
  'Accept',
  'Accept-Version',
  'Content-Length',
  'Content-MD5',
  'Date',
  'X-Api-Version',
].join(', ');

/**
 * Mengecek apakah origin request diperbolehkan
 */
export function isAllowedOrigin(origin: string | null, requestOrigin?: string): boolean {
  if (!origin) return false;

  // Izinkan jika same-origin (request berasal dari domain/host yang sama)
  if (requestOrigin && origin === requestOrigin) {
    return true;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const allowedList = isDev 
    ? [...DEV_ALLOWED_ORIGINS, ...PROD_ALLOWED_ORIGINS] 
    : PROD_ALLOWED_ORIGINS;

  return allowedList.includes(origin);
}

/**
 * Utilitas untuk menangani CORS pada Middleware atau Route Handler Next.js
 */
export function handleCors(request: NextRequest, response?: NextResponse): NextResponse | null {
  const origin = request.headers.get('origin');
  const method = request.method;

  // Jika tidak ada origin header, request bukan Cross-Origin (sama-sama dari origin kita sendiri)
  // Lanjutkan request tanpa modifikasi CORS
  if (!origin) {
    return null;
  }

  // Validasi Origin (serta verifikasi apakah ini same-origin request)
  const requestOrigin = request.nextUrl.origin;
  const allowed = isAllowedOrigin(origin, requestOrigin);
  if (!allowed) {
    // Blokir wildcard atau origin tidak dikenal
    return new NextResponse(
      JSON.stringify({ error: 'CORS policy: Akses asal (origin) ditolak.' }),
      { 
        status: 403, 
        headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' } 
      }
    );
  }

  // Jika ini preflight request (OPTIONS)
  if (method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });
    
    preflightResponse.headers.set('Access-Control-Allow-Origin', origin);
    preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    preflightResponse.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    preflightResponse.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    preflightResponse.headers.set('Access-Control-Max-Age', '86400'); // Cache preflight selama 24 jam
    
    return preflightResponse;
  }

  // Jika request normal (GET, POST, dll.), tambahkan header CORS ke response yang ada
  if (response) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  }

  return null;
}
