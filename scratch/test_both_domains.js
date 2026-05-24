async function testDomain(domain) {
  const url = `https://${domain}/api/restobot`;
  console.log(`Testing ${url}...`);
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
    
    console.log(`${domain} - Response Status:`, response.status);
    const text = await response.text();
    console.log(`${domain} - Response Text:`, text);
  } catch (err) {
    console.error(`${domain} - Fetch Error:`, err);
  }
}

async function run() {
  await testDomain('restobookid.my.id');
  console.log('------------------------------------');
  await testDomain('restobook.my.id');
}

run();
