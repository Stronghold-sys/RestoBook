// Script untuk menjalankan migration reviews ke Supabase
// Jalankan dengan: node migrations/run_reviews_migration.js

const https = require('https');

const SUPABASE_URL = 'https://dazsblmccvxtewtmaljf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';

// SQL statements yang akan dijalankan urut
const SQL_STATEMENTS = [
  // 1. Buat tabel reviews (jika belum ada)
  `CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  // 2. Tambah kolom is_published (aman dijalankan berulang)
  `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false`,

  // 3. Aktifkan RLS
  `ALTER TABLE reviews ENABLE ROW LEVEL SECURITY`,

  // 4. Policy: siapapun bisa lihat yang published
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Anyone can view published reviews') THEN
      CREATE POLICY "Anyone can view published reviews" ON reviews FOR SELECT USING (is_published = true);
    END IF;
  END $$`,

  // 5. Policy: pelanggan bisa insert ulasan sendiri
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Customer create own review') THEN
      CREATE POLICY "Customer create own review" ON reviews FOR INSERT
        WITH CHECK (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
    END IF;
  END $$`,

  // 6. Policy: pelanggan bisa lihat ulasan sendiri
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Customer view own reviews') THEN
      CREATE POLICY "Customer view own reviews" ON reviews FOR SELECT
        USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
    END IF;
  END $$`,

  // 7. Policy: admin lihat semua ulasan
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Admin view all reviews') THEN
      CREATE POLICY "Admin view all reviews" ON reviews FOR SELECT
        USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
    END IF;
  END $$`,

  // 8. Policy: admin bisa update status publish
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Admin update reviews publish status') THEN
      CREATE POLICY "Admin update reviews publish status" ON reviews FOR UPDATE
        USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin','cashier')));
    END IF;
  END $$`,

  // 9. Service role akses penuh
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='Service role full access reviews') THEN
      CREATE POLICY "Service role full access reviews" ON reviews USING (auth.role() = 'service_role');
    END IF;
  END $$`,

  // 10. Indeks performa
  `CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(is_published)`,

  // 11. Aktifkan realtime
  `ALTER PUBLICATION supabase_realtime ADD TABLE reviews`,
];

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);

    // Gunakan endpoint SQL langsung via REST API (Supabase Management API)
    const pgUrl = new URL('/pg/query', SUPABASE_URL);
    
    const options = {
      hostname: 'dazsblmccvxtewtmaljf.supabase.co',
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, data });
        } else {
          resolve({ ok: false, error: data, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Gunakan Supabase JS Client dengan raw SQL via rpc
async function runMigration() {
  console.log('='.repeat(60));
  console.log('MIGRATION: Reviews Table + is_published Column');
  console.log('Target: dazsblmccvxtewtmaljf.supabase.co');
  console.log('='.repeat(60));

  // Import supabase client
  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    console.error('Supabase client tidak tersedia. Install dengan: npm install @supabase/supabase-js');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  for (let i = 0; i < SQL_STATEMENTS.length; i++) {
    const sql = SQL_STATEMENTS[i].trim();
    const preview = sql.substring(0, 70).replace(/\s+/g, ' ');
    
    try {
      // Gunakan exec_sql jika tersedia, atau coba query langsung
      const { data, error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        // Coba via from() untuk statement SELECT
        if (sql.toUpperCase().startsWith('SELECT')) {
          const { data: d2, error: e2 } = await supabase.from('reviews').select('id').limit(1);
          if (e2) {
            console.log(`[${i + 1}/${SQL_STATEMENTS.length}] SKIP: ${preview}...`);
            console.log(`   → ${e2.message}`);
          } else {
            console.log(`[${i + 1}/${SQL_STATEMENTS.length}] OK (select): Tabel reviews ada`);
          }
        } else {
          console.log(`[${i + 1}/${SQL_STATEMENTS.length}] SKIP: ${preview}...`);
          if (error.message && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.log(`   → Error: ${error.message}`);
          }
        }
      } else {
        console.log(`[${i + 1}/${SQL_STATEMENTS.length}] OK: ${preview}...`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${SQL_STATEMENTS.length}] SKIP: ${preview}...`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Verifikasi koneksi ke tabel reviews...');
  
  const { data, error } = await supabase.from('reviews').select('id, customer_id, rating, is_published, created_at').limit(5);
  
  if (error) {
    console.error('ERROR:', error.message);
    console.log('\n⚠️  Tabel reviews mungkin belum ada di project ini.');
    console.log('Jalankan SQL manual di Supabase SQL Editor project:');
    console.log('dazsblmccvxtewtmaljf');
  } else {
    console.log('Tabel reviews OK!');
    console.log(`Jumlah ulasan: ${data.length}`);
    console.log('Kolom tersedia:', data.length > 0 ? Object.keys(data[0]).join(', ') : 'id, customer_id, rating, is_published, created_at');
    console.log('\nMigration selesai!');
  }
}

runMigration().catch(console.error);
