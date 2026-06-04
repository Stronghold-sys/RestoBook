import { create } from 'zustand';

export type ModalType =
  | 'confirm'
  | 'camera'
  | 'attendance'
  | 'profile_password'
  | 'profile_delete'
  | 'profile_confirm_resign';

interface ModalConfig {
  type: ModalType;
  props?: any;
}

interface ModalStore {
  activeModal: ModalConfig | null;
  openModal: (type: ModalType, props?: any) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModal: null,
  openModal: (type, props) => set({ activeModal: { type, props } }),
  closeModal: () => set({ activeModal: null }),
}));
