const fs = require('fs');
const path = require('path');

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(path.join(dir, f));
        }
    });
}

const srcDir = path.join(process.cwd(), 'src');
let matches = [];

if (fs.existsSync(srcDir)) {
    walkDir(srcDir, (filePath) => {
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                // reset regex index
                EMOJI_REGEX.lastIndex = 0;
                if (EMOJI_REGEX.test(line)) {
                    // Match and extract all emojis on this line
                    EMOJI_REGEX.lastIndex = 0;
                    const found = line.match(EMOJI_REGEX);
                    matches.push({
                        file: path.relative(process.cwd(), filePath),
                        line: idx + 1,
                        emojis: found.join(', '),
                        content: line.trim()
                    });
                }
            });
        }
    });
}

console.log(JSON.stringify(matches, null, 2));
