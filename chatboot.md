Tambahkan fitur **Sistem Reward Point Pelanggan** yang lengkap untuk aplikasi.

## 1. Sistem Point Pelanggan

Buat fitur reward point untuk pelanggan dengan aturan berikut:

### Penambahan Point

* Setiap pelanggan yang berhasil melakukan pesanan akan mendapatkan reward point.
* Besaran point **ditentukan secara acak** oleh sistem.
* Rentang point acak dapat diatur admin (contoh: minimal 10 point sampai maksimal 100 point).
* Point **tidak langsung masuk saat order dibuat**.
* Point masuk **hanya ketika status pesanan = selesai / completed**.
* Saat pesanan masih diproses, point disimpan sementara dengan status **Ditahan / Pending Reward**.
* Jika pesanan dibatalkan:

  * point pending otomatis dibatalkan
  * tidak ditambahkan ke akun pelanggan

### Status Point yang wajib ada

Tambahkan status point lengkap:

* Pending / Ditahan
* Berhasil Ditambahkan
* Digunakan untuk Redeem
* Dibatalkan
* Kadaluarsa (opsional jika admin aktifkan masa berlaku point)
* Dikurangi manual oleh admin
* Ditambahkan manual oleh admin

### Riwayat Point Pelanggan

Di halaman pelanggan tampilkan:

* Total point aktif
* Point pending
* Point yang pernah digunakan
* Riwayat lengkap:

  * tanggal
  * order terkait
  * jumlah point
  * status
  * keterangan

Contoh:
+35 point — Order selesai
+20 point — Pending
-100 point — Redeem voucher
0 point — Dibatalkan

---

## 2. Halaman Reward / Redeem untuk Pelanggan

Tambahkan menu:
**Reward Saya / Tukar Point**

Tampilkan daftar reward yang bisa ditukar:

* Voucher diskon
* Gratis makanan/minuman
* Produk promo
* Merchandise
* Cashback
* Reward custom lainnya

Setiap reward tampil:

* gambar/icon
* nama reward
* deskripsi
* jumlah stock (jika ada)
* minimal point yang dibutuhkan
* status aktif/nonaktif
* tombol Redeem

Jika point pelanggan kurang:

* tombol disable
* tampil pesan:
  “Point kamu belum cukup untuk menukar reward ini”
* tampil juga:
  “Kurang XX point lagi”

Jika point cukup:

* tombol aktif
* saat redeem:

  * tampil popup konfirmasi
  * kurangi point otomatis
  * simpan ke akun pelanggan

Hasil redeem masuk ke akun pelanggan:

* voucher masuk ke daftar voucher
* makanan/minuman masuk ke reward milik pelanggan
* cashback masuk ke wallet/saldo
* reward lain masuk ke inventory pelanggan

Tambahkan status redeem:

* Menunggu Verifikasi
* Berhasil
* Dipakai
* Kadaluarsa
* Dibatalkan

---

## 3. Dashboard Admin – Manajemen Reward Point

Buat panel admin lengkap.

### Pengaturan Point

Admin dapat mengatur:

* minimal point random
* maksimal point random
* point aktif / nonaktif
* point berlaku berapa hari
* point per transaksi maksimal
* bonus point event tertentu
* bonus point hari tertentu
* bonus point pelanggan baru
* bonus ulang tahun
* multiplier x2 x3

### Manajemen Redeem

Admin bisa:

* tambah reward baru
* edit reward
* hapus reward
* aktif/nonaktif reward
* atur stock reward
* atur minimal point redeem
* atur reward kategori:

  * voucher
  * makanan
  * cashback
  * produk
  * custom

### Manajemen Pelanggan

Admin bisa:

* lihat total point tiap pelanggan
* lihat pending point
* tambah point manual
* kurangi point manual
* reset point
* blok redeem pelanggan tertentu
* lihat histori point pelanggan
* filter berdasarkan tanggal/status

### Statistik Reward

Dashboard statistik:

* total point dibagikan
* total point pending
* total point digunakan
* reward paling sering ditukar
* pelanggan point tertinggi
* grafik reward harian / mingguan / bulanan

---

## 4. Integrasi Order

Saat order dibuat:

* sistem hitung estimasi point acak
* simpan status pending

Saat order selesai:

* pending -> berhasil ditambahkan

Saat order dibatalkan:

* pending -> dibatalkan

Saat pelanggan redeem:

* cek saldo point
* jika cukup:

  * kurangi point
  * simpan reward
* jika tidak cukup:

  * tampil alert

Pastikan semua transaksi point:

* tersimpan database
* aman dari double redeem
* realtime update di pelanggan
* realtime update di admin
* support notifikasi

---

## 5. Notifikasi

Pelanggan menerima notifikasi:

* point pending
* point berhasil masuk
* point dibatalkan
* berhasil redeem
* gagal redeem
* reward tersedia baru

Admin menerima notifikasi:

* ada redeem baru
* stok reward habis
* pelanggan point tinggi
* ada transaksi point gagal

---

## 6. UI/UX

Buat tampilan modern premium:

* card point pelanggan
* progress menuju reward
* badge status
* animasi saat point bertambah
* confetti saat redeem berhasil
* warna berbeda tiap status
* responsive mobile
* loading & skeleton
* empty state jika belum ada reward

Pastikan semua fitur berjalan penuh end-to-end:

* database
* validasi
* UI pelanggan
* UI admin
* history
* notifikasi
* keamanan transaksi
* anti double redeem
* realtime sync
