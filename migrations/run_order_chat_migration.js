// Script untuk menjalankan migration order chats ke Supabase
// Jalankan dengan: node migrations/run_order_chat_migration.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const SQL_STATEMENTS = [
  // 1. Buat tabel order_chats
  `CREATE TABLE IF NOT EXISTS order_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
    customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    cashier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('active', 'completed', 'waiting_customer', 'need_admin')) DEFAULT 'active' NOT NULL,
    is_replied_manually BOOLEAN DEFAULT false NOT NULL,
    is_blocked BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,

  // 2. Buat tabel order_chat_messages
  `CREATE TABLE IF NOT EXISTS order_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES order_chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    sender_role TEXT CHECK (sender_role IN ('customer', 'cashier', 'ai')) NOT NULL,
    message TEXT,
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,

  // 3. Aktifkan RLS
  `ALTER TABLE order_chats ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE order_chat_messages ENABLE ROW LEVEL SECURITY`,

  // 4. Policy order_chats: Pelanggan melihat chat miliknya
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chats' AND policyname='Customer can view own order chats') THEN
      CREATE POLICY "Customer can view own order chats" ON order_chats FOR SELECT
        USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
    END IF;
  END $$`,

  // 5. Policy order_chats: Pelanggan membuat chat miliknya
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chats' AND policyname='Customer can create own order chats') THEN
      CREATE POLICY "Customer can create own order chats" ON order_chats FOR INSERT
        WITH CHECK (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
    END IF;
  END $$`,

  // 6. Policy order_chats: Pelanggan memperbarui chat miliknya
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chats' AND policyname='Customer can update own order chats') THEN
      CREATE POLICY "Customer can update own order chats" ON order_chats FOR UPDATE
        USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
    END IF;
  END $$`,

  // 7. Policy order_chats: Kasir/Admin akses penuh
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chats' AND policyname='Cashier/Admin full access order chats') THEN
      CREATE POLICY "Cashier/Admin full access order chats" ON order_chats FOR ALL
        USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('cashier', 'admin')));
    END IF;
  END $$`,

  // 8. Policy order_chats: Service role akses penuh
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chats' AND policyname='Service role full access order chats') THEN
      CREATE POLICY "Service role full access order chats" ON order_chats FOR ALL
        USING (auth.role() = 'service_role');
    END IF;
  END $$`,

  // 9. Policy order_chat_messages: Pelanggan melihat pesan chat miliknya
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chat_messages' AND policyname='Customer view own order chat messages') THEN
      CREATE POLICY "Customer view own order chat messages" ON order_chat_messages FOR SELECT
        USING (chat_id IN (SELECT id FROM order_chats WHERE customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));
    END IF;
  END $$`,

  // 10. Policy order_chat_messages: Pelanggan mengirim pesan chat miliknya
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chat_messages' AND policyname='Customer insert own order chat messages') THEN
      CREATE POLICY "Customer insert own order chat messages" ON order_chat_messages FOR INSERT
        WITH CHECK (chat_id IN (SELECT id FROM order_chats WHERE customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));
    END IF;
  END $$`,

  // 11. Policy order_chat_messages: Kasir/Admin akses penuh
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chat_messages' AND policyname='Cashier/Admin full access order chat messages') THEN
      CREATE POLICY "Cashier/Admin full access order chat messages" ON order_chat_messages FOR ALL
        USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('cashier', 'admin')));
    END IF;
  END $$`,

  // 12. Policy order_chat_messages: Service role akses penuh
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='order_chat_messages' AND policyname='Service role full access order chat messages') THEN
      CREATE POLICY "Service role full access order chat messages" ON order_chat_messages FOR ALL
        USING (auth.role() = 'service_role');
    END IF;
  END $$`,

  // 13. Indeks performa
  `CREATE INDEX IF NOT EXISTS idx_order_chats_order ON order_chats(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_chats_customer ON order_chats(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_chat_messages_chat ON order_chat_messages(chat_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_chat_messages_created ON order_chat_messages(created_at)`,

  // 14. Aktifkan realtime untuk order_chats dan order_chat_messages
  `DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_chats') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_chats;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_chat_messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_chat_messages;
    END IF;
  END $$;`
];

async function runMigration() {
  console.log('='.repeat(60));
  console.log('MIGRATION: Order Chats & Chat Messages Tables');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('='.repeat(60));

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  for (let i = 0; i < SQL_STATEMENTS.length; i++) {
    const sql = SQL_STATEMENTS[i].trim();
    const preview = sql.substring(0, 75).replace(/\s+/g, ' ');
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
      if (error) {
        console.log(`[${i + 1}/${SQL_STATEMENTS.length}] SKIP/ERROR: ${preview}...`);
        console.log(`   → ${error.message}`);
      } else {
        console.log(`[${i + 1}/${SQL_STATEMENTS.length}] OK: ${preview}...`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${SQL_STATEMENTS.length}] EXCEPTION: ${preview}...`);
    }
  }

  console.log('\nVerifikasi koneksi ke tabel order_chats...');
  const { data: testChats, error: errChats } = await supabase.from('order_chats').select('id').limit(1);
  if (errChats) {
    console.error('ERROR VERIFIKASI CHAT:', errChats.message);
  } else {
    console.log('Tabel order_chats OK!');
  }

  const { data: testMsg, error: errMsg } = await supabase.from('order_chat_messages').select('id').limit(1);
  if (errMsg) {
    console.error('ERROR VERIFIKASI MESSAGES:', errMsg.message);
  } else {
    console.log('Tabel order_chat_messages OK!');
  }
  
  console.log('='.repeat(60));
  console.log('Migrasi selesai!');
}

runMigration().catch(console.error);
