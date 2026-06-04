const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

async function run() {
  console.log("=== PROFILES COLUMNS ===");
  const resProfile = await fetch(`${url}/rest/v1/profiles?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const dataProfile = await resProfile.json();
  if (dataProfile && dataProfile.length > 0) {
    console.log(Object.keys(dataProfile[0]));
    console.log("Sample Profile points-related data:", {
      points: dataProfile[0].points,
      pending_points: dataProfile[0].pending_points,
      points_used: dataProfile[0].points_used,
      is_redeem_blocked: dataProfile[0].is_redeem_blocked
    });
  } else {
    console.log("No profiles found");
  }

  console.log("\n=== POINT TRANSACTIONS COLUMNS ===");
  const resTx = await fetch(`${url}/rest/v1/point_transactions?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const dataTx = await resTx.json();
  if (dataTx && dataTx.length > 0) {
    console.log(Object.keys(dataTx[0]));
    console.log("Sample transaction:", dataTx[0]);
  } else {
    console.log("No transactions found");
  }

  console.log("\n=== LAST 5 POINT TRANSACTIONS ===");
  const resLast5 = await fetch(`${url}/rest/v1/point_transactions?limit=5&order=created_at.desc`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const dataLast5 = await resLast5.json();
  console.log(dataLast5);
}

run().catch(console.error);
