import { createClient } from '@supabase/supabase-js';

// Idempotent client initializer that works in both server (Edge/Node) and client contexts
const getSupabase = () => {
  const isServer = typeof window === 'undefined';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = isServer 
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  return createClient(url, key);
};

export async function createAuditLog(action: string, details: any = {}) {
  try {
    const supabase = getSupabase();
    
    // Attempt to resolve current session user
    let userId: string | null = null;
    let profileId: string | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        profileId = profile?.id || null;
      }
    } catch (authErr) {
      // Session parsing may fail on clean public environments, ignore
    }

    const logPayload = {
      user_id: userId,
      profile_id: profileId,
      action,
      details,
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server'
    };

    const { error } = await supabase.from('audit_logs').insert(logPayload);
    if (error) {
      console.error('[AuditLog] Supabase write error:', error.message);
    }
  } catch (err: any) {
    console.error('[AuditLog] Failed to log action:', err.message || err);
  }
}
