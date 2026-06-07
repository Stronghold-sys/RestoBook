========================
15. PENYEMPURNAAN FITUR PEMBATALAN DAN REFUND
========================

A. DATA REFUND HARUS MUNCUL LENGKAP DI HALAMAN REFUND ADMIN

Pastikan semua pengajuan refund dari pelanggan masuk ke halaman Refund Admin dan menampilkan data lengkap yang sama seperti yang diisi pelanggan saat form pengajuan refund.

Data yang wajib tampil di halaman Refund Admin:

- Nomor Refund
- Nomor Reservasi
- Nama Pelanggan
- Nomor Telepon
- Email
- Tanggal Reservasi
- Jam Reservasi
- Jenis Refund
- Alasan Refund
- Nominal Refund
- Metode Refund
- Nama Bank
- Nama Pemilik Rekening
- Nomor Rekening
- Akun DompetKu
- Bukti Pendukung
- Catatan Tambahan
- Status Reservasi
- Status Pembayaran
- Status Refund
- Dibuat Oleh
- Dikonfirmasi Oleh
- Waktu Pengajuan
- Waktu Dikonfirmasi
- Waktu Dana Dikirim
- Alasan Penolakan jika ada

Tambahkan fitur filter di Refund Admin:

- berdasarkan status refund
- berdasarkan status reservasi
- berdasarkan metode refund
- berdasarkan jenis refund
- berdasarkan tanggal pengajuan
- berdasarkan nomor reservasi
- berdasarkan nama pelanggan

B. LOGIKA PEMBATALAN RESERVASI

1. Jika reservasi belum dikonfirmasi:

- tombol “Batalkan Pesanan” / “Batalkan Reservasi” tetap muncul
- saat diklik, tampilkan formulir pembatalan
- jika pembayaran belum ada, pembatalan diproses tanpa refund
- jika pembayaran sudah ada, tampilkan form refund sesuai metode pembayaran yang dipakai

1. Jika reservasi sudah dikonfirmasi oleh kasir/resto:

- saat pelanggan klik “Batalkan Pesanan”, tampilkan formulir pembatalan/refund
- jika pembayaran menggunakan DP, DompetKu, atau non tunai, tampilkan opsi refund
- jika pembayaran tunai penuh dan reservasi sudah dikonfirmasi, maka opsi batalkan tidak boleh tersedia
- tampilkan pesan:
  “Reservasi ini sudah dikonfirmasi dan dibayar tunai, sehingga pembatalan tidak dapat dilakukan melalui sistem.”

1. Jika reservasi sudah dikonfirmasi tetapi belum dibayar tunai penuh:

- tombol batalkan tetap bisa muncul hanya jika sistem mengizinkan
- jika dibatalkan, form refund wajib ditampilkan
- jika belum ada pembayaran, form refund tidak perlu menampilkan metode pengembalian dana

C. LOGIKA MUNCULNYA FORMULIR PEMBATALAN / REFUND

Saat pelanggan menekan tombol batalkan, tampilkan form sesuai kondisi berikut:

1. Jika reservasi belum dikonfirmasi:

- tampilkan formulir pembatalan
- tampilkan data reservasi
- jika ada pembayaran, tampilkan bagian refund
- jika tidak ada pembayaran, bagian refund disembunyikan

1. Jika reservasi sudah dikonfirmasi:

- tampilkan formulir pembatalan lengkap
- tampilkan alasan pembatalan
- tampilkan data refund jika ada pembayaran yang harus dikembalikan
- tampilkan bukti pendukung bila diminta
- tampilkan peringatan untuk memeriksa kembali data sebelum submit

D. ATURAN REFUND BERDASARKAN METODE PEMBAYARAN

1. Jika pembayaran tunai:

- jika reservasi belum dikonfirmasi, pembatalan dapat diproses tanpa opsi refund
- jika reservasi sudah dikonfirmasi, tombol batalkan tidak boleh digunakan
- opsi refund tidak boleh muncul

1. Jika pembayaran DP:

