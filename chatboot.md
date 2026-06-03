Buatkan fitur LIVE CHAT REALTIME antara pelanggan dan kasir yang terintegrasi penuh di aplikasi restoran, dengan alur yang sinkron antara sisi pelanggan dan sisi kasir. Fitur ini harus aman, cepat, modern, dan benar-benar realtime.

NAMA FITUR:
Live Chat Pesanan Pelanggan–Kasir

TUJUAN UTAMA:

1. Pelanggan dapat membuka chat langsung dari menu "Pesanan Saya" pada pesanan yang dipilih.
2. Saat pelanggan klik salah satu pesanan, tampil tombol/menu "Chat Kasir".
3. Setelah dibuka, pelanggan dapat chat dengan kasir secara realtime.
4. Di sisi kasir, buat menu "Live Chat" yang menampilkan semua percakapan pelanggan secara realtime.
5. Chat di kasir harus dipisahkan berdasarkan jenis order:
   - Dine In
   - Take Away
   - Delivery
6. Saat kasir klik salah satu chat, tampil detail lengkap:
   - Nomor pesanan
   - Nama pelanggan
   - Jenis order
   - Status pesanan
   - Riwayat chat
   - Isi chat terbaru
7. Kasir dapat membalas pelanggan secara realtime.
8. Sistem harus sinkron penuh antara pelanggan dan kasir tanpa perlu refresh manual.

LOGIKA UTAMA:

1. Jika pelanggan membuka chat terlebih dahulu dan mengirim pesan, AI otomatis boleh menjawab terlebih dahulu.
2. AI harus memahami konteks seluruh percakapan pelanggan berdasarkan:
   - nomor pesanan
   - jenis order
   - status pesanan
   - isi percakapan sebelumnya
   - data pelanggan terkait pesanan tersebut
3. AI hanya boleh menjawab sesuai konteks layanan pesanan dan bantuan pelanggan.
4. AI DILARANG menjawab di luar konteks, misalnya:
   - membuatkan kode program
   - menjawab topik umum yang tidak terkait pesanan
   - membahas hal yang tidak berhubungan dengan restoran, order, atau layanan pelanggan
5. AI harus mengikuti aturan dan gaya jawaban yang sama seperti RestoBoot AI yang sudah ada.
6. Jika kasir mulai membalas chat secara manual, maka AI harus berhenti membalas untuk percakapan tersebut.
7. Jika kasir membalas lagi nanti, sistem tetap mengutamakan chat manual kasir, bukan AI.
8. Jika kasir sedang offline atau belum merespons dalam waktu tertentu, AI boleh membantu menjawab sesuai konteks pesanan.
9. Bila pertanyaan pelanggan sensitif, spesifik, atau membutuhkan tindakan manual, AI harus mengarahkan ke kasir.

FITUR PELANGGAN:

1. Menu "Pesanan Saya" menampilkan semua pesanan aktif dan riwayat.
2. Setiap pesanan memiliki tombol "Chat Kasir".
3. Pelanggan dapat melihat:
   - status online kasir
   - status pesan terkirim / dibaca / dibalas
   - notifikasi jika ada balasan baru
4. Tersedia indikator:
   - mengetik
   - pesan diterima
   - pesan dibaca
5. Pelanggan hanya bisa chat untuk pesanan yang memang miliknya.
6. Chat otomatis terhubung ke pesanan yang dipilih agar tidak tercampur dengan pesanan lain.

FITUR KASIR:

1. Tambahkan menu "Live Chat" pada dashboard kasir.
2. Daftar chat harus dikelompokkan berdasarkan:
   - Dine In
   - Take Away
   - Delivery
3. Di setiap chat tampil ringkasan:
   - nama pelanggan
   - nomor pesanan
   - jenis order
   - pesan terakhir
   - waktu terakhir aktif
   - status unread
4. Saat chat dibuka, tampil panel detail pesanan di samping percakapan.
5. Kasir bisa membalas langsung dan realtime.
6. Kasir bisa menandai chat:
   - selesai
   - menunggu respon pelanggan
   - perlu bantuan admin
