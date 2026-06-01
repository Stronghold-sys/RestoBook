-- ============================================================
-- MIGRATION: Tambah kolom is_published ke tabel reviews
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambahkan kolom is_published (default false = ulasan baru belum ditayangkan)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- 2. Tambahkan kolom deleted_at untuk soft delete (opsional)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Pastikan tabel reviews ada di realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;

-- 4. Update RLS: admin bisa update is_published
CREATE POLICY IF NOT EXISTS "Admin update reviews publish status"
  ON reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'cashier')
    )
  );

-- 5. Verifikasi struktur tabel
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'reviews'
ORDER BY ordinal_position;