- jika dibatalkan, tampilkan form refund
- nominal refund dihitung berdasarkan pembayaran yang sudah masuk setelah dikurangi charge bila berlaku
- jika pembatalan sebelum pesanan disiapkan, refund mengikuti kebijakan resto
- jika pembatalan setelah pesanan disiapkan, charge pembatalan diterapkan sesuai persentase yang diatur resto

1. Jika pembayaran DompetKu:

- refund dapat dikembalikan ke saldo DompetKu pelanggan
- jika DompetKu belum aktif, tampilkan peringatan dan arahkan ke transfer bank

1. Jika pembayaran transfer/non tunai:

- refund dikembalikan melalui metode yang sesuai dan diverifikasi oleh resto

E. FORMULIR PEMBATALAN YANG HARUS MUNCUL

Saat pelanggan membatalkan reservasi, tampilkan formulir dengan data berikut:

- Nomor Reservasi
- Nama Pelanggan
- Nomor Telepon
- Email
- Tanggal Reservasi
- Jam Reservasi
- Status Reservasi
- Status Pembayaran
- Alasan Pembatalan
- Jenis Pembatalan
  - Pembatalan Reservasi
  - Pembatalan Pesanan
  - Pembatalan Gabungan
- Nominal Refund
- Metode Pengembalian Dana
  - DompetKu
  - Transfer Bank
- Data rekening / akun DompetKu tujuan
- Upload bukti pendukung
- Catatan tambahan

Tambahkan kalimat sebelum tombol ajukan:

- “Pastikan seluruh data yang Anda isi sudah benar sebelum mengajukan pembatalan/refund.”
- “Periksa kembali nomor rekening, akun DompetKu, dan nominal refund agar tidak terjadi kesalahan pencairan dana.”
- “Dengan menekan tombol ajukan, Anda menyatakan bahwa data yang diisi sudah benar.”

F. LOGIKA STATUS SETELAH PENGAJUAN

Setelah pelanggan menekan tombol ajukan:

- status pembatalan menjadi “Pengajuan Pembatalan”
- status refund menjadi “Pengajuan Refund” atau “Menunggu Peninjauan”
- data masuk ke menu Refund Admin
- data tampil di riwayat pelanggan
- notifikasi realtime dikirim ke pelanggan, kasir, dan resto

Status yang harus tersedia:

- Pengajuan Pembatalan
- Pengajuan Refund
- Menunggu Peninjauan
- Menunggu Verifikasi
- Disetujui
- Ditolak
- Dana Dikirim
- Refund Selesai

G. PESAN STATUS UNTUK PELANGGAN

Jika pembatalan berhasil diajukan:

- “Pengajuan pembatalan Anda telah diterima.”
- “Pengajuan refund Anda sedang ditinjau oleh resto.”

Jika refund disetujui:

- “Refund Anda telah disetujui.”
- “Dana telah dikreditkan ke DompetKu Anda.” jika DompetKu
- “Dana telah ditransfer ke rekening Anda.” jika transfer

Jika refund ditolak:

- “Pengajuan refund ditolak.”
- tampilkan alasan penolakan dari resto

H. REALTIME DAN LOG

Pastikan setiap perubahan status tampil realtime di semua role:

- pelanggan
- kasir
- resto/admin

Semua perubahan wajib tercatat dalam log:

- pembatalan dibuat
- refund diajukan
- refund disetujui
- refund ditolak
- dana dikirim
- status berubah

Data log:

- user_id
- role
- action
- old_value
- new_value
- timestamp

I. VALIDASI PENTING

Pastikan:

- data refund dari pelanggan tampil lengkap di halaman refund admin
- form refund hanya muncul jika memang ada pembayaran yang harus dikembalikan
- jika pembayaran tunai dan reservasi sudah dikonfirmasi, tombol batalkan tidak boleh aktif
- jika pembayaran tunai dan reservasi belum dikonfirmasi, pembatalan boleh dilakukan tanpa opsi refund
- jika pembayaran DP atau DompetKu, refund harus mengikuti alur pengajuan yang benar
- semua perubahan status harus sinkron ke seluruh role
- riwayat refund harus bisa difilter dan ditelusuri
- data pembatalan dan refund harus aman, lengkap, dan konsisten di database
