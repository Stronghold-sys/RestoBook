import { create } from 'zustand';

export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface TutorialStatus {
  tour_completed: boolean;
  first_login: boolean;
  tour_version: string;
  last_tour_step: number;
  skipped_tour: boolean;
  tour_reset_at: string | null;
  role: string;
  completed_count: number;
  skipped_count: number;
  retried_count: number;
}

interface TutorialStore {
  isTutorialActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  status: TutorialStatus | null;
  userId: string | null;
  initTutorialStatus: (userId: string, role: string) => void;
  startTutorial: (role: string) => void;
  stopTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
}

const CUSTOMER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang di RestoBook',
    description: 'Kami akan memandu Anda mengenal semua fitur penting agar Anda lebih mudah memesan makanan, membayar, dan melihat detail reservasi meja.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Home"]',
    title: 'Menu: Home',
    description: 'Halaman utama aktivitas Anda. Di sini Anda bisa melihat ringkasan pesanan, notifikasi penting, rekomendasi menu terlaris, dan promo terbaru.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu"]',
    title: 'Menu: Menu Makanan',
    description: 'Klik menu ini untuk menelusuri seluruh daftar hidangan lezat restoran kami. Cari makanan atau minuman berdasarkan kategori, lihat deskripsi rasa, dan tambahkan ke keranjang.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Keranjang"]',
    title: 'Menu: Keranjang',
    description: 'Semua makanan yang Anda pilih akan tersimpan di sini. Anda bisa memeriksa kembali pilihan Anda, mengubah jumlah porsi, serta memilih metode penyajian sebelum melakukan checkout.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Dompetku"]',
    title: 'Menu: Dompetku',
    description: 'Dompet digital Anda di RestoBook. Gunakan untuk membayar pesanan makanan dengan cepat dan aman secara cashless. Anda juga bisa mengisi saldo (top-up) dan melihat riwayat mutasi saldo di sini.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Voucher Saya"]',
    title: 'Menu: Voucher Saya',
    description: 'Koleksi voucher diskon dan promo belanja yang Anda miliki. Gunakan voucher ini saat checkout pembayaran untuk mendapatkan potongan harga spesial.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Tukar Point"]',
    title: 'Menu: Tukar Point',
    description: 'Tukarkan poin reward yang Anda kumpulkan dari setiap transaksi belanja dengan hadiah menarik, menu gratis, atau voucher diskon eksklusif.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Saya"]',
    title: 'Menu: Pesanan Saya',
    description: 'Lacak status pengerjaan pesanan Anda secara real-time — mulai dari konfirmasi kasir, sedang dimasak di dapur, pesanan siap disajikan, hingga riwayat transaksi selesai.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Favorit"]',
    title: 'Menu: Favorit',
    description: 'Simpan makanan dan minuman favorit Anda di sini agar mudah ditemukan dan dipesan kembali di kemudian hari tanpa perlu mencari dari awal.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reservasi"]',
    title: 'Menu: Reservasi',
    description: 'Kelola reservasi meja Anda terlebih dahulu untuk menghindari antrean. Pilih nomor meja, atur tanggal dan jam kedatangan, serta tunjukkan kode QR reservasi saat tiba di restoran.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pengaduan & Bantuan"]',
    title: 'Menu: Pengaduan & Bantuan',
    description: 'Temukan panduan penggunaan, FAQ, atau ajukan pengaduan langsung jika ada kendala sistem atau transaksi. Tim bantuan kami siap melayani Anda melalui menu ini.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Profil"]',
    title: 'Menu: Profil',
    description: 'Lihat dan ubah data diri Anda: nama lengkap, email, nomor HP, foto profil, serta kelola pengaturan keamanan kata sandi akun Anda.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="header-notifications"]',
    title: 'Pusat Notifikasi',
    description: 'Klik ikon lonceng ini untuk melihat pemberitahuan instan mengenai konfirmasi pesanan, promo khusus, status verifikasi akun, dan informasi terbaru dari restoran.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="logout-button"]',
    title: 'Keluar Akun',
    description: 'Gunakan tombol ini untuk keluar dari akun Anda secara aman setelah selesai menggunakan aplikasi demi menjaga kerahasiaan data pribadi Anda.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Tutorial Selesai!',
    description: 'Selamat! Anda sudah memahami seluruh fitur utama RestoBook. Selamat menikmati pengalaman memesan makanan yang mudah, cepat, dan menyenangkan!',
    position: 'bottom'
  }
];

