Buatkan fitur ONGKIR / BIAYA PENGIRIMAN pada halaman pembayaran pelanggan, dengan perhitungan berbasis jarak real dari lokasi resto ke alamat tujuan pelanggan yang dipilih saat checkout. Fitur ini harus realtime, sinkron antara pelanggan dan admin, mudah diatur, dan terintegrasi penuh dengan sistem pembayaran, voucher, reward, dan kwitansi.

NAMA FITUR:
Ongkir Otomatis Berdasarkan Jarak

TUJUAN UTAMA:

1. Saat pelanggan memilih alamat pengiriman, sistem langsung menghitung ongkir otomatis berdasarkan jarak antara lokasi resto dan alamat pelanggan.
2. Perhitungan ongkir menggunakan satuan per KM.
3. Admin dapat mengatur tarif ongkir per 1 KM dari dashboard admin.
4. Ongkir harus muncul jelas di halaman pembayaran, ringkasan checkout, detail pesanan, dan kwitansi.
5. Jika pelanggan memakai voucher diskon, termasuk voucher diskon ongkir, maka ongkir juga harus ikut terpotong sesuai aturan voucher.
6. Total akhir yang dibayar pelanggan harus dihitung ulang secara otomatis dan realtime.
7. Data jarak dan rute pengiriman harus diambil menggunakan integrasi peta dari Google Maps dengan implementasi yang kompatibel memakai library dari:
   <https://github.com/visgl/react-google-maps>
8. Fitur harus sinkron penuh antara pelanggan dan admin.

LOGIKA PERHITUNGAN ONGKIR:

1. Sistem mengambil koordinat lokasi resto dari pengaturan admin.
2. Sistem mengambil alamat pelanggan yang dipilih saat checkout.
3. Sistem mengonversi alamat pelanggan menjadi koordinat geografis.
4. Sistem menghitung jarak pengiriman dari resto ke alamat pelanggan dalam KM.
5. Ongkir dihitung menggunakan rumus:
   Ongkir = Jarak KM x Tarif per KM
6. Contoh:
   - Tarif per KM = Rp2.500
   - Jarak = 10 KM
   - Ongkir = Rp25.000
7. Jika ada pembulatan, gunakan aturan yang jelas dan konsisten, misalnya pembulatan ke atas ke dua angka desimal atau ke KM utuh sesuai pengaturan admin.
8. Jika pelanggan memakai voucher diskon ongkir, maka ongkir dikurangi terlebih dahulu sebelum total akhir dihitung.
9. Jika voucher bersifat umum, diskon harus tetap berpengaruh ke total pembayaran akhir termasuk ongkir sesuai aturan promo yang dibuat.

FITUR PELANGGAN:

1. Saat memilih alamat pengiriman, tampil estimasi ongkir otomatis.
2. Tampilkan rincian:
   - jarak pengiriman
   - tarif per KM
   - subtotal makanan
   - ongkir
   - diskon
   - total akhir
3. Jika pelanggan mengganti alamat, ongkir harus dihitung ulang secara realtime.
4. Jika pelanggan memakai voucher diskon ongkir, tampil potongan ongkir secara jelas.
5. Jika pelanggan memakai voucher lain, sistem harus menghitung ulang total pembayaran secara benar.
6. Total akhir yang harus dibayar pelanggan hanya hasil perhitungan final setelah semua diskon diterapkan.
7. Ongkir dan diskon ongkir wajib muncul di kwitansi.
8. Tampilkan notifikasi jika jarak terlalu jauh atau melebihi batas layanan pengiriman.
9. Jika alamat tidak valid atau tidak dapat dipetakan, tampilkan pesan kesalahan yang jelas dan minta pelanggan memperbaiki alamat.

FITUR ADMIN:

1. Tambahkan pengaturan untuk menentukan besaran ongkir per KM.
2. Tambahkan pengaturan minimum dan maksimum jarak pengiriman jika diperlukan.
3. Tambahkan pengaturan area layanan pengiriman.
4. Tambahkan pengaturan biaya tambahan opsional, misalnya:
   - biaya zona tertentu
   - biaya minimum order
   - biaya akhir pembulatan
5. Admin dapat mengaktifkan atau menonaktifkan voucher diskon ongkir.
6. Admin dapat membuat voucher ongkir yang bisa diredeem pelanggan.
7. Admin dapat mengatur:
   - nominal voucher
   - persentase voucher
   - minimal transaksi
   - batas penggunaan
   - masa berlaku
   - hanya untuk area tertentu
8. Admin dapat melihat log perhitungan ongkir per pesanan.
9. Admin dapat mengubah tarif per KM kapan saja, dan sistem harus langsung memakai tarif terbaru.

