Tambahkan fitur lengkap pada halaman Reservasi Meja dan halaman Admin > Pengaturan agar sistem reservasi meja memiliki aturan yang jelas, dinamis, dan otomatis.

TUJUAN FITUR:

1. Menampilkan aturan reservasi meja yang wajib dipatuhi pelanggan.
2. Menampilkan modal pop-up aturan saat pelanggan menekan tombol “Ajukan Sekarang”.
3. Mengatur batas toleransi keterlambatan check-in dari halaman admin.
4. Menghitung otomatis status reservasi berdasarkan jam booking dan toleransi yang diatur admin.
5. Jika pelanggan melewati batas toleransi dan tidak check-in, reservasi otomatis menjadi “Hangus” / “Dibatalkan” dan meja dibuka kembali.
6. Menyimpan log persetujuan, status check-in, pembatalan, dan perubahan pengaturan.

FITUR DI HALAMAN ADMIN > PENGATURAN:
Tambahkan pengaturan baru bernama:

- “Batas Toleransi Check-in”

Keterangan fitur:

- Admin dapat menentukan berapa menit toleransi keterlambatan pelanggan setelah jam booking dimulai.
- Nilai ini akan digunakan untuk menentukan batas waktu check-in pelanggan.
- Jika pelanggan belum check-in sampai batas toleransi habis, reservasi otomatis hangus/dibatalkan dan meja dibuka kembali.

Komponen pengaturan admin:

- Input angka untuk menit toleransi
- Contoh default: 15 menit
- Tombol simpan
- Tombol reset ke default
- Validasi input hanya angka bulat
- Minimal 0 menit
- Maksimal misalnya 120 menit atau sesuai kebijakan sistem
- Jika kosong, gunakan nilai default

Tampilkan juga preview aturan pelanggan secara langsung di bawah input admin, misalnya:
“Pelanggan wajib melakukan check-in maksimal {{tolerance_minutes}} menit setelah jam booking dimulai. Jika melebihi batas tersebut dan pelanggan tidak kunjung hadir, maka reservasi dinyatakan hangus, dibatalkan, dan meja akan dibuka kembali untuk pelanggan lain.”

Simpan pengaturan toleransi ke database dan catat riwayat perubahan:

- siapa admin yang mengubah
- kapan diubah
- nilai lama dan nilai baru

FITUR DI HALAMAN RESERVASI PELANGGAN:
Saat pelanggan menekan tombol “Ajukan Sekarang”, jangan langsung submit reservasi. Tampilkan modal pop-up “Aturan Reservasi Meja” terlebih dahulu.

Modal harus:

- muncul di tengah layar
- responsif di desktop dan mobile
- memiliki tombol tutup
- memiliki checkbox persetujuan
- tombol “Lanjut Ajukan” hanya aktif jika checkbox dicentang
- menampilkan aturan dengan jelas, sopan, dan profesional

Judul modal:

- “Aturan Reservasi Meja”

Isi aturan yang wajib ditampilkan:

1. Reservasi hanya berlaku sesuai tanggal, jam, dan meja yang dipilih saat pemesanan.
2. Pelanggan wajib hadir dan melakukan check-in pada jam booking yang telah ditentukan.
3. Pelanggan memiliki toleransi check-in selama {{tolerance_minutes}} menit setelah jam booking dimulai.
4. Jika pelanggan tidak check-in sampai batas toleransi habis, reservasi akan dianggap hangus, dibatalkan, dan meja akan dibuka kembali untuk pelanggan lain.
5. Resto tidak bertanggung jawab atas kehilangan hak reservasi jika pelanggan terlambat datang dan tidak segera check-in.
6. Pelanggan wajib menjaga kebersihan, ketertiban, dan kenyamanan area resto.
7. Pelanggan dilarang merusak, mencoret, mematahkan, membawa pulang, atau menyalahgunakan properti resto dalam bentuk apa pun.
8. Jika terjadi kerusakan, kehilangan, atau penyalahgunaan fasilitas akibat pelanggan atau rombongan, pelanggan wajib mengganti kerugian sesuai penilaian pihak resto.
9. Resto berhak memberikan denda tambahan jika kerusakan menimbulkan biaya perbaikan, kehilangan barang, atau gangguan operasional.
10. Resto tidak bertanggung jawab atas kejadian yang timbul akibat kelalaian pelanggan dalam mematuhi aturan, termasuk keterlambatan check-in.
11. Pelanggan wajib mengikuti arahan staf resto terkait penempatan meja, keamanan, dan kenyamanan bersama.
12. Reservasi dapat dibatalkan secara sepihak jika pelanggan melanggar aturan, membuat keributan, merusak fasilitas, atau mengganggu pengunjung lain.
13. Dengan menekan tombol “Ajukan Sekarang”, pelanggan menyatakan telah membaca, memahami, dan menyetujui seluruh aturan yang berlaku.

