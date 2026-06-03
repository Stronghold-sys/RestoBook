Buatkan sistem fitur pengaduan/bantuan yang lengkap untuk aplikasi dengan dua sisi: PELANGGAN dan ADMIN, serta integrasi AI chatbot yang bisa membuat tiket pengaduan otomatis. Seluruh teks antarmuka gunakan Bahasa Indonesia yang rapi, jelas, ramah, dan profesional.

TUJUAN UTAMA:
Membangun fitur pengaduan yang mencakup:

1. Pengaduan manual oleh pelanggan.
2. Pengaduan melalui AI chatbot yang otomatis membuat tiket.
3. Tiket pengaduan tampil di sisi pelanggan dan admin.
4. Live chat realtime antara admin dan pelanggan.
5. Pengaturan waktu penghapusan riwayat chat oleh admin.
6. Penguncian chat setelah keluhan selesai.
7. Notifikasi, status tiket, histori, suara notifikasi, dan fitur pendukung lain yang lengkap.

--------------------------------------------------

A. FITUR DI SISI PELANGGAN
--------------------------------------------------

1) MENU PENGADUAN / BANTUAN

- Buat menu khusus “Pengaduan/Bantuan” di halaman pelanggan.
- Di dalam menu ini pelanggan dapat:
  - melihat daftar tiket yang pernah dibuat,
  - membuat pengaduan baru secara manual,
  - melihat status tiket,
  - melihat detail keluhan,
  - melihat riwayat percakapan tiket terkait,
  - melampirkan file gambar/dokumen jika diperlukan,
  - menerima notifikasi saat ada balasan dari admin.

1) PENGADUAN MANUAL

- Sediakan form pengaduan manual dengan field:
  - judul pengaduan,
  - kategori keluhan,
  - subkategori (jika ada),
  - isi keluhan/bantuan,
  - lampiran file opsional,
  - tingkat urgensi,
  - kontak yang bisa dihubungi.
- Setelah pelanggan klik “Kirim”, sistem wajib:
  - memvalidasi input,
  - membuat nomor tiket otomatis,
  - menampilkan nomor tiket kepada pelanggan,
  - menyimpan tiket ke database,
  - menampilkan status awal: “Menunggu Tanggapan Admin”.
- Setelah tiket berhasil dibuat, tampilkan pesan:
  - “Pengaduan Anda telah diterima. Nomor tiket Anda adalah: XXXXX. Tim kami akan meninjau dan membalas secepatnya.”

1) TIKET PENGADUAN PELANGGAN

- Di menu pelanggan, tampilkan daftar tiket dengan status:
  - Menunggu Tanggapan,
  - Diproses,
  - Menunggu Informasi Tambahan,
  - Selesai,
  - Ditutup,
  - Kedaluwarsa.
- Saat pelanggan klik tiket, tampilkan detail lengkap:
  - nomor tiket,
  - tanggal dibuat,
  - kategori,
  - isi keluhan,
  - lampiran,
  - status,
  - riwayat chat/tanggapan,
  - waktu terakhir diperbarui,
  - estimasi penyelesaian jika ada.
- Jika tiket sudah selesai atau ditutup, tampilkan pesan:
  - “Tiket telah diselesaikan.”
  - “Percakapan telah dikunci.”
  - “Riwayat akan dihapus dalam: hh jam mm menit ss detik” sesuai pengaturan admin.

1) LIVE CHAT PELANGGAN

- Fitur live chat hanya aktif jika admin sudah memulai chat terlebih dahulu.
- Jika pelanggan membuka chat saat admin belum memulai, tampilkan pesan:
  - “Chat belum dimulai oleh admin.”
  - “Silakan tunggu hingga tim kami memulai percakapan.”
- Jika admin telah memulai, pelanggan bisa chat realtime.
- Chat harus berjalan tanpa refresh browser.
- Pesan admin dan pelanggan langsung muncul secara realtime.
- Tampilkan indikator:
  - mengetik,
  - pesan terkirim,
  - pesan dibaca,
  - status online/offline jika memungkinkan.
