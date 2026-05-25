import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
const envPath = path.join(__dirname, '..', '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  try {
    envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  } catch (err) {}
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL or Service Role Key in env files.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("Running tax_percent migration...");
  const sql = `ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 10.00;`;
  let { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.log("exec_sql failed, trying exec_sql_block...");
    const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
    error = err2;
  }

  if (error) {
    console.error("Migration failed:", error.message);
  } else {
    console.log("Migration successful! Column tax_percent added/verified.");
  }
}

run();
