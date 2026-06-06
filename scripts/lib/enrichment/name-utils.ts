export function buildSearchQuery(artistName: string, site: string): string {
  const cleaned = cleanArtistName(artistName)
  return `"${cleaned}" dj music site:${site}`
}

export function cleanArtistName(name: string): string {
  return name
    .replace(/\s*\(live\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    let path = u.pathname.replace(/\/+$/, '')
    return `${u.protocol}//${u.hostname}${path}`
  } catch {
    return url
  }
}

export function normalizeSoundCloudUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'm.soundcloud.com') {
      u.hostname = 'soundcloud.com'
    }
    return normalizeUrl(u.toString())
  } catch {
    return url
  }
}

export function extractSoundCloudUsername(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('soundcloud.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[0] || null
  } catch {
    return null
  }
}

export function extractInstagramHandle(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('instagram.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[0] || null
  } catch {
    return null
  }
}

export function isSoundCloudProfileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('soundcloud.com')) return false
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length === 1 && !['discover', 'search', 'stream', 'you', 'charts', 'pages'].includes(parts[0])
  } catch {
    return false
  }
}

export function isInstagramProfileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('instagram.com')) return false
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length === 1 && !['explore', 'reels', 'stories', 'accounts', 'p', 'tv'].includes(parts[0])
  } catch {
    return false
  }
}

export function isComboEntry(sortName: string, isCollective: boolean): boolean {
  if (isCollective) return false
  return / & /i.test(sortName) || / b2b /i.test(sortName) || / vs /i.test(sortName) || / f2f /i.test(sortName)
}
