import { createClient } from '@supabase/supabase-js'

// Pola Getter agar variabel environment selalu terbaca di Cloudflare Runtime
export const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase Admin keys are missing in runtime!')
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
