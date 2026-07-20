export type Festival = {
  id: string
  name: string
  slug: string
  location: string | null
  start_date: string
  end_date: string
  timetable_announced: boolean
  published: boolean
  created_at: string
}

export type Stage = {
  id: string
  festival_id: string
  name: string
  sort_order: number
}

export type FestivalSet = {
  id: string
  festival_id: string
  stage_id: string | null
  artist_name: string
  day: string
  start_time: string | null
  end_time: string | null
  is_live: boolean
  performance_type: 'live' | 'hybrid' | null
  is_music_set: boolean
}

export type SetArtistWithBio = {
  billing_order: number
  role: 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'
  artists: {
    name: string
    bio: string | null
    source_url: string | null
    is_collective: boolean
    image_url: string | null
    instagram_url: string | null
    soundcloud_url: string | null
    soundcloud_embed_url: string | null
    bandcamp_url: string | null
    soundcloud_followers: number | null
  }
}

export type SetWithStage = FestivalSet & {
  stages: { name: string; sort_order: number } | null
  set_artists: SetArtistWithBio[] | null
}

export type UserPlan = {
  id: string
  user_id: string
  set_id: string
  created_at: string
}

export type UserRating = {
  id: string
  user_id: string
  set_id: string
  rating: -1 | 1
  created_at: string
}

export type Artist = {
  id: string
  name: string
  sort_name: string
  is_collective: boolean
  bio: string | null
  source_url: string | null
  image_url: string | null
  instagram_url: string | null
  soundcloud_url: string | null
  soundcloud_embed_url: string | null
  bandcamp_url: string | null
  discogs_id: number | null
  enriched_at: string | null
  city: string | null
  country_code: string | null
  soundcloud_followers: number | null
  bio_source: string | null
  bio_festival: string | null
  bio_sources: Array<{ url: string; title: string; snippet: string; type: string }> | null
  bio_generated: string | null
  bio_research: { festival_bio_flagged?: boolean } | null
  enrichment_status: string | null
  image_candidates: ImageCandidate[] | null
  enrichment_confidence: Record<string, FieldConfidence> | null
  created_at: string
}

export type ImageCandidate = {
  url: string
  source: string
  score: number
  confidence?: 'high' | 'medium' | 'low'
  person_detected?: boolean
  person_count?: number
  person_bbox_ratio?: number | null
  error?: string
}

export type FieldConfidence = {
  level: 'high' | 'medium' | 'low'
  evidence: string[]
}

export type SetArtist = {
  id: string
  set_id: string
  artist_id: string
  role: 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'
  billing_order: number
}

export type FestivalFollow = {
  id: string
  user_id: string
  festival_id: string
  notified_at: string | null
  created_at: string
}

export type FestivalRequest = {
  id: string
  user_id: string
  raw_name: string
  region: string | null
  notified_at: string | null
  matched_festival_id: string | null
  created_at: string
}

export type SharedSchedule = {
  id: string
  code: string
  user_id: string
  festival_id: string
  set_ids: string[]
  created_at: string
  updated_at: string
}

export type NotificationLog = {
  id: string
  type: string
  festival_id: string | null
  recipient_count: number
  sent_at: string
  success: boolean
  error: string | null
}

export type EnrichmentJob = {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  festival_slug: string | null
  artist_sort_names: string[] | null
  fields: string[] | null
  search_keywords: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  result_summary: Record<string, unknown> | null
  error: string | null
}

export type ParseSuggestion = {
  id: string
  festival_id: string
  raw_name: string
  current_parse: { collective: string | null; members: string[]; role: string }
  suggested: { collective: string | null; members: string[] }
  confidence: 'high' | 'medium' | 'low'
  reason: string
  detector_reasons: string[]
  status: 'pending' | 'accepted' | 'dismissed'
  created_at: string
  reviewed_at: string | null
}
