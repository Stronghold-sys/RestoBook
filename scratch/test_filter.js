const fetch = require('node-fetch');

async function test() {
  const selectedProvince = 'BENGKULU';
  const selectedRegency = 'KABUPATEN KEPAHIANG';
  const selectedDistrict = 'KEPAHIANG';

  try {
    const q = encodeURIComponent(selectedDistrict);
    const res = await fetch(`https://kodepos.vercel.app/search?q=${q}`);
    const json = await res.json();
    
    if (!json.data) {
      console.log('No data:', json);
      return;
    }

    // Clean regency name to compare (e.g., remove "KABUPATEN " or "KOTA ")
    const cleanReg = (name) => name.toLowerCase().replace(/^(kabupaten|kota)\s+/i, '').trim();

    const filtered = json.data.filter(item => {
      const matchProv = item.province.toLowerCase() === selectedProvince.toLowerCase();
      const matchReg = cleanReg(item.regency) === cleanReg(selectedRegency);
      const matchDist = item.district.toLowerCase() === selectedDistrict.toLowerCase();
      return matchProv && matchReg && matchDist;
    });

    console.log(`Filtered count for ${selectedDistrict}:`, filtered.length);
    if (filtered.length > 0) {
      console.log('Sample filtered items:', filtered.slice(0, 3));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
