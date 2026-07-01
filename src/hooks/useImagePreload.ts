import { useEffect } from 'react'
import type { SetWithStage } from '../types/database'

export function useImagePreload(sets: SetWithStage[]) {
  useEffect(() => {
    if (sets.length === 0) return
    const urls = new Set<string>()
    for (const set of sets) {
      for (const sa of set.set_artists ?? []) {
        if (sa.artists?.image_url) urls.add(sa.artists.image_url)
      }
    }
    for (const url of urls) {
      const img = new Image()
      img.src = url
    }
  }, [sets])
}