Tambahkan teks penegasan di modal:
“Toleransi check-in: {{tolerance_minutes}} menit sejak jam booking dimulai.”

Tambahkan juga kalimat singkat di halaman reservasi:
“Dengan melanjutkan pemesanan, Anda menyetujui seluruh aturan reservasi meja, termasuk kewajiban check-in tepat waktu, batas toleransi keterlambatan, dan tanggung jawab atas kerusakan properti.”

LOGIKA SISTEM YANG HARUS DITERAPKAN:

1. Saat tombol “Ajukan Sekarang” diklik, tampilkan modal aturan.
2. Ambil nilai toleransi check-in terbaru dari database/pengaturan admin.
3. Tampilkan nilai toleransi tersebut secara dinamis di modal aturan pelanggan.
4. Pelanggan hanya bisa melanjutkan reservasi jika checkbox persetujuan dicentang.
5. Setelah pelanggan setuju, simpan status persetujuan sebagai true.
6. Saat reservasi dibuat, sistem menyimpan:
   - waktu booking
   - toleransi check-in
   - deadline check-in
   - status reservasi
   - status meja

RUMUS LOGIKA WAKTU:

- checkInDeadline = jam_booking + tolerance_minutes

STATUS PELANGGAN:

- Jika pelanggan check-in sebelum atau tepat pada checkInDeadline, status menjadi “Checked In” atau “Aktif”.
- Jika pelanggan belum check-in setelah checkInDeadline lewat, status berubah menjadi:
  - “Hangus”
  - atau “Dibatalkan”
  sesuai kebijakan sistem.
- Setelah status hangus/dibatalkan, meja otomatis berubah menjadi “Tersedia”.
- Meja yang sebelumnya dibooking harus dibuka kembali untuk reservasi lain.
- Jika pelanggan datang setelah reservasi hangus, sistem tidak boleh mengaktifkan reservasi lama kecuali ada override manual dari admin.

NOTIFIKASI DAN STATUS:

- Saat jam booking sudah dimulai, tampilkan status “Waktu check-in dimulai”.
- Jika pelanggan belum datang hingga batas toleransi habis, tampilkan pesan:
  “Reservasi hangus karena melebihi batas toleransi check-in.”
  “Meja telah dibuka kembali untuk pelanggan lain.”
- Jika pelanggan check-in tepat waktu, tampilkan status sukses:
  “Pelanggan berhasil check-in.”

VALIDASI DAN KEAMANAN:

- Simpan log semua perubahan status reservasi.
- Simpan log waktu pelanggan klik setuju aturan.
- Simpan log waktu check-in.
- Simpan log pembatalan otomatis karena lewat toleransi.
- Simpan log perubahan pengaturan toleransi oleh admin.
- Jika admin mengubah toleransi, sistem harus tetap konsisten dan mengikuti kebijakan yang ditentukan:
  - apakah mengikuti nilai saat reservasi dibuat
  - atau mengikuti nilai terbaru
  sesuai aturan sistem yang dipilih.

TAMPILAN YANG DIINGINKAN:

- Desain bersih, modern, profesional, dan mudah dipahami.
- Gunakan card pengaturan yang rapi di admin.
- Gunakan modal pop-up yang elegan di pelanggan.
- Gunakan teks yang tegas namun sopan.
- Gunakan daftar aturan yang jelas dan mudah dibaca.
- Gunakan status warna yang berbeda untuk aktif, menunggu check-in, hangus, dan dibatalkan.

NAMA VARIABEL YANG DISARANKAN:

- toleranceMinutes
- checkInDeadline
- reservationStatus
- tableStatus
- isApproved
- isCheckedIn
- adminToleranceSetting

