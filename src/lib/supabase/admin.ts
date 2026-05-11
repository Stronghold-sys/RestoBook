import { createClient } from '@supabase/supabase-js'

// Pola Getter agar variabel environment selalu terbaca di runtime
export const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Saat prerender/build di Cloudflare, env vars belum tersedia.
  // Gunakan placeholder agar tidak crash. Prerender tidak memanggil API.
  const finalUrl = url || 'https://placeholder.supabase.co'
  const finalKey = key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

  return createClient(finalUrl, finalKey, {
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
