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
    description: 'Halaman utama aktivitas Anda. Dari sini Anda bisa melihat ringkasan pesanan, notifikasi, dan akses cepat ke fitur utama aplikasi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu"]',
    title: 'Menu: Menu Makanan',
    description: 'Klik menu ini untuk menelusuri semua pilihan hidangan yang tersedia, kemudian tambahkan ke keranjang dan lakukan pemesanan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Keranjang"]',
    title: 'Menu: Keranjang',
    description: 'Semua makanan yang Anda pilih akan tersimpan di sini sebelum dikonfirmasi dan dibayar. Anda bisa mengubah jumlah pesanan di keranjang.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Dompetku"]',
    title: 'Menu: Dompetku',
    description: 'Dompet digital Anda. Gunakan saldo Dompetku untuk membayar pesanan makanan dengan cepat dan aman tanpa perlu uang tunai.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Voucher Saya"]',
    title: 'Menu: Voucher Saya',
    description: 'Koleksi voucher diskon dan promo yang Anda miliki. Gunakan voucher ini saat checkout untuk mendapatkan potongan harga.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Tukar Point"]',
    title: 'Menu: Tukar Point',
    description: 'Tukarkan poin reward yang Anda kumpulkan dari setiap transaksi dengan hadiah menarik, diskon, atau cashback eksklusif.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Saya"]',
    title: 'Menu: Pesanan Saya',
    description: 'Lacak status semua pesanan Anda — mulai dari yang sedang diproses, menunggu pembayaran, hingga pesanan yang sudah selesai.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Favorit"]',
    title: 'Menu: Favorit',
    description: 'Simpan menu makanan favorit Anda di sini agar mudah ditemukan dan dipesan kembali tanpa perlu mencari dari awal.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reservasi"]',
    title: 'Menu: Reservasi',
    description: 'Kelola reservasi meja Anda. Di sini tersimpan detail meja, waktu makan, dan kode QR yang perlu ditunjukkan saat tiba di restoran.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="header-notifications"]',
    title: 'Pusat Notifikasi',
    description: 'Semua pemberitahuan penting seperti konfirmasi pesanan, status pembayaran, dan promo terbaru akan muncul di sini.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Pengaduan & Bantuan"]',
    title: 'Menu: Pengaduan & Bantuan',
    description: 'Temukan panduan penggunaan, FAQ, atau ajukan pengaduan jika ada kendala. Tim kami siap membantu Anda melalui menu ini.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Profil"]',
    title: 'Menu: Profil',
    description: 'Lihat dan ubah data diri Anda: nama, email, nomor HP, foto profil, serta pengaturan keamanan akun.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logout-button"]',
    title: 'Keluar Akun',
    description: 'Gunakan tombol ini untuk keluar dari akun Anda dengan aman setelah selesai menggunakan aplikasi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Tutorial Selesai!',
    description: 'Anda sudah mengenal semua fitur utama RestoBook. Selamat menikmati pengalaman makan yang lebih mudah dan menyenangkan!',
    position: 'bottom'
  }
];

const ADMIN_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang, Admin!',
    description: 'Selamat datang di Panel Admin RestoBook. Di sini Anda memiliki akses penuh ke manajemen operasional restoran.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Dashboard"]',
    title: 'Menu: Dashboard',
    description: 'Pantau performa harian restoran — lihat ringkasan laba kotor, jumlah pesanan masuk, dan grafik tren penjualan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu Makanan"]',
    title: 'Menu: Menu Makanan',
    description: 'Tambahkan hidangan baru, atur ketersediaan stok dan porsi, ubah harga, foto, serta kategori makanan yang ditampilkan ke pelanggan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan"]',
    title: 'Menu: Pesanan',
    description: 'Pantau seluruh pesanan aktif dan yang sudah selesai, perbarui status transaksi, dan cetak laporan pesanan harian.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Fitur Dompetku"]',
    title: 'Menu: Fitur Dompetku',
    description: 'Halaman audit saldo Dompetku pelanggan — kelola status wallet, blokir akun bermasalah, dan rekap penyesuaian saldo manual.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Settings"]',
    title: 'Menu: Settings',
    description: 'Atur konfigurasi restoran: tema warna, jam operasional, aktifkan mode maintenance, dan pengaturan global sistem.',
    position: 'right'
  }
];

const CASHIER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang, Kasir!',
    description: 'Selamat datang di Layanan Kasir RestoBook. Gunakan panel ini untuk melayani pelanggan dan memproses transaksi di tempat.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Point of Sale"]',
    title: 'Menu: Point of Sale (POS)',
    description: 'Antarmuka kasir untuk memasukkan pesanan langsung dari meja, memilih menu, menghitung total, dan memproses pembayaran di tempat.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Online"]',
    title: 'Menu: Pesanan Online',
    description: 'Terima, konfirmasi, dan proses pesanan takeaway atau delivery yang masuk dari pelanggan eksternal melalui aplikasi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Live Chat"]',
    title: 'Menu: Live Chat',
    description: 'Komunikasikan secara langsung dan real-time dengan pelanggan yang membutuhkan bantuan atau klarifikasi pesanan.',
    position: 'right'
  }
];

const OWNER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang, Owner!',
    description: 'Selamat datang di Panel Pemilik RestoBook. Pantau performa bisnis, kelola konfigurasi, dan awasi seluruh operasional restoran dari sini.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Dashboard"]',
    title: 'Menu: Dashboard',
    description: 'Pusat kendali utama Owner. Lihat ringkasan keuntungan bersih, volume pesanan, tren pendapatan, dan grafik performa bisnis secara real-time.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu Makanan"]',
    title: 'Menu: Menu Makanan',
    description: 'Analisis performa menu — lihat hidangan terlaris, menu yang jarang dipesan, dan rekomendasi penyesuaian harga atau stok.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pelanggan"]',
    title: 'Menu: Pelanggan',
    description: 'Monitor akun pelanggan terdaftar: tingkat keaktifan, histori transaksi, saldo Dompetku, dan ulasan yang diberikan ke restoran.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Transaksi"]',
    title: 'Menu: Transaksi',
    description: 'Pantau seluruh riwayat transaksi keuangan — mutasi pembayaran, pengembalian dana, dan rekap omset untuk keperluan audit.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Payroll"]',
    title: 'Menu: Payroll (Penggajian)',
    description: 'Kelola slip gaji karyawan, lihat rekap tunjangan dan potongan, serta ekspor laporan penggajian bulanan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Absensi"]',
    title: 'Menu: Absensi',
    description: 'Pantau kehadiran seluruh karyawan secara real-time — lihat rekap hadir, izin, lembur, dan keterlambatan setiap harinya.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Resign"]',
    title: 'Menu: Resign',
    description: 'Kelola pengajuan pengunduran diri karyawan, tinjau alasan resign, dan atur proses serah terima sebelum akun ditangguhkan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Keamanan Sistem"]',
    title: 'Menu: Keamanan Sistem',
    description: 'Tinjau log keamanan, deteksi aktivitas mencurigakan, rate limiter bot, dan status keamanan server secara menyeluruh.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Settings"]',
    title: 'Menu: Settings',
    description: 'Konfigurasi global restoran: tarif pajak, jam operasional, hak akses role, tema tampilan, dan pengaturan sistem.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logout-button"]',
    title: 'Keluar Akun',
    description: 'Gunakan tombol ini untuk keluar dari akun Owner dengan aman setelah selesai memantau sistem.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Tutorial Selesai!',
    description: 'Anda telah menyelesaikan tutorial Panel Owner RestoBook. Pantau bisnis Anda kapan saja dan di mana saja.',
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
