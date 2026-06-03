const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/master/data';
const OUT_DIR = path.join(__dirname, '../public/data/wilayah');

async function downloadCSV(filename) {
  console.log(`Downloading ${filename}...`);
  const res = await fetch(`${BASE_URL}/${filename}`);
  if (!res.ok) throw new Error(`Failed to download ${filename}: ${res.statusText}`);
  return await res.text();
}

function parseCSV(text, columnsCount) {
  const lines = text.split('\n');
  const data = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < columnsCount) continue;
    
    // Extract fields
    const id = parts[0].trim();
    let parentId = '';
    let name = '';
    if (columnsCount === 2) {
      name = parts[1].trim();
    } else {
      parentId = parts[1].trim();
      name = parts[2].trim();
    }
    data.push({ id, parentId, name });
  }
  return data;
}

async function run() {
  try {
    // Create output directories
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(path.join(OUT_DIR, 'regencies'), { recursive: true });
    fs.mkdirSync(path.join(OUT_DIR, 'districts'), { recursive: true });
    fs.mkdirSync(path.join(OUT_DIR, 'villages'), { recursive: true });

    // 1. Provinces
    const provCSV = await downloadCSV('provinces.csv');
    const provinces = parseCSV(provCSV, 2).map(p => ({
      id: p.id,
      name: p.name.toUpperCase()
    }));
    fs.writeFileSync(path.join(OUT_DIR, 'provinces.json'), JSON.stringify(provinces, null, 2));
    console.log(`Saved ${provinces.length} provinces.`);

    // 2. Regencies
    const regCSV = await downloadCSV('regencies.csv');
    const regencies = parseCSV(regCSV, 3).map(r => ({
      id: r.id,
      province_id: r.parentId,
      name: r.name.toUpperCase()
    }));
    
    // Group regencies by province
    const regenciesByProv = {};
    regencies.forEach(r => {
      if (!regenciesByProv[r.province_id]) regenciesByProv[r.province_id] = [];
      regenciesByProv[r.province_id].push({ id: r.id, name: r.name });
    });
    for (const provId in regenciesByProv) {
      fs.writeFileSync(path.join(OUT_DIR, `regencies/${provId}.json`), JSON.stringify(regenciesByProv[provId], null, 2));
    }
    console.log(`Saved regencies grouped by province.`);

    // 3. Districts
    const distCSV = await downloadCSV('districts.csv');
    const districts = parseCSV(distCSV, 3).map(d => ({
      id: d.id,
      regency_id: d.parentId,
      name: d.name.toUpperCase()
    }));

    // Group districts by regency
    const districtsByReg = {};
    districts.forEach(d => {
      if (!districtsByReg[d.regency_id]) districtsByReg[d.regency_id] = [];
      districtsByReg[d.regency_id].push({ id: d.id, name: d.name });
    });
    for (const regId in districtsByReg) {
      fs.writeFileSync(path.join(OUT_DIR, `districts/${regId}.json`), JSON.stringify(districtsByReg[regId], null, 2));
    }
    console.log(`Saved districts grouped by regency.`);

    // 4. Villages
    const villCSV = await downloadCSV('villages.csv');
    const villages = parseCSV(villCSV, 3).map(v => ({
      id: v.id,
      district_id: v.parentId,
      name: v.name.toUpperCase()
    }));

    // Group villages by district
    const villagesByDist = {};
    villages.forEach(v => {
      if (!villagesByDist[v.district_id]) villagesByDist[v.district_id] = [];
      villagesByDist[v.district_id].push({ id: v.id, name: v.name });
    });
    for (const distId in villagesByDist) {
      fs.writeFileSync(path.join(OUT_DIR, `villages/${distId}.json`), JSON.stringify(villagesByDist[distId], null, 2));
    }
    console.log(`Saved villages grouped by district.`);

    console.log('SUCCESS! All local regional data files generated.');
  } catch (err) {
    console.error('FAILED to run migration script:', err);
  }
}

run();
