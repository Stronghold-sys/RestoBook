-- ============================================================
-- MIGRATION LENGKAP: Tabel reviews + kolom is_published
-- Project Supabase RestoBook: dazsblmccvxtewtmaljf
--
-- CARA MENJALANKAN:
-- 1. Buka https://supabase.com/dashboard
-- 2. Pilih project "dazsblmccvxtewtmaljf" (bukan projekt lain)
-- 3. Klik SQL Editor di sidebar kiri
-- 4. Paste seluruh isi file ini, lalu klik Run
-- ============================================================

-- ── LANGKAH 1: Buat tabel reviews jika belum ada ─────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  rating      INT  CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment     TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── LANGKAH 2: Tambah kolom is_published jika tabel sudah ada ─
-- (Aman dijalankan berulang kali - IF NOT EXISTS)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- ── LANGKAH 3: Aktifkan Realtime untuk tabel reviews ──────────
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;

-- ── LANGKAH 4: Aktifkan Row Level Security ────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ── LANGKAH 5: RLS Policies ───────────────────────────────────

-- Siapapun bisa melihat ulasan yang sudah dipublish
DROP POLICY IF EXISTS "Anyone can view published reviews" ON reviews;
CREATE POLICY "Anyone can view published reviews"
  ON reviews FOR SELECT
  USING (is_published = true);

-- Pelanggan bisa membuat ulasan untuk pesanannya sendiri
DROP POLICY IF EXISTS "Customer create own review" ON reviews;
CREATE POLICY "Customer create own review"
  ON reviews FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Pelanggan bisa melihat ulasan miliknya sendiri (termasuk yang belum publish)
DROP POLICY IF EXISTS "Customer view own reviews" ON reviews;
CREATE POLICY "Customer view own reviews"
  ON reviews FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin bisa melihat semua ulasan
DROP POLICY IF EXISTS "Admin view all reviews" ON reviews;
CREATE POLICY "Admin view all reviews"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin bisa mengubah status publish ulasan
DROP POLICY IF EXISTS "Admin update reviews publish status" ON reviews;
CREATE POLICY "Admin update reviews publish status"
  ON reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'cashier')
    )
  );

-- Service role punya akses penuh (untuk API backend)
DROP POLICY IF EXISTS "Service role full access reviews" ON reviews;
CREATE POLICY "Service role full access reviews"
  ON reviews
  USING (auth.role() = 'service_role');

-- ── LANGKAH 6: Indeks untuk performa ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(is_published);

-- ── VERIFIKASI: Lihat struktur tabel ─────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
ORDER BY ordinal_position;
