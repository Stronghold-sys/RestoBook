Tolong buat, perbaiki, dan lengkapi alur login karyawan/kasir pada sistem ini agar lebih aman, jelas, realtime, dan sinkron dengan admin.

KONTEKS UTAMA:

* Saat karyawan login menggunakan email atau ID karyawan.
* Jika login berhasil, sistem jangan langsung masuk ke dashboard.
* Sistem harus menampilkan halaman verifikasi data karyawan terlebih dahulu.
* Halaman ini menampilkan detail lengkap data karyawan agar pengguna mengecek kebenaran identitasnya sebelum masuk sistem.
* Jika ada data yang salah, karyawan harus bisa melaporkannya ke admin melalui formulir laporan.
* Semua proses harus realtime dan terhubung penuh antara role karyawan/kasir dan admin.

FITUR YANG HARUS DIBUAT:

1. HALAMAN VERIFIKASI SETELAH LOGIN
   Setelah karyawan login berhasil, jangan langsung redirect ke dashboard. Tampilkan halaman detail data karyawan yang berisi:

* Foto karyawan
* Nama lengkap
* Email
* ID karyawan / nomor karyawan
* Role
* Jabatan
* Status akun
* Status aktif/tidak aktif
* Shift terakhir
* Shift berikutnya jika ada
* Tanggal bergabung
* Informasi lain yang relevan

Halaman ini harus memiliki:

* Tombol “Masuk Sistem”
* Tombol “Laporkan Kesalahan Data”
* Tombol “Logout” jika diperlukan
* Tampilan rapi, jelas, dan profesional

1. LOGIKA TOMBOL “MASUK SISTEM”
   Jika data yang tampil sudah benar:

* Karyawan klik tombol “Masuk Sistem”
* Sistem baru mengizinkan masuk ke dashboard utama
* Setelah itu dashboard tampil seperti biasa sesuai role
* Proses ini harus tersimpan sebagai log bahwa user sudah memverifikasi data

1. LOGIKA JIKA ADA DATA SALAH
   Jika karyawan menemukan kesalahan pada data yang tampil, sediakan tombol:

* “Laporkan Kesalahan Data”

Saat tombol diklik:

* Buka halaman/formulir laporan kesalahan data
* Form harus lengkap dan jelas
* Karyawan bisa memilih bagian data mana yang salah, misalnya:

  * nama
  * email
  * ID karyawan
  * foto
  * role
  * jabatan
  * status
  * nomor telepon
  * data lain yang tersedia
* Karyawan bisa menulis penjelasan detail kesalahan
* Karyawan bisa menambahkan data yang benar jika tahu
* Karyawan bisa upload bukti opsional, misalnya foto, screenshot, atau dokumen pendukung
* Kirim laporan ke admin secara realtime

1. HALAMAN FORM LAPORAN
   Buat formulir laporan dengan field seperti:

* Nama pelapor otomatis terisi
* ID karyawan otomatis terisi
* Email otomatis terisi
* Data yang salah (pilihan dropdown/checkbox)
* Nilai data yang salah saat ini
* Nilai data yang seharusnya
* Deskripsi laporan
* Upload bukti opsional
* Prioritas laporan jika diperlukan
* Tombol kirim laporan
* Tombol batal

Setelah laporan dikirim:

* Tampilkan notifikasi bahwa laporan berhasil dikirim
* Status laporan menjadi pending
* Admin menerima laporan secara realtime
* Karyawan bisa melihat riwayat laporan yang pernah dibuat

1. FITUR DI ADMIN UNTUK MENERIMA LAPORAN
   Di sisi admin buatkan halaman khusus laporan data karyawan yang berisi:

* Daftar laporan masuk
* Status laporan: pending, diproses, selesai, ditolak
* Filter berdasarkan tanggal, karyawan, status, dan jenis kesalahan
* Detail laporan saat diklik harus menampilkan seluruh data yang dikirim karyawan
* Tampilkan identitas pelapor
* Tampilkan data yang salah
* Tampilkan bukti jika ada
* Tampilkan waktu laporan dikirim
* Tampilkan riwayat status laporan

Saat admin klik laporan:

* Tampilkan data lengkap yang diisi karyawan
* Admin bisa melihat data lama dan data yang diusulkan
* Admin bisa menyetujui perbaikan, menolak, atau meminta revisi tambahan
* Admin bisa langsung memperbaiki data karyawan dari sini jika diizinkan
* Semua perubahan harus tercatat di log aktivitas

