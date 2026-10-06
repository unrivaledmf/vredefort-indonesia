import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, children, className = '', id, disabled, ...props }, ref) => {
    const autoId = useId();
    const selectId = id || autoId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full appearance-none px-3 py-2 pr-9 text-sm rounded-lg bg-white dark:bg-[#0e1420] border ${
              error
                ? 'border-red-500 focus:border-red-500 focus-visible:ring-red-500'
                : 'border-neutral-300 dark:border-white/[0.1] focus:border-amber-500 focus-visible:ring-amber-500'
            } text-neutral-900 dark:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-950 disabled:opacity-50 disabled:bg-neutral-100 dark:disabled:bg-white/[0.02] cursor-pointer ${className}`}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-3 pointer-events-none text-neutral-400 dark:text-neutral-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error ? (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
