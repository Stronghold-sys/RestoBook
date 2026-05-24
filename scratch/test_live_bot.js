async function testLiveBot() {
  const url = 'https://restobookid.my.id/api/restobot';
  
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
        systemPrompt: 'Kamu adalah RestoBot, asisten virtual RestoBook untuk halaman utama website.',
        role: 'home'
      })
    });
    
    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response Text:', text);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testLiveBot();
