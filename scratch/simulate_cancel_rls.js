/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT * FROM (
      SELECT 
        (SELECT set_config('request.jwt.claim.sub', '73d7f1e5-fc82-44b2-8d68-f0d51009110a', true)) as jwt_sub,
        (SELECT current_setting('request.jwt.claim.sub', true)) as check_sub
    ) a
  `;
  // Let's run the simulation in a multi-statement block or single function
  const sqlBlock = `
    DO $$
    BEGIN
      -- Set configuration parameter
      PERFORM set_config('request.jwt.claim.sub', '73d7f1e5-fc82-44b2-8d68-f0d51009110a', true);
    END $$;
  `;
  // Wait, let's write a PostgreSQL function that we can run to test RLS update as the user
  const createTestFunc = `
    CREATE OR REPLACE FUNCTION public.test_user_update(user_uuid text, res_uuid uuid)
    RETURNS json AS $$
    DECLARE
      updated_rows int;
      final_status text;
      err_msg text;
    BEGIN
      -- Set configuration parameter for auth.uid()
      PERFORM set_config('request.jwt.claim.sub', user_uuid, true);
      
      -- Perform update as authenticated user role
      -- We must use EXECUTE to execute as authenticated or switch role
      -- Actually, let's execute UPDATE directly and catch exceptions
      BEGIN
        UPDATE public.reservations 
        SET status = 'cancelled' 
        WHERE id = res_uuid;
        GET DIAGNOSTICS updated_rows = ROW_COUNT;
      EXCEPTION WHEN OTHERS THEN
        err_msg := SQLERRM;
        RETURN json_build_object('success', false, 'error', err_msg);
      END;

      SELECT status INTO final_status FROM public.reservations WHERE id = res_uuid;
      
      RETURN json_build_object(
        'success', true, 
        'updated_rows', updated_rows, 
        'final_status', final_status
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  let { error: createErr } = await supabase.rpc('exec_sql', { sql_string: createTestFunc });
  if (createErr) {
    console.error("Error creating test function:", createErr);
    return;
  }

  // Now call the function
  const { data, error } = await supabase.rpc('test_user_update', {
    user_uuid: '73d7f1e5-fc82-44b2-8d68-f0d51009110a',
    res_uuid: 'd76a903d-2326-4862-9f0b-e107bab5ab80'
  });
  console.log("Simulated update result:", data, error);

  // Clean up
  await supabase.rpc('exec_sql', { sql_string: "DROP FUNCTION IF EXISTS public.test_user_update(text, uuid);" });
}
run();
