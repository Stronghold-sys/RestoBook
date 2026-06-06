import { create } from 'zustand';

interface AudioStore {
  isCustomerSoundEnabled: boolean;
  initAudioSettings: (userId: string) => void;
  toggleCustomerSound: (userId: string) => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  isCustomerSoundEnabled: false,
  initAudioSettings: (userId: string) => {
    if (!userId) return;
    // Selalu nonaktifkan suara saat pertama kali masuk/login
    set({ isCustomerSoundEnabled: false });
  },
  toggleCustomerSound: (userId: string) => {
    if (!userId) return;
    const newVal = !get().isCustomerSoundEnabled;
    localStorage.setItem(`restobook_audio_enabled_${userId}`, String(newVal));
    set({ isCustomerSoundEnabled: newVal });
  }
}));
