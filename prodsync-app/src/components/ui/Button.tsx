import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold uppercase tracking-[0.18em] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-65 disabled:transform-none disabled:shadow-none',
  {
    variants: {
      variant: {
        primary:
          'bg-orange-500 text-black hover:bg-orange-600 hover:-translate-y-[1px] hover:shadow-md hover:shadow-orange-500/20 focus-visible:ring-orange-500/40 active:scale-[0.99]',
        approve:
          'border border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-700 hover:border-emerald-500/60 hover:bg-emerald-500/15 hover:text-emerald-800 hover:-translate-y-[1px] hover:shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200 focus-visible:ring-emerald-500/40 active:scale-[0.99]',
        danger:
          'border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:-translate-y-[1px] dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-500/30 dark:hover:bg-red-500/15 focus-visible:ring-red-500/40 active:scale-[0.99]',
        soft:
          'border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-100 hover:-translate-y-[1px] hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-800 focus-visible:ring-orange-500/40 active:scale-[0.99]',
        ghost:
          'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 hover:-translate-y-[1px] dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white focus-visible:ring-orange-500/40 active:scale-[0.99]',
        clayPrimary:
          'bg-orange-500 text-black hover:bg-orange-600 hover:-translate-y-[1px] focus-visible:ring-orange-500/40 active:scale-[0.99] shadow-[0_18px_34px_rgba(255,106,61,0.26),inset_1px_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_22px_38px_rgba(255,106,61,0.32),inset_1px_1px_0_rgba(255,255,255,0.5)]',
        clayApprove:
          'border border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-700 hover:bg-emerald-500/15 hover:border-emerald-500/60 hover:text-emerald-800 hover:-translate-y-[1px] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200 focus-visible:ring-emerald-500/40 active:scale-[0.99] shadow-[0_12px_26px_rgba(16,185,129,0.08),inset_1px_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_1px_1px_0_rgba(255,255,255,0.02)]',
        clayGhost:
          'bg-white/80 text-zinc-700 hover:text-orange-500 hover:-translate-y-[1px] dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:text-orange-400 active:scale-[0.99] shadow-[12px_12px_26px_rgba(223,218,211,0.42),-8px_-8px_18px_rgba(255,255,255,0.8)] dark:shadow-[14px_14px_28px_rgba(0,0,0,0.32),-6px_-6px_14px_rgba(255,255,255,0.02)]',
      },
      size: {
        default: 'px-4 py-2.5 text-xs',
        sm: 'px-3 py-1.5 text-[11px]',
        lg: 'px-6 py-3.5 text-sm',
        icon: 'h-10 w-10 p-0 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  loadingText?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, loadingText, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="ui-spinner border-2 border-current border-t-transparent text-current" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'
