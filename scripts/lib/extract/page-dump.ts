import { getBrowser } from '../../scrapers/base.js'

export type PageImage = {
  src: string
  alt: string | null
}

export type PageDump = {
  url: string
  title: string
  text: string
  payloads: Record<string, unknown>
  xhr: { url: string; body: unknown }[]
  images: PageImage[]
}

// The dump is consumed by the claude CLI reading the file (not inlined into a prompt),
// so caps only guard against pathological multi-MB payloads.
const MAX_TEXT_CHARS = 300_000
const MAX_PAYLOAD_CHARS = 5_000_000
const MAX_XHR_RESPONSES = 20
const MAX_XHR_CHARS = 500_000
const MAX_IMAGES = 300

/**
 * Dump everything an LLM needs to extract festival data from a page:
 * visible DOM text, embedded framework payloads (__NUXT__, __NEXT_DATA__,
 * ld+json), JSON XHR responses, and image URLs (visual references).
 */
export async function dumpPage(url: string): Promise<PageDump> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  const xhr: { url: string; body: unknown }[] = []

  page.on('response', async res => {
    if (xhr.length >= MAX_XHR_RESPONSES) return
    const type = res.request().resourceType()
    if (type !== 'xhr' && type !== 'fetch') return
    const contentType = res.headers()['content-type'] ?? ''
    if (!contentType.includes('json')) return
    try {
      const text = await res.text()
      if (text.length > MAX_XHR_CHARS) return
      xhr.push({ url: res.url(), body: JSON.parse(text) })
    } catch {
      // response body unavailable (redirect/cache) or invalid JSON — skip
    }
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    // scroll through the page to trigger lazy-loaded content/images
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        window.scrollTo(0, y)
        await new Promise(r => setTimeout(r, 100))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(2000)

    const { title, text, payloads, images } = await page.evaluate(() => {
      const w = window as any
      // JSON round-trip inside the page: framework state can hold functions/circulars
      // that break Playwright's own return-value serialization for the whole evaluate.
      // No helper function — tsx/esbuild injects a __name() call that doesn't exist in the page.
      const payloads: Record<string, unknown> = {}
      try {
        if (w.__NUXT__) {
          const full = JSON.stringify(w.__NUXT__)
          // full state can be huge (pinia/config) — keep the data section alone when oversized
          payloads.__NUXT__ = full.length <= 700_000
            ? JSON.parse(full)
            : { data: JSON.parse(JSON.stringify(w.__NUXT__.data)) }
        }
      } catch {
        // circular full state — fall back to the data section alone
        try { payloads.__NUXT__ = { data: JSON.parse(JSON.stringify(w.__NUXT__.data)) } } catch { /* skip */ }
      }
      try { if (w.__NEXT_DATA__) payloads.__NEXT_DATA__ = JSON.parse(JSON.stringify(w.__NEXT_DATA__)) } catch { /* skip */ }

      const ldJson: unknown[] = []
      for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { ldJson.push(JSON.parse(el.textContent ?? '')) } catch { /* skip */ }
      }
      if (ldJson.length > 0) payloads.ldJson = ldJson

      const images = [...document.querySelectorAll('img')]
        .map(img => ({ src: img.currentSrc || img.src, alt: img.alt || null }))
        .filter(i => i.src && !i.src.startsWith('data:'))

      return {
        title: document.title,
        text: document.body?.innerText ?? '',
        payloads,
        images,
      }
    })

    return {
      url,
      title,
      text: text.replace(/\n{3,}/g, '\n\n').slice(0, MAX_TEXT_CHARS),
      payloads: capPayloads(payloads),
      xhr,
      images: dedupeImages(images).slice(0, MAX_IMAGES),
    }
  } finally {
    await page.close()
  }
}

function capPayloads(payloads: Record<string, unknown>): Record<string, unknown> {
  const capped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payloads)) {
    try {
      const json = JSON.stringify(value)
      if (json.length <= MAX_PAYLOAD_CHARS) capped[key] = value
    } catch {
      // circular or unserializable — drop
    }
  }
  return capped
}

function dedupeImages(images: PageImage[]): PageImage[] {
  const seen = new Set<string>()
  return images.filter(i => {
    if (seen.has(i.src)) return false
    seen.add(i.src)
    return true
  })
}
