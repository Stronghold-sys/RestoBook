LOGIKA KARYAWAN TIDAK MEMILIKI JADWAL MASUK

Sistem harus memeriksa terlebih dahulu apakah karyawan memiliki jadwal masuk pada tanggal tersebut.

JIKA karyawan TIDAK memiliki jadwal masuk, maka sistem TIDAK BOLEH:

- membuat catatan absensi
- menghitung hadir
- menghitung terlambat
- menghitung alpha
- menghitung izin/sakit
- menambah menit keterlambatan
- menambah statistik pada dashboard
- mengubah status menjadi alpha

Status untuk kondisi ini harus menjadi:

- TIDAK ADA JADWAL
atau
- LIBUR

Logika:
IF jadwal_masuk = kosong OR tidak ditemukan pada tanggal_tersebut
THEN

- jangan buat record absensi
- jangan proses kehadiran
- jangan proses alpha
- jangan proses keterlambatan
- jangan proses izin/sakit
- simpan status sebagai "TIDAK ADA JADWAL"

Contoh:

- Karyawan A tidak dijadwalkan masuk hari ini
- Maka sistem tidak mencatat absensi apa pun
- Data dashboard tidak berubah
- Statistik hadir, alpha, terlambat, izin, dan sakit tidak bertambah

Jika jadwal kerja dihapus oleh admin:

- sistem harus langsung menyesuaikan data
- record yang berasal dari jadwal tersebut tidak boleh dihitung sebagai alpha
- dashboard harus diperbarui realtime
