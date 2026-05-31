Tambahkan fitur notifikasi khusus untuk sistem reward point pelanggan dan tampilkan langsung di halaman Notifikasi yang sudah ada.

Tujuan:
Setiap aktivitas terkait point harus otomatis muncul sebagai notifikasi pelanggan, sejajar dengan notifikasi pesanan, reservasi, pembayaran, dan sistem lainnya.

Gunakan format notifikasi yang sama dengan daftar notifikasi existing agar tampilan tetap konsisten.

Jenis notifikasi point yang wajib ditambahkan:

1. Point Ditahan
   Muncul ketika pelanggan membuat pesanan dan sistem sudah menghitung reward point, tetapi pesanan belum selesai.

Judul:
Reward Point Ditahan

Isi:
Point sejumlah +[jumlah point acak] sedang ditahan sementara dan akan masuk ke akun setelah pesanan selesai.

Contoh:
Point sejumlah +35 sedang ditahan sementara dan akan masuk ke akun setelah pesanan selesai.

Tambahkan informasi:

* nomor pesanan
* tanggal dan jam
* status: Pending Reward

Warna/status visual:

* pending
* belum masuk ke total point

1. Point Berhasil Ditambahkan
   Muncul ketika status pesanan berubah menjadi selesai.

Judul:
Reward Point Berhasil Ditambahkan

Isi:
Point sejumlah +[jumlah point acak] berhasil ditambahkan ke akun kamu dari pesanan [nomor pesanan].

Tambahkan informasi:

* total point terbaru pelanggan
* tanggal dan jam
* status: Reward Masuk

Contoh:
Point sejumlah +42 berhasil ditambahkan ke akun kamu dari pesanan #2C312C. Total point kamu sekarang: 280.

1. Point Dibatalkan
   Muncul ketika pesanan dibatalkan sebelum selesai.

Judul:
Reward Point Dibatalkan

Isi:
Point dari pesanan [nomor pesanan] dibatalkan karena pesanan tidak selesai.

Tambahkan informasi:

* jumlah point yang sebelumnya ditahan
* tanggal dan jam
* status: Dibatalkan

Contoh:
Point dari pesanan #2C312C dibatalkan karena pesanan tidak selesai.

1. Point Dipakai untuk Redeem
   Muncul ketika pelanggan berhasil menukar point dengan reward.

Judul:
Reward Berhasil Ditukar

Isi:
Kamu berhasil menukar [jumlah point] point untuk [nama reward].

Contoh:
Kamu berhasil menukar 100 point untuk Voucher Diskon 10%.

Tambahkan informasi:

* jumlah point yang dipotong
* reward yang didapat
* tanggal dan jam
* status: Redeem Berhasil

1. Point Tidak Cukup
   Muncul ketika pelanggan mencoba redeem tetapi point belum memenuhi syarat.

Judul:
Point Tidak Cukup

Isi:
Point kamu belum cukup untuk menukar [nama reward]. Kurang [selisih point] point lagi.

Contoh:
Point kamu belum cukup untuk menukar Voucher Diskon 10%. Kurang 15 point lagi.

Tambahkan informasi:

* minimal point redeem
* status: Gagal Redeem

1. Reward Baru Tersedia
   Muncul ketika admin menambahkan reward baru ke sistem.

Judul:
Reward Baru Tersedia

Isi:
Reward baru [nama reward] sekarang tersedia dan bisa ditukar dengan [jumlah point].

Contoh:
Reward baru Voucher Gratis Dessert sekarang tersedia dan bisa ditukar dengan 120 point.

Tambahkan informasi:

* kategori reward
* status: Baru

Integrasi sistem:

* Saat pesanan dibuat, buat notifikasi point ditahan.
* Saat pesanan selesai, ubah point pending menjadi point berhasil ditambahkan dan tampilkan notifikasi baru.
* Saat pesanan dibatalkan, batalkan point pending dan tampilkan notifikasi point dibatalkan.
* Saat redeem berhasil, kurangi point dan tampilkan notifikasi penukaran berhasil.
* Saat redeem gagal karena point tidak cukup, tampilkan notifikasi gagal.
* Saat admin menambah reward baru, kirim notifikasi ke pelanggan jika fitur notifikasi promo/reward aktif.

Tampilan notifikasi:

* urutkan dari terbaru
* tampilkan judul, isi, tanggal, jam, dan status
* tampilkan nomor pesanan jika ada
* tampilkan jumlah point dengan jelas
* tampilkan badge status seperti Pending, Berhasil, Dibatalkan, Gagal, Baru
* dukung unread dan read
* notifikasi point harus menyatu dengan daftar notifikasi utama tanpa membuat halaman baru

Pastikan semua notifikasi point tersimpan di database notification pelanggan dan bisa diupdate secara realtime.
