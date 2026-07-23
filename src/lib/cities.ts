// Curated electronic-music hub cities → properly-cased name + ISO 3166-1 alpha-2
// country code. Powers the admin location autocomplete: fixes casing, auto-fills
// the country code, and offers a quick-pick of the busiest hubs. Not exhaustive —
// unknown cities fall back to title-casing with a manual country code.

export type City = { city: string; country_code: string }

// Ordered roughly by how often they show up in festival lineups.
export const CITIES: City[] = [
  { city: 'Berlin', country_code: 'DE' },
  { city: 'Amsterdam', country_code: 'NL' },
  { city: 'London', country_code: 'GB' },
  { city: 'Paris', country_code: 'FR' },
  { city: 'Barcelona', country_code: 'ES' },
  { city: 'Madrid', country_code: 'ES' },
  { city: 'Rotterdam', country_code: 'NL' },
  { city: 'Hamburg', country_code: 'DE' },
  { city: 'Cologne', country_code: 'DE' },
  { city: 'Frankfurt', country_code: 'DE' },
  { city: 'Munich', country_code: 'DE' },
  { city: 'Leipzig', country_code: 'DE' },
  { city: 'Stuttgart', country_code: 'DE' },
  { city: 'Vienna', country_code: 'AT' },
  { city: 'Zurich', country_code: 'CH' },
  { city: 'Geneva', country_code: 'CH' },
  { city: 'Brussels', country_code: 'BE' },
  { city: 'Antwerp', country_code: 'BE' },
  { city: 'Ghent', country_code: 'BE' },
  { city: 'Milan', country_code: 'IT' },
  { city: 'Rome', country_code: 'IT' },
  { city: 'Naples', country_code: 'IT' },
  { city: 'Lisbon', country_code: 'PT' },
  { city: 'Porto', country_code: 'PT' },
  { city: 'Valencia', country_code: 'ES' },
  { city: 'Ibiza', country_code: 'ES' },
  { city: 'Copenhagen', country_code: 'DK' },
  { city: 'Stockholm', country_code: 'SE' },
  { city: 'Gothenburg', country_code: 'SE' },
  { city: 'Oslo', country_code: 'NO' },
  { city: 'Helsinki', country_code: 'FI' },
  { city: 'Reykjavik', country_code: 'IS' },
  { city: 'Dublin', country_code: 'IE' },
  { city: 'Manchester', country_code: 'GB' },
  { city: 'Glasgow', country_code: 'GB' },
  { city: 'Bristol', country_code: 'GB' },
  { city: 'Leeds', country_code: 'GB' },
  { city: 'Warsaw', country_code: 'PL' },
  { city: 'Krakow', country_code: 'PL' },
  { city: 'Prague', country_code: 'CZ' },
  { city: 'Budapest', country_code: 'HU' },
  { city: 'Bucharest', country_code: 'RO' },
  { city: 'Sofia', country_code: 'BG' },
  { city: 'Belgrade', country_code: 'RS' },
  { city: 'Zagreb', country_code: 'HR' },
  { city: 'Athens', country_code: 'GR' },
  { city: 'Istanbul', country_code: 'TR' },
  { city: 'Tbilisi', country_code: 'GE' },
  { city: 'Kyiv', country_code: 'UA' },
  { city: 'Moscow', country_code: 'RU' },
  { city: 'Tel Aviv', country_code: 'IL' },
  { city: 'Detroit', country_code: 'US' },
  { city: 'Chicago', country_code: 'US' },
  { city: 'New York', country_code: 'US' },
  { city: 'Los Angeles', country_code: 'US' },
  { city: 'San Francisco', country_code: 'US' },
  { city: 'Miami', country_code: 'US' },
  { city: 'Montreal', country_code: 'CA' },
  { city: 'Toronto', country_code: 'CA' },
  { city: 'Mexico City', country_code: 'MX' },
  { city: 'São Paulo', country_code: 'BR' },
  { city: 'Buenos Aires', country_code: 'AR' },
  { city: 'Bogotá', country_code: 'CO' },
  { city: 'Santiago', country_code: 'CL' },
  { city: 'Tokyo', country_code: 'JP' },
  { city: 'Osaka', country_code: 'JP' },
  { city: 'Seoul', country_code: 'KR' },
  { city: 'Shanghai', country_code: 'CN' },
  { city: 'Bangkok', country_code: 'TH' },
  { city: 'Melbourne', country_code: 'AU' },
  { city: 'Sydney', country_code: 'AU' },
  { city: 'Cape Town', country_code: 'ZA' },
]

// The busiest hubs, surfaced as an on-focus quick-pick so the admin can select
// instead of typing the same handful of cities over and over.
export const TOP_HUBS: City[] = [
  { city: 'Berlin', country_code: 'DE' },
  { city: 'Amsterdam', country_code: 'NL' },
  { city: 'London', country_code: 'GB' },
  { city: 'Paris', country_code: 'FR' },
  { city: 'Barcelona', country_code: 'ES' },
  { city: 'Rotterdam', country_code: 'NL' },
]

// Fold accents + case + surrounding whitespace so "sao paulo" matches "São Paulo".
function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const CITY_INDEX = new Map<string, City>()
for (const c of CITIES) {
  const key = normalize(c.city)
  if (!CITY_INDEX.has(key)) CITY_INDEX.set(key, c)
}

// Exact (accent/case-insensitive) match against the curated list. Returns the
// canonical casing + country code, or null when the city isn't a known hub.
export function lookupCity(input: string): City | null {
  if (!input.trim()) return null
  return CITY_INDEX.get(normalize(input)) ?? null
}

// Best-effort proper casing for cities not in the curated list, so manual entry
// still lands capitalized (e.g. "san josé del cabo" → "San José Del Cabo").
export function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}
