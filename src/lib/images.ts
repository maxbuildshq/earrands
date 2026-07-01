// Artist images come from three CDNs. SoundCloud (the majority) serves
// `Access-Control-Allow-Origin: *`, so we can load those with CORS and the
// service worker caches them as real ~40KB responses. Discogs and Linktree
// send no CORS header, so requesting them with `crossorigin` would fail — they
// stay opaque. Opaque responses are padded heavily against the Cache Storage
// quota (iOS Safari especially), so loading the bulk of images as CORS keeps
// the offline image cache small enough to survive eviction.
export function imageCrossOrigin(url: string | null | undefined): 'anonymous' | undefined {
  if (!url) return undefined
  return /(^|\.)sndcdn\.com$/.test(hostOf(url)) ? 'anonymous' : undefined
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
