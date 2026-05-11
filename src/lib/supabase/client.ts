import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  // Saat build/prerender di Cloudflare, env vars belum tersedia.
  // Return dummy client yang tidak crash agar prerendering bisa selesai.
  // Di runtime (browser), env vars sudah di-inline oleh webpack.
  if (!url || !key) {
    // Gunakan placeholder URL agar @supabase/ssr tidak throw
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    )
  }
  
  return createBrowserClient(url, key)
}