PASTIKAN FITUR INI:

- fleksibel diatur admin
- dinamis di tampilan pelanggan
- otomatis membatalkan reservasi yang lewat waktu
- otomatis membuka kembali meja
- menyimpan riwayat/log
- aman, jelas, dan mudah dikelola
- siap digunakan pada sistem reservasi resto modern

========================
TAMBAHAN FITUR: PRE-ORDER MENU, PEMBAYARAN, DP, KASIR, DAN REFUND
========================

Tambahkan pengembangan fitur lengkap pada halaman “Ajukan Reservasi Meja” sesuai tampilan yang sudah ada, dengan fokus pada reservasi meja, pre-order menu, pembayaran tunai/dompetku/non-tunai/DP, pengaturan DP dan charge pembatalan oleh admin, integrasi ke kasir/POS, serta alur refund yang terpisah antara pesanan menu dan reservasi meja.

1. FITUR DI HALAMAN AJUKAN RESERVASI MEJA
Pada halaman “Ajukan Reservasi Meja”, tambahkan fitur agar pelanggan tidak hanya memilih meja, tanggal, waktu, dan jumlah tamu, tetapi juga dapat memilih produk/menu yang ingin dipesan lebih dulu.

Tambahkan section baru dengan judul:

- “Pilih Menu Pesanan”
- “Menu yang Akan Disiapkan”

Fitur menu harus memiliki:

- daftar kategori menu
- pencarian menu
- gambar menu
- nama menu
- harga menu
- stok tersedia
- input jumlah/qty
- catatan khusus per item
- tombol tambah/hapus item
- subtotal otomatis
- total keseluruhan

Pesanan menu yang dipilih pelanggan harus menjadi pre-order yang akan:

- disiapkan 30 menit sebelum waktu booking dimulai
- tampil sebagai pesanan terkait reservasi
- masuk ke kasir/POS setelah reservasi dibuat
- tersimpan sebagai detail order reservasi

Tampilkan info di halaman pelanggan:

- “Menu yang Anda pilih akan disiapkan 30 menit sebelum jam booking dimulai.”
- “Pastikan pesanan sudah sesuai karena pesanan akan diproses bersamaan dengan reservasi.”

1. OPSI PEMBAYARAN PADA RESERVASI
Setelah pelanggan memilih meja dan menu, tambahkan pilihan metode pembayaran:

- Tunai
- DompetKu
- Non Tunai
- Bayar Sebagian / DP

Jika pelanggan memilih DP:

- tampilkan field persentase DP
- pelanggan hanya boleh memilih DP minimal sesuai ketentuan resto
- tampilkan nominal DP otomatis berdasarkan total pesanan
- tampilkan sisa pembayaran yang masih harus dilunasi
- tampilkan ringkasan:
  - total harga
  - DP dibayar
  - sisa pembayaran
  - metode pembayaran akhir

Jika metode yang dipilih adalah:

- Tunai: seluruh tagihan dibayar penuh
- DompetKu: pembayaran mengikuti saldo/metode DompetKu
- Non Tunai: pembayaran via metode cashless yang didukung sistem
- DP: bayar sebagian dulu, sisa dibayar saat di kasir

Tambahkan label status pembayaran:

- Menunggu Pembayaran
- DP Dibayar
- Lunas
- Gagal Bayar
- Menunggu Konfirmasi

1. FITUR ADMIN > MANAJEMEN MEJA / PENGATURAN
Tambahkan pengaturan baru di halaman admin, minimal pada:

- Manajemen Meja
- Pengaturan Reservasi
- Pengaturan Pembayaran
- Pengaturan Refund

A. Pengaturan Minimal DP
Tambahkan field:

- “Minimal DP (%)”

Fungsi:

- Resto bisa menentukan besaran minimal DP dalam persen
- Contoh default: 30%
- Nilai ini wajib ditampilkan di halaman reservasi pelanggan
- Pelanggan tidak boleh memilih DP di bawah batas minimal
- Jika pelanggan memilih DP di bawah minimal, tampilkan peringatan:
  “Minimal DP yang berlaku saat ini adalah {{minimal_dp}}% dari total harga.”

B. Pengaturan Charge Pembatalan Sepihak
Tambahkan field:

- “Charge Pembatalan Sepihak (%)”

Fungsi:

- Resto dapat mengatur persentase potongan/biaya pembatalan jika pelanggan membatalkan sepihak
- Contoh default: 20%
- Nilai ini harus ikut muncul di aturan reservasi pelanggan
- Charge dihitung dari total pesanan yang sudah disiapkan

C. Pengaturan Toleransi Reservasi
Tetap pertahankan pengaturan toleransi check-in yang sudah ada, dan tampilkan di aturan.

D. Pengaturan Status Refund
Tambahkan opsi kebijakan:

- Refund otomatis
- Refund manual menunggu resto
- Refund otomatis untuk reservasi menunggu
- Refund sesuai verifikasi resto

1. ATURAN YANG WAJIB DITAMPILKAN KE PELANGGAN
Di halaman reservasi dan modal aturan sebelum ajukan, tampilkan aturan lengkap berikut dengan nilai yang dinamis mengikuti pengaturan resto:

Judul:

- “Aturan Reservasi, Pesanan Menu, Pembayaran, dan Pembatalan”

Isi aturan:

1. Reservasi meja hanya berlaku sesuai tanggal, jam, dan meja yang dipilih.
2. Pelanggan wajib melakukan check-in sesuai jam booking dan batas toleransi yang ditetapkan oleh resto.
3. Pesanan menu yang dipilih akan disiapkan 30 menit sebelum waktu booking dimulai.
4. Pelanggan wajib memastikan pesanan yang dipilih sudah benar sebelum mengajukan reservasi.
5. Jika memilih pembayaran DP, pelanggan wajib membayar minimal {{minimal_dp}}% dari total harga sesuai ketentuan resto.
6. Jika DP belum memenuhi batas minimal, sistem tidak boleh melanjutkan pemesanan.
7. Sisa pembayaran wajib dilunasi pada kasir saat check-in atau saat transaksi lanjutan sesuai aturan resto.
8. Jika pelanggan membatalkan sepihak setelah pesanan disiapkan, maka akan dikenakan charge pembatalan sebesar {{charge_cancel}}% dari total harga pesanan yang sudah disiapkan.
9. Nominal refund akan dihitung setelah dipotong charge pembatalan sesuai ketentuan resto.
10. Jika reservasi belum dikonfirmasi oleh resto lalu pelanggan membatalkan, maka pembatalan dapat diproses otomatis dan refund dikembalikan penuh sesuai status pembayaran dan kebijakan sistem.
11. Jika reservasi sudah dikonfirmasi, pembatalan wajib mengikuti proses verifikasi dan pengisian data pembatalan/refund dari resto.
12. Resto tidak bertanggung jawab atas keterlambatan check-in atau pembatalan yang dilakukan setelah pesanan diproses sesuai jadwal.
13. Pelanggan wajib menjaga properti resto. Kerusakan akan dikenakan ganti rugi sesuai nilai kerusakan.
14. Dengan menekan “Ajukan Sekarang”, pelanggan dianggap telah membaca, memahami, dan menyetujui seluruh aturan.

Tambahkan kalimat penegasan:

- “Minimal DP saat ini adalah {{minimal_dp}}% dari total pesanan.”
- “Jika pembatalan dilakukan sepihak setelah pesanan disiapkan, akan dikenakan charge sebesar {{charge_cancel}}%.”
- “Pesanan Anda akan mulai disiapkan 30 menit sebelum jam booking dimulai.”

1. LOGIKA RESERVASI DAN PEMBAYARAN
Saat pelanggan klik “Ajukan Sekarang”:
1. Tampilkan modal aturan.
1. Jika pelanggan menyetujui aturan, lanjutkan proses.
1. Validasi:
   - meja dipilih
   - tanggal valid
   - jam valid
   - jumlah tamu valid
   - menu pesanan ada atau boleh kosong jika sistem mengizinkan
   - metode pembayaran valid
   - DP memenuhi minimal persentase resto
1. Simpan data reservasi, item menu, metode pembayaran, nominal DP, sisa pembayaran, status persetujuan aturan, dan waktu pengajuan.
1. Pesanan menu disimpan sebagai order terkait reservasi.

Hitung otomatis:

