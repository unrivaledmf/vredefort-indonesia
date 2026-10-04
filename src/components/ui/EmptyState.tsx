import React from 'react';
import { FolderX } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-neutral-200 dark:border-white/[0.1] bg-neutral-50/50 dark:bg-white/[0.01] ${className}`}
    >
      <div className="p-3 mb-3 rounded-full bg-neutral-100 dark:bg-white/[0.05] text-neutral-400 dark:text-neutral-500">
        {icon || <FolderX className="w-8 h-8" />}
      </div>
      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
