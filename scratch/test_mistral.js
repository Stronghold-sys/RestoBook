const apiKey = 'ITMRdIvYzzozMJTB7u7tTMdMf2Qget5n';

async function testMistral(model) {
  console.log(`Testing model: ${model}...`);
  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Hello, respond with exactly "OK"'
          }
        ],
        max_tokens: 10
      })
    });
    
    console.log(`Status for ${model}:`, response.status);
    const data = await response.json();
    console.log(`Response for ${model}:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error for ${model}:`, err);
  }
}

async function run() {
  await testMistral('open-mistral-7b');
  console.log('-------------------------');
  await testMistral('mistral-tiny');
  console.log('-------------------------');
  await testMistral('mistral-small-latest');
}

run();
