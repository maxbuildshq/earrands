export type ScrapedFestival = {
  name: string
  slug: string
  location: string | null
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  timetable_announced: boolean
  website_url: string
}

export type ScrapedStage = {
  name: string
  sort_order: number
}

// Mutually-exclusive performance modes (sets.performance_type, migration 040 — the single
// source of truth for a set's mode; the legacy is_live boolean was retired, see ADR 012).
// "live" = live PA/hardware set; "hybrid" = mix of DJing + live composition; null = normal DJ set.
export type PerformanceType = 'live' | 'hybrid'

export type ScrapedSet = {
  artist_name: string // raw string, e.g. "Alarico & Ben Klock"
  stage: string | null // null if lineup-only
  day: string // YYYY-MM-DD
  start_time: string | null // HH:MM, null if lineup-only
  end_time: string | null
  performance_type: PerformanceType | null
}

export type ScrapedArtist = {
  name: string
  bio: string | null
  source_url: string | null
  image_url?: string | null // festival press photo — admin visual reference only, never a display candidate (ADR 011)
}

export type ScrapedData = {
  festival: ScrapedFestival
  stages: ScrapedStage[]
  sets: ScrapedSet[]
  artists: ScrapedArtist[]
  // Extraction-quality warnings from the scraper (e.g. poster columns whose
  // times came from a less precise fallback). Surfaced as `warn` flags in the
  // diff preview so they reach the human review gate, not just scrape logs.
  extraction_warnings?: string[]
}

export type ScraperAdapter = (url: string) => Promise<ScrapedData>
