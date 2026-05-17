export type Festival = {
  id: string
  name: string
  slug: string
  location: string | null
  start_date: string
  end_date: string
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
  stage_id: string
  artist_name: string
  day: string
  start_time: string
  end_time: string
  is_live: boolean
  awakenings_url: string | null
}

export type SetWithStage = FestivalSet & {
  stages: { name: string; sort_order: number }
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
