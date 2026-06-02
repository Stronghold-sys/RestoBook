const fs = require('fs');
const path = require('path');

const SQL_URL = 'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql';
const OUT_DIR = path.join(__dirname, '../public/data/wilayah');

async function run() {
  try {
    console.log('Downloading wilayah.sql from cahyadsn...');
    const res = await fetch(SQL_URL);
    if (!res.ok) throw new Error(`Failed to download: ${res.statusText}`);
    const sqlText = await res.text();
    console.log('Download complete. Parsing SQL...');

    const lines = sqlText.split('\n');
    const provinces = [];
    const provinceData = {}; // provinceId -> { regencies: [], districts: [], villages: [] }

    let parsedCount = 0;
    for (let line of lines) {
      line = line.trim();
      if (!line.startsWith('(')) continue;
      
      // Syntax is ('code','name')
      // Find the code
      const firstQuoteIdx = line.indexOf("'");
      if (firstQuoteIdx === -1) continue;
      const secondQuoteIdx = line.indexOf("'", firstQuoteIdx + 1);
      if (secondQuoteIdx === -1) continue;
      const code = line.substring(firstQuoteIdx + 1, secondQuoteIdx);
      
      // Find the name
      const thirdQuoteIdx = line.indexOf("'", secondQuoteIdx + 1);
      if (thirdQuoteIdx === -1) continue;
      
      // The name ends at the last quote before the closing parenthesis
      const lastCloseParenIdx = line.lastIndexOf(")");
      if (lastCloseParenIdx === -1) continue;
      const lastQuoteIdx = line.lastIndexOf("'", lastCloseParenIdx);
      if (lastQuoteIdx === -1 || lastQuoteIdx <= thirdQuoteIdx) continue;
      
      let name = line.substring(thirdQuoteIdx + 1, lastQuoteIdx);
      // Unescape SQL quotes
      name = name.replace(/\\'/g, "'").replace(/''/g, "'").trim().toUpperCase();

      const cleanCode = code.replace(/\./g, '');
      const parts = code.split('.');
      const provId = parts[0];

      if (parts.length === 1) {
        // Province
        provinces.push({ id: cleanCode, name });
      } else {
        // Ensure the province container exists
        if (!provinceData[provId]) {
          provinceData[provId] = { regencies: [], districts: [], villages: [] };
        }

        if (parts.length === 2) {
          // Regency
          provinceData[provId].regencies.push({ id: cleanCode, name });
        } else if (parts.length === 3) {
          // District
          const regId = parts[0] + parts[1];
          provinceData[provId].districts.push({ id: cleanCode, regency_id: regId, name });
        } else if (parts.length === 4) {
          // Village
          const distId = parts[0] + parts[1] + parts[2];
          provinceData[provId].villages.push({ id: cleanCode, district_id: distId, name });
        }
      }
      parsedCount++;
    }

    console.log(`Parsed ${parsedCount} items from SQL file.`);

    // Write files to public/data/wilayah
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(path.join(OUT_DIR, 'provinces'), { recursive: true });

    // Save provinces.json
    fs.writeFileSync(path.join(OUT_DIR, 'provinces.json'), JSON.stringify(provinces, null, 2));
    console.log(`Saved ${provinces.length} provinces.`);

    // Save each province's data file
    let savedProvinceFiles = 0;
    for (const provId in provinceData) {
      fs.writeFileSync(
        path.join(OUT_DIR, `provinces/${provId}.json`),
        JSON.stringify(provinceData[provId], null, 2)
      );
      savedProvinceFiles++;
    }
    console.log(`Saved ${savedProvinceFiles} province data files.`);

    console.log('SUCCESS! All consolidated local regional data files generated.');
  } catch (err) {
    console.error('FAILED to run migration script:', err);
  }
}

run();
