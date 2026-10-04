import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantClasses = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4 my-1'
  };

  const computedStyle: React.CSSProperties = {
    width: width,
    height: height,
    ...style
  };

  return (
    <div
      aria-hidden="true"
      style={computedStyle}
      className={`animate-pulse bg-neutral-200 dark:bg-white/[0.07] ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};
