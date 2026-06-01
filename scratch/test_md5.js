const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Read the pure JS md5 code, strip out export typescript declaration and run it
const md5FileContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'md5.ts'), 'utf8');
const jsCode = md5FileContent
  .replace("export async function md5(message: string): Promise<string> {", "async function md5(message) {")
  .replace("function md5Sync(message: string): string {", "function md5Sync(message) {")
  .replace("const words: number[] = [];", "const words = [];")
  .replace("const toHex = (n: number) => {", "const toHex = (n) => {");

// Inject evaluation
eval(jsCode + `
async function test() {
  const input = "test";
  const expected = crypto.createHash('md5').update(input).digest('hex');
  const actual = await md5(input);
  console.log("Input: 'test'");
  console.log("Expected (Node crypto):", expected);
  console.log("Actual (Pure JS):     ", actual);
  console.log("Match:", expected === actual ? "SUCCESS" : "FAILED");
  
  const input2 = "Selamat Bergabung di RestoBook!";
  const expected2 = crypto.createHash('md5').update(input2).digest('hex');
  const actual2 = await md5(input2);
  console.log("Input: 'Selamat Bergabung di RestoBook!'");
  console.log("Expected (Node crypto):", expected2);
  console.log("Actual (Pure JS):     ", actual2);
  console.log("Match:", expected2 === actual2 ? "SUCCESS" : "FAILED");
}
test();
`);
