import { createClient } from '@supabase/supabase-js'

// Pola Getter agar variabel environment selalu terbaca di Cloudflare Runtime
export const getSupabaseAdmin = () => {
  // Di Next.js production build, NEXT_PUBLIC_* di-inline oleh webpack saat build.
  // Untuk server-side, kita juga coba baca versi non-public sebagai fallback.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase Admin: Missing env vars. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Cloudflare Dashboard > Settings > Environment Variables.'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Untuk backward compatibility dengan kode lama yang mengimport { supabaseAdmin }
export const supabaseAdmin = new Proxy({} as any, {
  get: (target, prop) => {
    return (getSupabaseAdmin() as any)[prop];
  }
});
