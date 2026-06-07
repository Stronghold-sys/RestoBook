========================
16. RESERVASI DIBATALKAN OLEH KASIR DAN OPSI REFUND DI MENU RESERVASI DIBATALKAN
========================

Tambahkan fitur agar jika reservasi dibatalkan oleh kasir, maka pada halaman pelanggan di menu “Reservasi Dibatalkan” harus tampil informasi yang jelas bahwa pembatalan dilakukan oleh kasir beserta detailnya.

A. STATUS PEMBATALAN OLEH KASIR

Jika reservasi dibatalkan oleh kasir, tampilkan status:

- Dibatalkan
- Dibatalkan oleh Kasir
- Nama kasir yang membatalkan
- Alasan pembatalan
- Tanggal dan waktu pembatalan

Sistem harus menyimpan:

- cancelled_by
- cancelled_role = kasir
- cancellation_reason
- cancellation_time
- cancellation_source

Tampilan pada pelanggan harus menegaskan:

- “Reservasi ini dibatalkan oleh kasir.”
- “Alasan pembatalan: {{reason}}”
- “Waktu pembatalan: {{time}}”

B. OPSI REFUND PADA MENU RESERVASI DIBATALKAN

Di halaman pelanggan pada menu “Reservasi Dibatalkan”, jika reservasi dibatalkan oleh kasir dan terdapat pembayaran yang sudah masuk, maka tampilkan tombol:

- Ajukan Refund

Tombol refund harus muncul jika:

- pembayaran sudah lunas, atau
- pembayaran DP sudah dibayar sebagian, atau
- terdapat nominal yang sudah masuk dan dapat dikembalikan

Tombol refund tidak muncul jika:

- belum ada pembayaran sama sekali
- refund sudah pernah diajukan
- refund sedang diproses
- refund sudah selesai

C. LOGIKA TAMPILAN REFUND

Jika pembayaran sudah lunas atau DP sudah dibayar, maka pada detail reservasi yang dibatalkan tampilkan informasi:

- Total pembayaran
- Nominal yang sudah dibayar
- Nominal yang dapat direfund
- Status refund saat ini
- Metode refund yang tersedia

Jika metode pembayaran adalah:

1. Tunai
   - jika ada pembayaran yang sudah diterima, tampilkan opsi refund sesuai nominal yang dibayarkan
   - refund hanya muncul jika memang ada uang yang harus dikembalikan

2. DP
   - refund dapat diajukan sesuai nominal DP yang sudah dibayar
   - nominal refund dihitung berdasarkan aturan charge pembatalan yang berlaku jika pembatalan terjadi setelah pesanan diproses

3. DompetKu
   - refund dapat dikembalikan ke saldo DompetKu pelanggan
   - jika DompetKu belum aktif, tampilkan peringatan dan arahkan ke Transfer Bank

4. Non Tunai / Transfer
   - refund dapat diproses melalui metode yang diverifikasi oleh resto

D. FORM PENGAJUAN REFUND

Saat pelanggan menekan tombol “Ajukan Refund”, tampilkan modal form refund yang berisi:

- Nomor Reservasi
- Nama Pelanggan
- Nomor Telepon
- Email
- Tanggal Reservasi
- Jam Reservasi
- Status Reservasi
- Status Pembayaran
- Alasan Pembatalan
- Nominal Refund
- Metode Pengembalian Dana
  - DompetKu
  - Transfer Bank
- Data rekening / akun DompetKu tujuan
- Upload bukti pendukung
- Catatan tambahan

Tambahkan kalimat peringatan sebelum submit:

- “Pastikan seluruh data yang Anda isi sudah benar sebelum mengajukan refund.”
- “Periksa kembali nominal refund, rekening tujuan, atau akun DompetKu agar tidak terjadi kesalahan pencairan dana.”
- “Dengan menekan tombol ajukan, Anda menyatakan bahwa data yang diisi sudah benar dan dapat dipertanggungjawabkan.”

E. VALIDASI TOMBOL REFUND

Tombol “Ajukan Refund” hanya aktif jika:

- reservasi dibatalkan oleh kasir
- ada nominal pembayaran yang sudah masuk
- data refund wajib telah diisi
- metode refund valid
- jika DompetKu dipilih, akun DompetKu pelanggan aktif

Jika metode Transfer dipilih:

- nama bank wajib diisi
- nama pemilik rekening wajib diisi
- nomor rekening wajib diisi
- nomor rekening harus valid

F. STATUS SETELAH PENGAJUAN REFUND

Setelah pelanggan mengajukan refund, status harus berubah menjadi:

- Pengajuan Refund
- Menunggu Peninjauan

Dan tetap tampil di:

- menu “Reservasi Dibatalkan”
- menu “Riwayat”
- menu “Pengajuan Refund”

Status lanjutan:

- Menunggu Verifikasi
- Disetujui
- Ditolak
- Dana Dikirim
- Refund Selesai

G. REFUND DI ADMIN / RESTO

Semua pengajuan refund dari reservasi yang dibatalkan oleh kasir harus masuk ke menu Refund Admin dengan data lengkap, termasuk:

- status dibatalkan oleh kasir
- identitas kasir yang membatalkan
- alasan pembatalan
- nominal refund
- metode refund
- bukti pendukung
- status pembayaran sebelumnya
- status refund terakhir

Saat resto menyetujui refund:

- status menjadi Disetujui
- jika DompetKu, saldo dikreditkan ke akun DompetKu pelanggan
- jika Transfer, dana ditransfer ke rekening pelanggan
- pelanggan menerima notifikasi realtime

H. RIWAYAT DAN REALTIME

Tambahkan riwayat khusus untuk:

- reservasi dibatalkan oleh kasir
- pengajuan refund dari pembatalan kasir
- refund disetujui
- refund ditolak
- refund selesai

Semua perubahan status harus realtime untuk:

- pelanggan
- kasir
- resto/admin

I. LOGIKA UTAMA

- Jika kasir membatalkan reservasi dan ada pembayaran yang sudah masuk, maka sistem wajib menampilkan opsi refund.
- Jika tidak ada pembayaran, tombol refund tidak boleh muncul.
- Jika pembatalan berasal dari kasir, pelanggan harus bisa melihat siapa yang membatalkan.
- Jika refund diajukan, data harus masuk ke menu refund admin dan riwayat pelanggan.
- Jika refund disetujui, dana dikreditkan atau ditransfer sesuai metode yang dipilih.
- Semua aksi harus tercatat dalam audit log.

J. AUDIT LOG

Simpan log lengkap untuk:

- reservasi dibatalkan oleh kasir
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
