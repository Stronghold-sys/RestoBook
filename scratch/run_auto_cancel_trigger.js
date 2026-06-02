/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("MEMULAI DEPLOY TRIGGER AUTO CANCEL NOTIFICATION & REWARD CLEANUP...");
  
  const sql = `
    CREATE OR REPLACE FUNCTION public.process_auto_cancel_notification()
    RETURNS TRIGGER AS $$
    DECLARE
      v_order_num VARCHAR(50);
      v_voucher_code VARCHAR(100);
      v_redemption_id UUID;
    BEGIN
      v_order_num := upper(substring(NEW.id::text, 1, 8));
      
      IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.cancel_reason LIKE '%Batas waktu pembayaran habis%' THEN
        -- 1. Insert cancellation notification
        IF NEW.customer_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, title, message, type, is_read, reference_id, order_id, status_badge)
          VALUES (
            NEW.customer_id,
            'Pesanan Batal Otomatis',
            'No. Pesanan #' || v_order_num || ' telah dibatalkan otomatis oleh sistem karena batas waktu pembayaran habis sebelum transaksi diselesaikan.',
            'order',
            FALSE,
            NEW.id,
            NEW.id,
            'dibatalkan'
          );
        END IF;

        -- 2. Restore voucher if applicable
        IF NEW.voucher_id IS NOT NULL THEN
          -- Decrement vouchers.used_count
          UPDATE public.vouchers
          SET used_count = GREATEST(0, used_count - 1)
          WHERE id = NEW.voucher_id;

          -- Decrement customer_vouchers.used_count
          IF NEW.customer_id IS NOT NULL THEN
            UPDATE public.customer_vouchers
            SET used_count = GREATEST(0, used_count - 1)
            WHERE customer_id = NEW.customer_id AND voucher_id = NEW.voucher_id;
          END IF;

          -- Check and restore reward_redemptions
          SELECT code INTO v_voucher_code FROM public.vouchers WHERE id = NEW.voucher_id;
          IF v_voucher_code IS NOT NULL AND NEW.customer_id IS NOT NULL THEN
            SELECT id INTO v_redemption_id
            FROM public.reward_redemptions
            WHERE customer_id = NEW.customer_id AND code = v_voucher_code AND status = 'used'
            LIMIT 1;

            IF v_redemption_id IS NOT NULL THEN
              UPDATE public.reward_redemptions
              SET status = 'success', refunded_at = now(), used_at = NULL
              WHERE id = v_redemption_id;
              
              -- Log in point_transactions
              INSERT INTO public.point_transactions (customer_id, points, status, description)
              VALUES (NEW.customer_id, 0, 'refunded', 'Voucher dikembalikan: (' || v_voucher_code || ')');
            END IF;
          END IF;
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS trigger_order_auto_cancel_notification ON orders;
    CREATE TRIGGER trigger_order_auto_cancel_notification
      AFTER UPDATE ON orders
      FOR EACH ROW
      EXECUTE FUNCTION process_auto_cancel_notification();
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
