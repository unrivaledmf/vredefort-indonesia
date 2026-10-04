import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle ESC key & Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the modal after mounting
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const firstInput = modalRef.current.querySelector<HTMLElement>('input, button:not([aria-label="Tutup"])');
        if (firstInput) {
          firstInput.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      clearTimeout(timer);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl'
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} bg-white dark:bg-[#0e1420] border border-neutral-200 dark:border-white/[0.1] rounded-2xl shadow-2xl z-10 overflow-hidden outline-none animate-in zoom-in-95 fade-in duration-150`}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-neutral-100 dark:border-white/[0.06]">
            <div>
              {title && (
                <h3
                  id="modal-title"
                  className="text-base font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight"
                >
                  {title}
                </h3>
              )}
              {description && (
                <p id="modal-description" className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
};
