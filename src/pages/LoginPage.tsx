import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import posthog from 'posthog-js'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Heading } from '../components/ui/Heading'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      posthog.captureException(error, { feature: 'login' })
      setError(error.message)
      setLoading(false)
    } else {
      posthog.identify(email, { email })
      posthog.capture('user_signed_in')
      navigate(returnTo, { replace: true })
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        <Heading variant="page" className="mb-8">LOGIN</Heading>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div className="text-negative text-sm font-mono">{error}</div>}

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </Button>
        </form>

        <p className="mt-6 text-text-secondary text-base text-center font-mono">
          No account?{' '}
          <Link to="/signup" className="text-accent font-bold uppercase tracking-wider hover:text-accent-dim transition-colors">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
