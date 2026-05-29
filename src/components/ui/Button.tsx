import { ButtonHTMLAttributes, ReactNode } from 'react'
import Spinner from './Spinner'

type Variant = 'primary' | 'danger' | 'ghost' | 'outline'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-blood hover:bg-blood-light text-ink border border-blood-dark disabled:opacity-50',
  danger:
    'bg-transparent hover:bg-blood/20 text-blood border border-blood disabled:opacity-50',
  ghost:
    'bg-transparent hover:bg-elevated text-ink-muted hover:text-ink border border-transparent',
  outline:
    'bg-transparent hover:bg-elevated text-ink border border-border hover:border-border-light',
}

export default function Button({
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2 rounded
        text-sm font-body transition-colors duration-150 cursor-pointer
        disabled:cursor-not-allowed
        ${variants[variant]}
        ${className}
      `}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  )
}
