import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-mono font-bold text-2xl text-acid mb-4 tracking-tight">CHECK YOUR EMAIL</h1>
          <p className="text-text-secondary mb-6">
            We sent a confirmation link to <span className="text-text-primary">{email}</span>.
            Click it to activate your account.
          </p>
          <Link to="/login" className="text-acid hover:underline text-sm font-mono">BACK TO LOGIN</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-mono font-bold text-2xl text-acid mb-8 tracking-tight">SIGN UP</h1>

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

          <div>
            <label className="block text-text-secondary text-sm mb-1 uppercase tracking-wider">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="mt-6 text-text-secondary text-sm text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-acid hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