- total_pesanan = total menu + biaya tambahan jika ada
- dp_amount = total_pesanan x minimal_dp / 100 atau persen DP pilihan pelanggan yang tidak boleh di bawah batas minimal resto
- remaining_amount = total_pesanan - dp_amount

Status yang harus tersedia:

- Menunggu Konfirmasi
- Dikonfirmasi
- Menunggu Pembayaran
- DP Dibayar
- Lunas
- Menunggu Check-in
- Check-in Berhasil
- Hangus
- Dibatalkan
- Refund Diproses
- Refund Selesai
- Refund Ditolak

1. FITUR KASIR / POS
Di halaman kasir, tampilkan reservasi pelanggan beserta:

- nama pelanggan
- nomor telepon
- tanggal reservasi
- jam booking
- meja yang dipilih
- daftar menu pesanan
- total tagihan
- status pembayaran
- status reservasi
- status DP
- sisa pembayaran
- status konfirmasi reservasi

Kasir harus bisa melihat:

- menu apa saja yang dipesan pelanggan
- apakah pesanan sudah disiapkan atau belum
- apakah pembayaran tunai, DP, non tunai, atau DompetKu
- berapa DP yang sudah dibayar
- berapa sisa yang masih harus dibayar

Tambahkan tombol:

- “Bayar Sekarang”

Logika tombol “Bayar Sekarang”:

1. Saat diklik, sistem membuka transaksi di POS kasir yang terhubung ke reservasi tersebut.
2. Data pesanan menu otomatis masuk ke kasir.
3. Jika metode pembayaran tunai, kasir memproses pembayaran penuh.
4. Jika metode pembayaran DP, kasir hanya menagih sisa pembayaran.
5. Kasir melihat keterangan:
   - total harga
   - DP sudah dibayar berapa persen
   - sisa pembayaran berapa
   - status pembayaran terakhir

Tambahkan notifikasi di kasir:

- “Pesanan ini merupakan bagian dari reservasi.”
- “Menu akan disiapkan 30 menit sebelum waktu booking dimulai.”
- “Pembayaran DP sudah diterima sebesar {{dp_percent}}%.”
- “Sisa pembayaran: Rp{{remaining_amount}}”

1. FITUR PEMBATALAN RESERVASI DAN REFUND
Buat fitur pembatalan reservasi yang lengkap.

A. Jika reservasi belum dikonfirmasi

- Pembatalan dapat diproses otomatis
- Refund dikembalikan full jika pembayaran sudah masuk
- Sistem langsung membuat status:
  - Dibatalkan
  - Refund Diproses
  - Refund Selesai

B. Jika reservasi sudah dikonfirmasi

- Saat pelanggan klik batal, tampilkan modal pop up pembatalan
- Modal harus menampilkan aturan pembatalan:
  - jika pesanan sudah disiapkan, charge pembatalan dikenakan {{charge_cancel}}%
  - nominal refund setelah dipotong charge
  - pelanggan harus mengisi data pembatalan
  - pelanggan harus memilih metode refund
  - wajib unggah bukti jika diminta
  - refund bisa melalui transfer bank atau DompetKu
  - jika DompetKu belum aktif, tampilkan peringatan dan nonaktifkan metode tersebut
- Pelanggan diminta menunggu konfirmasi resto jika pembatalan tidak otomatis

C. Pengajuan refund
Saat pelanggan mengajukan pembatalan, tampilkan form isi data:

- nama pelanggan
- nomor reservasi
- alasan pembatalan
- rekening bank / nomor dompet tujuan
- metode pengembalian dana:
  - Transfer
  - DompetKu
- unggah gambar bukti
- catatan tambahan

D. Pisahkan jenis refund di admin menjadi:

- Refund Reservasi
- Refund Pesanan Menu
- Refund Gabungan

E. Hitung refund:

- jika belum dikonfirmasi dan belum diproses: refund full
- jika sudah disiapkan: refund = total dibayar - charge pembatalan
- jika sudah DP: refund dihitung dari nominal yang sudah dibayar setelah dipotong charge jika kebijakan mengharuskan
- jika pembatalan dilakukan sebelum batas proses pesanan dan belum disiapkan, refund penuh dapat diberikan

F. Status refund admin:

