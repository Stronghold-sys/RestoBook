const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

async function run() {
  console.log("=== RESTAURANT SETTINGS COLUMNS ===");
  const res = await fetch(`${url}/rest/v1/restaurant_settings?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log("Sample Settings:", data[0]);
  } else {
    console.log("No settings found");
  }
}

run().catch(console.error);
