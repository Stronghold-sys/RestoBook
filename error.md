TAMBAHAN FITUR: PEMBATALAN OLEH KASIR, REFUND, RIWAYAT, DAN REALTIME UPDATE

Tambahkan juga alur ketika reservasi dibatalkan oleh kasir, sehingga sistem menampilkan informasi yang jelas kepada pelanggan mengenai siapa yang membatalkan reservasi.

1. PEMBATALAN RESERVASI OLEH KASIR
Jika reservasi dibatalkan oleh kasir, maka di halaman pelanggan status reservasi harus menampilkan:

- “Dibatalkan”
- “Dibatalkan oleh kasir”
- atau “Dibatalkan oleh resto” sesuai role yang melakukan pembatalan

Sistem harus menyimpan:

- siapa yang membatalkan
- role yang membatalkan
- alasan pembatalan
- waktu pembatalan
- status reservasi sebelum dan sesudah dibatalkan

Jika pembayarannya sudah lunas, maka tombol “Refund” harus muncul di halaman pelanggan.

1. FITUR REFUND JIKA PEMBATALAN OLEH KASIR
Jika reservasi dibatalkan dan pembayaran sudah lunas atau DP sudah dibayar sebagian, maka pelanggan dapat mengajukan refund.

Tombol refund harus menampilkan modal form pengajuan refund yang berisi:

- nama pelanggan
- nomor reservasi
- alasan refund
- jumlah nominal yang diajukan
- metode pencairan dana:
  - DompetKu
  - Transfer

Jika pelanggan memilih DompetKu:

- refund akan dikreditkan langsung ke akun DompetKu pelanggan

Jika pelanggan memilih Transfer:

- pelanggan wajib mengisi detail rekening tujuan secara lengkap:
  - nama bank
  - nama pemilik rekening
  - nomor rekening
  - cabang bank jika diperlukan

Jika pelanggan memilih metode yang belum aktif atau tidak valid, tampilkan peringatan:

- “Metode pencairan yang dipilih belum aktif.”

1. KALIMAT ATURAN SEBELUM PENGAJUAN REFUND
Saat pelanggan menekan tombol “Ajukan Refund”, tampilkan modal pop-up berisi aturan berikut:

- Pastikan seluruh data yang Anda input sudah benar sebelum mengajukan refund.
- Periksa kembali nomor rekening atau akun DompetKu tujuan agar tidak terjadi kesalahan pencairan dana.
- Refund hanya dapat diproses sesuai metode pencairan yang dipilih dan data yang telah diverifikasi.
- Jika data tidak sesuai, resto berhak menolak pengajuan refund.
- Dengan menekan tombol “Ajukan Refund”, pelanggan menyatakan bahwa seluruh data yang diisi sudah benar dan dapat dipertanggungjawabkan.

1. STATUS SETELAH PENGAJUAN REFUND
Setelah pelanggan mengajukan refund, status reservasi dan refund harus berubah menjadi:

- “Pengajuan Refund”
- “Menunggu Peninjauan”
- “Menunggu Verifikasi”
- “Disetujui”
- “Ditolak”
- “Dana Dikirim”
- “Refund Selesai”

Saat pengajuan masuk, pelanggan harus melihat status:

- “Pengajuan refund sedang diproses”

1. PROSES DI MENU REFUND ADMIN
Pada menu refund di admin/resto, tampilkan data refund yang masuk dengan detail:

- jenis pengajuan: reservasi / pesanan / gabungan
- nama pelanggan
- nomor reservasi
- status pembayaran sebelumnya
- nominal refund
- metode pengembalian dana
- bukti pendukung
- alasan pembatalan
- status terakhir

Saat resto menekan tombol setujui:

- status berubah menjadi “Disetujui”
- jika metode DompetKu, dana dikreditkan ke DompetKu pelanggan
- jika metode Transfer, dana ditransfer ke rekening pelanggan
- pelanggan mendapat notifikasi bahwa dana telah dikirim

