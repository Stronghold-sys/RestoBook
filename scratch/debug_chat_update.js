const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const chatId = 'ccdf14a2-27fd-4b43-8a1a-d0b774e093dd';
  console.log(`Manually updating chat ${chatId}...`);
  
  const now = new Date();
  const closedAt = now.toISOString();
  const deletedAt = new Date(now.getTime() + 20 * 1000).toISOString(); // 20 seconds from now
  
  const { data, error } = await supabase
    .from('order_chats')
    .update({
      status: 'completed',
      chat_closed_at: closedAt,
      chat_history_deleted_at: deletedAt
    })
    .eq('id', chatId)
    .select();
    
  if (error) {
    console.error("Error updating:", error);
  } else {
    console.log("Updated data:", data);
  }
}

run();
