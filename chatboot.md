TAMBAHKAN FITUR BARU: SPOTLIGHT TOUR / INTERACTIVE USER GUIDE / ONBOARDING TUTORIAL

Ke dalam website/aplikasi yang sedang dikembangkan, implementasikan fitur onboarding interaktif bernama "Spotlight Tour" yang berfungsi sebagai tutorial panduan penggunaan web dan aplikasi secara visual, modern, dan mudah dipahami.

TUJUAN UTAMA:

- Membimbing user baru secara otomatis saat pertama kali login / daftar akun baru.
- Menjelaskan seluruh menu, halaman, tombol, alur kerja, dan fitur yang ada di halaman pelanggan setelah login.
- Memberikan panduan bertahap, interaktif, dan kontekstual langsung di dalam UI.
- Bisa diulang kembali kapan saja oleh user lama melalui menu bantuan / profil / pengaturan.
- Memberikan pengalaman onboarding yang profesional, ramah pengguna, dan cocok untuk production.

RUANG LINGKUP FITUR SPOTLIGHT TOUR:

1. Tampilkan tutorial otomatis untuk akun baru / pelanggan baru saat login pertama kali.
2. Tampilkan highlight bertahap untuk seluruh menu halaman pelanggan, termasuk:
   - Dashboard
   - Profil akun
   - Data pesanan
   - Riwayat transaksi
   - Tiket digital
   - Pembayaran
   - Notifikasi
   - Bantuan / pusat bantuan
   - Pengaturan akun
   - Fitur-fitur lain yang tersedia di halaman pelanggan
3. Setiap langkah tutorial menyorot elemen UI tertentu dengan efek spotlight / overlay gelap di luar area fokus.
4. Tampilkan pop-up penjelasan singkat, jelas, dan mudah dipahami untuk setiap fitur.
5. Sediakan tombol:
   - Next
   - Previous
   - Skip Tour
   - Finish
   - Jangan tampilkan lagi
6. Setelah tour selesai, simpan status bahwa tutorial sudah pernah ditampilkan.
7. Jika user menekan “Jangan tampilkan lagi”, tutorial tidak muncul otomatis lagi kecuali di-reset.
8. Sediakan menu “Lihat Panduan” / “Ulangi Tour” di halaman pelanggan agar user bisa membuka tutorial kapan saja.

LOGIKA SISTEM SPOTLIGHT TOUR:

- Saat user pertama kali registrasi atau login sebagai akun baru:
  - sistem mengecek status `is_first_login` atau `tour_completed`.
  - jika belum pernah melihat tutorial, maka tour langsung muncul otomatis.
- Setelah tour selesai:
  - simpan flag ke database atau local storage:
    - `tour_completed = true`
    - `first_login = false`
- Jika user memilih skip:
  - tetap simpan status bahwa tour pernah ditampilkan.
- Jika admin ingin reset tutorial:
  - sediakan fitur reset dari panel admin.
- Tutorial harus bersifat per halaman:
  - halaman dashboard punya tour sendiri
  - halaman riwayat punya tour sendiri
  - halaman tiket digital punya tour sendiri
  - halaman pembayaran punya tour sendiri
- Jika user membuka fitur baru yang belum pernah dipakai:
  - tampilkan micro-tour / tooltip singkat untuk fitur tersebut.
- Gunakan kondisi agar tour tidak mengganggu user lama:
  - hanya tampil otomatis pada akun baru atau saat fitur baru ditambahkan.

FITUR TAMBAHAN YANG WAJIB DIIMPLEMENTASIKAN SECARA LENGKAP:

1. Contextual Help / Tooltip
   - tooltip muncul saat hover atau klik pada icon bantuan.
   - menjelaskan fungsi tombol dan menu secara singkat.

2. Guided Empty State
   - saat data masih kosong, tampilkan pesan edukatif:
     “Belum ada pesanan. Klik tombol Buat Pesanan untuk memulai.”

3. Help Center / Pusat Bantuan
   - halaman khusus berisi panduan penggunaan, FAQ, langkah-langkah, dan kontak bantuan.

4. Searchable Knowledge Base
   - user bisa mencari kata kunci panduan fitur tertentu.

5. Progress Tutorial
   - tampilkan progres langkah tutorial, misalnya:
     “Langkah 2 dari 8”.

6. Tutorial Multi-Device
   - responsif di desktop, tablet, dan mobile.

7. Accessibility Support
   - tombol mudah diakses keyboard
   - kontras jelas
   - teks mudah dibaca
   - dukungan screen reader.

8. Admin Tutorial Management
   - admin bisa mengubah isi tutorial, urutan langkah, teks penjelasan, dan status aktif/nonaktif.

9. Analytics Tutorial
   - catat apakah user menyelesaikan tutorial, skip, atau mengulangi tour.
   - simpan data untuk evaluasi UX.

10. Notification Onboarding

- setelah daftar/login pertama, tampilkan notifikasi sambutan dan ajakan memulai tour.

1. Reset Tour Button

- user bisa reset tour dari pengaturan akun.
- admin juga bisa reset dari dashboard admin.

1. Role-Based Tutorial

- jika ada role berbeda, tampilkan tutorial sesuai role:
  - pelanggan
  - admin
  - kasir / operator
  - owner / super admin

KETENTUAN UI/UX:

