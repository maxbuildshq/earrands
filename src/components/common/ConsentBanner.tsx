import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import { Button } from '../ui/Button'
import { getConsent, setConsent, initMetaPixel, type Consent } from '../../lib/consent'

export function ConsentBanner() {
  const [choice, setChoice] = useState<Consent | null>(() => getConsent())

  useEffect(() => {
    if (choice === 'accepted') initMetaPixel()
  }, [choice])

  if (choice) return null

  const decide = (consent: Consent) => {
    setConsent(consent)
    posthog.capture('consent_choice', { choice: consent })
    setChoice(consent)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t-2 border-accent px-4 pt-4 pb-7">
      <p className="text-text-secondary text-sm leading-relaxed mb-3 max-w-xl mx-auto">
        An ads pixel helps us see what you're into.
      </p>
      <div className="flex gap-2 max-w-xl mx-auto">
        <Button variant="secondary" onClick={() => decide('declined')}>Decline</Button>
        <Button variant="primary" onClick={() => decide('accepted')}>Accept</Button>
      </div>
    </div>
  )
}
