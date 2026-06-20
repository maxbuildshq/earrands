import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant =
  | 'primary'
  | 'secondary'
  | 'accent-outline'
  | 'accent-toggle'
  | 'icon'
  | 'icon-toggle'
  | 'icon-bare'
  | 'danger'
  | 'segment'
  | 'choice'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: Variant
  active?: boolean
  fullWidth?: boolean
}

const BASE_FULL = 'font-mono font-bold text-sm uppercase tracking-wider py-2.5 px-4 transition-colors disabled:opacity-50'
const BASE_ICON = 'w-8 h-8 flex items-center justify-center border transition-colors'
const BASE_SEGMENT = 'font-mono font-bold text-xs uppercase tracking-wider transition-colors'
const BASE_CHOICE = 'font-mono font-bold text-xs uppercase tracking-wider border transition-colors'

// Exported so non-button elements (e.g. Link) can apply the same class string.
export const ICON_BARE_CLASS = 'w-8 h-8 flex items-center justify-center text-text-secondary hover:text-accent transition-colors'

const VARIANTS: Record<Variant, string | ((active?: boolean) => string)> = {
  primary: `${BASE_FULL} bg-accent text-surface hover:bg-accent-dim`,
  secondary: `${BASE_FULL} border border-border text-text-secondary hover:border-text-secondary hover:text-text-primary`,
  // Static lime-border CTA — use when the button has no active/inactive state.
  'accent-outline': `${BASE_FULL} border border-accent text-accent hover:bg-accent hover:text-surface`,
  // Stateful lime toggle — use when the button represents an on/off state (active = solid fill).
  'accent-toggle': (active) =>
    active
      ? `${BASE_FULL} bg-accent text-surface`
      : `${BASE_FULL} border border-accent text-accent hover:bg-accent hover:text-surface`,
  icon: `${BASE_ICON} border-border text-text-secondary hover:text-text-primary hover:border-text-secondary`,
  'icon-toggle': (active) =>
    active
      ? `${BASE_ICON} bg-accent border-accent text-surface`
      : `${BASE_ICON} bg-transparent border-border text-text-secondary hover:border-text-secondary`,
  // Borderless icon button — no border, no active state. Use for persistent header/nav actions.
  'icon-bare': ICON_BARE_CLASS,
  danger: (active) =>
    active
      ? `${BASE_ICON} bg-negative border-negative text-surface`
      : `${BASE_ICON} bg-transparent border-border text-text-secondary hover:border-text-secondary`,
  segment: (active) =>
    active
      ? `${BASE_SEGMENT} bg-accent text-surface`
      : `${BASE_SEGMENT} text-text-secondary hover:text-text-primary`,
  choice: (active) =>
    active
      ? `${BASE_CHOICE} bg-accent border-accent text-surface`
      : `${BASE_CHOICE} bg-transparent border-border text-text-secondary hover:border-text-secondary`,
}

const FULL_WIDTH_VARIANTS: Variant[] = ['primary', 'secondary', 'accent-outline', 'accent-toggle']

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant, active, fullWidth = true, className = '', ...props },
  ref,
) {
  const isFullVariant = FULL_WIDTH_VARIANTS.includes(variant)
  const base = typeof VARIANTS[variant] === 'function'
    ? (VARIANTS[variant] as (a?: boolean) => string)(active)
    : VARIANTS[variant] as string
  const widthClass = isFullVariant && fullWidth ? 'w-full' : ''
  return <button ref={ref} className={`${base} ${widthClass} ${className}`.trim()} {...props} />
})
