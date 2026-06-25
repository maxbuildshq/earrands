import type { HTMLAttributes } from 'react'

type Variant = 'live' | 'accent' | 'accent-outline' | 'outline' | 'conflict'

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant: Variant
}

const BASE = 'inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-bold uppercase leading-none'

const VARIANTS: Record<Variant, string> = {
  live: 'bg-live text-white',
  accent: 'bg-accent text-surface',
  'accent-outline': 'border border-accent text-accent',
  outline: 'border border-border text-text-secondary',
  conflict: 'text-conflict tracking-wider',
}

export function Badge({ variant, className = '', ...props }: Props) {
  return <span className={`${BASE} ${VARIANTS[variant]} ${className}`.trim()} {...props} />
}