- Setelah keluhan selesai, chat dikunci sehingga pelanggan tidak bisa mengirim pesan lagi.

1) PESAN KUNCI SETELAH CHAT SELESAI

- Saat chat ditutup, tampilkan pesan:
  - “Percakapan telah berakhir.”
  - “Anda tidak dapat mengirim pesan lagi pada tiket ini.”
  - “Riwayat chat akan dihapus otomatis dalam: hh jam mm menit ss detik.”
- Riwayat chat tetap bisa dibaca sampai waktu penghapusan habis.

1) SUARA NOTIFIKASI PELANGGAN

- Tambahkan suara notifikasi yang berbeda untuk setiap jenis event.
- Saat admin mengirim chat ke pelanggan:
  - pelanggan menerima nada notifikasi khusus yang lembut, jelas, dan berbeda dari notifikasi lain.
- Saat pelanggan menerima notifikasi umum selain chat:
  - gunakan nada berbeda sesuai jenis event.
- Tambahkan badge unread count dan animasi ringan saat pesan masuk.

--------------------------------------------------

B. FITUR DI SISI ADMIN
--------------------------------------------------

1) DASHBOARD PENGADUAN

- Buat halaman admin untuk menerima semua pengaduan pelanggan.
- Tampilkan daftar tiket dengan informasi:
  - nomor tiket,
  - nama pelanggan,
  - kategori,
  - prioritas,
  - status,
  - tanggal masuk,
  - terakhir dibalas,
  - SLA / batas waktu tanggapan,
  - sumber tiket (manual / AI chatbot).
- Sediakan filter dan pencarian berdasarkan:
  - status,
  - nama pelanggan,
  - nomor tiket,
  - kategori,
  - tanggal,
  - prioritas.

1) DETAIL TIKET ADMIN

- Saat admin membuka tiket, tampilkan:
  - data pelanggan,
  - detail keluhan,
  - lampiran,
  - riwayat chat lengkap,
  - log aktivitas tiket,
  - status tiket,
  - tombol ubah status,
  - tombol mulai chat,
  - tombol selesai/ditutup,
  - tombol minta informasi tambahan,
  - tombol eskalasi ke admin lain / supervisor.

1) ADMIN MEMULAI LIVE CHAT

- Live chat hanya dapat berlangsung jika admin menekan tombol “Mulai Chat”.
- Setelah admin memulai:
  - status tiket berubah menjadi “Diproses”,
  - pelanggan menerima notifikasi bahwa admin telah memulai percakapan,
  - kolom chat pelanggan terbuka,
  - percakapan berlangsung realtime tanpa refresh browser.
- Jika admin belum memulai, pelanggan tetap bisa melihat tiket tetapi tidak bisa mengirim pesan.

1) PENGATURAN WAKTU PENGHAPUSAN RIWAYAT CHAT

- Buat pengaturan di admin untuk menentukan waktu penghapusan riwayat chat setelah percakapan selesai.
- Admin bisa mengatur:
  - jam,
  - menit,
  - detik.
- Contoh:
  - 0 jam 30 menit 0 detik,
  - 1 jam 0 menit 0 detik,
  - 2 jam 15 menit 10 detik.
- Setelah waktu habis:
  - chat otomatis dikunci,
  - riwayat chat dihapus permanen,
  - tiket tetap tersimpan sebagai arsip bila diperlukan.
- Tampilkan countdown di sisi pelanggan dan admin:
  - “Riwayat chat akan dihapus dalam: 00:29:59”.

1) PENUTUPAN TIKET

- Setelah masalah selesai, admin dapat menandai tiket sebagai:
  - Selesai,
  - Ditutup,
  - Ditolak,
  - Perlu Informasi Tambahan.
- Saat status “Selesai” atau “Ditutup”:
  - chat dikunci,
  - pelanggan tidak dapat mengirim pesan lagi,
  - sistem menampilkan pesan penutupan yang sopan.

1) RESPON OTOMATIS ADMIN

