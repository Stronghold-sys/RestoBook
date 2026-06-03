/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("MEMULAI MIGRASI FITUR PENGADUAN, CHAT & TIKET...");

  const sql = `
    -- 1. Create support_settings table
    CREATE TABLE IF NOT EXISTS public.support_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_expiry_hours INT DEFAULT 0,
      chat_expiry_minutes INT DEFAULT 30,
      chat_expiry_seconds INT DEFAULT 0,
      sla_hours_low INT DEFAULT 48,
      sla_hours_medium INT DEFAULT 24,
      sla_hours_high INT DEFAULT 12,
      sla_hours_urgent INT DEFAULT 4,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Insert default support settings if not exists
    INSERT INTO public.support_settings (id, chat_expiry_hours, chat_expiry_minutes, chat_expiry_seconds)
    VALUES ('77777777-7777-7777-7777-777777777777', 0, 30, 0)
    ON CONFLICT DO NOTHING;

    -- 2. Create support_tickets table
    CREATE TABLE IF NOT EXISTS public.support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_number VARCHAR(50) UNIQUE NOT NULL,
      customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      description TEXT NOT NULL,
      attachment_url TEXT,
      urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      contact_info VARCHAR(100),
      status VARCHAR(50) CHECK (status IN ('pending', 'processing', 'waiting_info', 'completed', 'closed', 'expired')) DEFAULT 'pending',
      sla_deadline TIMESTAMPTZ,
      source VARCHAR(20) CHECK (source IN ('manual', 'ai')) DEFAULT 'manual',
      assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      chat_started_at TIMESTAMPTZ,
      chat_closed_at TIMESTAMPTZ,
      chat_history_deleted_at TIMESTAMPTZ
    );

    -- 3. Create ticket_messages table
    CREATE TABLE IF NOT EXISTS public.ticket_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
      sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      attachment_url TEXT,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

    -- Policies
    DROP POLICY IF EXISTS "Anyone can view support settings" ON public.support_settings;
    CREATE POLICY "Anyone can view support settings" ON public.support_settings
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admins full access support settings" ON public.support_settings;
    CREATE POLICY "Admins full access support settings" ON public.support_settings
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Customers can manage own tickets" ON public.support_tickets;
    CREATE POLICY "Customers can manage own tickets" ON public.support_tickets
      FOR ALL USING (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "Admins full access tickets" ON public.support_tickets;
    CREATE POLICY "Admins full access tickets" ON public.support_tickets
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Users can manage messages of own tickets" ON public.ticket_messages;
    CREATE POLICY "Users can manage messages of own tickets" ON public.ticket_messages
      FOR ALL USING (
        ticket_id IN (SELECT id FROM public.support_tickets WHERE customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
      );

    DROP POLICY IF EXISTS "Admins full access messages" ON public.ticket_messages;
    CREATE POLICY "Admins full access messages" ON public.ticket_messages
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

    -- Realtime setup
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'support_settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE support_settings;
      END IF;
    END $$;

    NOTIFY pgrst, 'reload schema';
  `;

  console.log("Mengirim SQL migrasi...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migrasi Gagal:", error.message);
    process.exit(1);
  }
  console.log("Migrasi Fitur Pengaduan & Live Chat Sukses!");
  process.exit(0);
}

run();
