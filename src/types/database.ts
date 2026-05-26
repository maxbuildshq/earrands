export type Festival = {
  id: string
  name: string
  slug: string
  location: string | null
  start_date: string
  end_date: string
  timetable_announced: boolean
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

export type SetWithStage = FestivalSet & {
  stages: { name: string; sort_order: number } | null
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
  created_at: string
}

export type SetArtist = {
  id: string
  set_id: string
  artist_id: string
  role: 'solo' | 'b2b' | 'f2f' | 'collab' | 'vs' | 'member'
  billing_order: number
}
