Kamu adalah senior fullstack developer. Tambahkan fitur manajemen suspen dan ban pengguna
pada menu "Pelanggan" di panel admin. Implementasikan semua fitur berikut secara lengkap
dengan logika realtime menggunakan [sebutkan stack: Firebase / Supabase / Socket.io / dll].

=======================================================================
FITUR 1: SUSPEN SEMENTARA (TEMPORARY SUSPEND)
=======================================================================

- Admin dapat mensuspen akun pengguna dengan durasi kustom:
  Format waktu: tahun / bulan / minggu / hari / jam / menit / detik
  (bisa kombinasi, contoh: 2 hari 3 jam 30 menit)
- Admin wajib mengisi:
  □ Alasan suspen (textarea, wajib diisi)
  □ Pesan notifikasi untuk pengguna buatkan kata2nya dan (bisa diedit)
  □ Durasi suspen (input per satuan waktu)
- Simpan ke database:
  {
    status: "suspended",
    suspend_reason: "...",
    suspend_message: "...",
    suspended_at: timestamp,
    suspend_until: timestamp, // hasil kalkulasi durasi
    suspend_type: "temporary"
  }

=======================================================================
FITUR 2: BAN PERMANEN (PERMANENT BAN)
=======================================================================

- Admin dapat melakukan ban permanen pada akun pengguna
- Admin wajib mengisi:
  □ Alasan ban (textarea, wajib diisi)
  □ Pesan notifikasi untuk pengguna buatkan kata2nya
- TIDAK ada input durasi waktu (sembunyikan/disabled field waktu)
- Simpan ke database:
  {
    status: "banned",
    ban_reason: "...",
    ban_message: "...",
    banned_at: timestamp,
    suspend_until: null, // null = permanen
    suspend_type: "permanent"
  }

=======================================================================
FITUR 3: NOTIFIKASI DI HALAMAN LOGIN
=======================================================================

Saat pengguna mencoba login, cek status akun di database:

A. Jika status = "suspended" (sementara):
   Tampilkan modal/alert

- Format tampil hanya satuan yang relevan
     (jika 0 tahun, sembunyikan "tahun", dst)
- Jika waktu habis → otomatis ubah status = "active" di DB
     dan perbolehkan login tanpa perlu tindakan admin

B. Jika status = "banned" (permanen):
   Tampilkan modal/alert

- TIDAK ada hitung mundur
- TIDAK bisa login sama sekali

C. Jika status = "active":
   Tampilkan notifikasi hijau:

- Notifikasi ini muncul SEKALI saja setelah akun dibuka kembali
- Gunakan flag: just_restored: true di DB, reset setelah ditampilkan

=======================================================================
FITUR 4: AUTO LOGOUT REALTIME (SUDAH LOGIN)
=======================================================================

- Gunakan realtime listener (onSnapshot / websocket / SSE) pada
  dokumen/row user yang sedang login
- Jika status berubah menjadi "suspended" atau "banned" saat user
  sedang aktif:
  1. Langsung invalidasi sesi / token user
  2. Redirect ke halaman login
  3. Tampilkan notifikasi sesuai status (sama seperti Fitur 3)
- Realtime listener dipasang saat user berhasil login dan dilepas
  saat logout

=======================================================================
FITUR 5: BUKA KEMBALI AKUN (UNBAN / UNSUSPEND)
=======================================================================

- Di panel admin, pada tabel pelanggan, tambahkan tombol:
  "Buka Kembali Akun" (hanya muncul jika status ≠ active)
- Admin dapat menambahkan pesan pemulihan (opsional)
- Saat dibuka:
  {
    status: "active",
    restored_at: timestamp,
    restored_message: "...", // pesan dari admin
    just_restored: true      // flag untuk notifikasi sekali tampil
  }
- Hapus/reset semua field suspen/ban

=======================================================================
FITUR 6: TAMPILAN DI PANEL ADMIN (TABEL PELANGGAN)
=======================================================================

Kolom tambahan di tabel:
│ Nama │ Email │ Status │ Tipe Suspen │ Berakhir │ Aksi │

- Kolom STATUS tampilkan badge warna:
   Aktif |  Suspen Sementara |  Ban Permanen

