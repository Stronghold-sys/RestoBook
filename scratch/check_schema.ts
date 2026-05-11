import { supabaseAdmin } from './src/lib/supabase/admin';

async function checkSchema() {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { 
    sql_string: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';" 
  });
  
  if (error) {
    console.error("Error checking schema:", error);
  } else {
    console.log("Columns in 'profiles' table:", data);
  }
}

checkSchema();
