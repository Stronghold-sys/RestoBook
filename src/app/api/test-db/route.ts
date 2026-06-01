export const runtime = 'edge';
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("restaurant_settings").select("favicon_url").limit(1);
  return NextResponse.json({ data, error });
}
