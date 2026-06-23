export type Role = 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'

export type ParseResult = {
  collective: string | null
  members: string[]
  role: Role
}

const KNOWN_DUOS = [
  'Camo & Krooked',
  'Pola & Bryson',
  'Ed Rush & Optical',
  'Black Sun Empire',
]

const DESCRIPTOR_KEYWORDS = /\b(set|fka|takeover|q&a|classics|groove|house|disco|hip hop|acid|alternative|liquid|rave|half-time|trip hop|downtempo|ukg|140|dj set|vocal|roots2jungle|microfunk|years|hour|2000-2010)\b/i

function isDescriptorParen(content: string): boolean {
  return DESCRIPTOR_KEYWORDS.test(content)
}

function stripDescriptorParens(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, (match) => {
    return isDescriptorParen(match) ? '' : match
  }).trim()
}

function protectKnownDuos(name: string): { name: string; duos: Map<string, string> } {
  const duos = new Map<string, string>()
  let result = name
  for (const duo of KNOWN_DUOS) {
    const regex = new RegExp(duo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const match = result.match(regex)
    if (match) {
      const placeholder = `__DUO${duos.size}__`
      duos.set(placeholder, match[0])
      result = result.replace(match[0], placeholder)
    }
  }
  return { name: result, duos }
}

function restoreDuos(members: string[], duos: Map<string, string>): string[] {
  return members.map(m => {
    for (const [placeholder, original] of duos) {
      m = m.replace(placeholder, original)
    }
    return m.trim()
  }).filter(Boolean)
}

// After splitting on a role separator (b2b/f2f/vs/x), a resulting member can still
// contain an unprotected " & " (e.g. "Degs & Ruthless" inside "Unglued B2B Degs & Ruthless").
// Split those out too, unless the pair is a KNOWN_DUOS exception.
function expandAmpersands(members: string[]): string[] {
  return members.flatMap(member => {
    const { name: protectedName, duos } = protectKnownDuos(member)
    if (/ & /.test(protectedName)) {
      const parts = protectedName.split(' & ').map(s => s.trim()).filter(Boolean)
      return restoreDuos(parts, duos)
    }
    return [member]
  })
}

export function parseArtistName(raw: string): ParseResult {
  let name = raw.trim()
  name = name.replace(/\s*\(live\)$/i, '').trim()
  name = name.replace(/\s+live\s*(?=\s*[\(w])/i, ' ').trim()
  name = name.replace(/\s+live$/i, '').trim()

  // Strip descriptor parens for parsing (but the display name keeps them)
  const parseName = stripDescriptorParens(name)

  // "hosted by <MC>" — split main act from MC
  const hostedMatch = parseName.match(/^(.+?)\s+hosted by\s+(.+)$/i)
  if (hostedMatch) {
    const mainPart = hostedMatch[1].trim()
    const mc = hostedMatch[2].trim()
    const mainResult = parseArtistName(mainPart)
    return {
      collective: mainResult.collective,
      members: [...mainResult.members, mc],
      role: mainResult.role === 'solo' ? 'member' : mainResult.role,
    }
  }

  // Colon format — only when ": " is followed by a comma-separated list
  const colonIdx = parseName.indexOf(': ')
  if (colonIdx > 0 && colonIdx <= parseName.length / 2) {
    const remainder = parseName.slice(colonIdx + 2).trim()
    if (remainder.includes(',') || / and /i.test(remainder)) {
      const collective = parseName.slice(0, colonIdx).trim()
      const members = remainder
        .replace(/ and /g, ', ')
        .split(', ')
        .map(s => s.trim())
        .filter(Boolean)
      return { collective, members, role: 'member' }
    }
  }

  // Parenthetical members (only when content has , or & and is NOT a descriptor)
  // Also handles trailing "& Extra" after the closing paren
  const parenMatch = parseName.match(/^(.+?)\s*\((.+)\)(.*)$/)
  if (parenMatch && /[,&]| b2b | f2f /i.test(parenMatch[2]) && !isDescriptorParen(parenMatch[2])) {
    const collective = parenMatch[1].trim()
    const trailing = parenMatch[3].trim()
    const { name: protectedMembers, duos } = protectKnownDuos(parenMatch[2])
    const members = protectedMembers
      .replace(/ b2b /gi, ', ')
      .replace(/ f2f /gi, ', ')
      .replace(/ & /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    const result = restoreDuos(members, duos)
    if (trailing) {
      const extras = trailing.replace(/^& /, '').split(' & ').map(s => s.trim()).filter(Boolean)
      result.push(...extras)
    }
    return { collective, members: result, role: 'member' }
  }

  if (/ w\/ /.test(parseName)) {
    const wIdx = parseName.search(/ w\/ /)
    const collective = parseName.slice(0, wIdx).trim()
    const remainder = parseName.slice(wIdx + 4).trim()
    const members = remainder
      .replace(/ & /g, ', ')
      .replace(/ and /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective, members, role: 'member' }
  }

  // featuring / feat. / ft.
  if (/ (?:featuring|feat\.|ft\.?) /i.test(parseName)) {
    const [collective, ...rest] = parseName.split(/ (?:featuring|feat\.|ft\.?) /i)
    const remainder = rest.join(' ')
    const members = remainder
      .replace(/ & /g, ', ')
      .replace(/ and /g, ', ')
      .split(', ')
      .map(s => s.trim())
      .filter(Boolean)
    return { collective: collective.trim(), members, role: 'member' }
  }

  if (/ f2f /i.test(parseName)) {
    const members = parseName.split(/ f2f /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(members), role: 'f2f' }
  }

  if (/ b2b /i.test(parseName)) {
    const { name: protectedName, duos } = protectKnownDuos(parseName)
    const members = protectedName.split(/ b2b /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(restoreDuos(members, duos)), role: 'b2b' }
  }

  if (/ vs /i.test(parseName)) {
    const members = parseName.split(/ vs /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(members), role: 'vs' }
  }

  if (/ x /i.test(parseName)) {
    const members = parseName.split(/ x /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(members), role: 'collab' }
  }

  if (/ & /.test(parseName)) {
    const { name: protectedName, duos } = protectKnownDuos(parseName)
    if (/ & /.test(protectedName)) {
      const members = protectedName.split(' & ').map(s => s.trim())
      return { collective: null, members: restoreDuos(members, duos), role: 'collab' }
    }
    // Only known duos left — solo
    return { collective: null, members: [parseName], role: 'solo' }
  }

  return { collective: null, members: [parseName], role: 'solo' }
}
