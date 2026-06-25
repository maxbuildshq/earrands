import type { LabelHTMLAttributes } from 'react'

type Props = LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className = '', ...props }: Props) {
  return (
    <label
      className={`block font-mono text-text-secondary text-base mb-1 uppercase tracking-wider ${className}`.trim()}
      {...props}
    />
  )
}
