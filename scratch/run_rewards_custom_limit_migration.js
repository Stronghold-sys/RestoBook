/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("MEMULAI MIGRASI BATAS PENUKARAN KUSTOM & KADALUARSA REWARD...");

  const sql = `
    -- 1. Tambahkan kolom redeem_limit_value dan expires_at ke tabel rewards
    ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS redeem_limit_value INT DEFAULT 1;
    ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

    -- 2. Update check constraint untuk redeem_limit_period agar mendukung 'minute'
    ALTER TABLE public.rewards DROP CONSTRAINT IF EXISTS chk_redeem_limit_period;
    ALTER TABLE public.rewards ADD CONSTRAINT chk_redeem_limit_period CHECK (redeem_limit_period IN ('minute', 'hour', 'day', 'week', 'month', 'all'));

    -- 3. Update dan re-create fungsi redeem_reward_transaction
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
      v_reward_expiry_days INT;
      
      -- New limit fields
      v_redeem_limit INT;
      v_redeem_limit_value INT;
      v_redeem_limit_period TEXT;
      v_current_redemptions INT;
      v_period_lbl TEXT;

      v_redemption_id UUID;
      v_new_points INT;
      v_expires_at TIMESTAMP WITH TIME ZONE;
      
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
      SELECT title, description, category, min_points, stock, is_active, discount_percent, cashback_amount, expiry_days, redeem_limit, redeem_limit_value, redeem_limit_period
      INTO v_reward_title, v_reward_desc, v_reward_category, v_reward_min_points, v_reward_stock, v_reward_active, v_reward_discount, v_reward_cashback, v_reward_expiry_days, v_redeem_limit, v_redeem_limit_value, v_redeem_limit_period
      FROM rewards
      WHERE id = p_reward_id
      FOR UPDATE;

      IF v_reward_active IS NOT TRUE THEN
        RETURN json_build_object('success', false, 'error', 'Reward ini sedang tidak aktif.');
      END IF;

      IF v_reward_stock IS NOT NULL AND v_reward_stock <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Stok reward ini telah habis.');
      END IF;

      -- 2.5 Check customer redemption limit
      IF v_redeem_limit IS NOT NULL AND v_redeem_limit > 0 THEN
        SELECT COUNT(*)
        INTO v_current_redemptions
        FROM reward_redemptions
        WHERE customer_id = p_customer_id
          AND reward_id = p_reward_id
          AND status != 'cancelled'
          AND (
            v_redeem_limit_period = 'all'
            OR (v_redeem_limit_period = 'minute' AND created_at >= NOW() - (v_redeem_limit_value * INTERVAL '1 minute'))
            OR (v_redeem_limit_period = 'hour' AND created_at >= NOW() - (v_redeem_limit_value * INTERVAL '1 hour'))
            OR (v_redeem_limit_period = 'day' AND created_at >= NOW() - (v_redeem_limit_value * INTERVAL '1 day'))
            OR (v_redeem_limit_period = 'week' AND created_at >= NOW() - (v_redeem_limit_value * INTERVAL '1 week'))
            OR (v_redeem_limit_period = 'month' AND created_at >= NOW() - (v_redeem_limit_value * INTERVAL '1 month'))
          );

        IF v_current_redemptions >= v_redeem_limit THEN
          IF v_redeem_limit_period = 'minute' THEN v_period_lbl := 'menit';
          ELSIF v_redeem_limit_period = 'hour' THEN v_period_lbl := 'jam';
          ELSIF v_redeem_limit_period = 'day' THEN v_period_lbl := 'hari';
          ELSIF v_redeem_limit_period = 'week' THEN v_period_lbl := 'minggu';
          ELSIF v_redeem_limit_period = 'month' THEN v_period_lbl := 'bulan';
          ELSE v_period_lbl := 'selamanya';
          END IF;
          
          IF v_redeem_limit_period = 'all' THEN
            RETURN json_build_object('success', false, 'error', 'Batas penukaran telah tercapai. Reward ini tidak dapat ditukarkan lagi.');
          ELSE
            RETURN json_build_object('success', false, 'error', 'Batas penukaran telah tercapai. Penukaran dapat dilakukan kembali dalam ' || v_redeem_limit_value || ' ' || v_period_lbl || ' berikutnya.');
          END IF;
        END IF;
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

      -- Calculate expires_at dynamically
      IF v_reward_expiry_days IS NOT NULL AND v_reward_expiry_days > 0 THEN
        v_expires_at := NOW() + (v_reward_expiry_days * INTERVAL '1 day');
      ELSE
        v_expires_at := NULL;
      END IF;

      -- 6. Create redemption log with expires_at stored
      INSERT INTO reward_redemptions (customer_id, reward_id, points_spent, status, code, cashback_amount, expires_at)
      VALUES (
        p_customer_id, 
        p_reward_id, 
        v_reward_min_points, 
        'success', 
        NULL,
        CASE WHEN v_reward_category = 'cashback' THEN v_reward_cashback ELSE NULL END,
        v_expires_at
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
  console.log("Migrasi batas penukaran kustom selesai dengan sukses!");
  process.exit(0);
}

run();
