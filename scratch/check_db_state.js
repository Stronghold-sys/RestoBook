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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Checking support_settings...");
    const { data: settings, error: settingsError } = await supabase
      .from('support_settings')
      .select('*')
      .eq('id', '77777777-7777-7777-7777-777777777777')
      .single();
    
    if (settingsError) {
      console.error("Error reading support_settings:", settingsError);
    } else {
      console.log("Support settings:", settings);
    }

    console.log("\nChecking completed order_chats with their orders...");
    const { data: completedChats, error: completedChatsError } = await supabase
      .from('order_chats')
      .select('id, order_id, customer_id, status, chat_closed_at, chat_history_deleted_at, order:orders(status)')
      .eq('status', 'completed')
      .limit(5);

    if (completedChatsError) {
      console.error("Error reading order_chats:", completedChatsError);
    } else {
      console.log("Completed order chats:", completedChats);
      if (completedChats && completedChats.length > 0) {
        const chatId = completedChats[0].id;
        console.log(`\nFetching messages for chat ${chatId}:`);
        const { data: msgs } = await supabase
          .from('order_chat_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
        console.log(msgs);
      }
    }

    console.log("\nChecking last 5 order_chats of any status...");
    const { data: anyChats, error: anyChatsError } = await supabase
      .from('order_chats')
      .select('id, order_id, customer_id, status, chat_closed_at, chat_history_deleted_at')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (anyChatsError) {
      console.error("Error reading order_chats (any):", anyChatsError);
    } else {
      console.log("Last 5 order chats:", anyChats);
    }

  } catch (err) {
    console.error("Unhandled error:", err);
  }
}

run();
