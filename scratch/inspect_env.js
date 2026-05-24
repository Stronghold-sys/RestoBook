const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const line = lines.find(l => l.startsWith('NEXT_PUBLIC_GOOGLE_CLIENT_ID'));
  if (line) {
    console.log('Line found:', JSON.stringify(line));
    const value = line.split('=')[1];
    console.log('Value:', JSON.stringify(value));
    console.log('Hex representation:');
    console.log(Buffer.from(value).toString('hex'));
  } else {
    console.log('NEXT_PUBLIC_GOOGLE_CLIENT_ID not found in .env.local');
  }
} else {
  console.log('.env.local not found');
}
