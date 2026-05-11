import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // MENGGUNAKAN SERVICE ROLE KEY (MATA SUPER BYPASS RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    // DUMP THE RAW RESPONSE TO A LOG FILE IMMEDIATELY
    try {
       fs.writeFileSync(path.join(process.cwd(), 'DEBUG_GET_ALL_SHIFTS.log'), JSON.stringify({
          status: 'fetched',
          timestamp: new Date().toISOString(),
          count: data?.length || 0,
          error: error || null,
          first_item: data?.[0] || null
       }, null, 2));
    } catch(e) {}

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
