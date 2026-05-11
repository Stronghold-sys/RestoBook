import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    console.log("API ADMIN SHIFTS INVOKED! BYPASSING RLS...");

    // Eksekusi Super Join via Server (Explicitly resolving multiple relations ambiguity)
    const { data, error } = await supabase
      .from('work_shifts')
      .select(`
        *,
        work_shift_assignments(
          id, 
          profile_id, 
          profiles:profiles!work_shift_assignments_profile_id_fkey(full_name, employee_id, avatar_url)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
       console.error("Super Join Error:", error);
       throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (err: any) {
    console.error("Get All Shifts API FAILED:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message,
      data: []
    }, { status: 500 });
  }
}