- Kolom BERAKHIR:
  Suspen sementara → tampilkan sisa waktu (hitung mundur realtime)
  Ban permanen     → tampilkan "Permanen"
  Aktif            → tampilkan "-"

- Kolom AKSI berisi tombol:
  [Suspen] [Ban Permanen] [Buka Akun] [Lihat Detail] [Riwayat]

=======================================================================
FITUR 7: RIWAYAT SUSPEN (HISTORY LOG)
=======================================================================

Simpan setiap aksi ke koleksi/tabel `suspend_logs`:
{
  user_id: "...",
  action: "suspended | banned | restored | auto_restored",
  reason: "...",
  message: "...",
  duration: "...",        // misal "2 hari 3 jam"
  suspend_until: timestamp,
  acted_by: "admin_id",  // siapa admin yang melakukan
  acted_at: timestamp
}

Di detail pelanggan, tampilkan riwayat ini dalam timeline/tabel.

=======================================================================
FITUR 8: NOTIFIKASI HITUNG MUNDUR REALTIME (DETAIL)
=======================================================================

Fungsi kalkulasi sisa waktu:

function getSisaWaktu(suspend_until) {
  const selisih = suspend_until - Date.now();
  if (selisih <= 0) return null; // sudah habis
  
  const detik  = Math.floor(selisih / 1000) % 60;
  const menit  = Math.floor(selisih / 60000) % 60;
  const jam    = Math.floor(selisih / 3600000) % 24;
  const hari   = Math.floor(selisih / 86400000) % 7;
  const minggu = Math.floor(selisih / 604800000) % 4;
  const bulan  = Math.floor(selisih / 2592000000) % 12;
  const tahun  = Math.floor(selisih / 31536000000);
  
  // Tampilkan hanya satuan yang > 0
  return { tahun, bulan, minggu, hari, jam, menit, detik };
}

- Update setiap detik dengan setInterval
- Saat countdown = 0: otomatis update DB status → "active"
  dan tampilkan notifikasi pemulihan otomatis

=======================================================================
FITUR 9: FITUR TAMBAHAN
=======================================================================

A. SUSPEN MASSAL (BULK SUSPEND):

- Checkbox di tabel untuk pilih banyak user
- Aksi massal: suspend / ban / buka akun sekaligus
- Konfirmasi modal sebelum eksekusi

B. JADWAL SUSPEN OTOMATIS (SCHEDULED SUSPEND):

- Admin bisa set: "Suspen mulai tanggal X pukul Y"
- Sistem otomatis eksekusi saat waktu tiba
- Simpan: scheduled_suspend_at di DB

C. PERINGATAN SEBELUM SUSPEN (WARNING SYSTEM):

- Sebelum suspen, admin bisa kirim peringatan ke user
- User terima notifikasi in-app: "Akun Anda akan disuspen dalam X jam"
- Admin bisa set: 1 peringatan / 3 peringatan sebelum suspen otomatis

D. FILTER & PENCARIAN DI TABEL ADMIN:

- Filter by: status (aktif/suspen/ban), tanggal, admin yang aksi
- Search by: nama, email, alasan suspen

E. STATISTIK PANEL:

- Total user aktif | Total disuspen | Total dibanned
- Grafik suspen per bulan

F. NOTIFIKASI EMAIL/SMS OTOMATIS:

- Kirim email ke user saat akun disuspen/dibanned/dibuka
- Template email bisa dikustom admin

G. APPEAL SYSTEM (BANDING):

- User yang disuspen/banned bisa kirim banding lewat form
- Admin terima notifikasi banding baru di panel
- Admin bisa: Setujui (buka akun) / Tolak (tetap suspen)

=======================================================================
CATATAN IMPLEMENTASI
=======================================================================

- Gunakan  Supabase Realtime
  untuk semua fitur realtime
- Semua aksi admin dicatat di audit log
- Validasi semua input di sisi server
- Gunakan middleware/guard untuk cek status suspen di setiap request API
- JWT/session harus diinvalidasi saat suspen realtime
- Pastikan race condition ditangani (misal: suspen habis tepat saat login)
- Hitung mundur di client hanya untuk UI; validasi final selalu di server

Buat semua kode dengan struktur yang rapi, berikan komentar pada
bagian logika penting, dan pastikan semua edge case tertangani.
