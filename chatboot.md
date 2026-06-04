Tambahkan dan pindahkan seluruh fitur pengelolaan “Dompetku” yang sebelumnya berada di halaman “Detail & Kelola Poin” ke halaman menu admin “Fitur Dompetku”. Hapus/kurangi ketergantungan pengelolaan dompet dari halaman poin, lalu pusatkan seluruh kontrol Dompetku di satu halaman admin yang khusus, lengkap, rapi, aman, dan terstruktur.

Tujuan utama:

- Admin memiliki halaman khusus untuk mengelola status Dompetku pelanggan.
- Fitur pengelolaan Dompetku tidak lagi bercampur dengan pengelolaan poin.
- Semua perubahan status Dompetku harus tersinkron otomatis ke halaman pelanggan, checkout/pembayaran, riwayat, dan notifikasi.
- Tambahkan fitur-fitur lanjutan yang lengkap untuk admin, beserta logika masing-masing.

1) PINDAHKAN FITUR DARI HALAMAN POIN KE MENU DOMPETKU

- Semua fitur yang berkaitan dengan saldo dompet, status dompet, blokir dompet, aktivasi dompet, nonaktifkan dompet, reset saldo, penyesuaian saldo, riwayat transaksi dompet, dan log aktivitas harus dipindahkan ke menu “Dompetku” di admin.
- Halaman “Detail & Kelola Poin” hanya fokus pada poin.
- Jangan duplikasi fitur dompet di dua tempat.
- Di halaman Dompetku admin, tampilkan ringkasan:
  - Status dompet pelanggan
  - Saldo dompet
  - Riwayat transaksi dompet
  - Log perubahan status
  - Aksi admin terhadap dompet

1) TAMPILAN HALAMAN ADMIN DOMPETKU
Buat halaman admin “Fitur Dompetku” yang lengkap dengan komponen berikut:

- Ringkasan status pelanggan:
  - Aktif
  - Nonaktif
  - Diblokir
  - Pending verifikasi
  - Dalam proses
- Saldo saat ini
- Total transaksi masuk
- Total transaksi keluar
- Total top up
- Total refund
- Total penyesuaian manual
- Total saldo terblokir jika ada
- Status verifikasi akun bila Dompetku membutuhkan aktivasi

1) FITUR ADMIN YANG HARUS ADA DI DOMPETKU
Tambahkan fitur berikut pada halaman admin Dompetku:

A. Ubah status dompet:

- Aktifkan dompet
- Nonaktifkan dompet
- Blokir dompet
- Buka blokir dompet
- Tandai pending / proses verifikasi
- Reset status ke default jika diperlukan

B. Kelola saldo:

- Tambah saldo
- Kurangi saldo
- Reset saldo ke 0
- Koreksi saldo manual
- Tambahkan catatan alasan untuk setiap perubahan saldo

C. Kelola transaksi:

- Lihat semua transaksi dompet
- Filter berdasarkan tanggal, jenis transaksi, status, nominal
- Cari berdasarkan nama pelanggan, email, ID transaksi
- Lihat detail transaksi
- Tandai transaksi valid / dibatalkan / direvisi jika diperlukan

D. Kelola akses:

- Izinkan atau larang penggunaan Dompetku untuk pembayaran
- Aktifkan atau nonaktifkan Dompetku secara manual
- Blokir penggunaan sementara jika ada pelanggaran
- Buka blokir jika masalah sudah selesai

E. Audit dan riwayat:

- Catat siapa admin yang melakukan perubahan
- Catat waktu perubahan
- Catat alasan perubahan
- Simpan histori lengkap semua aksi admin
- Buat log audit yang tidak bisa dihapus sembarangan

1) LOGIKA STATUS DOMPETKU
Buat status Dompetku berikut:

- Aktif
  Artinya pelanggan dapat menggunakan Dompetku untuk pembayaran, top up, dan transaksi lain.

- Nonaktif
  Artinya Dompetku belum bisa digunakan, tetapi bukan karena pelanggaran. Bisa karena belum aktivasi, dinonaktifkan manual, atau menunggu proses tertentu.

