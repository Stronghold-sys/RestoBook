KEMBANGKAN FITUR "TAMBAH KARYAWAN BARU" MENJADI SISTEM MANAJEMEN DATA KARYAWAN YANG LENGKAP, MODERN, REALTIME, SINKRON, DAN TERINTEGRASI TANPA MENGHAPUS ATAU MERUSAK FITUR YANG SUDAH ADA.

PENTING:

- Jangan menghapus fitur lama.
- Jangan mengubah alur yang sudah berjalan dengan baik.
- Hanya tambahkan fitur baru, validasi, sinkronisasi, dan logika yang lebih lengkap.
- Pertahankan seluruh fungsi yang sudah ada.
- Pastikan seluruh perubahan realtime tanpa refresh browser.
- Pastikan data admin dan akun karyawan selalu sinkron.
- Pastikan foto karyawan hanya terhubung ke akun karyawan yang bersangkutan dan tidak memengaruhi karyawan lain.

==================================================
FITUR YANG HARUS TETAP DIPERTAHANKAN
==================================================

- Nama Lengkap
- Email
- Jabatan
- Nomor Telepon
- ID Karyawan Otomatis
- Password Sementara Otomatis
- Download PDF Data Login

==================================================
FORMULIR DATA KARYAWAN LENGKAP
==================================================

SECTION 1 - DATA PRIBADI

- Foto Karyawan
- Nama Lengkap
- Nama Panggilan
- Jenis Kelamin
- Tempat Lahir
- Tanggal Lahir
- Agama
- Status Pernikahan
- Nomor KTP / NIK
- Nomor KK
- Email
- Nomor Telepon
- Nomor WhatsApp
- Alamat Lengkap
- RT
- RW
- Kelurahan / Desa
- Kecamatan
- Kota / Kabupaten
- Provinsi
- Kode Pos

SECTION 2 - DATA PEKERJAAN

- Jabatan
- Divisi
- Departemen
- Status Karyawan
- Tanggal Masuk Kerja
- Shift Kerja
- Lokasi Penempatan
- Atasan Langsung
- Gaji Pokok
- Tunjangan
- Status Kerja

SECTION 3 - DATA AKUN

- ID Karyawan Otomatis
- Username
- Password Sementara Otomatis
- Role
- Hak Akses
- Status Akun

SECTION 4 - KONTAK DARURAT

- Nama Kontak Darurat
- Hubungan
- Nomor Telepon Darurat
- Alamat Kontak Darurat

SECTION 5 - PENDIDIKAN DAN KOMPETENSI

- Pendidikan Terakhir
- Nama Sekolah / Kampus
- Jurusan
- Tahun Lulus
- Sertifikasi
- Skill / Keahlian
- Catatan Tambahan

==================================================
FITUR UPLOAD FOTO KARYAWAN
==================================================

Tambahkan fitur upload foto profesional.

Fitur:

- Upload dari device
- Drag & Drop
- Preview foto sebelum simpan
- Crop foto
- Rotate foto
- Zoom foto
- Kompres otomatis
- Rename file otomatis
- Nama file unik
- Validasi format
- Validasi ukuran file

Format:

- JPG
- JPEG
- PNG
- WEBP

Jika foto belum ada:

- gunakan avatar default

Foto digunakan untuk:

- Foto profil akun karyawan
- Avatar navbar
- Dashboard karyawan
- Detail profil
- Data karyawan
- PDF login (opsional)

==================================================
LOGIKA PENAMBAHAN KARYAWAN
==================================================

Saat Admin klik tombol SIMPAN atau BUAT KARYAWAN:

1. Validasi seluruh data.
2. Validasi foto.
3. Generate ID Karyawan.
4. Generate Username.
5. Generate Password Sementara.
6. Upload foto.
7. Simpan data karyawan.
8. Simpan data akun.
9. Hubungkan data akun dengan data karyawan.
10. Simpan data kontak darurat.
11. Simpan data pendidikan.
12. Simpan data skill.
13. Generate PDF Login.
14. Simpan Activity Log.
15. Kirim notifikasi realtime.
16. Sinkronkan data ke akun karyawan.

Jika ada proses gagal:

- batalkan seluruh proses
- tampilkan pesan error yang jelas
- jangan menyimpan data setengah jadi

==================================================
LOGIKA ID KARYAWAN
==================================================

Format:

KRY-000001
KRY-000002
KRY-000003

Ketentuan:

- unik
- tidak boleh duplikat
- aman jika banyak admin membuat akun bersamaan
- tetap berurutan
- tidak berubah walaupun ada data dihapus

==================================================
LOGIKA PASSWORD SEMENTARA
==================================================

Password otomatis harus:

- memiliki huruf besar
- huruf kecil
- angka
- simbol

Password:

- disimpan secara aman
- ditampilkan sekali setelah akun dibuat
- masuk ke PDF Login
- wajib diganti saat login pertama

==================================================
LOGIKA FOTO KARYAWAN DAN AKUN
==================================================

SANGAT PENTING:

Foto yang diupload admin harus langsung menjadi:

- Foto Data Karyawan
- Foto Profil Akun Karyawan
- Avatar Dashboard
- Avatar Navbar
- Foto Profil Lengkap

Tetapi hanya untuk karyawan yang bersangkutan.

