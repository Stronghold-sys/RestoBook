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
    title: 'Selamat datang di TiketKu',
    description: 'Kami akan memandu Anda mengenal semua fitur penting agar Anda lebih mudah memesan, membayar, dan melihat tiket digital.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Home"]',
    title: 'Halaman Utama',
    description: 'Ini adalah pusat aktivitas Anda. Dari sini Anda bisa melihat ringkasan pesanan, notifikasi, dan akses cepat ke fitur utama.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Profil"]',
    title: 'Profil Akun',
    description: 'Di sini Anda dapat melihat dan mengubah data diri, email, nomor kontak, serta pengaturan akun Anda.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Saya"]',
    title: 'Data Pesanan',
    description: 'Menu ini menampilkan semua pesanan tiket yang sedang diproses, sudah dibayar, atau menunggu tindakan Anda.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Dompetku"]',
    title: 'Riwayat Transaksi',
    description: 'Semua transaksi yang pernah Anda lakukan akan tersimpan di sini agar mudah dicek kembali kapan saja.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Dompetku"]',
    title: 'Pembayaran',
    description: 'Gunakan menu ini untuk menyelesaikan pembayaran pesanan tiket Anda dengan aman dan cepat.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reservasi"]',
    title: 'Tiket Digital',
    description: 'Setelah pembayaran berhasil, tiket Anda akan muncul di sini lengkap dengan detail film dan kode QR untuk digunakan saat masuk bioskop.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Reservasi"]',
    title: 'Kode QR Tiket',
    description: 'Tunjukkan kode QR ini saat masuk. Kode ini berisi data tiket Anda dan akan diverifikasi oleh petugas.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="header-notifications"]',
    title: 'Notifikasi Penting',
    description: 'Semua pemberitahuan seperti status pembayaran, tiket siap, atau informasi terbaru akan tampil di sini.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Pengaduan & Bantuan"]',
    title: 'Pusat Bantuan',
    description: 'Jika ada yang belum jelas, buka menu ini untuk melihat panduan, FAQ, atau cara menggunakan setiap fitur.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Profil"]',
    title: 'Pengaturan',
    description: 'Di sini Anda bisa mengatur preferensi akun, keamanan, bahasa, dan tampilan aplikasi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu"]',
    title: 'Mulai Pesanan',
    description: 'Klik tombol ini untuk memulai pemesanan tiket baru dan memilih film, jadwal, serta kursi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Saya"]',
    title: 'Pantau Status',
    description: 'Bagian ini membantu Anda mengetahui apakah pesanan masih menunggu, sudah dibayar, atau sudah selesai.',
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
    title: 'Tutorial Selesai',
    description: 'Anda sudah mengenal fitur utama aplikasi. Anda bisa membuka panduan ini lagi kapan saja melalui menu bantuan.',
    position: 'bottom'
  }
];

const ADMIN_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang Admin',
    description: 'Selamat datang di Panel Admin RestoBook. Di sini Anda memiliki akses penuh ke manajemen restoran.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Dashboard"]',
    title: 'Statistik Harian',
    description: 'Lihat ringkasan laba kotor, jumlah pesanan, dan grafik performa penjualan harian.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu Makanan"]',
    title: 'Kelola Menu Makanan',
    description: 'Tambahkan menu baru, atur ketersediaan porsi, harga, foto, dan kategori makanan.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan"]',
    title: 'Daftar Semua Pesanan',
    description: 'Pantau pesanan aktif, pesanan selesai, cetak laporan, dan update status transaksi.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Fitur Dompetku"]',
    title: 'Kelola Dompetku',
    description: 'Halaman audit saldo Dompetku pelanggan, reset status, blokir, dan rekap penyesuaian manual.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Settings"]',
    title: 'Pengaturan Restoran',
    description: 'Ganti tema warna, atur jam buka, aktifkan mode pemeliharaan (maintenance), dan sinkronisasi data.',
    position: 'right'
  }
];

const CASHIER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang Kasir',
    description: 'Selamat datang di Layanan Kasir RestoBook. Layani pelanggan dan verifikasi meja makan dengan mudah.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Point of Sale"]',
    title: 'Point of Sale (POS)',
    description: 'Gunakan antarmuka ini untuk memesan makanan langsung dari meja makan di tempat.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Pesanan Online"]',
    title: 'Pesanan Online Masuk',
    description: 'Terima dan konfirmasi pesanan takeaway atau delivery pelanggan eksternal.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Live Chat"]',
    title: 'Live Chat Bantuan',
    description: 'Berkomunikasi langsung secara real-time dengan pelanggan yang mengalami kendala.',
    position: 'right'
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
