import React from 'react';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showLabel?: boolean;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showLabel = false,
  variant = 'accent',
  size = 'md',
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  const variantClasses = {
    default: 'bg-neutral-800 dark:bg-white',
    accent: 'bg-amber-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500'
  };

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-neutral-600 dark:text-neutral-300">
          {label && <span>{label}</span>}
          {showLabel && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-neutral-200 dark:bg-white/[0.08] rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${variantClasses[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
