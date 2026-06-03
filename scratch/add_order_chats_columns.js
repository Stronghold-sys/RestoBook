const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Adding columns to order_chats...");
  const sql = `
    ALTER TABLE order_chats ADD COLUMN IF NOT EXISTS chat_closed_at TIMESTAMPTZ;
    ALTER TABLE order_chats ADD COLUMN IF NOT EXISTS chat_history_deleted_at TIMESTAMPTZ;
    
    NOTIFY pgrst, 'reload schema';
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("RPC Error:", error.message);
  } else {
    console.log("Columns successfully added!");
  }
}
run();
