import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'block' | 'text' | 'circle';
}

export default function Skeleton({ className, variant = 'block', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden bg-white/10',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1.4s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        variant === 'text' && 'h-3 w-full rounded-sm',
        variant === 'circle' && 'aspect-square rounded-full',
        variant === 'block' && 'rounded-sm',
        className,
      )}
      {...props}
    />
  );
}