const ADMIN_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang, Admin!',
    description: 'Selamat datang di Panel Admin RestoBook. Kami akan memandu Anda mengenal seluruh fitur penting untuk mengelola menu, pesanan, karyawan, dan operasional restoran.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Dashboard"]',
    title: 'Menu: Dashboard',
    description: 'Pantau performa operasional restoran hari ini secara real-time — lihat ringkasan laba kotor, jumlah pesanan masuk, meja aktif, dan tren grafik penjualan harian.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu Makanan"]',
    title: 'Menu: Menu Makanan',
    description: 'Tambahkan hidangan baru, ubah harga, unggah foto menu, kelola deskripsi rasa, serta atur ketersediaan stok porsi yang ditampilkan di aplikasi pelanggan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Kategori"]',
    title: 'Menu: Kategori',
    description: 'Kelola klasifikasi menu hidangan (seperti makanan utama, minuman, hidangan penutup). Pengelompokan yang tepat memudahkan pelanggan menelusuri daftar menu.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan"]',
    title: 'Menu: Pesanan',
    description: 'Pantau seluruh pesanan aktif dan riwayat transaksi selesai, perbarui status pengiriman/penyajian pesanan, serta cetak laporan pesanan harian.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Meja"]',
    title: 'Menu: Meja',
    description: 'Atur tata letak meja makan di restoran. Anda dapat menambahkan nomor meja baru, kapasitas kursi, dan memantau status meja (kosong, terisi, atau direservasi).',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pelanggan"]',
    title: 'Menu: Pelanggan',
    description: 'Kelola dan pantau akun pelanggan terdaftar: tingkat keaktifan, riwayat pesanan, saldo Dompetku, perolehan poin reward, dan status akun.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Karyawan"]',
    title: 'Menu: Karyawan',
    description: 'Manajemen akun staf restoran (Admin, Kasir). Anda bisa mendaftarkan akun staf baru, mengatur hak akses role, serta menangguhkan akun staf yang sudah keluar.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Voucher"]',
    title: 'Menu: Voucher',
    description: 'Buat dan kelola kode promo diskon. Anda dapat menentukan masa berlaku, kuota voucher, syarat minimal pembelian, dan besaran diskon untuk menarik minat beli pelanggan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Absensi"]',
    title: 'Menu: Absensi',
    description: 'Pantau kehadiran seluruh karyawan secara real-time — rekap jam masuk/pulang, keterlambatan, lembur, serta kelola persetujuan izin, sakit, atau cuti staf.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Payroll"]',
    title: 'Menu: Payroll (Penggajian)',
    description: 'Kelola penggajian bulanan karyawan. Sistem otomatis menghitung gaji pokok, tunjangan kehadiran, lembur, dan potongan kasbon sebelum slip gaji diterbitkan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Transaksi"]',
    title: 'Menu: Transaksi',
    description: 'Tinjau rekapitulasi semua arus kas keuangan restoran, rincian transaksi tunai, pembayaran digital, penyesuaian saldo, serta unduh laporan omset berkala.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Resign"]',
    title: 'Menu: Resign & Pemecatan',
    description: 'Kelola proses administrasi karyawan keluar. Catat surat pengunduran diri, cetak surat keterangan kerja (paklaring), dan nonaktifkan akses sistem staf secara permanen.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Refund"]',
    title: 'Menu: Refund',
    description: 'Kelola proses pengembalian dana untuk pesanan yang dibatalkan. Anda dapat meninjau alasan pembatalan, memvalidasi bukti, dan mencairkan dana kembali ke Dompetku pelanggan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Fitur Dompetku"]',
    title: 'Menu: Fitur Dompetku',
    description: 'Halaman audit transaksi Dompetku pelanggan — lakukan penyesuaian saldo manual (top-up/penarikan), kelola status wallet, dan pantau mutasi keuangan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Aktivasi Dompetku"]',
    title: 'Menu: Aktivasi Dompetku',
    description: 'Validasi permintaan pembukaan akun Dompetku baru dari pelanggan. Anda dapat memeriksa kelayakan data sebelum memberikan persetujuan akses.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reviews"]',
    title: 'Menu: Reviews',
    description: 'Tinjau ulasan, rating bintang, serta kritik dan saran yang dikirimkan oleh pelanggan terhadap makanan maupun pelayanan restoran untuk evaluasi kualitas.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reward Point"]',
    title: 'Menu: Reward Point',
    description: 'Kelola program poin loyalitas pelanggan. Atur aturan konversi poin dari total belanja, serta tambahkan pilihan menu atau voucher yang dapat ditukarkan pelanggan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pengaduan & Bantuan"]',
    title: 'Menu: Pengaduan & Bantuan',
    description: 'Pusat bantuan admin untuk merespons tiket keluhan, laporan masalah teknis, atau pertanyaan pelanggan secara langsung demi meningkatkan layanan pasca-jual.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Keamanan Sistem"]',
    title: 'Menu: Keamanan Sistem',
    description: 'Tinjau log keamanan sistem, pantau aktivitas login mencurigakan, atur rate limiter bot, pembatasan alamat IP, dan backup berkala database untuk integritas data.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Settings"]',
    title: 'Menu: Settings',
    description: 'Konfigurasi global restoran: kelola jam operasional buka-tutup, atur tarif pajak pertambahan nilai (PPN), biaya layanan, dan aktifkan mode pemeliharaan (maintenance).',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Profil"]',
    title: 'Menu: Profil',
    description: 'Lihat data diri admin, perbarui foto profil Anda, dan ubah kata sandi login secara berkala untuk menjaga keamanan akun operasional Anda.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="header-notifications"]',
    title: 'Pusat Notifikasi',
    description: 'Ikon lonceng ini menampung notifikasi instan sistem seperti aduan pelanggan baru, notifikasi keamanan, atau pesanan masuk yang membutuhkan perhatian cepat.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="logout-button"]',
    title: 'Keluar Akun',
    description: 'Gunakan tombol ini untuk keluar dari panel admin secara aman setelah menyelesaikan tugas pengelolaan harian.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Tutorial Selesai!',
    description: 'Luar biasa! Anda telah memahami seluruh fitur di Panel Admin RestoBook. Sekarang Anda siap mengelola restoran dengan efisien dan optimal.',
    position: 'bottom'
  }
];

