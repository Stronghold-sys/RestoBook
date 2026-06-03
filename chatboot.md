Tambahkan dan perbaiki fitur RESERVASI MEJA agar tidak terjadi bentrok jadwal dan nomor meja yang sama pada tanggal dan jam yang sama.

MASALAH YANG HARUS DIPERBAIKI:
Saat pelanggan melakukan reservasi, misalnya:

- Tanggal: 4 Juni
- Jam: 12:00
- No meja: 1

lalu data sudah diisi lengkap dan tombol “Ajukan” diklik, data harus tersimpan dengan benar. Namun saat ada pelanggan lain mencoba reservasi dengan:

- tanggal yang sama
- jam yang sama
- no meja yang sama

maka sistem tidak boleh membiarkan reservasi tersebut lolos begitu saja. Sistem harus mendeteksi bahwa meja itu sudah dibooking pada jadwal yang sama, lalu memblokir pilihan meja tersebut dan hanya menampilkan meja lain yang masih tersedia.

TUJUAN FITUR:

1. Mencegah double booking meja pada tanggal dan jam yang sama.
2. Menampilkan hanya meja yang masih tersedia sesuai slot waktu yang dipilih.
3. Setelah reservasi selesai oleh kasir, meja yang sebelumnya dibooking otomatis kembali tersedia.
4. Menyediakan validasi realtime di halaman pelanggan, kasir, dan admin.
5. Semua proses harus sinkron dan realtime.
6. Sistem harus aman dari reservasi bentrok walaupun ada banyak pelanggan mengisi form bersamaan.

LOGIKA UTAMA RESERVASI:

1. Saat pelanggan memilih tanggal, jam, dan jumlah orang:
   - Sistem langsung mengecek ketersediaan meja.
   - Meja yang sudah dibooking pada tanggal dan jam tersebut harus otomatis disembunyikan, dinonaktifkan, atau diberi status “sudah dibooking”.
   - Pelanggan hanya bisa memilih meja yang tersedia.

2. Saat pelanggan memilih meja:
   - Sistem melakukan validasi ulang sebelum data disimpan.
   - Jika meja masih tersedia, reservasi boleh diajukan.
   - Jika ternyata meja sudah dibooking oleh pelanggan lain, sistem harus menolak dan meminta pelanggan memilih meja lain.

3. Saat tombol “Ajukan” diklik:
   - Sistem menyimpan data reservasi hanya jika tidak ada konflik jadwal.
   - Jika konflik ditemukan, tampilkan pesan error yang jelas.
   - Jangan izinkan penyimpanan data ganda untuk meja dan waktu yang sama.

4. Saat reservasi sedang menunggu konfirmasi:
   - Status reservasi = MENUNGGU
   - Meja dianggap sementara “terkunci” atau “reserved pending” agar pelanggan lain tidak bisa mengambil slot yang sama secara bersamaan.
   - Jika reservasi dibatalkan atau ditolak, meja kembali tersedia.
   - Jika kasir menyetujui, status berubah menjadi DIKONFIRMASI.

5. Saat reservasi selesai oleh kasir:
   - Status reservasi = SELESAI
   - Meja yang dibooking otomatis berubah menjadi tersedia kembali.
   - Sistem membersihkan lock/hold pada meja tersebut.
   - Meja dapat digunakan lagi untuk reservasi berikutnya.

VALIDASI YANG WAJIB ADA:

1. Validasi tanggal dan jam:
   - Tanggal yang sama + jam yang sama + meja yang sama = tidak boleh double booking.
   - Jika slot waktu overlap, sistem harus menolak.

2. Validasi status meja:
   - Tersedia
   - Sedang dibooking
   - Menunggu konfirmasi
   - Dikonfirmasi
   - Digunakan
   - Selesai
   - Dibatalkan

3. Validasi kapasitas:
   - Pelanggan hanya boleh memilih meja yang sesuai jumlah tamu.
   - Jika jumlah orang lebih banyak dari kapasitas meja, meja tersebut tidak boleh dipilih.

4. Validasi realtime:
   - Saat pelanggan lain berhasil booking, meja langsung hilang dari daftar tersedia pada user lain.
   - Jika halaman pelanggan terbuka lama, data ketersediaan harus diperbarui otomatis.

LOGIKA PENCEGAHAN BENTROK:

1. Saat pelanggan memilih tanggal dan jam:
   - Sistem memeriksa database reservasi aktif.
   - Cari apakah ada reservasi dengan:
     - tanggal sama
     - jam yang bertabrakan
     - nomor meja sama
     - status belum selesai/dibatalkan

