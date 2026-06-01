import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const isProfile = formData.get('isProfile') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId || 'anon'}/${Date.now()}.${fileExt}`;
    const bucketName = formData.get('bucket') as string || 'profiles';
    const customFileName = formData.get('customFileName') as string;
    
    const filePath = customFileName ? customFileName : (isProfile ? `avatars/${fileName}` : `attachments/${fileName}`);
    
    // 1. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    // 3. Update database ONLY if it is a profile photo update
    if (userId && isProfile) {
      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);
      
      if (dbError) throw dbError;
    }
 return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
