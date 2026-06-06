import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFestivalRequests } from '../../hooks/useFestivalRequests'
import { BottomSheet } from '../common/BottomSheet'
import { AuthPrompt } from '../common/AuthPrompt'

type Props = {
  onClose: () => void
}

export function RequestFestivalSheet({ onClose }: Props) {
  const { user } = useAuth()
  const { submitRequest, isSubmitting } = useFestivalRequests()
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!user) {
    return (
      <BottomSheet title="REQUEST A FESTIVAL" onClose={onClose}>
        <AuthPrompt message="Create an account to request a festival. We'll email you if we add it to earrands." />
      </BottomSheet>
    )
  }

  if (done) {
    return (
      <BottomSheet title="REQUEST SENT" onClose={onClose}>
        <div className="px-4 pb-8 pt-1">
          <p className="text-text-primary text-sm leading-relaxed">
            Thanks — we've logged your request. If we add it, we'll email you.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full bg-acid text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors"
          >
            Done
          </button>
        </div>
      </BottomSheet>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Enter a festival name')
      return
    }
    try {
      await submitRequest({ rawName: name, region })
      setDone(true)
    } catch {
      setError('Something went wrong. Try again.')
    }
  }

  return (
    <BottomSheet title="REQUEST A FESTIVAL" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-4 pb-8 pt-1 space-y-4">
        <div>
          <label className="block text-text-secondary text-sm mb-1 uppercase tracking-wider">Festival name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Time Warp"
            className="w-full bg-surface border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-acid transition-colors"
          />
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1 uppercase tracking-wider">
            Where are you based? <span className="normal-case text-text-secondary/60">(optional)</span>
          </label>
          <input
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g. Amsterdam"
            className="w-full bg-surface border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-acid transition-colors"
          />
          <p className="text-text-secondary/70 text-xs mt-1">Help us prioritize events near you.</p>
        </div>

        {error && <div className="text-live text-sm font-mono">{error}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-acid text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'SENDING...' : 'SEND REQUEST'}
        </button>
      </form>
    </BottomSheet>
  )
}
