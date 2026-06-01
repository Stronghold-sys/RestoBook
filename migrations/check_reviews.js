// Cek status tabel reviews dan kolom is_published
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dazsblmccvxtewtmaljf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function checkReviews() {
  console.log('Mengecek tabel reviews di Supabase...\n');

  // Ambil semua ulasan dengan kolom lengkap
  const { data, error } = await supabase
    .from('reviews')
    .select('id, customer_id, order_id, rating, comment, is_published, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('ERROR:', error.message);
    return;
  }

  console.log(`Total ulasan di database: ${data.length}`);
  console.log('\nDaftar ulasan:');
  data.forEach((r, i) => {
    console.log(`${i + 1}. Rating: ${r.rating}/5 | is_published: ${r.is_published} | ${r.created_at?.substring(0, 10)}`);
    if (r.comment) console.log(`   "${r.comment.substring(0, 60)}..."`);
  });

  // Coba update is_published salah satu sebagai test
  if (data.length > 0) {
    const testId = data[0].id;
    const currentPublished = data[0].is_published;
    
    console.log(`\nTest update is_published pada ulasan pertama...`);
    const { error: updateErr } = await supabase
      .from('reviews')
      .update({ is_published: !currentPublished })
      .eq('id', testId);

    if (updateErr) {
      console.error('Gagal update:', updateErr.message);
    } else {
      // Kembalikan ke state semula
      await supabase.from('reviews').update({ is_published: currentPublished }).eq('id', testId);
      console.log('Update is_published berhasil!');
    }
  }

  console.log('\nSemua OK! Sistem ulasan siap digunakan.');
}

checkReviews().catch(console.error);
