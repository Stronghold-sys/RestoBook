const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

async function run() {
  const res = await fetch(`${url}/rest/v1/order_chats?order=updated_at.desc&limit=5`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log("Order chats data:");
  console.log(JSON.stringify(data, null, 2));
}
run().catch(console.error);
