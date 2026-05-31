import { useState } from 'react'
import { createPortal } from 'react-dom'
import posthog from 'posthog-js'
import { BottomSheet } from '../common/BottomSheet'

const SENTIMENTS = ['Love it', 'Fine', 'Frustrating'] as const

// PostHog Survey ID — "App Feedback" survey (type: api, created 2026-05-30).
// Responses appear in PostHog → Surveys dashboard with aggregation + sentiment breakdown.
// Q0 (single_choice): sentiment  → $survey_response
// Q1 (open):          message    → $survey_response_1
const SURVEY_ID = '019e7b41-e48d-0000-2d3b-7c64d86e98ca'

/**
 * User-initiated feedback. Opens a short 2-question micro-survey.
 * Responses go to PostHog Surveys (appear in the Surveys dashboard).
 * Portalled to document.body to escape the header's backdrop-filter stacking context.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const openSheet = () => {
    setOpen(true)
    posthog.capture('survey shown', { $survey_id: SURVEY_ID })
  }

  const close = () => {
    if (!done) posthog.capture('survey dismissed', { $survey_id: SURVEY_ID })
    setOpen(false)
    setSentiment(null)
    setMessage('')
    setError('')
    setDone(false)
  }

  const submit = () => {
    if (!message.trim() && !sentiment) {
      setError('Add a note or pick an option')
      return
    }
    posthog.capture('survey sent', {
      $survey_id: SURVEY_ID,
      $survey_response: sentiment ?? '',
      $survey_response_1: message.trim(),
    })
    setDone(true)
  }

  const sheet = open ? (
    <BottomSheet title={done ? 'THANKS' : 'FEEDBACK'} onClose={close}>
      {done ? (
        <div className="px-4 pb-8 pt-1">
          <p className="text-text-primary text-sm leading-relaxed">Got it — thank you. We read every note.</p>
          <button
            onClick={close}
            className="mt-5 w-full bg-acid text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="px-4 pb-8 pt-1 space-y-4">
          <div>
            <span className="block text-text-secondary text-sm mb-2 uppercase tracking-wider">How's it going?</span>
            <div className="flex gap-2">
              {SENTIMENTS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSentiment(sentiment === s ? null : s)}
                  className={`flex-1 py-2 px-2 font-mono text-xs uppercase tracking-wider border transition-colors ${
                    sentiment === s
                      ? 'bg-acid text-surface border-acid'
                      : 'bg-surface text-text-secondary border-border hover:border-text-secondary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1 uppercase tracking-wider">What's working, what's missing?</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Tell us anything…"
              className="w-full bg-surface border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-acid transition-colors resize-none"
            />
          </div>

          {error && <div className="text-live text-sm font-mono">{error}</div>}

          <button
            onClick={submit}
            className="w-full bg-acid text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors"
          >
            Send feedback
          </button>
        </div>
      )}
    </BottomSheet>
  ) : null

  return (
    <>
      <button
        onClick={openSheet}
        title="Send feedback"
        aria-label="Send feedback"
        className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 3.5h12v8H6l-3 2.5v-2.5H2v-8Z" strokeLinejoin="round" />
        </svg>
      </button>

      {createPortal(sheet, document.body)}
    </>
  )
}
