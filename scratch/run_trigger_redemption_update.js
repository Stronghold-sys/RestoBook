/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("MEMULAI MIGRASI TRIGGER VOUCHER TERMASUK REDEMPTION...");
  
  const sql = `
    CREATE OR REPLACE FUNCTION public.update_voucher_usage_counts()
    RETURNS TRIGGER AS $$
    DECLARE
      v_code TEXT;
      v_reward_title TEXT;
      v_redemption_id UUID;
    BEGIN
      IF NEW.voucher_id IS NOT NULL THEN
        -- Get voucher code
        SELECT code INTO v_code FROM public.vouchers WHERE id = NEW.voucher_id;

        -- 1. Increment global vouchers.used_count
        UPDATE public.vouchers
        SET used_count = used_count + 1
        WHERE id = NEW.voucher_id;

        -- 2. Upsert customer_vouchers for this customer
        IF NEW.customer_id IS NOT NULL THEN
          INSERT INTO public.customer_vouchers (customer_id, voucher_id, used_count)
          VALUES (NEW.customer_id, NEW.voucher_id, 1)
          ON CONFLICT (customer_id, voucher_id)
          DO UPDATE SET used_count = public.customer_vouchers.used_count + 1;

          -- 3. Check if this voucher belongs to a reward redemption
          SELECT rr.id, r.title INTO v_redemption_id, v_reward_title
          FROM public.reward_redemptions rr
          JOIN public.rewards r ON r.id = rr.reward_id
          WHERE rr.customer_id = NEW.customer_id AND rr.code = v_code AND rr.status = 'success'
          LIMIT 1;

          IF v_redemption_id IS NOT NULL THEN
            -- Update redemption status to used
            UPDATE public.reward_redemptions
            SET status = 'used', updated_at = now()
            WHERE id = v_redemption_id;

            -- 4. Create customer notification
            INSERT INTO public.notifications (user_id, title, message, type, reference_id, status_badge)
            VALUES (
              NEW.customer_id,
              'Voucher Reward Digunakan',
              'Voucher ' || v_reward_title || ' (' || v_code || ') telah berhasil digunakan pada pesanan Anda.',
              'point',
              NEW.id,
              'Sukses'
            );
          END IF;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS trg_order_voucher_usage ON public.orders;
    CREATE TRIGGER trg_order_voucher_usage
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_voucher_usage_counts();
  `;

  console.log("Mengirim SQL trigger...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("GAGAL RPC UTAMA:", error.message);
  } else {
     console.log("TRIGGER BERHASIL DIPERBARUI!");
  }
  
  process.exit(0);
}

run();
