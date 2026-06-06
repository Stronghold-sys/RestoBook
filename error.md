Buat ulang fitur multi-language / language switcher secara total tanpa menggunakan API translation sama sekali.

TUJUAN

- Website hanya mendukung 2 bahasa: Bahasa Indonesia dan English.
- Semua teks pada seluruh file kode harus dibuat bilingual dan siap berubah otomatis saat pengguna memilih bahasa.
- Semua kalimat yang sebelumnya hanya ada dalam Bahasa Indonesia harus diubah agar memiliki padanan English di semua bagian aplikasi.
- Bahasa pada AI chatbot juga harus mengikuti bahasa yang dipilih pengguna web secara otomatis.
- AI chat kasir juga wajib menyesuaikan bahasa aktif pengguna.
- Fitur ini harus berlaku untuk semua role: admin, kasir, pelanggan, dan role lain yang ada di sistem.
- Bahasa juga harus bisa diganti di seluruh halaman, termasuk halaman utama promosi / landing page / homepage public.

KETENTUAN UTAMA

1. Jangan gunakan API translation apa pun.
2. Gunakan sistem translation lokal berbasis key/value.
3. Semua teks statis di UI harus dipindahkan ke file bahasa, bukan hardcoded di komponen.
4. Semua file yang berisi teks harus diubah agar memakai key translation.
5. Saat user mengganti bahasa, seluruh UI langsung berubah tanpa reload penuh jika memungkinkan.
6. Preferensi bahasa harus disimpan, misalnya di localStorage, session, database user profile, atau cookie agar tetap tersimpan setelah refresh/login ulang.
7. Default language bisa mengikuti bahasa browser, kalau tidak ada maka gunakan Indonesia atau English sesuai aturan sistem.
8. Jika translation key tidak ditemukan, tampilkan fallback ke English.
9. Semua pesan validasi, notifikasi, alert, toast, modal, label form, menu, sidebar, header, footer, button, empty state, error message, success message, breadcrumb, tooltip, dan semua teks sistem harus ikut diterjemahkan.
10. Semua status, role label, dan teks dinamis juga harus disiapkan terjemahannya.

STRUKTUR YANG HARUS DIBANGUN

- Buat file terjemahan lokal seperti:
  - /locales/id.json
  - /locales/en.json
- Gunakan key yang konsisten, misalnya:
  - common.save
  - common.cancel
  - auth.login
  - auth.logout
  - dashboard.welcome
  - order.status.pending
  - validation.required
  - chatbot.greeting
- Jangan ada teks langsung di UI selain key translation.

LOGIKA SWITCHER

- Tambahkan language switcher di header, navbar, sidebar, settings, dan halaman utama promosi.
- Pilihan bahasa hanya:
  - Bahasa Indonesia
  - English
- Saat user memilih bahasa:
  - state bahasa berubah
  - semua komponen rerender
  - teks berubah sesuai dictionary
  - chatbot dan template respons juga ikut berganti bahasa
- Simpan pilihan bahasa supaya tetap aktif setelah refresh.

LOGIKA CHATBOT AI

- Chatbot wajib membaca bahasa aktif dari state global.
- Semua system prompt, greeting, fallback response, button quick reply, dan pesan bantuan harus mengikuti bahasa yang dipilih.
- Jika bahasa aktif Indonesia, chatbot menjawab dalam Bahasa Indonesia.
- Jika bahasa aktif English, chatbot menjawab dalam English.
- Jangan hardcode jawaban chatbot hanya dalam satu bahasa.
- AI chat kasir juga harus mengikuti bahasa aktif pengguna secara otomatis.
- Siapkan template respons bilingual untuk:
  - salam pembuka
  - bantuan menu
  - error
  - konfirmasi
  - pesan sukses
  - pesan kosong
  - instruksi penggunaan
- Jika chatbot memakai AI model, kirim parameter bahasa aktif ke prompt sistem agar respons konsisten dengan bahasa user.
- Pastikan chatbot di halaman kasir, admin, pelanggan, dan halaman utama promosi semuanya memakai bahasa yang sama dengan pilihan user.

PENGGUNAAN DI SELURUH ROLE DAN HALAMAN

- Admin panel
- Kasir panel
- Customer panel
- Halaman utama promosi / landing page / homepage public
- Login, register, forgot password, OTP, profile, settings, notifikasi, laporan, transaksi, dashboard, tabel, pagination, modal, banner, hero section, CTA, pricing section, footer, dan semua halaman lain harus ikut translation.
- Setiap role boleh punya key khusus, tetapi tetap mengikuti bahasa global yang sama.
- Semua teks promosi, headline, subheadline, tombol CTA, slogan, fitur unggulan, dan deskripsi layanan pada halaman utama juga harus bisa berubah bahasa.

KWITANSI / RECEIPT / STRUK

