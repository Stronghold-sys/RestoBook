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
let restoredCount = 0;

files.forEach((file) => {
  // Only target API routes (src/app/api/...) and specific page files that originally had it
  const isApiRoute = file.includes(path.join('src', 'app', 'api'));
  const isSpecificPage = file.includes(path.join('src', 'app', 'cashier', 'online-orders', 'page.tsx')) || 
                         file.includes(path.join('src', 'app', 'customer', 'orders', '[id]', 'page.tsx'));
                         
  if (isApiRoute || isSpecificPage) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if it already has the runtime = 'edge' declaration
    if (!content.includes("runtime = 'edge'") && !content.includes('runtime = "edge"')) {
      // Prepend export const runtime = 'edge'; at the very top of the file
      content = "export const runtime = 'edge';\n" + content;
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Restored edge runtime in: ${file}`);
      restoredCount++;
    }
  }
});

console.log(`Finished. Total files restored: ${restoredCount}`);