- Tambahkan template balasan cepat untuk admin, misalnya:
  - “Terima kasih, kami sedang memeriksa kendala Anda.”
  - “Mohon kirimkan informasi tambahan agar kami bisa membantu lebih cepat.”
  - “Keluhan Anda sudah kami terima dan sedang kami proses.”
  - “Percakapan telah kami tutup setelah masalah dinyatakan selesai.”

1) SUARA NOTIFIKASI ADMIN

- Buat nada notifikasi berbeda antara:
  - pesan dari pelanggan ke admin,
  - pesan dari admin ke pelanggan,
  - notifikasi sistem lainnya.
- Saat pelanggan mengirim chat ke admin:
  - admin menerima nada notifikasi khusus yang berbeda dari suara pesan admin ke pelanggan.
- Gunakan suara yang singkat, jelas, dan tidak mengganggu.
- Tambahkan pengaturan untuk mengaktifkan / menonaktifkan suara, volume, mode silent, dan preview suara.

--------------------------------------------------

C. INTEGRASI AI CHATBOT
--------------------------------------------------

1) FAQ DALAM CHATBOT

- Di chat AI, saat pelanggan klik menu FAQ, AI harus menampilkan pilihan topik bantuan.
- AI menjawab pertanyaan pelanggan secara natural sesuai keluhan yang ditulis.
- AI harus bisa mengenali keluhan pelanggan dan mengarahkan ke pengaduan/tiket bila diperlukan.

1) PEMBUATAN TIKET OTOMATIS OLEH AI

- Setelah pelanggan menjelaskan keluhan atau meminta bantuan, AI harus:
  - memahami isi pesan,
  - mengelompokkan kategori masalah,
  - membuat tiket pengaduan otomatis,
  - memberikan nomor tiket kepada pelanggan,
  - menyimpan tiket ke menu pengaduan pelanggan,
  - meneruskan tiket ke panel admin.
- Contoh respon AI:
  - “Terima kasih, keluhan Anda telah kami catat.”
  - “Tiket bantuan Anda berhasil dibuat dengan nomor: XXXXX.”
  - “Silakan pantau status tiket di menu Pengaduan.”

1) ALUR AI KE TIKET

- AI boleh menangani pertanyaan umum terlebih dahulu.
- Jika pertanyaan masuk kategori:
  - komplain,
  - gangguan layanan,
  - permintaan bantuan teknis,
  - refund,
  - kesalahan transaksi,
  - akun bermasalah,
  - atau masalah lain yang butuh tindak lanjut,
  maka AI wajib membuat tiket otomatis.
- Jika jawaban AI tidak cukup, AI harus menawarkan pembuatan tiket manual.

1) NADA NOTIFIKASI AI

- Tambahkan notifikasi khusus saat AI membuat tiket.
- Bunyi notifikasi AI harus berbeda dari:
  - chat admin ke pelanggan,
  - chat pelanggan ke admin,
  - notifikasi sistem lainnya.

--------------------------------------------------

D. FITUR TAMBAHAN YANG LENGKAP
--------------------------------------------------

Tambahkan juga fitur berikut agar sistem lebih lengkap:

1) STATUS & PRIORITAS

- Status tiket harus jelas.
- Prioritas tiket:
  - Rendah,
  - Sedang,
  - Tinggi,
  - Mendesak.

1) NOTIFIKASI

- Notifikasi realtime untuk:
  - tiket baru,
  - balasan admin,
  - tiket diproses,
  - tiket selesai,
  - chat dibuka,
  - chat ditutup,
  - riwayat akan dihapus,
  - pengaduan dibuat dari AI,
  - pengaduan manual masuk.
- Semua notifikasi harus punya ikon, label, dan suara berbeda.

1) ATTACHMENT

- Pelanggan dapat mengunggah bukti berupa gambar, pdf, atau dokumen lain.
- Admin dapat melihat dan mengunduh lampiran.

1) RIWAYAT & ARSIP

- Simpan histori tiket yang sudah selesai sebagai arsip.
- Sediakan pencarian riwayat tiket.
- Sediakan log siapa yang mengubah status tiket.

