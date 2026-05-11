/* eslint-disable */
const fs = require('fs');
const path = require('path');

// Regex tercanggih untuk menangkap SELURUH SPEKTRUM EMOJI secara akurat
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(path.join(dir, f));
        }
    });
}

console.log("=== OPERASI SAPU BERSIH EMOJI DIMULAI ===");
let fileCount = 0;
let cleanedCount = 0;

// Target folder src dan root js files
const targets = [path.join(process.cwd(), 'src')];

// Tambahkan file root js khusus
const rootJsFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.js'));
rootJsFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    processFile(fullPath);
});

// Loop menembus folder src
targets.forEach(targetDir => {
    if (fs.existsSync(targetDir)) {
        walkDir(targetDir, (filePath) => {
            if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
                processFile(filePath);
            }
        });
    }
});

function processFile(filePath) {
    if (filePath.includes('node_modules') || filePath.includes('.next') || filePath.includes('clean_emojis.js')) return;
    
    fileCount++;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (EMOJI_REGEX.test(content)) {
            const cleaned = content.replace(EMOJI_REGEX, '');
            fs.writeFileSync(filePath, cleaned, 'utf8');
            console.log(`[BERSIH] -> ${path.relative(process.cwd(), filePath)}`);
            cleanedCount++;
        }
    } catch(e) {
        console.error(`Error processing ${filePath}: ${e.message}`);
    }
}

console.log("\n=== HASIL PEMERSIHAN AKHIR ===");
console.log(`Total File Diperiksa: ${fileCount}`);
console.log(`Total File Yang Terkontaminasi & Dibersihkan: ${cleanedCount}`);
console.log("=======================================");
