export type Role = 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'

export type ParseResult = {
  collective: string | null
  members: string[]
  role: Role
}

// Real-world duos whose name legitimately contains " & " and must never be
// split into two separate artists, in any context (solo, B2B chain, collab, etc).
// e.g. "Camo & Krooked" → stays one artist, not ["Camo", "Krooked"]
const KNOWN_DUOS = [
  'Camo & Krooked',
  'Pola & Bryson',
  'Ed Rush & Optical',
  'Black Sun Empire',
]

// Parenthetical content matching this is a show/set descriptor, not a list of
// collaborators — e.g. "(140 Set)", "(DJ Set)", "(opening ceremony)". Parens matching
// this are stripped rather than parsed as member lists.
const DESCRIPTOR_KEYWORDS = /\b(set|fka|takeover|q&a|classics|groove|house|disco|hip hop|acid|alternative|liquid|rave|half-time|trip hop|downtempo|ukg|140|dj set|vocal|roots2jungle|microfunk|years|hour|2000-2010|opening ceremony|closing ceremony)\b/i

function isDescriptorParen(content: string): boolean {
  return DESCRIPTOR_KEYWORDS.test(content)
}

// e.g. "James Holden & Surgeon (opening ceremony)" → "James Holden & Surgeon"
// e.g. "Savannah (140 Set)" → "Savannah"
// e.g. "Collabs 3000 (Chris Liebing & Speedy J)" → unchanged (not a descriptor)
function stripDescriptorParens(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, (match) => {
    return isDescriptorParen(match) ? '' : match
  }).trim()
}

// e.g. "Unglued B2B Camo & Krooked" → "Unglued B2B __DUO0__" (duos map: __DUO0__ → "Camo & Krooked")
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

// e.g. ["Unglued", "__DUO0__"] + (__DUO0__ → "Camo & Krooked") → ["Unglued", "Camo & Krooked"]
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
//
// This is the drum'n'bass B2B+MC convention: a trailing "A & B" after a role separator
// commonly means a further billed performer — often an MC — rather than a second B2B
// pairing. e.g. "Unglued B2B Degs & Ruthless" — Unglued and Degs play B2B together, and
// Ruthless MCs over the set. All three are distinct performers, so splitting into three
// separate artist records (all tagged with the surrounding role, here 'b2b') is correct.
// e.g. "Unglued B2B Degs & Ruthless" → ["Unglued", "Degs", "Ruthless"]
// e.g. "Unglued B2B Camo & Krooked" → ["Unglued", "Camo & Krooked"] (KNOWN_DUOS exception)
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
  // e.g. "Moderat (live)" → "Moderat"
  name = name.replace(/\s*\(live\)$/i, '').trim()
  // e.g. "Band Live w/ Vocalist A" → "Band w/ Vocalist A" (strip "Live" before a qualifier)
  name = name.replace(/\s+live\s*(?=\s*[\(w])/i, ' ').trim()
  // e.g. "Moderat Live" → "Moderat"
  name = name.replace(/\s+live$/i, '').trim()

  // Strip descriptor parens for parsing (but the display name keeps them)
  // e.g. "Nu:Tone (Soul & Rare Groove Set)" → "Nu:Tone"
  const parseName = stripDescriptorParens(name)

  // "hosted by <MC>" — split main act from MC
  // e.g. "Serum hosted by Carasel" → collective: null, members: ["Serum", "Carasel"], role: "member"
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

  // "<artist(s)> presents/present/debuts <show concept>" — the part after the verb is a
  // show concept, not a collaborator, so drop it and re-parse the artist part on its own.
  // Recursing on the left side (rather than just returning it as a single solo name) means
  // a compound presenter is still split correctly.
  // e.g. "A Guy Called Gerald presents Black Secret Technology" → members: ["A Guy Called Gerald"], role: "solo"
  // e.g. "Jeff Mills debuts STARGATE" → members: ["Jeff Mills"], role: "solo"
  // e.g. "James Holden & Surgeon present Group Therapy" → members: ["James Holden", "Surgeon"], role: "collab"
  const presentsMatch = parseName.match(/^(.+?)\s+(?:presents?|debuts?)\s+.+$/i)
  if (presentsMatch) {
    return parseArtistName(presentsMatch[1].trim())
  }

  // Colon format — only when ": " is followed by a comma-separated list
  // e.g. "LSD: Luke Slater, Steve Bicknell and Function" → collective: "LSD", members: [...], role: "member"
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
  // e.g. "Collabs 3000 (Chris Liebing & Speedy J)" → collective: "Collabs 3000", members: ["Chris Liebing", "Speedy J"]
  // e.g. "Run In The Jungle (T>I & D*Minds) & Carasel" → collective: "Run In The Jungle", members: ["T>I", "D*Minds", "Carasel"]
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

  // e.g. "STOOR w/ Aurora Halal, Azu Tiwaline, Barker" → collective: "STOOR", members: [...]
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
  // e.g. "Underground Resistance featuring Saul Williams" → collective: "Underground Resistance", members: ["Saul Williams"]
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

  // e.g. "Artist A F2F Artist B" → members: ["Artist A", "Artist B"], role: "f2f"
  if (/ f2f /i.test(parseName)) {
    const members = parseName.split(/ f2f /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(members), role: 'f2f' }
  }

  // e.g. "Unglued B2B Degs & Ruthless" → members: ["Unglued", "Degs", "Ruthless"], role: "b2b"
  if (/ b2b /i.test(parseName)) {
    const { name: protectedName, duos } = protectKnownDuos(parseName)
    const members = protectedName.split(/ b2b /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(restoreDuos(members, duos)), role: 'b2b' }
  }

  // e.g. "DJ A vs DJ B" → members: ["DJ A", "DJ B"], role: "vs"
  if (/ vs /i.test(parseName)) {
    const members = parseName.split(/ vs /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(members), role: 'vs' }
  }

  // e.g. "P Money X Whiney" → members: ["P Money", "Whiney"], role: "collab" (won't match "DAX J", no surrounding spaces)
  if (/ x /i.test(parseName)) {
    const members = parseName.split(/ x /i).map(s => s.trim())
    return { collective: null, members: expandAmpersands(members), role: 'collab' }
  }

  // e.g. "Alarico & Ben Klock" → members: ["Alarico", "Ben Klock"], role: "collab"
  if (/ & /.test(parseName)) {
    const { name: protectedName, duos } = protectKnownDuos(parseName)
    if (/ & /.test(protectedName)) {
      const members = protectedName.split(' & ').map(s => s.trim())
      return { collective: null, members: restoreDuos(members, duos), role: 'collab' }
    }
    // Only known duos left — solo
    // e.g. "Camo & Krooked" → members: ["Camo & Krooked"], role: "solo"
    return { collective: null, members: [parseName], role: 'solo' }
  }

  // No separators matched — a single solo artist
  // e.g. "Ben UFO" → members: ["Ben UFO"], role: "solo"
  return { collective: null, members: [parseName], role: 'solo' }
}