Saat resto menekan tombol tolak:

- status berubah menjadi “Ditolak”
- tampilkan alasan penolakan

1. PESAN STATUS UNTUK PELANGGAN
Jika refund disetujui, tampilkan pesan:

- “Refund Anda telah disetujui.”
- “Dana telah dikreditkan ke DompetKu Anda.” jika metode DompetKu
- “Dana telah ditransfer ke rekening Anda.” jika metode Transfer
- “Silakan periksa saldo DompetKu atau rekening bank Anda.”

Jika refund masih diproses, tampilkan pesan:

- “Refund sedang diproses oleh resto.”

1. RIWAYAT REFUND DAN FILTER
Tambahkan halaman riwayat yang menampilkan semua:

- reservasi aktif
- reservasi dibatalkan
- pengajuan refund
- refund disetujui
- refund ditolak
- refund selesai

Tambahkan filter riwayat:

- berdasarkan status
- berdasarkan tanggal
- berdasarkan metode pengembalian dana
- berdasarkan jenis pengajuan
- berdasarkan nomor reservasi
- berdasarkan nama pelanggan

Tambahkan juga pencarian cepat:

- nama pelanggan
- nomor reservasi
- status refund

1. REALTIME UPDATE
Pastikan setiap perubahan status tampil secara realtime di semua role:

- pelanggan
- kasir
- resto/admin

Perubahan yang harus realtime:

- status reservasi
- status pembatalan
- status refund
- status persetujuan
- status pembayaran
- status pengiriman dana

Gunakan mekanisme realtime seperti websocket, SSE, polling otomatis, atau sistem notifikasi internal agar data selalu sinkron tanpa refresh manual.

1. LOGIKA UTAMA YANG HARUS DITERAPKAN

- Jika reservasi dibatalkan oleh kasir, status pelanggan harus langsung berubah dan menampilkan siapa yang membatalkan.
- Jika pembayaran sudah lunas, tombol refund harus aktif.
- Jika pelanggan mengajukan refund, data harus masuk ke antrian refund resto.
- Jika refund disetujui, sistem mengubah status menjadi selesai dan mengirim notifikasi ke pelanggan.
- Jika refund menggunakan DompetKu, saldo harus masuk ke akun DompetKu pelanggan.
- Jika refund menggunakan Transfer, sistem mencatat bahwa dana telah diproses ke rekening tujuan.
- Semua perubahan status harus tersimpan dalam log riwayat dan tampil realtime di seluruh role.

1. VALIDASI PENTING
Pastikan:

- data rekening wajib lengkap jika metode transfer dipilih
- metode DompetKu hanya bisa dipilih jika akun aktif
- pengajuan refund tidak bisa dikirim jika data belum lengkap
- pelanggan menerima peringatan untuk memeriksa kembali data sebelum submit
- restoran/kasir/resto dapat melihat siapa yang membatalkan reservasi
- seluruh riwayat refund dapat difilter dan ditelusuri kembali
- setiap perubahan status tersimpan aman di database dan log audit

1. TAMPILAN YANG DIINGINKAN

- modal refund yang jelas dan profesional
- status pembatalan yang transparan
- riwayat refund dengan filter lengkap
- notifikasi realtime
- badge status yang mudah dibaca
- desain responsif di mobile dan desktop

Buat seluruh fitur ini terintegrasi penuh dengan halaman pelanggan, kasir, resto/admin, refund, dan riwayat, serta pastikan semua perubahan data dan status berjalan realtime.

========================
13. PEMBATALAN OLEH KASIR, REFUND, RIWAYAT, DAN REALTIME UPDATE
========================

A. PEMBATALAN RESERVASI OLEH KASIR

Tambahkan fitur agar kasir dapat membatalkan reservasi apabila diperlukan sesuai kewenangan yang diberikan.

Saat reservasi dibatalkan oleh kasir:

