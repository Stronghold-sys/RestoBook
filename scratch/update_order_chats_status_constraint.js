const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Updating order_chats check constraint...");
  const sql = `
    ALTER TABLE order_chats DROP CONSTRAINT IF EXISTS order_chats_status_check;
    ALTER TABLE order_chats ADD CONSTRAINT order_chats_status_check CHECK (status IN ('active', 'completed', 'waiting_customer', 'need_admin', 'expired'));
    
    NOTIFY pgrst, 'reload schema';
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("RPC Error:", error.message);
  } else {
    console.log("Check constraint successfully updated!");
  }
}
run();
