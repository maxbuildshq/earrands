import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import posthog from 'posthog-js'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Heading } from '../components/ui/Heading'

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password, { marketingConsent: marketing })
    if (error) {
      posthog.captureException(error, { feature: 'signup' })
      setError(error.message)
      setLoading(false)
    } else {
      posthog.capture('user_signed_up', { email, marketing_consent: marketing })
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-sm text-center">
          <Heading variant="page" className="mb-4">CHECK YOUR EMAIL</Heading>
          <p className="font-mono text-text-secondary mb-6">
            We sent a confirmation link to <span className="text-text-primary">{email}</span>.
            Click it to activate your account.
          </p>
          <Link to="/login" className="text-accent font-mono font-bold text-sm uppercase tracking-wider hover:text-accent-dim transition-colors">BACK TO LOGIN</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        <Heading variant="page" className="mb-8">SIGN UP</Heading>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} />
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={marketing}
              onChange={e => setMarketing(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-accent"
            />
            <span className="text-text-secondary text-xs leading-relaxed">
              Email me occasional updates worth reading — new festivals and major features. No spam, unsubscribe anytime.
            </span>
          </label>

          {error && <div className="text-negative text-sm font-mono">{error}</div>}

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </Button>
        </form>

        <p className="mt-6 text-text-secondary text-sm text-center font-mono">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-bold uppercase tracking-wider hover:text-accent-dim transition-colors">Log in</Link>
        </p>
      </div>
    </div>
  )
}
