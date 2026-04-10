import { FC } from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton shimmer animation
 */
export const Skeleton: FC<SkeletonProps> = ({ className = '' }) => (
  <div 
    className={`
      bg-gradient-to-r from-[var(--surface-elevated)] via-[var(--border-subtle)] to-[var(--surface-elevated)]
      dark:from-[var(--dark-surface-elevated)] dark:via-[var(--dark-border-subtle)] dark:to-[var(--dark-surface-elevated)]
      bg-[length:200%_100%] animate-shimmer
      rounded-[var(--radius-sm)]
      ${className}
    `}
  />
);

/**
 * Task card skeleton with placeholder for title, description, and actions
 */
export const TaskCardSkeleton: FC = () => (
  <div className="card flex items-start gap-4 p-4">
    {/* Content skeleton */}
    <div className="flex-1 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-1/3" />
    </div>
    
    {/* Actions skeleton */}
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-5 rounded-[var(--radius-sm)]" />
      <Skeleton className="h-5 w-5 rounded-[var(--radius-sm)]" />
      <Skeleton className="h-5 w-5 rounded-[var(--radius-sm)]" />
    </div>
  </div>
);

/**
 * Multiple task cards skeleton for loading state
 */
export const TaskListSkeleton: FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <TaskCardSkeleton key={i} />
    ))}
  </div>
);

/**
 * Form skeleton for task creation/editing
 */
export const TaskFormSkeleton: FC = () => (
  <div className="card p-5 space-y-4">
    <Skeleton className="h-5 w-1/4" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-24 w-full" />
    <div className="flex gap-3">
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-9 w-20" />
    </div>
  </div>
);

/**
 * Page header skeleton
 */
export const PageHeaderSkeleton: FC = () => (
  <div className="flex justify-between items-center mb-6">
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-10 w-24" />
  </div>
);