7. Kasir dapat mencari chat berdasarkan:
   - nama pelanggan
   - nomor pesanan
   - jenis order
   - isi pesan

FUNGSI REALTIME YANG WAJIB:

1. Pesan masuk dan keluar muncul tanpa reload.
2. Status online/offline terlihat realtime.
3. Indikator typing realtime.
4. Sinkronisasi pesan antara pelanggan dan kasir instan.
5. Notifikasi unread pada sisi kasir dan pelanggan.
6. Riwayat chat tersimpan otomatis.
7. Percakapan tetap ada walau halaman ditutup dan dibuka kembali.

ATURAN AI PADA CHAT:

1. AI hanya menjawab jika chat berkaitan dengan pesanan, menu, status pesanan, pembayaran, estimasi, komplain, atau bantuan operasional restoran.
2. AI harus sopan, singkat, jelas, dan membantu.
3. AI harus menolak permintaan di luar konteks secara halus.
4. AI harus memahami bahasa santai pelanggan, typo, singkatan, dan kalimat tidak formal.
5. AI harus bisa membaca konteks percakapan sebelumnya agar tidak menjawab ngawur.
6. Jika ada pertanyaan yang butuh konfirmasi staf, AI harus memberi tahu bahwa kasir akan menindaklanjuti.
7. Jika kasir sudah membalas manual, AI tidak boleh ikut mengganggu percakapan itu.

FITUR TAMBAHAN YANG HARUS ADA:

1. Tombol blokir chat jika ada spam atau penyalahgunaan.
2. Filter kata kasar / spam / pengulangan pesan.
3. Template balasan cepat untuk kasir.
4. Lampiran gambar jika pelanggan ingin mengirim bukti, misalnya bukti pembayaran atau foto pesanan.
5. Penanda status chat:
   - aktif
   - selesai
   - menunggu kasir
   - dibalas AI
   - dibalas manual
6. Log aktivitas chat untuk audit admin.
7. Notifikasi bunyi / badge pesan baru.
8. Integrasi dengan detail pesanan agar kasir langsung melihat item yang dipesan.
9. Jika pesanan sudah selesai, chat tetap bisa dibuka dalam mode riwayat, tetapi dibatasi untuk kebutuhan bantuan.
10. Chat harus aman, terenkripsi, dan terikat pada akun pelanggan serta nomor pesanan.

LOGIKA SISTEM SECARA RINGKAS:

1. Pelanggan pilih pesanan → klik Chat Kasir.
2. Sistem membuka room chat khusus berdasarkan nomor pesanan.
3. Jika pelanggan mengirim pesan dan kasir belum merespons, AI boleh menjawab otomatis hanya jika relevan.
4. Jika kasir membalas manual, AI berhenti aktif di room tersebut.
5. Kasir melihat chat masuk berdasarkan kategori order.
6. Kasir dapat membaca detail pesanan sebelum membalas.
7. Semua pesan tersimpan realtime dan tersinkron di pelanggan serta kasir.
8. Saat order selesai, chat disimpan sebagai histori.

IMPLEMENTASI YANG DIHARAPKAN:

- Gunakan arsitektur realtime yang stabil dan scalable.
- Gunakan sistem room chat per order.
- Gunakan ID unik untuk setiap percakapan.
- Gunakan event realtime untuk pesan masuk, pesan dibaca, typing, dan status online.
- Pastikan UI responsif untuk mobile dan desktop.
- Pastikan desain modern, bersih, dan mudah digunakan.

HASIL AKHIR YANG DIINGINKAN:
Buatkan fitur live chat pelanggan–kasir yang lengkap, realtime, sinkron, terstruktur berdasarkan jenis order, memiliki AI yang cerdas namun terbatas konteks, dan mampu berhenti otomatis saat kasir membalas manual. Pastikan seluruh sistem bekerja stabil, aman, dan terintegrasi dengan fitur pesanan yang sudah ada.
