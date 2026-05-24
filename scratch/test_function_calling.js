async function testFunctionCalling() {
  const url = 'http://localhost:3000/api/restobot';
  console.log(`Testing function calling via local route: ${url}...`);
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
            content: 'Tolong buatkan reservasi atas nama Budi Santoso untuk 3 orang pada tanggal 2026-06-15 pukul 19:30, kirim konfirmasi ke email utskelompok03@gmail.com'
          }
        ],
        systemPrompt: `Kamu adalah RestoBot, asisten personal untuk pelanggan RestoBook yang sudah login.
Kamu memiliki akses ke data pelanggan yang sedang aktif.

DATA USER AKTIF:
{
  "user": {
    "id": "0792829a-4834-4d17-a795-9613efcc5f8e",
    "name": "RAHMAT",
    "role": "customer",
    "email": "utskelompok03@gmail.com",
    "phone": "853-8387-6822",
    "points": 0
  },
  "reservations": [],
  "orders": []
}`,
        role: 'customer'
      })
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testFunctionCalling();
