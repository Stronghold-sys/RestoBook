/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("MEMULAI PEMBARUAN TRIGGER VOUCHER (INSERT & UPDATE)...");
  
  const sql = `
    CREATE OR REPLACE FUNCTION public.update_voucher_usage_counts()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Handle Insert
      IF TG_OP = 'INSERT' THEN
        IF NEW.voucher_id IS NOT NULL THEN
          -- 1. Increment global vouchers.used_count
          UPDATE public.vouchers
          SET used_count = used_count + 1
          WHERE id = NEW.voucher_id;

          -- 2. Upsert customer_vouchers
          IF NEW.customer_id IS NOT NULL THEN
            INSERT INTO public.customer_vouchers (customer_id, voucher_id, used_count)
            VALUES (NEW.customer_id, NEW.voucher_id, 1)
            ON CONFLICT (customer_id, voucher_id)
            DO UPDATE SET used_count = public.customer_vouchers.used_count + 1;
          END IF;
        END IF;
      
      -- Handle Update
      ELSIF TG_OP = 'UPDATE' THEN
        -- Hanya terpicu jika voucher_id berubah dan sekarang bernilai tidak null
        IF (OLD.voucher_id IS NULL OR OLD.voucher_id != NEW.voucher_id) AND NEW.voucher_id IS NOT NULL THEN
          -- 1. Increment global vouchers.used_count
          UPDATE public.vouchers
          SET used_count = used_count + 1
          WHERE id = NEW.voucher_id;

          -- 2. Upsert customer_vouchers
          IF NEW.customer_id IS NOT NULL THEN
            INSERT INTO public.customer_vouchers (customer_id, voucher_id, used_count)
            VALUES (NEW.customer_id, NEW.voucher_id, 1)
            ON CONFLICT (customer_id, voucher_id)
            DO UPDATE SET used_count = public.customer_vouchers.used_count + 1;
          END IF;
          
          -- 3. Jika sebelumnya ada voucher lain, kurangi jumlah pemakaiannya
          IF OLD.voucher_id IS NOT NULL THEN
            UPDATE public.vouchers
            SET used_count = GREATEST(0, used_count - 1)
            WHERE id = OLD.voucher_id;
            
            IF OLD.customer_id IS NOT NULL THEN
              UPDATE public.customer_vouchers
              SET used_count = GREATEST(0, used_count - 1)
              WHERE customer_id = OLD.customer_id AND voucher_id = OLD.voucher_id;
            END IF;
          END IF;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS trg_order_voucher_usage ON public.orders;
    CREATE TRIGGER trg_order_voucher_usage
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_voucher_usage_counts();
  `;

  console.log("Mengirim SQL trigger...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("GAGAL RPC UTAMA:", error.message);
     console.log("Mencoba Jalur Alternatif (exec_sql_block)...");
     const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("Semuanya Gagal:", err2.message);
     } else {
        console.log("TRIGGER BERHASIL DIPERBARUI MELALUI JALUR ALTERNATIF!");
     }
  } else {
     console.log("TRIGGER BERHASIL DIPERBARUI MELALUI RPC UTAMA!");
  }
  
  process.exit(0);
}

run();
