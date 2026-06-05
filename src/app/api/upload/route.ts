export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isSafePath } from '@/lib/security';

const DANGEROUS_EXTENSIONS = ['exe', 'bat', 'cmd', 'php', 'js', 'sh', 'html', 'htm', 'jar', 'com', 'scr', 'vbs', 'wsf', 'dll', 'cgi', 'pl', 'py'];
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_DOC_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];
const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const isProfile = formData.get('isProfile') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    // 1. Validasi Ekstensi File
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || DANGEROUS_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: 'Format file tidak diizinkan karena alasan keamanan.' }, { status: 400 });
    }

    // 2. Sanitasi Nama File & Path (Cegah Path Traversal)
    if (!isSafePath(file.name) || !isSafePath(userId || '')) {
      return NextResponse.json({ error: 'Nama file atau User ID terdeteksi mengandung karakter berbahaya.' }, { status: 400 });
    }

    // 3. Validasi Tipe MIME & Batasan Ukuran
    const mimeType = file.type.toLowerCase();
    const fileSize = file.size;

    let isImage = ALLOWED_IMAGE_MIME.includes(mimeType) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt);
    let isDoc = ALLOWED_DOC_MIME.includes(mimeType) || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(fileExt);
    let isVideo = ALLOWED_VIDEO_MIME.includes(mimeType) || ['mp4', 'mpeg', 'mov', 'webm'].includes(fileExt);

    if (!isImage && !isDoc && !isVideo) {
      return NextResponse.json({ error: 'Format MIME file tidak didukung.' }, { status: 400 });
    }

    // Validasi Ukuran:
    // Gambar: Max 5 MB (5,242,880 Bytes)
    if (isImage && fileSize > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file gambar melebihi batas maksimum 5 MB.' }, { status: 400 });
    }
    // Dokumen: Max 10 MB (10,485,760 Bytes)
    if (isDoc && fileSize > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file dokumen melebihi batas maksimum 10 MB.' }, { status: 400 });
    }
    // Video: Max 100 MB (104,857,600 Bytes)
    if (isVideo && fileSize > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file video melebihi batas maksimum 100 MB.' }, { status: 400 });
    }

    // 4. Generate Random File Path
    const cleanUserId = (userId || 'anon').replace(/[^a-zA-Z0-9-]/g, '');
    const randomName = `${crypto.randomUUID() || Date.now()}.${fileExt}`;
    const bucketName = (formData.get('bucket') as string) || 'profiles';
    const customFileName = formData.get('customFileName') as string;
    
    const filePath = customFileName ? customFileName : (isProfile ? `avatars/${cleanUserId}/${randomName}` : `attachments/${cleanUserId}/${randomName}`);
    
    // 5. Upload ke Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true, contentType: mimeType });

    if (uploadError) throw uploadError;

    // 6. Dapatkan Public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    // 7. Perbarui profil database jika isProfile true
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    if (userId && isProfile && isUuid) {
      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);
      
      if (dbError) throw dbError;
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Secure upload error:', error);
    return NextResponse.json({ error: error.message || 'Gagal mengunggah berkas.' }, { status: 500 });
  }
}
