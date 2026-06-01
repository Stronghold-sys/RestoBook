/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    CREATE OR REPLACE FUNCTION process_order_points_change()
    RETURNS TRIGGER AS $$
    DECLARE
      v_min_points INT;
      v_max_points INT;
      v_multiplier INT;
      v_points_earned INT;
      v_is_enabled BOOLEAN;
      v_trans_id UUID;
      v_points_to_transfer INT;
      v_order_num VARCHAR(50);
    BEGIN
      -- Get settings
      SELECT is_points_enabled, min_random_points, max_random_points, multiplier
      INTO v_is_enabled, v_min_points, v_max_points, v_multiplier
      FROM restaurant_settings
      LIMIT 1;

      IF v_is_enabled IS NOT TRUE THEN
        RETURN NEW;
      END IF;

      -- Default values if null
      IF v_min_points IS NULL THEN v_min_points := 10; END IF;
      IF v_max_points IS NULL THEN v_max_points := 100; END IF;
      IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

      v_order_num := upper(substring(NEW.id::text, 1, 8));

      -- 1. Order created (INSERT)
      IF (TG_OP = 'INSERT') THEN
        IF NEW.customer_id IS NOT NULL THEN
          -- Generate random points
          v_points_earned := floor(random() * (v_max_points - v_min_points + 1) + v_min_points)::int * v_multiplier;
          
          -- Insert pending transaction
          INSERT INTO point_transactions (customer_id, order_id, points, status, description)
          VALUES (NEW.customer_id, NEW.id, v_points_earned, 'pending', 'Pending point dari order #' || v_order_num)
          RETURNING id INTO v_trans_id;

          -- Update profiles pending_points
          UPDATE profiles
          SET pending_points = pending_points + v_points_earned
          WHERE id = NEW.customer_id;

          -- Insert Notification: Point Ditahan
          INSERT INTO notifications (user_id, title, message, type, is_read, reference_id, points, order_id, status_badge)
          VALUES (
            NEW.customer_id,
            'Reward Point Ditahan',
            'Point sejumlah +' || v_points_earned || ' sedang ditahan sementara dan akan masuk ke akun setelah pesanan selesai.',
            'point',
            FALSE,
            NEW.id,
            v_points_earned,
            NEW.id,
            'Pending'
          );
        END IF;

      -- 2. Order status updated (UPDATE)
      ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.customer_id IS NOT NULL THEN
          -- A. Status changed to completed
          IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
            -- Find pending transaction
            SELECT id, points INTO v_trans_id, v_points_to_transfer
            FROM point_transactions
            WHERE order_id = NEW.id AND status = 'pending'
            LIMIT 1;

            IF v_trans_id IS NOT NULL THEN
              -- Update transaction to earned
              UPDATE point_transactions
              SET status = 'earned', description = 'Poin berhasil masuk dari order selesai #' || v_order_num
              WHERE id = v_trans_id;

              -- Shift points from pending_points to points in profiles
              UPDATE profiles
              SET points = points + v_points_to_transfer,
                  pending_points = greatest(0, pending_points - v_points_to_transfer)
              WHERE id = NEW.customer_id;

              -- Insert Notification: Point Berhasil Ditambahkan
              INSERT INTO notifications (user_id, title, message, type, is_read, reference_id, points, order_id, status_badge)
              VALUES (
                NEW.customer_id,
                'Reward Point Berhasil Ditambahkan',
                'Point sejumlah +' || v_points_to_transfer || ' berhasil ditambahkan ke akun kamu dari pesanan #' || v_order_num || '.',
                'point',
                FALSE,
                NEW.id,
                v_points_to_transfer,
                NEW.id,
                'Berhasil'
              );
            END IF;

          -- B. Status changed to cancelled
          ELSIF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
            -- Find pending transaction
            SELECT id, points INTO v_trans_id, v_points_to_transfer
            FROM point_transactions
            WHERE order_id = NEW.id AND status = 'pending'
            LIMIT 1;

            IF v_trans_id IS NOT NULL THEN
              -- Update transaction to cancelled
              UPDATE point_transactions
              SET status = 'cancelled', description = 'Poin dibatalkan karena order dibatalkan'
              WHERE id = v_trans_id;

              -- Deduct from pending_points in profiles
              UPDATE profiles
              SET pending_points = greatest(0, pending_points - v_points_to_transfer)
              WHERE id = NEW.customer_id;

              -- Insert Notification: Point Dibatalkan
              INSERT INTO notifications (user_id, title, message, type, is_read, reference_id, points, order_id, status_badge)
              VALUES (
                NEW.customer_id,
                'Reward Point Dibatalkan',
                'Point dari pesanan #' || v_order_num || ' dibatalkan karena pesanan tidak selesai.',
                'point',
                FALSE,
                NEW.id,
                v_points_to_transfer,
                NEW.id,
                'Dibatalkan'
              );
            END IF;
          END IF;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Create triggers
    DROP TRIGGER IF EXISTS trigger_order_points_insert ON orders;
    CREATE TRIGGER trigger_order_points_insert
      AFTER INSERT ON orders
      FOR EACH ROW
      EXECUTE FUNCTION process_order_points_change();

    DROP TRIGGER IF EXISTS trigger_order_points_update ON orders;
    CREATE TRIGGER trigger_order_points_update
      AFTER UPDATE ON orders
      FOR EACH ROW
      EXECUTE FUNCTION process_order_points_change();
  `;

  console.log("Creating database triggers for order points...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Failed to create triggers:", error);
    return;
  }
  console.log("Order points triggers created successfully!");
}

run();
