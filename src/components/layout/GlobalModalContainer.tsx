"use client";

import { useModalStore } from "@/store/useModalStore";
import { AnimatePresence } from "framer-motion";
import ConfirmDialog from "@/components/ConfirmDialog";
import CameraCaptureModal from "@/components/CameraCaptureModal";
import ProfilePasswordModal from "@/components/profile/ProfilePasswordModal";
import ProfileDeleteModal from "@/components/profile/ProfileDeleteModal";
import ProfileResignModal from "@/components/profile/ProfileResignModal";

export default function GlobalModalContainer() {
  const { activeModal, closeModal } = useModalStore();

  if (!activeModal) return null;

  const { type, props } = activeModal;

  return (
    <AnimatePresence mode="wait">
      {type === 'confirm' && (
        <ConfirmDialog
          isOpen={true}
          onClose={closeModal}
          {...props}
        />
      )}

      {type === 'camera' && (
        <CameraCaptureModal
          isOpen={true}
          onClose={closeModal}
          {...props}
        />
      )}

      {type === 'profile_password' && (
        <ProfilePasswordModal
          isOpen={true}
          onClose={closeModal}
          {...props}
        />
      )}

      {type === 'profile_delete' && (
        <ProfileDeleteModal
          isOpen={true}
          onClose={closeModal}
          {...props}
        />
      )}

      {type === 'profile_confirm_resign' && (
        <ProfileResignModal
          isOpen={true}
          onClose={closeModal}
          {...props}
        />
      )}
    </AnimatePresence>
  );
}
