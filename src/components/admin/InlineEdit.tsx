import { useState, type ReactNode } from 'react'

function handle(h: string) {
  return h.trim().replace(/^\/+|\/+$/g, '')
}

export function scParse(url: string) {
  return url.replace(/^https?:\/\/(www\.)?soundcloud\.com\//, '').replace(/\/$/, '')
}
export function scBuild(raw: string) {
  const h = handle(scParse(raw))
  return h ? `https://soundcloud.com/${h}` : ''
}

export function igParse(url: string) {
  return url.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
}
export function igBuild(raw: string) {
  const h = handle(igParse(raw))
  return h ? `https://www.instagram.com/${h}` : ''
}

export function bcParse(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\.bandcamp\.com\/?.*$/, '')
}
export function bcBuild(raw: string) {
  const h = handle(bcParse(raw))
  return h ? `https://${h}.bandcamp.com` : ''
}

export function discogsUrl(id: number) {
  return `https://www.discogs.com/artist/${id}`
}

export function scHandle(url: string | null) {
  if (!url) return null
  return scParse(url)
}
export function igHandle(url: string | null) {
  if (!url) return null
  return '@' + igParse(url)
}
export function bcHandle(url: string | null) {
  if (!url) return null
  return bcParse(url)
}

export function InlineEdit({
  value,
  displayValue,
  href,
  onSave,
  placeholder,
  parse = v => v,
  build = v => v,
  renderDisplay,
}: {
  value: string
  displayValue: string | null
  href: string | null
  onSave: (val: string) => void
  placeholder: string
  parse?: (stored: string) => string
  build?: (handle: string) => string
  renderDisplay?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(parse(value))

  if (editing) {
    return (
      <input
        className="bg-transparent border-b border-accent text-accent font-mono text-sm w-full outline-none"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const built = build(draft)
          if (built !== value) onSave(built)
          setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { const built = build(draft); if (built !== value) onSave(built); setEditing(false) }
          if (e.key === 'Escape') { setDraft(parse(value)); setEditing(false) }
        }}
        placeholder={placeholder}
        autoFocus
      />
    )
  }

  if (!displayValue) {
    return (
      <span
        className="text-border cursor-pointer hover:text-text-secondary"
        onClick={() => { setDraft(parse(value)); setEditing(true) }}
        title="Click to add"
      >
        —
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1 group">
      {renderDisplay ? (
        renderDisplay
      ) : href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate block">
          {displayValue}
        </a>
      ) : (
        <span className="text-white truncate block">{displayValue}</span>
      )}
      <button
        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-accent transition-opacity text-xs"
        onClick={() => { setDraft(parse(value)); setEditing(true) }}
        title="Edit"
      >
        ✎
      </button>
    </div>
  )
}

// Multiline inline editor for bios (paragraphs). ⌘/Ctrl+Enter or blur saves,
// Esc cancels, plain Enter inserts a newline. `className` tunes the text/edit box
// (e.g. scroll + max-height) so each admin surface keeps its own layout.
export function InlineTextEdit({
  value,
  onSave,
  className = '',
  placeholder = 'No bio — click to add',
}: {
  value: string | null
  onSave: (val: string) => void
  className?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  function commit() {
    const next = draft.trim()
    if (next !== (value ?? '').trim()) onSave(next)
    setEditing(false)
  }
  function cancel() {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        className={`w-full bg-surface border border-accent text-white font-mono text-xs leading-relaxed outline-none p-1.5 resize-y min-h-32 ${className}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        autoFocus
      />
    )
  }

  return (
    <div className="group relative">
      {value ? (
        <p className={`font-mono text-xs text-white leading-relaxed whitespace-pre-line ${className}`}>{value}</p>
      ) : (
        <p className="font-mono text-xs text-text-secondary italic">{placeholder}</p>
      )}
      <button
        className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-accent transition-opacity text-[11px] absolute top-0 right-0 bg-surface/80 px-1"
        onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        title="Edit (⌘/Ctrl+Enter to save · Esc to cancel)"
      >
        ✎ edit
      </button>
    </div>
  )
}

export function InlineLocationEdit({
  city,
  countryCode,
  onSave,
}: {
  city: string | null
  countryCode: string | null
  onSave: (city: string, countryCode: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftCity, setDraftCity] = useState(city ?? '')
  const [draftCountry, setDraftCountry] = useState(countryCode ?? '')

  function commit() {
    if (draftCity !== (city ?? '') || draftCountry !== (countryCode ?? '')) {
      onSave(draftCity, draftCountry)
    }
    setEditing(false)
  }

  function cancel() {
    setDraftCity(city ?? '')
    setDraftCountry(countryCode ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div
        className="flex items-center gap-1"
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) commit()
        }}
      >
        <input
          className="bg-transparent border-b border-accent text-accent font-mono text-sm w-20 outline-none"
          value={draftCity}
          onChange={e => setDraftCity(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          placeholder="City"
          autoFocus
        />
        <input
          className="bg-transparent border-b border-accent text-accent font-mono text-sm w-10 outline-none uppercase"
          value={draftCountry}
          onChange={e => setDraftCountry(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          placeholder="CC"
          maxLength={2}
        />
      </div>
    )
  }

  const display = [city, countryCode].filter(Boolean).join(', ')
  return (
    <span
      className="text-text-secondary cursor-pointer hover:text-accent"
      onClick={() => { setDraftCity(city ?? ''); setDraftCountry(countryCode ?? ''); setEditing(true) }}
      title="Click to edit"
    >
      {display || '—'}
    </span>
  )
}
