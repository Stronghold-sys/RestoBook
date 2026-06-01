/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("MEMULAI MIGRASI UPDATE FUNGSI PENUKARAN REWARD...");

  const sql = `
    -- Update redeem_reward_transaction function so it does NOT generate voucher codes or credit cashback immediately.
    -- The activation (code generation / wallet crediting) is deferred until the user clicks "Gunakan" in My Rewards.
    CREATE OR REPLACE FUNCTION public.redeem_reward_transaction(
      p_customer_id UUID,
      p_reward_id UUID
    )
    RETURNS JSON AS $$
    DECLARE
      v_user_points INT;
      v_user_points_used INT;
      v_user_blocked BOOLEAN;
      
      v_reward_title TEXT;
      v_reward_desc TEXT;
      v_reward_category TEXT;
      v_reward_min_points INT;
      v_reward_stock INT;
      v_reward_active BOOLEAN;
      v_reward_discount INT;
      v_reward_cashback NUMERIC;

      v_redemption_id UUID;
      v_new_points INT;
      
      v_admin_id UUID;
    BEGIN
      -- 1. Fetch and Lock profile
      SELECT points, points_used, is_redeem_blocked
      INTO v_user_points, v_user_points_used, v_user_blocked
      FROM profiles
      WHERE id = p_customer_id
      FOR UPDATE;

      IF v_user_blocked IS TRUE THEN
        RETURN json_build_object('success', false, 'error', 'Penukaran poin Anda sedang diblokir oleh admin.');
      END IF;

      -- 2. Fetch and Lock reward
      SELECT title, description, category, min_points, stock, is_active, discount_percent, cashback_amount
      INTO v_reward_title, v_reward_desc, v_reward_category, v_reward_min_points, v_reward_stock, v_reward_active, v_reward_discount, v_reward_cashback
      FROM rewards
      WHERE id = p_reward_id
      FOR UPDATE;

      IF v_reward_active IS NOT TRUE THEN
        RETURN json_build_object('success', false, 'error', 'Reward ini sedang tidak aktif.');
      END IF;

      IF v_reward_stock IS NOT NULL AND v_reward_stock <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Stok reward ini telah habis.');
      END IF;

      IF v_user_points < v_reward_min_points THEN
        -- Insert failed redeem notification
        INSERT INTO notifications (user_id, title, message, type, reference_id, points, status_badge)
        VALUES (
          p_customer_id,
          'Point Tidak Cukup',
          'Point kamu belum cukup untuk menukar ' || v_reward_title || '. Kurang ' || (v_reward_min_points - v_user_points) || ' point lagi.',
          'point',
          p_reward_id,
          v_reward_min_points, -- min points required
          'Gagal Redeem'
        );
        RETURN json_build_object('success', false, 'error', 'Poin Anda tidak mencukupi.');
      END IF;

      -- 3. Perform point deduction in profiles
      v_new_points := v_user_points - v_reward_min_points;
      UPDATE profiles
      SET points = v_new_points,
          points_used = COALESCE(points_used, 0) + v_reward_min_points
      WHERE id = p_customer_id;

      -- 4. Deduct reward stock
      IF v_reward_stock IS NOT NULL THEN
        UPDATE rewards
        SET stock = v_reward_stock - 1
        WHERE id = p_reward_id;
        v_reward_stock := v_reward_stock - 1;
      END IF;

      -- 5. Create point transaction log
      INSERT INTO point_transactions (customer_id, points, status, description)
      VALUES (p_customer_id, -v_reward_min_points, 'redeemed', 'Tukar reward: ' || v_reward_title);

      -- 6. Create redemption log with status 'success' and code NULL/empty.
      -- The voucher code is generated when clicking "Gunakan" in My Rewards.
      INSERT INTO reward_redemptions (customer_id, reward_id, points_spent, status, code, cashback_amount)
      VALUES (
        p_customer_id, 
        p_reward_id, 
        v_reward_min_points, 
        'success', 
        NULL,
        CASE WHEN v_reward_category = 'cashback' THEN v_reward_cashback ELSE NULL END
      )
      RETURNING id INTO v_redemption_id;

      -- 7. Customer Notification
      INSERT INTO notifications (user_id, title, message, type, reference_id, points, status_badge)
      VALUES (
        p_customer_id, 
        'Reward Berhasil Ditukar', 
        'Kamu berhasil menukar ' || v_reward_min_points || ' point untuk ' || v_reward_title || '. Silakan aktifkan di menu Reward Saya.',
        'point',
        v_redemption_id,
        -v_reward_min_points,
        'Redeem Berhasil'
      );

      -- 8. Admin Notifications
      FOR v_admin_id IN SELECT id FROM profiles WHERE role = 'admin' LOOP
        -- Redeemed notification
        INSERT INTO notifications (user_id, title, message, type, reference_id)
        VALUES (
          v_admin_id,
          'Redeem Baru',
          'Seorang pelanggan menukarkan reward: ' || v_reward_title,
          'admin_reward',
          v_redemption_id
        );

        -- Stock out notification
        IF v_reward_stock = 0 THEN
          INSERT INTO notifications (user_id, title, message, type, reference_id)
          VALUES (
            v_admin_id,
            'Stok Reward Habis',
            'Perhatian! Stok reward "' || v_reward_title || '" telah habis.',
            'admin_stock',
            p_reward_id
          );
        END IF;
      END LOOP;

      RETURN json_build_object(
        'success', true, 
        'code', '', 
        'new_points', v_new_points,
        'redemption_id', v_redemption_id
      );
    END;
    $$ LANGUAGE plpgsql;
  `;

  console.log("Mengirim SQL migrasi ke Supabase...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migrasi Gagal:", error.message);
    process.exit(1);
  }
  console.log("Migrasi fungsi penukaran reward selesai dengan sukses!");
  process.exit(0);
}

run();
