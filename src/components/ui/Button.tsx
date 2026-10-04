import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
      md: 'px-4 py-2 text-sm gap-2 rounded-lg',
      lg: 'px-5 py-2.5 text-base gap-2.5 rounded-lg'
    };

    const variantClasses = {
      primary:
        'bg-amber-500 text-neutral-950 font-semibold hover:bg-amber-400 active:bg-amber-600 shadow-sm border border-amber-400/40',
      secondary:
        'bg-white dark:bg-white/[0.04] text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/[0.08] border border-neutral-200 dark:border-white/[0.1] active:bg-neutral-200 dark:active:bg-white/[0.12]',
      outline:
        'bg-transparent text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/[0.08] border border-neutral-300 dark:border-white/[0.2]',
      ghost:
        'bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-900 dark:hover:text-white',
      danger:
        'bg-red-600 text-white font-medium hover:bg-red-500 active:bg-red-700 shadow-sm border border-red-500/30'
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
