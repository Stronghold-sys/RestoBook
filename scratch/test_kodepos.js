const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('https://kodepos.vercel.app/search?q=Bogor');
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Results count:', json.data ? json.result ? json.result.length : json.data.length : 0);
    if (json.data && json.data.length > 0) {
      console.log('First result:', json.data[0]);
    } else {
      console.log('Response:', json);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
