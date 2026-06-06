-- ----------------------------------------------------
-- SQL INDEXES FOR PERFORMANCE OPTIMIZATION (RestoBook)
-- ----------------------------------------------------

-- 1. Indeks pencarian nama menu makanan (mempercepat filter ILIKE pada POS/Catalog)
CREATE INDEX IF NOT EXISTS idx_menu_items_name ON public.menu_items(name);

-- 2. Indeks pengurutan pesanan berdasarkan tanggal dan status (mempercepat list order/transaksi)
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON public.orders(created_at DESC, status);

-- 3. Indeks pencarian pesanan berdasarkan customer (mempercepat riwayat per customer)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- 4. Indeks relasi audit log keamanan berdasarkan IP address (mempercepat firewall & deteksi botnet)
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_created ON public.security_logs(ip_address, created_at DESC);

-- 5. Indeks relasi transaksi poin pelanggan
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer ON public.point_transactions(customer_id, created_at DESC);