2. Jika ada bentrok:
   - Meja harus diblokir.
   - Tampilkan keterangan:
     - “Meja ini sudah dibooking pada waktu yang Anda pilih.”
     - “Silakan pilih meja lain yang masih tersedia.”
     - “Jadwal ini sudah penuh untuk meja tersebut.”

3. Jika tidak ada bentrok:
   - Meja dapat dipilih dan reservasi dapat diajukan.

4. Jika dua pelanggan mengajukan bersamaan:
   - Gunakan penguncian transaksi atau mekanisme atomic check-and-save agar hanya satu yang berhasil.
   - Hindari kondisi race condition.

LOGIKA SETELAH RESERVASI DIKONFIRMASI:

1. Saat kasir menyetujui:
   - Status menjadi DIKONFIRMASI.
   - Meja tetap dianggap terpesan pada slot waktu yang sesuai.

2. Saat waktu reservasi tiba:
   - Status bisa berubah menjadi DIGUNAKAN atau CHECK-IN jika sistem memakai status tersebut.

3. Saat kasir menyelesaikan reservasi:
   - Status berubah menjadi SELESAI.
   - Meja otomatis tersedia kembali.
   - Sistem menghapus penguncian jadwal.
   - Meja muncul lagi sebagai pilihan reservasi untuk jadwal berikutnya.

4. Jika pelanggan tidak datang:
   - Kasir dapat menandai NO SHOW / BATAL / KADALUARSA.
   - Meja kembali tersedia sesuai aturan sistem.

FITUR TAMBAHAN YANG HARUS ADA:

1. Kalender reservasi:
   - Tampilkan kalender untuk memilih tanggal.
   - Tampilkan slot waktu yang tersedia dan yang penuh.

2. Peta meja:
   - Tampilkan layout meja restoran.
   - Meja tersedia diberi warna normal.
   - Meja dibooking diberi warna berbeda.
   - Meja yang sedang menunggu konfirmasi diberi label khusus.

3. Filter otomatis:
   - Filter berdasarkan tanggal
   - Filter berdasarkan jam
   - Filter berdasarkan jumlah orang
   - Filter berdasarkan area/meja tertentu jika ada

4. Notifikasi realtime:
   - Saat meja dibooking
   - Saat reservasi dikonfirmasi
   - Saat reservasi ditolak
   - Saat reservasi selesai
   - Saat meja kembali tersedia

5. Riwayat reservasi:
   - Simpan semua histori booking
   - Simpan status setiap perubahan
   - Simpan siapa yang membuat, mengubah, menyetujui, atau membatalkan reservasi

6. Anti duplikasi:
   - Cegah user menekan tombol ajukan berulang kali
   - Cegah data masuk dua kali
   - Gunakan debounce/loading state saat submit

7. Mode admin:
   - Admin dapat mengatur jumlah meja
   - Admin dapat mengatur kapasitas tiap meja
   - Admin dapat mengatur durasi reservasi
   - Admin dapat mengatur toleransi keterlambatan
   - Admin dapat mengatur jam buka/tutup reservasi
   - Admin dapat mengatur apakah meja otomatis dilepas jika pelanggan tidak check-in

FITUR UNTUK PELANGGAN:

1. Saat memilih tanggal dan jam:
   - Sistem menampilkan meja yang masih tersedia saja.
   - Meja yang penuh tidak bisa diklik.
   - Tampilkan pesan yang informatif jika slot sudah penuh.

2. Saat reservasi berhasil:
   - Tampilkan pesan sukses.
   - Tampilkan detail reservasi.
   - Tampilkan nomor reservasi.
   - Tampilkan status reservasi terkini.

3. Saat reservasi gagal karena bentrok:
   - Tampilkan pesan sopan:
     - “Maaf, meja yang Anda pilih sudah dibooking pada jadwal tersebut.”
     - “Silakan pilih meja lain yang masih tersedia.”
     - “Jadwal pilihan Anda sudah penuh, mohon sesuaikan kembali.”

FITUR UNTUK KASIR:

1. Kasir melihat daftar reservasi realtime.
2. Kasir melihat status meja secara langsung.
3. Kasir dapat mengonfirmasi, menolak, atau menyelesaikan reservasi.
4. Kasir dapat melihat meja mana yang sedang terpakai, menunggu, atau tersedia.
5. Saat reservasi selesai, kasir menandai meja selesai agar otomatis tersedia kembali.

