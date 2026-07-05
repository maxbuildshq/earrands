import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFestivalRequests } from '../../hooks/useFestivalRequests'
import { BottomSheet } from '../common/BottomSheet'
import { AuthPrompt } from '../common/AuthPrompt'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'

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
        <AuthPrompt source="request" message="Create an account to request a festival. We'll email you if we add it to earrands." />
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
          <Button onClick={onClose} variant="primary" className="mt-5">Done</Button>
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
          <Label htmlFor="festival-name">Festival name</Label>
          <Input
            id="festival-name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Time Warp"
          />
        </div>

        <div>
          <Label htmlFor="festival-region">
            Where are you based? <span className="normal-case text-text-secondary/60">(optional)</span>
          </Label>
          <Input
            id="festival-region"
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g. Amsterdam"
          />
          <p className="text-text-secondary/70 text-xs mt-1">Help us prioritize events near you.</p>
        </div>

        {error && <div className="text-negative text-sm font-mono">{error}</div>}

        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'SENDING...' : 'SEND REQUEST'}
        </Button>
      </form>
    </BottomSheet>
  )
}
