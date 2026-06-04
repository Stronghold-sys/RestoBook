Tambahkan dan implementasikan logika fitur “Dompetku” di sisi pelanggan dan admin dengan alur aktivasi akun yang lengkap, aman, dan terstruktur. Jangan merusak fitur yang sudah ada. Integrasikan dengan notifikasi aplikasi, email otomatis, validasi form, dan manajemen status pengajuan.

1) GAGASAN UTAMA FITUR DOMPETKU

- Dompetku tidak boleh langsung aktif untuk akun baru.
- Akun baru wajib melakukan aktivasi terlebih dahulu sebelum bisa menggunakan Dompetku untuk pembayaran.
- Aktivasi harus melalui formulir data diri yang lengkap, unggah dokumen, dan verifikasi admin.
- Sistem harus mendukung:
  - pengajuan aktivasi
  - proses verifikasi admin
  - persetujuan atau penolakan
  - pengajuan ulang jika ditolak
  - notifikasi status otomatis di aplikasi dan email

1) ALUR PELANGGAN
A. Saat akun baru dibuat:

- Status Dompetku default = “belum aktif”.
- Tombol/opsi Dompetku tetap terlihat, tetapi belum bisa digunakan untuk transaksi.
- Jika pelanggan membuka halaman Dompetku, tampilkan pesan bahwa Dompetku belum aktif dan perlu aktivasi terlebih dahulu.

B. Saat pelanggan klik “Aktivasi Dompetku”:

- Arahkan ke halaman formulir aktivasi.
- Form harus divalidasi lengkap sebelum bisa diajukan.
- Sediakan upload dokumen dari:
  - device / galeri
  - kamera langsung
- Sediakan preview file sebelum submit.
- Jika file rusak, format tidak sesuai, atau ukuran terlalu besar, tampilkan pesan error yang jelas.

C. Setelah formulir lengkap lalu klik “Ajukan”:

- Simpan data pengajuan ke database.
- Status awal pengajuan = “diajukan”.
- Tampilkan notifikasi bahwa pengajuan sedang diproses admin.
- Kirim email otomatis ke pelanggan bahwa pengajuan telah diterima sistem dan sedang menunggu verifikasi.

D. Jika pelanggan membuka metode pembayaran Dompetku sementara belum aktif:

- Tampilkan peringatan:
  “Dompetku belum diaktifkan. Silakan lakukan aktivasi terlebih dahulu untuk menggunakan metode pembayaran ini.”
- Sediakan tombol “Aktivasi Sekarang”.
- Jika tombol diklik, langsung masuk ke halaman formulir aktivasi.

E. Jika status masih diproses:

- Tampilkan informasi bahwa pelanggan harus menunggu hasil verifikasi admin.
- Blokir penggunaan Dompetku sampai status aktif.

1) FORMULIR AKTIVASI DOMPETKU UNTUK PELANGGAN
Buat formulir aktivasi paling lengkap dengan field berikut:

A. Data pribadi:

- Nama lengkap sesuai identitas
- Nomor induk kependudukan (NIK)
- Tempat lahir
- Tanggal lahir
- Jenis kelamin
- Status perkawinan
- Kewarganegaraan
- Agama
- Pekerjaan
- Nama ibu kandung

B. Kontak:

- Nomor HP aktif
- Email aktif
- Alamat lengkap
- RT/RW
- Kelurahan/Desa
- Kecamatan
- Kota/Kabupaten
- Provinsi
- Kode pos

C. Data identitas tambahan:

- Nama sesuai KTP
- Nomor KTP
- Foto KTP depan
- Foto KTP belakang jika diperlukan

D. Data dompet / verifikasi:

- Tujuan penggunaan Dompetku
- Sumber dana utama
- Pernyataan bahwa data yang diisi benar
- Checkbox persetujuan syarat dan ketentuan
- Checkbox persetujuan kebijakan privasi
- Checkbox persetujuan verifikasi data

E. Dokumen upload:

- Upload KTP
- Upload dokumen pendukung lain bila diperlukan
- Upload harus bisa dari file device dan kamera langsung
- Tampilkan status setiap file: belum dipilih, berhasil diunggah, gagal, perlu diulang

F. Validasi form:

