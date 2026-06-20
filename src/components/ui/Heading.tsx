import type { HTMLAttributes, ElementType } from 'react'

type Variant = 'page' | 'content' | 'section' | 'sheet' | 'card'

type Props = HTMLAttributes<HTMLHeadingElement> & {
  variant: Variant
  as?: ElementType
}

const BASE = 'font-mono font-bold'

const VARIANTS: Record<Variant, string> = {
  page: `${BASE} text-2xl text-accent tracking-tight`,
  content: `${BASE} text-lg text-accent tracking-tight`,
  section: `${BASE} text-xs uppercase tracking-widest`,
  sheet: `${BASE} text-lg text-text-primary leading-tight`,
  // Card/list item titles (artist name, festival name). Override color via className when needed.
  card: `${BASE} text-base text-text-primary`,
}

const DEFAULT_TAG: Record<Variant, ElementType> = {
  page: 'h1',
  content: 'h1',
  section: 'h2',
  sheet: 'h2',
  card: 'h3',
}

export function Heading({ variant, as, className = '', ...props }: Props) {
  const Tag = as ?? DEFAULT_TAG[variant]
  return <Tag className={`${VARIANTS[variant]} ${className}`.trim()} {...props} />
}
