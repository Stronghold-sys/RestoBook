const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('https://alamat.thecloudalert.com/api/provinsi/get/');
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Provinces count:', json.result ? json.result.length : 0);
    if (json.result && json.result.length > 0) {
      console.log('First province:', json.result[0]);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
