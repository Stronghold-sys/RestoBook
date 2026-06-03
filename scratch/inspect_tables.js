const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function inspect() {
  console.log("Inspecting database tables...");
  
  try {
    const { data: rowProfile, error: err2 } = await supabase.from('profiles').select('*').limit(1);
    console.log("Profiles columns:", rowProfile && rowProfile.length > 0 ? Object.keys(rowProfile[0] || {}) : "No profiles rows found");
  } catch (e) {
    console.error("Err profiles:", e);
  }

  try {
    const { data: rowTicket, error: err3 } = await supabase.from('support_tickets').select('*').limit(1);
    console.log("Support Tickets columns:", rowTicket && rowTicket.length > 0 ? Object.keys(rowTicket[0] || {}) : "No support_tickets rows found");
  } catch (e) {
    console.error("Err support_tickets:", e);
  }
}

inspect();
