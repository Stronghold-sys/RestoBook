Tambahkan fitur **Dompetku / Wallet Pelanggan** yang lengkap dan terintegrasi penuh ke aplikasi.

Gunakan bahasa Indonesia di seluruh tampilan.

Tujuan:
Pelanggan memiliki dompet digital internal di akun untuk:

* isi saldo
* bayar pesanan
* menerima refund
* menerima cashback
* melihat riwayat transaksi
* melihat detail transaksi
* menggunakan saldo saat checkout

Pastikan fitur berjalan end-to-end:
frontend + backend + database + validasi + realtime update + notifikasi.

=====================================

1. MENU DOMPETKU
   =====================================

Tambahkan menu baru di akun pelanggan:
**Dompetku**

Halaman Dompetku tampilkan:

* saldo utama pelanggan
* saldo tertahan (jika ada)
* cashback aktif
* total transaksi bulan ini
* total top up bulan ini
* total pengeluaran bulan ini

Card saldo utama tampil premium.

Contoh:
Saldo Dompetku
Rp 250.000

Tombol:

* Isi Saldo
* Tarik Dana (opsional jika diaktifkan admin)
* Bayar Sekarang
* Riwayat
* Voucher
* Bantuan

=====================================
2. TOP UP / ISI SALDO
=====================

Saat klik tombol:
**Isi Saldo**

buka popup/modal.

Isi popup:

Judul:
Isi Saldo

Field:

* nominal top up
* tombol nominal cepat:
  Rp10.000
  Rp20.000
  Rp50.000
  Rp100.000
  Rp200.000
  Rp500.000

Validasi:

* minimal top up bisa diatur admin
* maksimal top up bisa diatur admin

Contoh:
minimal Rp10.000
maksimal Rp2.000.000

Setelah pilih nominal:
klik tombol:
**Isi Saldo**

langsung buka payment gateway:
**Duitku**

Integrasi Duitku:

Payment flow:
Pelanggan isi nominal
→ klik Isi Saldo
→ buka popup Duitku
→ pilih metode pembayaran
→ bayar
→ Duitku callback sukses
→ sistem verifikasi
→ saldo pelanggan otomatis bertambah

Status pembayaran:

* Menunggu Pembayaran
* Diproses
* Berhasil
* Gagal
* Dibatalkan
* Kadaluarsa

Jika sukses:
saldo wallet otomatis bertambah realtime

Jika gagal:
saldo tidak berubah

Jika pending:
tampilkan pending

Simpan:

* payment reference
* Duitku transaction id
* nominal
* metode pembayaran
* fee
* status
* tanggal
* waktu

=====================================
3. METODE PEMBAYARAN DUITKU
===========================

Tampilkan metode Duitku:

* QRIS
* Virtual Account BCA
* Virtual Account Mandiri
* Virtual Account BNI
* Virtual Account BRI
* E-Wallet DANA
* E-Wallet OVO
* E-Wallet ShopeePay
* Indomaret
* Alfamart

Admin dapat:
aktif/nonaktif metode tertentu

=====================================
4. RIWAYAT TRANSAKSI WALLET
===========================

Menu:
Riwayat

Tampilkan list transaksi:

Jenis:

* Top Up
* Pembayaran pesanan
* Refund
* Cashback
* Voucher reward
* Penyesuaian admin
* Pembatalan
* Pengembalian dana

Data:

* nomor transaksi
* tanggal
* jam
* nominal
* status
* metode pembayaran
* tipe transaksi
* deskripsi

Contoh:

TOP UP
Rp100.000
Berhasil
01 Juni 2026 10:22

PEMBAYARAN ORDER
-Rp85.000
Selesai

REFUND
+Rp25.000
Berhasil

Filter:

* Semua
* Top Up
* Pembayaran
* Refund
* Cashback

Search:

* cari nomor transaksi

=====================================
5. PEMBAYARAN DENGAN DOMPETKU
=============================

Saat checkout:

Tambahkan opsi:
Gunakan Dompetku

Jika saldo cukup:
pelanggan bisa bayar langsung

Jika saldo kurang:
muncul:
Saldo tidak cukup

Tombol:
Isi Saldo Sekarang

Jika bayar berhasil:
saldo otomatis berkurang

Jika pesanan dibatalkan:
refund kembali ke Dompetku

=====================================
6. REFUND OTOMATIS
==================

Jika:

* pesanan dibatalkan
* reservasi gagal
* pembayaran gagal diverifikasi

maka:
saldo kembali ke wallet otomatis

Status:
Refund Berhasil

Riwayat masuk:

* refund

=====================================
7. CASHBACK
===========

Admin bisa atur cashback:

contoh:
5%
10%
nominal tertentu

Cashback otomatis masuk ke wallet

Tampilkan:
Cashback diterima Rp10.000

Riwayat cashback wajib tersimpan

=====================================
8. NOTIFIKASI WALLET
====================

Tambahkan notif ke halaman notifikasi:

Top Up Berhasil

Isi:
Top up sebesar Rp100.000 berhasil masuk ke Dompetku.

Top Up Pending

Isi:
Pembayaran top up sedang menunggu verifikasi.

Top Up Gagal

Isi:
Top up gagal diproses.

Pembayaran via Dompetku Berhasil

Isi:
Pembayaran pesanan berhasil menggunakan Dompetku.

Refund Berhasil

Isi:
Refund Rp25.000 berhasil masuk ke Dompetku.

Cashback Masuk

Isi:
Cashback Rp10.000 berhasil ditambahkan.

Saldo Tidak Cukup

Isi:
Saldo Dompetku tidak mencukupi.

=====================================
9. ADMIN WALLET MANAGEMENT
==========================

Admin panel:

Lihat semua wallet pelanggan

Data:

* nama pelanggan
* saldo
* total top up
* total transaksi
* cashback
* pending payment

Admin bisa:

* tambah saldo manual
* kurangi saldo manual
* refund manual
* blok wallet
* aktif/nonaktif wallet
* reset saldo
* lihat histori pelanggan

Pengaturan:

* minimal top up
* maksimal top up
* aktif/nonaktif Duitku
* aktif/nonaktif cashback
* biaya admin
* auto refund on/off

=====================================
10. KEAMANAN
============

Wajib:

* verifikasi callback Duitku
* validasi nominal
* anti duplicate payment
* anti duplicate callback
* transaction lock
* audit log
* database transaction rollback
* realtime sync

=====================================
11. UI / UX
===========

Tampilan modern premium.

Tambahkan:

* saldo card
* animasi saldo bertambah
* loading state
* empty state
* skeleton loading
* badge status
* realtime update
* responsive mobile
* responsive desktop

Pastikan semua fitur wallet terhubung:

* Dompetku
* Duitku
* checkout
* refund
* cashback
* admin
* notifikasi
* database
* riwayat transaksi
  secara lengkap end-to-end.
