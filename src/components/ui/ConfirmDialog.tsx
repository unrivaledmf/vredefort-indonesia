import React from 'react';
import { Modal } from './Modal.tsx';
import { Button } from './Button.tsx';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  variant = 'danger',
  loading = false
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <div className="p-2.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400">
            <Info className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="flex flex-col items-center text-center pt-2">
        {getIcon()}
        <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-3 tracking-tight">
          {title}
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center gap-2.5 w-full mt-6">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
            loading={loading}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