- Desain modern, clean, premium, dan konsisten dengan desain website.
- Gunakan animasi halus saat berpindah langkah.
- Overlay spotlight harus fokus pada elemen aktif dan membuat area lain redup.
- Pop-up tutorial harus mobile-friendly.
- Gunakan bahasa tutorial yang sederhana, sopan, dan mudah dipahami oleh user awam.
- Jangan membuat tutorial terlalu panjang dalam satu langkah.
- Pastikan tutorial tidak mengganggu proses transaksi penting.

STRUKTUR DATA / DATABASE YANG DISARANKAN:
Buat tabel atau struktur data untuk menyimpan:

- user_id
- tour_completed
- first_login
- tour_version
- last_tour_step
- skipped_tour
- tour_reset_at
- role
- created_at
- updated_at

Jika perlu, buat juga tabel:

- tutorial_steps
- tutorial_categories
- tutorial_logs
- tutorial_progress

ALUR PENGGUNAAN:

1. User registrasi / login pertama kali.
2. Sistem mendeteksi akun baru.
3. Tour otomatis muncul.
4. User mengikuti langkah demi langkah.
5. User bisa next, back, skip, atau finish.
6. Setelah selesai, status tersimpan.
7. Pada login berikutnya, tour tidak muncul lagi kecuali di-reset.
8. User bisa membuka tour manual dari menu bantuan kapan saja.

KATA-KATA PENJELASAN TUTORIAL YANG MUNCUL DI SETIAP LANGKAH:

1. Selamat Datang
   - Judul: Selamat datang di TiketKu
   - Teks: Kami akan memandu Anda mengenal semua fitur penting agar Anda lebih mudah memesan, membayar, dan melihat tiket digital.

2. Dashboard
   - Judul: Halaman Utama
   - Teks: Ini adalah pusat aktivitas Anda. Dari sini Anda bisa melihat ringkasan pesanan, notifikasi, dan akses cepat ke fitur utama.

3. Menu Profil
   - Judul: Profil Akun
   - Teks: Di sini Anda dapat melihat dan mengubah data diri, email, nomor kontak, serta pengaturan akun Anda.

4. Menu Pesanan
   - Judul: Data Pesanan
   - Teks: Menu ini menampilkan semua pesanan tiket yang sedang diproses, sudah dibayar, atau menunggu tindakan Anda.

5. Menu Riwayat
   - Judul: Riwayat Transaksi
   - Teks: Semua transaksi yang pernah Anda lakukan akan tersimpan di sini agar mudah dicek kembali kapan saja.

6. Menu Pembayaran
   - Judul: Pembayaran
   - Teks: Gunakan menu ini untuk menyelesaikan pembayaran pesanan tiket Anda dengan aman dan cepat.

7. Tiket Digital
   - Judul: Tiket Digital
   - Teks: Setelah pembayaran berhasil, tiket Anda akan muncul di sini lengkap dengan detail film dan kode QR untuk digunakan saat masuk bioskop.

8. Kode QR
   - Judul: Kode QR Tiket
   - Teks: Tunjukkan kode QR ini saat masuk. Kode ini berisi data tiket Anda dan akan diverifikasi oleh petugas.

9. Notifikasi
   - Judul: Notifikasi Penting
   - Teks: Semua pemberitahuan seperti status pembayaran, tiket siap, atau informasi terbaru akan tampil di sini.

10. Bantuan

- Judul: Pusat Bantuan
- Teks: Jika ada yang belum jelas, buka menu ini untuk melihat panduan, FAQ, atau cara menggunakan setiap fitur.

1. Pengaturan Akun

- Judul: Pengaturan
- Teks: Di sini Anda bisa mengatur preferensi akun, keamanan, bahasa, dan tampilan aplikasi.

1. Tombol Buat Pesanan

- Judul: Mulai Pesanan
- Teks: Klik tombol ini untuk memulai pemesanan tiket baru dan memilih film, jadwal, serta kursi.

1. Status Pesanan

- Judul: Pantau Status
- Teks: Bagian ini membantu Anda mengetahui apakah pesanan masih menunggu, sudah dibayar, atau sudah selesai.

1. Logout

- Judul: Keluar Akun
- Teks: Gunakan tombol ini untuk keluar dari akun Anda dengan aman setelah selesai menggunakan aplikasi.

1. Selesai Tutorial

- Judul: Tutorial Selesai
- Teks: Anda sudah mengenal fitur utama aplikasi. Anda bisa membuka panduan ini lagi kapan saja melalui menu bantuan.

HASIL AKHIR YANG DIINGINKAN:

- Implementasikan fitur Spotlight Tour secara full production-ready.
- Pastikan semua menu halaman pelanggan memiliki panduan masing-masing.
- Tambahkan fitur onboarding, bantuan, tooltip, FAQ, dan manajemen tutorial.
- Buat sistem yang scalable, rapi, dan mudah dikembangkan.
- Jangan hanya membuat popup sederhana, tetapi buat sistem tutorial interaktif yang benar-benar lengkap dan profesional.

OUTPUT YANG DIMINTA:

- Kode implementasi lengkap
- Struktur logika fitur
- Integrasi ke seluruh halaman pelanggan
- Integrasi ke database / penyimpanan status tutorial
- Desain UI yang konsisten
- Fitur admin untuk mengelola tutorial
- Dokumentasi singkat cara kerja fitur