- Semua field wajib diisi kecuali yang ditandai opsional
- NIK dan nomor KTP harus numerik dan panjang sesuai aturan
- Email harus valid
- Nomor HP harus valid
- Tanggal lahir harus masuk akal
- Foto/dokumen harus berformat yang didukung
- Maksimal ukuran file harus dibatasi
- Form tidak bisa diajukan jika ada field kosong atau dokumen kurang

1) KETERANGAN KEAMANAN DATA

- Tambahkan keterangan bahwa seluruh data pelanggan dijamin aman, terlindungi, dan hanya digunakan untuk keperluan verifikasi aktivasi Dompetku.
- Tampilkan teks yang meyakinkan namun tetap profesional, misalnya:

“Seluruh data dan dokumen yang Anda kirimkan dijamin aman, terlindungi, dan hanya digunakan untuk proses verifikasi aktivasi Dompetku. Kami menjaga kerahasiaan data Anda sesuai kebijakan privasi yang berlaku.”

- Tambahkan juga keterangan:
  “Data Anda tidak dibagikan kepada pihak yang tidak berwenang dan hanya dapat diakses oleh tim terkait untuk keperluan verifikasi.”

1) LOGIKA STATUS PENGAJUAN DOMPETKU
Buat status pengajuan berikut:

- Diajukan
  Artinya pelanggan baru mengirim formulir dan dokumen.
  Notifikasi:
  “Pengajuan aktivasi Dompetku berhasil dikirim. Tim kami akan meninjau data Anda.”

- Diproses
  Artinya admin sedang memeriksa data dan dokumen.
  Notifikasi:
  “Pengajuan aktivasi Dompetku sedang diproses. Mohon tunggu hasil verifikasi.”

- Diterima
  Artinya admin menyetujui pengajuan.
  Dampak:
  - Dompetku menjadi aktif
  - pelanggan bisa memakai Dompetku saat pembayaran
  - kirim email dan notifikasi aplikasi
  Teks notifikasi:
  “Selamat, aktivasi Dompetku Anda telah disetujui dan sekarang aktif.”

- Ditolak
  Artinya admin menolak pengajuan karena data/dokumen belum lengkap atau tidak sesuai.
  Dampak:
  - Dompetku tetap nonaktif
  - tampilkan daftar alasan penolakan
  - tandai dokumen/field yang harus diperbaiki
  - pelanggan wajib memperbaiki dan mengunggah ulang
  Teks notifikasi:
  “Pengajuan aktivasi Dompetku Anda ditolak. Silakan perbaiki data atau unggah ulang dokumen yang diminta.”

- Selesai
  Artinya proses aktivasi telah rampung, akun aktif dan siap digunakan.
  Teks notifikasi:
  “Proses aktivasi Dompetku telah selesai. Fitur siap digunakan.”

1) LOGIKA DI HALAMAN PEMBAYARAN

- Jika pelanggan memilih metode pembayaran Dompetku:
  - cek status Dompetku
  - jika status belum aktif, blokir proses pembayaran dengan pesan peringatan
  - tampilkan tombol “Aktivasi Dompetku”
  - tombol tersebut mengarah langsung ke halaman formulir aktivasi
- Jika status aktif, lanjutkan pembayaran normal.
- Jika status dalam proses, tampilkan informasi bahwa pelanggan harus menunggu hasil verifikasi.

1) FITUR ADMIN UNTUK MANAJEMEN AKTIVASI
Buat menu khusus di admin, misalnya:

- Manajemen Aktivasi Dompetku
- Daftar pengajuan baru
- Pengajuan diproses
- Pengajuan disetujui
- Pengajuan ditolak
- Riwayat aktivasi

Fitur admin harus bisa:

- melihat daftar seluruh pengajuan
- membuka detail data pelanggan
- melihat preview semua dokumen
- menandai field/dokumen yang tidak valid
- memberikan catatan revisi
- menyetujui pengajuan
- menolak pengajuan
- mengubah status pengajuan
- melihat riwayat perubahan status
- mencatat siapa admin yang memproses dan waktu proses
- menambahkan log aktivitas audit

1) LOGIKA ADMIN SAAT VERIFIKASI
A. Saat pengajuan masuk:

- status otomatis = “diajukan”
- admin bisa ubah ke “diproses” ketika mulai memeriksa

B. Saat data lengkap dan valid:

- admin klik “setujui”
- status menjadi “diterima”
- akun Dompetku langsung aktif
- sistem kirim notifikasi dan email otomatis

C. Saat data tidak sesuai:

- admin klik “tolak”
- isi alasan penolakan
- tandai dokumen/field yang harus diperbaiki
- sistem kirim notifikasi dan email otomatis
- status menjadi “ditolak”

D. Saat pelanggan mengajukan ulang:

- pelanggan hanya bisa mengirim ulang field/dokumen yang diminta perbaikan
- status pengajuan kembali ke “diajukan” atau “diproses” sesuai alur
- simpan histori revisi
- kirim notifikasi saat submit ulang

1) LOGIKA PENGAJUAN ULANG

- Jika pengajuan ditolak, tampilkan tombol “Perbaiki dan Ajukan Ulang”.
- Tampilkan daftar alasan penolakan dengan jelas.
- Dokumen yang ditandai admin harus bisa diunggah ulang.
- Sistem harus menyimpan versi revisi dokumen.
- Setelah pengajuan ulang dikirim:
  - status = “diajukan ulang”
  - admin menerima daftar revisi baru
  - proses verifikasi dimulai lagi

1) NOTIFIKASI APLIKASI DAN EMAIL OTOMATIS
Setiap perubahan status harus:

- muncul di fitur notifikasi pelanggan
- dikirim ke email pelanggan secara otomatis
- menyimpan histori notifikasi di database

Teks notifikasi/email yang disarankan:

A. Diajukan
“Pengajuan aktivasi Dompetku Anda telah berhasil dikirim dan sedang menunggu verifikasi.”

B. Diproses
“Tim kami sedang memeriksa pengajuan aktivasi Dompetku Anda. Mohon menunggu hasil verifikasi.”

C. Diterima
“Selamat, pengajuan aktivasi Dompetku Anda telah disetujui. Fitur Dompetku sekarang aktif dan dapat digunakan.”

D. Ditolak
“Maaf, pengajuan aktivasi Dompetku Anda belum dapat disetujui. Silakan perbaiki data atau unggah ulang dokumen sesuai catatan admin.”

E. Selesai
“Proses aktivasi Dompetku Anda telah selesai. Terima kasih telah melengkapi data dengan benar.”

1) ATURAN KEAMANAN DAN VALIDASI

- Enkripsi data sensitif.
- Batasi akses dokumen hanya untuk admin yang berwenang.
- Simpan log siapa yang melihat, menyetujui, menolak, atau mengubah status.
- Gunakan validasi server-side dan client-side.
- Tolak file berbahaya atau format yang tidak didukung.
- Kompres file foto bila perlu tanpa menurunkan kualitas terlalu jauh.
- Buat pengecekan duplikasi pengajuan jika NIK atau akun sudah pernah mengajukan.

1) UX / UI YANG HARUS ADA

- Status Dompetku terlihat jelas di halaman pelanggan.
- Ada badge status: belum aktif, diajukan, diproses, diterima, ditolak, selesai.
- Tombol aktivasi harus mudah ditemukan.
- Tampilkan pesan informatif dan ramah.
- Tampilkan progress pengajuan jika memungkinkan.
- Tampilkan area upload yang modern dengan drag and drop, pilih file, dan kamera langsung.
- Tampilkan catatan admin secara detail saat ditolak.

1) KETENTUAN AKHIR IMPLEMENTASI

- Pastikan semua alur berjalan end-to-end.
- Pastikan pembayaran dengan Dompetku hanya bisa dipakai jika status aktif.
- Pastikan notifikasi dan email terkirim otomatis pada setiap perubahan status.
- Pastikan admin memiliki kontrol penuh terhadap proses pengajuan.
- Pastikan pelanggan bisa memperbaiki dan mengajukan ulang jika ditolak.
- Pastikan semua status dan log tersimpan rapi di database.
- Pastikan data pelanggan dijamin aman dan hanya digunakan untuk proses verifikasi aktivasi.

Buat implementasi ini lengkap, rapi, aman, dan siap dipakai pada sistem produksi.