- Diblokir
  Artinya Dompetku tidak dapat dipakai sama sekali karena alasan keamanan, pelanggaran, atau kebijakan admin.

- Pending
  Artinya Dompetku sedang menunggu verifikasi atau sedang diproses.

- Diproses
  Artinya admin sedang memeriksa data, dokumen, atau kondisi akun.

1) LOGIKA PERUBAHAN STATUS OLEH ADMIN
A. Jika admin memilih “Blokir Dompet”:

- Label status Dompetku di halaman pelanggan harus berubah menjadi “Diblokir”.
- Dompetku tidak dapat digunakan untuk pembayaran, top up, ataupun transaksi lain.
- Tampilkan pesan ke pelanggan:
  “Dompetku Anda sedang diblokir sementara dan tidak dapat digunakan saat ini. Silakan hubungi admin untuk informasi lebih lanjut.”
- Simpan alasan blokir wajib diisi admin.
- Kirim notifikasi aplikasi dan email ke pelanggan.

B. Jika admin memilih “Aktivasi Dompet”:

- Label status di pelanggan berubah menjadi “Aktif”.
- Dompetku langsung bisa digunakan untuk pembayaran.
- Kirim notifikasi dan email otomatis:
  “Dompetku Anda telah diaktifkan dan siap digunakan.”

C. Jika admin memilih “Nonaktifkan Dompet”:

- Label status di pelanggan berubah menjadi “Nonaktif”.
- Dompetku tidak dapat digunakan untuk transaksi sampai diaktifkan kembali.
- Kirim notifikasi dan email:
  “Dompetku Anda telah dinonaktifkan sementara.”

D. Jika admin memilih “Buka Blokir”:

- Status berubah sesuai kondisi sebelumnya, misalnya kembali menjadi “Aktif” atau “Nonaktif”.
- Jangan langsung aktif otomatis jika sebelumnya memang perlu verifikasi ulang.
- Admin harus memilih status lanjutan setelah membuka blokir.

E. Jika admin memilih “Pending” atau “Diproses”:

- Label di pelanggan berubah sesuai status terbaru.
- Tampilkan pesan bahwa akun sedang dalam proses pemeriksaan.

1) LOGIKA PENYESUAIAN SALDO
Tambahkan fitur penyesuaian saldo Dompetku dengan logika berikut:

A. Tambah saldo:

- Admin memasukkan nominal.
- Wajib ada alasan.
- Saldo bertambah setelah konfirmasi.
- Simpan log transaksi.

B. Kurangi saldo:

- Admin memasukkan nominal.
- Wajib ada alasan.
- Jangan izinkan saldo menjadi minus kecuali fitur saldo minus memang diaktifkan.
- Jika saldo tidak cukup, tampilkan peringatan.

C. Reset saldo ke 0:

- Wajib konfirmasi dua langkah.
- Wajib alasan admin.
- Simpan histori bahwa saldo direset.

D. Koreksi manual:

- Admin bisa menyesuaikan saldo ke nilai tertentu.
- Sistem menghitung selisih otomatis.
- Catat sebelum dan sesudah koreksi.

E. Refund / pengembalian:

- Sediakan fitur refund ke dompet pelanggan.
- Admin bisa memilih transaksi sumber refund.
- Simpan nomor referensi refund.

1) LOGIKA PADA HALAMAN PELANGGAN
Di halaman pelanggan:

- Tampilkan label status Dompetku secara real-time:
  - Aktif
  - Nonaktif
  - Diblokir
  - Pending
  - Diproses
- Tampilkan pesan yang sesuai dengan status.
- Jika status diblokir, blokir semua fitur transaksi Dompetku.
- Jika status nonaktif, tampilkan tombol aktivasi.
- Jika status aktif, tampilkan saldo dan riwayat transaksi normal.
- Jika status pending/diproses, tampilkan pemberitahuan proses berlangsung.

1) LOGIKA PADA HALAMAN PEMBAYARAN

