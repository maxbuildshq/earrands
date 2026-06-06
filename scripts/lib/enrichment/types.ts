export type EnrichmentField = 'image' | 'instagram' | 'soundcloud' | 'bandcamp'

export type Confidence = 'high' | 'medium' | 'low'

export type EnrichmentResult = {
  sort_name: string
  display_name: string
  image_url: string | null
  instagram_url: string | null
  soundcloud_url: string | null
  soundcloud_embed_url: string | null
  bandcamp_url: string | null
  discogs_id: number | null
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
}
