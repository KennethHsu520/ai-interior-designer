import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap select-none transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white shadow-hairline hover:bg-brand-600 hover:shadow-card-hover',
  secondary: 'bg-white text-ink border border-line shadow-hairline hover:border-line-2 hover:bg-surface',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface hover:text-ink',
  inverse: 'bg-white text-brand-700 shadow-hairline hover:bg-brand-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size; children: ReactNode }

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  )
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }

export function LinkButton({ variant = 'primary', size = 'md', className = '', children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  )
}
