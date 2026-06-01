/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Applying RLS fixes for reservations table...");
  const sql = `
    ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
    
    -- Policy for Customer to update (cancel) their own reservations
    DROP POLICY IF EXISTS "Customer update own reservations" ON public.reservations;
    CREATE POLICY "Customer update own reservations" ON public.reservations FOR UPDATE TO authenticated 
      USING (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) 
      WITH CHECK (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
      
    -- Policy for Admin to manage all reservations
    DROP POLICY IF EXISTS "Admin manage reservations" ON public.reservations;
    CREATE POLICY "Admin manage reservations" ON public.reservations FOR ALL TO authenticated 
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')) 
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

    NOTIFY pgrst, 'reload schema';
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("exec_sql failed, trying exec_sql_block:", error.message);
    const { error: error2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
    if (error2) {
      console.error("All RPCs failed:", error2.message);
    } else {
      console.log("RLS policy applied successfully via exec_sql_block.");
    }
  } else {
    console.log("RLS policy applied successfully via exec_sql.");
  }
}
run();
