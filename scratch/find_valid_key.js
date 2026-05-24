const fetch = require('node-fetch');

// The base characters we saw in the screenshot
// AIzaSyA[l/I]ykCtzG9OkunIAJJhPIL3177[I/l/1][I/l/1]Q91fe8

const char8Options = ['l', 'I', '1'];
const char32Options = ['I', 'l', '1'];
const char33Options = ['l', 'I', '1'];

async function testKey(key) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hi' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2,
          temperature: 0.1
        }
      })
    });
    
    if (response.status === 200) {
      return { success: true, status: response.status };
    }
    const text = await response.text();
    return { success: false, status: response.status, message: text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function findValidKey() {
  console.log('Testing permutations...');
  for (const c8 of char8Options) {
    for (const c32 of char32Options) {
      for (const c33 of char33Options) {
        const key = `AIzaSyA${c8}ykCtzG9OkunIAJJhPIL3177${c32}${c33}Q91fe8`;
        const result = await testKey(key);
        if (result.success) {
          console.log('SUCCESS! Found working key:', key);
          return;
        } else {
          console.log(`Key ${key} failed with status ${result.status}`);
          // If it's a 403 denied access, let's see if the message says leaked or project denied
          if (result.message && result.message.includes('denied')) {
            console.log('-> Message: Project denied');
          }
        }
      }
    }
  }
  console.log('All permutations finished.');
}

findValidKey();
