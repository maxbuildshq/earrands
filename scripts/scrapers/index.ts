import type { ScraperAdapter } from './types.js'
import { scrapeAwakenings } from './awakenings.js'
import { scrapeDekmantel } from './dekmantel.js'

type AdapterEntry = {
  pattern: RegExp
  adapter: ScraperAdapter
  name: string
}

const adapters: AdapterEntry[] = [
  { pattern: /awakenings\.com/, adapter: scrapeAwakenings, name: 'Awakenings' },
  { pattern: /dekmantelfestival\.com/, adapter: scrapeDekmantel, name: 'Dekmantel' },
]

export function findAdapter(url: string): AdapterEntry | null {
  return adapters.find(a => a.pattern.test(url)) ?? null
}
