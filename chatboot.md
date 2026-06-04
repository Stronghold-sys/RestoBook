PERBAIKI LOGIKA ABSENSI DAN STATUS KEHADIRAN KARYAWAN AGAR PENENTUAN ALPHA DILAKUKAN SECARA OTOMATIS, AKURAT, DAN BERDASARKAN WAKTU WIB.

MASALAH SAAT INI:

Saat karyawan memiliki jadwal kerja yang sudah ditentukan (tanggal kerja, jam masuk, dan jam pulang), tetapi karyawan tidak melakukan check-in sama sekali hingga melewati jam pulang bahkan sudah berganti hari dan tanggal, sistem belum otomatis mengubah status menjadi ALPHA.

Akibatnya data kehadiran menjadi tidak akurat.

==================================================
TUJUAN PERBAIKAN
==================================================

Buat logika absensi otomatis yang dapat menentukan status:

- Hadir
- Terlambat
- Izin
- Sakit
- Alpha

secara otomatis berdasarkan jadwal kerja dan aktivitas absensi karyawan.

Seluruh perhitungan wajib menggunakan:

Timezone:
Asia/Jakarta (WIB)

==================================================
LOGIKA ABSENSI HARIAN
==================================================

Setiap karyawan memiliki:

- tanggal kerja
- jam masuk
- jam pulang
- status absensi

Contoh:

Tanggal Kerja:
05 Juni 2026

Jam Masuk:
08:00 WIB

Jam Pulang:
17:00 WIB

==================================================
LOGIKA STATUS HADIR
==================================================

Jika:

- karyawan melakukan check-in
- sebelum atau pada jam masuk

Maka:

Status = HADIR

==================================================
LOGIKA TERLAMBAT
==================================================

Jika:

- karyawan melakukan check-in
- batas toleransi yang di atur admin habis

Maka:

Status = TERLAMBAT

Hitung:

- jumlah menit keterlambatan
- total akumulasi keterlambatan bulanan

Contoh:

Jam Masuk:
08:00

Check-in:
08:15

Status:
TERLAMBAT

Terlambat:
15 Menit

==================================================
LOGIKA IZIN
==================================================

Jika:

- karyawan mengajukan izin
- disetujui oleh admin

Maka:

Status = IZIN

Dan tidak dihitung sebagai alpha.

==================================================
LOGIKA SAKIT
==================================================

Jika:

- karyawan mengajukan sakit
- disetujui admin

Maka:

Status = SAKIT

Dan tidak dihitung sebagai alpha.

==================================================
LOGIKA ALPHA OTOMATIS
==================================================

INI BAGIAN PALING PENTING.

Jika:

1. Karyawan memiliki jadwal kerja.
2. Tidak melakukan check-in.
3. Tidak mengajukan izin.
4. Tidak mengajukan sakit.
5. Tidak memiliki absensi masuk.
6. Jam pulang telah terlewati.
7. Hari kerja telah berakhir.
8. Tanggal telah berganti ke hari berikutnya.

Maka sistem harus otomatis mengubah status menjadi:

ALPHA

==================================================
CONTOH KASUS 1
==================================================

Tanggal Kerja:
05 Juni 2026

Jam Masuk:
08:00

Jam Pulang:
17:00

Kondisi:

- Tidak check-in
- Tidak izin
- Tidak sakit

Waktu sekarang:

06 Juni 2026
00:01 WIB

Hasil:

Status = ALPHA

==================================================
CONTOH KASUS 2
==================================================

Tanggal Kerja:
05 Juni 2026

Jam Masuk:
08:00

Jam Pulang:
17:00

Kondisi:

- Tidak check-in
- Tidak izin
- Tidak sakit

Waktu sekarang:

05 Juni 2026
23:59 WIB

Hasil:

Status = BELUM DIPROSES

Karena hari belum berganti.

==================================================
CONTOH KASUS 3
==================================================

Tanggal Kerja:
05 Juni 2026

Jam Masuk:
08:00

Jam Pulang:
17:00

Kondisi:

- Izin disetujui

Waktu:

06 Juni 2026

Hasil:

Status tetap IZIN

Tidak boleh menjadi ALPHA.

==================================================
CONTOH KASUS 4
==================================================

Tanggal Kerja:
05 Juni 2026

Jam Masuk:
08:00

Jam Pulang:
17:00

Kondisi:

- Sakit disetujui

Waktu:

06 Juni 2026

Hasil:

Status tetap SAKIT

Tidak boleh menjadi ALPHA.

==================================================
PROSES OTOMATIS HARIAN
==================================================

Buat proses otomatis yang berjalan berkala.

Setiap beberapa menit sistem harus memeriksa:

1. Jadwal kerja yang sudah lewat.
2. Data absensi.
3. Data izin.
4. Data sakit.

Jika ditemukan:

- tidak ada check-in
- tidak ada izin
- tidak ada sakit
- tanggal kerja sudah lewat

Maka:

Status otomatis menjadi ALPHA.

==================================================
LOGIKA YANG HARUS DICEK
==================================================

IF

tanggal_kerja < tanggal_sekarang_WIB

AND

status_absensi kosong

AND

tidak_ada_checkin

AND

tidak_ada_izin_disetujui

AND

tidak_ada_sakit_disetujui

THEN

status_absensi = ALPHA

==================================================
PERHITUNGAN DASHBOARD
==================================================

Pastikan kartu statistik:

MASUK
IZIN/SAKIT
ALPHA
TERLAMBAT

menggunakan data terbaru.

Saat status otomatis berubah menjadi ALPHA:

- jumlah ALPHA bertambah otomatis
- dashboard admin langsung diperbarui
- dashboard karyawan langsung diperbarui
- laporan absensi diperbarui
- rekap bulanan diperbarui
- grafik absensi diperbarui

Tanpa refresh browser.

==================================================
REALTIME
==================================================

Saat status berubah menjadi ALPHA:

- dashboard admin berubah realtime
- dashboard karyawan berubah realtime
- laporan absensi berubah realtime
- statistik berubah realtime

==================================================
PENCEGAHAN KESALAHAN
==================================================

Jangan jadikan ALPHA jika:

- ada check-in valid
- ada izin disetujui
- ada sakit disetujui
- hari kerja belum berakhir
- tanggal kerja belum lewat

==================================================
AUDIT LOG
==================================================

Simpan log otomatis:

- ID Karyawan
- Nama Karyawan
- Tanggal Kerja
- Jam Masuk
- Jam Pulang
- Waktu Sistem Mengubah Status
- Status Lama
- Status Baru (ALPHA)
- Alasan:
  "Tidak melakukan absensi hingga melewati akhir hari kerja"

==================================================
HASIL AKHIR YANG DIHARAPKAN
==================================================

✓ Karyawan yang tidak masuk kerja akan otomatis menjadi ALPHA.
✓ Menggunakan waktu WIB.
✓ Tidak perlu input manual admin.
✓ Tidak salah menghitung izin atau sakit.
✓ Dashboard langsung sinkron.
✓ Statistik ALPHA selalu akurat.
✓ Rekap absensi harian dan bulanan selalu sesuai kondisi sebenarnya.