const CASHIER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang, Kasir!',
    description: 'Selamat datang di Panel Kasir RestoBook. Kami akan memandu Anda mengenal fitur-fitur transaksi, pemesanan online, dan pelayanan di restoran secara cepat.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Dashboard"]',
    title: 'Menu: Dashboard',
    description: 'Pantau ringkasan performa penjualan kasir hari ini, statistik total transaksi tunai/non-tunai, dan antrian pesanan aktif yang perlu diproses.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Point of Sale"]',
    title: 'Menu: Point of Sale (POS)',
    description: 'Antarmuka kasir utama untuk melayani pesanan walk-in di tempat. Pilih menu pesanan pelanggan secara langsung, tentukan nomor meja, dan proses pembayaran tunai/e-wallet.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Status Meja"]',
    title: 'Menu: Status Meja',
    description: 'Tinjau visual tata letak meja di restoran secara real-time. Ketahui dengan cepat meja mana saja yang kosong, sedang terisi pelanggan, atau telah direservasi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan"]',
    title: 'Menu: Pesanan',
    description: 'Pantau semua status pesanan aktif (dimasak, disajikan, selesai) dan lakukan pencetakan ulang struk tagihan belanja jika diminta oleh pelanggan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Online"]',
    title: 'Menu: Pesanan Online',
    description: 'Terima, konfirmasi pembayaran, dan proses pesanan yang dipesan pelanggan secara online melalui aplikasi (takeaway atau delivery) untuk diteruskan ke dapur.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Antrian Dapur"]',
    title: 'Menu: Antrian Dapur',
    description: 'Pantau antrian pengerjaan hidangan oleh juru masak di dapur. Pastikan hidangan yang sudah selesai dimasak segera diantarkan ke meja pelanggan yang tepat.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reservasi"]',
    title: 'Menu: Reservasi',
    description: 'Kelola jadwal booking meja pelanggan untuk hari ini dan hari mendatang. Konfirmasi kedatangan pelanggan reservasi dengan cepat melalui pencarian atau scan QR.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Live Chat"]',
    title: 'Menu: Live Chat',
    description: 'Komunikasikan pertanyaan menu, konfirmasi alamat, atau keluhan pesanan secara langsung dan real-time dengan pelanggan melalui obrolan chat interaktif.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Transaksi"]',
    title: 'Menu: Transaksi',
    description: 'Rekap seluruh mutasi kas masuk selama shift kerja Anda berjalan untuk mempermudah perhitungan laporan setoran kasir saat penutupan shift.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Absensi"]',
    title: 'Menu: Absensi',
    description: 'Catat absensi masuk kerja dan pulang kerja Anda sendiri setiap harinya, serta pantau riwayat kehadiran bulanan Anda.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Profil"]',
    title: 'Menu: Profil',
    description: 'Ubah foto profil kasir Anda, perbarui nomor telepon, dan ganti kata sandi login secara berkala untuk mencegah penyalahgunaan akun.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="header-notifications"]',
    title: 'Pusat Notifikasi',
    description: 'Notifikasi instan untuk pesanan online baru masuk, status pembayaran digital sukses, atau pesan obrolan baru dari pelanggan.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="logout-button"]',
    title: 'Keluar Akun',
    description: 'Klik di sini untuk keluar dari akun kasir secara aman setelah jam shift kerja Anda selesai.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Tutorial Selesai!',
    description: 'Selamat! Anda telah memahami seluruh fitur di Panel Kasir RestoBook. Selamat memberikan pelayanan transaksi terbaik!',
    position: 'bottom'
  }
];

