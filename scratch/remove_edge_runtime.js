const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = walkDir(srcDir);
let modifiedCount = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  // Regex to match "export const runtime = 'edge';" or 'edge' or "edge" with optional spacing/semicolon and trailing newlines
  const edgeRuntimeRegex = /export\s+const\s+runtime\s*=\s*['"]edge['"]\s*;?\s*\r?\n?/g;
  
  if (edgeRuntimeRegex.test(content)) {
    content = content.replace(edgeRuntimeRegex, '');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Modified: ${file}`);
    modifiedCount++;
  }
});

console.log(`Finished. Total files modified: ${modifiedCount}`);
