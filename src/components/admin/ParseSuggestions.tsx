import { useMemo } from 'react'
import { Heading } from '../ui/Heading'
import { Badge } from '../ui/Badge'
import { useParseSuggestions, useReviewSuggestion } from '../../hooks/useAdminFestivals'
import type { ParseSuggestion } from '../../types/database'

const CONFIDENCE_ORDER: ParseSuggestion['confidence'][] = ['high', 'medium', 'low']

function formatParse(p: { collective: string | null; members: string[] }): string {
  return p.collective ? `[${p.collective}] ${p.members.join(' · ')}` : p.members.join(' · ')
}

/**
 * Parsing-arbiter review panel (Phase 2b). Suggestions are written by
 * `parse-artists --arbiter`; accept/dismiss here only flips status — the
 * accepted parse is applied to set_artists by the next arbiter run.
 * Renders nothing when the festival has no suggestions.
 */
export function ParseSuggestions({ festivalId }: { festivalId: string }) {
  const { data: suggestions = [] } = useParseSuggestions(festivalId)
  const review = useReviewSuggestion()

  const pending = useMemo(
    () => suggestions.filter(s => s.status === 'pending'),
    [suggestions],
  )
  const reviewed = suggestions.length - pending.length

  if (suggestions.length === 0) return null

  const actionClass = 'font-mono text-xs uppercase tracking-wider hover:underline'

  return (
    <section className="border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Heading variant="section">Parse suggestions ({pending.length})</Heading>
        {reviewed > 0 && (
          <span className="font-mono text-xs text-text-secondary uppercase tracking-wider">
            {reviewed} reviewed
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="font-mono text-sm text-text-secondary">All suggestions reviewed. Accepted parses apply on the next parse-artists --arbiter run.</p>
      ) : (
        <div className="space-y-2">
          {CONFIDENCE_ORDER.flatMap(conf =>
            pending.filter(s => s.confidence === conf).map(s => (
              <div key={s.id} className="border border-border p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={conf === 'high' ? 'accent' : conf === 'medium' ? 'accent-outline' : 'outline'}>
                    {conf}
                  </Badge>
                  <span className="font-mono text-sm text-text-primary">{s.raw_name}</span>
                </div>
                <p className="font-mono text-xs text-text-secondary">
                  {formatParse(s.current_parse)} → <span className="text-accent">{formatParse(s.suggested)}</span>
                </p>
                <p className="font-mono text-xs text-text-secondary">
                  {s.reason}{s.detector_reasons.length > 0 && ` — flagged: ${s.detector_reasons.join('; ')}`}
                </p>
                <div className="flex gap-4 pt-1">
                  <button
                    className={`${actionClass} text-accent`}
                    onClick={() => review.mutate({ suggestionId: s.id, status: 'accepted' })}
                    disabled={review.isPending}
                  >
                    Accept
                  </button>
                  <button
                    className={`${actionClass} text-text-secondary`}
                    onClick={() => review.mutate({ suggestionId: s.id, status: 'dismissed' })}
                    disabled={review.isPending}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )),
          )}
        </div>
      )}
    </section>
  )
}
