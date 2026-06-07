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
  created_at: string
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
