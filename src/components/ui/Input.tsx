import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement>

export function Input({ className = '', ...props }: Props) {
  return (
    <input
      className={`w-full bg-surface border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-accent transition-colors ${className}`.trim()}
      {...props}
    />
  )
}
