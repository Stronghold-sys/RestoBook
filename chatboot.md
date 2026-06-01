Buatkan sistem keamanan menyeluruh untuk server dan website yang berfokus pada perlindungan dari DDoS, brute force, bot abuse, injeksi, scraping berlebihan, eksploitasi celah umum, dan gangguan layanan lainnya, sekaligus menyiapkan antisipasi error agar server tetap stabil, aman, dan mudah dipulihkan.

Konteks:

* Platform: server web/aplikasi produksi.
* Tujuan utama: meningkatkan keamanan, ketahanan, dan ketersediaan layanan.
* Prioritas: preventif, detektif, responsif, dan pemulihan.
* Solusi harus siap dipakai di lingkungan production.
* Jika ada trade-off, utamakan keamanan, stabilitas, dan maintainability.

Tugas yang harus dibuat:

1. Analisis risiko dan titik serang utama

   * Identifikasi ancaman: DDoS layer 3/4/7, brute force login, credential stuffing, bot spam, SQL injection, XSS, CSRF, SSRF, RCE, path traversal, file upload abuse, API abuse, header spoofing, session hijacking, dan request flooding.
   * Petakan bagian yang paling rentan: login, register, reset password, API publik, upload file, endpoint pencarian, webhook, admin panel, dan halaman yang berat.
   * Jelaskan kemungkinan error server yang sering muncul saat trafik tinggi: timeout, 5xx, deadlock, memory leak, CPU spike, disk penuh, database overload, dan connection exhaustion.

2. Perlindungan jaringan dan traffic

   * Terapkan proteksi DDoS berlapis.
   * Gunakan CDN dan WAF.
   * Aktifkan rate limiting per IP, per user, per token, dan per endpoint.
   * Terapkan request throttling, burst control, dan connection limiting.
   * Blokir trafik anomali, user agent mencurigakan, ASN/proxy tertentu jika diperlukan, dan pola bot.
   * Tambahkan cache untuk konten statis dan endpoint yang aman untuk menurunkan beban.
   * Gunakan load balancer, health check, dan failover otomatis.
   * Buat aturan khusus untuk endpoint sensitif seperti login, OTP, reset password, dan API publik.

3. Proteksi aplikasi web

   * Wajib validasi input di client dan server.
   * Sanitasi data dan escape output.
   * Gunakan parameterized query/ORM yang aman.
   * Terapkan CSRF token pada form sensitif.
   * Tambahkan Content Security Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, dan HSTS.
   * Amankan cookie dengan HttpOnly, Secure, dan SameSite.
   * Batasi sesi login: session timeout, refresh token rotation, logout semua perangkat, deteksi login anomali.
   * Lindungi upload file dengan whitelist ekstensi, validasi MIME type, ukuran maksimal, scanning malware, dan penyimpanan terisolasi.
   * Tambahkan proteksi terhadap enumeration akun, password guessing, dan OTP abuse.
   * Sembunyikan detail error sensitif dari user, tetapi simpan error lengkap di log internal.

4. Proteksi autentikasi dan akses

   * Tambahkan MFA/2FA untuk admin dan akun penting.
   * Terapkan account lockout atau progressive delay yang aman terhadap brute force.
   * Gunakan captcha adaptif hanya saat diperlukan, tanpa merusak UX normal.
   * Batasi percobaan login, reset password, dan verifikasi OTP.
   * Terapkan role-based access control yang ketat.
   * Pisahkan hak akses user, moderator, admin, dan superadmin.
   * Tambahkan audit log untuk aktivitas sensitif: login, perubahan password, perubahan role, delete data, ekspor data, dan perubahan konfigurasi.

5. Keamanan server dan infrastruktur

   * Konfigurasi firewall yang ketat.
   * Tutup port yang tidak diperlukan.
   * Nonaktifkan service yang tidak dipakai.
   * Gunakan SSH hardening: key-based auth, nonaktifkan login root, ubah port bila perlu, dan batasi IP admin.
   * Terapkan patch management untuk OS, runtime, framework, database, dan dependency.
   * Jalankan service dengan user non-root.
   * Batasi resource per service agar satu proses tidak menjatuhkan seluruh server.
   * Atur limits untuk CPU, RAM, file descriptor, worker, dan connection pool.
   * Pisahkan environment development, staging, dan production.
   * Amankan rahasia: API key, token, database password, dan private key dengan secret manager atau environment yang aman.