- Status reservasi pelanggan harus langsung berubah realtime.
- Tampilkan informasi:
  - Dibatalkan
  - Dibatalkan oleh Kasir
  - Nama kasir yang membatalkan
  - Alasan pembatalan
  - Tanggal dan waktu pembatalan

Simpan data:

- cancelled_by
- cancelled_role
- cancellation_reason
- cancellation_time

Tampilkan di halaman pelanggan:

“Reservasi ini dibatalkan oleh kasir.”
“Alasan pembatalan: {{reason}}”

Jika pembatalan dilakukan oleh resto/admin:

“Reservasi ini dibatalkan oleh pihak resto.”

==================================================
B. TOMBOL REFUND OTOMATIS SETELAH PEMBATALAN
==================================================

Jika reservasi dibatalkan dan:

- pembayaran lunas
ATAU
- pembayaran DP sudah diterima

Maka otomatis tampil tombol:

- Ajukan Refund

Jika belum ada pembayaran:

- tombol refund tidak muncul

==================================================
C. MODAL PENGAJUAN REFUND
==================================================

Saat pelanggan klik “Ajukan Refund” tampilkan modal.

Sebelum form tampil, munculkan peringatan:

“Pastikan seluruh data yang Anda masukkan sudah benar.”
“Periksa kembali rekening atau akun DompetKu tujuan.”
“Kesalahan pengisian data dapat menyebabkan keterlambatan proses refund.”
“Dengan melanjutkan, Anda menyatakan data yang diberikan sudah benar.”

Field wajib:

- Nama Pelanggan
- Nomor Reservasi
- Alasan Refund
- Nominal Refund
- Metode Pengembalian Dana

Pilihan metode:

1. DompetKu
2. Transfer Bank

==================================================
D. REFUND KE DOMPETKU
==================================================

Jika pelanggan memilih DompetKu:

- pastikan akun DompetKu aktif
- tampilkan nomor akun DompetKu
- dana dikreditkan ke saldo DompetKu pelanggan

Jika DompetKu belum aktif:

Tampilkan:

“Fitur DompetKu belum aktif pada akun Anda.”
“Silakan gunakan metode Transfer Bank.”

Tombol submit tidak boleh aktif.

==================================================
E. REFUND KE TRANSFER BANK
==================================================

Jika pelanggan memilih Transfer:

Wajib isi:

- Nama Bank
- Nama Pemilik Rekening
- Nomor Rekening
- Cabang Bank (opsional)
- Catatan Tambahan (opsional)

Validasi:

- semua field wajib terisi
- nomor rekening hanya angka
- panjang rekening valid

==================================================
F. STATUS REFUND
==================================================

Setelah pelanggan mengirim pengajuan:

Status menjadi:

- Pengajuan Refund
- Menunggu Peninjauan

Tampilkan:

“Pengajuan refund Anda telah dikirim dan sedang menunggu peninjauan pihak resto.”

Status yang tersedia:

- Pengajuan Refund
- Menunggu Peninjauan
- Menunggu Verifikasi
- Disetujui
- Ditolak
- Dana Dikirim
- Refund Selesai

==================================================
G. MENU REFUND DI ADMIN
==================================================

Tambahkan halaman:

Refund Management

Pisahkan kategori:

- Refund Reservasi
- Refund Pesanan Menu
- Refund Gabungan

Data yang tampil:

- Nama Pelanggan
- Nomor Reservasi
- Nominal Refund
- Metode Refund
- Status Refund
- Status Pembayaran
- Alasan Refund
- Bukti Pendukung
- Tanggal Pengajuan

==================================================
H. PERSETUJUAN REFUND
==================================================

Saat resto menyetujui refund:

Status:

- Disetujui

Jika metode:

DompetKu:

- saldo otomatis masuk ke DompetKu pelanggan

Status:

- Dana Dikirim
- Refund Selesai

Notifikasi pelanggan:

