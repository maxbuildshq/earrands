import type { ImageCandidate } from './types.js'
import { recordUsage } from './rate-limit.js'

export type ImageScorerConfig = {
  accountId: string
  apiToken: string
  dryRun?: boolean
}

type DetrDetection = {
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  if (buf.byteLength > 10 * 1024 * 1024) throw new Error('Image too large (>10MB)')
  return buf
}

async function callDetr(imageBuffer: ArrayBuffer, config: ImageScorerConfig): Promise<DetrDetection[]> {
  const bytes = Array.from(new Uint8Array(imageBuffer))
  recordUsage('workers-ai')
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/facebook/detr-resnet-50`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: bytes }),
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DETR API ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json() as { result: DetrDetection[] }
  return json.result ?? []
}

function scoreDetections(detections: DetrDetection[]): {
  score: number
  person_detected: boolean
  person_count: number
  person_bbox_ratio: number | null
} {
  const persons = detections.filter(d => d.label === 'person' && d.score > 0.7)
  const person_count = persons.length

  if (person_count === 0) {
    return { score: 10, person_detected: false, person_count: 0, person_bbox_ratio: null }
  }

  // Bounding boxes from DETR are in absolute pixels — compute ratio relative to image extent
  const allBoxes = detections.map(d => d.box)
  const imgWidth = Math.max(...allBoxes.map(b => b.xmax))
  const imgHeight = Math.max(...allBoxes.map(b => b.ymax))
  const imgArea = imgWidth * imgHeight

  const maxRatio = imgArea > 0
    ? Math.max(...persons.map(d => ((d.box.xmax - d.box.xmin) * (d.box.ymax - d.box.ymin)) / imgArea))
    : null

  const bestConfidence = Math.max(...persons.map(d => d.score))

  let score = 10
  score += 50  // person detected
  score += maxRatio != null ? 30 * maxRatio : 0  // portrait bonus
  score -= Math.min(15, 5 * (person_count - 1))  // slight group penalty, capped at -15

  // Use best confidence as a small multiplier on top
  score *= (0.8 + 0.2 * bestConfidence)

  return { score, person_detected: true, person_count, person_bbox_ratio: maxRatio }
}

const SOUNDCLOUD_EARLY_EXIT_SCORE = 60

function sourceBonusFor(source: string): number {
  if (source === 'soundcloud-image') return 15
  if (source === 'discogs-image') return 1
  return 0
}

export async function scoreImageCandidates(
  candidates: Array<{ url: string; source: string }>,
  config: ImageScorerConfig,
): Promise<ImageCandidate[]> {
  const results: ImageCandidate[] = []

  for (const candidate of candidates) {
    const sourceBonus = sourceBonusFor(candidate.source)

    if (config.dryRun) {
      results.push({
        url: candidate.url,
        source: candidate.source,
        score: 0,
        person_detected: false,
        person_count: 0,
        person_bbox_ratio: null,
        error: 'dry-run',
      })
      continue
    }

    try {
      const buf = await fetchImageBuffer(candidate.url)
      const detections = await callDetr(buf, config)
      const scored = scoreDetections(detections)
      results.push({
        url: candidate.url,
        source: candidate.source,
        score: scored.score + sourceBonus,
        person_detected: scored.person_detected,
        person_count: scored.person_count,
        person_bbox_ratio: scored.person_bbox_ratio,
      })
    } catch (err: any) {
      results.push({
        url: candidate.url,
        source: candidate.source,
        score: 10 + sourceBonus,  // baseline — still usable as fallback
        person_detected: false,
        person_count: 0,
        person_bbox_ratio: null,
        error: err.message,
      })
    }

    // SoundCloud avatar is self-uploaded by the artist — trust it outright once it
    // clears a confident person-detection threshold, skipping the remaining candidates.
    const last = results[results.length - 1]
    if (last.source === 'soundcloud-image' && last.score > SOUNDCLOUD_EARLY_EXIT_SCORE) {
      break
    }
  }

  return results
}
