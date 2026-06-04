import { create } from 'zustand';

export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TutorialStore {
  isTutorialActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  startTutorial: (role: string) => void;
  stopTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setSteps: (steps: TutorialStep[]) => void;
}

const DEFAULT_CUSTOMER_STEPS: TutorialStep[] = [
  {
    targetSelector: '[data-tour="logo"]',
    title: 'Selamat Datang di RestoBook!',
    description: 'Ini adalah logo resmi RestoBook. Anda bisa mengklik logo ini kapan saja untuk kembali ke halaman beranda utama.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="nav-Home"]',
    title: 'Menu Beranda',
    description: 'Di sini Anda dapat melihat status ringkasan akun Anda, promo spesial hari ini, dan riwayat pesanan singkat.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Menu"]',
    title: 'Daftar Menu Hidangan',
    description: 'Telusuri menu makanan dan minuman lezat restoran kami. Anda bisa memfilter berdasarkan kategori atau langsung melakukan pemesanan meja.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Keranjang"]',
    title: 'Keranjang Belanja',
    description: 'Semua item makanan yang Anda pilih akan masuk ke sini. Anda dapat mengatur jumlah porsi sebelum melakukan checkout.',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="nav-Dompetku"]',
    title: 'Fitur Dompetku',
    description: 'RestoBook dilengkapi dengan pembayaran digital instan Dompetku. Lakukan top up saldo dengan aman untuk transaksi lebih cepat!',
    position: 'right'
  },
  {
    targetSelector: '[data-tour="theme-toggle"]',
    title: 'Toggle Dark Mode',
    description: 'Gunakan tombol ini untuk mengganti tampilan tema aplikasi ke Mode Gelap atau Mode Terang demi kenyamanan mata Anda.',
    position: 'bottom'
  },
  {
    targetSelector: '[data-tour="profile-avatar"]',
    title: 'Menu Profil & Notifikasi Suara',
    description: 'Klik profil untuk mengatur data diri Anda. Di halaman Profil, Anda juga dapat mematikan/menghidupkan suara notifikasi pelanggan dengan ikon speaker.',
    position: 'bottom'
  }
];

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  isTutorialActive: false,
  currentStep: 0,
  steps: [],
  setSteps: (steps) => set({ steps }),
  startTutorial: (role: string) => {
    // We can support different steps depending on the role in the future
    const steps = DEFAULT_CUSTOMER_STEPS;
    set({
      steps,
      currentStep: 0,
      isTutorialActive: true
    });
  },
  stopTutorial: () => set({ isTutorialActive: false, currentStep: 0 }),
  nextStep: () => {
    const { currentStep, steps } = get();
    if (currentStep < steps.length - 1) {
      set({ currentStep: currentStep + 1 });
    } else {
      get().stopTutorial();
    }
  },
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  }
}));