1) SIKLUS TIKET

- Buat alur status yang konsisten:
  - Dibuat -> Menunggu Tanggapan -> Diproses -> Menunggu Informasi Tambahan -> Selesai -> Ditutup -> Riwayat Dihapus.

1) KEAMANAN

- Hanya pelanggan pemilik akun yang bisa melihat tiketnya sendiri.
- Hanya admin yang punya hak akses bisa membaca dan membalas tiket.
- Validasi input untuk mencegah spam, injeksi, dan request palsu.
- Tambahkan rate limit untuk pengiriman pesan/chat jika perlu.
- Simpan log aktivitas penting.

1) UX/UI

- Tampilkan desain modern, responsif, dan mudah digunakan di mobile maupun desktop.
- Buat tampilan tiket seperti kartu dengan badge status.
- Buat tampilan chat mirip aplikasi pesan modern.
- Buat notifikasi yang jelas dan informatif.

1) REPLY CEPAT / TEMPLATE

- Tambahkan quick reply untuk admin.
- Tambahkan shortcut untuk “balas”, “selesai”, “butuh info tambahan”, “eskalasi”.

1) SLA / BATAS WAKTU

- Tambahkan pengaturan SLA untuk setiap kategori tiket.
- Jika tiket melewati batas waktu, tampilkan label terlambat.

1) EKSPOR DATA

- Admin bisa export laporan tiket ke PDF/Excel jika diperlukan.

--------------------------------------------------

E. LOGIKA SISTEM
--------------------------------------------------

Gunakan logika berikut:

1. Pelanggan masuk ke menu pengaduan.
2. Pelanggan bisa memilih:
   - pengaduan manual, atau
   - bertanya di AI chatbot.
3. Jika AI mendeteksi keluhan:
   - AI menjawab seperlunya,
   - lalu membuat tiket otomatis,
   - tiket muncul di menu pelanggan dan admin.
4. Admin melihat tiket masuk di dashboard.
5. Admin menekan “Mulai Chat” untuk membuka live chat.
6. Setelah chat aktif:
   - pesan terkirim realtime,
   - pelanggan dan admin bisa saling balas tanpa refresh.
7. Setelah masalah selesai:
   - admin menutup tiket,
   - chat dikunci,
   - pelanggan tidak bisa membalas lagi.
8. Sistem menampilkan countdown penghapusan riwayat chat sesuai setting admin.
9. Setelah waktu habis:
   - riwayat chat dihapus otomatis,
   - tiket tetap tercatat sesuai kebijakan arsip.

--------------------------------------------------

F. PESAN KATA-KATA YANG DIPAKAI
--------------------------------------------------

Gunakan kata-kata UI berikut:

- “Pengaduan Anda telah diterima.”
- “Nomor tiket Anda adalah: XXXXX.”
- “Menunggu Tanggapan Admin.”
- “Chat belum dimulai oleh admin.”
- “Silakan tunggu tim kami memulai percakapan.”
- “Percakapan telah berakhir.”
- “Anda tidak dapat mengirim pesan lagi.”
- “Riwayat chat akan dihapus dalam: hh jam mm menit ss detik.”
- “Keluhan Anda sedang kami proses.”
- “Terima kasih, bantuan Anda telah dicatat.”

--------------------------------------------------

G. KELUARAN YANG DIHARAPKAN
--------------------------------------------------

Buatkan:

- struktur database/tabel,
- alur logika backend,
- alur realtime chat,
- struktur status tiket,
- komponen UI pelanggan,
- komponen UI admin,
- logika AI chatbot untuk membuat tiket,
- validasi form,
- notifikasi,
- pengaturan suara notifikasi,
- dan rancangan fitur secara lengkap dan siap diimplementasikan.

Pastikan fitur ini benar-benar terintegrasi antara pelanggan, admin, dan AI chatbot, dengan live chat realtime, tiket otomatis, penguncian chat, suara notifikasi berbeda, serta penghapusan riwayat sesuai waktu yang diatur admin.
