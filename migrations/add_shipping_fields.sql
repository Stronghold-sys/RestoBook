-- Alter orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS distance_km NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_discount NUMERIC DEFAULT 0;

-- Alter restaurant_settings table
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS resto_latitude DOUBLE PRECISION DEFAULT -7.7829;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS resto_longitude DOUBLE PRECISION DEFAULT 110.3323;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS shipping_rate_per_km NUMERIC DEFAULT 2500;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS min_shipping_distance NUMERIC DEFAULT 1;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS max_shipping_distance NUMERIC DEFAULT 15;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS additional_zone_charge NUMERIC DEFAULT 0;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS min_order_for_free_shipping NUMERIC DEFAULT 100000;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS is_shipping_enabled BOOLEAN DEFAULT true;

-- Alter vouchers table
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS voucher_type TEXT DEFAULT 'general'; -- 'general', 'shipping'
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent'; -- 'percent', 'nominal'
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS min_transaction NUMERIC DEFAULT 0;

-- Set up trigger to automatically increment used_count when payment_status changes to 'paid'
CREATE OR REPLACE FUNCTION increment_voucher_used_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status = 'unpaid') AND NEW.voucher_id IS NOT NULL THEN
    -- Increment global vouchers used_count
    UPDATE public.vouchers 
    SET used_count = used_count + 1 
    WHERE id = NEW.voucher_id;
    
    -- Increment customer_vouchers used_count
    INSERT INTO public.customer_vouchers (customer_id, voucher_id, used_count)
    VALUES (NEW.customer_id, NEW.voucher_id, 1)
    ON CONFLICT (customer_id, voucher_id)
    DO UPDATE SET used_count = customer_vouchers.used_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_voucher_used_count ON public.orders;
CREATE TRIGGER trg_increment_voucher_used_count
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION increment_voucher_used_count();

-- Let's make sure it handles inserts where payment_status starts as paid
CREATE OR REPLACE FUNCTION increment_voucher_used_count_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND NEW.voucher_id IS NOT NULL THEN
    -- Increment global vouchers used_count
    UPDATE public.vouchers 
    SET used_count = used_count + 1 
    WHERE id = NEW.voucher_id;
    
    -- Increment customer_vouchers used_count
    INSERT INTO public.customer_vouchers (customer_id, voucher_id, used_count)
    VALUES (NEW.customer_id, NEW.voucher_id, 1)
    ON CONFLICT (customer_id, voucher_id)
    DO UPDATE SET used_count = customer_vouchers.used_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_voucher_used_count_on_insert ON public.orders;
CREATE TRIGGER trg_increment_voucher_used_count_on_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION increment_voucher_used_count_on_insert();

-- Make sure all tables are in publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_settings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vouchers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vouchers;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