“Refund Anda telah disetujui.”
“Dana telah dikreditkan ke akun DompetKu Anda.”
“Silakan periksa saldo DompetKu Anda.”

Jika metode:

Transfer:

Status:

- Dana Dikirim

Notifikasi:

“Refund Anda telah disetujui.”
“Dana telah ditransfer ke rekening yang Anda daftarkan.”
“Silakan periksa rekening Anda.”

==================================================
I. PENOLAKAN REFUND
==================================================

Jika ditolak:

Status:

- Ditolak

Wajib isi:

- alasan penolakan

Pelanggan melihat:

“Pengajuan refund ditolak.”
“Alasan: {{reason}}”

==================================================
J. RIWAYAT PELANGGAN
==================================================

Tambahkan halaman:

Riwayat

Kategori:

- Reservasi Aktif
- Reservasi Selesai
- Reservasi Dibatalkan
- Pengajuan Refund
- Refund Disetujui
- Refund Ditolak
- Refund Selesai

Tambahkan filter:

- Status
- Rentang Tanggal
- Metode Refund
- Jenis Refund
- Nomor Reservasi

Tambahkan pencarian:

- Nama
- Nomor Reservasi
- Status

==================================================
K. REALTIME UPDATE
==================================================

Semua perubahan wajib realtime.

Role yang menerima update:

- Pelanggan
- Kasir
- Dapur
- Admin/Resto

Realtime untuk:

- Status Reservasi
- Status Check-in
- Status Pembayaran
- Status DP
- Status Refund
- Status Pembatalan
- Status Persetujuan
- Status Meja

Gunakan:

- WebSocket
ATAU
- Server Sent Events (SSE)
ATAU
- Realtime Listener

Tanpa perlu refresh halaman.

==================================================
L. LOG AKTIVITAS
==================================================

Simpan audit log lengkap:

- Reservasi dibuat
- Reservasi dikonfirmasi
- Reservasi dibatalkan
- Siapa yang membatalkan
- Check-in
- Refund diajukan
- Refund disetujui
- Refund ditolak
- Dana dikirim
- Perubahan status meja
- Perubahan status pembayaran
- Perubahan konfigurasi

Data log:

- user_id
- role
- action
- old_value
- new_value
- timestamp

==================================================
M. VALIDASI PENTING
==================================================

Pastikan:

- Refund tidak dapat diajukan dua kali.
- Refund hanya muncul jika ada pembayaran.
- DompetKu harus aktif sebelum digunakan.
- Data rekening wajib lengkap.
- Semua perubahan status tersimpan.
- Semua perubahan tampil realtime.
- Semua role melihat data yang sesuai hak aksesnya.
- Riwayat tidak boleh hilang meskipun reservasi sudah selesai.
- Semua transaksi refund dan pembayaran tercatat dalam audit log.

==================================================
N. PENYEMPURNAAN MODAL "AJUKAN SEKARANG"
==================================================

Sebelum pelanggan menekan tombol:

"Lanjut Ajukan"

Tambahkan peringatan:

“Mohon periksa kembali seluruh data reservasi Anda sebelum melanjutkan.”

Pastikan pelanggan memeriksa:

- Tanggal Reservasi
- Jam Booking
- Jumlah Tamu
- Meja yang Dipilih
- Pesanan Menu
- Metode Pembayaran
- Nominal DP
- Data Kontak

Tambahkan checkbox:

☐ Saya telah memeriksa kembali seluruh data reservasi dan pesanan saya.

Tombol lanjut hanya aktif jika:

- Checkbox aturan dicentang
- Checkbox pemeriksaan data dicentang

Setelah berhasil diajukan:

Status awal:

- Menunggu Konfirmasi
- Menunggu Pembayaran (jika belum bayar)
- DP Dibayar (jika DP berhasil)
- Lunas (jika lunas)

Simpan waktu persetujuan aturan dan waktu persetujuan pemeriksaan data ke database.
