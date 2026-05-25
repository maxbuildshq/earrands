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

export type ScrapedSet = {
  artist_name: string // raw string, e.g. "Alarico & Ben Klock"
  stage: string | null // null if lineup-only
  day: string // YYYY-MM-DD
  start_time: string | null // HH:MM, null if lineup-only
  end_time: string | null
  is_live: boolean
}

export type ScrapedArtist = {
  name: string
  bio: string | null
  source_url: string | null
}

export type ScrapedData = {
  festival: ScrapedFestival
  stages: ScrapedStage[]
  sets: ScrapedSet[]
  artists: ScrapedArtist[]
}

export type ScraperAdapter = (url: string) => Promise<ScrapedData>
