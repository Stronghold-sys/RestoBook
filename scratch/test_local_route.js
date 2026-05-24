async function testLocalRoute() {
  const url = 'http://localhost:3000/api/restobot';
  console.log(`Testing local route: ${url}...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        history: [
          {
            role: 'user',
            content: 'Halo, siapa kamu?'
          }
        ],
        systemPrompt: 'Kamu adalah RestoBot, asisten virtual RestoBook.',
        role: 'home'
      })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testLocalRoute();