LOGIKA VOUCHER:

1. Jika pelanggan memakai voucher diskon ongkir, potongan langsung diterapkan pada ongkir.
2. Jika voucher berupa diskon umum, sistem menghitung diskon sesuai aturan lalu total akhir diperbarui.
3. Jika voucher berlaku untuk ongkir dan subtotal sekaligus, sistem harus membaginya sesuai logika promo yang ditentukan.
4. Jika ada lebih dari satu promo, sistem harus menentukan prioritas penggunaan voucher dengan aturan yang jelas.
5. Jika voucher tidak valid, expired, atau melebihi kuota, tampilkan pesan yang jelas.
6. Semua potongan harus tercermin di kwitansi.
7. Total pembayaran akhir harus selalu akurat dan tidak boleh dihitung manual oleh pelanggan.

KWITANSI / STRUK:

1. Tampilkan rincian ongkir secara jelas di kwitansi.
2. Tampilkan:
   - subtotal
   - ongkir
   - diskon ongkir
   - voucher lain
   - total akhir
3. Jika pelanggan memakai voucher, tampilkan nominal potongannya.
4. Kwitansi harus tersinkron dengan data transaksi yang tersimpan di sistem.
5. Kwitansi harus bisa diunduh atau dicetak.

REALTIME DAN SINKRONISASI:

1. Perubahan alamat harus langsung mengubah ongkir tanpa reload.
2. Perubahan tarif per KM oleh admin harus langsung berlaku pada transaksi baru.
3. Jika admin mengubah aturan voucher atau area layanan, pelanggan harus melihat update sesuai status terbaru.
4. Semua data ongkir, jarak, voucher, dan total akhir harus sinkron antara pelanggan, admin, dan kasir.
5. Status pembayaran harus realtime.
6. Jika pesanan batal, hangus, atau dikoreksi, rincian ongkir harus ikut diperbarui.

INTEGRASI PETA:

1. Gunakan integrasi peta berbasis Google Maps melalui library:
   <https://github.com/visgl/react-google-maps>
2. Tampilkan peta saat pelanggan memilih alamat.
3. Gunakan data lokasi untuk menghitung jarak pengiriman.
4. Tampilkan marker resto dan marker alamat pelanggan.
5. Tampilkan estimasi rute dan jarak pengiriman.
6. Jika memungkinkan, gunakan rute jalan sebenarnya, bukan hanya jarak lurus.
7. Jika layanan peta gagal, sediakan fallback yang aman dan tampilkan pesan peringatan.

FITUR TAMBAHAN YANG HARUS ADA:

1. Validasi alamat lengkap agar ongkir tidak salah hitung.
2. Auto-complete alamat pelanggan.
3. Deteksi area layanan pengiriman.
4. Peringatan jika alamat di luar jangkauan.
5. Riwayat perubahan ongkir untuk audit.
6. Pengaturan voucher ongkir di menu reward admin.
7. Pengaturan harga per KM bisa diubah kapan saja.
8. Preview perhitungan ongkir sebelum pelanggan konfirmasi pembayaran.
9. Simpan log:
   - alamat tujuan
   - jarak
   - tarif per KM
   - diskon
   - total akhir
10. Buat tampilan modern, responsif, mudah dipahami di mobile dan desktop.

LOGIKA SISTEM SECARA RINGKAS:

1. Pelanggan pilih alamat pengiriman.
2. Sistem membaca lokasi resto dan alamat pelanggan.
3. Sistem menghitung jarak pengiriman.
4. Sistem mengalikan jarak dengan tarif per KM yang diatur admin.
5. Jika ada voucher diskon ongkir, ongkir dipotong otomatis.
6. Jika ada voucher lain, sistem menghitung ulang total akhir.
7. Ringkasan pembayaran dan kwitansi diperbarui realtime.
8. Admin dan pelanggan melihat data yang sama secara sinkron.

ATURAN PENTING:

1. Fitur harus aman dan akurat.
2. Perhitungan tidak boleh dilakukan sembarangan di sisi tampilan saja; harus ada logika backend yang valid.
3. Data ongkir harus tersimpan di database bersama pesanan.
4. Semua perubahan harus konsisten antara pelanggan, admin, dan kasir.
5. Pastikan hasil akhirnya siap dipakai untuk transaksi nyata.

HASIL AKHIR YANG DIINGINKAN:
Buatkan fitur ongkir otomatis berbasis jarak yang realtime, sinkron, mudah diatur admin, mendukung voucher diskon ongkir dan voucher lain, menampilkan ongkir di kwitansi, serta terintegrasi dengan peta Google Maps dan sistem pembayaran secara penuh.
