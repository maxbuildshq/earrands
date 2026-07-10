import { useEffect, useMemo, useState } from 'react'
import { Heading } from '../ui/Heading'
import { Badge } from '../ui/Badge'
import { useUpdateSet } from '../../hooks/useAdminFestivals'
import type { SetWithStage, Stage } from '../../types/database'

type Link = { setId: string; name: string; role: string; isCollective: boolean }

// DB time is "HH:MM:SS" (nullable) — display as "HH:MM".
function toTimeInput(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

// Accepts "15:30" or "1530"; rejects anything else so a bad edit can be reverted.
function parseTime(input: string): string | null {
  const m = input.trim().match(/^([0-9]{1,2}):?([0-9]{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function TimeCell({ value, onSave, className }: { value: string | null; onSave: (v: string | null) => void; className: string }) {
  const initial = toTimeInput(value)
  const [draft, setDraft] = useState(initial)

  useEffect(() => setDraft(initial), [initial])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed === '') {
      if (initial !== '') onSave(null)
      return
    }
    const parsed = parseTime(trimmed)
    if (!parsed) {
      setDraft(initial)
      return
    }
    setDraft(parsed)
    if (parsed !== initial) onSave(parsed)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(initial); e.currentTarget.blur() }
      }}
      placeholder="HH:MM"
      className={className}
    />
  )
}

export function SetArtistCompare({ sets, stages, fill = false }: { sets: SetWithStage[]; stages: Stage[]; fill?: boolean }) {
  const [hoveredSetId, setHoveredSetId] = useState<string | null>(null)
  const [pinnedSetId, setPinnedSetId] = useState<string | null>(null)
  const updateSet = useUpdateSet()

  // Hover previews; a pinned set is the fallback when nothing is hovered.
  const activeSetId = hoveredSetId ?? pinnedSetId

  const sortedSets = useMemo(
    () => [...sets].sort((a, b) => a.artist_name.localeCompare(b.artist_name, undefined, { sensitivity: 'base' })),
    [sets],
  )

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order),
    [stages],
  )

  const links = useMemo<Link[]>(() =>
    sets.flatMap(s =>
      (s.set_artists ?? []).map(sa => ({
        setId: s.id,
        name: sa.artists.name,
        role: sa.role,
        isCollective: sa.artists.is_collective,
      })),
    ),
  [sets])

  const setToArtists = useMemo(() => {
    const map = new Map<string, Link[]>()
    for (const link of links) {
      const list = map.get(link.setId) ?? []
      list.push(link)
      map.set(link.setId, list)
    }
    return map
  }, [links])

  const artistToSetCount = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of links) {
      const ids = map.get(link.name) ?? new Set<string>()
      ids.add(link.setId)
      map.set(link.name, ids)
    }
    return map
  }, [links])

  const allArtists = useMemo(() => {
    const byName = new Map<string, { name: string; isCollective: boolean }>()
    for (const link of links) {
      if (!byName.has(link.name)) byName.set(link.name, { name: link.name, isCollective: link.isCollective })
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [links])

  // Right table: when a set is active, show only its artists (with roles); else all.
  const activeArtists = activeSetId ? (setToArtists.get(activeSetId) ?? []) : null

  function togglePin(setId: string) {
    setPinnedSetId(prev => (prev === setId ? null : setId))
  }

  const editClass = 'bg-transparent border border-border text-text-primary font-mono text-xs px-1 py-0.5 outline-none focus:border-accent'
  const tableWrapClass = fill
    ? 'border border-border overflow-y-auto flex-1 min-h-0'
    : 'border border-border overflow-y-auto max-h-[600px]'

  return (
    <div className={`grid grid-cols-[7fr_3fr] gap-4 ${fill ? 'h-full' : ''}`}>
      <section className={`border border-border p-4 space-y-3 ${fill ? 'flex flex-col h-full min-h-0' : ''}`}>
        <div className="flex items-center justify-between">
          <Heading variant="section">Sets ({sets.length})</Heading>
          {pinnedSetId && (
            <button
              className="font-mono text-xs text-accent hover:underline uppercase tracking-wider"
              onClick={() => setPinnedSetId(null)}
            >
              Clear pin
            </button>
          )}
        </div>
        <div className={tableWrapClass}>
          <table className="w-full font-mono text-sm">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="border-b border-border text-xs uppercase tracking-widest text-text-secondary">
                <th className="px-3 py-2 text-left">Set</th>
                <th className="px-3 py-2 text-left">Stage</th>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Day</th>
              </tr>
            </thead>
            <tbody>
              {sortedSets.map(s => {
                const pinned = pinnedSetId === s.id
                const active = activeSetId === s.id
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-border last:border-b-0 transition-colors ${active ? 'bg-surface-raised' : ''} ${pinned ? 'border-l-2 border-l-accent' : ''}`}
                    onMouseEnter={() => setHoveredSetId(s.id)}
                    onMouseLeave={() => setHoveredSetId(null)}
                  >
                    <td
                      className="px-3 py-2 text-text-primary cursor-pointer hover:text-accent"
                      onClick={() => togglePin(s.id)}
                      title="Click to pin this set's artists in the right table"
                    >
                      {s.artist_name}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={s.stage_id ?? ''}
                        onChange={e => updateSet.mutate({ setId: s.id, stage_id: e.target.value || null })}
                        className={editClass}
                      >
                        <option value="">—</option>
                        {sortedStages.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <TimeCell
                          value={s.start_time}
                          onSave={v => updateSet.mutate({ setId: s.id, start_time: v })}
                          className={`${editClass} w-12`}
                        />
                        <span className="text-text-secondary">–</span>
                        <TimeCell
                          value={s.end_time}
                          onSave={v => updateSet.mutate({ setId: s.id, end_time: v })}
                          className={`${editClass} w-12`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={s.day}
                        onChange={e => e.target.value && updateSet.mutate({ setId: s.id, day: e.target.value })}
                        className={editClass}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`border border-border p-4 space-y-3 ${fill ? 'flex flex-col h-full min-h-0' : ''}`}>
        <Heading variant="section">
          {activeArtists
            ? `Artists in set (${activeArtists.length})`
            : `Parsed Artists (${allArtists.length})`}
        </Heading>
        <div className={tableWrapClass}>
          <table className="w-full font-mono text-sm">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="border-b border-border text-xs uppercase tracking-widest text-text-secondary">
                <th className="px-3 py-2 text-left">Artist</th>
                <th className="px-3 py-2 text-left">{activeArtists ? 'Role' : 'Sets'}</th>
              </tr>
            </thead>
            <tbody>
              {activeArtists ? (
                activeArtists.map((a, i) => (
                  <tr key={`${a.name}-${i}`} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-text-primary">
                      {a.name}
                      {a.isCollective && <Badge variant="accent-outline" className="ml-2">collective</Badge>}
                    </td>
                    <td className="px-3 py-2 text-accent">‹{a.role}›</td>
                  </tr>
                ))
              ) : (
                allArtists.map(a => (
                  <tr key={a.name} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-text-primary">
                      {a.name}
                      {a.isCollective && <Badge variant="accent-outline" className="ml-2">collective</Badge>}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{artistToSetCount.get(a.name)?.size ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
