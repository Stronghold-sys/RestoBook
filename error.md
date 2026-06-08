TAMBAHAN FITUR AUTENTIKASI AKUN GOOGLE DAN PASSWORD:

* Jangan mengubah atau menghapus alur login yang sudah ada.
* Cukup tambahkan fitur baru agar akun yang login menggunakan Google bisa membuat password sendiri di halaman password tanpa memasukkan password lama pada saat pertama kali.
* Fitur ini hanya berlaku untuk pembuatan password pertama kali pada akun yang belum memiliki password lokal.

KETENTUAN TAMBAHAN:

1. Jika pengguna login menggunakan akun Google:

   * sistem harus mengenali akun tersebut sebagai akun yang sudah terhubung Google
   * pengguna dapat membuka halaman password untuk membuat password pertama kali
   * pada pembuatan password pertama kali, password lama tidak perlu dimasukkan

2. Setelah password pertama berhasil dibuat:

   * pengguna bisa login menggunakan email + password yang baru dibuat
   * pengguna tetap bisa login langsung menggunakan Google dengan email yang sama
   * kedua metode login harus mengarah ke akun yang sama, bukan akun baru terpisah

3. Jika pengguna ingin mengganti password setelah password lokal sudah ada:

   * sistem wajib meminta password lama terlebih dahulu
   * setelah password lama valid, barulah password baru bisa disimpan

4. Pastikan:

   * tidak ada duplikasi akun untuk email yang sama
   * login Google dan login email/password tetap sinkron ke akun yang sama
   * semua perubahan tercatat di log aktivitas
   * validasi dilakukan di backend dan frontend

5. Status akun yang perlu didukung:

   * google_only
   * password_created
   * google_linked
   * password_login_enabled
   * password_updated

6. Tambahkan pesan UI seperti:

   * “Buat password untuk akun Anda agar bisa login menggunakan email dan password.”
   * “Karena ini password pertama, Anda tidak perlu memasukkan password lama.”
   * “Untuk mengganti password berikutnya, Anda wajib memasukkan password lama.”
   * “Akun Google dan akun email ini sudah terhubung ke akun yang sama.”

7. Jika perlu, tambahkan struktur database untuk:

   * provider login
   * password_hash
   * password_created_at
   * last_password_change_at
   * google_account_linked
   * login_method_history
   * audit log

8. Fitur ini harus benar-benar menambah, bukan mengganti, sistem yang sudah ada.
