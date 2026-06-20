import { useState } from 'react'
import { createPortal } from 'react-dom'
import posthog from 'posthog-js'
import { BottomSheet } from '../common/BottomSheet'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'

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
          <Button onClick={close} variant="primary" className="mt-5">Done</Button>
        </div>
      ) : (
        <div className="px-4 pb-8 pt-1 space-y-4">
          <div>
            <Label className="mb-2">How's it going?</Label>
            <div className="flex gap-2">
              {SENTIMENTS.map(s => (
                <Button
                  key={s}
                  type="button"
                  variant="choice"
                  active={sentiment === s}
                  fullWidth={false}
                  onClick={() => setSentiment(sentiment === s ? null : s)}
                  className="flex-1 py-2 px-2"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>What's working, what's missing?</Label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Tell us anything…"
              className="w-full bg-surface border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          {error && <div className="text-negative text-sm font-mono">{error}</div>}

          <Button onClick={submit} variant="primary">Send feedback</Button>
        </div>
      )}
    </BottomSheet>
  ) : null

  return (
    <>
      <Button variant="icon-bare" onClick={openSheet} title="Send feedback" aria-label="Send feedback">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 3.5h12v8H6l-3 2.5v-2.5H2v-8Z" strokeLinejoin="round" />
        </svg>
      </Button>

      {createPortal(sheet, document.body)}
    </>
  )
}
