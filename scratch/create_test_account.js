// Script untuk membuat akun testing pelanggan di Supabase
// Jalankan dengan: node scratch/create_test_account.js

const SUPABASE_URL = "https://dazsblmccvxtewtmaljf.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ";

const TEST_EMAIL = "testingrestobook@gmail.com";
const TEST_PASSWORD = "Testing@1234";
const TEST_NAME = "Pelanggan Testing";

async function createTestAccount() {
  console.log("🔄 Membuat akun testing pelanggan...");

  // Step 1: Buat user di Supabase Auth
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true, // Langsung konfirmasi tanpa perlu verifikasi email
      user_metadata: {
        full_name: TEST_NAME,
      },
    }),
  });

  const authData = await authRes.json();

  if (!authRes.ok) {
    // Jika sudah ada, coba update password saja
    if (authData.message?.includes("already") || authData.code === "email_exists") {
      console.log("⚠️  Email sudah terdaftar. Mencoba update password...");
      
      // Cari user dulu
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
      const listData = await listRes.json();
      const existing = (listData.users || []).find(u => u.email === TEST_EMAIL);
      
      if (existing) {
        const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            password: TEST_PASSWORD,
            email_confirm: true,
          }),
        });
        const updateData = await updateRes.json();
        console.log("✅ Password diperbarui untuk user:", existing.id);
        await ensureProfile(existing.id);
        return;
      }
    }
    
    console.error("❌ Gagal membuat user auth:", JSON.stringify(authData, null, 2));
    return;
  }

  const userId = authData.id;
  console.log("✅ Auth user dibuat:", userId);

  await ensureProfile(userId);
}

async function ensureProfile(userId) {
  // Step 2: Cek/buat profil di tabel profiles
  const profileCheckRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=id`,
    {
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const profileCheck = await profileCheckRes.json();

  if (profileCheck.length > 0) {
    // Update profil yang ada
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        full_name: TEST_NAME,
        email: TEST_EMAIL,
        role: "customer",
        status: "active",
      }),
    });
    console.log("✅ Profil diperbarui");
  } else {
    // Buat profil baru
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        full_name: TEST_NAME,
        email: TEST_EMAIL,
        role: "customer",
        status: "active",
      }),
    });

    if (profileRes.ok) {
      console.log("✅ Profil customer dibuat");
    } else {
      const profileErr = await profileRes.text();
      console.error("⚠️ Profil error (mungkin trigger otomatis sudah buat):", profileErr);
    }
  }

  console.log("\n========================================");
  console.log("🎉 AKUN TESTING BERHASIL DIBUAT/DIPERBARUI!");
  console.log("========================================");
  console.log(`📧 Email    : ${TEST_EMAIL}`);
  console.log(`🔑 Password : ${TEST_PASSWORD}`);
  console.log(`👤 Nama     : ${TEST_NAME}`);
  console.log(`🏷️  Role     : customer`);
  console.log("========================================");
  console.log("Kirimkan informasi ini ke Duitku Onboarding Team.");
}

createTestAccount().catch(console.error);
