const fetch = require('node-fetch');

const apiKey = 'AIzaSyATN9Xd4gGIy7Q3DiY6n382IcfQuJcovNQ';
const model = 'gemini-2.5-flash';

async function testGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
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
            parts: [{ text: 'Hello, respond with exactly "OK"' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.7
        }
      })
    });
    
    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response Text:', text);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testGemini();
