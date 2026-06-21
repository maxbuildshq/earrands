export type EnrichmentField = 'image' | 'instagram' | 'soundcloud' | 'bandcamp' | 'bio' | 'location'

export type Confidence = 'high' | 'medium' | 'low'

export type BioSource = {
  url: string
  title: string
  snippet: string
  content?: string
  type: 'web' | 'soundcloud' | 'discogs' | 'festival' | 'bandcamp'
}

export type BioResearch = {
  soundcloud_bio: string | null
  discogs_bio: string | null
  festival_bio: string | null
  festival_bio_flagged: boolean
  web_sources: BioSource[]
}

export type ImageCandidate = {
  url: string
  source: string
  score: number
  person_detected: boolean
  person_count: number
  person_bbox_ratio: number | null
  error?: string
}

export type EnrichmentResult = {
  sort_name: string
  display_name: string
  image_url: string | null
  image_candidates?: ImageCandidate[] | null
  instagram_url: string | null
  soundcloud_url: string | null
  soundcloud_embed_url: string | null
  bandcamp_url: string | null
  discogs_id: number | null
  city: string | null
  country_code: string | null
  bio: string | null
  bio_source: string | null
  bio_festival: string | null
  bio_sources: BioSource[] | null
  bio_research: BioResearch | null
  confidence: Confidence
  sources: string[]
  needs_review: boolean
  review_notes: string[]
}

export type ReviewFile = {
  generated_at: string
  festival: string | null
  stats: {
    total: number
    enriched: number
    needs_review: number
    not_found: number
  }
  artists: EnrichmentResult[]
}

export type BioResearchFile = {
  generated_at: string
  festival: string | null
  chunk: number
  total_chunks: number
  artists: Array<{
    sort_name: string
    display_name: string
    bio_research: BioResearch
  }>
}

export type ProgressFile = {
  festival: string | null
  completed_sort_names: string[]
  updated_at: string
}

export type ArtistRow = {
  id: string
  name: string
  sort_name: string
  is_collective: boolean
  image_url: string | null
  instagram_url: string | null
  soundcloud_url: string | null
  soundcloud_embed_url: string | null
  bandcamp_url: string | null
  discogs_id: number | null
  enriched_at: string | null
  bio: string | null
  city: string | null
  country_code: string | null
  enrichment_status: string | null
}