- Menunggu Review
- Menunggu Bukti
- Disetujui
- Ditolak
- Diproses
- Selesai
- Gagal Transfer
- Gagal DompetKu

1. ALUR OTOMATIS DAN LOGIKA STATUS
Sistem harus memiliki logika otomatis berikut:

A. Saat pelanggan mengajukan reservasi

- simpan order menu
- simpan status pembayaran
- simpan status reservasi
- simpan aturan yang disetujui
- simpan persen DP yang dipilih
- simpan minimal DP dari resto
- simpan charge pembatalan dari resto

B. Saat reservasi mendekati waktu booking

- sistem menghitung 30 menit sebelum booking
- pesanan menu masuk status “Siap Disiapkan”
- staf dapur/kasir dapat melihat daftar pesanan yang harus mulai diproses

C. Saat pelanggan check-in

- jika tepat waktu, status menjadi aktif
- jika melewati toleransi, status hangus dan meja dibuka kembali

D. Jika pelanggan membatalkan

- jika belum dikonfirmasi: proses auto refund full
- jika sudah dikonfirmasi: tampilkan modal pembatalan dan hitung charge
- refund dikirim ke metode yang dipilih setelah disetujui resto
- jika DompetKu belum aktif, beri peringatan

E. Saat resto menyetujui refund

- dana diproses ke metode pengembalian yang dipilih pelanggan
- jika refund otomatis, sistem langsung mengeksekusi nominal sesuai status
- jika refund manual, resto wajib verifikasi bukti dan nominal

1. DATABASE / DATA YANG PERLU DISIMPAN
Simpan minimal data berikut:

- reservation_id
- customer_name
- phone
- date
- time
- table_ids
- guest_count
- menu_items
- menu_total
- payment_method
- payment_status
- dp_percent
- dp_amount
- remaining_amount
- tolerance_minutes
- check_in_deadline
- cancellation_charge_percent
- reservation_status
- approval_status
- refund_status
- refund_method
- refund_amount
- refund_proof
- admin_notes
- created_at
- updated_at

Buat relasi yang jelas antara:

- reservasi
- menu order
- pembayaran
- refund
- konfirmasi resto
- kasir/POS

1. TAMPILAN UI / UX
Gunakan tampilan:

- modern
- rapi
- mudah dipahami
- responsif di mobile dan desktop
- warna status jelas
- modal aturan tegas namun sopan
- tombol aksi yang jelas

Tambahkan komponen:

- badge status pembayaran
- badge status reservasi
- ringkasan total harga
- ringkasan DP dan sisa pembayaran
- ringkasan menu pesanan
- ringkasan refund
- notifikasi peringatan jika DP kurang
- notifikasi peringatan jika DompetKu belum aktif
- modal pembatalan yang wajib diisi data lengkap

1. VALIDASI PENTING
Pastikan:

- pelanggan tidak bisa lanjut jika DP kurang dari batas minimal resto
- pelanggan tidak bisa membatalkan tanpa mengisi data yang diwajibkan
- pembatalan yang memerlukan verifikasi harus masuk ke resto terlebih dahulu
- refund tidak bisa diproses jika metode refund tidak valid
- jika DompetKu belum aktif, tampilkan peringatan dan arahkan ke transfer
- pesanan menu yang dibatalkan mengikuti status reservasi
- kasir selalu dapat melihat keterkaitan reservasi, menu, dan pembayaran
- semua aksi penting tercatat dalam log

1. KALIMAT PENEGASAN DI HALAMAN
Tambahkan kalimat yang sopan dan jelas:
“Dengan melanjutkan pemesanan, Anda menyetujui aturan reservasi, pembayaran, DP minimal, charge pembatalan, dan tanggung jawab atas pesanan yang telah disiapkan.”

Tambahkan juga:
“Jika Anda memilih DP, maka minimal DP yang wajib dibayarkan adalah {{minimal_dp}}% dari total pesanan.”
“Pesanan akan disiapkan 30 menit sebelum jadwal booking dimulai.”
“Pembatalan sepihak dapat dikenakan charge sebesar {{charge_cancel}}% dari total pesanan yang sudah diproses.”

Buat seluruh fitur ini lengkap, terstruktur, aman, dan terintegrasi antara halaman Reservasi, Admin, Kasir/POS, dan Refund.
