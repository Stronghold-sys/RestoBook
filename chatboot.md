Buatkan fitur CHAT KASIR yang interaktif, realtime, modern, dan terhubung dengan AI assistant terlebih dahulu sebelum diarahkan ke kasir manusia. Saat pelanggan menekan menu “Chat Kasir”, sistem harus langsung membuka tampilan chat, lalu AI wajib menyapa otomatis tanpa menunggu pelanggan mengetik dulu.

TUJUAN FITUR:

- Memberi sambutan otomatis saat chat dibuka.
- Membantu pelanggan menjelaskan kebutuhan pesanan.
- Menjawab pertanyaan dasar terkait pesanan.
- Menawarkan opsi untuk langsung terhubung ke kasir manusia.
- Jika pelanggan setuju, AI langsung meneruskan percakapan ke kasir.
- Saat terhubung ke kasir, pelanggan diminta menunggu sampai kasir membalas.
- Semua percakapan harus sopan, jelas, ramah, dan sesuai konteks order.

ALUR UTAMA:

1. Saat pelanggan membuka menu Chat Kasir:
   - Sistem langsung membuka room chat.
   - AI mengirim pesan pertama secara otomatis.
   - Status awal chat = AI_ACTIVE.
   - AI menyapa, menjelaskan bantuan yang tersedia, lalu menampilkan quick reply.

2. Saat pelanggan mengirim pesan:
   - AI membalas sesuai konteks.
   - AI harus bisa memahami maksud pesan, seperti:
     - status pesanan
     - estimasi selesai
     - ubah pesanan
     - komplain
     - pembatalan
     - refund
     - pesanan salah
     - ingin bicara ke kasir
     - pertanyaan umum

3. Jika pelanggan ingin langsung menghubungi kasir:
   - AI tidak langsung memindahkan chat.
   - AI harus meminta konfirmasi dulu.
   - Jika pelanggan setuju, barulah chat dialihkan ke kasir.

4. Saat chat sudah diteruskan ke kasir:
   - AI berhenti menjadi penjawab utama.
   - Semua pesan pelanggan diteruskan realtime ke dashboard kasir.
   - Pelanggan diberi status menunggu yang sopan.
   - Kasir menerima notifikasi realtime.

LOGIKA STATUS CHAT:
Gunakan state/status berikut:

- AI_ACTIVE = AI sedang membalas otomatis
- WAITING_CUSTOMER_CHOICE = AI menawarkan sambungan ke kasir
- TRANSFER_REQUESTED = pelanggan setuju untuk dihubungkan
- WAITING_CASHIER = chat sudah diteruskan ke kasir, menunggu balasan
- CASHIER_ACTIVE = kasir sudah mengambil percakapan
- CLOSED = chat selesai

LOGIKA PEMBUKAAN CHAT:
Saat chat dibuka, AI wajib mengirim pesan pembuka otomatis seperti:

- “Halo! Saya RestoBot, asisten bantuan pesanan Anda. Ada yang bisa saya bantu?”
- “Selamat datang di layanan chat kasir. Saya siap membantu pesanan Anda.”
- “Silakan jelaskan kebutuhan Anda, saya akan bantu secepat mungkin.”
- “Jika Anda ingin berbicara langsung dengan kasir, saya juga bisa menghubungkan Anda.”

AI juga harus menampilkan quick reply seperti:

- Status pesanan
- Estimasi selesai
- Ubah pesanan
- Batalkan pesanan
- Hubungi kasir
- Komplain
- Lainnya

KATA-KATA SAAT MENAWARKAN HUBUNGAN KE KASIR:

- “Baik, saya bisa hubungkan Anda ke kasir. Apakah Anda ingin melanjutkan?”
- “Saya akan meneruskan chat ini ke kasir agar dibantu langsung. Lanjutkan?”
- “Jika Anda ingin bantuan lebih lanjut, saya bisa menghubungkan Anda ke kasir.”
- “Silakan pilih ‘Hubungkan ke kasir’ bila ingin dibantu langsung oleh petugas.”

TOMBOL KONFIRMASI:

- Ya, hubungkan
- Batal

JIKA PELANGGAN MEMILIH “YA, HUBUNGKAN”:

- Status chat berubah menjadi TRANSFER_REQUESTED.
- Sistem mengirim notifikasi ke kasir.
- AI mengirim pesan transisi:
  - “Baik, Anda akan dihubungkan ke kasir. Mohon tunggu sebentar.”
  - “Pesan Anda sudah diteruskan. Silakan menunggu balasan kasir.”
- Setelah itu AI berhenti menjadi responder utama.

SAAT MENUNGGU BALASAN KASIR:

- Status chat = WAITING_CASHIER.
- Tampilkan pesan:
  - “Mohon tunggu sebentar, kasir sedang memproses pesan Anda.”
  - “Pesan Anda sudah diterima, silakan menunggu balasan kasir.”
  - “Kami sedang menghubungkan Anda ke kasir, harap bersabar.”
  - “Kasir akan membalas secepatnya, terima kasih atas pengertiannya.”
