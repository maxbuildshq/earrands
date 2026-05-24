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
  awakenings_url: string | null
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
