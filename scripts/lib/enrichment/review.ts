import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import type { EnrichmentField, EnrichmentResult, ReviewFile, ProgressFile, BioResearchFile } from './types.js'

const REVIEW_DIR = 'enrichment-review'

function ensureDir() {
  if (!existsSync(REVIEW_DIR)) mkdirSync(REVIEW_DIR, { recursive: true })
}

// ── Review file ──────────────────────────────────────────────────────────

export function writeReviewFile(festival: string | null, results: EnrichmentResult[], fields?: EnrichmentField[]): string {
  ensureDir()
  const slug = festival ?? 'all'
  const path = `${REVIEW_DIR}/${slug}.json`

  const enriched = results.filter(r => r.soundcloud_url || r.instagram_url || r.image_url)
  const needsReview = results.filter(r => r.needs_review)
  const notFound = results.filter(r => !r.soundcloud_url && !r.instagram_url && !r.image_url && !r.review_notes.includes('Skipped: combo/temporary entry'))

  const review: ReviewFile = {
    generated_at: new Date().toISOString(),
    festival,
    ...(fields ? { fields } : {}),
    stats: {
      total: results.length,
      enriched: enriched.length,
      needs_review: needsReview.length,
      not_found: notFound.length,
    },
    artists: results,
  }

  writeFileSync(path, JSON.stringify(review, null, 2))
  return path
}

export function readReviewFile(path: string): ReviewFile {
  if (!existsSync(path)) {
    throw new Error(`Review file not found: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// ── Progress file (for resume) ───────────────────────────────────────────

export function progressPath(festival: string | null): string {
  ensureDir()
  const slug = festival ?? 'all'
  return `${REVIEW_DIR}/${slug}-progress.json`
}

export function loadProgress(festival: string | null): ProgressFile {
  const path = progressPath(festival)
  if (!existsSync(path)) {
    return { festival, completed_sort_names: [], updated_at: new Date().toISOString() }
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function saveProgress(festival: string | null, completedSortNames: string[]): void {
  const path = progressPath(festival)
  const progress: ProgressFile = {
    festival,
    completed_sort_names: completedSortNames,
    updated_at: new Date().toISOString(),
  }
  writeFileSync(path, JSON.stringify(progress, null, 2))
}

export function clearProgress(festival: string | null): void {
  const path = progressPath(festival)
  if (existsSync(path)) {
    writeFileSync(path, JSON.stringify({ festival, completed_sort_names: [], updated_at: new Date().toISOString() }, null, 2))
  }
}

// ── Bio research files ──────────────────────────────────────────────────

const BIO_CHUNK_SIZE = 25

export function writeBioResearchFiles(festival: string | null, results: EnrichmentResult[]): string[] {
  ensureDir()
  const slug = festival ?? 'all'

  const artistsWithResearch = results
    .filter(r => r.bio_research && (
      r.bio_research.web_sources.length > 0 ||
      r.bio_research.soundcloud_bio ||
      r.bio_research.discogs_bio ||
      r.bio_research.festival_bio
    ))
    .map(r => ({
      sort_name: r.sort_name,
      display_name: r.display_name,
      bio_research: r.bio_research!,
    }))

  if (artistsWithResearch.length === 0) return []

  const totalChunks = Math.ceil(artistsWithResearch.length / BIO_CHUNK_SIZE)
  const paths: string[] = []

  for (let i = 0; i < totalChunks; i++) {
    const chunk = artistsWithResearch.slice(i * BIO_CHUNK_SIZE, (i + 1) * BIO_CHUNK_SIZE)
    const chunkNum = String(i + 1).padStart(2, '0')
    const path = `${REVIEW_DIR}/${slug}-bio-chunk-${chunkNum}.json`

    const file: BioResearchFile = {
      generated_at: new Date().toISOString(),
      festival,
      chunk: i + 1,
      total_chunks: totalChunks,
      artists: chunk,
    }

    writeFileSync(path, JSON.stringify(file, null, 2))
    paths.push(path)
  }

  return paths
}
