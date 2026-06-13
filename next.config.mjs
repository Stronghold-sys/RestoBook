/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'dazsblmccvxtewtmaljf.supabase.co',
      }
    ],
    dangerouslyAllowSVG: true,
  },

  // ── Security Headers ────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Cegah embedding di iframe (Clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Cegah browser menebak MIME type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer Policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions Policy: batasi akses kamera, mikrofon, lokasi
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // HSTS: paksa HTTPS selama 1 tahun
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // XSS Protection (untuk browser lama)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Content Security Policy - izinkan konten yang dibutuhkan aplikasi
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sandbox.duitku.com https://api.duitku.com https://accounts.google.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src * data: blob: http: https: android-assets: cap-file:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.duitku.com https://sandbox.duitku.com https://accounts.google.com https://challenges.cloudflare.com",
              "frame-src https://sandbox.duitku.com https://api.duitku.com https://accounts.google.com https://challenges.cloudflare.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; ')
          },
        ],
      },
      // API Routes: tambahkan header CORS yang ketat
      {
        source: '/api/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },

  // ── Rewrites untuk rate limit friendly URLs ─────────────────────
  async rewrites() {
    return [];
  },
};

export default nextConfig;
