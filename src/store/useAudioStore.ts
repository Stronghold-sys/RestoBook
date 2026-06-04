import { create } from 'zustand';

interface AudioStore {
  isCustomerSoundEnabled: boolean;
  initAudioSettings: (userId: string) => void;
  toggleCustomerSound: (userId: string) => void;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  isCustomerSoundEnabled: true,
  initAudioSettings: (userId: string) => {
    if (!userId) return;
    const stored = localStorage.getItem(`restobook_audio_enabled_${userId}`);
    set({ isCustomerSoundEnabled: stored !== 'false' }); // default to true
  },
  toggleCustomerSound: (userId: string) => {
    if (!userId) return;
    const newVal = !get().isCustomerSoundEnabled;
    localStorage.setItem(`restobook_audio_enabled_${userId}`, String(newVal));
    set({ isCustomerSoundEnabled: newVal });
  }
}));
