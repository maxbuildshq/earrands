import { sleep } from '../../scrapers/base.js'

// Common country name → ISO 3166-1 alpha-2
const COUNTRY_CODES: Record<string, string> = {
  'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'argentina': 'AR',
  'australia': 'AU', 'austria': 'AT', 'belgium': 'BE', 'brazil': 'BR',
  'bulgaria': 'BG', 'canada': 'CA', 'chile': 'CL', 'china': 'CN',
  'colombia': 'CO', 'croatia': 'HR', 'czech republic': 'CZ', 'czechia': 'CZ',
  'denmark': 'DK', 'egypt': 'EG', 'estonia': 'EE', 'finland': 'FI',
  'france': 'FR', 'georgia': 'GE', 'germany': 'DE', 'greece': 'GR',
  'hungary': 'HU', 'india': 'IN', 'indonesia': 'ID', 'iran': 'IR',
  'ireland': 'IE', 'israel': 'IL', 'italy': 'IT', 'japan': 'JP',
  'jordan': 'JO', 'latvia': 'LV', 'lebanon': 'LB', 'lithuania': 'LT',
  'luxembourg': 'LU', 'mexico': 'MX', 'moldova': 'MD', 'morocco': 'MA',
  'netherlands': 'NL', 'new zealand': 'NZ', 'nigeria': 'NG', 'norway': 'NO',
  'peru': 'PE', 'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT',
  'romania': 'RO', 'russia': 'RU', 'serbia': 'RS', 'singapore': 'SG',
  'slovakia': 'SK', 'slovenia': 'SI', 'south africa': 'ZA', 'south korea': 'KR',
  'spain': 'ES', 'sweden': 'SE', 'switzerland': 'CH', 'taiwan': 'TW',
  'thailand': 'TH', 'turkey': 'TR', 'ukraine': 'UA', 'united arab emirates': 'AE',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB', 'scotland': 'GB',
  'united states': 'US', 'usa': 'US', 'u.s.a.': 'US', 'uruguay': 'UY',
  'venezuela': 'VE', 'vietnam': 'VN',
}

function parseLocation(text: string): { city: string | null; country_code: string | null } {
  const parts = text.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return { city: null, country_code: null }

  const countryName = parts[parts.length - 1].toLowerCase()
  const country_code = COUNTRY_CODES[countryName] ?? null
  const city = parts.length > 1 ? parts[0] : null

  return { city, country_code }
}

export type BandcampProfile = {
  city: string | null
  country_code: string | null
}

export async function scrapeBandcampProfile(url: string): Promise<BandcampProfile | null> {
  try {
    await sleep(500)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Earrands/1.0)' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null

    const html = await res.text()

    // <span class="location secondaryText">City, Country</span>
    const m = html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/)
    if (!m) return null

    return parseLocation(m[1].trim())
  } catch {
    return null
  }
}