6. Monitoring, logging, dan deteksi dini

   * Buat monitoring untuk CPU, RAM, disk, network, response time, error rate, throughput, queue length, dan database health.
   * Tambahkan alert real-time via email/telegram/slack jika terjadi lonjakan trafik, error 5xx, timeout, brute force, atau anomali login.
   * Simpan log terstruktur dengan timestamp, request ID, user ID, IP, endpoint, status code, latency, dan error message yang aman.
   * Terapkan log rotation dan log retention.
   * Buat dashboard observability yang mudah dibaca.
   * Tambahkan deteksi anomali untuk trafik mendadak, pola request berulang, dan penyalahgunaan endpoint.

7. Ketahanan aplikasi dan pencegahan error

   * Terapkan timeout yang realistis pada request, database, dan external API.
   * Gunakan retry dengan exponential backoff untuk request tertentu.
   * Terapkan circuit breaker pada integrasi eksternal.
   * Pastikan ada fallback logic bila service eksternal gagal.
   * Tambahkan queue/job async untuk proses berat.
   * Hindari blocking di request utama.
   * Optimalkan query database, indeks, pagination, dan cache.
   * Siapkan mekanisme graceful degradation saat server overload.
   * Tambahkan halaman maintenance yang rapi saat deployment atau insiden.
   * Pastikan aplikasi tidak crash walau sebagian layanan down.

8. Backup, recovery, dan disaster recovery

   * Buat backup otomatis untuk database, file penting, dan konfigurasi.
   * Terapkan backup harian, snapshot berkala, dan verifikasi restore.
   * Simpan backup di lokasi terpisah dan aman.
   * Buat rencana pemulihan jika server terkena serangan, korupsi data, atau kegagalan sistem.
   * Tambahkan prosedur rollback deployment.
   * Siapkan dokumentasi restore step-by-step.

9. DevSecOps dan deployment aman

   * Gunakan pipeline CI/CD yang aman.
   * Lakukan dependency scanning, secret scanning, SAST, dan container scanning bila relevan.
   * Gunakan environment variable rahasia, bukan hardcode.
   * Terapkan code review untuk perubahan sensitif.
   * Deploy dengan strategi aman: blue-green, canary, atau rolling update.
   * Tambahkan health check sebelum traffic penuh dialihkan.
   * Buat rollback otomatis jika metrik memburuk.

10. Dokumentasi dan SOP insiden

* Buat SOP saat terjadi DDoS, login attack, database overload, kebocoran token, atau server error.
* Sertakan langkah triase cepat, mitigasi, eskalasi, dan pemulihan.
* Buat daftar kontak darurat.
* Buat checklist hardening untuk server baru.
* Buat checklist audit keamanan berkala.

1. Deliverables yang harus dihasilkan

* Rencana arsitektur keamanan.
* Daftar ancaman dan mitigasi.
* Konfigurasi contoh untuk firewall, rate limit, header keamanan, dan logging.
* Rekomendasi teknis untuk aplikasi, server, dan database.
* Checklist keamanan produksi.
* SOP penanganan insiden.
* Rekomendasi monitoring dan alert.
* Rencana backup dan recovery.
* Contoh implementasi kode jika dibutuhkan.
* Evaluasi celah yang masih tersisa dan saran lanjutan.

1. Kriteria hasil akhir

* Solusi harus praktis, lengkap, dan siap diimplementasikan.
* Jelaskan mana yang wajib, mana yang opsional, dan mana yang bergantung pada skala trafik.
* Gunakan bahasa Indonesia yang jelas.
* Berikan hasil secara sistematis, rapi, dan teknis.
* Jangan hanya memberi teori; sertakan langkah konkret dan contoh konfigurasi bila memungkinkan.

Catatan tambahan:

* Fokus pada pencegahan, deteksi, dan pemulihan.
* Jangan mengorbankan keamanan demi kemudahan.
* Jika ada bagian yang berpotensi membuat sistem justru lebih rentan, jelaskan risikonya dan berikan alternatif yang lebih aman.