const OWNER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang, Owner!',
    description: 'Selamat datang di Panel Owner RestoBook. Pantau performa bisnis restoran, kelola keputusan tingkat tinggi, dan awasi seluruh aktivitas staf Anda.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Dashboard"]',
    title: 'Menu: Dashboard',
    description: 'Pusat analisis performa bisnis Owner. Tinjau total pendapatan bersih, margin keuntungan, rasio pesanan harian, dan grafik statistik omset.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu Makanan"]',
    title: 'Menu: Menu Makanan',
    description: 'Analisis kegemaran menu — lihat makanan terlaris (best seller), menu yang jarang dipesan, dan rekomendasi harga pasar.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pelanggan"]',
    title: 'Menu: Pelanggan',
    description: 'Tinjau perkembangan jumlah pelanggan terdaftar, riwayat transaksi belanja mereka, pertumbuhan loyalitas pelanggan, dan akumulasi poin reward.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Transaksi"]',
    title: 'Menu: Transaksi',
    description: 'Audit laporan keuangan secara menyeluruh, rekapitulasi mutasi kas harian, penyesuaian saldo, serta verifikasi laporan laba rugi restoran.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Payroll"]',
    title: 'Menu: Payroll (Penggajian)',
    description: 'Tinjau total anggaran gaji bulanan untuk seluruh karyawan, status persetujuan transfer gaji, serta rincian slip gaji staf.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Absensi"]',
    title: 'Menu: Absensi',
    description: 'Pantau tingkat kedisiplinan dan kehadiran karyawan restoran secara keseluruhan: persentase kehadiran, keterlambatan staf, lembur, dan izin kerja.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Resign"]',
    title: 'Menu: Resign',
    description: 'Tinjau berkas permohonan pengunduran diri karyawan, alasan pemutusan hubungan kerja, serta setujui penyelesaian hak karyawan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Keamanan Sistem"]',
    title: 'Menu: Keamanan Sistem',
    description: 'Pantau log aktivitas sensitif administrator, status audit keamanan database, rate limiter, dan backup data server utama.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Settings"]',
    title: 'Menu: Settings',
    description: 'Atur konfigurasi bisnis utama seperti penetapan komisi payment gateway, profil nama resmi usaha, struktur pajak, dan regulasi sistem global.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="header-notifications"]',
    title: 'Pusat Notifikasi',
    description: 'Dapatkan pemberitahuan penting seperti laporan penjualan bulanan siap diunduh, notifikasi audit, atau peringatan sistem darurat.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="logout-button"]',
    title: 'Keluar Akun',
    description: 'Gunakan tombol ini untuk keluar dari panel owner secara aman demi mencegah akses kontrol yang tidak sah.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Tutorial Selesai!',
    description: 'Selamat! Anda telah memahami seluruh fitur di Panel Owner. Pantau dan kembangkan bisnis restoran Anda dengan mudah melalui data akurat RestoBook.',
    position: 'bottom'
  }
];

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  isTutorialActive: false,
  currentStep: 0,
  steps: [],
  status: null,
  userId: null,

  initTutorialStatus: (userId: string, role: string) => {
    if (!userId) return;
    const key = `restobook_tutorial_status_${userId}`;
    const stored = localStorage.getItem(key);
    
    let status: TutorialStatus;
    if (stored) {
      status = JSON.parse(stored);
      // Ensure role matches current
      status.role = role;
    } else {
      status = {
        tour_completed: false,
        first_login: true,
        tour_version: '1.0',
        last_tour_step: 0,
        skipped_tour: false,
        tour_reset_at: null,
        role,
        completed_count: 0,
        skipped_count: 0,
        retried_count: 0
      };
      localStorage.setItem(key, JSON.stringify(status));
    }
    set({ userId, status });
  },

  startTutorial: (role: string) => {
    let steps = CUSTOMER_STEPS;
    if (role === 'admin') steps = ADMIN_STEPS;
    else if (role === 'cashier') steps = CASHIER_STEPS;
    else if (role === 'owner' || role === 'super_admin') steps = OWNER_STEPS;

    const { userId, status } = get();
    if (userId && status) {
      const updatedStatus = {
        ...status,
        retried_count: status.tour_completed ? status.retried_count + 1 : status.retried_count
      };
      localStorage.setItem(`restobook_tutorial_status_${userId}`, JSON.stringify(updatedStatus));
      set({ status: updatedStatus });
    }

    set({
      steps,
      currentStep: 0,
      isTutorialActive: true
    });
  },

  stopTutorial: () => {
    const { userId, status, currentStep } = get();
    if (userId && status) {
      const updatedStatus: TutorialStatus = {
        ...status,
        tour_completed: true,
        first_login: false,
        last_tour_step: currentStep,
        completed_count: status.completed_count + 1
      };
      localStorage.setItem(`restobook_tutorial_status_${userId}`, JSON.stringify(updatedStatus));
      set({ status: updatedStatus });
    }
    set({ isTutorialActive: false, currentStep: 0 });
  },

  nextStep: () => {
    const { currentStep, steps } = get();
    if (currentStep < steps.length - 1) {
      const nextIdx = currentStep + 1;
      set({ currentStep: nextIdx });

      // Save intermediate progress
      const { userId, status } = get();
      if (userId && status) {
        const updatedStatus = { ...status, last_tour_step: nextIdx };
        localStorage.setItem(`restobook_tutorial_status_${userId}`, JSON.stringify(updatedStatus));
        set({ status: updatedStatus });
      }
    } else {
      get().stopTutorial();
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      set({ currentStep: prevIdx });

      // Save intermediate progress
      const { userId, status } = get();
      if (userId && status) {
        const updatedStatus = { ...status, last_tour_step: prevIdx };
        localStorage.setItem(`restobook_tutorial_status_${userId}`, JSON.stringify(updatedStatus));
        set({ status: updatedStatus });
      }
    }
  },

  skipTutorial: () => {
    const { userId, status, currentStep } = get();
    if (userId && status) {
      const updatedStatus: TutorialStatus = {
        ...status,
        first_login: false,
        skipped_tour: true,
        last_tour_step: currentStep,
        skipped_count: status.skipped_count + 1
      };
      localStorage.setItem(`restobook_tutorial_status_${userId}`, JSON.stringify(updatedStatus));
      set({ status: updatedStatus });
    }
    set({ isTutorialActive: false, currentStep: 0 });
  },

  resetTutorial: () => {
    const { userId, status } = get();
    if (userId && status) {
      const updatedStatus: TutorialStatus = {
        ...status,
        tour_completed: false,
        first_login: true,
        last_tour_step: 0,
        skipped_tour: false,
        tour_reset_at: new Date().toISOString()
      };
      localStorage.setItem(`restobook_tutorial_status_${userId}`, JSON.stringify(updatedStatus));
      set({ status: updatedStatus });
    }
    set({ currentStep: 0, isTutorialActive: false });
  }
}));
