import { useState } from 'react'
import type { Festival, SetWithStage } from '../../types/database'
import { useAuth } from '../../hooks/useAuth'
import { GoingToggle } from '../actions/GoingToggle'
import { FollowButton } from '../festival/FollowButton'
import { Badge } from '../ui/Badge'
import { SetSheet } from './SetSheet'
import { imageCrossOrigin } from '../../lib/images'

type Props = {
  festival: Festival
  sets: SetWithStage[]
  day: string
  isGoing: (id: string) => boolean
  onToggleGoing: (id: string) => void
}

function getLeadImage(set: SetWithStage): string | null {
  const artists = set.set_artists
  if (!artists || artists.length === 0) return null
  const sorted = [...artists].sort((a, b) => a.billing_order - b.billing_order)
  return sorted[0].artists.image_url
}

export function LineupView({ festival, sets, day, isGoing, onToggleGoing }: Props) {
  const { user } = useAuth()
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)

  const daySets = sets
    .filter(s => s.day === day)
    .sort((a, b) => a.artist_name.localeCompare(b.artist_name))

  const selectedSet = daySets.find(s => s.id === selectedSetId) ?? null

  return (
    <div className="mt-3">
      <div className="mb-4">
        <FollowButton festivalId={festival.id} variant="banner" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-sm text-text-secondary uppercase tracking-wider">
            {daySets.length} artists
          </span>
          <span className="font-mono text-sm text-accent/70 uppercase tracking-wider">
            Timetable TBA
          </span>
        </div>

        {daySets.map(set => {
          const leadImage = set.is_music_set ? getLeadImage(set) : null
          return (
            <div
              key={set.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedSetId(set.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSetId(set.id) } }}
              className="flex items-center justify-between gap-3 bg-surface-raised border border-border p-3 cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {leadImage && (
                  <img
                    src={leadImage}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                    crossOrigin={imageCrossOrigin(leadImage)}
                    loading="lazy"
                  />
                )}
                <span className="font-mono font-bold text-base text-text-primary truncate">
                  {set.artist_name}
                </span>
                {set.performance_type && (
                  <Badge variant="live" className="shrink-0 text-white">{set.performance_type === 'hybrid' ? 'Hybrid' : 'Live'}</Badge>
                )}
              </div>

              {user && (
                <div className="shrink-0" onClick={e => e.stopPropagation()}>
                  <GoingToggle isGoing={isGoing(set.id)} onToggle={() => onToggleGoing(set.id)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedSet && (
        <SetSheet
          set={selectedSet}
          isGoing={isGoing(selectedSet.id)}
          rating={null}
          onToggleGoing={() => onToggleGoing(selectedSet.id)}
          onRate={() => {}}
          onClose={() => setSelectedSetId(null)}
          showRating={false}
        />
      )}
    </div>
  )
}
