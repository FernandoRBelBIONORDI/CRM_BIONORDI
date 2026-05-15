import { useState, useCallback } from "react";
import ConfirmModal from "@/components/ConfirmModal";

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    ({ 
      message, 
      title, 
      confirmText, 
      onConfirm 
    }: { 
      message: string; 
      title?: string; 
      confirmText?: string; 
      onConfirm: () => void 
    }) => {
      setConfirmState({
        isOpen: true,
        message,
        title,
        confirmText,
        onConfirm,
      });
    },
    []
  );

  const handleCancel = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialog = () => (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      message={confirmState.message}
      title={confirmState.title}
      confirmText={confirmState.confirmText}
      onConfirm={confirmState.onConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialog };
}
