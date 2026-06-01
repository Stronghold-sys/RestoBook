import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data: constraints, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_string: `
        SELECT
            conname AS constraint_name,
            pg_get_constraintdef(c.oid) AS constraint_definition
        FROM
            pg_constraint c
        JOIN
            pg_namespace n ON n.oid = c.connamespace
        WHERE
            conrelid = 'public.orders'::regclass;
      `
    });

    return NextResponse.json({
      success: true,
      constraints,
      error
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
