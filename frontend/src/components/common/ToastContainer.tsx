import { FC, useEffect } from 'react';
import { useToastStore, ToastType } from '../../stores/toastStore';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const icons: Record<ToastType, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-[var(--color-success)] bg-[var(--color-success-muted)]',
  error: 'border-[var(--color-danger)] bg-[var(--color-danger-muted)]',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning-muted)]',
  info: 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-primary)]',
};

const textStyles: Record<ToastType, string> = {
  success: 'text-[var(--text-primary)]',
  error: 'text-[var(--text-primary)]',
  warning: 'text-[var(--text-primary)]',
  info: 'text-[var(--text-primary)]',
};

export const ToastContainer: FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        
        return (
          <ToastItem
            key={toast.id}
            toast={toast}
            Icon={Icon}
            onClose={() => removeToast(toast.id)}
            toastStyles={toastStyles[toast.type]}
            iconStyles={iconStyles[toast.type]}
            textStyles={textStyles[toast.type]}
          />
        );
      })}
    </div>
  );
};

interface ToastItemProps {
  toast: { id: string; message: string; type: ToastType };
  Icon: typeof CheckCircleIcon;
  onClose: () => void;
  toastStyles: string;
  iconStyles: string;
  textStyles: string;
}

const ToastItem: FC<ToastItemProps> = ({ toast, Icon, onClose, toastStyles, iconStyles, textStyles }) => {
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg
        animate-slide-in backdrop-blur-sm
        ${toastStyles}
      `}
      style={{
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.2)',
      }}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconStyles}`} />
      <p className={`flex-1 text-sm font-bold ${textStyles}`}>{toast.message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Cerrar"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};