- Tampilkan indikator loading atau status menunggu.
- Jika kasir belum membalas dalam beberapa waktu, tampilkan reminder sopan:
  - “Terima kasih sudah menunggu, pesan Anda masih dalam antrean kasir.”
  - “Kasir masih belum membalas, mohon tunggu sebentar.”

SAAT KASIR MULAI MEMBALAS:

- Status berubah menjadi CASHIER_ACTIVE.
- Label pengirim berubah menjadi “Kasir”.
- Semua pesan berikutnya dikirim sebagai pesan kasir, bukan AI.
- AI berhenti mengirim respons otomatis.

SAAT CHAT SELESAI:

- Status berubah menjadi CLOSED.
- Pelanggan tidak bisa mengirim pesan baru di sesi yang sama.
- Tampilkan pesan:
  - “Chat telah selesai.”
  - “Terima kasih telah menghubungi kasir.”

FITUR TAMBAHAN YANG WAJIB ADA:

1. Status percakapan:
   - AI aktif
   - Menunggu konfirmasi
   - Terhubung ke kasir
   - Menunggu balasan kasir
   - Selesai

2. Quick reply / pesan cepat:
   - Status pesanan
   - Estimasi selesai
   - Hubungi kasir
   - Ubah pesanan
   - Batalkan pesanan
   - Komplain
   - Selesai

3. Notifikasi realtime ke kasir:
   - Saat pelanggan meminta sambungan, kasir menerima notifikasi realtime.
   - Notifikasi harus berisi:
     - nama pelanggan
     - nomor pesanan
     - jenis order
     - isi pesan terakhir
     - waktu pesan
     - tingkat urgensi jika ada

4. Riwayat chat:
   - Simpan percakapan AI, pelanggan, dan kasir.
   - Tandai pengirim dengan jelas.
   - Simpan timestamp pada setiap pesan.

5. Penanganan pesan penting:
   - Jika pesan mengandung kata seperti:
     - komplain
     - marah
     - pesanan salah
     - belum diterima
     - refund
     - batal
     maka AI harus lebih cepat menawarkan koneksi ke kasir.

6. Pesan sopan dan profesional:
   - Gunakan bahasa yang ramah, singkat, jelas, dan mudah dipahami pelanggan Indonesia.
   - Hindari bahasa yang kaku.
   - Hindari balasan yang terlalu panjang.

7. Anti-spam dan pengendalian chat:
   - Jika pelanggan mengirim pesan berulang sama, AI harus menenangkan dengan sopan.
   - Jika kasir belum membalas, sistem hanya mengirim pengingat berkala, bukan spam.

LOGIKA SISTEM LENGKAP:

- Jika chat dibuka -> AI menyapa otomatis.
- Jika pelanggan bertanya status -> AI menjawab berdasarkan data order.
- Jika pelanggan ingin bicara ke manusia -> AI meminta konfirmasi.
- Jika dikonfirmasi -> chat dialihkan ke kasir.
- Jika kasir sudah mengambil chat -> AI berhenti membalas.
- Jika kasir selesai -> status chat menjadi selesai.
- Jika koneksi realtime terputus -> pesan disimpan sementara lalu disinkronkan kembali.
- Jika order sudah selesai -> AI tidak boleh menawarkan transfer lagi kecuali admin mengaktifkan ulang chat.

LOGIKA BACKEND:

- Simpan status chat.
- Simpan riwayat pesan.
- Kirim update realtime via websocket/socket.
- Tangani transfer dari AI ke kasir.
- Tangani notifikasi masuk ke kasir.
- Simpan waktu balasan dan status pesan.
- Pisahkan pesan AI, pelanggan, dan kasir.
- Validasi agar pesan tidak double terkirim.
- Pastikan chat tetap aman dan stabil.

LOGIKA FRONTEND:

- Saat halaman chat dibuka, AI langsung menyapa otomatis.
- Tampilkan bubble pesan yang berbeda untuk AI, pelanggan, dan kasir.
- Tampilkan status chat dan indikator menunggu.
- Tampilkan quick reply.
- Tampilkan tombol hubungi kasir.
- Tampilkan pesan transisi saat dialihkan ke kasir.
- UI tetap rapi di desktop dan mobile.
- Desain modern, bersih, dan nyaman dibaca.

OUTPUT YANG DIHARAPKAN:
Implementasikan seluruh alur ini agar:

- AI menyapa otomatis saat chat dibuka
- AI bisa menjawab pertanyaan dasar
- pelanggan bisa memilih untuk terhubung ke kasir
- saat dikonfirmasi, chat langsung dialihkan ke kasir
- pelanggan diminta menunggu sampai kasir membalas
- ada status realtime yang jelas
- ada pesan sopan saat menunggu
- sistem stabil, rapi, dan profesional