- Saat pelanggan memilih metode pembayaran Dompetku, sistem harus memeriksa status akun.
- Jika status aktif, lanjutkan pembayaran.
- Jika status nonaktif, tampilkan peringatan dan tombol aktivasi.
- Jika status diblokir, tampilkan pesan blokir dan larang penggunaan.
- Jika status pending/diproses, tampilkan pesan menunggu verifikasi.
- Jangan izinkan transaksi jika status tidak aktif.

1) FITUR TAMBAHAN YANG HARUS DITAMBAHKAN
Tambahkan fitur lain yang lebih lengkap untuk admin Dompetku:

A. Pencarian dan filter:

- Cari pelanggan berdasarkan nama, email, nomor HP, ID akun, atau nomor transaksi
- Filter per status dompet
- Filter per tanggal
- Filter per nominal saldo
- Filter per jenis transaksi

B. Bulk action:

- Blokir massal
- Aktifkan massal
- Nonaktifkan massal
- Export data pelanggan Dompetku

C. Export dan laporan:

- Export PDF / Excel laporan transaksi Dompetku
- Laporan harian, mingguan, bulanan
- Rekap perubahan saldo
- Rekap status dompet
- Rekap admin yang paling sering melakukan perubahan

D. Notifikasi admin:

- Notifikasi saat saldo diubah
- Notifikasi saat status berubah
- Notifikasi saat ada transaksi mencurigakan
- Notifikasi saat ada saldo negatif atau anomali

E. Keamanan:

- Wajib konfirmasi sebelum aksi kritis
- Simpan jejak audit
- Batasi akses hanya admin tertentu
- Log IP atau identitas admin jika diperlukan
- Validasi server-side dan client-side
- Cegah manipulasi saldo tanpa izin

F. Catatan internal:

- Admin dapat menambahkan catatan internal pada akun Dompetku pelanggan
- Catatan hanya terlihat oleh admin
- Catatan bisa dipakai untuk alasan blokir, nonaktif, atau koreksi saldo

1) RINCIAN LOGIKA EKSEKUSI ADMIN
Setiap aksi admin harus mengikuti pola ini:

- Pilih pelanggan
- Pilih aksi
- Isi nominal / alasan / catatan jika diperlukan
- Sistem tampilkan ringkasan perubahan
- Admin konfirmasi
- Sistem simpan perubahan ke database
- Sistem update status pelanggan
- Sistem kirim notifikasi dan email bila diperlukan
- Sistem simpan log aktivitas

1) LABEL STATUS DI PELANGGAN
Pastikan label di halaman pelanggan berubah otomatis sesuai aksi admin:

- Jika admin aktivasi -> label menjadi “Aktif”
- Jika admin nonaktifkan -> label menjadi “Nonaktif”
- Jika admin blokir -> label menjadi “Diblokir”
- Jika admin buka blokir -> label kembali sesuai status akhir
- Jika admin pending -> label menjadi “Pending”
- Jika admin diproses -> label menjadi “Diproses”

1) TEKS NOTIFIKASI YANG DIPAKAI

- Aktif:
  “Dompetku Anda telah diaktifkan dan kini dapat digunakan.”
- Nonaktif:
  “Dompetku Anda saat ini dinonaktifkan sementara.”
- Diblokir:
  “Dompetku Anda diblokir dan tidak dapat digunakan untuk saat ini.”
- Pending:
  “Dompetku Anda sedang dalam proses verifikasi.”
- Diproses:
  “Dompetku Anda sedang diperiksa oleh tim admin.”
- Saldo berubah:
  “Saldo Dompetku Anda telah diperbarui.”
- Refund:
  “Refund berhasil ditambahkan ke Dompetku Anda.”

1) KETENTUAN IMPLEMENTASI

- Jangan ganggu fitur poin yang sudah ada.
- Pindahkan hanya fitur yang memang terkait Dompetku.
- Buat semua perubahan tersinkron otomatis.
- Pastikan riwayat, status, saldo, dan log selalu konsisten.
- Buat UI admin modern, rapi, dan mudah digunakan.
- Buat setiap tindakan admin memiliki validasi, konfirmasi, dan audit trail.
- Pastikan sistem aman dari manipulasi data.

Buat implementasi ini lengkap, detail, dan siap dipakai di lingkungan produksi.
