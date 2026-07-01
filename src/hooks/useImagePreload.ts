import { useEffect } from 'react'
import type { SetWithStage } from '../types/database'
import { imageCrossOrigin } from '../lib/images'

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
      const cors = imageCrossOrigin(url)
      if (cors) img.crossOrigin = cors
      img.src = url
    }
  }, [sets])
}