1. REALTIME SYNC
   Pastikan semua perubahan realtime dan sinkron antara:

* dashboard karyawan
* halaman verifikasi data
* halaman form laporan
* dashboard admin
* halaman detail laporan
* notifikasi sistem

Realtime harus mencakup:

* laporan baru masuk ke admin
* perubahan status laporan
* data karyawan setelah diperbaiki admin
* refresh status verifikasi
* akses masuk ke dashboard setelah verifikasi
* notifikasi bila laporan diproses atau selesai

1. VALIDASI DAN KEAMANAN
   Tambahkan validasi agar:

* Login hanya bisa dilakukan dengan email atau ID karyawan yang valid
* Data yang ditampilkan harus sesuai dengan akun yang login
* Karyawan tidak bisa langsung akses dashboard sebelum klik “Masuk Sistem”
* Jika ada data tidak cocok, sistem memberi status peringatan
* Laporan tidak boleh kosong
* Upload bukti opsional tetapi aman
* Admin hanya bisa mengubah data jika memang berhak
* Semua request harus dicek di backend, bukan hanya frontend
* Jika user refresh halaman, status verifikasi tetap tersimpan
* Jika user logout lalu login lagi, halaman verifikasi tetap muncul sebelum dashboard jika belum disetujui
* Aktivitas semua pihak tercatat di log audit

1. PESAN DAN KALIMAT UI
   Buat kalimat yang jelas dan profesional, misalnya:

Untuk halaman verifikasi:

* “Silakan periksa kembali data akun Anda sebelum masuk ke sistem.”
* “Pastikan nama, foto, ID karyawan, role, dan status sudah benar.”
* “Jika semua data sudah sesuai, klik Masuk Sistem.”
* “Jika ada data yang salah, silakan laporkan ke admin.”

Untuk laporan:

* “Laporkan kesalahan data akun Anda kepada admin agar segera diperbaiki.”
* “Isi formulir ini dengan lengkap agar proses verifikasi lebih cepat.”
* “Bukti pendukung bersifat opsional, tetapi sangat membantu.”

Untuk admin:

* “Laporan data karyawan baru telah masuk.”
* “Silakan cek detail data yang dilaporkan dan lakukan verifikasi.”
* “Perubahan data akan tersimpan dan tersinkron ke sistem secara realtime.”

1. STRUKTUR STATUS
   Gunakan status yang rapi, misalnya:

* login_success
* data_verification_pending
* verified
* report_submitted
* report_pending
* report_in_review
* report_approved
* report_rejected
* data_updated
* access_granted

1. STRUKTUR DATABASE
    Jika perlu, tambahkan atau perbaiki tabel/kolom untuk:

* data karyawan
* foto karyawan
* status verifikasi login
* riwayat login
* laporan kesalahan data
* detail field yang dilaporkan
* bukti upload
* status laporan
* catatan admin
* log aktivitas
* timestamp setiap perubahan

1. FITUR TAMBAHAN YANG DISARANKAN
    Tambahkan juga jika diperlukan:

* tombol lihat detail data dalam modal
* indikator bahwa data belum diverifikasi
* notifikasi realtime saat laporan diproses admin
* riwayat laporan per karyawan
* sistem komentar dari admin
* validasi ukuran file upload
* preview foto atau bukti sebelum dikirim
* notifikasi jika data sudah diperbaiki
* sinkronisasi ulang data setelah admin update
* perlindungan agar dashboard tidak bisa dibuka sebelum verifikasi selesai

1. OUTPUT YANG SAYA INGINKAN
    Buatkan:

* logika flow lengkap
* alur login yang tidak langsung masuk dashboard
* halaman verifikasi data karyawan
* halaman formulir laporan kesalahan data
* halaman admin untuk menerima dan memproses laporan
* notifikasi realtime
* validasi backend dan frontend
* saran struktur database
* logika status laporan dan akses dashboard
* pesan UI yang sopan dan profesional
* solusi agar sistem stabil, aman, dan siap produksi

Pastikan semua role karyawan/kasir dan admin benar-benar tersinkron realtime, mudah dipakai, dan tidak menimbulkan error saat login, verifikasi data, laporan kesalahan, atau pembaruan data.