CONTOH:

Admin membuat:

Karyawan A
employee_id = 101
user_id = 201

Upload:
foto-a.jpg

Maka:

employee 101 menggunakan foto-a.jpg
user 201 menggunakan foto-a.jpg

Hasil:

✓ Foto muncul di data karyawan A
✓ Foto muncul di akun karyawan A
✓ Foto muncul di navbar akun A
✓ Foto muncul di dashboard akun A

TIDAK BOLEH:

✗ Foto berubah di akun karyawan B
✗ Foto berubah di akun karyawan C
✗ Foto berubah di akun lain

==================================================
LOGIKA UPDATE FOTO
==================================================

Saat Admin mengganti foto karyawan:

1. Upload foto baru.
2. Validasi file.
3. Simpan file.
4. Update foto pada data karyawan.
5. Update avatar akun karyawan.
6. Simpan log aktivitas.
7. Kirim event realtime hanya ke akun terkait.

HASIL:

✓ Dashboard Admin langsung berubah
✓ Detail Karyawan langsung berubah
✓ Profil Karyawan langsung berubah
✓ Navbar Karyawan langsung berubah

Tanpa refresh browser.

==================================================
REALTIME DAN SINKRONISASI
==================================================

Semua perubahan harus realtime.

Saat Admin:

- Menambah Karyawan
- Mengubah Nama
- Mengubah Email
- Mengubah Nomor Telepon
- Mengubah Jabatan
- Mengubah Role
- Mengubah Status Akun
- Mengubah Foto

Maka perubahan langsung terlihat pada:

- Dashboard Admin
- Daftar Karyawan
- Detail Karyawan
- Akun Karyawan yang bersangkutan
- Profil Karyawan

Tanpa refresh browser.

==================================================
LOGIKA SINKRONISASI DATA
==================================================

Jika Admin mengubah:

NAMA
→ data akun ikut berubah

EMAIL
→ data akun ikut berubah

NO TELEPON
→ data akun ikut berubah

FOTO
→ avatar akun ikut berubah

JABATAN
→ role dan hak akses ikut diperbarui

STATUS AKUN
→ akses akun ikut diperbarui

Perubahan harus langsung muncul pada akun terkait secara realtime.

==================================================
LOGIKA ROLE DAN HAK AKSES
==================================================

Jika jabatan berubah:

Kasir
→ Role Kasir

Supervisor
→ Role Supervisor

Manager
→ Role Manager

Admin
→ Role Admin

Saat role berubah:

- menu otomatis menyesuaikan
- hak akses otomatis menyesuaikan
- tidak perlu logout
- tidak perlu refresh

==================================================
LOGIKA STATUS AKUN
==================================================

Jika akun dinonaktifkan:

- status akun berubah
- notifikasi realtime dikirim
- akses dibatasi
- sesi dapat diputus jika diperlukan

Jika akun diaktifkan:

- akses kembali normal
- hak akses aktif kembali

==================================================
NOTIFIKASI REALTIME
==================================================

Admin menerima:

- Karyawan berhasil dibuat
- Data berhasil diperbarui
- Foto berhasil diperbarui
- Role berhasil diubah
- Akun diaktifkan
- Akun dinonaktifkan
- Password direset

Karyawan menerima:

- Akun berhasil dibuat
- Profil diperbarui
- Foto diperbarui
- Password diperbarui
- Role diperbarui
- Status akun diperbarui

==================================================
VALIDASI
==================================================

Email:

- wajib
- format valid
- unik

Nomor Telepon:

- wajib
- format valid

NIK:

- numerik
- panjang sesuai standar

Tanggal Lahir:

- tidak boleh lebih besar dari hari ini

Tanggal Masuk:

- tidak boleh lebih kecil dari tanggal lahir

Gaji:

- hanya angka

Foto:

- format valid
- ukuran valid

==================================================
AUDIT LOG
==================================================

Simpan:

- siapa yang membuat
- siapa yang mengubah
- siapa yang menghapus
- data sebelum perubahan
- data sesudah perubahan
- waktu perubahan
- alamat IP
- browser
- perangkat

==================================================
PDF LOGIN
==================================================

PDF harus berisi:

- Foto Karyawan
- Nama Lengkap
- ID Karyawan
- Username
- Password Sementara
- Jabatan
- Status Akun
- Tanggal Pembuatan

Tambahkan catatan:

"Password wajib diganti saat login pertama demi keamanan akun."

==================================================
HASIL AKHIR YANG DIHARAPKAN
==================================================

✓ Form karyawan lebih lengkap
✓ Data lebih profesional
✓ Upload foto dari device
✓ Foto otomatis menjadi foto akun karyawan
✓ Foto hanya memengaruhi akun karyawan yang bersangkutan
✓ Tidak memengaruhi karyawan lain
✓ Sinkron realtime Admin ↔ Karyawan
✓ Tanpa refresh browser
✓ PDF login otomatis
✓ Audit log lengkap
✓ Validasi lengkap
✓ Hak akses otomatis menyesuaikan
✓ Aman dari konflik data
✓ Aman digunakan banyak admin dan banyak karyawan secara bersamaan
✓ Seluruh fitur lama tetap berjalan normal
✓ UI tetap modern, rapi, responsif, dan mudah digunakan