- Semua teks pada kwitansi/receipt/struk harus ikut berubah sesuai bahasa aktif.
- Kwitansi untuk role pengguna dan kasir wajib menggunakan bahasa yang sama dengan pilihan user.
- Jika bahasa Indonesia dipilih, isi kwitansi harus tampil dalam Bahasa Indonesia.
- Jika English dipilih, isi kwitansi harus tampil dalam English.
- Semua bagian kwitansi harus diterjemahkan, termasuk:
  - judul kwitansi
  - nomor transaksi
  - tanggal dan waktu
  - nama pelanggan
  - nama kasir
  - daftar item
  - jumlah
  - subtotal
  - diskon
  - pajak
  - total
  - metode pembayaran
  - status pembayaran
  - pesan terima kasih
  - catatan tambahan
  - footer / disclaimer
- Kwitansi harus berlaku untuk:
  - role pengguna / customer
  - role kasir
  - role admin jika ada preview atau cetak laporan
- Jika ada tombol cetak / download kwitansi, labelnya juga harus ikut bahasa aktif.
- Format nominal di kwitansi harus mengikuti locale mata uang aktif.

PENYESUAIAN KODE

- Ubah seluruh hardcoded text Bahasa Indonesia menjadi key translation.
- Tambahkan semua terjemahan English pada seluruh file yang diperlukan.
- Rapikan struktur i18n agar mudah dikembangkan.
- Buat helper translation seperti:
  - t('key.name')
  - translate(key, lang)
- Pastikan komponen yang menerima teks dari API/backend juga bisa ditampilkan sesuai bahasa aktif jika datanya mendukung.

FITUR TAMBAHAN YANG HARUS ADA

- Deteksi bahasa browser saat pertama kali buka.
- Dropdown language switcher yang jelas dan modern.
- Icon bendera opsional, tetapi jangan terlalu bergantung pada icon.
- Loading state saat switch bahasa bila diperlukan.
- Fallback jika key tidak ada.
- Dukungan pluralization sederhana bila perlu.
- Format tanggal, mata uang, dan angka mengikuti locale bahasa aktif.
- Accessibility: keyboard navigation, aria-label, dan fokus yang jelas.
- Persistensi bahasa untuk guest dan user login.
- Kompatibel dengan seluruh layout, halaman promosi, role-based panel, kwitansi, dan komponen reusable.

MATA UANG / CURRENCY

- Seluruh tampilan harga harus mendukung lokal bahasa aktif.
- Untuk bahasa Indonesia, gunakan format Rupiah:
  - simbol: Rp
  - format angka: Rp 1.000.000
  - pemisah ribuan dan desimal mengikuti format Indonesia
- Untuk bahasa English, tetap gunakan mata uang asli sistem yaitu Indonesian Rupiah, tetapi tampilkan dalam format English/locale English:
  - kode mata uang: IDR
  - format angka: IDR 1,000,000
  - bila perlu bisa juga menampilkan: Rp 1,000,000
- Jangan hardcode angka atau simbol mata uang di UI.
- Buat helper formatCurrency(amount, lang) atau gunakan Intl.NumberFormat agar nominal otomatis menyesuaikan bahasa aktif.
- Semua harga pada:
  - produk
  - checkout
  - invoice
  - laporan
  - dashboard
  - transaksi
  - refund
  - diskon
  - pajak
  - total pembayaran
  - saldo
  harus ikut format locale.
- Untuk English, label mata uang dan deskripsi harga juga harus berubah, misalnya:
  - Harga -> Price
  - Total Bayar -> Total Payment
  - Bayar Sekarang -> Pay Now
  - Rp 50.000 -> IDR 50,000
- Pastikan format uang konsisten di seluruh role, semua halaman, kwitansi, dan halaman promosi.

OUTPUT YANG DIMINTA

- Berikan implementasi lengkap code multi-language tanpa API.
- Ubah semua teks Indonesia ke sistem bilingual Indonesia-English.
- Sertakan struktur file, helper i18n, contoh dictionary, language switcher, dan contoh penerapan pada beberapa komponen utama.
- Sertakan logika chatbot yang otomatis mengikuti bahasa aktif.
- Sertakan AI chat kasir yang otomatis menyesuaikan bahasa aktif.
- Sertakan format mata uang yang berubah sesuai bahasa aktif.
- Sertakan template dan logika kwitansi/receipt/struk untuk user dan kasir yang ikut berubah bahasa.
- Pastikan hasil akhir siap dipakai di seluruh role, halaman promosi, kwitansi, dan seluruh halaman lain.

JANGAN

- Jangan memakai translation API.
- Jangan hanya mengubah sebagian kecil file.
- Jangan meninggalkan teks hardcoded yang masih tersisa.
- Jangan membuat switcher yang hanya mengubah satu halaman saja.
- Jangan membuat chatbot tetap satu bahasa.
- Jangan hardcode mata uang tanpa helper locale.
- Jangan lupa kwitansi/receipt/struk harus ikut berubah bahasa.

Gunakan pendekatan yang rapi, scalable, dan konsisten untuk seluruh project.
