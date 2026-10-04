import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs'
  };

  const variantClasses = {
    default:
      'bg-neutral-100 text-neutral-800 dark:bg-white/[0.08] dark:text-neutral-200 border border-neutral-200 dark:border-white/[0.08]',
    accent:
      'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30',
    success:
      'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30',
    warning:
      'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30',
    danger:
      'bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30',
    info:
      'bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/30',
    outline:
      'bg-transparent text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-white/[0.15]'
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md tracking-tight ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
