const CONSENT_KEY = 'earrands-consent'
const META_PIXEL_ID = '912561041880588'

export type Consent = 'accepted' | 'declined'

export function getConsent(): Consent | null {
  const value = localStorage.getItem(CONSENT_KEY)
  return value === 'accepted' || value === 'declined' ? value : null
}

export function setConsent(consent: Consent) {
  localStorage.setItem(CONSENT_KEY, consent)
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean }
    _fbq?: unknown
  }
}

// Injects the Meta pixel and fires PageView. Idempotent. Only ever called
// after the user accepted tracking — never load this unconditionally.
export function initMetaPixel() {
  if (window.fbq) return
  const queue: unknown[] = []
  const fbq: Window['fbq'] = (...args: unknown[]) => {
    queue.push(args)
  }
  fbq.queue = queue
  fbq.loaded = true
  window.fbq = fbq
  window._fbq = fbq
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  window.fbq('init', META_PIXEL_ID)
  window.fbq('track', 'PageView')
}

export function trackMetaLead() {
  window.fbq?.('track', 'Lead')
}