FITUR UNTUK ADMIN:

1. Dashboard reservasi:
   - jumlah reservasi hari ini
   - meja tersedia
   - meja dibooking
   - meja menunggu konfirmasi
   - meja selesai
   - reservasi dibatalkan

2. Pengaturan meja:
   - tambah meja
   - hapus meja
   - ubah kapasitas meja
   - ubah nama/nomor meja
   - atur lokasi/area meja

3. Pengaturan jadwal:
   - jam buka reservasi
   - jam tutup reservasi
   - durasi slot
   - buffer waktu antar reservasi
   - aturan toleransi check-in

4. Pengaturan anti bentrok:
   - aktifkan validasi otomatis
   - aktifkan blokir meja realtime
   - aktifkan notifikasi konflik
   - aktifkan pelepasan meja otomatis setelah selesai

KATA-KATA OTOMATIS YANG SESUAI:
Saat reservasi berhasil:

- “Reservasi Anda berhasil diajukan.”
- “Data reservasi telah tersimpan.”
- “Silakan menunggu konfirmasi dari kasir.”

Saat meja sudah dibooking:

- “Maaf, meja ini sudah dibooking pada tanggal dan jam tersebut.”
- “Silakan pilih meja lain yang masih tersedia.”
- “Jadwal ini sudah penuh untuk meja yang Anda pilih.”

Saat reservasi dikonfirmasi:

- “Reservasi Anda telah dikonfirmasi.”
- “Silakan datang sesuai jadwal yang dipilih.”

Saat reservasi selesai:

- “Reservasi telah selesai.”
- “Meja sudah tersedia kembali.”

Saat reservasi dibatalkan atau ditolak:

- “Reservasi Anda dibatalkan.”
- “Silakan pilih jadwal atau meja lain.”

LOGIKA REALTIME DAN SINKRONISASI:

- Semua status meja dan reservasi harus realtime.
- Jika satu pelanggan booking meja, pelanggan lain langsung melihat update.
- Jika kasir mengubah status, pelanggan dan admin langsung menerima perubahan.
- Jika halaman direfresh, data harus tetap akurat dari server.
- Gunakan server time sebagai acuan utama, bukan hanya waktu browser.
- Pastikan mekanisme transaksi aman agar tidak ada double booking walaupun banyak request masuk bersamaan.

OUTPUT YANG DIHARAPKAN:
Buat implementasi lengkap untuk sistem reservasi meja yang:

- mencegah double booking
- memblokir meja yang sudah dipilih pada tanggal dan jam yang sama
- menampilkan meja yang tersedia saja
- otomatis mengembalikan meja menjadi tersedia setelah reservasi selesai
- realtime untuk pelanggan, kasir, dan admin
- memiliki validasi yang kuat
- punya pesan yang sopan dan jelas
- memiliki dashboard admin yang lengkap
- stabil, aman, dan sinkron penuh

---

## LOG DEPLOYMENT & RESOLUTION (2026-06-03)

### Masalah Build
Proses deployment di Cloudflare Pages mengalami kegagalan pada perintah `npx @cloudflare/next-on-pages@1` dengan detail kesalahan:
```
▲  npm error code E404
▲  npm error 404 Not Found - GET https://registry.npmjs.org/@vercel/express/-/express-0.1.96.tgz - Not found
▲  npm error 404
▲  npm error 404  '@vercel/express@https://registry.npmjs.org/@vercel/express/-/express-0.1.96.tgz' is not in this registry.
```

### Penyebab
Kesalahan E404 terjadi karena adanya keterlambatan replikasi (replication lag) pada registry npm saat paket `vercel@54.8.0` dan subdependensinya `@vercel/express@0.1.96` baru saja dipublikasikan oleh Vercel. Paket `@vercel/express` direferensikan dalam `vercel`, namun tarball rilis barunya belum sepenuhnya tersedia secara publik di CDN registry npm saat deployment dijalankan.

### Solusi & Verifikasi
1. Dependensi telah diperiksa secara lokal dan dipastikan bahwa proses instalasi paket `vercel@54.8.0` saat ini sudah berjalan dengan lancar setelah registry npm ter-update sepenuhnya.
2. Pengujian build lokal menggunakan perintah `npm run build` berhasil diselesaikan tanpa ada error kompilasi.
3. Commit ini dilakukan untuk memicu ulang (re-trigger) proses build dan deployment otomatis pada Cloudflare Pages dengan registry npm yang sudah sinkron sepenuhnya.
