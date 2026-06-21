import { supabase } from './supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''

export async function checkAdminAccess(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/admin-auth`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.isAdmin === true
  } catch {
    return false
  }
}

export async function adminFetch<T = unknown>(
  functionName: string,
  options: {
    method?: string
    body?: unknown
    params?: Record<string, string>
  } = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Admin API error ${res.status}: ${text}`)
  }
  return res.json()
}
