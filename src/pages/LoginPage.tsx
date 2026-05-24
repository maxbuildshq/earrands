import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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
      setError(error.message)
      setLoading(false)
    } else {
      navigate(returnTo, { replace: true })
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-mono font-bold text-2xl text-acid mb-8 tracking-tight">LOGIN</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm mb-1 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-surface-raised border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-acid transition-colors"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-surface-raised border border-border text-text-primary px-3 py-2.5 text-base outline-none focus:border-acid transition-colors"
            />
          </div>

          {error && (
            <div className="text-live text-sm font-mono">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-acid text-surface font-mono font-bold py-2.5 text-sm uppercase tracking-wider hover:bg-acid-dim transition-colors disabled:opacity-50"
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <p className="mt-6 text-text-secondary text-sm text-center">
          No account?{' '}
          <Link to="/signup" className="text-acid hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
