export type Role = 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'

export type ParseResult = {
  collective: string | null
  members: string[]
  role: Role
}

export function parseArtistName(raw: string): ParseResult {
  let name = raw.trim()
  name = name.replace(/\s*\(live\)$/i, '').trim()
  name = name.replace(/\s+live\s*(?=\s*[\(w])/i, ' ').trim()
  name = name.replace(/\s+live$/i, '').trim()

  const colonIdx = name.indexOf(':')
  if (colonIdx > 0 && colonIdx <= name.length / 2) {
    const collective = name.slice(0, colonIdx).trim()
    const remainder = name.slice(colonIdx + 1).trim()
    const members = remainder
      .replace(/ and /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective, members, role: 'member' }
  }

  const parenMatch = name.match(/^(.+?)\s*\((.+)\)$/)
  if (parenMatch && /[,&]/.test(parenMatch[2])) {
    const collective = parenMatch[1].trim()
    const members = parenMatch[2]
      .replace(/ & /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective, members, role: 'member' }
  }

  if (/ w\/ /.test(name)) {
    const wIdx = name.search(/ w\/ /)
    const collective = name.slice(0, wIdx).trim()
    const remainder = name.slice(wIdx + 4).trim()
    const members = remainder
      .replace(/ & /g, ', ')
      .replace(/ and /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective, members, role: 'member' }
  }

  if (/ featuring /i.test(name)) {
    const [collective, ...rest] = name.split(/ featuring /i)
    const remainder = rest.join(' featuring ')
    const members = remainder
      .replace(/ & /g, ', ')
      .replace(/ and /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective: collective.trim(), members, role: 'member' }
  }

  if (/ f2f /i.test(name)) {
    const members = name.split(/ f2f /i).map(s => s.trim())
    return { collective: null, members, role: 'f2f' }
  }

  if (/ b2b /i.test(name)) {
    const members = name.split(/ b2b /i).map(s => s.trim())
    return { collective: null, members, role: 'b2b' }
  }

  if (name.includes(' vs ')) {
    const members = name.split(' vs ').map(s => s.trim())
    return { collective: null, members, role: 'vs' }
  }

  if (name.includes(' x ')) {
    const members = name.split(' x ').map(s => s.trim())
    return { collective: null, members, role: 'collab' }
  }

  if (name.includes(' & ')) {
    const members = name.split(' & ').map(s => s.trim())
    return { collective: null, members, role: 'collab' }
  }

  return { collective: null, members: [name], role: 'solo' }
}
